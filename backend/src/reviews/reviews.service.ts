import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InstructorReplyDto } from './dto/instructor-reply.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { QueryCourseReviewsDto } from './dto/query-course-reviews.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';
import { QueryInstructorReviewsDto } from './dto/query-instructor-reviews.dto';
import {
  FormattedCourseReview,
  CourseReviewSummary,
  PaginatedReviewsResult,
} from './interfaces/review.interface';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly reviewsRepo: ReviewsRepository) {}

  /**
   * Helper to resolve course by ID or slug.
   */
  private async resolveCourse(idOrSlug: string) {
    const course = await this.reviewsRepo.findCourseByIdOrSlug(idOrSlug);
    if (!course) {
      throw new NotFoundException(`Course '${idOrSlug}' was not found.`);
    }
    return course;
  }

  /**
   * Can the caller act on other people's reviews and replies? Decided by the reviews:moderate
   * permission (Roles & Permissions), not by role names.
   */
  private isAdmin(user: AuthenticatedUser): boolean {
    return Array.isArray(user.permissions) && user.permissions.includes('reviews:moderate');
  }

  /**
   * 1. Student submits a rating and review for an enrolled course.
   */
  async submitReview(
    courseIdOrSlug: string,
    dto: CreateReviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<FormattedCourseReview> {
    const course = await this.resolveCourse(courseIdOrSlug);

    // Rule: Anti-self-review constraint (Instructors cannot review their own course)
    if (course.instructor_id === currentUser.userId) {
      throw new ForbiddenException(
        'Instructors cannot submit ratings or reviews for their own courses.',
      );
    }

    // Rule 1: Active Enrollment / Purchased Course Verification
    // (Non-purchased users have read-only access like Udemy; enrolled students can rate & review)
    const enrollment = await this.reviewsRepo.checkActiveEnrollment(
      course.course_id,
      currentUser.userId,
    );
    if (!enrollment.isEnrolled) {
      throw new ForbiddenException(
        'You must be actively enrolled in this course to submit a rating and review.',
      );
    }

    // Rule 3: Single Review per Student per Course
    const existingReview = await this.reviewsRepo.findReviewByStudentAndCourse(
      course.course_id,
      currentUser.userId,
    );

    if (existingReview) {
      if (existingReview.deleted_at === null) {
        throw new ConflictException(
          'You have already submitted a review for this course. You can edit your existing review.',
        );
      }
      // If previous review was soft-deleted, we update and un-delete it
      const restored = await this.reviewsRepo.updateReview(existingReview.review_id, {
        rating: dto.rating,
        reviewTitle: dto.reviewTitle,
        reviewText: dto.reviewText,
      });
      // Restore status to published and clear deleted_at
      await this.reviewsRepo.moderateReview(
        existingReview.review_id,
        'published',
        null,
        currentUser.userId,
      );
      await this.reviewsRepo.syncCourseRatingStats(course.course_id);

      return {
        reviewId: restored.review_id,
        courseId: restored.course_id,
        courseTitle: course.title,
        courseSlug: course.slug,
        studentId: currentUser.userId,
        studentName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Student',
        studentAvatarUrl: null,
        rating: restored.rating,
        reviewTitle: restored.review_title,
        reviewText: restored.review_text,
        status: 'published',
        isEdited: true,
        isOwnReview: true,
        createdAt: new Date(restored.created_at).toISOString(),
        updatedAt: new Date(restored.updated_at).toISOString(),
        instructorReply: null,
      };
    }

    // Create fresh review
    const created = await this.reviewsRepo.createReview({
      courseId: course.course_id,
      studentId: currentUser.userId,
      rating: dto.rating,
      reviewTitle: dto.reviewTitle,
      reviewText: dto.reviewText,
    });

    // Synchronize course rating aggregates
    await this.reviewsRepo.syncCourseRatingStats(course.course_id);

    return {
      reviewId: created.review_id,
      courseId: created.course_id,
      courseTitle: course.title,
      courseSlug: course.slug,
      studentId: currentUser.userId,
      studentName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Student',
      studentAvatarUrl: null,
      rating: created.rating,
      reviewTitle: created.review_title,
      reviewText: created.review_text,
      status: created.status,
      isEdited: false,
      isOwnReview: true,
      createdAt: new Date(created.created_at).toISOString(),
      updatedAt: new Date(created.updated_at).toISOString(),
      instructorReply: null,
    };
  }

  /**
   * 2. Student edits their own review.
   */
  async updateOwnReview(
    reviewId: string,
    dto: UpdateReviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<FormattedCourseReview> {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review || review.deleted_at !== null) {
      throw new NotFoundException('Review was not found.');
    }

    if (review.student_id !== currentUser.userId) {
      throw new ForbiddenException('You can only edit your own review.');
    }

    const updated = await this.reviewsRepo.updateReview(reviewId, {
      rating: dto.rating,
      reviewTitle: dto.reviewTitle,
      reviewText: dto.reviewText,
    });

    // Recompute course statistics
    await this.reviewsRepo.syncCourseRatingStats(updated.course_id);

    // Fetch existing instructor reply if any
    const reply = await this.reviewsRepo.findReplyByReviewId(reviewId);
    let instructorReply = null;
    if (reply && reply.status === 'published') {
      instructorReply = {
        reviewReplyId: reply.review_reply_id,
        reviewId: reply.review_id,
        courseId: reply.course_id,
        instructorId: reply.instructor_id,
        instructorName: 'Instructor',
        instructorAvatarUrl: null,
        replyText: reply.reply_text,
        createdAt: new Date(reply.created_at).toISOString(),
        updatedAt: new Date(reply.updated_at).toISOString(),
      };
    }

    return {
      reviewId: updated.review_id,
      courseId: updated.course_id,
      studentId: updated.student_id,
      studentName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Student',
      studentAvatarUrl: null,
      rating: updated.rating,
      reviewTitle: updated.review_title,
      reviewText: updated.review_text,
      status: updated.status,
      isEdited: updated.is_edited,
      isOwnReview: true,
      createdAt: new Date(updated.created_at).toISOString(),
      updatedAt: new Date(updated.updated_at).toISOString(),
      instructorReply,
    };
  }

  /**
   * 3. Student deletes their own review (or Admin).
   */
  async deleteReview(
    reviewId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review || review.deleted_at !== null) {
      throw new NotFoundException('Review was not found.');
    }

    const isOwner = review.student_id === currentUser.userId;
    const isAdmin = this.isAdmin(currentUser);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to delete this review.');
    }

    await this.reviewsRepo.softDeleteReview(reviewId);
    await this.reviewsRepo.syncCourseRatingStats(review.course_id);

    return {
      success: true,
      message: 'Review deleted successfully.',
    };
  }

  /**
   * 4. Get course review summary and rating breakdown (Public).
   */
  async getCourseReviewSummary(courseIdOrSlug: string): Promise<CourseReviewSummary> {
    const course = await this.resolveCourse(courseIdOrSlug);
    return this.reviewsRepo.getCourseReviewSummary(course.course_id);
  }

  /**
   * 5. Get paginated published reviews for course details page (Public).
   */
  async getCourseReviews(
    courseIdOrSlug: string,
    dto: QueryCourseReviewsDto,
    currentUserId?: string,
  ): Promise<PaginatedReviewsResult> {
    const course = await this.resolveCourse(courseIdOrSlug);

    const { reviews, total } = await this.reviewsRepo.findPublishedReviews(
      course.course_id,
      {
        page: dto.page,
        limit: dto.limit,
        rating: dto.rating,
        sortBy: dto.sortBy,
        currentUserId,
      },
    );

    const summary = await this.reviewsRepo.getCourseReviewSummary(course.course_id);
    const limit = dto.limit || 10;
    const page = dto.page || 1;

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary,
    };
  }

  /**
   * 6. Get student's own review for a course (or null).
   */
  async getMyReviewForCourse(
    courseIdOrSlug: string,
    currentUser: AuthenticatedUser,
  ): Promise<FormattedCourseReview | null> {
    const course = await this.resolveCourse(courseIdOrSlug);
    const review = await this.reviewsRepo.findReviewByStudentAndCourse(
      course.course_id,
      currentUser.userId,
    );

    if (!review || review.deleted_at !== null) {
      return null;
    }

    const reply = await this.reviewsRepo.findReplyByReviewId(review.review_id);
    let instructorReply = null;
    if (reply && reply.status === 'published') {
      instructorReply = {
        reviewReplyId: reply.review_reply_id,
        reviewId: reply.review_id,
        courseId: reply.course_id,
        instructorId: reply.instructor_id,
        instructorName: 'Instructor',
        instructorAvatarUrl: null,
        replyText: reply.reply_text,
        createdAt: new Date(reply.created_at).toISOString(),
        updatedAt: new Date(reply.updated_at).toISOString(),
      };
    }

    return {
      reviewId: review.review_id,
      courseId: review.course_id,
      courseTitle: course.title,
      courseSlug: course.slug,
      studentId: currentUser.userId,
      studentName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Student',
      studentAvatarUrl: null,
      rating: review.rating,
      reviewTitle: review.review_title,
      reviewText: review.review_text,
      status: review.status,
      isEdited: review.is_edited,
      isOwnReview: true,
      createdAt: new Date(review.created_at).toISOString(),
      updatedAt: new Date(review.updated_at).toISOString(),
      instructorReply,
    };
  }

  /**
   * 7. Instructor replies to a review on their course (or Admin).
   */
  async replyToReview(
    reviewId: string,
    dto: InstructorReplyDto,
    currentUser: AuthenticatedUser,
  ) {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review || review.deleted_at !== null) {
      throw new NotFoundException('Review was not found.');
    }

    const course = await this.reviewsRepo.findCourseByIdOrSlug(review.course_id);
    if (!course) {
      throw new NotFoundException('Course associated with review was not found.');
    }

    const isCourseInstructor = course.instructor_id === currentUser.userId;
    const isAdmin = this.isAdmin(currentUser);

    if (!isCourseInstructor && !isAdmin) {
      throw new ForbiddenException(
        'Only the course instructor or an administrator can reply to this review.',
      );
    }

    const reply = await this.reviewsRepo.upsertInstructorReply({
      reviewId: review.review_id,
      courseId: review.course_id,
      instructorId: currentUser.userId,
      replyText: dto.replyText,
    });

    return {
      reviewReplyId: reply.review_reply_id,
      reviewId: reply.review_id,
      courseId: reply.course_id,
      instructorId: reply.instructor_id,
      instructorName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Instructor',
      replyText: reply.reply_text,
      createdAt: new Date(reply.created_at).toISOString(),
      updatedAt: new Date(reply.updated_at).toISOString(),
    };
  }

  /**
   * 8. Instructor deletes their reply.
   */
  async deleteInstructorReply(
    reviewId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review || review.deleted_at !== null) {
      throw new NotFoundException('Review was not found.');
    }

    const course = await this.reviewsRepo.findCourseByIdOrSlug(review.course_id);
    if (!course) {
      throw new NotFoundException('Course associated with review was not found.');
    }

    const isCourseInstructor = course.instructor_id === currentUser.userId;
    const isAdmin = this.isAdmin(currentUser);

    if (!isCourseInstructor && !isAdmin) {
      throw new ForbiddenException(
        'Only the course instructor or an administrator can delete this reply.',
      );
    }

    const deleted = await this.reviewsRepo.deleteInstructorReply(reviewId);
    if (!deleted) {
      throw new NotFoundException('No reply found to delete.');
    }

    return {
      success: true,
      message: 'Instructor reply deleted successfully.',
    };
  }

  /**
   * 9. Instructor dashboard: view reviews on own courses.
   */
  async getInstructorReviews(
    currentUser: AuthenticatedUser,
    dto: QueryInstructorReviewsDto,
  ) {
    const { reviews, total } = await this.reviewsRepo.findInstructorReviews(
      currentUser.userId,
      {
        page: dto.page,
        limit: dto.limit,
        courseId: dto.courseId,
        rating: dto.rating,
        replyStatus: dto.replyStatus,
        sortBy: dto.sortBy,
      },
    );

    const limit = dto.limit || 20;
    const page = dto.page || 1;

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 10. Admin moderation panel: view all reviews with filters.
   */
  async getAdminReviews(dto: QueryAdminReviewsDto) {
    const { reviews, total } = await this.reviewsRepo.findAdminReviews({
      page: dto.page,
      limit: dto.limit,
      status: dto.status,
      courseId: dto.courseId,
      instructorId: dto.instructorId,
      studentId: dto.studentId,
      rating: dto.rating,
      search: dto.search,
      sortBy: dto.sortBy,
    });

    const limit = dto.limit || 20;
    const page = dto.page || 1;

    return {
      reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * 11. Admin moderates a review (hide, restore, or flag).
   */
  async moderateReview(
    reviewId: string,
    dto: ModerateReviewDto,
    currentUser: AuthenticatedUser,
  ): Promise<FormattedCourseReview> {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review || review.deleted_at !== null) {
      throw new NotFoundException('Review was not found.');
    }

    const moderated = await this.reviewsRepo.moderateReview(
      reviewId,
      dto.status,
      dto.moderationReason || null,
      currentUser.userId,
    );

    // Sync course rating stats (e.g. if review is hidden, it stops counting towards average)
    await this.reviewsRepo.syncCourseRatingStats(review.course_id);

    return {
      reviewId: moderated.review_id,
      courseId: moderated.course_id,
      studentId: moderated.student_id,
      studentName: 'Student',
      studentAvatarUrl: null,
      rating: moderated.rating,
      reviewTitle: moderated.review_title,
      reviewText: moderated.review_text,
      status: moderated.status,
      isEdited: moderated.is_edited,
      moderationReason: moderated.moderation_reason,
      moderatedBy: currentUser.userId,
      moderatedAt: new Date(moderated.moderated_at || Date.now()).toISOString(),
      createdAt: new Date(moderated.created_at).toISOString(),
      updatedAt: new Date(moderated.updated_at).toISOString(),
      instructorReply: null,
    };
  }

  /**
   * 12. Admin permanently removes a review.
   */
  async adminRemoveReview(
    reviewId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    await this.reviewsRepo.hardDeleteReview(reviewId);
    await this.reviewsRepo.syncCourseRatingStats(review.course_id);

    return {
      success: true,
      message: 'Review permanently removed by administrator.',
    };
  }
}

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import {
  CourseApprovalAction,
  CourseStatus,
  COURSE_STATUS_TRANSITIONS,
} from './constants/course-status.constants';
import { QueryApprovalDto } from './dto/query-approval.dto';
import {
  CourseReviewDetail,
  CourseStatusHistoryRow,
  ApprovalStats,
} from './interfaces/course-approval.interface';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class CourseApprovalService {
  private readonly logger = new Logger(CourseApprovalService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly coursesRepository: CoursesRepository,
    private readonly coursesService: CoursesService,
  ) {}

  /**
   * Reviewers (courses:approve / courses:publish) must read any course for review,
   * even without courses:manage. Used for READ-ONLY lookups only (checklist, review detail).
   */
  private asReviewer(user: { userId: string; roles?: string[]; permissions?: string[] }) {
    return { ...user, permissions: [...(user.permissions || []), 'courses:manage'] };
  }

  /**
   * 1. CENTRAL TRANSACTION-BASED STATUS TRANSITION
   * Atomic row locking, permission & transition validation, checklist verification,
   * conditional update and audit history insertion.
   */
  async transition(
    courseId: string,
    action: CourseApprovalAction,
    user: { userId: string; roles?: string[]; permissions?: string[] },
    payload?: { note?: string; reason?: string },
  ) {
    const rule = COURSE_STATUS_TRANSITIONS[action];
    if (!rule) {
      throw new BadRequestException(`Unknown course approval action: ${action}`);
    }

    // Execute atomically inside database transaction
    return this.databaseService.withTransaction(async (client) => {
      // Step 1: Pessimistic Row Lock (SELECT ... FOR UPDATE)
      const existing = await this.coursesRepository.findByIdForUpdate(courseId, client);
      if (!existing) {
        throw new NotFoundException('Course not found');
      }

      // Step 2: Validate ownership & anti-self-review constraints
      if (action === 'submit' || action === 'withdraw') {
        // Only course author can submit or withdraw
        if (existing.instructor_id !== user.userId) {
          throw new ForbiddenException(
            `Only the course owner can ${action} this course.`,
          );
        }
      }

      if (action === 'approve' || action === 'reject') {
        // Author cannot review their own course, even SUPER_ADMIN
        if (existing.instructor_id === user.userId) {
          throw new ForbiddenException(
            'Course authors cannot approve or reject their own course.',
          );
        }
      }

      // Step 3: Validate status transition matrix
      if (!rule.from.includes(existing.status as CourseStatus)) {
        throw new ConflictException(
          `Cannot ${action} course in status "${existing.status}". Allowed previous status: ${rule.from.join(', ')}.`,
        );
      }

      // Step 4: Action-specific validation
      if (action === 'reject') {
        if (!payload?.reason || !payload.reason.trim()) {
          throw new BadRequestException('Rejection reason is required.');
        }
      }

      // Step 5: Checklist check for submit and approve
      if (rule.checklistRequired) {
        // Run full 10-point checklist
        // Submit runs as the owner; approve runs as a reviewer who may not own the course
        const checklistUser = action === 'submit' ? user : this.asReviewer(user);
        const checklist = await this.coursesService.getCourseChecklist(courseId, checklistUser);
        if (!checklist.ready) {
          const failedItems = checklist.items.filter((item) => !item.ok);
          throw new UnprocessableEntityException({
            message: `Course does not meet all submission requirements for action "${action}".`,
            failedItems,
            checklist,
          });
        }
      }

      // Step 6: Prepare status and audit fields
      const now = new Date();
      const fields: {
        status: CourseStatus;
        rejectionReason?: string | null;
        submittedAt?: Date | null;
        reviewedBy?: string | null;
        reviewedAt?: Date | null;
        publishedAt?: Date | null;
        archivedAt?: Date | null;
        isFeatured?: boolean;
      } = {
        status: rule.to,
      };

      if (action === 'submit') {
        fields.submittedAt = now;
        fields.rejectionReason = null;
      } else if (action === 'withdraw') {
        // Revert to draft; retain previous review timestamps for audit, but clear active rejection
      } else if (action === 'approve') {
        fields.reviewedBy = user.userId;
        fields.reviewedAt = now;
        fields.rejectionReason = null;
      } else if (action === 'reject') {
        fields.reviewedBy = user.userId;
        fields.reviewedAt = now;
        fields.rejectionReason = payload?.reason?.trim() || null;
      } else if (action === 'publish') {
        fields.publishedAt = now;
        fields.rejectionReason = null;
        if (!existing.reviewed_by) {
          fields.reviewedBy = user.userId;
          fields.reviewedAt = now;
        }
      } else if (action === 'archive') {
        fields.archivedAt = now;
        // Featured status is reset when a course is archived
        fields.isFeatured = false;
      } else if (action === 'restore') {
        fields.archivedAt = null;
        fields.submittedAt = null;
        // Keep published_at: it marks the course as "was public", which freezes its slug
        // (updateCourse only regenerates slugs for never-published courses), so shared links keep working.
      }

      // Step 7: Conditional update with expected status guard
      const updatedCourse = await this.coursesRepository.updateStatus(
        courseId,
        rule.from,
        fields,
        client,
      );

      if (!updatedCourse) {
        throw new ConflictException(
          'Course status conflict detected. Another process may have modified this course.',
        );
      }

      // Step 7b: Activate any proposed course coupon upon approval or publishing
      if (action === 'approve' || action === 'publish') {
        await client.query(
          `UPDATE coupons SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE course_id = $1;`,
          [courseId],
        );
      }

      // Step 8: Insert status history record in the same transaction
      const note =
        action === 'reject'
          ? payload?.reason?.trim()
          : payload?.note?.trim() ||
            (action === 'publish' && existing.status !== 'approved'
              ? `Directly published by admin from ${existing.status}`
              : null);

      const history = await this.coursesRepository.insertStatusHistory(
        {
          courseId,
          fromStatus: existing.status,
          toStatus: rule.to,
          changedBy: user.userId,
          note,
        },
        client,
      );

      this.logger.log(
        `Course ${courseId} transitioned from ${existing.status} to ${rule.to} by user ${user.userId} (action: ${action})`,
      );

      return {
        message: `Course successfully transitioned to "${rule.to}".`,
        course: updatedCourse,
        history,
      };
    });
  }

  /**
   * 2. GET APPROVAL QUEUE
   */
  async getQueue(query: QueryApprovalDto) {
    return this.coursesRepository.findApprovalQueue(query);
  }

  /**
   * 3. GET APPROVAL STATS
   */
  async getStats(): Promise<ApprovalStats> {
    return this.coursesRepository.getApprovalStats();
  }

  /**
   * 4. GET REVIEW DETAIL (Course + Instructor + Dev 2 Curriculum Summary + Checklist + History)
   */
  async getReviewDetail(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseReviewDetail> {
    const reviewer = this.asReviewer(user);
    const course = await this.coursesRepository.findDetailById(courseId, reviewer);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const [curriculumSummary, checklist, history, couponRes] = await Promise.all([
      this.coursesRepository.getCurriculumSummary(courseId),
      this.coursesService.getCourseChecklist(courseId, reviewer),
      this.coursesRepository.findStatusHistory(courseId),
      this.databaseService.executeQuery(
        `SELECT coupon_id, code, description, discount_type, discount_value, is_active, usage_limit, valid_until
         FROM coupons WHERE course_id = $1 ORDER BY created_at DESC LIMIT 1;`,
        [courseId],
      ),
    ]);

    return {
      course,
      curriculumSummary,
      checklist,
      proposedCoupon: couponRes.rows[0] || null,
      latestHistory: history.slice(0, 10),
    };
  }

  /**
   * 5. GET STATUS HISTORY (Audit Trail)
   */
  async getHistory(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseStatusHistoryRow[]> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const isOwner = course.instructor_id === user.userId;
    const canReview =
      user.permissions?.includes('courses:approve') ||
      user.permissions?.includes('courses:manage') ||
      user.permissions?.includes('courses:publish') ||
      isOperationsAdmin(user);

    if (!isOwner && !canReview) {
      // Same as other course endpoints: don't reveal that the course exists
      throw new NotFoundException('Course not found');
    }

    return this.coursesRepository.findStatusHistory(courseId);
  }

  /**
   * 6. TOGGLE FEATURED STATUS
   */
  async setFeatured(courseId: string, isFeatured: boolean) {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (isFeatured && course.status !== 'published') {
      throw new ConflictException(
        'Only published courses can be featured on the course catalogue.',
      );
    }

    const updated = await this.coursesRepository.setFeatured(courseId, isFeatured);
    return {
      message: `Course ${isFeatured ? 'featured' : 'unfeatured'} successfully.`,
      course: updated,
    };
  }
}


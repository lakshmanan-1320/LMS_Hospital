import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CourseReviewRecord,
  ReviewReplyRecord,
  FormattedCourseReview,
  FormattedInstructorReply,
  CourseReviewSummary,
  ReviewStatus,
} from './interfaces/review.interface';

@Injectable()
export class ReviewsRepository {
  private readonly logger = new Logger(ReviewsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Check if a student is actively enrolled in a course.
   */
  async checkActiveEnrollment(
    courseId: string,
    studentId: string,
  ): Promise<{ isEnrolled: boolean; enrollmentStatus?: string }> {
    const res = await this.db.query(
      `
      SELECT enrollment_id, enrollment_status
      FROM course_enrollments
      WHERE course_id = $1 AND student_id = $2
      LIMIT 1
      `,
      [courseId, studentId],
    );

    if (res.rows.length === 0) {
      return { isEnrolled: false };
    }

    const status = res.rows[0].enrollment_status;
    const isEnrolled = status === 'active' || status === 'completed';
    return { isEnrolled, enrollmentStatus: status };
  }

  /**
   * Check if a student has accessed / started learning the course.
   * Looks for progress in student_lesson_progress or learning sessions.
   */
  async checkCourseAccess(courseId: string, studentId: string): Promise<boolean> {
    // 1. Check lesson progress (watched time > 0, completed, or position > 0)
    const progressRes = await this.db.query(
      `
      SELECT 1
      FROM student_lesson_progress
      WHERE course_id = $1 AND student_id = $2
        AND (max_watched_seconds > 0 OR is_completed = TRUE OR last_position_seconds > 0)
      LIMIT 1
      `,
      [courseId, studentId],
    );

    if (progressRes.rows.length > 0) {
      return true;
    }

    // 2. Check student learning sessions
    const sessionRes = await this.db.query(
      `
      SELECT 1
      FROM student_learning_sessions
      WHERE course_id = $1 AND student_id = $2
        AND seconds_watched > 0
      LIMIT 1
      `,
      [courseId, studentId],
    );

    return sessionRes.rows.length > 0;
  }

  /**
   * Find course details by ID or Slug.
   */
  async findCourseByIdOrSlug(idOrSlug: string): Promise<{
    course_id: string;
    instructor_id: string;
    title: string;
    slug: string;
    status: string;
  } | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const sql = isUuid
      ? `SELECT course_id, instructor_id, title, slug, status FROM courses WHERE course_id = $1 LIMIT 1`
      : `SELECT course_id, instructor_id, title, slug, status FROM courses WHERE slug = $1 LIMIT 1`;

    const res = await this.db.query(sql, [idOrSlug]);
    return res.rows[0] || null;
  }

  /**
   * Find review by review_id.
   */
  async findReviewById(reviewId: string): Promise<CourseReviewRecord | null> {
    const res = await this.db.query<CourseReviewRecord>(
      `
      SELECT *
      FROM course_reviews
      WHERE review_id = $1
      LIMIT 1
      `,
      [reviewId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find student's existing review for a course.
   */
  async findReviewByStudentAndCourse(
    courseId: string,
    studentId: string,
  ): Promise<CourseReviewRecord | null> {
    const res = await this.db.query<CourseReviewRecord>(
      `
      SELECT *
      FROM course_reviews
      WHERE course_id = $1 AND student_id = $2
      LIMIT 1
      `,
      [courseId, studentId],
    );
    return res.rows[0] || null;
  }

  /**
   * Create a new course review.
   */
  async createReview(data: {
    courseId: string;
    studentId: string;
    rating: number;
    reviewTitle?: string;
    reviewText?: string;
  }): Promise<CourseReviewRecord> {
    const res = await this.db.query<CourseReviewRecord>(
      `
      INSERT INTO course_reviews (
        course_id, student_id, rating, review_title, review_text,
        status, is_edited, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'published', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
      `,
      [
        data.courseId,
        data.studentId,
        data.rating,
        data.reviewTitle || null,
        data.reviewText || null,
      ],
    );
    return res.rows[0];
  }

  /**
   * Update an existing review by student.
   */
  async updateReview(
    reviewId: string,
    data: {
      rating?: number;
      reviewTitle?: string;
      reviewText?: string;
    },
  ): Promise<CourseReviewRecord> {
    const updates: string[] = ['is_edited = TRUE', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [reviewId];

    if (data.rating !== undefined) {
      params.push(data.rating);
      updates.push(`rating = $${params.length}`);
    }
    if (data.reviewTitle !== undefined) {
      params.push(data.reviewTitle || null);
      updates.push(`review_title = $${params.length}`);
    }
    if (data.reviewText !== undefined) {
      params.push(data.reviewText || null);
      updates.push(`review_text = $${params.length}`);
    }

    const sql = `
      UPDATE course_reviews
      SET ${updates.join(', ')}
      WHERE review_id = $1
      RETURNING *
    `;

    const res = await this.db.query<CourseReviewRecord>(sql, params);
    return res.rows[0];
  }

  /**
   * Soft-delete a review (sets deleted_at and status = 'hidden').
   */
  async softDeleteReview(reviewId: string): Promise<CourseReviewRecord | null> {
    const res = await this.db.query<CourseReviewRecord>(
      `
      UPDATE course_reviews
      SET deleted_at = CURRENT_TIMESTAMP,
          status = 'hidden',
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $1
      RETURNING *
      `,
      [reviewId],
    );
    return res.rows[0] || null;
  }

  /**
   * Hard delete a review (Admin action or cleanup).
   */
  async hardDeleteReview(reviewId: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM course_reviews WHERE review_id = $1`,
      [reviewId],
    );
    return (res.rowCount || 0) > 0;
  }

  /**
   * Moderate review status (Admin action).
   */
  async moderateReview(
    reviewId: string,
    status: ReviewStatus,
    moderationReason: string | null,
    moderatedBy: string,
  ): Promise<CourseReviewRecord> {
    const res = await this.db.query<CourseReviewRecord>(
      `
      UPDATE course_reviews
      SET status = $2,
          moderation_reason = $3,
          moderated_by = $4,
          moderated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE review_id = $1
      RETURNING *
      `,
      [reviewId, status, moderationReason, moderatedBy],
    );
    return res.rows[0];
  }

  /**
   * Synchronize course average rating and total reviews count on courses table.
   */
  async syncCourseRatingStats(courseId: string): Promise<{
    averageRating: number;
    totalReviews: number;
  }> {
    const res = await this.db.query(
      `
      WITH stats AS (
        SELECT
          ROUND(COALESCE(AVG(rating), 0), 2) AS avg_rating,
          COUNT(*)::int AS cnt
        FROM course_reviews
        WHERE course_id = $1
          AND status = 'published'
          AND deleted_at IS NULL
      )
      UPDATE courses c
      SET average_rating = stats.avg_rating,
          total_reviews_count = stats.cnt,
          updated_at = CURRENT_TIMESTAMP
      FROM stats
      WHERE c.course_id = $1
      RETURNING c.average_rating, c.total_reviews_count;
      `,
      [courseId],
    );

    if (res.rows.length === 0) {
      return { averageRating: 0.0, totalReviews: 0 };
    }

    return {
      averageRating: parseFloat(res.rows[0].average_rating) || 0.0,
      totalReviews: parseInt(res.rows[0].total_reviews_count, 10) || 0,
    };
  }

  /**
   * Get rating summary and breakdown for a course.
   */
  async getCourseReviewSummary(courseId: string): Promise<CourseReviewSummary> {
    const res = await this.db.query(
      `
      SELECT
        COUNT(*)::int AS total_reviews,
        ROUND(COALESCE(AVG(rating), 0), 2)::float AS average_rating,
        COUNT(*) FILTER (WHERE rating = 5)::int AS count_5,
        COUNT(*) FILTER (WHERE rating = 4)::int AS count_4,
        COUNT(*) FILTER (WHERE rating = 3)::int AS count_3,
        COUNT(*) FILTER (WHERE rating = 2)::int AS count_2,
        COUNT(*) FILTER (WHERE rating = 1)::int AS count_1
      FROM course_reviews
      WHERE course_id = $1
        AND status = 'published'
        AND deleted_at IS NULL
      `,
      [courseId],
    );

    const row = res.rows[0] || {};
    const totalReviews = parseInt(row.total_reviews, 10) || 0;
    const averageRating = parseFloat(row.average_rating) || 0.0;

    const calcPercentage = (count: number) =>
      totalReviews > 0 ? parseFloat(((count / totalReviews) * 100).toFixed(1)) : 0;

    const count5 = parseInt(row.count_5, 10) || 0;
    const count4 = parseInt(row.count_4, 10) || 0;
    const count3 = parseInt(row.count_3, 10) || 0;
    const count2 = parseInt(row.count_2, 10) || 0;
    const count1 = parseInt(row.count_1, 10) || 0;

    return {
      courseId,
      averageRating,
      totalReviews,
      breakdown: {
        5: { star: 5, count: count5, percentage: calcPercentage(count5) },
        4: { star: 4, count: count4, percentage: calcPercentage(count4) },
        3: { star: 3, count: count3, percentage: calcPercentage(count3) },
        2: { star: 2, count: count2, percentage: calcPercentage(count2) },
        1: { star: 1, count: count1, percentage: calcPercentage(count1) },
      },
    };
  }

  /**
   * Find paginated published reviews for public course page.
   */
  async findPublishedReviews(
    courseId: string,
    options: {
      page?: number;
      limit?: number;
      rating?: number;
      sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating';
      currentUserId?: string;
    },
  ): Promise<{ reviews: FormattedCourseReview[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [
      `r.course_id = $1`,
      `r.status = 'published'`,
      `r.deleted_at IS NULL`,
    ];
    const params: any[] = [courseId];

    if (options.rating) {
      params.push(options.rating);
      whereClauses.push(`r.rating = $${params.length}`);
    }

    let orderBy = 'r.created_at DESC';
    if (options.sortBy === 'oldest') {
      orderBy = 'r.created_at ASC';
    } else if (options.sortBy === 'highest_rating') {
      orderBy = 'r.rating DESC, r.created_at DESC';
    } else if (options.sortBy === 'lowest_rating') {
      orderBy = 'r.rating ASC, r.created_at DESC';
    }

    const whereSql = whereClauses.join(' AND ');

    // 1. Get total count
    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM course_reviews r WHERE ${whereSql}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total, 10) || 0;

    // 2. Query paginated records with student and reply data
    params.push(limit);
    const limitParamIndex = params.length;
    params.push(offset);
    const offsetParamIndex = params.length;

    const reviewsRes = await this.db.query(
      `
      SELECT
        r.review_id,
        r.course_id,
        r.student_id,
        r.rating,
        r.review_title,
        r.review_text,
        r.status,
        r.is_edited,
        r.created_at,
        r.updated_at,
        u.first_name,
        u.last_name,
        rep.review_reply_id,
        rep.reply_text,
        rep.instructor_id,
        rep.created_at AS reply_created_at,
        rep.updated_at AS reply_updated_at,
        iu.first_name AS instructor_first_name,
        iu.last_name AS instructor_last_name,
        ip.avatar_url AS instructor_avatar_url
      FROM course_reviews r
      INNER JOIN users u ON r.student_id = u.user_id
      LEFT JOIN course_review_replies rep ON r.review_id = rep.review_id AND rep.status = 'published'
      LEFT JOIN users iu ON rep.instructor_id = iu.user_id
      LEFT JOIN instructor_profiles ip ON iu.user_id = ip.user_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `,
      params,
    );

    const reviews: FormattedCourseReview[] = reviewsRes.rows.map((row) => {
      const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
      const isOwnReview = options.currentUserId ? row.student_id === options.currentUserId : false;

      let instructorReply: FormattedInstructorReply | null = null;
      if (row.review_reply_id) {
        const instName = `${row.instructor_first_name || ''} ${row.instructor_last_name || ''}`.trim() || 'Instructor';
        instructorReply = {
          reviewReplyId: row.review_reply_id,
          reviewId: row.review_id,
          courseId: row.course_id,
          instructorId: row.instructor_id,
          instructorName: instName,
          instructorAvatarUrl: row.instructor_avatar_url,
          replyText: row.reply_text,
          createdAt: new Date(row.reply_created_at).toISOString(),
          updatedAt: new Date(row.reply_updated_at).toISOString(),
        };
      }

      return {
        reviewId: row.review_id,
        courseId: row.course_id,
        studentId: row.student_id,
        studentName,
        studentAvatarUrl: null,
        rating: row.rating,
        reviewTitle: row.review_title,
        reviewText: row.review_text,
        status: row.status,
        isEdited: row.is_edited,
        isOwnReview,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        instructorReply,
      };
    });

    return { reviews, total };
  }

  /**
   * Find reviews for instructor dashboard (courses authored by the instructor).
   */
  async findInstructorReviews(
    instructorId: string,
    options: {
      page?: number;
      limit?: number;
      courseId?: string;
      rating?: number;
      replyStatus?: 'all' | 'replied' | 'unreplied';
      sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating';
    },
  ): Promise<{ reviews: FormattedCourseReview[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [
      `c.instructor_id = $1`,
      `r.deleted_at IS NULL`,
    ];
    const params: any[] = [instructorId];

    if (options.courseId) {
      params.push(options.courseId);
      whereClauses.push(`r.course_id = $${params.length}`);
    }

    if (options.rating) {
      params.push(options.rating);
      whereClauses.push(`r.rating = $${params.length}`);
    }

    if (options.replyStatus === 'replied') {
      whereClauses.push(`rep.review_reply_id IS NOT NULL`);
    } else if (options.replyStatus === 'unreplied') {
      whereClauses.push(`rep.review_reply_id IS NULL`);
    }

    let orderBy = 'r.created_at DESC';
    if (options.sortBy === 'oldest') {
      orderBy = 'r.created_at ASC';
    } else if (options.sortBy === 'highest_rating') {
      orderBy = 'r.rating DESC, r.created_at DESC';
    } else if (options.sortBy === 'lowest_rating') {
      orderBy = 'r.rating ASC, r.created_at DESC';
    }

    const whereSql = whereClauses.join(' AND ');

    // Total count
    const countRes = await this.db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM course_reviews r
      INNER JOIN courses c ON r.course_id = c.course_id
      LEFT JOIN course_review_replies rep ON r.review_id = rep.review_id
      WHERE ${whereSql}
      `,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total, 10) || 0;

    // Paginated rows
    params.push(limit);
    const limitParamIndex = params.length;
    params.push(offset);
    const offsetParamIndex = params.length;

    const reviewsRes = await this.db.query(
      `
      SELECT
        r.review_id,
        r.course_id,
        r.student_id,
        r.rating,
        r.review_title,
        r.review_text,
        r.status,
        r.is_edited,
        r.created_at,
        r.updated_at,
        c.title AS course_title,
        c.slug AS course_slug,
        u.first_name,
        u.last_name,
        rep.review_reply_id,
        rep.reply_text,
        rep.instructor_id,
        rep.created_at AS reply_created_at,
        rep.updated_at AS reply_updated_at,
        iu.first_name AS instructor_first_name,
        iu.last_name AS instructor_last_name,
        ip.avatar_url AS instructor_avatar_url
      FROM course_reviews r
      INNER JOIN courses c ON r.course_id = c.course_id
      INNER JOIN users u ON r.student_id = u.user_id
      LEFT JOIN course_review_replies rep ON r.review_id = rep.review_id
      LEFT JOIN users iu ON rep.instructor_id = iu.user_id
      LEFT JOIN instructor_profiles ip ON iu.user_id = ip.user_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `,
      params,
    );

    const reviews: FormattedCourseReview[] = reviewsRes.rows.map((row) => {
      const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';

      let instructorReply: FormattedInstructorReply | null = null;
      if (row.review_reply_id) {
        const instName = `${row.instructor_first_name || ''} ${row.instructor_last_name || ''}`.trim() || 'Instructor';
        instructorReply = {
          reviewReplyId: row.review_reply_id,
          reviewId: row.review_id,
          courseId: row.course_id,
          instructorId: row.instructor_id,
          instructorName: instName,
          instructorAvatarUrl: row.instructor_avatar_url,
          replyText: row.reply_text,
          createdAt: new Date(row.reply_created_at).toISOString(),
          updatedAt: new Date(row.reply_updated_at).toISOString(),
        };
      }

      return {
        reviewId: row.review_id,
        courseId: row.course_id,
        courseTitle: row.course_title,
        courseSlug: row.course_slug,
        studentId: row.student_id,
        studentName,
        studentAvatarUrl: null,
        rating: row.rating,
        reviewTitle: row.review_title,
        reviewText: row.review_text,
        status: row.status,
        isEdited: row.is_edited,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        instructorReply,
      };
    });

    return { reviews, total };
  }

  /**
   * Find reviews for admin moderation panel across the entire platform.
   */
  async findAdminReviews(options: {
    page?: number;
    limit?: number;
    status?: string;
    courseId?: string;
    instructorId?: string;
    studentId?: string;
    rating?: number;
    search?: string;
    sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating';
  }): Promise<{ reviews: FormattedCourseReview[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [`r.deleted_at IS NULL`];
    const params: any[] = [];

    if (options.status && options.status !== 'all') {
      params.push(options.status);
      whereClauses.push(`r.status = $${params.length}`);
    }

    if (options.courseId) {
      params.push(options.courseId);
      whereClauses.push(`r.course_id = $${params.length}`);
    }

    if (options.instructorId) {
      params.push(options.instructorId);
      whereClauses.push(`c.instructor_id = $${params.length}`);
    }

    if (options.studentId) {
      params.push(options.studentId);
      whereClauses.push(`r.student_id = $${params.length}`);
    }

    if (options.rating) {
      params.push(options.rating);
      whereClauses.push(`r.rating = $${params.length}`);
    }

    if (options.search && options.search.trim()) {
      params.push(`%${options.search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      whereClauses.push(`(
        LOWER(r.review_title) LIKE $${pIdx} OR
        LOWER(r.review_text) LIKE $${pIdx} OR
        LOWER(u.first_name || ' ' || u.last_name) LIKE $${pIdx} OR
        LOWER(u.email) LIKE $${pIdx} OR
        LOWER(c.title) LIKE $${pIdx}
      )`);
    }

    let orderBy = 'r.created_at DESC';
    if (options.sortBy === 'oldest') {
      orderBy = 'r.created_at ASC';
    } else if (options.sortBy === 'highest_rating') {
      orderBy = 'r.rating DESC, r.created_at DESC';
    } else if (options.sortBy === 'lowest_rating') {
      orderBy = 'r.rating ASC, r.created_at DESC';
    }

    const whereSql = whereClauses.join(' AND ');

    // Total count
    const countRes = await this.db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM course_reviews r
      INNER JOIN courses c ON r.course_id = c.course_id
      INNER JOIN users u ON r.student_id = u.user_id
      WHERE ${whereSql}
      `,
      params,
    );
    const total = parseInt(countRes.rows[0]?.total, 10) || 0;

    // Paginated rows
    params.push(limit);
    const limitParamIndex = params.length;
    params.push(offset);
    const offsetParamIndex = params.length;

    const reviewsRes = await this.db.query(
      `
      SELECT
        r.review_id,
        r.course_id,
        r.student_id,
        r.rating,
        r.review_title,
        r.review_text,
        r.status,
        r.is_edited,
        r.moderation_reason,
        r.moderated_by,
        r.moderated_at,
        r.created_at,
        r.updated_at,
        c.title AS course_title,
        c.slug AS course_slug,
        u.first_name,
        u.last_name,
        rep.review_reply_id,
        rep.reply_text,
        rep.instructor_id,
        rep.created_at AS reply_created_at,
        rep.updated_at AS reply_updated_at,
        iu.first_name AS instructor_first_name,
        iu.last_name AS instructor_last_name,
        ip.avatar_url AS instructor_avatar_url
      FROM course_reviews r
      INNER JOIN courses c ON r.course_id = c.course_id
      INNER JOIN users u ON r.student_id = u.user_id
      LEFT JOIN course_review_replies rep ON r.review_id = rep.review_id
      LEFT JOIN users iu ON rep.instructor_id = iu.user_id
      LEFT JOIN instructor_profiles ip ON iu.user_id = ip.user_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `,
      params,
    );

    const reviews: FormattedCourseReview[] = reviewsRes.rows.map((row) => {
      const studentName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';

      let instructorReply: FormattedInstructorReply | null = null;
      if (row.review_reply_id) {
        const instName = `${row.instructor_first_name || ''} ${row.instructor_last_name || ''}`.trim() || 'Instructor';
        instructorReply = {
          reviewReplyId: row.review_reply_id,
          reviewId: row.review_id,
          courseId: row.course_id,
          instructorId: row.instructor_id,
          instructorName: instName,
          instructorAvatarUrl: row.instructor_avatar_url,
          replyText: row.reply_text,
          createdAt: new Date(row.reply_created_at).toISOString(),
          updatedAt: new Date(row.reply_updated_at).toISOString(),
        };
      }

      return {
        reviewId: row.review_id,
        courseId: row.course_id,
        courseTitle: row.course_title,
        courseSlug: row.course_slug,
        studentId: row.student_id,
        studentName,
        studentAvatarUrl: null,
        rating: row.rating,
        reviewTitle: row.review_title,
        reviewText: row.review_text,
        status: row.status,
        isEdited: row.is_edited,
        moderationReason: row.moderation_reason,
        moderatedBy: row.moderated_by,
        moderatedAt: row.moderated_at ? new Date(row.moderated_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        instructorReply,
      };
    });

    return { reviews, total };
  }

  /**
   * Find instructor reply by review_id.
   */
  async findReplyByReviewId(reviewId: string): Promise<ReviewReplyRecord | null> {
    const res = await this.db.query<ReviewReplyRecord>(
      `
      SELECT *
      FROM course_review_replies
      WHERE review_id = $1
      LIMIT 1
      `,
      [reviewId],
    );
    return res.rows[0] || null;
  }

  /**
   * Create or update instructor reply to a review.
   */
  async upsertInstructorReply(data: {
    reviewId: string;
    courseId: string;
    instructorId: string;
    replyText: string;
  }): Promise<ReviewReplyRecord> {
    const res = await this.db.query<ReviewReplyRecord>(
      `
      INSERT INTO course_review_replies (
        review_id, course_id, instructor_id, reply_text, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (review_id)
      DO UPDATE SET
        reply_text = EXCLUDED.reply_text,
        instructor_id = EXCLUDED.instructor_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [data.reviewId, data.courseId, data.instructorId, data.replyText],
    );
    return res.rows[0];
  }

  /**
   * Delete an instructor reply by review_id.
   */
  async deleteInstructorReply(reviewId: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM course_review_replies WHERE review_id = $1`,
      [reviewId],
    );
    return (res.rowCount || 0) > 0;
  }
}

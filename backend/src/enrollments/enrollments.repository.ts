
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class EnrollmentsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findEligibleFreeCourse(courseId: string) {
    const result = await this.db.query(
      `
      SELECT course_id, instructor_id, title, slug, is_free, price, currency,
             status, is_active
      FROM courses
      WHERE course_id = $1
        AND is_free = TRUE
        AND status = 'published'
        AND is_active = TRUE
        AND deleted_at IS NULL
      LIMIT 1;
      `,
      [courseId],
    );
    return result.rows[0] || null;
  }

  /** True when the user is the course's own instructor (owners can't enroll in or buy it). */
  async isCourseInstructor(courseId: string, userId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM courses WHERE course_id = $1 AND instructor_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [courseId, userId],
    );
    return result.rows.length > 0;
  }

  async findEnrollment(studentId: string, courseId: string) {
    const result = await this.db.query(
      `
      SELECT enrollment_id, student_id, course_id,
             enrollment_status, enrollment_type, amount_paid,
             currency, enrolled_at, completed_at
      FROM course_enrollments
      WHERE student_id = $1 AND course_id = $2
      LIMIT 1;
      `,
      [studentId, courseId],
    );
    return result.rows[0] || null;
  }

  async createEnrollment(studentId: string, courseId: string) {
    const result = await this.db.query(
      `
      INSERT INTO course_enrollments (
        student_id, course_id, enrollment_status,
        enrollment_type, amount_paid, currency
      )
      SELECT $1, c.course_id, 'active', 'free', 0, c.currency
      FROM courses c
      WHERE c.course_id = $2
        AND c.is_free = TRUE
        AND c.status = 'published'
        AND c.is_active = TRUE
        AND c.deleted_at IS NULL
      ON CONFLICT (student_id, course_id) DO NOTHING
      RETURNING enrollment_id, student_id, course_id,
                enrollment_status, enrollment_type,
                amount_paid, currency, enrolled_at;
      `,
      [studentId, courseId],
    );
    return result.rows[0] || null;
  }

  async findStudentEnrollments(studentId: string) {
    const result = await this.db.query(
      `
      SELECT
        e.enrollment_id,
        e.course_id,
        e.enrollment_status,
        e.enrollment_type,
        e.amount_paid,
        e.currency,
        e.enrolled_at,
        e.completed_at,
        c.title,
        c.slug,
        c.subtitle,
        c.description,
        c.level,
        c.language,
        c.thumbnail_url,
        c.instructor_id,
        c.category_id,
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS instructor_name,
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
        e.enrollment_id AS "enrollmentId",
        e.course_id AS "courseId",
        e.enrollment_status AS "enrollmentStatus",
        e.enrollment_type AS "enrollmentType",
        e.enrolled_at AS "enrolledAt",
        e.completed_at AS "completedAt",
        c.thumbnail_url AS "thumbnailUrl",
        COALESCE(tl.total_lessons, 0)::int AS "totalLessons",
        COALESCE(tl.total_lessons, 0)::int AS total_lessons,
        COALESCE(cl.completed_lessons, 0)::int AS "completedLessons",
        COALESCE(cl.completed_lessons, 0)::int AS completed_lessons,
        CASE
          WHEN COALESCE(tl.total_lessons, 0) > 0 THEN
            LEAST(100, ROUND((COALESCE(cl.completed_lessons, 0)::numeric / tl.total_lessons::numeric) * 100))::int
          ELSE 0
        END AS "progressPercentage",
        CASE
          WHEN COALESCE(tl.total_lessons, 0) > 0 THEN
            LEAST(100, ROUND((COALESCE(cl.completed_lessons, 0)::numeric / tl.total_lessons::numeric) * 100))::int
          ELSE 0
        END AS progress_percentage
      FROM course_enrollments e
      INNER JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN users u ON u.user_id = c.instructor_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_lessons
        FROM course_lessons l
        INNER JOIN course_sections s ON s.section_id = l.section_id
        WHERE s.course_id = e.course_id
          AND l.is_active = TRUE
          AND COALESCE(l.is_optional, FALSE) = FALSE
      ) tl ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS completed_lessons
        FROM student_lesson_progress p
        INNER JOIN course_lessons l ON l.lesson_id = p.lesson_id
        WHERE p.student_id = e.student_id
          AND p.course_id = e.course_id
          AND p.is_completed = TRUE
          AND l.is_active = TRUE
          AND COALESCE(l.is_optional, FALSE) = FALSE
      ) cl ON TRUE
      WHERE e.student_id = $1
        AND e.enrollment_status IN ('active', 'completed')
        AND c.deleted_at IS NULL
      ORDER BY e.enrolled_at DESC;
      `,
      [studentId],
    );
    return result.rows;
  }

  async hasActiveEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `
      SELECT 1
      FROM course_enrollments
      WHERE student_id = $1
        AND course_id = $2
        AND enrollment_status IN ('active', 'completed')
      LIMIT 1;
      `,
      [studentId, courseId],
    );
    return result.rows.length > 0;
  }

  // --- ADMIN ENROLLMENT MANAGEMENT METHODS ---

  async getAdminStats() {
    const result = await this.db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE enrollment_status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE enrollment_status = 'suspended')::int AS suspended,
        COUNT(*) FILTER (WHERE enrollment_status = 'cancelled')::int AS cancelled
      FROM course_enrollments;
    `);
    return result.rows[0] || { total: 0, active: 0, completed: 0, suspended: 0, cancelled: 0 };
  }

  async findAdminEnrollments(filters: {
    search?: string;
    courseId?: string;
    instructorId?: string;
    status?: string;
    completionStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['c.deleted_at IS NULL'];
    const params: any[] = [];

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      conditions.push(`(
        LOWER(u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE $${params.length}
        OR LOWER(u.email) LIKE $${params.length}
        OR LOWER(c.title) LIKE $${params.length}
      )`);
    }

    if (filters.courseId) {
      params.push(filters.courseId);
      conditions.push(`e.course_id = $${params.length}`);
    }

    if (filters.instructorId) {
      params.push(filters.instructorId);
      conditions.push(`c.instructor_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`e.enrollment_status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM course_enrollments e
      INNER JOIN users u ON u.user_id = e.student_id
      INNER JOIN courses c ON c.course_id = e.course_id
      ${whereClause}
    `;
    const countResult = await this.db.query(countSql, params);
    const total = countResult.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataSql = `
      SELECT
        e.enrollment_id AS "enrollmentId",
        e.student_id AS "studentId",
        u.first_name AS "studentFirstName",
        u.last_name AS "studentLastName",
        u.email AS "studentEmail",
        e.course_id AS "courseId",
        c.title AS "courseTitle",
        c.slug AS "courseSlug",
        c.instructor_id AS "instructorId",
        COALESCE(inst.first_name || ' ' || COALESCE(inst.last_name, ''), 'Instructor') AS "instructorName",
        e.enrollment_status AS "enrollmentStatus",
        e.enrollment_type AS "enrollmentType",
        e.amount_paid AS "amountPaid",
        e.currency AS "currency",
        e.cancellation_reason AS "cancellationReason",
        e.enrolled_at AS "enrolledAt",
        e.completed_at AS "completedAt",
        e.status_changed_at AS "statusChangedAt",
        -- Total active lessons in this course
        (
          SELECT COUNT(*)::int
          FROM course_lessons l
          WHERE l.course_id = e.course_id AND l.is_active = TRUE
        ) AS "totalLessonsCount",
        -- Completed lessons by this student
        (
          SELECT COUNT(*)::int
          FROM student_lesson_progress slp
          WHERE slp.student_id = e.student_id AND slp.course_id = e.course_id AND slp.is_completed = TRUE
        ) AS "completedLessonsCount",
        -- Last learning activity timestamp
        (
          SELECT MAX(slp.updated_at)
          FROM student_lesson_progress slp
          WHERE slp.student_id = e.student_id AND slp.course_id = e.course_id
        ) AS "lastActivityAt"
      FROM course_enrollments e
      INNER JOIN users u ON u.user_id = e.student_id
      INNER JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN users inst ON inst.user_id = c.instructor_id
      ${whereClause}
      ORDER BY e.enrolled_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length};
    `;

    const dataResult = await this.db.query(dataSql, dataParams);

    const items = dataResult.rows.map((row: any) => {
      const totalLessons = Number(row.totalLessonsCount) || 0;
      const completedLessons = Number(row.completedLessonsCount) || 0;
      const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        ...row,
        studentName: `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim() || 'Student',
        completionPercentage,
      };
    });

    // Optional post-filter for completionStatus
    let filteredItems = items;
    if (filters.completionStatus === 'completed') {
      filteredItems = items.filter((i: any) => i.completionPercentage === 100);
    } else if (filters.completionStatus === 'in_progress') {
      filteredItems = items.filter((i: any) => i.completionPercentage > 0 && i.completionPercentage < 100);
    } else if (filters.completionStatus === 'not_started') {
      filteredItems = items.filter((i: any) => i.completionPercentage === 0);
    }

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items: filteredItems,
    };
  }

  async findStudentUser(studentId: string) {
    const result = await this.db.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.is_active,
              COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r ON r.role_id = ur.role_id
       WHERE u.user_id = $1
       GROUP BY u.user_id
       LIMIT 1;`,
      [studentId],
    );
    return result.rows[0] || null;
  }

  async findCourseForManual(courseId: string) {
    const result = await this.db.query(
      `SELECT course_id, title, slug, status, is_active, currency, price, is_free
       FROM courses
       WHERE course_id = $1 AND deleted_at IS NULL
       LIMIT 1;`,
      [courseId],
    );
    return result.rows[0] || null;
  }

  async manualEnroll(studentId: string, courseId: string, adminId: string) {
    const existing = await this.findEnrollment(studentId, courseId);
    if (existing) {
      if (existing.enrollment_status === 'active' || existing.enrollment_status === 'completed') {
        return { isDuplicate: true, enrollment: existing };
      }
      // Reactivate suspended or cancelled enrollment
      const reactivated = await this.db.query(
        `UPDATE course_enrollments
         SET enrollment_status = 'active',
             enrollment_type = 'manual',
             enrolled_by = $3,
             status_changed_at = CURRENT_TIMESTAMP,
             status_changed_by = $3,
             cancellation_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE enrollment_id = $1
         RETURNING *;`,
        [existing.enrollment_id, courseId, adminId],
      );
      return { isDuplicate: false, reactivated: true, enrollment: reactivated.rows[0] };
    }

    // Fresh insertion
    const created = await this.db.query(
      `INSERT INTO course_enrollments (
         student_id, course_id, enrollment_status,
         enrollment_type, amount_paid, currency, enrolled_by
       )
       SELECT $1, c.course_id, 'active', 'manual', 0, c.currency, $3
       FROM courses c
       WHERE c.course_id = $2
       RETURNING *;`,
      [studentId, courseId, adminId],
    );
    return { isDuplicate: false, reactivated: false, enrollment: created.rows[0] };
  }

  async updateEnrollmentStatus(enrollmentId: string, status: string, reason?: string, adminId?: string) {
    const result = await this.db.query(
      `UPDATE course_enrollments
       SET enrollment_status = $2,
           cancellation_reason = CASE WHEN $2 = 'cancelled' THEN COALESCE($3, cancellation_reason) ELSE cancellation_reason END,
           status_changed_at = CURRENT_TIMESTAMP,
           status_changed_by = $4,
           completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE enrollment_id = $1
       RETURNING *;`,
      [enrollmentId, status, reason ?? null, adminId ?? null],
    );
    return result.rows[0] || null;
  }

  async getAdminEnrollmentDetails(enrollmentId: string) {
    const enrRes = await this.db.query(
      `SELECT
         e.enrollment_id AS "enrollmentId",
         e.student_id AS "studentId",
         e.course_id AS "courseId",
         e.enrollment_status AS "enrollmentStatus",
         e.enrollment_type AS "enrollmentType",
         e.amount_paid AS "amountPaid",
         e.currency AS "currency",
         e.cancellation_reason AS "cancellationReason",
         e.enrolled_at AS "enrolledAt",
         e.completed_at AS "completedAt",
         e.status_changed_at AS "statusChangedAt",
         u.first_name AS "studentFirstName",
         u.last_name AS "studentLastName",
         u.email AS "studentEmail",
         c.title AS "courseTitle",
         c.slug AS "courseSlug",
         c.thumbnail_url AS "courseThumbnailUrl",
         COALESCE(inst.first_name || ' ' || COALESCE(inst.last_name, ''), 'Instructor') AS "instructorName"
       FROM course_enrollments e
       INNER JOIN users u ON u.user_id = e.student_id
       INNER JOIN courses c ON c.course_id = e.course_id
       LEFT JOIN users inst ON inst.user_id = c.instructor_id
       WHERE e.enrollment_id = $1
       LIMIT 1;`,
      [enrollmentId],
    );

    const enrollment = enrRes.rows[0];
    if (!enrollment) return null;

    // Get lesson progress list
    const lessonsRes = await this.db.query(
      `SELECT
         l.lesson_id AS "lessonId",
         l.title,
         l.lesson_type AS "lessonType",
         l.duration_seconds AS "durationSeconds",
         l.sort_order AS "sortOrder",
         s.title AS "sectionTitle",
         s.sort_order AS "sectionSortOrder",
         COALESCE(slp.is_completed, FALSE) AS "isCompleted",
         COALESCE(slp.max_watched_seconds, 0) AS "maxWatchedSeconds",
         COALESCE(slp.last_position_seconds, 0) AS "lastPositionSeconds",
         slp.completed_at AS "completedAt",
         slp.updated_at AS "lastProgressAt"
       FROM course_lessons l
       INNER JOIN course_sections s ON s.section_id = l.section_id
       LEFT JOIN student_lesson_progress slp
         ON slp.lesson_id = l.lesson_id AND slp.student_id = $2
       WHERE l.course_id = $1 AND l.is_active = TRUE AND s.is_active = TRUE
       ORDER BY s.sort_order, l.sort_order;`,
      [enrollment.courseId, enrollment.studentId],
    );

    const lessons = lessonsRes.rows;
    const completedCount = lessons.filter((l: any) => l.isCompleted).length;
    const completionPercentage = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    return {
      enrollment: {
        ...enrollment,
        studentName: `${enrollment.studentFirstName || ''} ${enrollment.studentLastName || ''}`.trim() || 'Student',
      },
      completionPercentage,
      totalLessons: lessons.length,
      completedLessonsCount: completedCount,
      lessons,
    };
  }

  async listStudentsForDropdown(search?: string) {
    const params: any[] = [];
    let where = `WHERE (LOWER(r.name) = 'student' OR r.name = 'STUDENT') AND u.is_active = TRUE`;
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where += ` AND (LOWER(u.first_name || ' ' || COALESCE(u.last_name, '')) LIKE $1 OR LOWER(u.email) LIKE $1)`;
    }
    const result = await this.db.query(
      `SELECT u.user_id AS "studentId", u.first_name, u.last_name, u.email
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.user_id
       JOIN roles r ON r.role_id = ur.role_id
       ${where}
       GROUP BY u.user_id
       ORDER BY u.first_name ASC
       LIMIT 100;`,
      params,
    );
    return result.rows.map((u: any) => ({
      studentId: u.studentId,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      email: u.email,
    }));
  }

  async listCoursesForDropdown() {
    const result = await this.db.query(
      `SELECT course_id AS "courseId", title, slug, status
       FROM courses
       WHERE status = 'published' AND is_active = TRUE AND deleted_at IS NULL
       ORDER BY title ASC
       LIMIT 100;`,
    );
    return result.rows;
  }
}

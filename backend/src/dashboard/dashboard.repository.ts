import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly db: DatabaseService) {}

  async getSuperAdminOverview() {
    // 1. User Counts by role
    const usersRes = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(r.name) = 'student' AND u.is_active = TRUE)::int AS "totalStudents",
        COUNT(*) FILTER (WHERE LOWER(r.name) = 'instructor' AND u.is_active = TRUE)::int AS "totalInstructors",
        COUNT(*) FILTER (WHERE LOWER(r.name) IN ('admin', 'super_admin') AND u.is_active = TRUE)::int AS "totalAdmins",
        COUNT(DISTINCT u.user_id)::int AS "totalUsers"
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN roles r ON r.role_id = ur.role_id;
    `);

    // 2. Course Counts
    const coursesRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "totalCourses",
        COUNT(*) FILTER (WHERE status = 'published')::int AS "publishedCourses",
        COUNT(*) FILTER (WHERE status = 'draft')::int AS "draftCourses",
        COUNT(*) FILTER (WHERE status = 'pending_review')::int AS "pendingCourses"
      FROM courses
      WHERE deleted_at IS NULL;
    `);

    // 3. Enrollment Counts
    const enrollmentsRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "totalEnrollments",
        COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS "activeEnrollments",
        COUNT(*) FILTER (WHERE enrollment_status = 'completed')::int AS "completedEnrollments",
        COUNT(*) FILTER (WHERE enrollment_status = 'suspended')::int AS "suspendedEnrollments"
      FROM course_enrollments;
    `);

    // 4. Recent Platform Activity from audit logs
    const activityRes = await this.db.query(`
      SELECT
        m.log_id AS "logId",
        m.action,
        m.details,
        m.created_at AS "createdAt",
        COALESCE(u.first_name || ' ' || COALESCE(u.last_name, ''), u.email, 'System') AS "actorName",
        c.title AS "courseTitle"
      FROM media_audit_logs m
      LEFT JOIN users u ON u.user_id = m.actor_id
      LEFT JOIN courses c ON c.course_id = m.course_id
      ORDER BY m.created_at DESC
      LIMIT 6;
    `);

    // 5. Recent Courses
    const recentCoursesRes = await this.db.query(`
      SELECT
        c.course_id AS "courseId",
        c.title,
        c.slug,
        c.status,
        c.updated_at AS "updatedAt",
        COALESCE(u.first_name || ' ' || COALESCE(u.last_name, ''), 'Instructor') AS "instructorName",
        (
          SELECT COUNT(*)::int
          FROM course_enrollments e
          WHERE e.course_id = c.course_id AND e.enrollment_status IN ('active', 'completed')
        ) AS "enrollmentCount"
      FROM courses c
      LEFT JOIN users u ON u.user_id = c.instructor_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT 5;
    `);

    return {
      stats: {
        ...usersRes.rows[0],
        ...coursesRes.rows[0],
        ...enrollmentsRes.rows[0],
      },
      recentCourses: recentCoursesRes.rows,
      recentActivity: activityRes.rows,
    };
  }

  async getAdminOverview() {
    // 1. User Counts
    const usersRes = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(r.name) = 'student' AND u.is_active = TRUE)::int AS "totalStudents",
        COUNT(*) FILTER (WHERE LOWER(r.name) = 'instructor' AND u.is_active = TRUE)::int AS "totalInstructors",
        COUNT(DISTINCT u.user_id)::int AS "totalUsers"
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN roles r ON r.role_id = ur.role_id;
    `);

    // 2. Course Counts
    const coursesRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "totalCourses",
        COUNT(*) FILTER (WHERE status = 'published')::int AS "publishedCourses",
        COUNT(*) FILTER (WHERE status = 'draft')::int AS "draftCourses",
        COUNT(*) FILTER (WHERE status = 'pending_review')::int AS "pendingCourses"
      FROM courses
      WHERE deleted_at IS NULL;
    `);

    // 3. Enrollment Counts
    const enrollmentsRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "totalEnrollments",
        COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS "activeEnrollments",
        COUNT(*) FILTER (WHERE enrollment_status = 'completed')::int AS "completedEnrollments"
      FROM course_enrollments;
    `);

    // 4. Recent Enrollments
    const recentEnrollmentsRes = await this.db.query(`
      SELECT
        e.enrollment_id AS "enrollmentId",
        e.enrolled_at AS "enrolledAt",
        e.enrollment_status AS "enrollmentStatus",
        u.first_name AS "studentFirstName",
        u.last_name AS "studentLastName",
        u.email AS "studentEmail",
        c.title AS "courseTitle"
      FROM course_enrollments e
      JOIN users u ON u.user_id = e.student_id
      JOIN courses c ON c.course_id = e.course_id
      ORDER BY e.enrolled_at DESC
      LIMIT 5;
    `);

    // 5. Recent Courses
    const recentCoursesRes = await this.db.query(`
      SELECT
        c.course_id AS "courseId",
        c.title,
        c.slug,
        c.status,
        c.updated_at AS "updatedAt",
        COALESCE(u.first_name || ' ' || COALESCE(u.last_name, ''), 'Instructor') AS "instructorName",
        (
          SELECT COUNT(*)::int
          FROM course_enrollments e
          WHERE e.course_id = c.course_id AND e.enrollment_status IN ('active', 'completed')
        ) AS "enrollmentCount"
      FROM courses c
      LEFT JOIN users u ON u.user_id = c.instructor_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT 5;
    `);

    // 6. Recent Platform Activity
    const activityRes = await this.db.query(`
      SELECT
        m.log_id AS "logId",
        m.action,
        m.details,
        m.created_at AS "createdAt",
        COALESCE(u.first_name || ' ' || COALESCE(u.last_name, ''), u.email, 'System') AS "actorName",
        c.title AS "courseTitle"
      FROM media_audit_logs m
      LEFT JOIN users u ON u.user_id = m.actor_id
      LEFT JOIN courses c ON c.course_id = m.course_id
      ORDER BY m.created_at DESC
      LIMIT 5;
    `);

    return {
      stats: {
        ...usersRes.rows[0],
        ...coursesRes.rows[0],
        ...enrollmentsRes.rows[0],
      },
      recentEnrollments: recentEnrollmentsRes.rows,
      recentCourses: recentCoursesRes.rows,
      recentActivity: activityRes.rows,
    };
  }

  async getInstructorOverview(instructorId: string) {
    // 1. Instructor Course Counts
    const coursesRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "totalCourses",
        COUNT(*) FILTER (WHERE status = 'published')::int AS "publishedCourses",
        COUNT(*) FILTER (WHERE status = 'draft')::int AS "draftCourses",
        COUNT(*) FILTER (WHERE status = 'pending_review')::int AS "pendingCourses"
      FROM courses
      WHERE instructor_id = $1 AND deleted_at IS NULL;
    `, [instructorId]);

    // 2. Instructor Total Enrolled Students
    const learnersRes = await this.db.query(`
      SELECT COUNT(DISTINCT e.student_id)::int AS "totalLearners"
      FROM course_enrollments e
      JOIN courses c ON c.course_id = e.course_id
      WHERE c.instructor_id = $1
        AND c.deleted_at IS NULL
        AND e.enrollment_status IN ('active', 'completed');
    `, [instructorId]);

    // 3. Pending Video Replacement Requests for Instructor's Courses
    const replacementsRes = await this.db.query(`
      SELECT COUNT(*)::int AS "pendingReplacements"
      FROM lesson_media_replacement_requests
      WHERE instructor_id = $1 AND status = 'pending';
    `, [instructorId]);

    // 3b. Instructor Total Revenue from Paid Course Checkouts
    const revenueRes = await this.db.query(`
      SELECT COALESCE(SUM(oi.final_price), 0)::numeric AS "totalRevenue"
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE oi.instructor_id = $1 AND o.status = 'completed';
    `, [instructorId]);

    // 4. Instructor's Courses with Enrollment and Lesson Counts
    const coursesListRes = await this.db.query(`
      SELECT
        c.course_id AS "courseId",
        c.title,
        c.slug,
        c.status,
        c.updated_at AS "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM course_enrollments e
          WHERE e.course_id = c.course_id AND e.enrollment_status IN ('active', 'completed')
        ) AS "enrollmentCount",
        (
          SELECT COUNT(*)::int
          FROM course_lessons l
          WHERE l.course_id = c.course_id AND l.is_active = TRUE
        ) AS "lessonCount"
      FROM courses c
      WHERE c.instructor_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT 6;
    `, [instructorId]);

    // 5. Recent Student Enrollments in Instructor's Courses
    const recentEnrollmentsRes = await this.db.query(`
      SELECT
        e.enrollment_id AS "enrollmentId",
        e.enrolled_at AS "enrolledAt",
        e.enrollment_status AS "enrollmentStatus",
        u.first_name AS "studentFirstName",
        u.last_name AS "studentLastName",
        u.email AS "studentEmail",
        c.title AS "courseTitle"
      FROM course_enrollments e
      JOIN courses c ON c.course_id = e.course_id
      JOIN users u ON u.user_id = e.student_id
      WHERE c.instructor_id = $1 AND c.deleted_at IS NULL
      ORDER BY e.enrolled_at DESC
      LIMIT 5;
    `, [instructorId]);

    // 6. Recent Activity on Instructor's Courses
    const activityRes = await this.db.query(`
      SELECT
        m.log_id AS "logId",
        m.action,
        m.details,
        m.created_at AS "createdAt",
        c.title AS "courseTitle"
      FROM media_audit_logs m
      JOIN courses c ON c.course_id = m.course_id
      WHERE c.instructor_id = $1
      ORDER BY m.created_at DESC
      LIMIT 5;
    `, [instructorId]);

    return {
      stats: {
        ...coursesRes.rows[0],
        totalLearners: learnersRes.rows[0]?.totalLearners || 0,
        pendingReplacements: replacementsRes.rows[0]?.pendingReplacements || 0,
        totalRevenue: Number(revenueRes.rows[0]?.totalRevenue || 0),
      },
      courses: coursesListRes.rows,
      recentEnrollments: recentEnrollmentsRes.rows,
      recentActivity: activityRes.rows,
    };
  }

  async getStudentOverview(studentId: string) {
    // 1. Enrollment stats
    const statsRes = await this.db.query(`
      SELECT
        COUNT(*)::int AS "enrolledCourses",
        COUNT(*) FILTER (WHERE enrollment_status = 'active')::int AS "activeCourses",
        COUNT(*) FILTER (WHERE enrollment_status = 'completed')::int AS "completedCourses"
      FROM course_enrollments
      WHERE student_id = $1 AND enrollment_status IN ('active', 'completed');
    `, [studentId]);

    // 2. Learning progress stats
    const progressStatsRes = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_completed = TRUE)::int AS "completedLessons",
        COALESCE(SUM(max_watched_seconds), 0)::int AS "totalWatchedSeconds"
      FROM student_lesson_progress
      WHERE student_id = $1;
    `, [studentId]);

    // 3. Continue Learning: Last accessed lesson
    const continueLearningRes = await this.db.query(`
      SELECT
        slp.lesson_id AS "lessonId",
        slp.course_id AS "courseId",
        slp.last_position_seconds AS "lastPositionSeconds",
        slp.max_watched_seconds AS "maxWatchedSeconds",
        slp.is_completed AS "isCompleted",
        slp.updated_at AS "lastAccessedAt",
        l.title AS "lessonTitle",
        l.duration_seconds AS "durationSeconds",
        l.lesson_type AS "lessonType",
        c.title AS "courseTitle",
        c.slug AS "courseSlug"
      FROM student_lesson_progress slp
      JOIN course_lessons l ON l.lesson_id = slp.lesson_id
      JOIN courses c ON c.course_id = slp.course_id
      JOIN course_enrollments e ON e.course_id = slp.course_id AND e.student_id = slp.student_id
      WHERE slp.student_id = $1
        AND e.enrollment_status IN ('active', 'completed')
        AND l.is_active = TRUE
        AND c.deleted_at IS NULL
      ORDER BY slp.updated_at DESC
      LIMIT 1;
    `, [studentId]);

    // 4. Enrolled courses with real progress
    const enrolledCoursesRes = await this.db.query(`
      SELECT
        c.course_id AS "courseId",
        c.title,
        c.slug,
        c.thumbnail_url AS "thumbnailUrl",
        c.level,
        e.enrollment_status AS "enrollmentStatus",
        e.enrolled_at AS "enrolledAt",
        COALESCE(inst.first_name || ' ' || COALESCE(inst.last_name, ''), 'Instructor') AS "instructorName",
        (
          SELECT COUNT(*)::int
          FROM course_lessons l
          WHERE l.course_id = c.course_id
            AND l.is_active = TRUE
            AND COALESCE(l.is_optional, FALSE) = FALSE
        ) AS "totalLessonsCount",
        (
          SELECT COUNT(*)::int
          FROM student_lesson_progress slp
          JOIN course_lessons l ON l.lesson_id = slp.lesson_id
          WHERE slp.student_id = $1
            AND slp.course_id = c.course_id
            AND slp.is_completed = TRUE
            AND l.is_active = TRUE
            AND COALESCE(l.is_optional, FALSE) = FALSE
        ) AS "completedLessonsCount",
        (
          SELECT MAX(slp.updated_at)
          FROM student_lesson_progress slp
          WHERE slp.student_id = $1 AND slp.course_id = c.course_id
        ) AS "lastActivityAt"
      FROM course_enrollments e
      JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN users inst ON inst.user_id = c.instructor_id
      WHERE e.student_id = $1
        AND e.enrollment_status IN ('active', 'completed')
        AND c.deleted_at IS NULL
      ORDER BY e.enrolled_at DESC
      LIMIT 6;
    `, [studentId]);

    const coursesWithPct = enrolledCoursesRes.rows.map((row: any) => {
      const total = Number(row.totalLessonsCount) || 0;
      const completed = Number(row.completedLessonsCount) || 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        ...row,
        completionPercentage: progress,
      };
    });

    // 5. Recent completed lesson activity
    const recentActivityRes = await this.db.query(`
      SELECT
        slp.lesson_id AS "lessonId",
        slp.completed_at AS "completedAt",
        l.title AS "lessonTitle",
        c.title AS "courseTitle"
      FROM student_lesson_progress slp
      JOIN course_lessons l ON l.lesson_id = slp.lesson_id
      JOIN courses c ON c.course_id = slp.course_id
      WHERE slp.student_id = $1 AND slp.is_completed = TRUE
      ORDER BY slp.completed_at DESC
      LIMIT 5;
    `, [studentId]);

    // 6. Weekly learning momentum activity (past 7 days)
    const weeklyActivityRes = await this.db.query(`
      SELECT
        TO_CHAR(d.day, 'YYYY-MM-DD') AS "date",
        TO_CHAR(d.day, 'Dy') AS "dayName",
        COALESCE(SUM(s.seconds_watched), 0)::int AS "secondsWatched",
        ROUND(COALESCE(SUM(s.seconds_watched), 0) / 60.0, 1)::float AS "minutesWatched",
        COUNT(DISTINCT s.session_id)::int AS "sessionsCount"
      FROM generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
      ) d(day)
      LEFT JOIN student_learning_sessions s
        ON s.student_id = $1
       AND s.started_at >= d.day
       AND s.started_at < d.day + INTERVAL '1 day'
      GROUP BY d.day
      ORDER BY d.day ASC;
    `, [studentId]);

    const totalWatchedSec = progressStatsRes.rows[0]?.totalWatchedSeconds || 0;
    const hours = (totalWatchedSec / 3600).toFixed(1);

    return {
      stats: {
        ...statsRes.rows[0],
        completedLessons: progressStatsRes.rows[0]?.completedLessons || 0,
        learningHours: `${hours}h`,
      },
      continueLearning: continueLearningRes.rows[0] || null,
      enrolledCourses: coursesWithPct,
      recentActivity: recentActivityRes.rows,
      weeklyActivity: weeklyActivityRes.rows,
    };
  }
}

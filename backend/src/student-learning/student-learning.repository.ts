import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class StudentLearningRepository {
  constructor(private readonly database: DatabaseService) {}

  async findPublishedCourse(idOrSlug: string) {
    const result = await this.database.query(
      `SELECT
         c.course_id AS "courseId",
         c.title,
         c.slug,
         c.subtitle,
         c.description,
         c.learning_outcomes AS "learningOutcomes",
         c.requirements,
         c.target_audience AS "targetAudience",
         c.level,
         c.language,
         c.is_free AS "isFree",
         c.price::float AS price,
         c.discount_price::float AS "discountPrice",
         c.currency,
         c.thumbnail_url AS "thumbnailUrl",
         c.published_at AS "publishedAt",
         cat.name AS "categoryName",
         TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName"
       FROM courses c
       LEFT JOIN categories cat ON cat.category_id = c.category_id
       LEFT JOIN users u ON u.user_id = c.instructor_id
       WHERE (c.course_id::text = $1 OR c.slug = $1)
         AND c.status = 'published'
         AND c.is_active = TRUE
         AND c.deleted_at IS NULL
       LIMIT 1`,
      [idOrSlug],
    );

    return result.rows[0] ?? null;
  }

  async listCourseSections(courseId: string) {
    const result = await this.database.query(
      `SELECT
         s.section_id AS "sectionId",
         s.title,
         s.description,
         s.sort_order AS "sortOrder",
         COALESCE(
           json_agg(
             json_build_object(
               'lessonId', l.lesson_id,
               'title', l.title,
               'description', l.description,
               'lessonType', l.lesson_type,
               'durationSeconds', l.duration_seconds,
               'isPreview', l.is_preview,
               'isOptional', COALESCE(l.is_optional, FALSE),
               'sortOrder', l.sort_order
             ) ORDER BY l.sort_order
           ) FILTER (WHERE l.lesson_id IS NOT NULL),
           '[]'::json
         ) AS lessons
       FROM course_sections s
       LEFT JOIN course_lessons l
         ON l.section_id = s.section_id
        AND l.is_active = TRUE
       WHERE s.course_id = $1
         AND s.is_active = TRUE
       GROUP BY s.section_id
       ORDER BY s.sort_order`,
      [courseId],
    );

    return result.rows;
  }

  async findLessonForLearning(lessonId: string) {
    const result = await this.database.query(
      `SELECT
         l.lesson_id AS "lessonId",
         l.course_id AS "courseId",
         l.section_id AS "sectionId",
         l.title,
         l.description,
         l.lesson_type AS "lessonType",
         l.content_text AS "contentText",
         l.content_asset_id AS "contentAssetId",
         l.duration_seconds AS "durationSeconds",
         l.is_preview AS "isPreview",
         COALESCE(l.is_optional, FALSE) AS "isOptional",
         a.asset_id AS "assetId",
         a.asset_type AS "assetType",
         a.mime_type AS "mimeType",
         a.file_size_bytes AS "fileSizeBytes",
         a.storage_provider AS "storageProvider",
         a.storage_key AS "storageKey",
         a.visibility,
         a.processing_status AS "processingStatus",
         a.has_audio AS "hasAudio",
         a.audio_codec AS "audioCodec",
         a.thumbnail_key AS "thumbnailKey",
         a.metadata AS "mediaMetadata"
       FROM course_lessons l
       INNER JOIN course_sections s
         ON s.section_id = l.section_id
        AND s.course_id = l.course_id
       INNER JOIN courses c
         ON c.course_id = l.course_id
       LEFT JOIN media_assets a
         ON a.asset_id = l.content_asset_id
        AND a.course_id = l.course_id
        AND a.is_active = TRUE
        AND a.deleted_at IS NULL
       WHERE l.lesson_id = $1
         AND l.is_active = TRUE
         AND s.is_active = TRUE
         AND c.status = 'published'
         AND c.is_active = TRUE
         AND c.deleted_at IS NULL
       LIMIT 1`,
      [lessonId],
    );

    return result.rows[0] ?? null;
  }

  // --- PROGRESS TRACKING METHODS ---

  async upsertLessonProgress(data: {
    studentId: string;
    courseId: string;
    lessonId: string;
    lastPositionSeconds: number;
    maxWatchedSeconds: number;
    isCompleted: boolean;
  }) {
    const result = await this.database.query(
      `INSERT INTO student_lesson_progress (
         student_id,
         course_id,
         lesson_id,
         last_position_seconds,
         max_watched_seconds,
         is_completed,
         completed_at,
         updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         CASE WHEN $6 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END,
         CURRENT_TIMESTAMP
       )
       ON CONFLICT (student_id, lesson_id) DO UPDATE
       SET
         last_position_seconds = EXCLUDED.last_position_seconds,
         max_watched_seconds = GREATEST(student_lesson_progress.max_watched_seconds, EXCLUDED.max_watched_seconds),
         is_completed = CASE
           WHEN student_lesson_progress.is_completed = TRUE THEN TRUE
           ELSE EXCLUDED.is_completed
         END,
         completed_at = CASE
           WHEN student_lesson_progress.is_completed = TRUE THEN student_lesson_progress.completed_at
           WHEN EXCLUDED.is_completed = TRUE THEN CURRENT_TIMESTAMP
           ELSE NULL
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        data.studentId,
        data.courseId,
        data.lessonId,
        data.lastPositionSeconds,
        data.maxWatchedSeconds,
        data.isCompleted,
      ],
    );

    return result.rows[0];
  }

  async markLessonCompleted(studentId: string, courseId: string, lessonId: string) {
    const result = await this.database.query(
      `INSERT INTO student_lesson_progress (
         student_id,
         course_id,
         lesson_id,
         last_position_seconds,
         max_watched_seconds,
         is_completed,
         completed_at,
         updated_at
       )
       VALUES ($1, $2, $3, 0, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (student_id, lesson_id) DO UPDATE
       SET
         is_completed = TRUE,
         completed_at = COALESCE(student_lesson_progress.completed_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [studentId, courseId, lessonId],
    );

    return result.rows[0];
  }

  async getLessonProgress(studentId: string, lessonId: string) {
    const result = await this.database.query(
      `SELECT * FROM student_lesson_progress
       WHERE student_id = $1 AND lesson_id = $2`,
      [studentId, lessonId],
    );
    return result.rows[0] ?? null;
  }

  async listCourseProgress(studentId: string, courseId: string) {
    const result = await this.database.query(
      `SELECT
         lesson_id AS "lessonId",
         last_position_seconds AS "lastPositionSeconds",
         max_watched_seconds AS "maxWatchedSeconds",
         is_completed AS "isCompleted",
         completed_at AS "completedAt",
         updated_at AS "updatedAt"
       FROM student_lesson_progress
       WHERE student_id = $1 AND course_id = $2`,
      [studentId, courseId],
    );

    return result.rows;
  }

  async calculateCourseCompletion(studentId: string, courseId: string) {
    const totalResult = await this.database.query(
      `SELECT COUNT(l.lesson_id) AS total
       FROM course_lessons l
       INNER JOIN course_sections s ON s.section_id = l.section_id
       WHERE l.course_id = $1
         AND l.is_active = TRUE
         AND s.is_active = TRUE
         AND COALESCE(l.is_optional, FALSE) = FALSE`,
      [courseId],
    );

    const completedResult = await this.database.query(
      `SELECT COUNT(p.progress_id) AS completed
       FROM student_lesson_progress p
       INNER JOIN course_lessons l ON l.lesson_id = p.lesson_id
       WHERE p.student_id = $1
         AND p.course_id = $2
         AND p.is_completed = TRUE
         AND l.is_active = TRUE
         AND COALESCE(l.is_optional, FALSE) = FALSE`,
      [studentId, courseId],
    );

    const total = Number(totalResult.rows[0]?.total || 0);
    const completed = Number(completedResult.rows[0]?.completed || 0);
    const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    return {
      totalLessons: total,
      completedLessons: completed,
      completionPercentage: percentage,
      isCourseCompleted: total > 0 && completed >= total,
    };
  }

  /**
   * Synchronize course enrollment status to 'completed' when all required lessons are finished.
   * Only transitions 'active' enrollments and preserves existing completed_at timestamps.
   */
  async syncCourseEnrollmentCompletion(studentId: string, courseId: string, isCourseCompleted: boolean) {
    if (!isCourseCompleted) return null;

    const result = await this.database.query(
      `UPDATE course_enrollments
       SET enrollment_status = 'completed',
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1
         AND course_id = $2
         AND enrollment_status = 'active'
       RETURNING enrollment_id, enrollment_status, completed_at`,
      [studentId, courseId],
    );

    return result.rows[0] ?? null;
  }

  // --- LEARNING SESSIONS & ACTIVITY HISTORY ---

  /**
   * Accumulates incremental watch time into an active learning session for the student.
   * Prevents double-counting by accumulating into the matching session_id.
   */
  async recordLearningSession(data: {
    studentId: string;
    courseId: string;
    lessonId: string;
    sessionId: string;
    incrementalSeconds: number;
  }) {
    if (!data.incrementalSeconds || data.incrementalSeconds <= 0) return null;

    const result = await this.database.query(
      `WITH updated AS (
         UPDATE student_learning_sessions
         SET seconds_watched = seconds_watched + $5,
             ended_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id FROM student_learning_sessions
           WHERE student_id = $1
             AND lesson_id = $3
             AND session_id = $4
             AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
           ORDER BY updated_at DESC
           LIMIT 1
         )
         RETURNING id, seconds_watched
       ),
       inserted AS (
         INSERT INTO student_learning_sessions (
           student_id, course_id, lesson_id, session_id,
           started_at, ended_at, seconds_watched, updated_at
         )
         SELECT $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP
         WHERE NOT EXISTS (SELECT 1 FROM updated)
         RETURNING id, seconds_watched
       )
       SELECT id, seconds_watched FROM updated
       UNION ALL
       SELECT id, seconds_watched FROM inserted`,
      [
        data.studentId,
        data.courseId,
        data.lessonId,
        data.sessionId,
        data.incrementalSeconds,
      ],
    );

    return result.rows[0] ?? null;
  }

  /**
   * Retrieve daily learning activity for the requested number of days (default 7).
   */
  async getDailyActivityHistory(studentId: string, days = 7) {
    const safeDays = Math.max(1, Math.min(30, days));
    const result = await this.database.query(
      `SELECT
         TO_CHAR(d.day, 'YYYY-MM-DD') AS "date",
         TO_CHAR(d.day, 'Dy') AS "dayName",
         COALESCE(SUM(s.seconds_watched), 0)::int AS "secondsWatched",
         ROUND(COALESCE(SUM(s.seconds_watched), 0) / 60.0, 1)::float AS "minutesWatched",
         COUNT(DISTINCT s.session_id)::int AS "sessionsCount"
       FROM generate_series(
         CURRENT_DATE - ($2 || ' days')::interval,
         CURRENT_DATE,
         '1 day'::interval
       ) d(day)
       LEFT JOIN student_learning_sessions s
         ON s.student_id = $1
        AND s.started_at >= d.day
        AND s.started_at < d.day + INTERVAL '1 day'
       GROUP BY d.day
       ORDER BY d.day ASC`,
      [studentId, safeDays - 1],
    );

    return result.rows;
  }

  // --- STUDENT LESSON RESOURCES ---

  async listLessonResources(lessonId: string) {
    const result = await this.database.query(
      `SELECT
         r.resource_id AS "resourceId",
         r.lesson_id AS "lessonId",
         r.title,
         r.sort_order AS "sortOrder",
         r.created_at AS "createdAt",
         m.original_file_name AS "fileName",
         m.mime_type AS "mimeType",
         m.file_size_bytes AS "fileSizeBytes",
         m.asset_type AS "assetType"
       FROM lesson_resources r
       JOIN media_assets m ON m.asset_id = r.asset_id
       WHERE r.lesson_id = $1
         AND m.is_active = TRUE
         AND m.deleted_at IS NULL
       ORDER BY r.sort_order, r.created_at`,
      [lessonId],
    );

    return result.rows;
  }

  async findLessonResourceForDownload(lessonId: string, resourceId: string) {
    const result = await this.database.query(
      `SELECT
         r.resource_id AS "resourceId",
         r.lesson_id AS "lessonId",
         r.title,
         m.asset_id AS "assetId",
         m.original_file_name AS "fileName",
         m.mime_type AS "mimeType",
         m.file_size_bytes AS "fileSizeBytes",
         m.storage_provider AS "storageProvider",
         m.storage_key AS "storageKey"
       FROM lesson_resources r
       JOIN media_assets m ON m.asset_id = r.asset_id
       WHERE r.resource_id = $1
         AND r.lesson_id = $2
         AND m.is_active = TRUE
         AND m.deleted_at IS NULL
       LIMIT 1`,
      [resourceId, lessonId],
    );

    return result.rows[0] ?? null;
  }
}

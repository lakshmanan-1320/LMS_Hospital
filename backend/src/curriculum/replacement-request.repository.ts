import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReplacementRequestRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(data: {
    courseId: string;
    lessonId: string;
    instructorId: string;
    currentAssetId: string | null;
    reason: string;
  }) {
    const result = await this.database.query(
      `INSERT INTO lesson_media_replacement_requests (
        course_id,
        lesson_id,
        instructor_id,
        current_asset_id,
        reason,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *`,
      [
        data.courseId,
        data.lessonId,
        data.instructorId,
        data.currentAssetId,
        data.reason.trim(),
      ],
    );

    return result.rows[0];
  }

  async findActiveByLesson(lessonId: string) {
    const result = await this.database.query(
      `SELECT * FROM lesson_media_replacement_requests
       WHERE lesson_id = $1 AND status IN ('pending', 'approved')
       ORDER BY created_at DESC
       LIMIT 1`,
      [lessonId],
    );
    return result.rows[0] ?? null;
  }

  async findById(requestId: string) {
    const result = await this.database.query(
      `SELECT
         r.*,
         c.title AS "courseTitle",
         c.status AS "courseStatus",
         l.title AS "lessonTitle",
         l.lesson_type AS "lessonType",
         l.content_asset_id AS "lessonCurrentAssetId",
         curr_asset.title AS "currentAssetTitle",
         curr_asset.original_file_name AS "currentAssetFileName",
         curr_asset.has_audio AS "currentAssetHasAudio",
         repl_asset.title AS "replacementAssetTitle",
         repl_asset.original_file_name AS "replacementAssetFileName",
         repl_asset.processing_status AS "replacementProcessingStatus",
         repl_asset.has_audio AS "replacementHasAudio",
         repl_asset.duration_seconds AS "replacementDurationSeconds",
         TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
         u.email AS "instructorEmail",
         TRIM(CONCAT(rev.first_name, ' ', rev.last_name)) AS "reviewerName"
       FROM lesson_media_replacement_requests r
       INNER JOIN courses c ON c.course_id = r.course_id
       INNER JOIN course_lessons l ON l.lesson_id = r.lesson_id
       INNER JOIN users u ON u.user_id = r.instructor_id
       LEFT JOIN media_assets curr_asset ON curr_asset.asset_id = r.current_asset_id
       LEFT JOIN media_assets repl_asset ON repl_asset.asset_id = r.replacement_asset_id
       LEFT JOIN users rev ON rev.user_id = r.reviewed_by
       WHERE r.request_id = $1`,
      [requestId],
    );

    return result.rows[0] ?? null;
  }

  async listByInstructor(instructorId: string) {
    const result = await this.database.query(
      `SELECT
         r.*,
         c.title AS "courseTitle",
         c.status AS "courseStatus",
         l.title AS "lessonTitle",
         curr_asset.title AS "currentAssetTitle",
         curr_asset.has_audio AS "currentAssetHasAudio",
         repl_asset.title AS "replacementAssetTitle",
         repl_asset.processing_status AS "replacementProcessingStatus",
         repl_asset.has_audio AS "replacementHasAudio",
         TRIM(CONCAT(rev.first_name, ' ', rev.last_name)) AS "reviewerName"
       FROM lesson_media_replacement_requests r
       INNER JOIN courses c ON c.course_id = r.course_id
       INNER JOIN course_lessons l ON l.lesson_id = r.lesson_id
       LEFT JOIN media_assets curr_asset ON curr_asset.asset_id = r.current_asset_id
       LEFT JOIN media_assets repl_asset ON repl_asset.asset_id = r.replacement_asset_id
       LEFT JOIN users rev ON rev.user_id = r.reviewed_by
       WHERE r.instructor_id = $1
       ORDER BY r.created_at DESC`,
      [instructorId],
    );

    return result.rows;
  }

  async listAllAdmin(statusFilter?: string) {
    let sql = `
      SELECT
        r.*,
        c.title AS "courseTitle",
        c.status AS "courseStatus",
        l.title AS "lessonTitle",
        curr_asset.title AS "currentAssetTitle",
        curr_asset.has_audio AS "currentAssetHasAudio",
        repl_asset.title AS "replacementAssetTitle",
        repl_asset.processing_status AS "replacementProcessingStatus",
        repl_asset.has_audio AS "replacementHasAudio",
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
        u.email AS "instructorEmail",
        TRIM(CONCAT(rev.first_name, ' ', rev.last_name)) AS "reviewerName"
      FROM lesson_media_replacement_requests r
      INNER JOIN courses c ON c.course_id = r.course_id
      INNER JOIN course_lessons l ON l.lesson_id = r.lesson_id
      INNER JOIN users u ON u.user_id = r.instructor_id
      LEFT JOIN media_assets curr_asset ON curr_asset.asset_id = r.current_asset_id
      LEFT JOIN media_assets repl_asset ON repl_asset.asset_id = r.replacement_asset_id
      LEFT JOIN users rev ON rev.user_id = r.reviewed_by
    `;
    const params: any[] = [];

    if (statusFilter) {
      sql += ` WHERE r.status = $1`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY r.created_at DESC`;

    const result = await this.database.query(sql, params);
    return result.rows;
  }

  async updateReview(
    requestId: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    comment?: string,
  ) {
    const result = await this.database.query(
      `UPDATE lesson_media_replacement_requests
       SET
         status = $2,
         reviewed_by = $3,
         reviewed_at = CURRENT_TIMESTAMP,
         review_comment = $4,
         updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1
       RETURNING *`,
      [requestId, status, reviewedBy, comment ?? null],
    );

    return result.rows[0] ?? null;
  }

  async attachReplacementAsset(requestId: string, assetId: string) {
    const result = await this.database.query(
      `UPDATE lesson_media_replacement_requests
       SET replacement_asset_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1
       RETURNING *`,
      [requestId, assetId],
    );

    return result.rows[0] ?? null;
  }

  async applyReplacementInTransaction(data: {
    requestId: string;
    lessonId: string;
    courseId: string;
    replacementAssetId: string;
    durationSeconds: number;
    actorId: string;
  }) {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      // 1. Lock and verify the replacement request is in 'approved' status
      const lockReq = await client.query(
        `SELECT request_id, status, lesson_id, course_id, current_asset_id, replacement_asset_id
         FROM lesson_media_replacement_requests
         WHERE request_id = $1
         FOR UPDATE`,
        [data.requestId],
      );

      if (!lockReq.rows[0]) {
        throw new Error('Replacement request not found');
      }

      if (lockReq.rows[0].status !== 'approved') {
        throw new Error(
          `Cannot apply replacement. Request status is "${lockReq.rows[0].status}" (must be "approved").`,
        );
      }

      // 2. Lock the target lesson row
      const lockLesson = await client.query(
        `SELECT lesson_id, content_asset_id
         FROM course_lessons
         WHERE lesson_id = $1 AND course_id = $2 AND is_active = TRUE
         FOR UPDATE`,
        [data.lessonId, data.courseId],
      );

      if (!lockLesson.rows[0]) {
        throw new Error('Lesson not found or inactive');
      }

      // 3. Update lesson content asset pointer and duration
      const lessonRes = await client.query(
        `UPDATE course_lessons
         SET
           content_asset_id = $1,
           duration_seconds = COALESCE($2, duration_seconds),
           updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = $3 AND course_id = $4 AND is_active = TRUE
         RETURNING *`,
        [data.replacementAssetId, data.durationSeconds, data.lessonId, data.courseId],
      );

      // 4. Mark replacement request as applied, strictly conditional on status = 'approved'
      const reqRes = await client.query(
        `UPDATE lesson_media_replacement_requests
         SET
           status = 'applied',
           applied_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1 AND status = 'approved'
         RETURNING *`,
         [data.requestId],
      );

      if (!reqRes.rows[0]) {
        throw new Error('Failed to transition request: status was not approved or already applied');
      }

      // 5. Record audit log
      await client.query(
        `INSERT INTO media_audit_logs (
           action, actor_id, course_id, lesson_id, asset_id, details
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'REPLACEMENT_APPLIED',
          data.actorId,
          data.courseId,
          data.lessonId,
          data.replacementAssetId,
          JSON.stringify({
            requestId: data.requestId,
            previousAssetId: lockReq.rows[0].current_asset_id,
            newAssetId: data.replacementAssetId,
          }),
        ],
      );

      await client.query('COMMIT');
      return {
        lesson: lessonRes.rows[0],
        request: reqRes.rows[0],
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

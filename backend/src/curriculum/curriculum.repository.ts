
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CurriculumRepository {
  constructor(private readonly database: DatabaseService) {}

  async listCourses(userId: string, isAdmin: boolean) {
  const result = await this.database.query(
    `SELECT
       c.course_id,
       c.title,
       c.status,
       c.updated_at,
       COUNT(DISTINCT s.section_id)::int AS section_count,
       COUNT(DISTINCT l.lesson_id)::int AS lesson_count
     FROM courses c
     LEFT JOIN course_sections s
       ON s.course_id = c.course_id AND s.is_active = TRUE
     LEFT JOIN course_lessons l
       ON l.section_id = s.section_id AND l.is_active = TRUE
     WHERE c.deleted_at IS NULL
       AND c.is_active = TRUE
       AND ($2::boolean = TRUE OR c.instructor_id = $1)
     GROUP BY c.course_id
     ORDER BY c.updated_at DESC`,
    [userId, isAdmin],
  );

  return result.rows;
}
  async findCourse(courseId: string, userId: string, isAdmin: boolean) {
    const result = await this.database.query(
      `SELECT course_id, instructor_id, status
       FROM courses
       WHERE course_id = $1
         AND deleted_at IS NULL
         AND ($3::boolean = TRUE OR instructor_id = $2)`,
      [courseId, userId, isAdmin],
    );

    return result.rows[0] ?? null;
  }

  async listSections(courseId: string) {
    const result = await this.database.query(
      `SELECT
         s.section_id,
         s.course_id,
         s.title,
         s.description,
         s.sort_order,
         s.is_active,
         s.created_at,
         s.updated_at,
         COALESCE(
           json_agg(
             json_build_object(
               'lessonId', l.lesson_id,
               'title', l.title,
               'description', l.description,
               'lessonType', l.lesson_type,
               'contentText', l.content_text,
               'contentAssetId', l.content_asset_id,
               'durationSeconds', l.duration_seconds,
               'isPreview', l.is_preview,
               'sortOrder', l.sort_order,
               'isActive', l.is_active
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

  async createSection(
    courseId: string,
    data: { title: string; description?: string; sortOrder?: number },
  ) {
    const result = await this.database.query(
      `INSERT INTO course_sections
         (course_id, title, description, sort_order)
       VALUES (
         $1, $2, $3,
         -- Append to the end when no position is given (counts soft-deleted rows, which still hold their order)
         COALESCE($4::int, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM course_sections WHERE course_id = $1))
       )
       RETURNING *`,
      [
        courseId,
        data.title.trim(),
        data.description ?? null,
        data.sortOrder ?? null,
      ],
    );

    return result.rows[0];
  }

  async findSection(sectionId: string) {
    const result = await this.database.query(
      `SELECT section_id, course_id
       FROM course_sections
       WHERE section_id = $1 AND is_active = TRUE`,
      [sectionId],
    );

    return result.rows[0] ?? null;
  }

  async updateSection(sectionId: string, data: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = {
      title: 'title',
      description: 'description',
      sortOrder: 'sort_order',
    };

    for (const [key, column] of Object.entries(allowed)) {
      if (data[key] !== undefined) {
        values.push(data[key]);
        fields.push(`${column} = $${values.length}`);
      }
    }

    if (!fields.length) {
      return null;
    }

    values.push(sectionId);

    const result = await this.database.query(
      `UPDATE course_sections
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE section_id = $${values.length} AND is_active = TRUE
       RETURNING *`,
      values,
    );

    return result.rows[0] ?? null;
  }

  async deactivateSection(sectionId: string) {
    await this.database.withTransaction(async (client) => {
      await client.query(
        `UPDATE course_lessons
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE section_id = $1`,
        [sectionId],
      );

      await client.query(
        `UPDATE course_sections
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE section_id = $1`,
        [sectionId],
      );
    });
  }

  async createLesson(
    sectionId: string,
    courseId: string,
    data: Record<string, any>,
  ) {
    const result = await this.database.query(
      `INSERT INTO course_lessons (
         section_id, course_id, title, description, lesson_type,
         content_text, content_asset_id, duration_seconds,
         is_preview, sort_order
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         COALESCE($10::int, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM course_lessons WHERE section_id = $1))
       )
       RETURNING *`,
      [
        sectionId,
        courseId,
        data.title.trim(),
        data.description ?? null,
        data.lessonType,
        data.contentText ?? null,
        data.contentAssetId ?? null,
        data.durationSeconds ?? 0, // column is NOT NULL DEFAULT 0
        data.isPreview ?? false,
        data.sortOrder ?? null,
      ],
    );

    return result.rows[0];
  }

  async findLesson(lessonId: string) {
    const result = await this.database.query(
      `SELECT lesson_id, section_id, course_id, lesson_type
       FROM course_lessons
       WHERE lesson_id = $1 AND is_active = TRUE`,
      [lessonId],
    );

    return result.rows[0] ?? null;
  }

  async updateLesson(lessonId: string, data: Record<string, any>) {
    const allowed = {
      title: 'title',
      description: 'description',
      lessonType: 'lesson_type',
      contentText: 'content_text',
      contentAssetId: 'content_asset_id',
      durationSeconds: 'duration_seconds',
      isPreview: 'is_preview',
      sortOrder: 'sort_order',
    };

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(allowed)) {
      if (data[key] !== undefined) {
        values.push(data[key]);
        fields.push(`${column} = $${values.length}`);
      }
    }

    if (!fields.length) {
      return null;
    }

    values.push(lessonId);

    const result = await this.database.query(
      `UPDATE course_lessons
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE lesson_id = $${values.length} AND is_active = TRUE
       RETURNING *`,
      values,
    );

    return result.rows[0] ?? null;
  }

  async findCourseAsset(assetId: string, courseId: string) {
    const result = await this.database.query(
      `SELECT asset_id, asset_type
       FROM media_assets
       WHERE asset_id = $1
         AND course_id = $2
         AND is_active = TRUE
         AND deleted_at IS NULL`,
      [assetId, courseId],
    );

    return result.rows[0] ?? null;
  }

  async deactivateLesson(lessonId: string) {
    await this.database.query(
      `UPDATE course_lessons
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE lesson_id = $1`,
      [lessonId],
    );
  }

  async countLessonProgress(lessonId: string): Promise<number> {
    const result = await this.database.query(
      `SELECT count(*)::int AS count
       FROM student_lesson_progress
       WHERE lesson_id = $1 AND (is_completed = TRUE OR max_watched_seconds > 0)`,
      [lessonId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async countSectionProgress(sectionId: string): Promise<number> {
    const result = await this.database.query(
      `SELECT count(*)::int AS count
       FROM student_lesson_progress slp
       INNER JOIN course_lessons l ON l.lesson_id = slp.lesson_id
       WHERE l.section_id = $1 AND (slp.is_completed = TRUE OR slp.max_watched_seconds > 0)`,
      [sectionId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async reorderSections(courseId: string, sectionIds: string[]) {
    await this.database.withTransaction(async (client) => {
      // First pass: shift to negative offset to prevent deferred unique constraint collisions
      for (let i = 0; i < sectionIds.length; i++) {
        await client.query(
          `UPDATE course_sections
           SET sort_order = $1
           WHERE section_id = $2 AND course_id = $3`,
          [-(i + 1), sectionIds[i], courseId],
        );
      }
      // Second pass: apply target 0-indexed positions
      for (let i = 0; i < sectionIds.length; i++) {
        await client.query(
          `UPDATE course_sections
           SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE section_id = $2 AND course_id = $3`,
          [i, sectionIds[i], courseId],
        );
      }
    });
    return this.listSections(courseId);
  }

  async reorderLessons(sectionId: string, lessonIds: string[]) {
    await this.database.withTransaction(async (client) => {
      for (let i = 0; i < lessonIds.length; i++) {
        await client.query(
          `UPDATE course_lessons
           SET sort_order = $1
           WHERE lesson_id = $2 AND section_id = $3`,
          [-(i + 1), lessonIds[i], sectionId],
        );
      }
      for (let i = 0; i < lessonIds.length; i++) {
        await client.query(
          `UPDATE course_lessons
           SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE lesson_id = $2 AND section_id = $3`,
          [i, lessonIds[i], sectionId],
        );
      }
    });
  }
}

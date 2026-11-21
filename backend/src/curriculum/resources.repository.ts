
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ResourcesRepository {
  constructor(private readonly database: DatabaseService) {}

  async attach(
    lessonId: string,
    courseId: string,
    assetId: string,
    title: string,
    sortOrder = 0,
  ) {
    const result = await this.database.query(
      `INSERT INTO lesson_resources (lesson_id, asset_id, title, sort_order)
       SELECT $1, m.asset_id, $4, $5
       FROM media_assets m
       WHERE m.asset_id = $3
         AND m.course_id = $2
         AND m.is_active = TRUE
         AND m.deleted_at IS NULL
         AND m.asset_type IN ('document', 'image')
       RETURNING resource_id, lesson_id, asset_id, title, sort_order, created_at`,
      [lessonId, courseId, assetId, title, sortOrder],
    );

    return result.rows[0] ?? null;
  }


  async list(lessonId: string) {
    const result = await this.database.query(
      `SELECT
         r.resource_id,
         r.lesson_id,
         r.asset_id,
         r.title,
         r.sort_order,
         r.created_at,
         m.original_file_name,
         m.mime_type,
         m.file_size_bytes
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

  async remove(resourceId: string, lessonId: string) {
    const result = await this.database.query(
      `DELETE FROM lesson_resources
       WHERE resource_id = $1 AND lesson_id = $2
       RETURNING resource_id`,
      [resourceId, lessonId],
    );

    return result.rowCount > 0;
  }
}

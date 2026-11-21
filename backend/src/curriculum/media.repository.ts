import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { VideoMetadata } from './video-processor.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly database: DatabaseService) {}

  async createAsset(data: {
    ownerId: string;
    courseId: string;
    assetType: 'video' | 'document' | 'image';
    title: string;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    checksum: string;
    storageKey: string;
    storageProvider: 'local' | 's3';
  }) {
    const result = await this.database.query(
      `INSERT INTO media_assets (
        owner_id,
        course_id,
        asset_type,
        title,
        original_file_name,
        mime_type,
        file_size_bytes,
        checksum_sha256,
        storage_provider,
        storage_key,
        visibility,
        processing_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'private', 'uploaded')
      RETURNING
        asset_id,
        course_id,
        asset_type,
        title,
        original_file_name,
        mime_type,
        file_size_bytes,
        processing_status,
        created_at`,
      [
        data.ownerId,
        data.courseId,
        data.assetType,
        data.title,
        data.originalFileName,
        data.mimeType,
        data.fileSize,
        data.checksum,
        data.storageProvider,
        data.storageKey,
      ],
    );

    return result.rows[0];
  }

  async markAssetReady(
    assetId: string,
    metadata: VideoMetadata,
  ) {
    const result = await this.database.query(
      `UPDATE media_assets
       SET
         processing_status = 'ready',
         duration_seconds = $2,
         width = $3,
         height = $4,
         has_audio = $5,
         audio_codec = $6,
         thumbnail_key = COALESCE($7, thumbnail_key),
         metadata = metadata || $8::jsonb,
         updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1
         AND is_active = TRUE
         AND deleted_at IS NULL
       RETURNING
         asset_id,
         title,
         asset_type,
         processing_status,
         duration_seconds,
         width,
         height,
         has_audio,
         audio_codec,
         thumbnail_key,
         metadata,
         created_at`,
      [
        assetId,
        metadata.durationSeconds,
        metadata.width,
        metadata.height,
        metadata.hasAudio,
        metadata.audioCodec,
        metadata.thumbnailKey ?? null,
        JSON.stringify({
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec,
          hasAudio: metadata.hasAudio,
          sampleRate: metadata.sampleRate,
          channels: metadata.channels,
          format: metadata.format,
          processedAt: new Date().toISOString(),
        }),
      ],
    );

    return result.rows[0] ?? null;
  }

  async markAssetProcessing(assetId: string) {
    const result = await this.database.query(
      `UPDATE media_assets
       SET processing_status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1
       RETURNING asset_id, processing_status`,
      [assetId],
    );
    return result.rows[0] ?? null;
  }

  async markAssetFailed(assetId: string, errorReason: string) {
    const result = await this.database.query(
      `UPDATE media_assets
       SET
         processing_status = 'failed',
         metadata = metadata || $2::jsonb,
         updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1
       RETURNING asset_id, processing_status, metadata`,
      [
        assetId,
        JSON.stringify({
          failureReason: errorReason,
          failedAt: new Date().toISOString(),
        }),
      ],
    );
    return result.rows[0] ?? null;
  }

  async findAssetById(assetId: string) {
    const result = await this.database.query(
      `SELECT
         asset_id, owner_id, course_id, asset_type, title,
         original_file_name, mime_type, file_size_bytes,
         storage_provider, storage_key, visibility, processing_status,
         duration_seconds, width, height, has_audio, audio_codec,
         thumbnail_key, metadata, created_at, updated_at
       FROM media_assets
       WHERE asset_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
      [assetId],
    );
    return result.rows[0] ?? null;
  }

  async findDuplicateByChecksum(courseId: string, checksum: string) {
    const result = await this.database.query(
      `SELECT
         asset_id, course_id, title, original_file_name,
         processing_status, duration_seconds, storage_key, has_audio
       FROM media_assets
       WHERE course_id = $1
         AND checksum_sha256 = $2
         AND is_active = TRUE
         AND deleted_at IS NULL
         AND processing_status = 'ready'
       LIMIT 1`,
      [courseId, checksum],
    );
    return result.rows[0] ?? null;
  }

  async listAssetsByCourse(courseId: string, assetType?: string) {
    let sql = `
      SELECT
        asset_id, course_id, asset_type, title, original_file_name,
        mime_type, file_size_bytes, processing_status, duration_seconds,
        width, height, has_audio, audio_codec, thumbnail_key, metadata,
        created_at
      FROM media_assets
      WHERE course_id = $1 AND is_active = TRUE AND deleted_at IS NULL
    `;
    const params: any[] = [courseId];

    if (assetType) {
      sql += ` AND asset_type = $2`;
      params.push(assetType);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.database.query(sql, params);
    return result.rows;
  }

  async updateHlsInfo(assetId: string, hlsKey: string, status: 'ready' | 'processing' | 'failed') {
    const result = await this.database.query(
      `UPDATE media_assets
       SET
         metadata = jsonb_set(
           jsonb_set(metadata, '{hlsKey}', to_jsonb($2::text)),
           '{hlsStatus}', to_jsonb($3::text)
         ),
         updated_at = CURRENT_TIMESTAMP
       WHERE asset_id = $1
       RETURNING asset_id, metadata`,
      [assetId, hlsKey, status],
    );
    return result.rows[0] ?? null;
  }
}

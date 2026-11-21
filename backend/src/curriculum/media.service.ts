import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';

import { CurriculumRepository } from './curriculum.repository';
import { MediaRepository } from './media.repository';
import { StorageService } from '../providers/storage/storage.service';
import { VideoProcessorService, VideoMetadata } from './video-processor.service';
import { DatabaseService } from '../database/database.service';
import { hasOperationsAdminRole } from '../common/policies/operations.policy';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly localRoot: string;

  constructor(
    private readonly curriculumRepository: CurriculumRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly storageService: StorageService,
    private readonly videoProcessor: VideoProcessorService,
    private readonly database: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.localRoot = resolve(
      this.configService?.get<string>('storage.localRoot') || 'private-storage',
    );
  }

  async upload(
    file: Express.Multer.File,
    courseId: string,
    userId: string,
    roles: string[],
    isApprovedReplacement = false,
  ) {
    if (!file) {
      throw new BadRequestException('Please select a file');
    }

    const cleanupTemporaryFile = () =>
      unlink(file.path).catch(() => undefined);

    const isAdmin = hasOperationsAdminRole(roles);

    const course = await this.curriculumRepository.findCourse(
      courseId,
      userId,
      isAdmin,
    );

    if (!course) {
      await cleanupTemporaryFile();
      throw new NotFoundException('Course not found or access denied');
    }

    // Allow uploads if course is draft/rejected/published OR if user is admin OR if it is an approved replacement
    if (!['draft', 'rejected', 'published'].includes(course.status) && !isAdmin && !isApprovedReplacement) {
      await cleanupTemporaryFile();
      throw new ConflictException(
        `Uploads are locked while the course is "${course.status}"`,
      );
    }

    let assetType: 'video' | 'document' | 'image';

    if (file.mimetype.startsWith('video/')) {
      assetType = 'video';
    } else if (file.mimetype.startsWith('image/')) {
      assetType = 'image';
    } else if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('word') ||
      file.mimetype.includes('presentation')
    ) {
      assetType = 'document';
    } else {
      await cleanupTemporaryFile();
      throw new BadRequestException('Unsupported file type');
    }

    // Calculate SHA-256 without loading the entire file into memory
    const checksum = await new Promise<string>((res, rej) => {
      const hash = createHash('sha256');
      createReadStream(file.path)
        .on('data', (chunk) => hash.update(chunk))
        .on('end', () => res(hash.digest('hex')))
        .on('error', rej);
    });

    // Acquire PostgreSQL advisory lock on (courseId, checksum) to prevent concurrent duplicate uploads
    const lockClient = await this.database.getClient();
    let lockAcquired = false;

    let fileStored = false;
    let thumbStoredKey: string | null = null;
    const assetId = randomUUID();
    const extension = extname(basename(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '');
    const storageKey = `courses/${courseId}/media/${assetId}${extension}`;

    try {
      await lockClient.query(
        'SELECT pg_advisory_lock(hashtext($1), hashtext($2))',
        [courseId, checksum],
      );
      lockAcquired = true;

      // Check for existing duplicate within the course while holding the lock
      const existingDuplicate = await this.mediaRepository.findDuplicateByChecksum(
        courseId,
        checksum,
      );

      if (existingDuplicate && existingDuplicate.processing_status === 'ready') {
        this.logger.log(
          `[MediaService] Duplicate file detected for course ${courseId} (checksum: ${checksum}). Reusing existing asset ${existingDuplicate.asset_id}.`,
        );

        await this.logAudit(
          'MEDIA_DUPLICATE_REUSED',
          userId,
          courseId,
          existingDuplicate.asset_id,
          {
            checksum,
            originalFileName: file.originalname,
            reusedAssetId: existingDuplicate.asset_id,
          },
        );

        await cleanupTemporaryFile();

        return {
          ...existingDuplicate,
          isDuplicateReused: true,
          message: 'Existing ready media asset reused',
        };
      }

      await this.logAudit('MEDIA_UPLOAD_STARTED', userId, courseId, assetId, {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        checksum,
      });

      let videoMetadata: VideoMetadata | null = null;

      // Validate video and extract metadata before storing it.
      if (assetType === 'video') {
        await this.logAudit('MEDIA_PROCESSING_STARTED', userId, courseId, assetId, {
          stage: 'ffprobe_inspection',
        });

        videoMetadata = await this.videoProcessor.inspectVideo(file.path);

        // Generate video thumbnail
        try {
          const tempThumbPath = `${file.path}.thumb.jpg`;
          await this.videoProcessor.generateThumbnail(file.path, tempThumbPath);
          const thumbKey = `courses/${courseId}/media/${assetId}-thumb.jpg`;
          await this.storageService.save(tempThumbPath, thumbKey, 'image/jpeg');
          thumbStoredKey = thumbKey;
          videoMetadata.thumbnailKey = thumbKey;
          await unlink(tempThumbPath).catch(() => undefined);
        } catch (thumbErr: any) {
          this.logger.warn(`Thumbnail generation skipped/failed: ${thumbErr.message}`);
        }
      }

      // Save to the selected private storage provider.
      await this.storageService.save(
        file.path,
        storageKey,
        file.mimetype,
      );

      fileStored = true;

      await this.logAudit('MEDIA_UPLOAD_SUCCESS', userId, courseId, assetId, {
        storageKey,
        storageProvider: this.storageService.name,
      });

      // Save metadata after storage succeeds.
      const asset = await this.mediaRepository.createAsset({
        ownerId: userId,
        courseId,
        assetType,
        title: basename(file.originalname).slice(0, 255),
        originalFileName: basename(file.originalname).slice(0, 255),
        mimeType: file.mimetype,
        fileSize: file.size,
        checksum,
        storageKey,
        storageProvider: this.storageService.name,
      });

      // Mark video ready only after successful validation and storage.
      if (assetType === 'video' && videoMetadata) {
        const readyAsset = await this.mediaRepository.markAssetReady(
          asset.asset_id,
          videoMetadata,
        );

        if (!readyAsset) {
          throw new Error('Unable to update video processing status');
        }

        await this.logAudit('MEDIA_PROCESSING_SUCCESS', userId, courseId, asset.asset_id, {
          durationSeconds: videoMetadata.durationSeconds,
          hasAudio: videoMetadata.hasAudio,
          audioCodec: videoMetadata.audioCodec,
          width: videoMetadata.width,
          height: videoMetadata.height,
        });

        return readyAsset;
      }

      return asset;
    } catch (error: any) {
      await this.logAudit('MEDIA_PROCESSING_FAILED', userId, courseId, assetId, {
        error: error.message,
      });

      // Prevent orphaned files if database insertion or processing fails.
      if (fileStored) {
        await this.storageService.delete(storageKey).catch(() => undefined);
      }
      if (thumbStoredKey) {
        await this.storageService.delete(thumbStoredKey).catch(() => undefined);
      }

      throw error;
    } finally {
      if (lockAcquired) {
        await lockClient.query(
          'SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
          [courseId, checksum],
        ).catch(() => undefined);
      }
      lockClient.release();
      await cleanupTemporaryFile();
    }
  }

  async listCourseAssets(
    courseId: string,
    userId: string,
    roles: string[],
    assetType?: string,
  ) {
    const isAdmin = hasOperationsAdminRole(roles);

    const course = await this.curriculumRepository.findCourse(
      courseId,
      userId,
      isAdmin,
    );

    if (!course) {
      throw new NotFoundException('Course not found or access denied');
    }

    return this.mediaRepository.listAssetsByCourse(courseId, assetType);
  }

  async getAsset(assetId: string, userId: string, roles: string[]) {
    const asset = await this.mediaRepository.findAssetById(assetId);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const isAdmin = hasOperationsAdminRole(roles);

    if (!isAdmin && asset.owner_id !== userId) {
      const course = await this.curriculumRepository.findCourse(
        asset.course_id,
        userId,
        false,
      );
      if (!course) {
        throw new NotFoundException('Asset not found or access denied');
      }
    }

    return asset;
  }

  async retryProcessing(assetId: string, userId: string, roles: string[]) {
    const asset = await this.getAsset(assetId, userId, roles);

    if (asset.asset_type !== 'video') {
      throw new BadRequestException('Only video assets can be reprocessed');
    }

    // Prevent simultaneous retry operations on the same asset
    if (asset.processing_status === 'processing') {
      throw new ConflictException('Asset is currently being processed');
    }

    const exists = await this.storageService.exists(asset.storage_key);
    if (!exists) {
      throw new NotFoundException('Video file does not exist in storage');
    }

    await this.mediaRepository.markAssetProcessing(assetId);

    await this.logAudit('MEDIA_RETRY_REQUESTED', userId, asset.course_id, assetId, {
      storageKey: asset.storage_key,
    });

    let sourcePath = '';
    let isTempSource = false;

    try {
      if (this.storageService.name === 'local') {
        sourcePath = resolve(this.localRoot, asset.storage_key);
      } else {
        sourcePath = join(tmpdir(), `retry-${assetId}-${Date.now()}.tmp`);
        const readStream = await this.storageService.getReadStream(asset.storage_key);
        await pipeline(readStream, createWriteStream(sourcePath));
        isTempSource = true;
      }

      // Rerun FFprobe inspection
      const videoMetadata = await this.videoProcessor.inspectVideo(sourcePath);

      // Regenerate thumbnail
      const tempThumb = join(tmpdir(), `thumb-${assetId}-${Date.now()}.jpg`);
      try {
        await this.videoProcessor.generateThumbnail(sourcePath, tempThumb);
        const thumbKey = `courses/${asset.course_id}/media/${assetId}-thumb.jpg`;
        await this.storageService.save(tempThumb, thumbKey, 'image/jpeg');
        videoMetadata.thumbnailKey = thumbKey;
      } catch (thErr: any) {
        this.logger.warn(`Retry thumbnail generation failed: ${thErr.message}`);
      } finally {
        await unlink(tempThumb).catch(() => undefined);
      }

      // Persist updated metadata and mark ready
      const readyAsset = await this.mediaRepository.markAssetReady(assetId, videoMetadata);

      await this.logAudit('MEDIA_RETRY_SUCCESS', userId, asset.course_id, assetId, {
        durationSeconds: videoMetadata.durationSeconds,
        hasAudio: videoMetadata.hasAudio,
        audioCodec: videoMetadata.audioCodec,
        width: videoMetadata.width,
        height: videoMetadata.height,
      });

      return {
        message: 'Asset successfully reprocessed and marked ready',
        asset: readyAsset,
      };
    } catch (err: any) {
      await this.mediaRepository.markAssetFailed(assetId, err.message);

      await this.logAudit('MEDIA_RETRY_FAILED', userId, asset.course_id, assetId, {
        error: err.message,
      });

      throw err;
    } finally {
      if (isTempSource) {
        await unlink(sourcePath).catch(() => undefined);
      }
    }
  }

  async getThumbnailStream(
    assetId: string,
    userId: string,
    roles: string[],
  ) {
    const asset = await this.mediaRepository.findAssetById(assetId);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const isAdmin = hasOperationsAdminRole(roles);
    if (!isAdmin && asset.owner_id !== userId) {
      // Access is by enrollment (any role that bought / was enrolled), a free preview lesson,
      // or managing the course (instructor). Not by the STUDENT role.
      const enrollRes = await this.database.query(
        `SELECT enrollment_id FROM course_enrollments
         WHERE student_id = $1 AND course_id = $2 AND enrollment_status IN ('active', 'completed')
         LIMIT 1`,
        [userId, asset.course_id],
      );
      const isEnrolled = Boolean(enrollRes.rows[0]);

      if (!isEnrolled) {
        const previewRes = await this.database.query(
          `SELECT lesson_id FROM course_lessons
           WHERE content_asset_id = $1 AND is_preview = TRUE AND is_active = TRUE
           LIMIT 1`,
          [assetId],
        );
        if (!previewRes.rows[0]) {
          const managedCourse = await this.curriculumRepository.findCourse(asset.course_id, userId, false);
          if (!managedCourse) {
            throw new ForbiddenException('Enroll in this course to access media thumbnails');
          }
        }
      }
    }

    if (!asset.thumbnail_key) {
      throw new NotFoundException('Thumbnail not available for this media asset');
    }

    const exists = await this.storageService.exists(asset.thumbnail_key);
    if (!exists) {
      throw new NotFoundException('Thumbnail file not found in storage');
    }

    const stream = await this.storageService.getReadStream(asset.thumbnail_key);
    return {
      stream,
      contentType: 'image/jpeg',
    };
  }

  private async logAudit(
    action: string,
    actorId: string,
    courseId: string | null,
    assetId: string | null,
    details: any,
  ) {
    try {
      await this.database.query(
        `INSERT INTO media_audit_logs (
           action, actor_id, course_id, lesson_id, asset_id, details
         )
         VALUES ($1, $2, $3, NULL, $4, $5)`,
        [action, actorId, courseId, assetId, JSON.stringify(details)],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to write media audit log: ${err.message}`);
    }
  }
}

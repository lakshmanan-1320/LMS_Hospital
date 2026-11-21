import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, createReadStream } from 'fs';
import { rm, rename } from 'fs/promises';
import { resolve, join, relative, basename, isAbsolute, sep } from 'path';
import { StorageService } from '../providers/storage/storage.service';
import { StorageRange } from '../providers/storage/storage.interface';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { StudentLearningRepository } from './student-learning.repository';
import { VideoProcessorService } from '../curriculum/video-processor.service';
import { CertificatesService } from '../certificates/certificates.service';


@Injectable()
export class StudentLearningService {
  private readonly logger = new Logger(StudentLearningService.name);
  private readonly localRoot: string;
  /** HLS conversions running in this process, by asset id (one FFmpeg run per video at a time). */
  private readonly hlsJobs = new Map<string, Promise<void>>();

  constructor(
    private readonly repository: StudentLearningRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly storageService: StorageService,
    private readonly videoProcessor: VideoProcessorService,
    private readonly configService: ConfigService,
    private readonly certificatesService: CertificatesService,
  ) {
    this.localRoot = resolve(
      this.configService?.get<string>('storage.localRoot') || 'private-storage',
    );
  }

  async getCourseDetails(
    idOrSlug: string,
    user: AuthenticatedUser,
  ) {

    const course = await this.repository.findPublishedCourse(idOrSlug);

    if (!course) {
      throw new NotFoundException('Course not found or not available.');
    }

    const [sections, enrollmentStatus, progressList, completionSummary] = await Promise.all([
      this.repository.listCourseSections(course.courseId),
      this.enrollmentsService.getEnrollmentStatus(course.courseId, user),
      this.repository.listCourseProgress(user.userId, course.courseId),
      this.repository.calculateCourseCompletion(user.userId, course.courseId),
    ]);

    // Build progress map for instant lookup by lessonId
    const progressMap = new Map<string, any>();
    for (const prog of progressList) {
      progressMap.set(prog.lessonId, prog);
    }

    // Merge completion status on each lesson
    const enrichedSections = sections.map((sec: any) => ({
      ...sec,
      lessons: (sec.lessons || []).map((les: any) => {
        const prog = progressMap.get(les.lessonId);
        return {
          ...les,
          isCompleted: Boolean(prog?.isCompleted),
          lastPositionSeconds: prog?.lastPositionSeconds || 0,
        };
      }),
    }));

    if (completionSummary?.isCourseCompleted) {
      this.certificatesService
        .issueCourseCompletionCertificate(user.userId, course.courseId)
        .catch((err) => {
          this.logger.debug(
            `Background certificate sync for user ${user.userId}, course ${course.courseId}: ${err.message}`,
          );
        });
    }

    return {
      course,
      sections: enrichedSections,
      enrollment: {
        isEnrolled: enrollmentStatus.isEnrolled,
        // The course's own instructor previews it (Udemy-style) without enrolling; progress isn't tracked.
        isOwner: Boolean(enrollmentStatus.isOwner),
      },
      progress: completionSummary,
    };
  }

  async getPublicCourseDetails(idOrSlug: string) {
    const course = await this.repository.findPublishedCourse(idOrSlug);

    if (!course) {
      throw new NotFoundException('Course not found or not available.');
    }

    const sections = await this.repository.listCourseSections(
      course.courseId,
    );

    return {
      course,
      sections,
    };
  }

  async getLessonForLearning(
    lessonId: string,
    user: AuthenticatedUser,
  ) {

    const lesson = await this.repository.findLessonForLearning(lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException(
        'Enroll in this course to access this lesson.',
      );
    }

    const [progress, completion] = await Promise.all([
      this.repository.getLessonProgress(user.userId, lessonId),
      this.repository.calculateCourseCompletion(user.userId, lesson.courseId),
    ]);

    if (lesson.lessonType === 'text') {
      return {
        lesson: {
          lessonId: lesson.lessonId,
          courseId: lesson.courseId,
          title: lesson.title,
          description: lesson.description,
          lessonType: lesson.lessonType,
          contentText: lesson.contentText,
          durationSeconds: lesson.durationSeconds,
          isPreview: lesson.isPreview,
        },
        media: null,
        progress: {
          lastPositionSeconds: progress?.last_position_seconds || 0,
          isCompleted: Boolean(progress?.is_completed),
          completedAt: progress?.completed_at || null,
        },
        courseProgress: completion,
      };
    }

    if (!lesson.assetId) {
      throw new NotFoundException('Lesson content is not available.');
    }

    if (
      lesson.visibility !== 'private' ||
      lesson.processingStatus !== 'ready'
    ) {
      throw new NotFoundException('Lesson media is not ready for playback.');
    }

    return {
      lesson: {
        lessonId: lesson.lessonId,
        courseId: lesson.courseId,
        title: lesson.title,
        description: lesson.description,
        lessonType: lesson.lessonType,
        durationSeconds: lesson.durationSeconds,
        isPreview: lesson.isPreview,
      },
      media: {
        assetId: lesson.assetId,
        assetType: lesson.assetType,
        mimeType: lesson.mimeType,
        fileSizeBytes: lesson.fileSizeBytes,
        hasAudio: lesson.hasAudio ?? true,
        audioCodec: lesson.audioCodec ?? null,
        thumbnailKey: lesson.thumbnailKey ?? null,
        hlsSupported: true,
        // When false the player streams the MP4 directly; HLS is prepared in the background.
        hlsReady: this.prepareHls(lesson),
      },
      progress: {
        lastPositionSeconds: progress?.last_position_seconds || 0,
        isCompleted: Boolean(progress?.is_completed),
        completedAt: progress?.completed_at || null,
      },
      courseProgress: completion,
    };
  }

  async getLessonMediaMetadata(lessonId: string, user: AuthenticatedUser) {

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException('Enroll in this course to access this lesson.');
    }

    return {
      mimeType: lesson.mimeType || 'video/mp4',
      fileSize: Number(lesson.fileSizeBytes) || 0,
      durationSeconds: lesson.durationSeconds,
      hasAudio: lesson.hasAudio ?? true,
      audioCodec: lesson.audioCodec ?? null,
    };
  }

  async getLessonMediaStream(
    lessonId: string,
    user: AuthenticatedUser,
    rangeHeader?: string,
  ) {

    const lesson =
      await this.repository.findLessonForLearning(lessonId);

    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException(
        'Enroll in this course to access this lesson.',
      );
    }

    return this.streamLessonAsset(lesson, rangeHeader);
  }

  /**
   * Public (guest) preview of a lesson marked as a free preview on a published course.
   * Only preview lessons are ever served here; everything else requires enrollment.
   */
  async getPreviewLessonMediaStream(lessonId: string, rangeHeader?: string) {
    const lesson = await this.findPreviewLessonOrFail(lessonId);
    return this.streamLessonAsset(lesson, rangeHeader);
  }

  async getPreviewLessonMediaMetadata(lessonId: string) {
    const lesson = await this.findPreviewLessonOrFail(lessonId);
    return {
      mimeType: lesson.mimeType || 'video/mp4',
      fileSize: Number(lesson.fileSizeBytes) || 0,
      durationSeconds: lesson.durationSeconds,
    };
  }

  private async findPreviewLessonOrFail(lessonId: string) {
    // findLessonForLearning only returns active lessons of published courses.
    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson || !lesson.isPreview) {
      throw new NotFoundException('Preview not available.');
    }
    return lesson;
  }

  /** Validates the lesson's stored file and streams it (with HTTP range support). */
  private async streamLessonAsset(lesson: any, rangeHeader?: string) {
    if (
      !lesson.assetId ||
      lesson.visibility !== 'private' ||
      lesson.processingStatus !== 'ready'
    ) {
      throw new NotFoundException('Lesson media is not available.');
    }

    if (
      (lesson.lessonType === 'video' && lesson.assetType !== 'video') ||
      (lesson.lessonType === 'document' &&
        lesson.assetType !== 'document')
    ) {
      throw new NotFoundException('Lesson media is not available.');
    }

    if (lesson.storageProvider !== this.storageService.name) {
      throw new NotFoundException('Lesson media is not available.');
    }

    const fileSize = Number(lesson.fileSizeBytes);

    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      throw new NotFoundException('Lesson media is not available.');
    }

    let range: StorageRange | undefined;

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());

      if (!match || (!match[1] && !match[2])) {
        throw new HttpException(
          {
            statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
            message: 'Requested media range is not satisfiable.',
          },
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }

      let start: number;
      let end: number;

      if (!match[1]) {
        const suffixLength = Number(match[2]);

        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
          throw new HttpException(
            {
              statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
              message: 'Requested media range is not satisfiable.',
            },
            HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
          );
        }

        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : fileSize - 1;
      }

      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= fileSize ||
        end < start
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
            message: 'Requested media range is not satisfiable.',
          },
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }

      range = {
        start,
        end: Math.min(end, fileSize - 1),
      };
    }

    const exists = await this.storageService.exists(
      lesson.storageKey,
    );

    if (!exists) {
      throw new NotFoundException('Stored media file not found.');
    }

    const stream = await this.storageService.getReadStream(
      lesson.storageKey,
      range,
    );

    return {
      stream,
      mimeType: lesson.mimeType,
      fileSize,
      range,
    };
  }

  async getLessonHlsFile(
    lessonId: string,
    fileName: string,
    user: AuthenticatedUser,
  ) {

    // Strict validation: permit only valid HLS playlist or segment names
    if (!fileName || typeof fileName !== 'string') {
      throw new BadRequestException('Filename must be provided');
    }

    const cleanFileName = basename(fileName.trim());
    if (
      cleanFileName !== fileName ||
      fileName.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      !/^(master\.m3u8|segment_\d+\.ts)$/i.test(fileName)
    ) {
      throw new BadRequestException('Invalid or forbidden HLS file request');
    }

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException('Enroll in this course to access this lesson.');
    }

    if (lesson.storageProvider !== 'local') {
      throw new BadRequestException('HLS streaming is currently optimized for local private storage');
    }

    const { hlsDir } = this.hlsPaths(lesson);

    // Verify resolved path stays strictly inside hlsDir
    const requestedFilePath = resolve(hlsDir, fileName);
    const rel = relative(hlsDir, requestedFilePath);
    if (!rel || rel.startsWith('..') || rel.includes(sep) || isAbsolute(rel)) {
      throw new BadRequestException('Path traversal attempt detected');
    }

    // Converting a video can take minutes, far longer than a request may wait (proxies cut off
    // around 60s). Start it in the background and answer at once; the player uses the MP4 meanwhile.
    if (!this.prepareHls(lesson)) {
      throw new NotFoundException('HLS stream is being prepared. Use the MP4 stream for now.');
    }

    if (!existsSync(requestedFilePath)) {
      throw new NotFoundException(`HLS file "${fileName}" not found`);
    }

    const contentType = fileName.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : fileName.endsWith('.ts')
      ? 'video/mp2t'
      : 'application/octet-stream';

    const stream = createReadStream(requestedFilePath);
    return {
      stream,
      contentType,
    };
  }

  async saveLessonProgress(
    lessonId: string,
    user: AuthenticatedUser,
    positionSeconds: number,
    _clientDurationSeconds?: number,
    sessionId?: string,
  ) {

    if (
      typeof positionSeconds !== 'number' ||
      !Number.isFinite(positionSeconds) ||
      positionSeconds < 0
    ) {
      throw new BadRequestException('Playback position must be a non-negative finite number');
    }

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    // Only enrolled learners (any role) can record progress / completion.
    await this.assertEnrolled(lesson.courseId, user);

    // Server-side authority: fetch actual duration from PostgreSQL, ignoring client-submitted duration
    const actualDuration = Number(lesson.durationSeconds) || 0;

    // Cap position at actual duration to prevent out-of-bounds inflation
    const safePosition = actualDuration > 0
      ? Math.min(Math.floor(positionSeconds), actualDuration)
      : Math.max(0, Math.floor(positionSeconds));

    // Retrieve previous progress record for this student and lesson
    const existing = await this.repository.getLessonProgress(user.userId, lessonId);
    const prevPosition = existing ? Number(existing.last_position_seconds) || 0 : 0;
    const prevMaxWatched = existing ? Number(existing.max_watched_seconds) || 0 : 0;
    const wasCompleted = Boolean(existing && existing.is_completed);
    const lastUpdatedAt = existing && existing.updated_at ? new Date(existing.updated_at).getTime() : 0;

    // Calculate server-side elapsed wall-clock time
    const now = Date.now();
    const elapsedSeconds = lastUpdatedAt > 0 ? Math.max(0, (now - lastUpdatedAt) / 1000) : 15;

    // Determine plausible advancement based on elapsed time and reasonable playback speed (up to 2.5x + 5s network jitter)
    const maxPlausibleAdvancement = Math.max(5, Math.ceil(elapsedSeconds * 2.5) + 5);
    const deltaPlayback = safePosition - prevPosition;

    let newMaxWatched = prevMaxWatched;
    let incrementalAdvancement = 0;

    if (deltaPlayback > 0) {
      if (deltaPlayback <= maxPlausibleAdvancement) {
        // Continuous playback within plausible window
        incrementalAdvancement = deltaPlayback;
        newMaxWatched = Math.min(actualDuration, prevMaxWatched + deltaPlayback);
      } else {
        // Forward jump / seek detected: student sought ahead
        // Advance maxWatched by at most the plausible time watched in this interval
        incrementalAdvancement = Math.min(deltaPlayback, maxPlausibleAdvancement);
        newMaxWatched = Math.min(actualDuration, prevMaxWatched + maxPlausibleAdvancement);
      }
    }
    // If deltaPlayback <= 0 (rewind or out-of-order heartbeat), newMaxWatched is preserved and does not decrease

    // Auto-mark completed strictly when verified cumulative watched time reaches >= 90% of actual duration
    const isCompleted = wasCompleted || (actualDuration > 0 && newMaxWatched >= Math.floor(actualDuration * 0.9));

    const progress = await this.repository.upsertLessonProgress({
      studentId: user.userId,
      courseId: lesson.courseId,
      lessonId,
      lastPositionSeconds: safePosition,
      maxWatchedSeconds: newMaxWatched,
      isCompleted,
    });

    // Record session learning activity if incremental playback occurred
    if (incrementalAdvancement > 0) {
      const rawSessionId = sessionId?.trim() || `sess_${Date.now()}_${user.userId.replace(/-/g, '').substring(0, 16)}`;
      const effectiveSessionId = rawSessionId.substring(0, 64);
      await this.repository.recordLearningSession({
        studentId: user.userId,
        courseId: lesson.courseId,
        lessonId,
        sessionId: effectiveSessionId,
        incrementalSeconds: Math.round(incrementalAdvancement),
      }).catch((err) => {
        this.logger.warn(`Failed to record learning session: ${err.message}`);
      });
    }

    const courseCompletion = await this.repository.calculateCourseCompletion(
      user.userId,
      lesson.courseId,
    );

    // Synchronize course completion status if all required lessons are completed
    if (courseCompletion.isCourseCompleted) {
      await this.repository.syncCourseEnrollmentCompletion(
        user.userId,
        lesson.courseId,
        true,
      );
      try {
        await this.certificatesService.issueCourseCompletionCertificate(
          user.userId,
          lesson.courseId,
        );
      } catch (certErr: any) {
        this.logger.warn(`Failed auto-issuing certificate for student ${user.userId}: ${certErr?.message}`);
      }
    }

    return {
      success: true,
      progress: {
        lessonId,
        lastPositionSeconds: progress.last_position_seconds,
        maxWatchedSeconds: progress.max_watched_seconds,
        isCompleted: progress.is_completed,
        completedAt: progress.completed_at,
      },
      courseCompletion,
    };
  }

  async completeLesson(lessonId: string, user: AuthenticatedUser) {

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    // Only enrolled learners (any role) can record progress / completion.
    await this.assertEnrolled(lesson.courseId, user);

    const progress = await this.repository.markLessonCompleted(
      user.userId,
      lesson.courseId,
      lessonId,
    );

    const courseCompletion = await this.repository.calculateCourseCompletion(
      user.userId,
      lesson.courseId,
    );

    // Synchronize course completion status if all required lessons are completed
    if (courseCompletion.isCourseCompleted) {
      await this.repository.syncCourseEnrollmentCompletion(
        user.userId,
        lesson.courseId,
        true,
      );
      try {
        await this.certificatesService.issueCourseCompletionCertificate(
          user.userId,
          lesson.courseId,
        );
      } catch (certErr: any) {
        this.logger.warn(`Failed auto-issuing certificate for student ${user.userId}: ${certErr?.message}`);
      }
    }

    return {
      success: true,
      message: 'Lesson marked as completed',
      progress: {
        lessonId,
        isCompleted: true,
        completedAt: progress.completed_at,
      },
      courseCompletion,
    };
  }

  async getCourseProgressSummary(idOrSlug: string, user: AuthenticatedUser) {
    const course = await this.repository.findPublishedCourse(idOrSlug);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return this.repository.calculateCourseCompletion(user.userId, course.courseId);
  }

  async getStudentActivity(user: AuthenticatedUser, days = 7) {
    return this.repository.getDailyActivityHistory(user.userId, days);
  }

  async getLessonResources(lessonId: string, user: AuthenticatedUser) {

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException('Enroll in this course to access resources.');
    }

    return this.repository.listLessonResources(lessonId);
  }

  async downloadLessonResource(
    lessonId: string,
    resourceId: string,
    user: AuthenticatedUser,
  ) {

    const lesson = await this.repository.findLessonForLearning(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found or not available.');
    }

    const canLearn = await this.hasLearningAccess(lesson.courseId, user);

    if (!canLearn && !lesson.isPreview) {
      throw new ForbiddenException('Enroll in this course to download resources.');
    }

    const resource = await this.repository.findLessonResourceForDownload(
      lessonId,
      resourceId,
    );

    if (!resource) {
      throw new NotFoundException('Resource not found or not available.');
    }

    const exists = await this.storageService.exists(resource.storageKey);
    if (!exists) {
      throw new NotFoundException('Resource file not found in storage.');
    }

    const stream = await this.storageService.getReadStream(resource.storageKey);

    return {
      stream,
      fileName: resource.fileName || resource.title || 'resource',
      mimeType: resource.mimeType || 'application/octet-stream',
      fileSizeBytes: Number(resource.fileSizeBytes) || 0,
    };
  }

  private hlsPaths(lesson: any) {
    return {
      source: resolve(this.localRoot, lesson.storageKey),
      hlsDir: resolve(this.localRoot, `courses/${lesson.courseId}/media/${lesson.assetId}-hls`),
    };
  }

  /**
   * True when the lesson's HLS stream is complete. Otherwise starts the conversion in the
   * background (once per video) and returns false. The output is written to a temporary folder
   * and renamed only when FFmpeg finishes, so a half-written playlist is never served.
   */
  private prepareHls(lesson: any): boolean {
    if (lesson.lessonType !== 'video' || !lesson.assetId || lesson.storageProvider !== 'local') return false;
    const { source, hlsDir } = this.hlsPaths(lesson);
    if (existsSync(join(hlsDir, 'master.m3u8'))) return true;
    if (this.hlsJobs.has(lesson.assetId) || !existsSync(source)) return false;

    const tmpDir = `${hlsDir}.tmp`;
    const job = (async () => {
      await rm(tmpDir, { recursive: true, force: true });
      await this.videoProcessor.generateHls(source, tmpDir, lesson.hasAudio ?? true);
      await rm(hlsDir, { recursive: true, force: true });
      await rename(tmpDir, hlsDir);
      this.logger.log(`HLS ready for asset ${lesson.assetId}`);
    })()
      .catch(async (err) => {
        this.logger.error(`HLS generation failed for asset ${lesson.assetId}: ${err?.message || err}`);
        await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      })
      .finally(() => this.hlsJobs.delete(lesson.assetId));

    this.hlsJobs.set(lesson.assetId, job);
    this.logger.log(`Preparing HLS in the background for asset ${lesson.assetId}`);
    return false;
  }

  /**
   * Who can open a course's lessons, media and resources: enrolled learners, and the course's own
   * instructor (instructor preview, like Udemy: owners can't buy their course but can view it).
   */
  private async hasLearningAccess(courseId: string, user: AuthenticatedUser): Promise<boolean> {
    const { isEnrolled, isOwner } = await this.enrollmentsService.getEnrollmentStatus(courseId, user);
    return isEnrolled || isOwner;
  }

  /**
   * Course access is based on enrollment, not role: a STUDENT, INSTRUCTOR, ADMIN or SUPER_ADMIN
   * who bought (or was enrolled in) a course can learn it; nobody else can.
   */
  private async assertEnrolled(courseId: string, user: AuthenticatedUser): Promise<void> {
    const { isEnrolled } = await this.enrollmentsService.getEnrollmentStatus(courseId, user);
    if (!isEnrolled) {
      throw new ForbiddenException('Enroll in this course to track progress.');
    }
  }
}

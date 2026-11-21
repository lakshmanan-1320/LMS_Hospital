import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ReplacementRequestRepository } from './replacement-request.repository';
import { CurriculumRepository } from './curriculum.repository';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { CreateReplacementRequestDto } from './dto/create-replacement-request.dto';
import { ReviewReplacementRequestDto } from './dto/review-replacement-request.dto';
import { DatabaseService } from '../database/database.service';
import { hasOperationsAdminRole } from '../common/policies/operations.policy';

@Injectable()
export class ReplacementRequestService {
  private readonly logger = new Logger(ReplacementRequestService.name);

  constructor(
    private readonly replacementRepo: ReplacementRequestRepository,
    private readonly curriculumRepo: CurriculumRepository,
    private readonly mediaRepo: MediaRepository,
    private readonly mediaService: MediaService,
    private readonly database: DatabaseService,
  ) {}

  async createRequest(
    courseId: string,
    lessonId: string,
    userId: string,
    roles: string[],
    dto: CreateReplacementRequestDto,
  ) {
    const isAdmin = hasOperationsAdminRole(roles);
    const course = await this.curriculumRepo.findCourse(courseId, userId, isAdmin);

    if (!course) {
      throw new NotFoundException('Course not found or access denied');
    }

    if (course.status !== 'published') {
      throw new BadRequestException(
        `Replacement requests are only for published courses. Current course status is "${course.status}". Edit directly in draft status.`,
      );
    }

    const lesson = await this.curriculumRepo.findLesson(lessonId);
    if (!lesson || lesson.course_id !== courseId) {
      throw new NotFoundException('Lesson not found for this course');
    }

    if (lesson.lesson_type !== 'video') {
      throw new BadRequestException('Replacement requests can only be made for video lessons');
    }

    const existingActive = await this.replacementRepo.findActiveByLesson(lessonId);
    if (existingActive) {
      throw new ConflictException(
        `An active replacement request (${existingActive.status}) already exists for this lesson.`,
      );
    }

    const request = await this.replacementRepo.create({
      courseId,
      lessonId,
      instructorId: course.instructor_id || userId,
      currentAssetId: lesson.content_asset_id,
      reason: dto.reason,
    });

    await this.logAudit('REPLACEMENT_REQUESTED', userId, courseId, lessonId, lesson.content_asset_id, {
      requestId: request.request_id,
      reason: dto.reason,
    });

    this.logger.log(`Replacement request created: ${request.request_id} for lesson: ${lessonId}`);
    return request;
  }

  async listInstructorRequests(userId: string) {
    return this.replacementRepo.listByInstructor(userId);
  }

  async listAdminRequests(statusFilter?: string) {
    return this.replacementRepo.listAllAdmin(statusFilter);
  }

  async getRequest(requestId: string, userId: string, roles: string[]) {
    const request = await this.replacementRepo.findById(requestId);
    if (!request) {
      throw new NotFoundException('Replacement request not found');
    }

    const isAdmin = hasOperationsAdminRole(roles);
    if (!isAdmin && request.instructor_id !== userId) {
      throw new ForbiddenException('Access denied to this replacement request');
    }

    return request;
  }

  async reviewRequest(
    requestId: string,
    adminId: string,
    dto: ReviewReplacementRequestDto,
  ) {
    const request = await this.replacementRepo.findById(requestId);
    if (!request) {
      throw new NotFoundException('Replacement request not found');
    }

    if (request.status !== 'pending') {
      throw new ConflictException(`Request is already in "${request.status}" status`);
    }

    const updated = await this.replacementRepo.updateReview(
      requestId,
      dto.status,
      adminId,
      dto.comment,
    );

    const action = dto.status === 'approved' ? 'REPLACEMENT_APPROVED' : 'REPLACEMENT_REJECTED';
    await this.logAudit(action, adminId, request.course_id, request.lesson_id, request.current_asset_id, {
      requestId,
      comment: dto.comment,
    });

    this.logger.log(`Replacement request ${requestId} was ${dto.status} by admin ${adminId}`);
    return updated;
  }

  async uploadReplacement(
    requestId: string,
    file: Express.Multer.File,
    userId: string,
    roles: string[],
  ) {
    const request = await this.getRequest(requestId, userId, roles);

    if (request.status !== 'approved') {
      throw new BadRequestException(
        `Upload not permitted. Request status is "${request.status}". Only approved requests permit replacement upload.`,
      );
    }

    // Upload with approved replacement bypass flag
    const asset = await this.mediaService.upload(
      file,
      request.course_id,
      userId,
      roles,
      true, // isApprovedReplacement
    );

    await this.replacementRepo.attachReplacementAsset(requestId, asset.asset_id);

    await this.logAudit('REPLACEMENT_UPLOADED', userId, request.course_id, request.lesson_id, asset.asset_id, {
      requestId,
    });

    return {
      message: 'Replacement video uploaded successfully and validated',
      asset,
      requestId,
    };
  }

  async applyReplacement(
    requestId: string,
    userId: string,
    roles: string[],
  ) {
    const request = await this.getRequest(requestId, userId, roles);

    if (request.status !== 'approved') {
      throw new BadRequestException(
        `Cannot apply replacement. Request must be in "approved" status (current: "${request.status}").`,
      );
    }

    if (!request.replacement_asset_id) {
      throw new BadRequestException(
        'No replacement video asset has been uploaded for this request yet.',
      );
    }

    const replAsset = await this.mediaRepo.findAssetById(request.replacement_asset_id);
    if (!replAsset) {
      throw new NotFoundException('Replacement asset not found in storage');
    }

    if (replAsset.asset_type !== 'video') {
      throw new BadRequestException('Replacement asset must be a video');
    }

    if (replAsset.processing_status !== 'ready') {
      throw new BadRequestException(
        `Replacement video is not ready for playback (status: "${replAsset.processing_status}")`,
      );
    }

    if (replAsset.course_id !== request.course_id) {
      throw new BadRequestException('Replacement asset does not belong to the target course');
    }

    const result = await this.replacementRepo.applyReplacementInTransaction({
      requestId,
      lessonId: request.lesson_id,
      courseId: request.course_id,
      replacementAssetId: replAsset.asset_id,
      durationSeconds: replAsset.duration_seconds || 0,
      actorId: userId,
    });

    this.logger.log(
      `Replacement request ${requestId} applied successfully for lesson ${request.lesson_id}. New asset: ${replAsset.asset_id}`,
    );

    return {
      message: 'Lesson video successfully replaced with the validated audio-enabled asset',
      lessonId: request.lesson_id,
      newAssetId: replAsset.asset_id,
      durationSeconds: replAsset.duration_seconds,
    };
  }

  private async logAudit(
    action: string,
    actorId: string,
    courseId: string,
    lessonId: string,
    assetId: string | null,
    details: any,
  ) {
    try {
      await this.database.query(
        `INSERT INTO media_audit_logs (
           action, actor_id, course_id, lesson_id, asset_id, details
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [action, actorId, courseId, lessonId, assetId, JSON.stringify(details)],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to write media audit log: ${err.message}`);
    }
  }
}

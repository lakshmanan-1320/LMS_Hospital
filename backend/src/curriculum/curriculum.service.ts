
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { CurriculumRepository } from './curriculum.repository';
import { DatabaseService } from '../database/database.service';

import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { hasOperationsAdminRole } from '../common/policies/operations.policy';

/**
 * Curriculum can be modified in draft, rejected, or published status.
 */
const EDITABLE_STATUSES = ['draft', 'rejected', 'published'];

@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(
    private readonly repository: CurriculumRepository,
    private readonly database: DatabaseService,
  ) {}

  /**
   * Only ADMIN and SUPER_ADMIN can access all courses.
   * INSTRUCTOR can access only their own courses.
   */
  private isAdmin(roles: string[]): boolean {
    return hasOperationsAdminRole(roles);
  }

  private async logAudit(
    action: string,
    actorId: string,
    courseId: string,
    lessonId: string | null,
    assetId: string | null,
    details: any,
  ) {
    try {
      await this.database.query(
        `INSERT INTO media_audit_logs (action, actor_id, course_id, lesson_id, asset_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [action, actorId, courseId, lessonId, assetId, JSON.stringify(details)],
      );
    } catch (err: any) {
      this.logger.warn(`Failed to write curriculum audit log: ${err.message}`);
    }
  }

  /**
   * List courses accessible to the current user.
   */
  async listCourses(userId: string, roles: string[]) {
    return this.repository.listCourses(
      userId,
      this.isAdmin(roles),
    );
  }

  /**
   * Verify that the user owns the course or is an Admin.
   *
   * This method permits reading published and archived courses.
   */
  private async getAccessibleCourse(
    courseId: string,
    userId: string,
    roles: string[],
  ) {
    const course = await this.repository.findCourse(
      courseId,
      userId,
      this.isAdmin(roles),
    );

    if (!course) {
      throw new NotFoundException(
        'Course not found or access denied',
      );
    }

    return course;
  }

  /**
   * Verify course access before curriculum operations.
   *
   * When forWrite is true, only draft and rejected courses
   * can be modified.
   */
  async verifyCourseAccess(
    courseId: string,
    userId: string,
    roles: string[],
    forWrite = false,
  ) {
    const course = await this.getAccessibleCourse(
      courseId,
      userId,
      roles,
    );

    if (
      forWrite &&
      !EDITABLE_STATUSES.includes(course.status)
    ) {
      throw new ConflictException(
        `Curriculum is locked while the course is "${course.status}". Only draft or rejected courses can be edited.`,
      );
    }

    return course;
  }

  /**
   * Convert duplicate ordering errors into HTTP 409.
   */
  private async withOrderConflict<T>(
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(
          'Another item already uses this position. Choose a different sort order.',
        );
      }

      throw err;
    }
  }

  /**
   * Verify that the content asset belongs to the same course
   * and matches the lesson type.
   */
  private async assertContentAsset(
    courseId: string,
    lessonType: string | undefined,
    assetId: string | null | undefined,
  ) {
    if (!assetId) {
      return;
    }

    const asset = await this.repository.findCourseAsset(
      assetId,
      courseId,
    );

    if (!asset) {
      throw new BadRequestException(
        'Content asset not found for this course',
      );
    }

    if (
      lessonType &&
      lessonType !== 'text' &&
      asset.asset_type !== lessonType
    ) {
      throw new BadRequestException(
        `A ${lessonType} lesson needs a ${lessonType} asset (got ${asset.asset_type})`,
      );
    }
  }

  /**
   * Get curriculum for an accessible course.
   * Published and archived courses can be viewed.
   */
  async getCurriculum(
    courseId: string,
    userId: string,
    roles: string[],
  ) {
    await this.getAccessibleCourse(
      courseId,
      userId,
      roles,
    );

    return this.repository.listSections(courseId);
  }

  /**
   * Create a section.
   */
  async createSection(
    courseId: string,
    userId: string,
    roles: string[],
    dto: CreateSectionDto,
  ) {
    await this.verifyCourseAccess(
      courseId,
      userId,
      roles,
      true,
    );

    return this.withOrderConflict(() =>
      this.repository.createSection(courseId, dto),
    );
  }

  /**
   * Update a section.
   */
  async updateSection(
    sectionId: string,
    userId: string,
    roles: string[],
    dto: UpdateSectionDto,
  ) {
    const section = await this.repository.findSection(
      sectionId,
    );

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    await this.verifyCourseAccess(
      section.course_id,
      userId,
      roles,
      true,
    );

    const updated = await this.withOrderConflict(() =>
      this.repository.updateSection(sectionId, dto),
    );

    if (!updated) {
      throw new BadRequestException(
        'No changes provided',
      );
    }

    return updated;
  }

  /**
   * Delete a section.
   */
  async deleteSection(
    sectionId: string,
    userId: string,
    roles: string[],
  ) {
    const section = await this.repository.findSection(
      sectionId,
    );

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const course = await this.verifyCourseAccess(
      section.course_id,
      userId,
      roles,
      true,
    );

    const progressCount = await this.repository.countSectionProgress(sectionId);
    await this.repository.deactivateSection(sectionId);

    await this.logAudit(
      'SECTION_DEACTIVATED',
      userId,
      section.course_id,
      null,
      null,
      { sectionId, courseStatus: course.status, studentProgressRecords: progressCount },
    );

    return {
      message: 'Section deleted successfully',
      studentProgressPreserved: progressCount > 0,
    };
  }

  /**
   * Create a lesson.
   */
  async createLesson(
    sectionId: string,
    userId: string,
    roles: string[],
    dto: CreateLessonDto,
  ) {
    const section = await this.repository.findSection(
      sectionId,
    );

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const course = await this.verifyCourseAccess(
      section.course_id,
      userId,
      roles,
      true,
    );

    await this.assertContentAsset(
      section.course_id,
      dto.lessonType,
      dto.contentAssetId,
    );

    const lesson = await this.withOrderConflict(() =>
      this.repository.createLesson(
        sectionId,
        section.course_id,
        dto,
      ),
    );

    await this.logAudit(
      'LESSON_CREATED',
      userId,
      section.course_id,
      lesson.lesson_id,
      dto.contentAssetId ?? null,
      { title: dto.title, courseStatus: course.status },
    );

    return lesson;
  }

  /**
   * Update a lesson.
   */
  async updateLesson(
    lessonId: string,
    userId: string,
    roles: string[],
    dto: UpdateLessonDto,
  ) {
    const lesson = await this.repository.findLesson(
      lessonId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const course = await this.verifyCourseAccess(
      lesson.course_id,
      userId,
      roles,
      true,
    );

    // Safeguard: On published courses, replacing an existing video directly without approval is blocked
    const isAdmin = this.isAdmin(roles);
    if (
      course.status === 'published' &&
      !isAdmin &&
      dto.contentAssetId &&
      lesson.content_asset_id &&
      dto.contentAssetId !== lesson.content_asset_id
    ) {
      throw new BadRequestException(
        'Replacing an existing published video requires Admin approval via the replacement request workflow.',
      );
    }

    await this.assertContentAsset(
      lesson.course_id,
      dto.lessonType ?? lesson.lesson_type,
      dto.contentAssetId,
    );

    const updated = await this.withOrderConflict(() =>
      this.repository.updateLesson(lessonId, dto),
    );

    if (!updated) {
      throw new BadRequestException(
        'No changes provided',
      );
    }

    if (course.status === 'published') {
      await this.logAudit(
        'LESSON_UPDATED_POST_PUBLICATION',
        userId,
        lesson.course_id,
        lessonId,
        dto.contentAssetId ?? null,
        { updatedFields: Object.keys(dto) },
      );
    }

    return updated;
  }

  /**
   * Delete a lesson.
   */
  async deleteLesson(
    lessonId: string,
    userId: string,
    roles: string[],
  ) {
    const lesson = await this.repository.findLesson(
      lessonId,
    );

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const course = await this.verifyCourseAccess(
      lesson.course_id,
      userId,
      roles,
      true,
    );

    const progressCount = await this.repository.countLessonProgress(lessonId);
    await this.repository.deactivateLesson(lessonId);

    await this.logAudit(
      'LESSON_DEACTIVATED',
      userId,
      lesson.course_id,
      lessonId,
      lesson.content_asset_id,
      { courseStatus: course.status, studentProgressRecords: progressCount },
    );

    return {
      message: 'Lesson deleted successfully',
      studentProgressPreserved: progressCount > 0,
    };
  }

  /**
   * Reorder sections of a course.
   */
  async reorderSections(
    courseId: string,
    userId: string,
    roles: string[],
    sectionIds: string[],
  ) {
    await this.verifyCourseAccess(
      courseId,
      userId,
      roles,
      true,
    );

    const updated = await this.repository.reorderSections(courseId, sectionIds);

    await this.logAudit(
      'SECTIONS_REORDERED',
      userId,
      courseId,
      null,
      null,
      { sectionIds },
    );

    return updated;
  }

  /**
   * Reorder lessons within a section.
   */
  async reorderLessons(
    sectionId: string,
    userId: string,
    roles: string[],
    lessonIds: string[],
  ) {
    const section = await this.repository.findSection(sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    await this.verifyCourseAccess(
      section.course_id,
      userId,
      roles,
      true,
    );

    await this.repository.reorderLessons(sectionId, lessonIds);

    await this.logAudit(
      'LESSONS_REORDERED',
      userId,
      section.course_id,
      null,
      null,
      { sectionId, lessonIds },
    );

    return {
      message: 'Lessons reordered successfully',
    };
  }
}

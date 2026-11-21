import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { unlink } from 'fs/promises';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { CoursesRepository } from './courses.repository';
import { CourseBadgesService } from './course-badges.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { QueryCourseDto } from './dto/query-course.dto';
import {
  CreateCourseLanguageDto,
  UpdateCourseLanguageDto,
} from './dto/course-language.dto';
import {
  CourseRow,
  CourseDetailResponse,
  CourseChecklistResponse,
  CourseStatsResponse,
  CourseLanguageRow,
} from './interfaces/course.interface';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly coursesRepository: CoursesRepository,
    private readonly databaseService: DatabaseService,
    private readonly courseBadges: CourseBadgesService,
  ) {}

  /**
   * Delete a retired promo file from uploads/videos. Called only after the DB change is committed.
   * basename() blocks path traversal; a failed delete is logged, never thrown (DB is the source of truth).
   */
  private async deletePromoFile(storageKey: string | null): Promise<void> {
    if (!storageKey) return;
    const filePath = path.join(process.cwd(), 'uploads', 'videos', path.basename(storageKey));
    await unlink(filePath).catch((err) => {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`Could not delete retired promo file ${storageKey}: ${err?.message}`);
      }
    });
  }

  /** Resolve a submitted language (name or code) to its active name; 400 if unknown/inactive. */
  private async resolveLanguage(value: string): Promise<string> {
    const language = await this.coursesRepository.findActiveLanguage(value);
    if (!language) {
      throw new BadRequestException(`Language "${value}" is not an active course language`);
    }
    return language.name;
  }

  /**
   * Convert title to a clean URL slug satisfying:
   * CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
   * Trims to max 200 characters.
   */
  private slugify(title: string): string {
    const clean = (title || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accent marks
      .replace(/[^a-z0-9]+/g, '-')     // replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '')         // trim leading/trailing hyphens
      .substring(0, 200);

    if (!clean || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(clean)) {
      return `course-${Date.now()}`;
    }
    return clean;
  }

  /**
   * 1. CREATE DRAFT COURSE
   */
  async createCourse(
    dto: CreateCourseDto,
    userId: string,
  ): Promise<CourseRow> {
    const trimmedTitle = dto.title.trim();

    // 1. Verify category exists and is active if provided
    if (dto.categoryId) {
      const category = await this.coursesRepository.getCategory(dto.categoryId);
      if (!category || !category.is_active) {
        throw new BadRequestException('Category not found or inactive');
      }
    }

    // 2. Generate base slug
    const baseSlug = this.slugify(trimmedTitle);
    let currentSlug = baseSlug;
    let attempts = 0;

    while (attempts <= 5) {
      try {
        const slugToTry = currentSlug;
        const course = await this.databaseService.withTransaction(async (client) => {
          const created = await this.coursesRepository.create(
            {
              instructorId: userId,
              title: trimmedTitle,
              slug: slugToTry,
              categoryId: dto.categoryId || null,
            },
            client,
          );

          // Audit trail starts at creation (null -> draft)
          await this.coursesRepository.insertStatusHistory(
            {
              courseId: created.course_id,
              fromStatus: null,
              toStatus: 'draft',
              changedBy: userId,
              note: 'Course created',
            },
            client,
          );

          return created;
        });
        return course;
      } catch (err: any) {
        // Postgres unique violation code 23505 on courses_slug_key
        if (err?.code === '23505' && (err?.constraint === 'courses_slug_key' || String(err?.detail).includes('slug'))) {
          attempts++;
          if (attempts <= 5) {
            currentSlug = `${baseSlug}-${attempts + 1}`;
          } else {
            const randomSuffix = crypto.randomBytes(3).toString('hex');
            currentSlug = `${baseSlug}-${randomSuffix}`;
          }
          continue;
        }

        // Postgres check violation code 23514
        if (err?.code === '23514') {
          throw new BadRequestException(`Validation error: ${err.message || 'Check constraint failed'}`);
        }

        throw err;
      }
    }

    throw new ConflictException('Unable to generate unique slug for course title. Please modify title.');
  }

  /**
   * 2. GET INSTRUCTOR OWN COURSES (Paginated, filtered)
   */
  async getMyCourses(instructorId: string, query: QueryCourseDto) {
    return this.coursesRepository.findByInstructor(instructorId, query);
  }

  /**
   * 3. GET INSTRUCTOR STATS
   */
  async getMyStats(instructorId: string): Promise<CourseStatsResponse> {
    return this.coursesRepository.getStatsByInstructor(instructorId);
  }

  /**
   * 4. GET ALL COURSES FOR ADMIN
   */
  async getAdminCourses(query: QueryCourseDto) {
    return this.coursesRepository.findAllForAdmin(query);
  }
async getPublicCatalogue(query: QueryCourseDto) {
  const result = await this.coursesRepository.findPublicCatalogue(query);
  // Badges (Bestseller / Highest rated / New) follow the rules in Settings → Course badges.
  return { ...result, items: await this.courseBadges.attach(result.items) };
}
  /**
   * 5a. GET COURSE DETAIL BY UUID OR SLUG
   * Unknown, malformed or not-owned references all return 404.
   */
  async getCourseByIdOrSlug(
    idOrSlug: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseDetailResponse> {
    const ref = (idOrSlug || '').trim().toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref);

    if (isUuid) {
      return this.getCourseById(ref, user);
    }

    if (ref.length > 220 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ref)) {
      throw new NotFoundException('Course not found');
    }

    const courseId = await this.coursesRepository.findIdBySlug(ref);
    if (!courseId) {
      throw new NotFoundException('Course not found');
    }

    // Ownership is still enforced inside findDetailById
    return this.getCourseById(courseId, user);
  }

  /**
   * 5. GET COURSE DETAIL BY ID
   */
  async getCourseById(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseDetailResponse> {
    const course = await this.coursesRepository.findDetailById(courseId, user);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  /**
   * 6. UPDATE COURSE (PATCH)
   */
  async updateCourse(
    courseId: string,
    dto: UpdateCourseDto,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseDetailResponse> {
    // 1. Ownership check: Must be accessible by current user
    const existing = await this.coursesRepository.findAccessibleById(courseId, user);
    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    // 2. Edit lock check: Draft, rejected, and published courses can be edited safely
    if (existing.status !== 'draft' && existing.status !== 'rejected' && existing.status !== 'published') {
      throw new ConflictException(`Course is locked while ${existing.status}`);
    }

    const isAdmin = user.permissions?.includes('courses:manage');

    const fieldsToUpdate: Record<string, any> = {};

    // 3. Category verification if changing categoryId
    if (dto.categoryId !== undefined) {
      if (dto.categoryId !== null && dto.categoryId !== '') {
        const cat = await this.coursesRepository.getCategory(dto.categoryId);
        if (!cat || !cat.is_active) {
          throw new BadRequestException('Category not found or inactive');
        }
        fieldsToUpdate.categoryId = dto.categoryId;
      } else {
        fieldsToUpdate.categoryId = null;
      }
    }

    // 4. Promo video verification if changing promoVideoAssetId
    if (dto.promoVideoAssetId !== undefined) {
      if (dto.promoVideoAssetId !== null && dto.promoVideoAssetId !== '') {
        const asset = await this.coursesRepository.getMediaAsset(dto.promoVideoAssetId);
        if (
          !asset ||
          asset.deleted_at !== null ||
          !asset.is_active ||
          asset.asset_type !== 'video'
        ) {
          throw new BadRequestException('Invalid promo video asset: asset not found or not an active video');
        }

        if (asset.course_id && asset.course_id !== courseId) {
          throw new BadRequestException('Invalid promo video asset: it belongs to another course');
        }

        if (!isAdmin && asset.owner_id !== existing.instructor_id) {
          throw new BadRequestException('Invalid promo video asset: ownership mismatch');
        }

        fieldsToUpdate.promoVideoAssetId = dto.promoVideoAssetId;
      } else {
        fieldsToUpdate.promoVideoAssetId = null;
      }
    }

    // 5. Title & Slug: regenerate slug if title changes and course was never published
    if (dto.title !== undefined) {
      const trimmedTitle = dto.title.trim();
      fieldsToUpdate.title = trimmedTitle;

      if (trimmedTitle !== existing.title && existing.published_at === null) {
        fieldsToUpdate.slug = this.slugify(trimmedTitle);
      }
    }

    // 6. Pricing validation on combined final values
    const finalIsFree = dto.isFree !== undefined ? Boolean(dto.isFree) : existing.is_free;
    const finalPrice =
      dto.price !== undefined ? Number(dto.price) : Number(existing.price);
    const finalDiscount =
      dto.discountPrice !== undefined
        ? dto.discountPrice !== null
          ? Number(dto.discountPrice)
          : null
        : existing.discount_price !== null
        ? Number(existing.discount_price)
        : null;

    // Only validate pricing when this request touches pricing. A new draft starts as paid with price 0,
    // so validating on every PATCH would block unrelated edits (title, promo video...).
    // The submit checklist still enforces valid pricing before review.
    const touchesPricing =
      dto.isFree !== undefined || dto.price !== undefined || dto.discountPrice !== undefined;

    if (!touchesPricing) {
      // leave pricing columns untouched
    } else if (finalIsFree) {
      fieldsToUpdate.isFree = true;
      fieldsToUpdate.price = 0;
      fieldsToUpdate.discountPrice = null;
    } else {
      if (dto.isFree !== undefined) fieldsToUpdate.isFree = false;
      if (finalPrice <= 0) {
        throw new BadRequestException('Paid courses must have a price greater than 0');
      }
      if (dto.price !== undefined) fieldsToUpdate.price = finalPrice;

      if (finalDiscount !== null) {
        if (finalDiscount < 0) {
          throw new BadRequestException('Discount price cannot be negative');
        }
        if (finalDiscount >= finalPrice) {
          throw new BadRequestException('Discount price must be lower than the regular price');
        }
        fieldsToUpdate.discountPrice = finalDiscount;
      } else if (dto.discountPrice !== undefined) {
        fieldsToUpdate.discountPrice = null;
      }
    }

    // 7. Other whitelisted metadata fields
    if (dto.subtitle !== undefined) fieldsToUpdate.subtitle = dto.subtitle ? dto.subtitle.trim() : null;
    if (dto.description !== undefined) fieldsToUpdate.description = dto.description ? dto.description.trim() : null;
    if (dto.learningOutcomes !== undefined) fieldsToUpdate.learningOutcomes = dto.learningOutcomes || [];
    if (dto.requirements !== undefined) fieldsToUpdate.requirements = dto.requirements || [];
    if (dto.targetAudience !== undefined) fieldsToUpdate.targetAudience = dto.targetAudience ? dto.targetAudience.trim() : null;
    if (dto.level !== undefined) fieldsToUpdate.level = dto.level;
    if (dto.language !== undefined) {
      fieldsToUpdate.language = dto.language ? await this.resolveLanguage(dto.language.trim()) : 'English';
    }
    if (dto.currency !== undefined) fieldsToUpdate.currency = dto.currency ? dto.currency.trim().toUpperCase() : 'INR';
    if (dto.thumbnailUrl !== undefined) fieldsToUpdate.thumbnailUrl = dto.thumbnailUrl ? dto.thumbnailUrl.trim() : null;
    if (dto.isRefundable !== undefined) fieldsToUpdate.isRefundable = Boolean(dto.isRefundable);
    if (dto.refundPeriodDays !== undefined) {
      const days = Number(dto.refundPeriodDays);
      if (isNaN(days) || days < 0) {
        throw new BadRequestException('Refund period days must be a non-negative number');
      }
      fieldsToUpdate.refundPeriodDays = Math.floor(days);
    }

    // 8. Attempt update with slug conflict handling
    let attempts = 0;
    const baseSlug = fieldsToUpdate.slug;

    while (attempts <= 5) {
      try {
        const updatedRow = await this.coursesRepository.update(courseId, fieldsToUpdate, undefined, {
          editableOnly: true,
        });
        if (!updatedRow) {
          // Status changed (e.g. submitted for review) after our read
          throw new ConflictException('Course is no longer editable. Refresh and try again.');
        }

        // Promo video replaced or removed: retire the old one if nothing else uses it
        if (
          fieldsToUpdate.promoVideoAssetId !== undefined &&
          existing.promo_video_asset_id &&
          existing.promo_video_asset_id !== fieldsToUpdate.promoVideoAssetId
        ) {
          const replacedKey = await this.coursesRepository.softDeleteUnusedPromoAsset(existing.promo_video_asset_id);
          await this.deletePromoFile(replacedKey);
        }

        const detail = await this.coursesRepository.findDetailById(courseId, user);
        if (!detail) {
          throw new NotFoundException('Course not found after update.');
        }

        if (existing.status === 'published') {
          await this.databaseService.query(
            `INSERT INTO media_audit_logs (action, actor_id, course_id, details)
             VALUES ($1, $2, $3, $4)`,
            [
              'COURSE_METADATA_UPDATED',
              user.userId,
              courseId,
              JSON.stringify({
                updatedFields: Object.keys(fieldsToUpdate),
                status: 'published',
              }),
            ],
          ).catch((e: any) => this.logger.warn(`Failed to log course audit: ${e.message}`));
        }

        return detail;
      } catch (err: any) {
        if (
          err?.code === '23505' &&
          baseSlug &&
          (err?.constraint === 'courses_slug_key' || String(err?.detail).includes('slug'))
        ) {
          attempts++;
          if (attempts <= 5) {
            fieldsToUpdate.slug = `${baseSlug}-${attempts + 1}`;
          } else {
            const randomSuffix = crypto.randomBytes(3).toString('hex');
            fieldsToUpdate.slug = `${baseSlug}-${randomSuffix}`;
          }
          continue;
        }

        if (err?.code === '23514') {
          throw new BadRequestException(`Validation error: ${err.message || 'Check constraint failed'}`);
        }

        throw err;
      }
    }

    throw new ConflictException('Unable to resolve slug conflict during update.');
  }

  /**
   * 7. SOFT DELETE COURSE
   * Allowed only when status = 'draft'; otherwise 409 Conflict.
   */
  async deleteCourse(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<{ message: string; courseId: string }> {
    const existing = await this.coursesRepository.findAccessibleById(courseId, user);
    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    if (existing.status !== 'draft') {
      throw new ConflictException('Only draft courses can be deleted');
    }

    const deleted = await this.coursesRepository.softDelete(courseId);
    if (!deleted) {
      throw new NotFoundException('Course not found');
    }

    return {
      message: 'Course deleted successfully',
      courseId,
    };
  }

  /**
   * 8. GET COURSE CHECKLIST (Read-only check before submission)
   */
  async getCourseChecklist(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
  ): Promise<CourseChecklistResponse> {
    const course = await this.coursesRepository.findAccessibleById(courseId, user);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const items: Array<{ key: string; ok: boolean; message: string }> = [];

    // 1. title: at least 10 chars
    const titleOk = Boolean(course.title && course.title.trim().length >= 10);
    items.push({
      key: 'title',
      ok: titleOk,
      message: titleOk
        ? 'Course title meets minimum requirement (at least 10 characters).'
        : 'Course title must be at least 10 characters.',
    });

    // 2. subtitle: present
    const subtitleOk = Boolean(course.subtitle && course.subtitle.trim().length > 0);
    items.push({
      key: 'subtitle',
      ok: subtitleOk,
      message: subtitleOk
        ? 'Course subtitle is present.'
        : 'Course subtitle is required.',
    });

    // 3. description: at least 200 chars
    const descOk = Boolean(course.description && course.description.trim().length >= 200);
    items.push({
      key: 'description',
      ok: descOk,
      message: descOk
        ? 'Course description meets minimum requirement (at least 200 characters).'
        : 'Course description must be at least 200 characters.',
    });

    // 4. category: set and currently active
    let categoryOk = false;
    let categoryMsg = 'Category is required.';
    if (course.category_id) {
      const cat = await this.coursesRepository.getCategory(course.category_id);
      if (cat && cat.is_active) {
        categoryOk = true;
        categoryMsg = `Category "${cat.name}" is selected and active.`;
      } else {
        categoryMsg = 'Selected category is inactive or deleted.';
      }
    }
    items.push({
      key: 'category',
      ok: categoryOk,
      message: categoryMsg,
    });

    // 5. level_language: both set
    const levelLangOk = Boolean(course.level && course.language);
    items.push({
      key: 'level_language',
      ok: levelLangOk,
      message: levelLangOk
        ? `Level (${course.level}) and language (${course.language}) are set.`
        : 'Level and language must both be configured.',
    });

    // 6. outcomes: at least 4 learning outcomes
    const outcomesCount = Array.isArray(course.learning_outcomes)
      ? course.learning_outcomes.filter((o) => typeof o === 'string' && o.trim().length > 0).length
      : 0;
    const outcomesOk = outcomesCount >= 4;
    items.push({
      key: 'outcomes',
      ok: outcomesOk,
      message: outcomesOk
        ? `${outcomesCount} learning outcomes specified.`
        : `At least 4 learning outcomes required (currently ${outcomesCount}).`,
    });

    // 7. thumbnail: present
    const thumbnailOk = Boolean(course.thumbnail_url && course.thumbnail_url.trim().length > 0);
    items.push({
      key: 'thumbnail',
      ok: thumbnailOk,
      message: thumbnailOk
        ? 'Course thumbnail is uploaded.'
        : 'Course thumbnail is required.',
    });

    // 8. pricing: free or price > 0
    const pricingOk = Boolean(course.is_free) || Number(course.price) > 0;
    items.push({
      key: 'pricing',
      ok: pricingOk,
      message: pricingOk
        ? course.is_free
          ? 'Course is configured as free.'
          : `Course price is set to ${course.currency} ${course.price}.`
        : 'Course must be free or have a price greater than 0.',
    });

    // 9. promo_video: mandatory - must be uploaded and ready
    let promoVideoOk = false;
    let promoVideoMsg = 'Course promotional video trailer is required.';
    if (course.promo_video_asset_id) {
      const asset = await this.coursesRepository.getMediaAsset(course.promo_video_asset_id);
      if (asset && asset.processing_status === 'ready' && !asset.deleted_at && asset.is_active) {
        promoVideoOk = true;
        promoVideoMsg = 'Course promotional video trailer is uploaded and ready.';
      } else {
        promoVideoOk = false;
        promoVideoMsg = `Promo video processing status is "${asset?.processing_status || 'not ready'}".`;
      }
    }
    items.push({
      key: 'promo_video',
      ok: promoVideoOk,
      message: promoVideoMsg,
    });

    // 10. curriculum: at least one active lesson in an active section
    const curriculumOk = await this.coursesRepository.hasActiveCurriculum(courseId);
    items.push({
      key: 'curriculum',
      ok: curriculumOk,
      message: curriculumOk
        ? 'Curriculum contains active sections with published lessons.'
        : 'Curriculum must contain at least one active section with an active lesson.',
    });

    const ready = items.every((i) => i.ok);

    return {
      ready,
      items,
    };
  }

  /**
   * 9. GET DYNAMIC COURSE LANGUAGES
   */
  async getCourseLanguages(activeOnly: boolean = true): Promise<CourseLanguageRow[]> {
    return this.coursesRepository.getCourseLanguages(activeOnly);
  }

  /**
   * 10. CREATE COURSE LANGUAGE (Admin)
   */
  async createCourseLanguage(dto: CreateCourseLanguageDto): Promise<CourseLanguageRow> {
    try {
      return await this.coursesRepository.createCourseLanguage(dto);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(`A language with code '${dto.code}' already exists.`);
      }
      throw err;
    }
  }

  /**
   * 11. UPDATE COURSE LANGUAGE (Admin)
   */
  async updateCourseLanguage(
    id: string,
    dto: UpdateCourseLanguageDto,
  ): Promise<CourseLanguageRow> {
    const updated = await this.coursesRepository.updateCourseLanguage(id, dto);
    if (!updated) {
      throw new NotFoundException(`Language with ID '${id}' not found.`);
    }
    return updated;
  }

  /**
   * 12. DELETE COURSE LANGUAGE (Admin)
   */
  async deleteCourseLanguage(id: string): Promise<{ message: string; languageId: string }> {
    const deleted = await this.coursesRepository.deleteCourseLanguage(id);
    if (!deleted) {
      throw new NotFoundException(`Language with ID '${id}' not found.`);
    }
    return {
      message: 'Language removed successfully',
      languageId: id,
    };
  }

  /**
   * 13. ATTACH PROMOTIONAL VIDEO
   */
  async attachPromoVideo(
    courseId: string,
    file: any,
    user: { userId: string; roles?: string[]; permissions?: string[] },
    req: any,
  ) {
    const removeUploadedFile = () => unlink(file.path).catch(() => undefined);

    // Same ownership rule as every other course endpoint: not yours -> 404
    const course = await this.coursesRepository.findAccessibleById(courseId, user);
    if (!course) {
      await removeUploadedFile();
      throw new NotFoundException('Course not found');
    }

    if (course.status !== 'draft' && course.status !== 'rejected') {
      await removeUploadedFile();
      throw new ConflictException(`Course is locked while ${course.status}`);
    }

    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5001}`;
    const fileUrl = `${protocol}://${host}/uploads/videos/${file.filename}`;

    let asset: any;
    try {
      asset = await this.databaseService.withTransaction(async (client) => {
        const created = await this.coursesRepository.createMediaAsset(
          {
            ownerId: course.instructor_id,
            courseId: course.course_id,
            assetType: 'video',
            title: file.originalname,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
            storageKey: file.filename,
            storageProvider: 'local',
            visibility: 'public', // promo trailers are public marketing content
            processingStatus: 'ready',
            durationSeconds: null, // real duration is filled in by media processing (Module 16)
          },
          client,
        );

        const linked = await this.coursesRepository.update(
          courseId,
          { promoVideoAssetId: created.asset_id },
          client,
          { editableOnly: true },
        );
        if (!linked) {
          throw new ConflictException('Course is no longer editable. Refresh and try again.');
        }

        // Retire the promo this upload replaced (same transaction, file removed after commit)
        const replacedKey =
          course.promo_video_asset_id && course.promo_video_asset_id !== created.asset_id
            ? await this.coursesRepository.softDeleteUnusedPromoAsset(course.promo_video_asset_id, client)
            : null;

        return { created, replacedKey };
      });
    } catch (err) {
      await removeUploadedFile();
      throw err;
    }

    await this.deletePromoFile(asset.replacedKey);
    asset = asset.created;

    return {
      message: 'Promotional video uploaded and attached successfully',
      assetId: asset.asset_id,
      url: fileUrl,
      title: file.originalname,
      durationSeconds: asset.duration_seconds ?? null,
      size: file.size,
      processingStatus: 'ready',
    };
  }
}


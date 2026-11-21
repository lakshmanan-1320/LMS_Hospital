import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CourseLandingRepository } from './course-landing.repository';
import { CourseBadgesService } from './course-badges.service';
import { ModuleRegistryService } from '../modules/platform-modules/module-registry.service';
import { SettingsService } from '../modules/settings/settings.service';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

const asArray = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

/**
 * Public course landing page (everything the course detail page needs in one call) and
 * related courses. Optional parts follow Module Management: the refund guarantee appears only
 * when Refunds is on, the certificate line only when Certificates is on.
 */
@Injectable()
export class CourseLandingService {
  constructor(
    @Inject(CourseLandingRepository) private readonly repository: CourseLandingRepository,
    @Inject(CourseBadgesService) private readonly badges: CourseBadgesService,
    @Inject(ModuleRegistryService) private readonly registry: ModuleRegistryService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  async getLanding(idOrSlug: string) {
    const c = await this.repository.findPublishedCourse(idOrSlug);
    if (!c) throw new NotFoundException('Course not found.');

    const [rows, resources, instructor, badgeMap, refundGuarantee, promo] = await Promise.all([
      this.repository.findCurriculum(c.courseId),
      this.repository.countResources(c.courseId),
      c.instructorId ? this.repository.findInstructor(c.instructorId) : Promise.resolve(null),
      this.badges.getBadges([c.courseId]),
      this.getRefundGuarantee(c),
      c.promoVideoAssetId ? this.repository.findPromoVideo(c.promoVideoAssetId) : Promise.resolve(null),
    ]);

    // Group lessons into sections
    const sections: any[] = [];
    const byId = new Map<string, any>();
    for (const r of rows) {
      let section = byId.get(r.sectionId);
      if (!section) {
        section = { sectionId: r.sectionId, title: r.sectionTitle, lectures: 0, durationSeconds: 0, lessons: [] };
        byId.set(r.sectionId, section);
        sections.push(section);
      }
      if (r.lessonId) {
        section.lessons.push({
          lessonId: r.lessonId,
          title: r.lessonTitle,
          lessonType: r.lessonType,
          durationSeconds: r.durationSeconds,
          isPreview: r.isPreview,
          previewAvailable: Boolean(r.previewAvailable),
        });
        section.lectures += 1;
        section.durationSeconds += r.durationSeconds;
      }
    }
    const lessons = sections.flatMap((s) => s.lessons);

    const breadcrumb = [
      c.parentCategoryId ? { id: c.parentCategoryId, name: c.parentCategoryName, slug: c.parentCategorySlug } : null,
      c.categoryId ? { id: c.categoryId, name: c.categoryName, slug: c.categorySlug } : null,
    ].filter(Boolean);

    return {
      course: {
        courseId: c.courseId,
        title: c.title,
        slug: c.slug,
        subtitle: c.subtitle,
        description: c.description,
        level: c.level,
        language: c.language,
        isFree: c.isFree,
        price: c.price,
        discountPrice: c.discountPrice,
        currency: c.currency,
        thumbnailUrl: c.thumbnailUrl,
        learningOutcomes: asArray(c.learningOutcomes),
        requirements: asArray(c.requirements),
        targetAudience: c.targetAudience,
        averageRating: c.averageRating || 0,
        totalReviewsCount: c.totalReviewsCount || 0,
        totalStudents: c.totalStudents,
        publishedAt: c.publishedAt,
        lastUpdatedAt: c.updatedAt,
        badges: badgeMap.get(c.courseId) || [],
      },
      breadcrumb,
      includes: {
        videoSeconds: lessons.filter((l) => l.lessonType === 'video').reduce((sum, l) => sum + l.durationSeconds, 0),
        articles: lessons.filter((l) => l.lessonType === 'text').length,
        documents: lessons.filter((l) => l.lessonType === 'document').length,
        resources,
        certificate: Boolean(this.registry.getModule(MODULE_KEYS.CERTIFICATES)?.is_enabled),
      },
      curriculum: {
        totalSections: sections.length,
        totalLectures: lessons.length,
        totalDurationSeconds: lessons.reduce((sum, l) => sum + l.durationSeconds, 0),
        sections,
      },
      instructor: instructor
        ? {
            userId: instructor.userId,
            name: instructor.name,
            slug: instructor.isPublic ? instructor.slug : null,
            headline: instructor.headline,
            bio: instructor.bio,
            avatarUrl: instructor.avatarUrl,
            totalCourses: instructor.totalCourses,
            totalStudents: instructor.totalStudents,
            totalReviews: instructor.totalReviews,
            averageRating: instructor.averageRating,
          }
        : null,
      refundGuarantee,
      promoVideo: promo?.storageKey
        ? { url: `/uploads/videos/${promo.storageKey}`, durationSeconds: promo.durationSeconds }
        : null,
    };
  }

  async getRelated(idOrSlug: string, limit = 8) {
    const c = await this.repository.findPublishedCourse(idOrSlug);
    if (!c) throw new NotFoundException('Course not found.');
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);
    const items = await this.repository.findRelated(c, safeLimit);
    return { items: await this.badges.attach(items) };
  }

  /** Money-back guarantee, only when Refunds is on and the platform policy allows it. */
  private async getRefundGuarantee(c: any): Promise<{ days: number } | null> {
    if (!this.registry.getModule(MODULE_KEYS.REFUNDS)?.is_enabled) return null;
    if (!c.isRefundable || !(c.refundPeriodDays > 0) || c.isFree) return null;
    const { policy } = await this.settingsService.getRefundPolicySettings();
    if (policy.allowGlobalRefunds === false || policy.policyEnforcementMode === 'strict_no_refunds') return null;
    return { days: c.refundPeriodDays };
  }
}

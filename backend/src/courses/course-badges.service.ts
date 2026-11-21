import { Injectable, Inject } from '@nestjs/common';
import { SettingsService } from '../modules/settings/settings.service';
import { CourseLandingRepository } from './course-landing.repository';

export type CourseBadgeKey = 'bestseller' | 'highest_rated' | 'new';

export interface CourseBadge {
  key: CourseBadgeKey;
  label: string;
}

/**
 * Course badges, computed from the rules Admin / Super Admin set in Settings → Course badges.
 * Nothing is hard-coded: thresholds, windows and on/off switches all come from the settings.
 */
@Injectable()
export class CourseBadgesService {
  constructor(
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(CourseLandingRepository) private readonly landingRepository: CourseLandingRepository,
  ) {}

  async getBadges(courseIds: string[]): Promise<Map<string, CourseBadge[]>> {
    const result = new Map<string, CourseBadge[]>();
    if (courseIds.length === 0) return result;

    const rules = await this.settingsService.getCourseBadgeRules();
    const stats = await this.landingRepository.findBadgeStats([...new Set(courseIds)], rules.bestseller.windowDays);
    const now = Date.now();

    for (const s of stats) {
      const badges: CourseBadge[] = [];
      const b = rules.bestseller;
      if (
        b.enabled &&
        s.recentStudents > 0 &&
        s.totalStudents >= b.minStudents &&
        (s.categoryRank * 100 < b.topPercent || b.topPercent >= 100)
      ) {
        badges.push({ key: 'bestseller', label: 'Bestseller' });
      }
      const h = rules.highestRated;
      if (h.enabled && s.totalReviews >= h.minReviews && s.averageRating >= h.minRating) {
        badges.push({ key: 'highest_rated', label: 'Highest rated' });
      }
      const n = rules.newCourse;
      if (n.enabled && s.publishedAt && now - new Date(s.publishedAt).getTime() <= n.withinDays * 86_400_000) {
        badges.push({ key: 'new', label: 'New' });
      }
      result.set(s.courseId, badges);
    }
    return result;
  }

  /** Adds `badges` to each course object (by `courseId`). */
  async attach<T extends { courseId: string }>(courses: T[]): Promise<Array<T & { badges: CourseBadge[] }>> {
    const badges = await this.getBadges(courses.map((c) => c.courseId));
    return courses.map((c) => ({ ...c, badges: badges.get(c.courseId) || [] }));
  }
}

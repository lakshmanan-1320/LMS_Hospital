import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Enrollment statuses that count as a "student" of a course. */
const STUDENT_STATUSES = `('active', 'completed')`;

/**
 * Columns shared by public course cards (catalog, related courses): course basics plus
 * students, lecture count and total length. Expects `c` (courses), `u` (users), `cat` (categories).
 */
export const PUBLIC_COURSE_CARD_COLUMNS = `
  c.course_id AS "courseId",
  c.instructor_id AS "instructorId",
  TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
  c.category_id AS "categoryId",
  cat.name AS "categoryName",
  c.title,
  c.slug,
  c.subtitle,
  c.description,
  c.level,
  c.language,
  c.is_free AS "isFree",
  c.price::float AS "price",
  c.discount_price::float AS "discountPrice",
  c.currency,
  c.thumbnail_url AS "thumbnailUrl",
  c.is_refundable AS "isRefundable",
  c.refund_period_days AS "refundPeriodDays",
  c.average_rating::float AS "averageRating",
  c.total_reviews_count AS "totalReviewsCount",
  c.is_featured AS "isFeatured",
  c.published_at AS "publishedAt",
  c.updated_at AS "updatedAt",
  (SELECT COUNT(*)::int FROM course_enrollments ce
     WHERE ce.course_id = c.course_id AND ce.enrollment_status IN ${STUDENT_STATUSES}) AS "totalStudents",
  (SELECT COUNT(*)::int FROM course_lessons l
     JOIN course_sections s ON s.section_id = l.section_id
     WHERE l.course_id = c.course_id AND l.is_active = TRUE AND s.is_active = TRUE) AS "totalLectures",
  (SELECT COALESCE(SUM(l.duration_seconds), 0)::int FROM course_lessons l
     JOIN course_sections s ON s.section_id = l.section_id
     WHERE l.course_id = c.course_id AND l.is_active = TRUE AND s.is_active = TRUE) AS "totalDurationSeconds"
`;

const PUBLISHED = `c.deleted_at IS NULL AND c.status = 'published' AND c.is_active = TRUE`;

export interface BadgeStatsRow {
  courseId: string;
  averageRating: number;
  totalReviews: number;
  totalStudents: number;
  recentStudents: number;
  categoryRank: number; // PERCENT_RANK within category by recent students (0 = top)
  publishedAt: Date | null;
}

/**
 * Read-only queries for the public course landing page, related courses and badges.
 */
@Injectable()
export class CourseLandingRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findPublishedCourse(idOrSlug: string) {
    const res = await this.databaseService.query(
      `SELECT
         ${PUBLIC_COURSE_CARD_COLUMNS},
         c.learning_outcomes AS "learningOutcomes",
         c.requirements,
         c.target_audience AS "targetAudience",
         c.promo_video_asset_id AS "promoVideoAssetId",
         cat.slug AS "categorySlug",
         parent.category_id AS "parentCategoryId",
         parent.name AS "parentCategoryName",
         parent.slug AS "parentCategorySlug"
       FROM courses c
       LEFT JOIN users u ON u.user_id = c.instructor_id
       LEFT JOIN categories cat ON cat.category_id = c.category_id
       LEFT JOIN categories parent ON parent.category_id = cat.parent_category_id
       WHERE (c.course_id::text = $1 OR c.slug = $1) AND ${PUBLISHED}
       LIMIT 1;`,
      [idOrSlug],
    );
    return res.rows[0] || null;
  }

  /** Sections with their lessons (no lesson content), and whether each preview can be played. */
  async findCurriculum(courseId: string) {
    const res = await this.databaseService.query(
      `SELECT
         s.section_id AS "sectionId", s.title AS "sectionTitle", s.sort_order AS "sectionOrder",
         l.lesson_id AS "lessonId", l.title AS "lessonTitle", l.lesson_type AS "lessonType",
         COALESCE(l.duration_seconds, 0)::int AS "durationSeconds", l.is_preview AS "isPreview",
         l.sort_order AS "lessonOrder",
         (l.is_preview AND a.asset_id IS NOT NULL AND a.processing_status = 'ready'
            AND a.is_active = TRUE AND a.deleted_at IS NULL) AS "previewAvailable"
       FROM course_sections s
       LEFT JOIN course_lessons l ON l.section_id = s.section_id AND l.is_active = TRUE
       LEFT JOIN media_assets a ON a.asset_id = l.content_asset_id
       WHERE s.course_id = $1 AND s.is_active = TRUE
       ORDER BY s.sort_order, s.created_at, l.sort_order, l.created_at;`,
      [courseId],
    );
    return res.rows;
  }

  async countResources(courseId: string): Promise<number> {
    const res = await this.databaseService.query(
      `SELECT COUNT(*)::int AS c
       FROM lesson_resources r
       JOIN course_lessons l ON l.lesson_id = r.lesson_id AND l.is_active = TRUE
       WHERE l.course_id = $1;`,
      [courseId],
    );
    return res.rows[0].c;
  }

  async findPromoVideo(assetId: string) {
    const res = await this.databaseService.query(
      `SELECT storage_key AS "storageKey", duration_seconds AS "durationSeconds"
       FROM media_assets WHERE asset_id = $1 AND deleted_at IS NULL AND is_active = TRUE;`,
      [assetId],
    );
    return res.rows[0] || null;
  }

  /** Instructor public profile with totals across their published courses. */
  async findInstructor(instructorId: string) {
    const res = await this.databaseService.query(
      `SELECT
         u.user_id AS "userId",
         TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name,
         ip.slug, ip.headline, ip.bio, ip.avatar_url AS "avatarUrl", COALESCE(ip.is_public, FALSE) AS "isPublic",
         (SELECT COUNT(*)::int FROM courses c WHERE c.instructor_id = u.user_id AND ${PUBLISHED}) AS "totalCourses",
         (SELECT COUNT(DISTINCT ce.student_id)::int FROM course_enrollments ce
            JOIN courses c ON c.course_id = ce.course_id
            WHERE c.instructor_id = u.user_id AND ${PUBLISHED} AND ce.enrollment_status IN ${STUDENT_STATUSES}) AS "totalStudents",
         (SELECT COALESCE(SUM(c.total_reviews_count), 0)::int FROM courses c
            WHERE c.instructor_id = u.user_id AND ${PUBLISHED}) AS "totalReviews",
         (SELECT COALESCE(ROUND(SUM(c.average_rating * c.total_reviews_count)::numeric
                   / NULLIF(SUM(c.total_reviews_count), 0), 1), 0)::float
            FROM courses c WHERE c.instructor_id = u.user_id AND ${PUBLISHED}) AS "averageRating"
       FROM users u
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.user_id
       WHERE u.user_id = $1;`,
      [instructorId],
    );
    return res.rows[0] || null;
  }

  /** Same category first, then the parent category; most students and best rated first. */
  async findRelated(course: { courseId: string; categoryId: string | null; parentCategoryId: string | null }, limit: number) {
    const res = await this.databaseService.query(
      `SELECT ${PUBLIC_COURSE_CARD_COLUMNS}
       FROM courses c
       LEFT JOIN users u ON u.user_id = c.instructor_id
       LEFT JOIN categories cat ON cat.category_id = c.category_id
       WHERE ${PUBLISHED} AND c.course_id <> $1
         AND ($2::uuid IS NULL OR c.category_id = $2 OR cat.parent_category_id = $2
              OR ($3::uuid IS NOT NULL AND (c.category_id = $3 OR cat.parent_category_id = $3)))
       ORDER BY (c.category_id IS NOT DISTINCT FROM $2::uuid) DESC,
                "totalStudents" DESC, c.average_rating DESC, c.published_at DESC NULLS LAST
       LIMIT $4;`,
      [course.courseId, course.categoryId, course.parentCategoryId, limit],
    );
    return res.rows;
  }

  /**
   * Figures behind the badges for the given courses. The category ranking is computed over all
   * published courses first, then filtered, so each course is ranked against its whole category.
   */
  async findBadgeStats(courseIds: string[], windowDays: number): Promise<BadgeStatsRow[]> {
    if (courseIds.length === 0) return [];
    const res = await this.databaseService.query<BadgeStatsRow>(
      `WITH recent AS (
         SELECT course_id, COUNT(*)::int AS n FROM course_enrollments
         WHERE enrollment_status IN ${STUDENT_STATUSES} AND enrolled_at >= NOW() - make_interval(days => $2::int)
         GROUP BY course_id
       ), totals AS (
         SELECT course_id, COUNT(*)::int AS n FROM course_enrollments
         WHERE enrollment_status IN ${STUDENT_STATUSES}
         GROUP BY course_id
       ), ranked AS (
         SELECT c.course_id,
                c.average_rating::float AS "averageRating",
                c.total_reviews_count AS "totalReviews",
                COALESCE(t.n, 0) AS "totalStudents",
                COALESCE(r.n, 0) AS "recentStudents",
                PERCENT_RANK() OVER (PARTITION BY c.category_id ORDER BY COALESCE(r.n, 0) DESC)::float AS "categoryRank",
                c.published_at AS "publishedAt"
         FROM courses c
         LEFT JOIN recent r ON r.course_id = c.course_id
         LEFT JOIN totals t ON t.course_id = c.course_id
         WHERE ${PUBLISHED}
       )
       SELECT course_id AS "courseId", "averageRating", "totalReviews", "totalStudents",
              "recentStudents", "categoryRank", "publishedAt"
       FROM ranked WHERE course_id = ANY ($1::uuid[]);`,
      [courseIds, windowDays],
    );
    return res.rows;
  }
}

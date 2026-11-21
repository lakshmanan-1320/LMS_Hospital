import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  CourseRow,
  CourseDetailResponse,
  CourseStatsResponse,
  CourseLanguageRow,
  PromoVideoSafe,
} from './interfaces/course.interface';
import { QueryCourseDto } from './dto/query-course.dto';
import { QueryApprovalDto } from './dto/query-approval.dto';
import {
  CourseStatusHistoryRow,
  ApprovalQueueRow,
  ApprovalStats,
  CurriculumSummary,
  CurriculumSectionDetail,
  CurriculumLessonDetail,
} from './interfaces/course-approval.interface';
import { PUBLIC_COURSE_CARD_COLUMNS } from './course-landing.repository';

/**
 * Explicit course columns returned by this repository.
 * Never use SELECT * / RETURNING *: it would expose search_vector and any future internal columns.
 */
const COURSE_COLUMNS = `
  course_id, instructor_id, category_id, title, slug, subtitle, description,
  learning_outcomes, requirements, target_audience, level, language,
  is_free, price, discount_price, currency, thumbnail_url, promo_video_asset_id,
  is_refundable, refund_period_days,
  average_rating, total_reviews_count,
  status, rejection_reason, submitted_at, reviewed_by, reviewed_at,
  published_at, archived_at, is_featured, is_active, deleted_at,
  created_at, updated_at`;

/** Statuses in which the instructor may still edit course details. */
const EDITABLE_STATUSES = ['draft', 'rejected', 'published'];

@Injectable()
export class CoursesRepository {
  private readonly logger = new Logger(CoursesRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    client?: PoolClient,
  ) {
    if (client) {
      return client.query<T>(sql, params);
    }
    return this.databaseService.query<T>(sql, params);
  }

  /**
   * 1. CREATE DRAFT COURSE
   */
  async create(
    data: {
      instructorId: string;
      title: string;
      slug: string;
      categoryId?: string | null;
    },
    client?: PoolClient,
  ): Promise<CourseRow> {
    const sql = `
      INSERT INTO courses (
        instructor_id,
        title,
        slug,
        category_id,
        status,
        is_active
      ) VALUES ($1, $2, $3, $4, 'draft', TRUE)
      RETURNING ${COURSE_COLUMNS};
    `;
    const params = [
      data.instructorId,
      data.title,
      data.slug,
      data.categoryId ?? null,
    ];

    const result = await this.executeQuery<CourseRow>(sql, params, client);
    return result.rows[0];
  }

  /**
   * 2. FIND ACCESSIBLE BY ID (Ownership check)
   * Admin / SUPER_ADMIN: checks course_id and deleted_at IS NULL
   * Instructor: adds AND instructor_id = $2
   */
  async findAccessibleById(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
    client?: PoolClient,
  ): Promise<CourseRow | null> {
    const isAdmin = user.permissions?.includes('courses:manage');

    let sql = `
      SELECT ${COURSE_COLUMNS} FROM courses
      WHERE course_id = $1 AND deleted_at IS NULL
    `;
    const params: any[] = [courseId];

    if (!isAdmin) {
      sql += ` AND instructor_id = $2`;
      params.push(user.userId);
    }

    const result = await this.executeQuery<CourseRow>(sql, params, client);
    return result.rows[0] || null;
  }

  /**
   * Resolve a slug to its course_id (not deleted). Access checks happen afterwards.
   */
  async findIdBySlug(slug: string, client?: PoolClient): Promise<string | null> {
    const sql = `SELECT course_id FROM courses WHERE slug = $1 AND deleted_at IS NULL;`;
    const result = await this.executeQuery<{ course_id: string }>(sql, [slug], client);
    return result.rows[0]?.course_id || null;
  }

  /**
   * Soft-delete a replaced promo video asset, but only when:
   *  - it is a course promo upload (storage key "promo-*" in uploads/videos, never curriculum files)
   *  - nothing references it any more (no course promo, lesson content or lesson resource)
   * Returns the storage key so the caller can delete the file AFTER the transaction commits.
   */
  async softDeleteUnusedPromoAsset(assetId: string, client?: PoolClient): Promise<string | null> {
    const sql = `
      UPDATE media_assets m
      SET deleted_at = CURRENT_TIMESTAMP, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE m.asset_id = $1
        AND m.deleted_at IS NULL
        AND m.storage_provider = 'local'
        AND m.storage_key LIKE 'promo-%'
        AND NOT EXISTS (SELECT 1 FROM courses c WHERE c.promo_video_asset_id = m.asset_id)
        AND NOT EXISTS (SELECT 1 FROM course_lessons l WHERE l.content_asset_id = m.asset_id)
        AND NOT EXISTS (SELECT 1 FROM lesson_resources r WHERE r.asset_id = m.asset_id)
      RETURNING m.storage_key;
    `;
    const result = await this.executeQuery<{ storage_key: string }>(sql, [assetId], client);
    return result.rows[0]?.storage_key || null;
  }

  /**
   * Find an ACTIVE instruction language by name or code (case-insensitive).
   */
  async findActiveLanguage(value: string, client?: PoolClient): Promise<{ code: string; name: string } | null> {
    const sql = `
      SELECT code, name FROM course_languages
      WHERE is_active = TRUE AND (LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1))
      LIMIT 1;
    `;
    const result = await this.executeQuery<{ code: string; name: string }>(sql, [value], client);
    return result.rows[0] || null;
  }

  /**
   * 3. FIND BY ID (Without ownership filter, but not deleted)
   */
  async findById(courseId: string, client?: PoolClient): Promise<CourseRow | null> {
    const sql = `SELECT ${COURSE_COLUMNS} FROM courses WHERE course_id = $1 AND deleted_at IS NULL;`;
    const result = await this.executeQuery<CourseRow>(sql, [courseId], client);
    return result.rows[0] || null;
  }

  /**
   * 4. FIND DETAIL BY ID (With safe relations: category, instructor, promo video)
   */
  async findDetailById(
    courseId: string,
    user: { userId: string; roles?: string[]; permissions?: string[] },
    client?: PoolClient,
  ): Promise<CourseDetailResponse | null> {
    const course = await this.findAccessibleById(courseId, user, client);
    if (!course) return null;

    // Fetch category info if category_id exists
    let categoryName: string | null = null;
    let categoryIsActive: boolean | null = null;
    if (course.category_id) {
      const catSql = `SELECT name, is_active FROM categories WHERE category_id = $1;`;
      const catRes = await this.executeQuery<{ name: string; is_active: boolean }>(
        catSql,
        [course.category_id],
        client,
      );
      if (catRes.rows[0]) {
        categoryName = catRes.rows[0].name;
        categoryIsActive = catRes.rows[0].is_active;
      }
    }

    // Fetch instructor display name and email
    let instructorName = 'Unknown Instructor';
    let instructorEmail = '';
    const userSql = `
      SELECT first_name, last_name, email FROM users WHERE user_id = $1;
    `;
    const userRes = await this.executeQuery<{ first_name: string; last_name: string; email: string }>(
      userSql,
      [course.instructor_id],
      client,
    );
    if (userRes.rows[0]) {
      const u = userRes.rows[0];
      instructorName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
      instructorEmail = u.email;
    }

    // Fetch promo video info if promo_video_asset_id is attached
    let promoVideo: PromoVideoSafe | null = null;
    if (course.promo_video_asset_id) {
      const vidSql = `
        SELECT asset_id, title, duration_seconds, processing_status, original_file_name, file_size_bytes, mime_type, storage_key
        FROM media_assets
        WHERE asset_id = $1 AND deleted_at IS NULL;
      `;
      const vidRes = await this.executeQuery<{
        asset_id: string;
        title: string;
        duration_seconds: number | null;
        processing_status: string;
        original_file_name: string | null;
        file_size_bytes: number | null;
        mime_type: string | null;
        storage_key: string | null;
      }>(vidSql, [course.promo_video_asset_id], client);

      if (vidRes.rows[0]) {
        const row = vidRes.rows[0];
        promoVideo = {
          assetId: row.asset_id,
          title: row.title,
          durationSeconds: row.duration_seconds,
          processingStatus: row.processing_status,
          originalFileName: row.original_file_name,
          fileSizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : null,
          mimeType: row.mime_type,
          url: row.storage_key ? `/uploads/videos/${row.storage_key}` : null,
        };
      }
    }

    return {
      courseId: course.course_id,
      instructorId: course.instructor_id,
      instructorName,
      instructorEmail,
      instructor: {
        id: course.instructor_id,
        name: instructorName,
        firstName: userRes.rows[0]?.first_name || '',
        lastName: userRes.rows[0]?.last_name || '',
        email: instructorEmail,
      },
      categoryId: course.category_id,
      categoryName,
      categoryIsActive,
      category: {
        id: course.category_id,
        name: categoryName,
        isActive: categoryIsActive,
      },
      title: course.title,
      slug: course.slug,
      subtitle: course.subtitle,
      description: course.description,
      learningOutcomes: course.learning_outcomes || [],
      requirements: course.requirements || [],
      targetAudience: course.target_audience,
      level: course.level,
      language: course.language,
      isFree: course.is_free,
      price: Number(course.price) || 0,
      discountPrice: course.discount_price !== null ? Number(course.discount_price) : null,
      currency: course.currency,
      thumbnailUrl: course.thumbnail_url,
      promoVideoAssetId: course.promo_video_asset_id,
      promoVideo,
      isRefundable: course.is_refundable ?? true,
      refundPeriodDays: course.refund_period_days !== undefined && course.refund_period_days !== null ? Number(course.refund_period_days) : 30,
      averageRating: course.average_rating !== undefined && course.average_rating !== null ? Number(course.average_rating) : 0,
      totalReviewsCount: course.total_reviews_count !== undefined && course.total_reviews_count !== null ? Number(course.total_reviews_count) : 0,
      status: course.status,
      rejectionReason: course.rejection_reason,
      submittedAt: course.submitted_at ? new Date(course.submitted_at).toISOString() : null,
      reviewedBy: course.reviewed_by,
      reviewedAt: course.reviewed_at ? new Date(course.reviewed_at).toISOString() : null,
      publishedAt: course.published_at ? new Date(course.published_at).toISOString() : null,
      archivedAt: course.archived_at ? new Date(course.archived_at).toISOString() : null,
      isFeatured: course.is_featured,
      isActive: course.is_active,
      createdAt: new Date(course.created_at).toISOString(),
      updatedAt: new Date(course.updated_at).toISOString(),
    };
  }

  /**
   * 5. FIND COURSES OWNED BY INSTRUCTOR (Paginated, filtered)
   */
  async findByInstructor(
    instructorId: string,
    query: QueryCourseDto,
    client?: PoolClient,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, search, status, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['c.instructor_id = $1', 'c.deleted_at IS NULL'];
    const params: any[] = [instructorId];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(c.title) LIKE $${params.length} OR LOWER(COALESCE(c.subtitle, '')) LIKE $${params.length})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count
    const countSql = `SELECT COUNT(*)::int AS total FROM courses c ${whereClause};`;
    const countRes = await this.executeQuery<{ total: number }>(countSql, params, client);
    const total = countRes.rows[0]?.total || 0;

    // Allowed sort columns
    const safeSortCols: Record<string, string> = {
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
      title: 'c.title',
      price: 'c.price',
      status: 'c.status',
      published_at: 'c.published_at',
    };
    const orderCol = safeSortCols[sortBy] || 'c.created_at';
    const orderDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT 
        c.course_id AS "courseId",
        c.instructor_id AS "instructorId",
        c.category_id AS "categoryId",
        cat.name AS "categoryName",
        c.title,
        c.slug,
        c.subtitle,
        c.level,
        c.language,
        c.is_free AS "isFree",
        c.price::float AS "price",
        c.discount_price::float AS "discountPrice",
        c.currency,
        c.thumbnail_url AS "thumbnailUrl",
        c.is_refundable AS "isRefundable",
        c.refund_period_days AS "refundPeriodDays",
        c.status,
        c.rejection_reason AS "rejectionReason",
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.category_id
      ${whereClause}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const dataRes = await this.executeQuery(dataSql, params, client);
    return {
      items: dataRes.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Public course catalogue.
   * Only published, active and non-deleted courses are visible.
   */
  async findPublicCatalogue(
    query: QueryCourseDto,
    client?: PoolClient,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 12,
      search,
      categoryId,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const offset = (page - 1) * limit;

    const conditions = [
      "c.deleted_at IS NULL",
      "c.status = 'published'",
      'c.is_active = TRUE',
    ];

    const params: any[] = [];

    if (categoryId) {
      params.push(categoryId);
      conditions.push(`c.category_id = $${params.length}`);
    }

    if (search?.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(c.title) LIKE $${params.length}
          OR LOWER(COALESCE(c.subtitle, '')) LIKE $${params.length}
          OR LOWER(COALESCE(c.description, '')) LIKE $${params.length}
          OR LOWER(COALESCE(cat.name, '')) LIKE $${params.length})`,
      );
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.category_id
      ${whereClause};
    `;

    const countRes = await this.executeQuery<{ total: number }>(
      countSql,
      params,
      client,
    );

    const total = countRes.rows[0]?.total || 0;

    const safeSortCols: Record<string, string> = {
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
      title: 'c.title',
      price: 'c.price',
      rating: 'c.average_rating',
      students: '"totalStudents"',
      published_at: 'c.published_at',
    };

    const orderCol = safeSortCols[sortBy] || 'c.published_at';
    const orderDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataParams = [...params, limit, offset];

    const dataSql = `
      SELECT ${PUBLIC_COURSE_CARD_COLUMNS}
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN categories cat ON c.category_id = cat.category_id
      ${whereClause}
      ORDER BY ${orderCol} ${orderDir} NULLS LAST, c.published_at DESC NULLS LAST
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `;

    const dataRes = await this.executeQuery(dataSql, dataParams, client);

    return {
      items: dataRes.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * 6. FIND ALL COURSES FOR ADMIN (Paginated, filtered across platform)
   */
  async findAllForAdmin(
    query: QueryCourseDto,
    client?: PoolClient,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      instructorId,
      categoryId,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;
    const offset = (page - 1) * limit;

    // Admin can view all platform courses across all statuses including drafts
    const conditions: string[] = ["c.deleted_at IS NULL"];
    const params: any[] = [];

    if (instructorId) {
      params.push(instructorId);
      conditions.push(`c.instructor_id = $${params.length}`);
    }

    if (categoryId) {
      params.push(categoryId);
      conditions.push(`c.category_id = $${params.length}`);
    }

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(c.title) LIKE $${params.length} OR LOWER(COALESCE(c.subtitle, '')) LIKE $${params.length} OR LOWER(u.first_name) LIKE $${params.length} OR LOWER(u.last_name) LIKE $${params.length})`,
      );
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count
    const countSql = `
      SELECT COUNT(*)::int AS total 
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      ${whereClause};
    `;
    const countRes = await this.executeQuery<{ total: number }>(countSql, params, client);
    const total = countRes.rows[0]?.total || 0;

    const safeSortCols: Record<string, string> = {
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
      title: 'c.title',
      price: 'c.price',
      status: 'c.status',
      published_at: 'c.published_at',
    };
    const orderCol = safeSortCols[sortBy] || 'c.created_at';
    const orderDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataSql = `
      SELECT 
        c.course_id AS "courseId",
        c.instructor_id AS "instructorId",
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
        u.email AS "instructorEmail",
        c.category_id AS "categoryId",
        cat.name AS "categoryName",
        c.title,
        c.slug,
        c.subtitle,
        c.level,
        c.language,
        c.is_free AS "isFree",
        c.price::float AS "price",
        c.discount_price::float AS "discountPrice",
        c.currency,
        c.thumbnail_url AS "thumbnailUrl",
        c.is_refundable AS "isRefundable",
        c.refund_period_days AS "refundPeriodDays",
        c.status,
        c.rejection_reason AS "rejectionReason",
        c.is_featured AS "isFeatured",
        c.is_active AS "isActive",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      LEFT JOIN categories cat ON c.category_id = cat.category_id
      ${whereClause}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${limitIdx} OFFSET $${offsetIdx};
    `;

    const dataRes = await this.executeQuery(dataSql, params, client);
    return {
      items: dataRes.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * 7. GET STATS BY INSTRUCTOR
   */
  async getStatsByInstructor(
    instructorId: string,
    client?: PoolClient,
  ): Promise<CourseStatsResponse> {
    const sql = `
      SELECT status, COUNT(*)::int AS count
      FROM courses
      WHERE instructor_id = $1 AND deleted_at IS NULL
      GROUP BY status;
    `;
    const result = await this.executeQuery<{ status: string; count: number }>(
      sql,
      [instructorId],
      client,
    );

    const counts: CourseStatsResponse = {
      total: 0,
      draft: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      archived: 0,
    };

    for (const row of result.rows) {
      const statusKey = row.status as keyof Omit<CourseStatsResponse, 'total'>;
      if (counts[statusKey] !== undefined) {
        counts[statusKey] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * 8. UPDATE COURSE (PATCH safety with strict column whitelist)
   */
  async update(
    courseId: string,
    fields: Record<string, any>,
    client?: PoolClient,
    options: { editableOnly?: boolean } = {},
  ): Promise<CourseRow | null> {
    const allowedColumns: Record<string, string> = {
      title: 'title',
      slug: 'slug',
      subtitle: 'subtitle',
      description: 'description',
      categoryId: 'category_id',
      learningOutcomes: 'learning_outcomes',
      requirements: 'requirements',
      targetAudience: 'target_audience',
      level: 'level',
      language: 'language',
      isFree: 'is_free',
      price: 'price',
      discountPrice: 'discount_price',
      currency: 'currency',
      thumbnailUrl: 'thumbnail_url',
      promoVideoAssetId: 'promo_video_asset_id',
      isRefundable: 'is_refundable',
      is_refundable: 'is_refundable',
      refundPeriodDays: 'refund_period_days',
      refund_period_days: 'refund_period_days',
    };

    const setClauses: string[] = [];
    const params: any[] = [courseId];

    for (const [key, value] of Object.entries(fields)) {
      const colName = allowedColumns[key];
      if (colName) {
        params.push(
          colName === 'learning_outcomes' || colName === 'requirements'
            ? JSON.stringify(value || [])
            : value,
        );
        setClauses.push(`${colName} = $${params.length}`);
      }
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    // editableOnly closes the race where the course is submitted between the read and this write
    let statusGuard = '';
    if (options.editableOnly) {
      params.push(EDITABLE_STATUSES);
      statusGuard = ` AND status = ANY($${params.length}::varchar[])`;
    }

    const sql = `
      UPDATE courses
      SET ${setClauses.join(', ')}
      WHERE course_id = $1 AND deleted_at IS NULL${statusGuard}
      RETURNING ${COURSE_COLUMNS};
    `;

    const result = await this.executeQuery<CourseRow>(sql, params, client);
    return result.rows[0] || null;
  }

  /**
   * 9. SOFT DELETE DRAFT COURSE
   */
  async softDelete(courseId: string, client?: PoolClient): Promise<CourseRow | null> {
    const sql = `
      UPDATE courses
      SET deleted_at = CURRENT_TIMESTAMP,
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE course_id = $1 AND status = 'draft' AND deleted_at IS NULL
      RETURNING ${COURSE_COLUMNS};
    `;
    const result = await this.executeQuery<CourseRow>(sql, [courseId], client);
    return result.rows[0] || null;
  }

  /**
   * 10. GET CATEGORY (Verification)
   */
  async getCategory(categoryId: string, client?: PoolClient) {
    const sql = `
      SELECT category_id, name, is_active FROM categories WHERE category_id = $1;
    `;
    const res = await this.executeQuery<{
      category_id: string;
      name: string;
      is_active: boolean;
    }>(sql, [categoryId], client);
    return res.rows[0] || null;
  }

  /**
   * 11. GET MEDIA ASSET
   */
  async getMediaAsset(assetId: string, client?: PoolClient) {
    const sql = `
      SELECT asset_id, owner_id, course_id, asset_type, title, duration_seconds, processing_status, is_active, deleted_at
      FROM media_assets
      WHERE asset_id = $1;
    `;
    const res = await this.executeQuery<{
      asset_id: string;
      owner_id: string | null;
      course_id: string | null;
      asset_type: string;
      title: string;
      duration_seconds: number | null;
      processing_status: string;
      is_active: boolean;
      deleted_at: Date | string | null;
    }>(sql, [assetId], client);
    return res.rows[0] || null;
  }

  /**
   * 11b. CREATE MEDIA ASSET (For course promotional videos)
   */
  async createMediaAsset(
    data: {
      ownerId: string;
      courseId?: string;
      assetType: string;
      title: string;
      originalFileName: string;
      mimeType: string;
      fileSizeBytes: number;
      storageProvider?: string;
      storageKey: string;
      visibility?: string;
      processingStatus?: string;
      durationSeconds?: number | null;
    },
    client?: PoolClient,
  ): Promise<any> {
    const sql = `
      INSERT INTO media_assets (
        owner_id, course_id, asset_type, title,
        original_file_name, mime_type, file_size_bytes,
        storage_provider, storage_key, visibility,
        processing_status, duration_seconds, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
      RETURNING asset_id, title, duration_seconds, processing_status, original_file_name, file_size_bytes, mime_type;
    `;
    const res = await this.executeQuery(
      sql,
      [
        data.ownerId,
        data.courseId || null,
        data.assetType || 'video',
        data.title,
        data.originalFileName,
        data.mimeType,
        data.fileSizeBytes,
        data.storageProvider || 'local',
        data.storageKey,
        data.visibility || 'public',
        data.processingStatus || 'ready',
        data.durationSeconds ?? null,
      ],
      client,
    );
    return res.rows[0];
  }

  /**
   * 12. CHECK CURRICULUM (Reads Developer 2 tables)
   */
  async hasActiveCurriculum(courseId: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      SELECT EXISTS (
        SELECT 1 FROM course_lessons l
        JOIN course_sections s ON s.section_id = l.section_id
        WHERE l.course_id = $1 AND l.is_active = TRUE AND s.is_active = TRUE
      ) AS has_curriculum;
    `;
    const res = await this.executeQuery<{ has_curriculum: boolean }>(sql, [courseId], client);
    return Boolean(res.rows[0]?.has_curriculum);
  }

  /**
   * 13. GET COURSE LANGUAGES (Active or all)
   */
  async getCourseLanguages(
    activeOnly: boolean = true,
    client?: PoolClient,
  ): Promise<CourseLanguageRow[]> {
    const sql = `
      SELECT 
        language_id AS "languageId",
        code,
        name,
        native_name AS "nativeName",
        is_default AS "isDefault",
        is_active AS "isActive",
        display_order AS "displayOrder"
      FROM course_languages
      WHERE ($1::boolean = FALSE OR is_active = TRUE)
      ORDER BY display_order ASC, name ASC;
    `;
    const res = await this.executeQuery<CourseLanguageRow>(sql, [activeOnly], client);
    return res.rows;
  }

  /**
   * 14. CREATE COURSE LANGUAGE
   */
  async createCourseLanguage(
    data: {
      code: string;
      name: string;
      nativeName?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
      displayOrder?: number;
    },
    client?: PoolClient,
  ): Promise<CourseLanguageRow> {
    if (data.isDefault === true) {
      await this.executeQuery(
        `UPDATE course_languages SET is_default = FALSE`,
        [],
        client,
      );
    }

    const sql = `
      INSERT INTO course_languages (
        code,
        name,
        native_name,
        is_default,
        is_active,
        display_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        language_id AS "languageId",
        code,
        name,
        native_name AS "nativeName",
        is_default AS "isDefault",
        is_active AS "isActive",
        display_order AS "displayOrder";
    `;
    const params = [
      data.code.trim().toLowerCase(),
      data.name.trim(),
      data.nativeName ? data.nativeName.trim() : null,
      data.isDefault ?? false,
      data.isActive ?? true,
      data.displayOrder ?? 0,
    ];
    const res = await this.executeQuery<CourseLanguageRow>(sql, params, client);
    return res.rows[0];
  }

  /**
   * 15. UPDATE COURSE LANGUAGE
   */
  async updateCourseLanguage(
    languageId: string,
    data: {
      name?: string;
      nativeName?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
      displayOrder?: number;
    },
    client?: PoolClient,
  ): Promise<CourseLanguageRow | null> {
    // If setting as default, automatically undefault all other languages
    if (data.isDefault === true) {
      await this.executeQuery(
        `UPDATE course_languages SET is_default = FALSE WHERE language_id != $1`,
        [languageId],
        client,
      );
    }

    const setClauses: string[] = [];
    const params: any[] = [languageId];

    if (data.name !== undefined) {
      params.push(data.name.trim());
      setClauses.push(`name = $${params.length}`);
    }
    if (data.nativeName !== undefined) {
      params.push(data.nativeName ? data.nativeName.trim() : null);
      setClauses.push(`native_name = $${params.length}`);
    }
    if (data.isDefault !== undefined) {
      params.push(Boolean(data.isDefault));
      setClauses.push(`is_default = $${params.length}`);
    }
    if (data.isActive !== undefined) {
      params.push(Boolean(data.isActive));
      setClauses.push(`is_active = $${params.length}`);
    }
    if (data.displayOrder !== undefined) {
      params.push(Number(data.displayOrder) || 0);
      setClauses.push(`display_order = $${params.length}`);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE course_languages
      SET ${setClauses.join(', ')}
      WHERE language_id = $1
      RETURNING 
        language_id AS "languageId",
        code,
        name,
        native_name AS "nativeName",
        is_default AS "isDefault",
        is_active AS "isActive",
        display_order AS "displayOrder";
    `;
    const res = await this.executeQuery<CourseLanguageRow>(sql, params, client);
    return res.rows[0] || null;
  }

  /**
   * 16. DELETE COURSE LANGUAGE
   */
  async deleteCourseLanguage(languageId: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM course_languages WHERE language_id = $1;`;
    const res = await this.executeQuery(sql, [languageId], client);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * 17. FIND BY ID FOR UPDATE (Pessimistic locking inside a transaction)
   */
  async findByIdForUpdate(
    courseId: string,
    client: PoolClient,
  ): Promise<CourseRow | null> {
    const sql = `
      SELECT 
        course_id, instructor_id, category_id, title, slug, subtitle, description,
        learning_outcomes, requirements, target_audience, level, language,
        is_free, price, discount_price, currency, thumbnail_url, promo_video_asset_id,
        status, rejection_reason, submitted_at, reviewed_by, reviewed_at,
        published_at, archived_at, is_featured, is_active, deleted_at,
        created_at, updated_at
      FROM courses
      WHERE course_id = $1 AND deleted_at IS NULL
      FOR UPDATE;
    `;
    const res = await this.executeQuery<CourseRow>(sql, [courseId], client);
    return res.rows[0] || null;
  }

  /**
   * 18. ATOMIC STATUS UPDATE WITH EXPECTED STATUS CONDITION
   */
  async updateStatus(
    courseId: string,
    expectedStatus: string | string[],
    fields: {
      status: string;
      rejectionReason?: string | null;
      submittedAt?: Date | null;
      reviewedBy?: string | null;
      reviewedAt?: Date | null;
      publishedAt?: Date | null;
      archivedAt?: Date | null;
      isFeatured?: boolean;
    },
    client: PoolClient,
  ): Promise<CourseRow | null> {
    const allowedStatuses = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    const setClauses: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [courseId, fields.status];

    if (fields.rejectionReason !== undefined) {
      params.push(fields.rejectionReason);
      setClauses.push(`rejection_reason = $${params.length}`);
    }
    if (fields.submittedAt !== undefined) {
      params.push(fields.submittedAt);
      setClauses.push(`submitted_at = $${params.length}`);
    }
    if (fields.reviewedBy !== undefined) {
      params.push(fields.reviewedBy);
      setClauses.push(`reviewed_by = $${params.length}`);
    }
    if (fields.reviewedAt !== undefined) {
      params.push(fields.reviewedAt);
      setClauses.push(`reviewed_at = $${params.length}`);
    }
    if (fields.publishedAt !== undefined) {
      params.push(fields.publishedAt);
      setClauses.push(`published_at = $${params.length}`);
    }
    if (fields.archivedAt !== undefined) {
      params.push(fields.archivedAt);
      setClauses.push(`archived_at = $${params.length}`);
    }
    if (fields.isFeatured !== undefined) {
      params.push(fields.isFeatured);
      setClauses.push(`is_featured = $${params.length}`);
    }

    params.push(allowedStatuses);
    const expectedStatusParamIndex = params.length;

    const sql = `
      UPDATE courses
      SET ${setClauses.join(', ')}
      WHERE course_id = $1 
        AND deleted_at IS NULL 
        AND status = ANY($${expectedStatusParamIndex}::varchar[])
      RETURNING 
        course_id, instructor_id, category_id, title, slug, subtitle, description,
        learning_outcomes, requirements, target_audience, level, language,
        is_free, price, discount_price, currency, thumbnail_url, promo_video_asset_id,
        status, rejection_reason, submitted_at, reviewed_by, reviewed_at,
        published_at, archived_at, is_featured, is_active, deleted_at,
        created_at, updated_at;
    `;

    const res = await this.executeQuery<CourseRow>(sql, params, client);
    return res.rows[0] || null;
  }

  /**
   * 19. INSERT STATUS HISTORY RECORD
   */
  async insertStatusHistory(
    entry: {
      courseId: string;
      fromStatus: string | null;
      toStatus: string;
      changedBy?: string | null;
      note?: string | null;
    },
    client: PoolClient,
  ): Promise<CourseStatusHistoryRow> {
    const sql = `
      INSERT INTO course_status_history (
        course_id, from_status, to_status, changed_by, note
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        history_id, course_id, from_status, to_status, changed_by, note, created_at;
    `;
    const res = await this.executeQuery<CourseStatusHistoryRow>(
      sql,
      [entry.courseId, entry.fromStatus, entry.toStatus, entry.changedBy || null, entry.note || null],
      client,
    );
    return res.rows[0];
  }

  /**
   * 20. FIND STATUS HISTORY (Audit Trail)
   */
  async findStatusHistory(courseId: string): Promise<CourseStatusHistoryRow[]> {
    const sql = `
      SELECT 
        h.history_id,
        h.course_id,
        h.from_status,
        h.to_status,
        h.changed_by,
        h.note,
        h.created_at,
        CONCAT(u.first_name, ' ', u.last_name) AS changed_by_name,
        u.email AS changed_by_email
      FROM course_status_history h
      LEFT JOIN users u ON u.user_id = h.changed_by
      WHERE h.course_id = $1
      ORDER BY h.created_at DESC;
    `;
    const res = await this.executeQuery<CourseStatusHistoryRow>(sql, [courseId]);
    return res.rows;
  }

  /**
   * 21. FIND APPROVAL QUEUE
   */
  async findApprovalQueue(query: QueryApprovalDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status = 'pending_review',
      categoryId,
      sortBy = 'submitted_at',
      sortOrder = 'DESC',
    } = query;

    const offset = (page - 1) * limit;
    const conditions: string[] = ["c.deleted_at IS NULL", "c.status != 'draft'"];
    const params: any[] = [];

    if (status && status !== 'all') {
      if (status === 'draft') {
        return { items: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (categoryId) {
      params.push(categoryId);
      conditions.push(`c.category_id = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const pIdx = params.length;
      conditions.push(`(
        LOWER(c.title) LIKE $${pIdx} OR 
        LOWER(c.slug) LIKE $${pIdx} OR 
        LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE $${pIdx} OR
        LOWER(u.email) LIKE $${pIdx}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*) AS total
      FROM courses c
      LEFT JOIN users u ON u.user_id = c.instructor_id
      ${whereClause};
    `;
    const countRes = await this.executeQuery<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const safeSortBy = ['submitted_at', 'created_at', 'updated_at', 'title'].includes(sortBy)
      ? `c.${sortBy}`
      : 'c.submitted_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataSql = `
      SELECT 
        c.course_id,
        c.title,
        c.slug,
        c.subtitle,
        c.status,
        c.level,
        c.language,
        c.is_free,
        c.price,
        c.discount_price,
        c.currency,
        c.thumbnail_url,
        c.is_featured,
        c.submitted_at,
        c.reviewed_at,
        c.created_at,
        c.updated_at,
        c.category_id,
        cat.name AS category_name,
        c.instructor_id,
        CONCAT(u.first_name, ' ', u.last_name) AS instructor_name,
        u.email AS instructor_email,
        (
          SELECT COUNT(*)::int 
          FROM course_sections cs 
          WHERE cs.course_id = c.course_id AND cs.is_active = TRUE
        ) AS section_count,
        (
          SELECT COUNT(*)::int 
          FROM course_lessons cl 
          WHERE cl.course_id = c.course_id AND cl.is_active = TRUE
        ) AS lesson_count,
        (
          SELECT COALESCE(SUM(cl.duration_seconds), 0)::int 
          FROM course_lessons cl 
          WHERE cl.course_id = c.course_id AND cl.is_active = TRUE
        ) AS total_duration_seconds
      FROM courses c
      LEFT JOIN users u ON u.user_id = c.instructor_id
      LEFT JOIN categories cat ON cat.category_id = c.category_id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder} NULLS LAST
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await this.executeQuery<ApprovalQueueRow>(dataSql, dataParams);

    return {
      items: dataRes.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 22. GET APPROVAL STATS
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    const sql = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending_review' AND deleted_at IS NULL)::int AS pending_review,
        COUNT(*) FILTER (WHERE status = 'approved' AND deleted_at IS NULL)::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected' AND deleted_at IS NULL)::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'published' AND deleted_at IS NULL)::int AS published,
        COUNT(*) FILTER (WHERE status = 'archived' AND deleted_at IS NULL)::int AS archived,
        COUNT(*) FILTER (WHERE status = 'draft' AND deleted_at IS NULL)::int AS draft,
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total
      FROM courses;
    `;
    const res = await this.executeQuery<ApprovalStats>(sql);
    return res.rows[0] || {
      pending_review: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      archived: 0,
      draft: 0,
      total: 0,
    };
  }

  /**
   * 23. GET CURRICULUM SUMMARY (Read-only integration with Dev 2 tables)
   */
  async getCurriculumSummary(courseId: string, client?: PoolClient): Promise<CurriculumSummary> {
    const sql = `
      SELECT 
        (
          SELECT COUNT(*)::int 
          FROM course_sections 
          WHERE course_id = $1 AND is_active = TRUE
        ) AS section_count,
        (
          SELECT COUNT(*)::int 
          FROM course_lessons 
          WHERE course_id = $1 AND is_active = TRUE
        ) AS lesson_count,
        (
          SELECT COALESCE(SUM(duration_seconds), 0)::int 
          FROM course_lessons 
          WHERE course_id = $1 AND is_active = TRUE
        ) AS total_duration_seconds,
        (
          SELECT COUNT(*)::int 
          FROM course_lessons 
          WHERE course_id = $1 AND is_active = TRUE AND is_preview = TRUE
        ) AS preview_lesson_count;
    `;
    const res = await this.executeQuery<{
      section_count: number;
      lesson_count: number;
      total_duration_seconds: number;
      preview_lesson_count: number;
    }>(sql, [courseId], client);

    const row = res.rows[0];

    // Query detailed sections and lessons (with media asset metadata) for full review
    let sections: CurriculumSectionDetail[] = [];
    try {
      const secSql = `
        SELECT section_id, title, sort_order
        FROM course_sections
        WHERE course_id = $1 AND is_active = TRUE
        ORDER BY sort_order ASC, created_at ASC;
      `;
      const secRes = await this.executeQuery<{ section_id: string; title: string; sort_order: number }>(
        secSql,
        [courseId],
        client,
      );

      const lesSql = `
        SELECT 
          l.lesson_id, 
          l.section_id, 
          l.title, 
          l.lesson_type, 
          l.duration_seconds, 
          l.is_preview, 
          l.sort_order,
          m.title AS asset_title,
          m.original_file_name AS asset_file_name,
          m.processing_status AS asset_processing_status,
          m.file_size_bytes AS asset_size_bytes
        FROM course_lessons l
        LEFT JOIN media_assets m ON l.content_asset_id = m.asset_id
        WHERE l.course_id = $1 AND l.is_active = TRUE
        ORDER BY l.sort_order ASC, l.created_at ASC;
      `;
      const lesRes = await this.executeQuery<{
        lesson_id: string;
        section_id: string;
        title: string;
        lesson_type: string;
        duration_seconds: number;
        is_preview: boolean;
        sort_order: number;
        asset_title: string | null;
        asset_file_name: string | null;
        asset_processing_status: string | null;
        asset_size_bytes: string | number | null;
      }>(lesSql, [courseId], client);

      const lessonsBySection = new Map<string, CurriculumLessonDetail[]>();
      for (const l of lesRes.rows) {
        const item: CurriculumLessonDetail = {
          lessonId: l.lesson_id,
          sectionId: l.section_id,
          title: l.title,
          lessonType: l.lesson_type,
          durationSeconds: Number(l.duration_seconds) || 0,
          isPreview: Boolean(l.is_preview),
          sortOrder: l.sort_order,
          assetTitle: l.asset_title,
          assetFileName: l.asset_file_name,
          assetProcessingStatus: l.asset_processing_status,
          assetSizeBytes: l.asset_size_bytes ? Number(l.asset_size_bytes) : null,
        };
        if (!lessonsBySection.has(l.section_id)) {
          lessonsBySection.set(l.section_id, []);
        }
        lessonsBySection.get(l.section_id)!.push(item);
      }

      sections = secRes.rows.map((s) => ({
        sectionId: s.section_id,
        title: s.title,
        sortOrder: s.sort_order,
        lessons: lessonsBySection.get(s.section_id) || [],
      }));
    } catch {
      // In case curriculum tables have not been fully populated
      sections = [];
    }

    return {
      sectionCount: row?.section_count || 0,
      lessonCount: row?.lesson_count || 0,
      totalDurationSeconds: row?.total_duration_seconds || 0,
      previewLessonCount: row?.preview_lesson_count || 0,
      sections,
    };
  }

  /**
   * 24. SET FEATURED STATUS
   */
  async setFeatured(
    courseId: string,
    isFeatured: boolean,
    client?: PoolClient,
  ): Promise<CourseRow | null> {
    const sql = `
      UPDATE courses
      SET is_featured = $2, updated_at = CURRENT_TIMESTAMP
      WHERE course_id = $1 AND deleted_at IS NULL
      RETURNING ${COURSE_COLUMNS};
    `;
    const res = await this.executeQuery<CourseRow>(sql, [courseId, isFeatured], client);
    return res.rows[0] || null;
  }
}


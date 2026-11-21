import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CouponRecord, CouponUsageRecord } from './interfaces/coupon.interface';

const COUPON_SELECT = `
  c.coupon_id, c.code, c.description, c.discount_type, c.discount_value,
  c.scope, c.course_id, c.min_order_value, c.max_discount_amount, c.usage_limit,
  c.per_user_limit, c.used_count, c.valid_from, c.valid_until, c.is_active,
  c.created_by, c.created_at, c.updated_at,
  cr.title AS course_title,
  cr.slug AS course_slug,
  cr.instructor_id AS course_instructor_id,
  TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS instructor_name
`;

const COUPON_FROM = `
  FROM coupons c
  LEFT JOIN courses cr ON c.course_id = cr.course_id
  LEFT JOIN users u ON c.created_by = u.user_id
`;

@Injectable()
export class CouponsRepository {
  private readonly logger = new Logger(CouponsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find a coupon by its unique code (case-insensitive) with course details.
   */
  async findCouponByCode(code: string): Promise<CouponRecord | null> {
    const res = await this.db.query<CouponRecord>(
      `
      SELECT ${COUPON_SELECT}
      ${COUPON_FROM}
      WHERE UPPER(c.code) = UPPER($1)
      LIMIT 1;
      `,
      [code.trim()],
    );
    return res.rows[0] || null;
  }

  /**
   * Find a coupon by its UUID with course details.
   */
  async findCouponById(couponId: string): Promise<CouponRecord | null> {
    const res = await this.db.query<CouponRecord>(
      `
      SELECT ${COUPON_SELECT}
      ${COUPON_FROM}
      WHERE c.coupon_id = $1
      LIMIT 1;
      `,
      [couponId],
    );
    return res.rows[0] || null;
  }

  /**
   * List coupons with optional pagination, search, scope, course, instructor, and active status filters.
   */
  async listCoupons(params: {
    limit?: number;
    offset?: number;
    search?: string;
    isActive?: boolean;
    scope?: string;
    courseId?: string;
    createdBy?: string;
    forInstructorId?: string;
  }): Promise<{ items: CouponRecord[]; total: number }> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      conditions.push(`(c.code ILIKE $${values.length} OR c.description ILIKE $${values.length} OR cr.title ILIKE $${values.length})`);
    }

    if (params.isActive !== undefined) {
      values.push(params.isActive);
      conditions.push(`c.is_active = $${values.length}`);
    }

    if (params.scope) {
      values.push(params.scope);
      conditions.push(`c.scope = $${values.length}`);
    }

    if (params.courseId) {
      values.push(params.courseId);
      conditions.push(`c.course_id = $${values.length}`);
    }

    if (params.createdBy) {
      values.push(params.createdBy);
      conditions.push(`c.created_by = $${values.length}`);
    }

    if (params.forInstructorId) {
      values.push(params.forInstructorId);
      conditions.push(
        `(c.scope = 'platform' OR cr.instructor_id = $${values.length} OR c.created_by IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id WHERE r.name IN ('ADMIN', 'SUPER_ADMIN')))`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total ${COUPON_FROM} ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);
    const dataRes = await this.db.query<CouponRecord>(
      `
      SELECT ${COUPON_SELECT}
      ${COUPON_FROM}
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  /**
   * Create a new coupon (supports platform or course-specific scope).
   */
  async createCoupon(data: {
    code: string;
    description?: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    scope?: 'platform' | 'course';
    course_id?: string | null;
    min_order_value?: number;
    max_discount_amount?: number | null;
    usage_limit?: number | null;
    per_user_limit?: number;
    valid_from?: Date;
    valid_until?: Date | null;
    is_active?: boolean;
    created_by?: string | null;
  }): Promise<CouponRecord> {
    const res = await this.db.query<{ coupon_id: string }>(
      `
      INSERT INTO coupons (
        code, description, discount_type, discount_value,
        scope, course_id, min_order_value, max_discount_amount,
        usage_limit, per_user_limit, valid_from, valid_until,
        is_active, created_by, created_at, updated_at
      )
      VALUES (
        UPPER($1), $2, $3, $4,
        COALESCE($5, 'platform'), $6, $7, $8,
        $9, $10, COALESCE($11, CURRENT_TIMESTAMP), $12,
        COALESCE($13, true), $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING coupon_id;
      `,
      [
        data.code.trim(),
        data.description || null,
        data.discount_type,
        data.discount_value,
        data.scope || 'platform',
        data.course_id || null,
        data.min_order_value ?? 0,
        data.max_discount_amount || null,
        data.usage_limit || null,
        data.per_user_limit ?? 1,
        data.valid_from || null,
        data.valid_until || null,
        data.is_active ?? true,
        data.created_by || null,
      ],
    );

    return (await this.findCouponById(res.rows[0].coupon_id))!;
  }

  /**
   * Update an existing coupon.
   */
  async updateCoupon(
    couponId: string,
    data: Partial<{
      code: string;
      description: string | null;
      discount_type: 'percentage' | 'fixed';
      discount_value: number;
      scope: 'platform' | 'course';
      course_id: string | null;
      min_order_value: number;
      max_discount_amount: number | null;
      usage_limit: number | null;
      per_user_limit: number;
      valid_from: Date;
      valid_until: Date | null;
      is_active: boolean;
    }>,
  ): Promise<CouponRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.code !== undefined) {
      values.push(data.code.trim().toUpperCase());
      fields.push(`code = $${values.length}`);
    }
    if (data.description !== undefined) {
      values.push(data.description);
      fields.push(`description = $${values.length}`);
    }
    if (data.discount_type !== undefined) {
      values.push(data.discount_type);
      fields.push(`discount_type = $${values.length}`);
    }
    if (data.discount_value !== undefined) {
      values.push(data.discount_value);
      fields.push(`discount_value = $${values.length}`);
    }
    if (data.scope !== undefined) {
      values.push(data.scope);
      fields.push(`scope = $${values.length}`);
    }
    if (data.course_id !== undefined) {
      values.push(data.course_id);
      fields.push(`course_id = $${values.length}`);
    }
    if (data.min_order_value !== undefined) {
      values.push(data.min_order_value);
      fields.push(`min_order_value = $${values.length}`);
    }
    if (data.max_discount_amount !== undefined) {
      values.push(data.max_discount_amount);
      fields.push(`max_discount_amount = $${values.length}`);
    }
    if (data.usage_limit !== undefined) {
      values.push(data.usage_limit);
      fields.push(`usage_limit = $${values.length}`);
    }
    if (data.per_user_limit !== undefined) {
      values.push(data.per_user_limit);
      fields.push(`per_user_limit = $${values.length}`);
    }
    if (data.valid_from !== undefined) {
      values.push(data.valid_from);
      fields.push(`valid_from = $${values.length}`);
    }
    if (data.valid_until !== undefined) {
      values.push(data.valid_until);
      fields.push(`valid_until = $${values.length}`);
    }
    if (data.is_active !== undefined) {
      values.push(data.is_active);
      fields.push(`is_active = $${values.length}`);
    }

    if (fields.length === 0) {
      return this.findCouponById(couponId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(couponId);

    await this.db.query(
      `
      UPDATE coupons
      SET ${fields.join(', ')}
      WHERE coupon_id = $${values.length};
      `,
      values,
    );

    return this.findCouponById(couponId);
  }

  /**
   * Delete a coupon.
   */
  async deleteCoupon(couponId: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM coupons WHERE coupon_id = $1;`,
      [couponId],
    );
    return (res.rowCount || 0) > 0;
  }

  /**
   * Count how many times a student has redeemed this coupon.
   */
  async countStudentUsages(couponId: string, studentId: string): Promise<number> {
    const res = await this.db.query(
      `
      SELECT COUNT(*)::int AS count
      FROM coupon_usages
      WHERE coupon_id = $1 AND student_id = $2;
      `,
      [couponId, studentId],
    );
    return res.rows[0]?.count || 0;
  }

  /**
   * Record a redemption in coupon_usages and increment used_count.
   */
  async recordCouponUsage(
    couponId: string,
    studentId: string,
    discountAmount: number,
    orderId?: string,
    client?: PoolClient,
  ): Promise<CouponUsageRecord> {
    const query = `
      INSERT INTO coupon_usages (coupon_id, student_id, order_id, discount_amount, used_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING usage_id, coupon_id, student_id, order_id, discount_amount, used_at;
    `;
    const params = [couponId, studentId, orderId || null, discountAmount];

    const res = client
      ? await client.query<CouponUsageRecord>(query, params)
      : await this.db.query<CouponUsageRecord>(query, params);

    const updateQuery = `
      UPDATE coupons
      SET used_count = used_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE coupon_id = $1;
    `;
    if (client) {
      await client.query(updateQuery, [couponId]);
    } else {
      await this.db.query(updateQuery, [couponId]);
    }

    return res.rows[0];
  }

  /**
   * Fetch published paid courses belonging to an instructor (for the coupon dropdown).
   */
  async findInstructorPublishedCourses(instructorId: string): Promise<any[]> {
    const res = await this.db.query(
      `
      SELECT course_id AS "courseId", course_id, title, slug, price::float AS price, discount_price AS "discountPrice", currency, status, is_active AS "isActive"
      FROM courses
      WHERE instructor_id = $1
        AND status = 'published'
        AND is_active = true
        AND deleted_at IS NULL
        AND (is_free = false AND price > 0)
      ORDER BY title ASC;
      `,
      [instructorId],
    );
    return res.rows;
  }

  /**
   * Fetch all platform published paid courses (for Admin/Super Admin coupon dropdown).
   */
  async findAllPublishedCourses(): Promise<any[]> {
    const res = await this.db.query(
      `
      SELECT course_id AS "courseId", course_id, title, slug, price::float AS price, discount_price AS "discountPrice", currency, status, is_active AS "isActive"
      FROM courses
      WHERE status = 'published'
        AND is_active = true
        AND deleted_at IS NULL
        AND (is_free = false AND price > 0)
      ORDER BY title ASC;
      `,
    );
    return res.rows;
  }

  /**
   * Find course by ID for ownership and status validation.
   */
  async findCourseById(courseId: string): Promise<any | null> {
    const res = await this.db.query(
      `
      SELECT course_id, title, slug, price, discount_price, currency, status, is_active, is_free, instructor_id
      FROM courses
      WHERE course_id = $1 AND deleted_at IS NULL
      LIMIT 1;
      `,
      [courseId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find coupon currently attached or proposed for a specific course.
   */
  async findCourseCoupon(courseId: string): Promise<CouponRecord | null> {
    const res = await this.db.query<CouponRecord>(
      `
      SELECT ${COUPON_SELECT}
      ${COUPON_FROM}
      WHERE c.course_id = $1
      ORDER BY c.created_at DESC
      LIMIT 1;
      `,
      [courseId],
    );
    return res.rows[0] || null;
  }

  /**
   * Remove any coupon linked to a specific course.
   */
  async deleteCourseCoupons(courseId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM coupons WHERE course_id = $1;`,
      [courseId],
    );
  }

  /**
   * Activate all coupons linked to a specific course upon course approval/publishing.
   */
  async activateCourseCoupons(courseId: string, client?: PoolClient): Promise<void> {
    const q = `UPDATE coupons SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE course_id = $1;`;
    if (client) {
      await client.query(q, [courseId]);
    } else {
      await this.db.query(q, [courseId]);
    }
  }
}

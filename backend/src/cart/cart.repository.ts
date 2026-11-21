import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CartRecord, CartItemRow } from './interfaces/cart.interface';
import { CouponRecord } from '../coupons/interfaces/coupon.interface';

@Injectable()
export class CartRepository {
  private readonly logger = new Logger(CartRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find an existing cart for a student.
   */
  async findCartByStudentId(studentId: string): Promise<CartRecord | null> {
    const res = await this.db.query<CartRecord>(
      `
      SELECT cart_id, student_id, applied_coupon_id, created_at, updated_at
      FROM carts
      WHERE student_id = $1
      LIMIT 1;
      `,
      [studentId],
    );
    return res.rows[0] || null;
  }

  /**
   * Create a new persistent cart for a student.
   */
  async createCart(studentId: string): Promise<CartRecord> {
    const res = await this.db.query<CartRecord>(
      `
      INSERT INTO carts (student_id, created_at, updated_at)
      VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id) DO UPDATE
        SET updated_at = CURRENT_TIMESTAMP
      RETURNING cart_id, student_id, applied_coupon_id, created_at, updated_at;
      `,
      [studentId],
    );
    return res.rows[0];
  }

  /**
   * Update the updated_at timestamp of a cart.
   */
  async touchCart(cartId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE carts
      SET updated_at = CURRENT_TIMESTAMP
      WHERE cart_id = $1;
      `,
      [cartId],
    );
  }

  /**
   * Find applied coupon by its ID with course details if course-scoped.
   */
  async findAppliedCoupon(couponId: string): Promise<CouponRecord | null> {
    const res = await this.db.query<CouponRecord>(
      `
      SELECT c.coupon_id, c.code, c.description, c.discount_type, c.discount_value,
             c.scope, c.course_id,
             c.min_order_value, c.max_discount_amount, c.usage_limit, c.per_user_limit,
             c.used_count, c.valid_from, c.valid_until, c.is_active, c.created_by,
             c.created_at, c.updated_at,
             crs.title AS course_title,
             crs.slug AS course_slug
      FROM coupons c
      LEFT JOIN courses crs ON crs.course_id = c.course_id
      WHERE c.coupon_id = $1
      LIMIT 1;
      `,
      [couponId],
    );
    return res.rows[0] || null;
  }

  /**
   * Associate an active coupon with a cart.
   */
  async applyCouponToCart(cartId: string, couponId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE carts
      SET applied_coupon_id = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE cart_id = $1;
      `,
      [cartId, couponId],
    );
  }

  /**
   * Remove/detach applied coupon from a cart.
   */
  async removeCouponFromCart(cartId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE carts
      SET applied_coupon_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE cart_id = $1;
      `,
      [cartId],
    );
  }

  /**
   * Find a course with current pricing and availability details.
   * Explicitly avoids search_vector and internal vectors.
   */
  async findCourseForCart(courseId: string): Promise<any | null> {
    const res = await this.db.query(
      `
      SELECT course_id, instructor_id, title, slug, subtitle, level,
             is_free, price, discount_price, currency, thumbnail_url,
             status, is_active, deleted_at
      FROM courses
      WHERE course_id = $1
        AND deleted_at IS NULL
      LIMIT 1;
      `,
      [courseId],
    );
    return res.rows[0] || null;
  }

  /**
   * Check if a course is already enrolled by the student.
   */
  async findStudentEnrollment(studentId: string, courseId: string): Promise<any | null> {
    const res = await this.db.query(
      `
      SELECT enrollment_id, student_id, course_id, enrollment_status,
             enrollment_type, amount_paid, currency
      FROM course_enrollments
      WHERE student_id = $1 AND course_id = $2
      LIMIT 1;
      `,
      [studentId, courseId],
    );
    return res.rows[0] || null;
  }

  /**
   * Check if a specific course is already present in a cart.
   */
  async findCartItem(cartId: string, courseId: string): Promise<any | null> {
    const res = await this.db.query(
      `
      SELECT cart_item_id, cart_id, course_id, price_at_addition, created_at
      FROM cart_items
      WHERE cart_id = $1 AND course_id = $2
      LIMIT 1;
      `,
      [cartId, courseId],
    );
    return res.rows[0] || null;
  }

  /**
   * Fetch all items in a cart with live course details and instructor names.
   */
  async findCartItems(cartId: string): Promise<CartItemRow[]> {
    const res = await this.db.query<CartItemRow>(
      `
      SELECT
        ci.cart_item_id,
        ci.cart_id,
        ci.course_id,
        ci.price_at_addition,
        ci.created_at AS added_at,
        c.title,
        c.slug,
        c.subtitle,
        c.thumbnail_url,
        c.level,
        c.is_free,
        c.price,
        c.discount_price,
        c.currency,
        c.status,
        c.is_active,
        c.deleted_at,
        c.instructor_id,
        u.first_name,
        u.last_name
      FROM cart_items ci
      JOIN courses c ON c.course_id = ci.course_id
      LEFT JOIN users u ON u.user_id = c.instructor_id
      WHERE ci.cart_id = $1
      ORDER BY ci.created_at DESC;
      `,
      [cartId],
    );
    return res.rows;
  }

  /**
   * Add a course to a cart.
   */
  async addCartItem(cartId: string, courseId: string, priceAtAddition: number): Promise<void> {
    await this.db.query(
      `
      INSERT INTO cart_items (cart_id, course_id, price_at_addition, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (cart_id, course_id) DO NOTHING;
      `,
      [cartId, courseId, priceAtAddition],
    );
  }

  /**
   * Remove a single course from a cart.
   */
  async removeCartItem(cartId: string, courseId: string): Promise<boolean> {
    const res = await this.db.query(
      `
      DELETE FROM cart_items
      WHERE cart_id = $1 AND course_id = $2;
      `,
      [cartId, courseId],
    );
    return (res.rowCount || 0) > 0;
  }

  /**
   * Clear all items in a cart.
   */
  async clearCart(cartId: string): Promise<void> {
    await this.db.query(
      `
      DELETE FROM cart_items
      WHERE cart_id = $1;
      `,
      [cartId],
    );
  }

  /**
   * Transactional and duplicate-safe free course enrollment.
   * Enrolls student, removes item from cart (if present), and updates cart timestamp.
   */
  async enrollFreeCourseTransactional(
    studentId: string,
    courseId: string,
    cartId?: string,
  ): Promise<{ alreadyEnrolled: boolean; enrollment: any }> {
    return this.db.withTransaction(async (client) => {
      // 1. Check existing enrollment with lock
      const existingRes = await client.query(
        `
        SELECT enrollment_id, student_id, course_id, enrollment_status,
               enrollment_type, amount_paid, currency, enrolled_at
        FROM course_enrollments
        WHERE student_id = $1 AND course_id = $2
        FOR UPDATE;
        `,
        [studentId, courseId],
      );

      let enrollment = existingRes.rows[0] || null;
      let alreadyEnrolled = false;

      if (enrollment) {
        alreadyEnrolled = true;
      } else {
        // 2. Insert new free enrollment
        const insertRes = await client.query(
          `
          INSERT INTO course_enrollments (
            student_id, course_id, enrollment_status, enrollment_type, amount_paid, currency
          )
          SELECT $1, c.course_id, 'active', 'free', 0, c.currency
          FROM courses c
          WHERE c.course_id = $2
          ON CONFLICT (student_id, course_id) DO NOTHING
          RETURNING *;
          `,
          [studentId, courseId],
        );

        if (insertRes.rows[0]) {
          enrollment = insertRes.rows[0];
        } else {
          // Handled concurrent race
          const raceRes = await client.query(
            `
            SELECT enrollment_id, student_id, course_id, enrollment_status,
                   enrollment_type, amount_paid, currency, enrolled_at
            FROM course_enrollments
            WHERE student_id = $1 AND course_id = $2;
            `,
            [studentId, courseId],
          );
          enrollment = raceRes.rows[0];
          alreadyEnrolled = true;
        }
      }

      // 3. If cart exists, remove course from cart items and update cart updated_at
      if (cartId) {
        await client.query(
          `
          DELETE FROM cart_items
          WHERE cart_id = $1 AND course_id = $2;
          `,
          [cartId, courseId],
        );

        await client.query(
          `
          UPDATE carts
          SET updated_at = CURRENT_TIMESTAMP
          WHERE cart_id = $1;
          `,
          [cartId],
        );
      }

      return { alreadyEnrolled, enrollment };
    });
  }

  /**
   * Find active, valid coupons applicable either platform-wide
   * or targeted to any of the course IDs currently in the cart.
   */
  async findAvailableCouponsForCart(courseIds: string[]): Promise<CouponRecord[]> {
    const values: any[] = [];
    let courseCondition = '';

    if (courseIds.length > 0) {
      values.push(courseIds);
      courseCondition = `OR (c.scope = 'course' AND c.course_id = ANY($${values.length}::uuid[]))`;
    }

    const query = `
      SELECT c.coupon_id, c.code, c.description, c.discount_type, c.discount_value,
             c.scope, c.course_id,
             c.min_order_value, c.max_discount_amount, c.usage_limit, c.per_user_limit,
             c.used_count, c.valid_from, c.valid_until, c.is_active, c.created_by,
             c.created_at, c.updated_at,
             crs.title AS course_title,
             crs.slug AS course_slug
      FROM coupons c
      LEFT JOIN courses crs ON crs.course_id = c.course_id
      WHERE c.is_active = TRUE
        AND c.valid_from <= CURRENT_TIMESTAMP
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP)
        AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
        AND (
          c.scope = 'platform'
          ${courseCondition}
        )
      ORDER BY c.discount_value DESC;
    `;

    const res = await this.db.query<CouponRecord>(query, values);
    return res.rows;
  }

  /**
   * Count how many times a student has redeemed a specific coupon.
   */
  async countStudentCouponUsages(couponId: string, studentId: string): Promise<number> {
    const res = await this.db.query<{ count: string }>(
      `
      SELECT COUNT(*)::int AS count
      FROM coupon_usages
      WHERE coupon_id = $1 AND student_id = $2;
      `,
      [couponId, studentId],
    );
    return Number(res.rows[0]?.count || 0);
  }
}


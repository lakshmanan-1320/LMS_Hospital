import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  OrderRecord,
  OrderItemRecord,
  OrderStatus,
  OrderPaymentStatus,
} from './interfaces/order.interface';

const ORDER_COLUMNS = `
  order_id, order_number, student_id, status, currency,
  subtotal, course_discount, coupon_id, coupon_code,
  coupon_discount, total_discount, total_amount, total_in_paise,
  payment_order_id, payment_id, payment_status, payment_method,
  paid_at, invoice_number, billing_details, metadata, created_at, updated_at
`;

const ORDER_ITEM_COLUMNS = `
  order_item_id, order_id, course_id, instructor_id, title,
  slug, regular_price, sale_price, final_price, currency,
  enrollment_id, created_at
`;

@Injectable()
export class OrdersRepository {
  private readonly logger = new Logger(OrdersRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find an order by UUID.
   */
  async findOrderById(orderId: string): Promise<OrderRecord | null> {
    const res = await this.db.query<OrderRecord>(
      `
      SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE order_id = $1
      LIMIT 1;
      `,
      [orderId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find an order by human-readable order number (e.g. ORD-20261117-XXXX).
   */
  async findOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
    const res = await this.db.query<OrderRecord>(
      `
      SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE order_number = $1
      LIMIT 1;
      `,
      [orderNumber],
    );
    return res.rows[0] || null;
  }

  /**
   * Find the order (if any) already created from a Razorpay order id.
   * Used to stop one verified payment from being redeemed for more than one order.
   */
  async findOrderByPaymentOrderId(paymentOrderId: string): Promise<OrderRecord | null> {
    const res = await this.db.query<OrderRecord>(
      `
      SELECT ${ORDER_COLUMNS}
      FROM orders
      WHERE payment_order_id = $1
      LIMIT 1;
      `,
      [paymentOrderId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find all line items for an order.
   */
  async findOrderItems(orderId: string): Promise<OrderItemRecord[]> {
    const res = await this.db.query<OrderItemRecord>(
      `
      SELECT 
        oi.order_item_id, oi.order_id, oi.course_id, oi.instructor_id, oi.title,
        oi.slug, oi.regular_price, oi.sale_price, oi.final_price, oi.currency,
        oi.enrollment_id, oi.created_at,
        COALESCE(c.is_refundable, TRUE) AS is_refundable,
        COALESCE(c.refund_period_days, 30)::int AS refund_period_days
      FROM order_items oi
      LEFT JOIN courses c ON oi.course_id = c.course_id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC;
      `,
      [orderId],
    );
    return res.rows;
  }

  /**
   * Find line items for multiple orders in batch.
   */
  async findOrderItemsByOrderIds(orderIds: string[]): Promise<OrderItemRecord[]> {
    if (!orderIds || orderIds.length === 0) return [];
    const res = await this.db.query<OrderItemRecord>(
      `
      SELECT 
        oi.order_item_id, oi.order_id, oi.course_id, oi.instructor_id, oi.title,
        oi.slug, oi.regular_price, oi.sale_price, oi.final_price, oi.currency,
        oi.enrollment_id, oi.created_at,
        COALESCE(c.is_refundable, TRUE) AS is_refundable,
        COALESCE(c.refund_period_days, 30)::int AS refund_period_days
      FROM order_items oi
      LEFT JOIN courses c ON oi.course_id = c.course_id
      WHERE oi.order_id = ANY($1::uuid[])
      ORDER BY oi.created_at ASC;
      `,
      [orderIds],
    );
    return res.rows;
  }

  /**
   * Check existing active enrollments for a student against a list of course IDs.
   */
  async findActiveEnrollments(studentId: string, courseIds: string[]): Promise<any[]> {
    if (courseIds.length === 0) return [];
    const res = await this.db.query(
      `
      SELECT enrollment_id, course_id, enrollment_status
      FROM course_enrollments
      WHERE student_id = $1
        AND course_id = ANY($2::uuid[])
        AND enrollment_status IN ('active', 'completed');
      `,
      [studentId, courseIds],
    );
    return res.rows;
  }

  /**
   * List orders for a specific student with pagination and search.
   */
  async listStudentOrders(
    studentId: string,
    params: { limit?: number; offset?: number; status?: OrderStatus; search?: string },
  ): Promise<{ items: OrderRecord[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = ['student_id = $1'];
    const values: any[] = [studentId];

    if (params.status) {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      conditions.push(`(order_number ILIKE $${values.length} OR invoice_number ILIKE $${values.length})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM orders ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);

    const dataRes = await this.db.query<OrderRecord>(
      `
      SELECT ${ORDER_COLUMNS}
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  /**
   * List all orders across platform (Admin / Super Admin).
   */
  async listAllOrders(params: {
    limit?: number;
    offset?: number;
    status?: OrderStatus;
    search?: string;
  }): Promise<{ items: OrderRecord[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.status) {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }

    if (params.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      conditions.push(
        `(order_number ILIKE $${values.length} OR invoice_number ILIKE $${values.length})`,
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM orders ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);

    const dataRes = await this.db.query<OrderRecord>(
      `
      SELECT ${ORDER_COLUMNS}
      FROM orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  /**
   * Complete transactional checkout execution:
   * 1. Creates order in 'orders' table
   * 2. Inserts line items in 'order_items'
   * 3. Dispatches course enrollments in 'course_enrollments' (paid & free)
   * 4. Links enrollment_id to order_items
   * 5. Records coupon redemption in 'coupon_usages' and increments used_count
   * 6. Clears student cart items and detaches coupon
   * 7. Updates payment_transactions state to captured
   */
  async executeCheckoutTransaction(data: {
    orderNumber: string;
    invoiceNumber: string;
    studentId: string;
    cartId: string;
    subtotal: number;
    courseDiscount: number;
    couponId: string | null;
    couponCode: string | null;
    couponDiscount: number;
    totalDiscount: number;
    totalAmount: number;
    totalInPaise: number;
    currency: string;
    paymentOrderId: string | null;
    paymentId: string | null;
    paymentStatus: OrderPaymentStatus;
    paymentMethod: string;
    billingDetails?: Record<string, any>;
    metadata?: Record<string, any>;
    items: Array<{
      courseId: string;
      instructorId: string;
      title: string;
      slug: string;
      regularPrice: number;
      salePrice: number | null;
      finalPrice: number;
      currency: string;
      isFree: boolean;
    }>;
  }): Promise<{ order: OrderRecord; items: OrderItemRecord[] }> {
    return this.db.withTransaction(async (client: PoolClient) => {
      // 1. Insert into orders
      const orderRes = await client.query<OrderRecord>(
        `
        INSERT INTO orders (
          order_number, student_id, status, currency,
          subtotal, course_discount, coupon_id, coupon_code,
          coupon_discount, total_discount, total_amount, total_in_paise,
          payment_order_id, payment_id, payment_status, payment_method,
          paid_at, invoice_number, billing_details, metadata, created_at, updated_at
        )
        VALUES (
          $1, $2, 'completed', $3,
          $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15,
          CURRENT_TIMESTAMP, $16, $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING ${ORDER_COLUMNS};
        `,
        [
          data.orderNumber,
          data.studentId,
          data.currency,
          data.subtotal,
          data.courseDiscount,
          data.couponId,
          data.couponCode,
          data.couponDiscount,
          data.totalDiscount,
          data.totalAmount,
          data.totalInPaise,
          data.paymentOrderId,
          data.paymentId,
          data.paymentStatus,
          data.paymentMethod,
          data.invoiceNumber,
          data.billingDetails || {},
          data.metadata || {},
        ],
      );

      const createdOrder = orderRes.rows[0];
      const createdItems: OrderItemRecord[] = [];

      // 2. Process each item: insert into order_items and dispatch course_enrollments
      for (const item of data.items) {
        const enrollmentType = item.isFree ? 'free' : 'paid';

        // 2a. Insert or activate enrollment in course_enrollments
        const enrollRes = await client.query(
          `
          INSERT INTO course_enrollments (
            student_id, course_id, enrollment_status, enrollment_type,
            amount_paid, currency, enrolled_at, order_id
          )
          VALUES ($1, $2, 'active', $3, $4, $5, CURRENT_TIMESTAMP, $6)
          ON CONFLICT (student_id, course_id) DO UPDATE
            SET enrollment_status = 'active',
                enrollment_type = EXCLUDED.enrollment_type,
                amount_paid = EXCLUDED.amount_paid,
                order_id = EXCLUDED.order_id,
                updated_at = CURRENT_TIMESTAMP
          RETURNING enrollment_id;
          `,
          [
            data.studentId,
            item.courseId,
            enrollmentType,
            item.finalPrice,
            item.currency,
            createdOrder.order_id,
          ],
        );
        const enrollmentId = enrollRes.rows[0]?.enrollment_id || null;

        // 2b. Insert line item in order_items
        const itemRes = await client.query<OrderItemRecord>(
          `
          INSERT INTO order_items (
            order_id, course_id, instructor_id, title, slug,
            regular_price, sale_price, final_price, currency,
            enrollment_id, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
          RETURNING ${ORDER_ITEM_COLUMNS};
          `,
          [
            createdOrder.order_id,
            item.courseId,
            item.instructorId,
            item.title,
            item.slug,
            item.regularPrice,
            item.salePrice,
            item.finalPrice,
            item.currency,
            enrollmentId,
          ],
        );

        createdItems.push(itemRes.rows[0]);
      }

      // 3. Record coupon usage if a coupon was redeemed
      if (data.couponId && data.couponDiscount > 0) {
        await client.query(
          `
          INSERT INTO coupon_usages (coupon_id, student_id, order_id, discount_amount, used_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP);
          `,
          [data.couponId, data.studentId, createdOrder.order_id, data.couponDiscount],
        );

        await client.query(
          `
          UPDATE coupons
          SET used_count = used_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE coupon_id = $1;
          `,
          [data.couponId],
        );
      }

      // 4. Clear student cart and unset applied coupon
      await client.query(`DELETE FROM cart_items WHERE cart_id = $1;`, [data.cartId]);
      await client.query(
        `
        UPDATE carts
        SET applied_coupon_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE cart_id = $1;
        `,
        [data.cartId],
      );

      // 5. Update payment_transactions status to captured if paymentOrderId provided
      if (data.paymentOrderId) {
        await client.query(
          `
          UPDATE payment_transactions
          SET status = 'captured',
              payment_id = COALESCE($2, payment_id),
              updated_at = CURRENT_TIMESTAMP
          WHERE order_id = $1;
          `,
          [data.paymentOrderId, data.paymentId],
        );
      }

      return { order: createdOrder, items: createdItems };
    });
  }
}


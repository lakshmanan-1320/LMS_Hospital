import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  RefundRecord,
  FinancialAuditLogRecord,
  RefundStatus,
  FinancialEventType,
} from './interfaces/refund.interface';

const REFUND_COLUMNS = `
  refund_id, order_id, student_id, refund_number, amount,
  amount_in_paise, currency, status, reason, admin_notes,
  gateway_refund_id, reviewed_by, reviewed_at, processed_at,
  created_at, updated_at
`;

const AUDIT_LOG_COLUMNS = `
  log_id, order_id, refund_id, student_id, actor_id,
  event_type, amount, currency, description, metadata, created_at
`;

@Injectable()
export class RefundsRepository {
  private readonly logger = new Logger(RefundsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new refund request record.
   */
  async createRefundRequest(data: {
    order_id: string;
    student_id: string;
    refund_number: string;
    amount: number;
    amount_in_paise: number;
    currency: string;
    reason: string;
  }): Promise<RefundRecord> {
    const res = await this.db.query<RefundRecord>(
      `
      INSERT INTO order_refunds (
        order_id, student_id, refund_number, amount,
        amount_in_paise, currency, status, reason, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING ${REFUND_COLUMNS};
      `,
      [
        data.order_id,
        data.student_id,
        data.refund_number,
        data.amount,
        data.amount_in_paise,
        data.currency,
        data.reason,
      ],
    );
    return res.rows[0];
  }

  /**
   * Find a refund by its UUID.
   */
  async findRefundById(refundId: string): Promise<RefundRecord | null> {
    const res = await this.db.query<RefundRecord>(
      `
      SELECT ${REFUND_COLUMNS}
      FROM order_refunds
      WHERE refund_id = $1
      LIMIT 1;
      `,
      [refundId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find a refund by its unique number (e.g. RFND-20261117-XXXX).
   */
  async findRefundByNumber(refundNumber: string): Promise<RefundRecord | null> {
    const res = await this.db.query<RefundRecord>(
      `
      SELECT ${REFUND_COLUMNS}
      FROM order_refunds
      WHERE refund_number = $1
      LIMIT 1;
      `,
      [refundNumber],
    );
    return res.rows[0] || null;
  }

  /**
   * Find active (pending, approved, processed) refunds for an order.
   */
  async findActiveRefundForOrder(orderId: string): Promise<RefundRecord | null> {
    const res = await this.db.query<RefundRecord>(
      `
      SELECT ${REFUND_COLUMNS}
      FROM order_refunds
      WHERE order_id = $1 AND status IN ('pending', 'approved', 'processed')
      LIMIT 1;
      `,
      [orderId],
    );
    return res.rows[0] || null;
  }

  /**
   * Check dynamic refund eligibility for an order and student:
   * 1. Query order items joined with courses table (is_refundable, refund_period_days).
   * 2. Calculate curriculum progress from student_lesson_progress & course_lessons.
   * 3. Evaluate dynamic rules:
   *    - Is the course refundable? (is_refundable !== false)
   *    - Has the dynamic refund window expired? (order_age_days <= refund_period_days)
   *    - Has consumption exceeded Udemy anti-abuse threshold (progress_percent >= 50%)?
   */
  async checkOrderRefundEligibility(orderId: string, studentId: string): Promise<{
    eligible: boolean;
    reasons: string[];
    courses: Array<{
      courseId: string;
      title: string;
      isRefundable: boolean;
      refundPeriodDays: number;
      totalLessons: number;
      completedLessons: number;
      progressPercent: number;
      isDisqualifiedByConsumption: boolean;
      isDisqualifiedByWindow: boolean;
      isDisqualifiedByPolicy: boolean;
    }>;
  }> {
    const res = await this.db.query<{
      course_id: string;
      title: string;
      is_refundable: boolean;
      refund_period_days: number;
      total_lessons: string;
      completed_lessons: string;
      order_created_at: Date;
    }>(
      `
      SELECT 
        oi.course_id,
        oi.title,
        COALESCE(c.is_refundable, TRUE) AS is_refundable,
        COALESCE(c.refund_period_days, 30)::int AS refund_period_days,
        COALESCE(tl.total_lessons, 0)::text AS total_lessons,
        COALESCE(cl.completed_lessons, 0)::text AS completed_lessons,
        o.created_at AS order_created_at
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN courses c ON oi.course_id = c.course_id
      LEFT JOIN (
        SELECT course_id, COUNT(*)::int AS total_lessons
        FROM course_lessons
        GROUP BY course_id
      ) tl ON tl.course_id = oi.course_id
      LEFT JOIN (
        SELECT slp.course_id, COUNT(*)::int AS completed_lessons
        FROM student_lesson_progress slp
        WHERE slp.student_id = $2 AND slp.is_completed = TRUE
        GROUP BY slp.course_id
      ) cl ON cl.course_id = oi.course_id
      WHERE oi.order_id = $1;
      `,
      [orderId, studentId],
    );

    // 0. Query platform-level refund policy from system_settings
    const policyRes = await this.db.query<{ setting_value: any }>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'refund_policy' LIMIT 1;`,
    );
    const globalPolicy = policyRes.rows[0]?.setting_value || {};
    const allowGlobal = globalPolicy.allowGlobalRefunds !== false;
    const enforcementMode = globalPolicy.policyEnforcementMode || 'flexible';
    const antiAbuseThreshold = Number(globalPolicy.antiAbuseConsumptionThresholdPercent || 50);
    const platformDefaultPeriod = Number(globalPolicy.defaultRefundPeriodDays || 30);

    const reasons: string[] = [];

    if (!allowGlobal || enforcementMode === 'strict_no_refunds') {
      reasons.push(
        'Platform Refund Policy: Refunds are currently disabled platform-wide by platform administration.',
      );
    }

    const courses = res.rows.map((row) => {
      const totalLessons = parseInt(row.total_lessons, 10) || 0;
      const completedLessons = parseInt(row.completed_lessons, 10) || 0;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      let isRefundable = row.is_refundable ?? true;
      let refundPeriodDays = Number(row.refund_period_days ?? platformDefaultPeriod);

      if (!allowGlobal || enforcementMode === 'strict_no_refunds') {
        isRefundable = false;
      } else if (enforcementMode === 'enforce_platform_guarantee') {
        isRefundable = true;
        refundPeriodDays = platformDefaultPeriod;
      }

      const orderAgeDays = (Date.now() - new Date(row.order_created_at).getTime()) / (1000 * 60 * 60 * 24);

      const isDisqualifiedByPolicy = !isRefundable;
      const isDisqualifiedByWindow = orderAgeDays > refundPeriodDays;
      const isDisqualifiedByConsumption = totalLessons > 0 && progressPercent >= antiAbuseThreshold;

      if (isDisqualifiedByPolicy) {
        reasons.push(`Course "${row.title}" is marked as non-refundable.`);
      }
      if (isDisqualifiedByWindow) {
        reasons.push(
          `The ${refundPeriodDays}-day refund window for "${row.title}" has expired (${Math.floor(orderAgeDays)} days since purchase).`,
        );
      }
      if (isDisqualifiedByConsumption) {
        reasons.push(
          `Udemy Anti-Abuse Protection: More than ${antiAbuseThreshold}% (${progressPercent}%) of "${row.title}" curriculum has already been consumed.`,
        );
      }

      return {
        courseId: row.course_id,
        title: row.title,
        isRefundable,
        refundPeriodDays,
        totalLessons,
        completedLessons,
        progressPercent,
        isDisqualifiedByConsumption,
        isDisqualifiedByWindow,
        isDisqualifiedByPolicy,
      };
    });

    return {
      eligible: reasons.length === 0,
      reasons,
      courses,
    };
  }

  /**
   * List refunds for a specific student.
   */
  async listStudentRefunds(
    studentId: string,
    params: { limit?: number; offset?: number; status?: RefundStatus },
  ): Promise<{ items: RefundRecord[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = ['student_id = $1'];
    const values: any[] = [studentId];

    if (params.status) {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM order_refunds ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);

    const dataRes = await this.db.query<any>(
      `
      SELECT
        r.refund_id, r.order_id, r.student_id, r.refund_number, r.amount,
        r.amount_in_paise, r.currency, r.status, r.reason, r.admin_notes,
        r.gateway_refund_id, r.reviewed_by, r.reviewed_at, r.processed_at,
        r.created_at, r.updated_at,
        o.order_number
      FROM order_refunds r
      LEFT JOIN orders o ON r.order_id = o.order_id
      ${conditions.length > 0 ? `WHERE ${conditions.map((c) => c.replace('student_id =', 'r.student_id =').replace('status =', 'r.status =')).join(' AND ')}` : ''}
      ORDER BY r.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  /**
   * List all platform refunds (Admin / Super Admin).
   */
  async listAllRefunds(params: {
    limit?: number;
    offset?: number;
    status?: RefundStatus;
  }): Promise<{ items: any[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.status) {
      values.push(params.status);
      conditions.push(`r.status = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM order_refunds r ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);

    const dataRes = await this.db.query<any>(
      `
      SELECT
        r.refund_id, r.order_id, r.student_id, r.refund_number, r.amount,
        r.amount_in_paise, r.currency, r.status, r.reason, r.admin_notes,
        r.gateway_refund_id, r.reviewed_by, r.reviewed_at, r.processed_at,
        r.created_at, r.updated_at,
        o.order_number,
        u.first_name, u.last_name, u.email
      FROM order_refunds r
      LEFT JOIN orders o ON r.order_id = o.order_id
      LEFT JOIN users u ON r.student_id = u.user_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  /**
   * Execute atomic refund approval & enrollment revocation transaction:
   * 1. Updates order_refunds to 'processed'
   * 2. Updates orders status to 'refunded' and payment_status to 'refunded'
   * 3. Revokes all active course enrollments linked to order (sets enrollment_status = 'cancelled')
   * 4. Updates payment_transactions status to 'refunded'
   * 5. Appends audit ledger entries for REFUND_PROCESSED and ENROLLMENT_REVOKED
   */
  async executeRefundApprovalTransaction(data: {
    refundId: string;
    orderId: string;
    studentId: string;
    adminId: string;
    amount: number;
    currency: string;
    gatewayRefundId: string;
    adminNotes?: string;
  }): Promise<{ refund: RefundRecord; revokedCount: number }> {
    return this.db.withTransaction(async (client: PoolClient) => {
      // 1. Update order_refunds
      const refundRes = await client.query<RefundRecord>(
        `
        UPDATE order_refunds
        SET status = 'processed',
            gateway_refund_id = $2,
            reviewed_by = $3,
            reviewed_at = CURRENT_TIMESTAMP,
            processed_at = CURRENT_TIMESTAMP,
            admin_notes = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE refund_id = $1
        RETURNING ${REFUND_COLUMNS};
        `,
        [data.refundId, data.gatewayRefundId, data.adminId, data.adminNotes || null],
      );
      const updatedRefund = refundRes.rows[0];

      // 2. Update orders
      await client.query(
        `
        UPDATE orders
        SET status = 'refunded',
            payment_status = 'refunded',
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $1;
        `,
        [data.orderId],
      );

      // 3. Revoke all course enrollments for this order
      const revokeRes = await client.query(
        `
        UPDATE course_enrollments
        SET enrollment_status = 'cancelled',
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = $1 AND student_id = $2
        RETURNING enrollment_id, course_id;
        `,
        [data.orderId, data.studentId],
      );
      const revokedCount = revokeRes.rowCount || 0;

      // 4. Update payment_transactions
      await client.query(
        `
        UPDATE payment_transactions
        SET status = 'refunded',
            updated_at = CURRENT_TIMESTAMP
        WHERE order_id = (SELECT payment_order_id FROM orders WHERE order_id = $1);
        `,
        [data.orderId],
      );

      // 5. Append ledger audit logs
      await client.query(
        `
        INSERT INTO financial_audit_logs (
          order_id, refund_id, student_id, actor_id, event_type,
          amount, currency, description, metadata, created_at
        )
        VALUES (
          $1, $2, $3, $4, 'REFUND_PROCESSED',
          $5, $6, 'Refund successfully processed and payment reversed.',
          $7, CURRENT_TIMESTAMP
        );
        `,
        [
          data.orderId,
          data.refundId,
          data.studentId,
          data.adminId,
          data.amount,
          data.currency,
          { gatewayRefundId: data.gatewayRefundId },
        ],
      );

      if (revokedCount > 0) {
        await client.query(
          `
          INSERT INTO financial_audit_logs (
            order_id, refund_id, student_id, actor_id, event_type,
            amount, currency, description, metadata, created_at
          )
          VALUES (
            $1, $2, $3, $4, 'ENROLLMENT_REVOKED',
            $5, $6, 'Access revoked for ' || $7 || ' course(s) due to processed refund.',
            $8, CURRENT_TIMESTAMP
          );
          `,
          [
            data.orderId,
            data.refundId,
            data.studentId,
            data.adminId,
            data.amount,
            data.currency,
            revokedCount,
            { revokedCourses: revokeRes.rows.map((r) => r.course_id) },
          ],
        );
      }

      return { refund: updatedRefund, revokedCount };
    });
  }

  /**
   * Execute atomic refund rejection transaction:
   * Updates order_refunds to 'rejected' and logs REFUND_REJECTED event.
   */
  async executeRefundRejectionTransaction(data: {
    refundId: string;
    orderId: string;
    studentId: string;
    adminId: string;
    amount: number;
    currency: string;
    adminNotes?: string;
  }): Promise<RefundRecord> {
    return this.db.withTransaction(async (client: PoolClient) => {
      const refundRes = await client.query<RefundRecord>(
        `
        UPDATE order_refunds
        SET status = 'rejected',
            reviewed_by = $2,
            reviewed_at = CURRENT_TIMESTAMP,
            admin_notes = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE refund_id = $1
        RETURNING ${REFUND_COLUMNS};
        `,
        [data.refundId, data.adminId, data.adminNotes || null],
      );

      await client.query(
        `
        INSERT INTO financial_audit_logs (
          order_id, refund_id, student_id, actor_id, event_type,
          amount, currency, description, metadata, created_at
        )
        VALUES (
          $1, $2, $3, $4, 'REFUND_REJECTED',
          $5, $6, 'Refund request rejected by administrator.',
          $7, CURRENT_TIMESTAMP
        );
        `,
        [
          data.orderId,
          data.refundId,
          data.studentId,
          data.adminId,
          data.amount,
          data.currency,
          { adminNotes: data.adminNotes },
        ],
      );

      return refundRes.rows[0];
    });
  }

  /**
   * Log an event to the financial audit ledger.
   */
  async logAuditEvent(data: {
    order_id?: string;
    refund_id?: string;
    student_id: string;
    actor_id?: string;
    event_type: FinancialEventType;
    amount?: number;
    currency?: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<FinancialAuditLogRecord> {
    const res = await this.db.query<FinancialAuditLogRecord>(
      `
      INSERT INTO financial_audit_logs (
        order_id, refund_id, student_id, actor_id, event_type,
        amount, currency, description, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'INR'), $8, $9, CURRENT_TIMESTAMP)
      RETURNING ${AUDIT_LOG_COLUMNS};
      `,
      [
        data.order_id || null,
        data.refund_id || null,
        data.student_id,
        data.actor_id || null,
        data.event_type,
        data.amount || null,
        data.currency || 'INR',
        data.description,
        data.metadata || {},
      ],
    );
    return res.rows[0];
  }

  /**
   * Query financial audit logs (Admin / Super Admin).
   */
  async listAuditLogs(params: {
    limit?: number;
    offset?: number;
    orderId?: string;
    studentId?: string;
    eventType?: string;
  }): Promise<{ items: FinancialAuditLogRecord[]; total: number }> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.orderId) {
      values.push(params.orderId);
      conditions.push(`order_id = $${values.length}`);
    }
    if (params.studentId) {
      values.push(params.studentId);
      conditions.push(`student_id = $${values.length}`);
    }
    if (params.eventType) {
      values.push(params.eventType);
      conditions.push(`event_type = $${values.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM financial_audit_logs ${whereClause};`,
      values,
    );
    const total = countRes.rows[0]?.total || 0;

    values.push(limit);
    values.push(offset);

    const dataRes = await this.db.query<FinancialAuditLogRecord>(
      `
      SELECT ${AUDIT_LOG_COLUMNS}
      FROM financial_audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }
}


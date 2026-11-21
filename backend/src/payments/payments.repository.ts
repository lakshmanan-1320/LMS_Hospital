import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import {
  PaymentTransactionRecord,
  PaymentWebhookLogRecord,
  PaymentStatus,
} from './interfaces/payment.interface';

const TRANSACTION_COLUMNS = `
  transaction_id, order_id, payment_id, signature, student_id,
  amount, amount_in_paise, currency, status, payment_method,
  receipt, error_code, error_description, metadata, created_at, updated_at
`;

@Injectable()
export class PaymentsRepository {
  private readonly logger = new Logger(PaymentsRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Insert a new payment transaction with initial status 'created'.
   */
  async createTransaction(data: {
    order_id: string;
    student_id: string;
    amount: number;
    amount_in_paise: number;
    currency: string;
    receipt: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentTransactionRecord> {
    const res = await this.db.query<PaymentTransactionRecord>(
      `
      INSERT INTO payment_transactions (
        order_id, student_id, amount, amount_in_paise,
        currency, status, receipt, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'created', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING ${TRANSACTION_COLUMNS};
      `,
      [
        data.order_id,
        data.student_id,
        data.amount,
        data.amount_in_paise,
        data.currency,
        data.receipt,
        data.metadata || {},
      ],
    );
    return res.rows[0];
  }

  /**
   * Find a transaction by Razorpay Order ID.
   */
  async findTransactionByOrderId(orderId: string): Promise<PaymentTransactionRecord | null> {
    const res = await this.db.query<PaymentTransactionRecord>(
      `
      SELECT ${TRANSACTION_COLUMNS}
      FROM payment_transactions
      WHERE order_id = $1
      LIMIT 1;
      `,
      [orderId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find a transaction by Razorpay Payment ID.
   */
  async findTransactionByPaymentId(paymentId: string): Promise<PaymentTransactionRecord | null> {
    const res = await this.db.query<PaymentTransactionRecord>(
      `
      SELECT ${TRANSACTION_COLUMNS}
      FROM payment_transactions
      WHERE payment_id = $1
      LIMIT 1;
      `,
      [paymentId],
    );
    return res.rows[0] || null;
  }

  /**
   * Find a transaction by UUID.
   */
  async findTransactionById(transactionId: string): Promise<PaymentTransactionRecord | null> {
    const res = await this.db.query<PaymentTransactionRecord>(
      `
      SELECT ${TRANSACTION_COLUMNS}
      FROM payment_transactions
      WHERE transaction_id = $1
      LIMIT 1;
      `,
      [transactionId],
    );
    return res.rows[0] || null;
  }

  /**
   * Update transaction status, payment ID, signature, error info, and method.
   */
  async updateTransactionStatus(
    orderId: string,
    updates: {
      status: PaymentStatus;
      payment_id?: string;
      signature?: string;
      payment_method?: string;
      error_code?: string | null;
      error_description?: string | null;
      metadata?: Record<string, any>;
    },
    client?: PoolClient,
  ): Promise<PaymentTransactionRecord | null> {
    const fields: string[] = ['status = $2'];
    const values: any[] = [orderId, updates.status];

    if (updates.payment_id !== undefined) {
      values.push(updates.payment_id);
      fields.push(`payment_id = $${values.length}`);
    }
    if (updates.signature !== undefined) {
      values.push(updates.signature);
      fields.push(`signature = $${values.length}`);
    }
    if (updates.payment_method !== undefined) {
      values.push(updates.payment_method);
      fields.push(`payment_method = $${values.length}`);
    }
    if (updates.error_code !== undefined) {
      values.push(updates.error_code);
      fields.push(`error_code = $${values.length}`);
    }
    if (updates.error_description !== undefined) {
      values.push(updates.error_description);
      fields.push(`error_description = $${values.length}`);
    }
    if (updates.metadata !== undefined) {
      values.push(updates.metadata);
      fields.push(`metadata = $${values.length}`);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `
      UPDATE payment_transactions
      SET ${fields.join(', ')}
      WHERE order_id = $1
      RETURNING ${TRANSACTION_COLUMNS};
    `;

    const res = client
      ? await client.query<PaymentTransactionRecord>(query, values)
      : await this.db.query<PaymentTransactionRecord>(query, values);

    return res.rows[0] || null;
  }

  /**
   * List transactions for a student with pagination.
   */
  async listStudentTransactions(
    studentId: string,
    params: { limit?: number; offset?: number },
  ): Promise<{ items: PaymentTransactionRecord[]; total: number }> {
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    const countRes = await this.db.query(
      `SELECT COUNT(*)::int AS total FROM payment_transactions WHERE student_id = $1;`,
      [studentId],
    );
    const total = countRes.rows[0]?.total || 0;

    const dataRes = await this.db.query<PaymentTransactionRecord>(
      `
      SELECT ${TRANSACTION_COLUMNS}
      FROM payment_transactions
      WHERE student_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
      `,
      [studentId, limit, offset],
    );

    return { items: dataRes.rows, total };
  }

  /**
   * Log an incoming webhook payload.
   */
  async logWebhook(data: {
    event_id?: string;
    event_name: string;
    payload: Record<string, any>;
    signature?: string;
    is_verified: boolean;
  }): Promise<PaymentWebhookLogRecord> {
    const res = await this.db.query<PaymentWebhookLogRecord>(
      `
      INSERT INTO payment_webhooks_log (
        event_id, event_name, payload, signature, is_verified, processed, received_at
      )
      VALUES ($1, $2, $3, $4, $5, FALSE, CURRENT_TIMESTAMP)
      RETURNING webhook_id, event_id, event_name, payload, signature, is_verified, processed, received_at;
      `,
      [
        data.event_id || null,
        data.event_name,
        data.payload,
        data.signature || null,
        data.is_verified,
      ],
    );
    return res.rows[0];
  }

  /**
   * Mark a webhook as processed.
   */
  async markWebhookProcessed(webhookId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE payment_webhooks_log
      SET processed = TRUE
      WHERE webhook_id = $1;
      `,
      [webhookId],
    );
  }
}


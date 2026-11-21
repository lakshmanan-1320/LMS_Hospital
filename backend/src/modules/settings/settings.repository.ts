import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SystemSettingEntity {
  setting_key: string;
  setting_value: Record<string, any>;
  description?: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class SettingsRepository {
  private readonly logger = new Logger(SettingsRepository.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async getSetting(key: string): Promise<Record<string, any> | null> {
    const query = `
      SELECT setting_key, setting_value, description, updated_by, created_at, updated_at
      FROM system_settings
      WHERE setting_key = $1
      LIMIT 1;
    `;
    const res = await this.databaseService.query<SystemSettingEntity>(query, [key]);
    if (res.rows.length === 0) return null;
    return res.rows[0].setting_value;
  }

  async getSettingEntity(key: string): Promise<SystemSettingEntity | null> {
    const query = `
      SELECT setting_key, setting_value, description, updated_by, created_at, updated_at
      FROM system_settings
      WHERE setting_key = $1
      LIMIT 1;
    `;
    const res = await this.databaseService.query<SystemSettingEntity>(query, [key]);
    return res.rows[0] || null;
  }

  async upsertSetting(
    key: string,
    value: Record<string, any>,
    description?: string,
    updatedBy?: string,
  ): Promise<SystemSettingEntity> {
    const query = `
      INSERT INTO system_settings (setting_key, setting_value, description, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key) DO UPDATE
      SET setting_value = EXCLUDED.setting_value,
          description = COALESCE(EXCLUDED.description, system_settings.description),
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await this.databaseService.query<SystemSettingEntity>(query, [
      key,
      JSON.stringify(value),
      description || null,
      updatedBy || null,
    ]);
    return res.rows[0];
  }

  // ==========================================
  // DYNAMIC REFUND POLICY REPOSITORY HELPERS
  // ==========================================

  async getRefundPolicy(): Promise<Record<string, any>> {
    const val = await this.getSetting('refund_policy');
    return (
      val || {
        allowGlobalRefunds: true,
        defaultRefundPeriodDays: 30,
        antiAbuseConsumptionThresholdPercent: 50,
        policyEnforcementMode: 'flexible',
      }
    );
  }

  async getCourseRefundStats(): Promise<{ total: number; refundable: number; nonRefundable: number }> {
    const res = await this.databaseService.query<{
      total: string;
      refundable: string;
      non_refundable: string;
    }>(`
      SELECT 
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE is_refundable = TRUE)::text AS refundable,
        COUNT(*) FILTER (WHERE is_refundable = FALSE)::text AS non_refundable
      FROM courses
      WHERE deleted_at IS NULL;
    `);
    const row = res.rows[0];
    return {
      total: parseInt(row?.total || '0', 10),
      refundable: parseInt(row?.refundable || '0', 10),
      nonRefundable: parseInt(row?.non_refundable || '0', 10),
    };
  }

  async listCoursesWithRefundSettings(params: {
    search?: string;
    refundable?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const conditions = ['c.deleted_at IS NULL'];
    const values: any[] = [];

    if (params.search?.trim()) {
      values.push(`%${params.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(c.title) LIKE $${values.length} OR LOWER(COALESCE(u.first_name, '')) LIKE $${values.length} OR LOWER(COALESCE(u.last_name, '')) LIKE $${values.length})`,
      );
    }

    if (params.refundable === 'true') {
      conditions.push('c.is_refundable = TRUE');
    } else if (params.refundable === 'false') {
      conditions.push('c.is_refundable = FALSE');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.databaseService.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM courses c LEFT JOIN users u ON c.instructor_id = u.user_id ${whereClause}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    values.push(limit);
    values.push(offset);

    const dataRes = await this.databaseService.query(
      `
      SELECT 
        c.course_id AS "courseId",
        c.title,
        c.slug,
        c.is_free AS "isFree",
        c.price::float AS "price",
        c.currency,
        c.is_refundable AS "isRefundable",
        c.refund_period_days AS "refundPeriodDays",
        c.status,
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
        u.email AS "instructorEmail",
        c.created_at AS "createdAt",
        c.updated_at AS "updatedAt"
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.user_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};
      `,
      values,
    );

    return { items: dataRes.rows, total };
  }

  async updateCourseRefund(courseId: string, isRefundable: boolean, refundPeriodDays = 30) {
    const res = await this.databaseService.query(
      `
      UPDATE courses
      SET is_refundable = $1,
          refund_period_days = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE course_id = $3 AND deleted_at IS NULL
      RETURNING course_id AS "courseId", title, is_refundable AS "isRefundable", refund_period_days AS "refundPeriodDays";
      `,
      [isRefundable, refundPeriodDays, courseId],
    );
    return res.rows[0] || null;
  }

  async bulkUpdateCoursesRefund(isRefundable: boolean, refundPeriodDays = 30, courseIds?: string[]) {
    if (courseIds && courseIds.length > 0) {
      const res = await this.databaseService.query(
        `
        UPDATE courses
        SET is_refundable = $1,
            refund_period_days = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE course_id = ANY($3::uuid[]) AND deleted_at IS NULL
        RETURNING course_id;
        `,
        [isRefundable, refundPeriodDays, courseIds],
      );
      return res.rowCount || 0;
    }

    const res = await this.databaseService.query(
      `
      UPDATE courses
      SET is_refundable = $1,
          refund_period_days = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE deleted_at IS NULL
      RETURNING course_id;
      `,
      [isRefundable, refundPeriodDays],
    );
    return res.rowCount || 0;
  }

  /**
   * Status of each gateway config table (latest row). Never selects encrypted secrets.
   */
  async getGatewayConfigStatuses(): Promise<{
    email: Record<string, any> | null;
    sms: Record<string, any> | null;
    whatsapp: Record<string, any> | null;
    meetingAccounts: Array<{ provider: string; account_email: string | null; is_active: boolean }>;
  }> {
    const latest = async (sql: string) => (await this.databaseService.query(sql)).rows[0] || null;
    const [email, sms, whatsapp, accounts] = await Promise.all([
      latest(`SELECT status, from_email AS identity, last_validated_at, last_error, updated_at
              FROM email_configs ORDER BY updated_at DESC NULLS LAST LIMIT 1`),
      latest(`SELECT status, provider_key, sender_id AS identity, last_validated_at, last_error, updated_at
              FROM sms_configs ORDER BY updated_at DESC NULLS LAST LIMIT 1`),
      latest(`SELECT status, display_phone_number AS identity, business_name, last_validated_at, last_error, updated_at
              FROM whatsapp_configs ORDER BY updated_at DESC NULLS LAST LIMIT 1`),
      this.databaseService.query(
        `SELECT provider, account_email, is_active FROM meeting_provider_accounts WHERE is_active = TRUE`,
      ),
    ]);
    return { email, sms, whatsapp, meetingAccounts: accounts.rows };
  }
}

import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  EmailConfigRecord,
  EmailTemplateRecord,
  EmailCampaignRecord,
  EmailOutboxRecord,
  EmailRecipient,
} from './interfaces/email-campaign.interfaces';

@Injectable()
export class EmailCampaignsRepository {
  private readonly logger = new Logger(EmailCampaignsRepository.name);

  constructor(
    @Inject(DatabaseService)
    private readonly db: DatabaseService,
  ) {}

  // ========================================================
  // 1. EMAIL CONFIGURATION (SUPER ADMIN GATEWAY)
  // ========================================================

  async getLatestEmailConfig(): Promise<EmailConfigRecord | null> {
    const sql = `
      SELECT *
      FROM email_configs
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await this.db.executeQuery<EmailConfigRecord>(sql);
    return res.rows[0] || null;
  }

  async upsertEmailConfig(data: {
    host: string;
    port: number;
    encryption: string;
    username: string;
    password_encrypted: string;
    from_name: string;
    from_email: string;
    redirect_to?: string;
    userId?: string;
  }): Promise<EmailConfigRecord> {
    const existing = await this.getLatestEmailConfig();

    if (existing) {
      const sql = `
        UPDATE email_configs
        SET host = $1,
            port = $2,
            encryption = $3,
            username = $4,
            password_encrypted = $5,
            from_name = $6,
            from_email = $7,
            redirect_to = $8,
            updated_at = CURRENT_TIMESTAMP
        WHERE config_id = $9
        RETURNING *;
      `;
      const res = await this.db.executeQuery<EmailConfigRecord>(sql, [
        data.host,
        data.port,
        data.encryption,
        data.username,
        data.password_encrypted,
        data.from_name,
        data.from_email,
        data.redirect_to || null,
        existing.config_id,
      ]);
      return res.rows[0];
    } else {
      const sql = `
        INSERT INTO email_configs (
          host, port, encryption, username, password_encrypted,
          from_name, from_email, redirect_to, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const res = await this.db.executeQuery<EmailConfigRecord>(sql, [
        data.host,
        data.port,
        data.encryption,
        data.username,
        data.password_encrypted,
        data.from_name,
        data.from_email,
        data.redirect_to || null,
        data.userId || null,
      ]);
      return res.rows[0];
    }
  }

  async updateConfigStatus(
    configId: string,
    status: 'draft' | 'validated' | 'active' | 'error',
    lastError: string | null = null,
  ): Promise<void> {
    const sql = `
      UPDATE email_configs
      SET status = $1::varchar,
          last_validated_at = CASE WHEN $1::varchar IN ('validated', 'active') THEN CURRENT_TIMESTAMP ELSE last_validated_at END,
          last_error = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = $3;
    `;
    await this.db.executeQuery(sql, [status, lastError, configId]);
  }

  // ========================================================
  // 2. EMAIL TEMPLATES (ADMIN TEMPLATE DESIGNER)
  // ========================================================

  async getTemplates(activeOnly = false): Promise<EmailTemplateRecord[]> {
    const sql = `
      SELECT t.*, u.first_name || ' ' || u.last_name as author_name
      FROM email_templates t
      LEFT JOIN users u ON u.user_id = t.created_by
      ${activeOnly ? 'WHERE t.is_active = true' : ''}
      ORDER BY t.created_at DESC;
    `;
    const res = await this.db.executeQuery<EmailTemplateRecord>(sql);
    return res.rows;
  }

  async getTemplateById(templateId: string): Promise<EmailTemplateRecord | null> {
    const sql = `
      SELECT *
      FROM email_templates
      WHERE template_id = $1;
    `;
    const res = await this.db.executeQuery<EmailTemplateRecord>(sql, [templateId]);
    return res.rows[0] || null;
  }

  async createTemplate(data: {
    name: string;
    subject: string;
    preview_text?: string;
    category: string;
    html_content: string;
    plain_text?: string;
    variables: string[];
    userId?: string;
  }): Promise<EmailTemplateRecord> {
    const sql = `
      INSERT INTO email_templates (
        name, subject, preview_text, category, html_content,
        plain_text, variables, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING *;
    `;
    const res = await this.db.executeQuery<EmailTemplateRecord>(sql, [
      data.name,
      data.subject,
      data.preview_text || null,
      data.category,
      data.html_content,
      data.plain_text || null,
      JSON.stringify(data.variables || []),
      data.userId || null,
    ]);
    return res.rows[0];
  }

  async updateTemplate(
    templateId: string,
    data: Partial<{
      name: string;
      subject: string;
      preview_text: string;
      category: string;
      html_content: string;
      plain_text: string;
      variables: string[];
      is_active: boolean;
    }>,
  ): Promise<EmailTemplateRecord | null> {
    const current = await this.getTemplateById(templateId);
    if (!current) return null;

    const sql = `
      UPDATE email_templates
      SET name = COALESCE($1, name),
          subject = COALESCE($2, subject),
          preview_text = COALESCE($3, preview_text),
          category = COALESCE($4, category),
          html_content = COALESCE($5, html_content),
          plain_text = COALESCE($6, plain_text),
          variables = CASE WHEN $7::text IS NOT NULL THEN $7::jsonb ELSE variables END,
          is_active = COALESCE($8, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE template_id = $9
      RETURNING *;
    `;
    const res = await this.db.executeQuery<EmailTemplateRecord>(sql, [
      data.name ?? null,
      data.subject ?? null,
      data.preview_text ?? null,
      data.category ?? null,
      data.html_content ?? null,
      data.plain_text ?? null,
      data.variables ? JSON.stringify(data.variables) : null,
      data.is_active ?? null,
      templateId,
    ]);
    return res.rows[0];
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    // Check if template is referenced in campaigns
    const checkSql = `SELECT campaign_id FROM campaigns WHERE email_template_id = $1 LIMIT 1;`;
    const check = await this.db.executeQuery(checkSql, [templateId]);
    if (check.rows.length > 0) {
      // Soft-delete if already bound to historical campaigns
      const softSql = `UPDATE email_templates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE template_id = $1;`;
      await this.db.executeQuery(softSql, [templateId]);
      return true;
    }

    const sql = `DELETE FROM email_templates WHERE template_id = $1;`;
    const res = await this.db.executeQuery(sql, [templateId]);
    return (res.rowCount ?? 0) > 0;
  }

  // ========================================================
  // 3. TARGET AUDIENCES (STUDENTS, INSTRUCTORS, ALL USERS)
  // ========================================================

  async getAudienceCount(targetType: 'students' | 'instructors' | 'all_users'): Promise<number> {
    let sql = '';
    if (targetType === 'students') {
      sql = `
        SELECT COUNT(DISTINCT u.user_id) as count
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'STUDENT' AND u.is_active = true;
      `;
    } else if (targetType === 'instructors') {
      sql = `
        SELECT COUNT(DISTINCT u.user_id) as count
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'INSTRUCTOR' AND u.is_active = true;
      `;
    } else {
      sql = `
        SELECT COUNT(*) as count
        FROM users
        WHERE is_active = true;
      `;
    }
    const res = await this.db.executeQuery<{ count: string | number }>(sql);
    return parseInt(String(res.rows[0]?.count || 0), 10);
  }

  async getAudienceRecipients(targetType: 'students' | 'instructors' | 'all_users'): Promise<EmailRecipient[]> {
    let sql = '';
    if (targetType === 'students') {
      sql = `
        SELECT DISTINCT u.email, u.first_name, u.last_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'STUDENT' AND u.is_active = true AND u.email IS NOT NULL;
      `;
    } else if (targetType === 'instructors') {
      sql = `
        SELECT DISTINCT u.email, u.first_name, u.last_name
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'INSTRUCTOR' AND u.is_active = true AND u.email IS NOT NULL;
      `;
    } else {
      sql = `
        SELECT DISTINCT email, first_name, last_name
        FROM users
        WHERE is_active = true AND email IS NOT NULL;
      `;
    }
    const res = await this.db.executeQuery<{ email: string; first_name: string; last_name: string }>(sql);
    return res.rows.map((row) => ({
      email: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Learner',
      variables: {
        first_name: row.first_name || 'Learner',
        last_name: row.last_name || '',
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Learner',
        email: row.email,
        current_year: new Date().getFullYear().toString(),
      },
    }));
  }

  // ========================================================
  // 4. CAMPAIGNS (BULK EMAIL CAMPAIGNS)
  // ========================================================

  async createCampaign(data: {
    name: string;
    templateId: string;
    targetType: string;
    totalRecipients: number;
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<EmailCampaignRecord> {
    const sql = `
      INSERT INTO campaigns (
        name, channel, email_template_id, target_type, status,
        total_recipients, metadata, started_at, created_by
      )
      VALUES ($1, 'email', $2, $3, 'processing', $4, $5::jsonb, CURRENT_TIMESTAMP, $6)
      RETURNING *;
    `;
    const res = await this.db.executeQuery<EmailCampaignRecord>(sql, [
      data.name,
      data.templateId,
      data.targetType,
      data.totalRecipients,
      JSON.stringify(data.metadata || {}),
      data.userId || null,
    ]);
    return res.rows[0];
  }

  async getEmailCampaigns(limit = 20, offset = 0): Promise<{ campaigns: any[]; total: number }> {
    const countSql = `SELECT COUNT(*) as total FROM campaigns WHERE channel = 'email';`;
    const countRes = await this.db.executeQuery<{ total: string }>(countSql);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sql = `
      SELECT c.*, t.name as template_name, t.subject as template_subject, t.category as template_category,
             u.first_name || ' ' || u.last_name as creator_name
      FROM campaigns c
      LEFT JOIN email_templates t ON t.template_id = c.email_template_id
      LEFT JOIN users u ON u.user_id = c.created_by
      WHERE c.channel = 'email'
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const res = await this.db.executeQuery(sql, [limit, offset]);
    return { campaigns: res.rows, total };
  }

  async updateCampaignStats(
    campaignId: string,
    sentCount: number,
    failedCount: number,
    status: 'completed' | 'failed' | 'processing',
  ): Promise<void> {
    const sql = `
      UPDATE campaigns
      SET sent_count = $1,
          delivered_count = $1,
          failed_count = $2,
          status = $3::varchar,
          completed_at = CASE WHEN $3::varchar IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = $4;
    `;
    await this.db.executeQuery(sql, [sentCount, failedCount, status, campaignId]);
  }

  // ========================================================
  // 5. EMAIL OUTBOX & DELIVERY AUDIT LOGS
  // ========================================================

  async insertOutboxEntries(
    entries: {
      campaign_id: string;
      template_id: string;
      recipient_email: string;
      recipient_name?: string;
      subject: string;
      rendered_html: string;
      variables?: Record<string, any>;
    }[],
  ): Promise<EmailOutboxRecord[]> {
    if (entries.length === 0) return [];

    const valueClauses: string[] = [];
    const values: any[] = [];
    let p = 1;

    for (const item of entries) {
      valueClauses.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::jsonb, 'PENDING')`,
      );
      values.push(
        item.campaign_id,
        item.template_id,
        item.recipient_email,
        item.recipient_name || null,
        item.subject,
        item.rendered_html,
        JSON.stringify(item.variables || {}),
      );
    }

    const sql = `
      INSERT INTO email_outbox (
        campaign_id, template_id, recipient_email, recipient_name,
        subject, rendered_html, variables, status
      )
      VALUES ${valueClauses.join(', ')}
      RETURNING *;
    `;

    const res = await this.db.executeQuery<EmailOutboxRecord>(sql, values);
    return res.rows;
  }

  async updateOutboxItem(
    outboxId: string,
    status: 'SENT' | 'FAILED',
    smtpMessageId?: string | null,
    errorMessage?: string | null,
  ): Promise<void> {
    const sql = `
      UPDATE email_outbox
      SET status = $1::varchar,
          smtp_message_id = $2,
          error_message = $3,
          sent_at = CASE WHEN $1::varchar = 'SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END,
          attempts = attempts + 1
      WHERE outbox_id = $4;
    `;
    await this.db.executeQuery(sql, [
      status,
      smtpMessageId || null,
      errorMessage || null,
      outboxId,
    ]);
  }

  async getOutboxLogs(options: {
    campaignId?: string;
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (options.campaignId) {
      conditions.push(`o.campaign_id = $${p++}`);
      params.push(options.campaignId);
    }

    if (options.status) {
      conditions.push(`o.status = $${p++}`);
      params.push(options.status.toUpperCase());
    }

    if (options.search) {
      conditions.push(
        `(o.recipient_email ILIKE $${p} OR o.recipient_name ILIKE $${p} OR o.subject ILIKE $${p})`,
      );
      params.push(`%${options.search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM email_outbox o ${where};`;
    const countRes = await this.db.executeQuery<{ total: string }>(countSql, params);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const sql = `
      SELECT o.*, c.name as campaign_name, t.name as template_name
      FROM email_outbox o
      LEFT JOIN campaigns c ON c.campaign_id = o.campaign_id
      LEFT JOIN email_templates t ON t.template_id = o.template_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${p++} OFFSET $${p++};
    `;
    params.push(limit, offset);

    const res = await this.db.executeQuery(sql, params);
    return { logs: res.rows, total };
  }
}

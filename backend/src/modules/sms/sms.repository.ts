import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  SmsConfigEntity,
  SmsTemplateEntity,
  CampaignEntity,
  SmsOutboxEntity,
  SmsConfigStatus,
  CampaignStatus,
  SmsOutboxStatus,
} from './interfaces/sms.interface';

@Injectable()
export class SmsRepository {
  private readonly logger = new Logger(SmsRepository.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  // ── 1. CONFIGS ────────────────────────────────────────────────────────────

  async findConfig(): Promise<SmsConfigEntity | null> {
    const sql = `
      SELECT * FROM sms_configs
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const res = await this.databaseService.executeQuery<SmsConfigEntity>(sql);
    return res.rows[0] || null;
  }

  async upsertConfig(data: {
    providerKey: string;
    credentialsEncrypted: string;
    senderId: string;
    dltEntityId?: string | null;
    defaultCountryCode: string;
    status: SmsConfigStatus;
    lastValidatedAt?: Date | null;
    lastError?: string | null;
    createdBy?: string | null;
  }): Promise<SmsConfigEntity> {
    const existing = await this.findConfig();
    if (existing) {
      const sql = `
        UPDATE sms_configs
        SET provider_key = $1,
            credentials_encrypted = $2,
            sender_id = $3,
            dlt_entity_id = $4,
            default_country_code = $5,
            status = $6,
            last_validated_at = $7,
            last_error = $8,
            updated_at = NOW()
        WHERE config_id = $9
        RETURNING *
      `;
      const res = await this.databaseService.executeQuery<SmsConfigEntity>(sql, [
        data.providerKey,
        data.credentialsEncrypted,
        data.senderId,
        data.dltEntityId || null,
        data.defaultCountryCode,
        data.status,
        data.lastValidatedAt || null,
        data.lastError || null,
        existing.config_id,
      ]);
      return res.rows[0];
    }

    const sql = `
      INSERT INTO sms_configs (
        provider_key, credentials_encrypted, sender_id, dlt_entity_id,
        default_country_code, status, last_validated_at, last_error, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const res = await this.databaseService.executeQuery<SmsConfigEntity>(sql, [
      data.providerKey,
      data.credentialsEncrypted,
      data.senderId,
      data.dltEntityId || null,
      data.defaultCountryCode,
      data.status,
      data.lastValidatedAt || null,
      data.lastError || null,
      data.createdBy || null,
    ]);
    return res.rows[0];
  }

  async updateConfigStatus(configId: string, status: SmsConfigStatus, lastError?: string | null): Promise<void> {
    const sql = `
      UPDATE sms_configs
      SET status = $1::varchar,
          last_error = $2,
          last_validated_at = CASE WHEN $1::varchar IN ('validated', 'active') THEN NOW() ELSE last_validated_at END,
          updated_at = NOW()
      WHERE config_id = $3
    `;
    await this.databaseService.executeQuery(sql, [status, lastError || null, configId]);
  }

  // ── 2. TEMPLATES ──────────────────────────────────────────────────────────

  async listTemplates(activeOnly: boolean = false): Promise<SmsTemplateEntity[]> {
    let sql = `SELECT * FROM sms_templates`;
    const params: any[] = [];
    if (activeOnly) {
      sql += ` WHERE is_active = true`;
    }
    sql += ` ORDER BY created_at DESC`;
    const res = await this.databaseService.executeQuery<SmsTemplateEntity>(sql, params);
    return res.rows;
  }

  async findTemplateById(templateId: string): Promise<SmsTemplateEntity | null> {
    const sql = `SELECT * FROM sms_templates WHERE template_id = $1`;
    const res = await this.databaseService.executeQuery<SmsTemplateEntity>(sql, [templateId]);
    return res.rows[0] || null;
  }

  async findTemplateByProviderId(providerTemplateId: string): Promise<SmsTemplateEntity | null> {
    const sql = `SELECT * FROM sms_templates WHERE provider_template_id = $1`;
    const res = await this.databaseService.executeQuery<SmsTemplateEntity>(sql, [providerTemplateId]);
    return res.rows[0] || null;
  }

  async createTemplate(data: {
    providerTemplateId: string;
    dltTemplateId?: string | null;
    name: string;
    category?: string;
    body: string;
    variables: any[];
    isActive?: boolean;
    createdBy?: string | null;
  }): Promise<SmsTemplateEntity> {
    const sql = `
      INSERT INTO sms_templates (
        provider_template_id, dlt_template_id, name, category, body, variables, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const res = await this.databaseService.executeQuery<SmsTemplateEntity>(sql, [
      data.providerTemplateId,
      data.dltTemplateId || null,
      data.name,
      data.category || 'transactional',
      data.body,
      JSON.stringify(data.variables || []),
      data.isActive !== undefined ? data.isActive : true,
      data.createdBy || null,
    ]);
    return res.rows[0];
  }

  async updateTemplate(
    templateId: string,
    data: {
      name?: string;
      body?: string;
      dltTemplateId?: string | null;
      category?: string;
      variables?: any[];
      isActive?: boolean;
    },
  ): Promise<SmsTemplateEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.body !== undefined) {
      fields.push(`body = $${idx++}`);
      values.push(data.body);
    }
    if (data.dltTemplateId !== undefined) {
      fields.push(`dlt_template_id = $${idx++}`);
      values.push(data.dltTemplateId);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(data.category);
    }
    if (data.variables !== undefined) {
      fields.push(`variables = $${idx++}`);
      values.push(JSON.stringify(data.variables));
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.isActive);
    }

    if (!fields.length) return this.findTemplateById(templateId);

    fields.push(`updated_at = NOW()`);
    values.push(templateId);

    const sql = `
      UPDATE sms_templates
      SET ${fields.join(', ')}
      WHERE template_id = $${idx}
      RETURNING *
    `;
    const res = await this.databaseService.executeQuery<SmsTemplateEntity>(sql, values);
    return res.rows[0] || null;
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    const sql = `DELETE FROM sms_templates WHERE template_id = $1`;
    const res = await this.databaseService.executeQuery(sql, [templateId]);
    return (res.rowCount || 0) > 0;
  }

  // ── 3. CAMPAIGNS ──────────────────────────────────────────────────────────

  async listCampaigns(limit: number = 50, offset: number = 0): Promise<{ campaigns: any[]; total: number }> {
    const countSql = `SELECT COUNT(*) AS total FROM campaigns WHERE channel = 'sms'`;
    const countRes = await this.databaseService.executeQuery<{ total: string }>(countSql);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sql = `
      SELECT c.*, t.name AS template_name, t.provider_template_id, t.body AS template_body
      FROM campaigns c
      LEFT JOIN sms_templates t ON c.template_id = t.template_id
      WHERE c.channel = 'sms'
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const res = await this.databaseService.executeQuery(sql, [limit, offset]);
    return { campaigns: res.rows, total };
  }

  async findCampaignById(campaignId: string): Promise<any | null> {
    const sql = `
      SELECT c.*, t.name AS template_name, t.provider_template_id, t.body AS template_body,
             w.title AS webinar_title, w.slug AS webinar_slug
      FROM campaigns c
      LEFT JOIN sms_templates t ON c.template_id = t.template_id
      LEFT JOIN webinars w ON c.target_id = w.webinar_id
      WHERE c.campaign_id = $1
    `;
    const res = await this.databaseService.executeQuery(sql, [campaignId]);
    return res.rows[0] || null;
  }

  async createCampaign(data: {
    name: string;
    templateId: string;
    targetType: string;
    targetId?: string | null;
    totalRecipients: number;
    metadata?: Record<string, any>;
    createdBy?: string | null;
  }): Promise<CampaignEntity> {
    const sql = `
      INSERT INTO campaigns (
        name, channel, template_id, target_type, target_id,
        status, total_recipients, metadata, created_by, started_at
      ) VALUES ($1, 'sms', $2, $3, $4, 'processing', $5, $6, $7, NOW())
      RETURNING *
    `;
    const res = await this.databaseService.executeQuery<CampaignEntity>(sql, [
      data.name,
      data.templateId,
      data.targetType,
      data.targetId || null,
      data.totalRecipients,
      JSON.stringify(data.metadata || {}),
      data.createdBy || null,
    ]);
    return res.rows[0];
  }

  async updateCampaignMetrics(
    campaignId: string,
    metrics: { sentCount?: number; deliveredCount?: number; failedCount?: number; status?: CampaignStatus },
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (metrics.sentCount !== undefined) {
      fields.push(`sent_count = $${idx++}`);
      values.push(metrics.sentCount);
    }
    if (metrics.deliveredCount !== undefined) {
      fields.push(`delivered_count = $${idx++}`);
      values.push(metrics.deliveredCount);
    }
    if (metrics.failedCount !== undefined) {
      fields.push(`failed_count = $${idx++}`);
      values.push(metrics.failedCount);
    }
    if (metrics.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(metrics.status);
      if (metrics.status === 'completed' || metrics.status === 'failed') {
        fields.push(`completed_at = NOW()`);
      }
    }

    if (!fields.length) return;
    fields.push(`updated_at = NOW()`);
    values.push(campaignId);

    const sql = `
      UPDATE campaigns
      SET ${fields.join(', ')}
      WHERE campaign_id = $${idx}
    `;
    await this.databaseService.executeQuery(sql, values);
  }

  // ── 4. OUTBOX ─────────────────────────────────────────────────────────────

  async insertOutboxRow(row: {
    campaignId: string;
    templateId: string;
    recipientPhone: string;
    recipientName?: string | null;
    renderedBody: string;
    variables: Record<string, any>;
    status: SmsOutboxStatus;
    providerKey: string;
    providerRequestId?: string | null;
    errorMessage?: string | null;
    sentAt?: Date | null;
  }): Promise<SmsOutboxEntity> {
    const sql = `
      INSERT INTO sms_outbox (
        campaign_id, template_id, recipient_phone, recipient_name,
        rendered_body, variables, status, provider_key,
        provider_request_id, error_message, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const res = await this.databaseService.executeQuery<SmsOutboxEntity>(sql, [
      row.campaignId,
      row.templateId,
      row.recipientPhone,
      row.recipientName || null,
      row.renderedBody,
      JSON.stringify(row.variables || {}),
      row.status,
      row.providerKey,
      row.providerRequestId || null,
      row.errorMessage || null,
      row.sentAt || null,
    ]);
    return res.rows[0];
  }

  async listOutboxByCampaign(
    campaignId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: SmsOutboxEntity[]; total: number }> {
    const countSql = `SELECT COUNT(*) AS total FROM sms_outbox WHERE campaign_id = $1`;
    const countRes = await this.databaseService.executeQuery<{ total: string }>(countSql, [campaignId]);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const sql = `
      SELECT * FROM sms_outbox
      WHERE campaign_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const res = await this.databaseService.executeQuery<SmsOutboxEntity>(sql, [campaignId, limit, offset]);
    return { logs: res.rows, total };
  }

  async listRecentOutbox(limit: number = 100): Promise<SmsOutboxEntity[]> {
    const sql = `
      SELECT o.*, c.name AS campaign_name, t.name AS template_name
      FROM sms_outbox o
      LEFT JOIN campaigns c ON o.campaign_id = c.campaign_id
      LEFT JOIN sms_templates t ON o.template_id = t.template_id
      ORDER BY o.created_at DESC
      LIMIT $1
    `;
    const res = await this.databaseService.executeQuery<any>(sql, [limit]);
    return res.rows;
  }

  async applyDeliveryStatus(providerRequestId: string, status: SmsOutboxStatus, deliveredAt?: Date | null): Promise<number> {
    const sql = `
      UPDATE sms_outbox
      SET status = $1,
          delivered_at = COALESCE($2, NOW())
      WHERE provider_request_id = $3 AND status != $1
    `;
    const res = await this.databaseService.executeQuery(sql, [status, deliveredAt || null, providerRequestId]);
    return res.rowCount || 0;
  }
}

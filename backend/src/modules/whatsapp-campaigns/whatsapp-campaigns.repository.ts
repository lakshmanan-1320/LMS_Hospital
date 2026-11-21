import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  WhatsappConfigRecord,
  WhatsappTemplateRecord,
  WhatsappOutboxRecord,
} from './interfaces/whatsapp-campaign.interfaces';

@Injectable()
export class WhatsappCampaignsRepository {
  private readonly logger = new Logger(WhatsappCampaignsRepository.name);

  constructor(
    @Inject(DatabaseService)
    private readonly pool: DatabaseService,
  ) {}

  // ── 1. CONFIGURATION ────────────────────────────────────────────────────────

  async findConfig(): Promise<WhatsappConfigRecord | null> {
    const query = `
      SELECT *
      FROM whatsapp_configs
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const res = await this.pool.query(query);
    return res.rows[0] || null;
  }

  async saveConfig(
    data: {
      app_id: string;
      app_secret_encrypted: string;
      waba_id: string;
      phone_number_id: string;
      display_phone_number?: string;
      business_name?: string;
      access_token_encrypted: string;
      webhook_verify_token_encrypted?: string;
      graph_version?: string;
      redirect_to?: string;
      status: string;
      last_validated_at?: Date | null;
      last_error?: string | null;
    },
    userId?: string,
  ): Promise<WhatsappConfigRecord> {
    const existing = await this.findConfig();

    if (existing) {
      const query = `
        UPDATE whatsapp_configs
        SET app_id = $1,
            app_secret_encrypted = $2,
            waba_id = $3,
            phone_number_id = $4,
            display_phone_number = $5,
            business_name = $6,
            access_token_encrypted = $7,
            webhook_verify_token_encrypted = $8,
            graph_version = $9,
            redirect_to = $10,
            status = $11,
            last_validated_at = $12,
            last_error = $13,
            updated_at = CURRENT_TIMESTAMP
        WHERE config_id = $14
        RETURNING *
      `;
      const values = [
        data.app_id,
        data.app_secret_encrypted,
        data.waba_id,
        data.phone_number_id,
        data.display_phone_number || existing.display_phone_number,
        data.business_name || existing.business_name,
        data.access_token_encrypted,
        data.webhook_verify_token_encrypted || existing.webhook_verify_token_encrypted,
        data.graph_version || existing.graph_version || 'v26.0',
        data.redirect_to ?? existing.redirect_to,
        data.status,
        data.last_validated_at ?? existing.last_validated_at,
        data.last_error ?? existing.last_error,
        existing.config_id,
      ];
      const res = await this.pool.query(query, values);
      return res.rows[0];
    } else {
      const query = `
        INSERT INTO whatsapp_configs (
          app_id, app_secret_encrypted, waba_id, phone_number_id,
          display_phone_number, business_name, access_token_encrypted,
          webhook_verify_token_encrypted, graph_version, redirect_to,
          status, last_validated_at, last_error, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const values = [
        data.app_id,
        data.app_secret_encrypted,
        data.waba_id,
        data.phone_number_id,
        data.display_phone_number || null,
        data.business_name || null,
        data.access_token_encrypted,
        data.webhook_verify_token_encrypted || null,
        data.graph_version || 'v26.0',
        data.redirect_to || null,
        data.status,
        data.last_validated_at || null,
        data.last_error || null,
        userId || null,
      ];
      const res = await this.pool.query(query, values);
      return res.rows[0];
    }
  }

  async updateConfigValidation(
    configId: string,
    status: string,
    lastError: string | null = null,
    displayPhone?: string,
    businessName?: string,
  ): Promise<void> {
    const query = `
      UPDATE whatsapp_configs
      SET status = $1,
          last_validated_at = CURRENT_TIMESTAMP,
          last_error = $2,
          display_phone_number = COALESCE($3, display_phone_number),
          business_name = COALESCE($4, business_name),
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = $5
    `;
    await this.pool.query(query, [status, lastError, displayPhone || null, businessName || null, configId]);
  }

  // ── 2. TEMPLATES ────────────────────────────────────────────────────────────

  async listTemplates(activeOnly = false): Promise<WhatsappTemplateRecord[]> {
    let query = `
      SELECT *
      FROM whatsapp_templates
    `;
    const params: any[] = [];
    if (activeOnly) {
      query += ` WHERE is_active = true AND status = 'APPROVED'`;
    }
    query += ` ORDER BY name ASC`;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findTemplateByName(name: string, language = 'en_US'): Promise<WhatsappTemplateRecord | null> {
    const query = `
      SELECT *
      FROM whatsapp_templates
      WHERE name = $1 AND language = $2
      LIMIT 1
    `;
    const res = await this.pool.query(query, [name, language]);
    return res.rows[0] || null;
  }

  async upsertTemplate(data: {
    meta_template_id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    body_text: string;
    components: any[];
    variables: string[];
    rejected_reason?: string | null;
  }): Promise<WhatsappTemplateRecord> {
    const query = `
      INSERT INTO whatsapp_templates (
        meta_template_id, name, language, category, status,
        body_text, components, variables, rejected_reason, synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (meta_template_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        language = EXCLUDED.language,
        category = EXCLUDED.category,
        status = EXCLUDED.status,
        body_text = EXCLUDED.body_text,
        components = EXCLUDED.components,
        variables = EXCLUDED.variables,
        rejected_reason = EXCLUDED.rejected_reason,
        synced_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      data.meta_template_id,
      data.name,
      data.language,
      data.category,
      data.status,
      data.body_text,
      JSON.stringify(data.components || []),
      JSON.stringify(data.variables || []),
      data.rejected_reason || null,
    ]);
    return res.rows[0];
  }

  // ── 3. CAMPAIGNS ────────────────────────────────────────────────────────────

  async createCampaign(data: {
    name: string;
    whatsapp_template_id: string | null;
    target_type: string;
    target_id?: string | null;
    total_recipients: number;
    created_by?: string | null;
  }): Promise<any> {
    const query = `
      INSERT INTO campaigns (
        name, channel, whatsapp_template_id, target_type, target_id,
        status, total_recipients, sent_count, delivered_count, failed_count,
        started_at, created_by
      )
      VALUES ($1, 'whatsapp', $2, $3, $4, 'processing', $5, 0, 0, 0, CURRENT_TIMESTAMP, $6)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      data.name,
      data.whatsapp_template_id,
      data.target_type,
      data.target_id || null,
      data.total_recipients,
      data.created_by || null,
    ]);
    return res.rows[0];
  }

  async updateCampaignCounts(
    campaignId: string,
    sent: number,
    delivered: number,
    failed: number,
    status = 'completed',
  ): Promise<void> {
    const query = `
      UPDATE campaigns
      SET sent_count = sent_count + $1,
          delivered_count = delivered_count + $2,
          failed_count = failed_count + $3,
          status = $4,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = $5
    `;
    await this.pool.query(query, [sent, delivered, failed, status, campaignId]);
  }

  async listCampaigns(limit = 50, offset = 0): Promise<any[]> {
    const query = `
      SELECT c.*, wt.name AS template_name, wt.category AS template_category
      FROM campaigns c
      LEFT JOIN whatsapp_templates wt ON wt.template_id = c.whatsapp_template_id
      WHERE c.channel = 'whatsapp'
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const res = await this.pool.query(query, [limit, offset]);
    return res.rows;
  }

  // ── 4. OUTBOX LOGS ──────────────────────────────────────────────────────────

  async insertOutboxLog(data: {
    campaign_id?: string | null;
    template_id?: string | null;
    recipient_phone: string;
    recipient_name?: string | null;
    rendered_body: string;
    parameters: any[];
    status: string;
    meta_message_id?: string | null;
    error_message?: string | null;
    error_details?: any;
    sent_at?: Date | null;
  }): Promise<WhatsappOutboxRecord> {
    const query = `
      INSERT INTO whatsapp_outbox (
        campaign_id, template_id, recipient_phone, recipient_name,
        rendered_body, parameters, status, meta_message_id,
        error_message, error_details, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      data.campaign_id || null,
      data.template_id || null,
      data.recipient_phone,
      data.recipient_name || null,
      data.rendered_body,
      JSON.stringify(data.parameters || []),
      data.status,
      data.meta_message_id || null,
      data.error_message || null,
      data.error_details ? JSON.stringify(data.error_details) : null,
      data.sent_at || null,
    ]);
    return res.rows[0];
  }

  async updateOutboxStatusByMetaId(
    metaMessageId: string,
    status: string,
    errorDetails: any = null,
  ): Promise<void> {
    let query = `
      UPDATE whatsapp_outbox
      SET status = $1,
          error_details = COALESCE($2, error_details)
    `;
    if (status === 'DELIVERED') {
      query += `, delivered_at = CURRENT_TIMESTAMP`;
    } else if (status === 'READ') {
      query += `, read_at = CURRENT_TIMESTAMP`;
    }
    query += ` WHERE meta_message_id = $3`;

    await this.pool.query(query, [
      status,
      errorDetails ? JSON.stringify(errorDetails) : null,
      metaMessageId,
    ]);
  }

  async listOutboxLogs(limit = 100, offset = 0, statusFilter?: string): Promise<WhatsappOutboxRecord[]> {
    let query = `
      SELECT o.*, c.name AS campaign_name, wt.name AS template_name
      FROM whatsapp_outbox o
      LEFT JOIN campaigns c ON c.campaign_id = o.campaign_id
      LEFT JOIN whatsapp_templates wt ON wt.template_id = o.template_id
    `;
    const params: any[] = [];
    if (statusFilter) {
      query += ` WHERE o.status = $1`;
      params.push(statusFilter);
    }
    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getOutboxStats(): Promise<{
    total: number;
    delivered: number;
    read: number;
    failed: number;
  }> {
    const query = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int AS delivered,
        COUNT(*) FILTER (WHERE status = 'READ')::int AS read,
        COUNT(*) FILTER (WHERE status IN ('FAILED', 'REJECTED'))::int AS failed
      FROM whatsapp_outbox
    `;
    const res = await this.pool.query(query);
    return res.rows[0] || { total: 0, delivered: 0, read: 0, failed: 0 };
  }

  // ── 5. AUDIENCES (Webinars / Students) ──────────────────────────────────────

  async listWebinarAudiences(): Promise<any[]> {
    const query = `
      SELECT w.id, w.title, w.slug, w.start_time,
             COUNT(wr.registration_id)::int AS registrant_count
      FROM webinars w
      LEFT JOIN webinar_registrations wr ON wr.webinar_id = w.id
      GROUP BY w.id, w.title, w.slug, w.start_time
      ORDER BY w.start_time DESC
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  async getWebinarRegistrants(webinarId: string): Promise<any[]> {
    const query = `
      SELECT wr.registration_id, wr.name, wr.email, wr.phone, wr.country_code,
             w.title AS webinar_title
      FROM webinar_registrations wr
      JOIN webinars w ON w.id = wr.webinar_id
      WHERE wr.webinar_id = $1 AND wr.phone IS NOT NULL AND wr.phone != ''
    `;
    const res = await this.pool.query(query, [webinarId]);
    return res.rows;
  }
}

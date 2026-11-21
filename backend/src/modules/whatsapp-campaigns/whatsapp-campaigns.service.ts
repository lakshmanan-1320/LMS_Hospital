import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { WhatsappCampaignsRepository } from './whatsapp-campaigns.repository';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import { encryptSecret, decryptSecret } from './utils/whatsapp-secret-box';
import {
  normalizeWhatsappPhone,
  extractTemplateVariableNumbers,
  renderTemplateText,
} from './utils/whatsapp.utils';
import {
  SaveWhatsappConfigDto,
  TestWhatsappGatewayDto,
  SendBulkWhatsappDto,
} from './dto/whatsapp-campaign.dto';

@Injectable()
export class WhatsappCampaignsService {
  private readonly logger = new Logger(WhatsappCampaignsService.name);

  constructor(
    @Inject(WhatsappCampaignsRepository)
    private readonly repository: WhatsappCampaignsRepository,
    @Inject(MetaWhatsappProvider)
    private readonly metaProvider: MetaWhatsappProvider,
  ) {}

  // ── 1. CONFIGURATION MANAGEMENT ─────────────────────────────────────────────

  async getConfig(): Promise<any> {
    const config = await this.repository.findConfig();
    const publicUrl =
      process.env.PUBLIC_API_URL ||
      process.env.BACKEND_PUBLIC_URL ||
      'https://lms.smjtechnology.online';
    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/campaigns/whatsapp/webhook`;

    if (!config) {
      return {
        configured: false,
        status: 'draft',
        appId: '',
        wabaId: '',
        phoneNumberId: '',
        displayPhoneNumber: '',
        businessName: '',
        graphVersion: 'v26.0',
        redirectTo: '',
        hasAppSecret: false,
        hasAccessToken: false,
        hasWebhookVerifyToken: false,
        webhookUrl,
        verifyTokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      };
    }

    const hasSecret = Boolean(decryptSecret(config.app_secret_encrypted));
    const hasToken = Boolean(decryptSecret(config.access_token_encrypted));
    const hasVerify =
      Boolean(decryptSecret(config.webhook_verify_token_encrypted || '')) ||
      Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);

    return {
      configId: config.config_id,
      configured: true,
      status: config.status,
      appId: config.app_id,
      wabaId: config.waba_id,
      phoneNumberId: config.phone_number_id,
      displayPhoneNumber: config.display_phone_number || '',
      businessName: config.business_name || '',
      graphVersion: config.graph_version || 'v26.0',
      redirectTo: config.redirect_to || '',
      hasAppSecret: hasSecret,
      hasAccessToken: hasToken,
      hasWebhookVerifyToken: hasVerify,
      webhookUrl,
      verifyTokenConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      lastValidatedAt: config.last_validated_at,
      lastError: config.last_error,
    };
  }

  async saveConfig(dto: SaveWhatsappConfigDto, userId?: string): Promise<any> {
    const existing = await this.repository.findConfig();

    let encryptedSecret = existing?.app_secret_encrypted || '';
    if (dto.app_secret && dto.app_secret.trim()) {
      encryptedSecret = encryptSecret(dto.app_secret.trim());
    } else if (!existing) {
      throw new BadRequestException('Meta App Secret is required.');
    }

    let encryptedToken = existing?.access_token_encrypted || '';
    if (dto.access_token && dto.access_token.trim()) {
      encryptedToken = encryptSecret(dto.access_token.trim());
    } else if (!existing) {
      throw new BadRequestException('Meta System User Access Token is required.');
    }

    let encryptedVerifyToken = existing?.webhook_verify_token_encrypted || null;
    if (dto.webhook_verify_token && dto.webhook_verify_token.trim()) {
      encryptedVerifyToken = encryptSecret(dto.webhook_verify_token.trim());
    }

    const saved = await this.repository.saveConfig(
      {
        app_id: dto.app_id.trim(),
        app_secret_encrypted: encryptedSecret,
        waba_id: dto.waba_id.trim(),
        phone_number_id: dto.phone_number_id.trim(),
        display_phone_number: dto.display_phone_number?.trim() || existing?.display_phone_number || undefined,
        business_name: dto.business_name?.trim() || existing?.business_name || undefined,
        access_token_encrypted: encryptedToken,
        webhook_verify_token_encrypted: encryptedVerifyToken || undefined,
        graph_version: dto.graph_version?.trim() || 'v26.0',
        redirect_to: dto.redirect_to !== undefined ? dto.redirect_to?.trim() || null : existing?.redirect_to,
        status: 'draft',
      },
      userId,
    );

    // Auto-validate connection with Meta
    try {
      const validation = await this.metaProvider.validateConnection(saved);
      if (validation.valid) {
        await this.repository.updateConfigValidation(
          saved.config_id,
          'active',
          null,
          validation.displayPhoneNumber,
          validation.verifiedName,
        );
      } else {
        await this.repository.updateConfigValidation(
          saved.config_id,
          'error',
          validation.error || 'Validation failed',
        );
      }
    } catch (err: any) {
      await this.repository.updateConfigValidation(
        saved.config_id,
        'error',
        err.message || 'Validation error',
      );
    }

    return this.getConfig();
  }

  async testGateway(dto: TestWhatsappGatewayDto): Promise<any> {
    const config = await this.repository.findConfig();
    if (!config) {
      throw new BadRequestException('WhatsApp Gateway is not configured.');
    }

    const targetPhone = normalizeWhatsappPhone(dto.to_phone);
    if (!targetPhone) {
      throw new BadRequestException('Please provide a valid destination phone number.');
    }

    let templateName = dto.template_name?.trim();
    if (!templateName) {
      // Find first approved template
      const templates = await this.repository.listTemplates(true);
      if (!templates.length) {
        throw new BadRequestException(
          'No approved WhatsApp templates found. Please sync templates from Meta first.',
        );
      }
      templateName = templates[0].name;
    }

    const template = await this.repository.findTemplateByName(templateName);
    if (!template) {
      throw new NotFoundException(`Template "${templateName}" not found or not approved.`);
    }

    const varNums = extractTemplateVariableNumbers(template.body_text);
    const sampleParams = varNums.map((_, i) => `Test Value ${i + 1}`);

    const res = await this.metaProvider.sendTemplateMessage(
      config,
      targetPhone,
      template.name,
      template.language,
      sampleParams,
    );

    // Log to outbox as test dispatch
    await this.repository.insertOutboxLog({
      campaign_id: null,
      template_id: template.template_id,
      recipient_phone: targetPhone,
      recipient_name: 'Test Recipient',
      rendered_body: renderTemplateText(template.body_text, sampleParams),
      parameters: sampleParams,
      status: 'SENT',
      meta_message_id: res.messageId,
      sent_at: new Date(),
    });

    return {
      success: true,
      messageId: res.messageId,
      message: `Test WhatsApp message sent successfully via Meta Cloud API!`,
    };
  }

  // ── 2. BULK CAMPAIGN DISPATCH ───────────────────────────────────────────────

  async sendBulkCampaign(dto: SendBulkWhatsappDto, userId?: string): Promise<any> {
    const config = await this.repository.findConfig();
    if (!config || config.status !== 'active') {
      throw new BadRequestException(
        'WhatsApp Gateway is not active. Please verify your Meta credentials in WhatsApp Gateway Settings.',
      );
    }

    const template = await this.repository.findTemplateByName(
      dto.template_name,
      dto.language || 'en_US',
    );
    if (!template) {
      throw new NotFoundException(
        `Template "${dto.template_name}" was not found. Please sync templates with Meta.`,
      );
    }

    const varNums = extractTemplateVariableNumbers(template.body_text);

    // Build recipient list
    interface RecipientItem {
      phone: string;
      name: string;
      params: string[];
    }

    const recipients: RecipientItem[] = [];

    if (dto.target_type === 'custom_list') {
      if (!dto.custom_recipients || dto.custom_recipients.length === 0) {
        throw new BadRequestException('No recipients provided for custom WhatsApp campaign list.');
      }

      for (const cr of dto.custom_recipients) {
        const norm = normalizeWhatsappPhone(cr.mobile);
        if (!norm) continue;

        // Map variables for sequential placeholders {{1}}, {{2}}, etc.
        const vars = cr.variables || {};
        const params = varNums.map((num) => {
          return vars[String(num)] || vars[num] || dto.custom_variables?.[String(num)] || '';
        });

        recipients.push({
          phone: norm,
          name: cr.name || 'Recipient',
          params,
        });
      }
    } else if (dto.target_type === 'webinar_registrants') {
      if (!dto.target_id) {
        throw new BadRequestException('Webinar ID is required for webinar audience broadcast.');
      }
      const regs = await this.repository.getWebinarRegistrants(dto.target_id);
      for (const r of regs) {
        const norm = normalizeWhatsappPhone(r.phone, r.country_code || '91');
        if (!norm) continue;

        // Auto map {{1}} to name, {{2}} to webinar title
        const params = varNums.map((num) => {
          if (num === 1) return r.name || 'Participant';
          if (num === 2) return r.webinar_title || 'Webinar';
          return dto.custom_variables?.[String(num)] || '';
        });

        recipients.push({
          phone: norm,
          name: r.name || 'Participant',
          params,
        });
      }
    }

    if (recipients.length === 0) {
      throw new BadRequestException('No valid recipient phone numbers found for this campaign.');
    }

    // Create Campaign record
    const campaign = await this.repository.createCampaign({
      name: dto.name,
      whatsapp_template_id: template.template_id,
      target_type: dto.target_type,
      target_id: dto.target_id,
      total_recipients: recipients.length,
      created_by: userId,
    });

    // Dispatch messages sequentially in small batches
    let sentCount = 0;
    let failedCount = 0;

    for (const item of recipients) {
      const rendered = renderTemplateText(template.body_text, item.params);
      try {
        const res = await this.metaProvider.sendTemplateMessage(
          config,
          item.phone,
          template.name,
          template.language,
          item.params,
        );

        await this.repository.insertOutboxLog({
          campaign_id: campaign.campaign_id,
          template_id: template.template_id,
          recipient_phone: item.phone,
          recipient_name: item.name,
          rendered_body: rendered,
          parameters: item.params,
          status: 'SENT',
          meta_message_id: res.messageId,
          sent_at: new Date(),
        });
        sentCount++;
      } catch (err: any) {
        failedCount++;
        await this.repository.insertOutboxLog({
          campaign_id: campaign.campaign_id,
          template_id: template.template_id,
          recipient_phone: item.phone,
          recipient_name: item.name,
          rendered_body: rendered,
          parameters: item.params,
          status: 'FAILED',
          error_message: err.message || 'Dispatch error',
        });
      }
    }

    await this.repository.updateCampaignCounts(
      campaign.campaign_id,
      sentCount,
      0, // delivered updated asynchronously via webhook
      failedCount,
      'completed',
    );

    return {
      campaignId: campaign.campaign_id,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      message: `WhatsApp campaign "${dto.name}" dispatched successfully to ${sentCount} recipients.`,
    };
  }

  // ── 3. LISTS & LOGS ─────────────────────────────────────────────────────────

  async listCampaigns(limit = 50, offset = 0) {
    return this.repository.listCampaigns(limit, offset);
  }

  async listOutboxLogs(limit = 100, offset = 0, status?: string) {
    return this.repository.listOutboxLogs(limit, offset, status);
  }

  async getOutboxStats() {
    return this.repository.getOutboxStats();
  }

  async listWebinarAudiences() {
    return this.repository.listWebinarAudiences();
  }

  // ── 4. WEBHOOKS (Delivery status tracking) ───────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'elevate_wa_webhook_secret_2026';
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    return null;
  }

  async processWebhook(payload: any): Promise<void> {
    if (!payload?.entry || !Array.isArray(payload.entry)) return;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages') {
          const val = change.value || {};
          const statuses = val.statuses || [];

          for (const s of statuses) {
            const metaId = s.id;
            const metaStatus = String(s.status || '').toUpperCase(); // DELIVERED, READ, FAILED, SENT
            const errors = s.errors || null;

            if (['DELIVERED', 'READ', 'FAILED', 'SENT'].includes(metaStatus)) {
              await this.repository.updateOutboxStatusByMetaId(metaId, metaStatus, errors);
            }
          }
        }
      }
    }
  }
}


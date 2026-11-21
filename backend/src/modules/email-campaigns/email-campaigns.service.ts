import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailSmtpProvider } from './providers/email-smtp.provider';
import { EmailAudienceService } from './email-audience.service';
import { EmailTemplateService } from './email-template.service';
import { EmailService } from '../../email/email.service';
import {
  SaveEmailConfigDto,
  TestEmailGatewayDto,
  SendBulkEmailDto,
} from './dto/email-campaign.dto';
import {
  encryptSecret,
  decryptSecret,
} from '../sms/utils/secret-box';
import { renderEmailTemplate } from './utils/email-template.utils';

@Injectable()
export class EmailCampaignsService {
  private readonly logger = new Logger(EmailCampaignsService.name);

  constructor(
    @Inject(EmailCampaignsRepository)
    private readonly repo: EmailCampaignsRepository,
    @Inject(EmailSmtpProvider)
    private readonly smtpProvider: EmailSmtpProvider,
    @Inject(EmailAudienceService)
    private readonly audienceService: EmailAudienceService,
    @Inject(EmailTemplateService)
    private readonly templateService: EmailTemplateService,
    @Optional()
    @Inject(EmailService)
    private readonly emailService?: EmailService,
  ) {}

  // ========================================================
  // 1. SUPER ADMIN GATEWAY CONFIGURATION
  // ========================================================

  async getConfig() {
    const config = await this.repo.getLatestEmailConfig();
    if (!config) {
      return {
        configured: false,
        status: 'draft',
        host: '',
        port: 465,
        encryption: 'ssl',
        username: '',
        password_set: false,
        from_name: 'Elevate Learning',
        from_email: '',
        redirect_to: '',
        last_validated_at: null,
        last_error: null,
      };
    }

    return {
      configured: true,
      config_id: config.config_id,
      status: config.status,
      host: config.host,
      port: config.port,
      encryption: config.encryption,
      username: config.username,
      password_set: Boolean(config.password_encrypted),
      from_name: config.from_name,
      from_email: config.from_email,
      redirect_to: config.redirect_to || '',
      last_validated_at: config.last_validated_at,
      last_error: config.last_error,
      updated_at: config.updated_at,
    };
  }

  async saveConfig(dto: SaveEmailConfigDto, userId?: string) {
    const existing = await this.repo.getLatestEmailConfig();

    let passwordEncrypted: string;
    if (dto.password && dto.password.trim().length > 0) {
      passwordEncrypted = encryptSecret(dto.password.trim());
    } else if (existing?.password_encrypted) {
      passwordEncrypted = existing.password_encrypted;
    } else {
      throw new BadRequestException('SMTP password is required for configuration.');
    }

    const saved = await this.repo.upsertEmailConfig({
      host: dto.host.trim(),
      port: Number(dto.port),
      encryption: dto.encryption,
      username: dto.username.trim(),
      password_encrypted: passwordEncrypted,
      from_name: dto.from_name.trim(),
      from_email: dto.from_email.trim(),
      redirect_to: dto.redirect_to ? dto.redirect_to.trim() : undefined,
      userId,
    });

    // Test connection immediately to set status
    const plainPass = dto.password?.trim() || decryptSecret(passwordEncrypted) || '';
    const verifyResult = await this.smtpProvider.verifyConnection({
      host: saved.host,
      port: saved.port,
      encryption: saved.encryption,
      username: saved.username,
      password: plainPass,
      from_name: saved.from_name,
      from_email: saved.from_email,
      redirect_to: saved.redirect_to,
    });

    const status = verifyResult.success ? 'active' : 'error';
    await this.repo.updateConfigStatus(
      saved.config_id,
      status,
      verifyResult.error || null,
    );

    // Invalidate cached EmailService transport so transactional emails use newly saved credentials
    this.emailService?.clearCache();

    return {
      ...saved,
      status,
      last_error: verifyResult.error || null,
      password_encrypted: undefined,
      password_set: true,
    };
  }

  async testGateway(dto: TestEmailGatewayDto, userId?: string) {
    const config = await this.repo.getLatestEmailConfig();
    if (!config) {
      throw new BadRequestException('Email Gateway has not been configured yet.');
    }

    const plainPass = decryptSecret(config.password_encrypted);
    if (!plainPass) {
      throw new BadRequestException('Failed to decrypt SMTP credentials.');
    }

    const sampleHtml = `
      <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Elevate LMS Email Gateway Test</h2>
        <p>This is a verification test email dispatched from <strong>Elevate LMS</strong>.</p>
        <p>Your SMTP Gateway configuration (<strong>${config.host}:${config.port}</strong>) is functioning correctly.</p>
        ${dto.custom_message ? `<div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin: 16px 0;"><em>${dto.custom_message}</em></div>` : ''}
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Sent via Super Admin Gateway Diagnostics</p>
      </div>
    `;

    const sendResult = await this.smtpProvider.sendSingle(
      {
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        username: config.username,
        password: plainPass,
        from_name: config.from_name,
        from_email: config.from_email,
        redirect_to: config.redirect_to,
      },
      {
        to: dto.to_email,
        subject: 'Elevate LMS — SMTP Gateway Test Connection',
        html: sampleHtml,
      },
    );

    if (!sendResult.success) {
      throw new BadRequestException(
        `Failed to send test email: ${sendResult.error}`,
      );
    }

    return {
      success: true,
      messageId: sendResult.messageId,
      deliveredTo: sendResult.actualDeliveredTo,
      message: `Test email successfully sent to ${sendResult.actualDeliveredTo}`,
    };
  }

  // ========================================================
  // 2. ADMIN BULK EMAIL CAMPAIGN DISPATCH & PROGRESS
  // ========================================================

  async sendBulkCampaign(dto: SendBulkEmailDto, userId?: string) {
    // 1. Verify Gateway is active
    const config = await this.repo.getLatestEmailConfig();
    if (!config) {
      throw new BadRequestException(
        'Email Gateway is not configured. Please contact Super Admin to set up SMTP settings.',
      );
    }

    const plainPass = decryptSecret(config.password_encrypted);
    if (!plainPass) {
      throw new BadRequestException('Failed to decrypt SMTP gateway credentials.');
    }

    // 2. Fetch template
    const template = await this.templateService.getTemplate(dto.template_id);

    // 3. Resolve target recipients
    const recipients = await this.audienceService.resolveRecipients(
      dto.target_type,
      dto.custom_recipients,
    );

    if (recipients.length === 0) {
      throw new BadRequestException(
        'Target audience returned 0 valid recipients. No emails were sent.',
      );
    }

    // 4. Create campaign record
    const campaign = await this.repo.createCampaign({
      name: dto.name,
      templateId: template.template_id,
      targetType: dto.target_type,
      totalRecipients: recipients.length,
      userId,
      metadata: {
        template_name: template.name,
        category: template.category,
        custom_variables: dto.custom_variables || {},
      },
    });

    // 5. Build and insert outbox entries
    const outboxItems = recipients.map((r) => {
      const mergedVars = {
        ...r.variables,
        ...(dto.custom_variables || {}),
        name: r.name || 'Learner',
        email: r.email,
        current_year: new Date().getFullYear().toString(),
      };

      const renderedHtml = renderEmailTemplate(template.html_content, mergedVars);
      const renderedSubject = renderEmailTemplate(template.subject, mergedVars);

      return {
        campaign_id: campaign.campaign_id,
        template_id: template.template_id,
        recipient_email: r.email,
        recipient_name: r.name,
        subject: renderedSubject,
        rendered_html: renderedHtml,
        variables: mergedVars,
      };
    });

    const insertedOutbox = await this.repo.insertOutboxEntries(outboxItems);

    // 6. Asynchronously execute batch dispatch
    this.executeBatchDispatch(
      campaign.campaign_id,
      insertedOutbox,
      {
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        username: config.username,
        password: plainPass,
        from_name: config.from_name,
        from_email: config.from_email,
        redirect_to: config.redirect_to,
      },
    ).catch((err) => {
      this.logger.error(
        `Background bulk email dispatch failed for campaign ${campaign.campaign_id}: ${err.message}`,
      );
    });

    return {
      campaign_id: campaign.campaign_id,
      name: campaign.name,
      total_recipients: recipients.length,
      status: 'processing',
      message: `Bulk email campaign queued for ${recipients.length} recipients. Processing started.`,
    };
  }

  /**
   * Background chunked batch dispatcher with rate limiting
   */
  private async executeBatchDispatch(
    campaignId: string,
    outboxRows: any[],
    smtpOptions: any,
  ) {
    this.logger.log(
      `Starting background batch dispatch for campaign ${campaignId} (${outboxRows.length} emails)...`,
    );

    let sentCount = 0;
    let failedCount = 0;
    const CHUNK_SIZE = 25; // Process in batches of 25

    for (let i = 0; i < outboxRows.length; i += CHUNK_SIZE) {
      const chunk = outboxRows.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (item) => {
          try {
            const res = await this.smtpProvider.sendSingle(smtpOptions, {
              to: item.recipient_email,
              recipientName: item.recipient_name,
              subject: item.subject,
              html: item.rendered_html,
            });

            if (res.success) {
              sentCount++;
              await this.repo.updateOutboxItem(
                item.outbox_id,
                'SENT',
                res.messageId || null,
                null,
              );
            } else {
              failedCount++;
              await this.repo.updateOutboxItem(
                item.outbox_id,
                'FAILED',
                null,
                res.error || 'SMTP Error',
              );
            }
          } catch (err: any) {
            failedCount++;
            await this.repo.updateOutboxItem(
              item.outbox_id,
              'FAILED',
              null,
              err.message || 'Unknown Error',
            );
          }
        }),
      );

      // Micro delay between chunks to prevent SMTP socket overload
      if (i + CHUNK_SIZE < outboxRows.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    const finalStatus = failedCount === outboxRows.length ? 'failed' : 'completed';
    await this.repo.updateCampaignStats(
      campaignId,
      sentCount,
      failedCount,
      finalStatus,
    );

    this.logger.log(
      `Finished batch dispatch for campaign ${campaignId}: ${sentCount} sent, ${failedCount} failed.`,
    );
  }

  async getCampaigns(limit = 20, offset = 0) {
    return this.repo.getEmailCampaigns(limit, offset);
  }

  async getOutboxLogs(options: {
    campaignId?: string;
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repo.getOutboxLogs(options);
  }
}

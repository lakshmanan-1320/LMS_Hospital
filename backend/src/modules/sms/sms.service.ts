import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SmsRepository } from './sms.repository';
import { SmsProviderFactory } from './providers/sms-provider.factory';
import { SmsTemplateService } from './sms-template.service';
import { SmsAudienceService } from './sms-audience.service';
import { encryptSecret, decryptSecret } from './utils/secret-box';
import { renderTemplate, normalizeMobile, detectCountry } from './utils/sms.utils';
import { SmsConfigEntity, CampaignEntity } from './interfaces/sms.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SmsRepository) private readonly smsRepository: SmsRepository,
    @Inject(SmsProviderFactory) private readonly providerFactory: SmsProviderFactory,
    @Inject(SmsTemplateService) private readonly templateService: SmsTemplateService,
    @Inject(SmsAudienceService) private readonly audienceService: SmsAudienceService,
  ) {}

  // ── 1. CONFIG & CREDENTIAL MANAGEMENT ─────────────────────────────────────

  async getConfig(): Promise<any> {
    const config = await this.smsRepository.findConfig();
    const providers = this.providerFactory.listProviders();
    if (!config) {
      return {
        configured: false,
        status: 'draft',
        providerKey: 'msg91',
        senderId: '',
        defaultCountryCode: '91',
        providers,
      };
    }

    let hasKey = false;
    try {
      const creds = JSON.parse(decryptSecret(config.credentials_encrypted) || '{}');
      hasKey = Boolean(creds.authKey);
    } catch {
      hasKey = false;
    }

    return {
      configId: config.config_id,
      configured: true,
      providerKey: config.provider_key,
      senderId: config.sender_id,
      dltEntityId: config.dlt_entity_id,
      defaultCountryCode: config.default_country_code,
      status: config.status,
      hasCredentials: hasKey,
      lastValidatedAt: config.last_validated_at,
      lastError: config.last_error,
      providers,
    };
  }

  async saveConfig(data: {
    providerKey: string;
    authKey?: string;
    senderId: string;
    dltEntityId?: string;
    defaultCountryCode?: string;
    userId?: string;
  }): Promise<any> {
    const provider = this.providerFactory.getProvider(data.providerKey);
    const existing = await this.smsRepository.findConfig();

    let authKey = data.authKey?.trim();
    if (!authKey && existing) {
      try {
        const decrypted = JSON.parse(decryptSecret(existing.credentials_encrypted) || '{}');
        authKey = decrypted.authKey;
      } catch {
        authKey = '';
      }
    }

    if (!authKey && provider.key !== 'mock') {
      throw new BadRequestException('Auth key is required for SMS integration.');
    }
    if (!data.senderId || !data.senderId.trim()) {
      throw new BadRequestException('Sender ID is required (e.g. ELVLMS).');
    }

    const credentials = { authKey: authKey || 'mock_token' };
    const check = await provider.validateCredentials(credentials);
    const status = check.ok ? 'active' : 'error';

    const saved = await this.smsRepository.upsertConfig({
      providerKey: provider.key,
      credentialsEncrypted: encryptSecret(JSON.stringify(credentials)),
      senderId: data.senderId.trim().toUpperCase(),
      dltEntityId: data.dltEntityId?.trim() || null,
      defaultCountryCode: (data.defaultCountryCode || '91').replace(/\D/g, ''),
      status,
      lastValidatedAt: check.ok ? new Date() : existing?.last_validated_at,
      lastError: check.message || null,
      createdBy: data.userId || null,
    });

    return {
      success: true,
      validated: check.ok,
      message: check.ok ? 'SMS provider credentials verified successfully.' : check.message,
      config: saved,
    };
  }

  async testConnection(phoneNumber?: string): Promise<{ success: boolean; message: string; requestId?: string }> {
    const config = await this.smsRepository.findConfig();
    if (!config) {
      throw new BadRequestException('SMS integration is not configured yet.');
    }

    const provider = this.providerFactory.getProvider(config.provider_key);
    const creds = JSON.parse(decryptSecret(config.credentials_encrypted) || '{}');
    const check = await provider.validateCredentials(creds);

    if (!check.ok) {
      await this.smsRepository.updateConfigStatus(config.config_id, 'error', check.message);
      return { success: false, message: check.message || 'Provider check failed.' };
    }

    await this.smsRepository.updateConfigStatus(config.config_id, 'active', null);

    if (phoneNumber) {
      const normalized = normalizeMobile(phoneNumber, config.default_country_code);
      if (!normalized) {
        throw new BadRequestException('Invalid test phone number.');
      }
      try {
        // Send sample test via provider
        const result = await provider.send(creds, {
          templateId: 'test_template',
          mobile: normalized,
          variables: { name: 'Admin', code: '123456' },
          body: `Elevate LMS: Test connection successful for sender ${config.sender_id}.`,
          sender: config.sender_id,
        });
        return { success: true, message: `Test SMS sent to ${normalized}.`, requestId: result.requestId };
      } catch (err: any) {
        return { success: false, message: `Credentials are valid, but test SMS failed: ${err.message}` };
      }
    }

    return { success: true, message: 'Provider credentials verified successfully.' };
  }

  // ── 2. TEMPLATE-BASED BULK DISPATCH ───────────────────────────────────────

  async sendBulkCampaign(data: {
    campaignName: string;
    templateId: string;
    targetType: 'webinar_registrants' | 'course_students' | 'custom_list';
    targetId?: string;
    customVariables?: Record<string, string>;
    customRecipients?: Array<{ mobile: string; name?: string; variables?: Record<string, string> }>;
    includedPhoneNumbers?: string[];
    countryCodeFilter?: string;
    userId?: string;
  }): Promise<any> {
    const config = await this.smsRepository.findConfig();
    if (!config || config.status !== 'active') {
      throw new BadRequestException('SMS service is not active. Please configure and verify credentials in SMS Settings.');
    }

    const template = await this.templateService.getTemplateById(data.templateId);
    if (!template.is_active) {
      throw new BadRequestException('The selected message template is currently inactive.');
    }

    const provider = this.providerFactory.getProvider(config.provider_key);
    const credentials = JSON.parse(decryptSecret(config.credentials_encrypted) || '{}');

    // Resolve audience recipients based on target type
    let audienceRecipients: any[] = [];
    let targetTitle = 'Custom Audience';

    if (data.targetType === 'webinar_registrants') {
      if (!data.targetId) {
        throw new BadRequestException('Webinar ID is required for webinar registrants target.');
      }
      const audience = await this.audienceService.resolveWebinarAudience(data.targetId, config.default_country_code);
      audienceRecipients = audience.recipients;
      targetTitle = audience.targetTitle || 'Webinar';
    } else if (data.targetType === 'custom_list') {
      if (!data.customRecipients || data.customRecipients.length === 0) {
        throw new BadRequestException('No custom recipients were provided for bulk SMS dispatch.');
      }
      targetTitle = 'Excel / Custom Contact List';
      audienceRecipients = data.customRecipients.map((cr) => {
        const normalized = normalizeMobile(cr.mobile, config.default_country_code);
        const country = detectCountry(normalized || cr.mobile);
        const name = (cr.name || 'Learner').trim();
        const parts = name.split(' ');
        const firstName = parts[0] || 'Learner';
        const lastName = parts.slice(1).join(' ') || '';
        return {
          firstName,
          lastName,
          fullName: name,
          email: '',
          rawPhone: cr.mobile,
          normalizedPhone: normalized,
          countryCode: country.code,
          countryName: country.name,
          countryFlag: country.flag,
          isValidPhone: Boolean(normalized),
          contextValues: {
            'recipient.name': name,
            'recipient.firstName': firstName,
            'recipient.lastName': lastName,
            'recipient.phone': normalized || cr.mobile,
            ...(cr.variables || {}),
          },
        };
      });
    } else {
      throw new BadRequestException(`Target type '${data.targetType}' is not supported yet.`);
    }

    // Filter recipients: valid phone only, optional country filter, optional included list
    let targetRecipients = audienceRecipients.filter((r) => r.isValidPhone);

    if (data.countryCodeFilter && data.countryCodeFilter !== 'all') {
      targetRecipients = targetRecipients.filter((r) => r.countryCode === data.countryCodeFilter);
    }

    if (data.includedPhoneNumbers && data.includedPhoneNumbers.length > 0) {
      const allowedSet = new Set(data.includedPhoneNumbers);
      targetRecipients = targetRecipients.filter((r) => allowedSet.has(r.normalizedPhone));
    }

    if (targetRecipients.length === 0) {
      throw new BadRequestException('No eligible recipients with valid phone numbers were found for this campaign.');
    }

    // 1. Create campaign record
    const campaign = await this.smsRepository.createCampaign({
      name: data.campaignName.trim(),
      templateId: template.template_id,
      targetType: data.targetType,
      targetId: data.targetId || null,
      totalRecipients: targetRecipients.length,
      metadata: {
        templateName: template.name,
        providerTemplateId: template.provider_template_id,
        targetTitle,
        countryCodeFilter: data.countryCodeFilter || 'all',
        customVariables: data.customVariables || {},
      },
      createdBy: data.userId || null,
    });

    const results = {
      campaignId: campaign.campaign_id,
      totalRecipients: targetRecipients.length,
      sentCount: 0,
      failedCount: 0,
      batchCount: 0,
    };

    // 2. Prepare payload items with rendered template and mapped variables
    const bulkItems = targetRecipients.map((recipient) => {
      const mergedVariables = {
        ...recipient.contextValues,
        ...(data.customVariables || {}),
      };
      const rendered = renderTemplate(template.body, mergedVariables);
      return {
        mobile: recipient.normalizedPhone!,
        name: recipient.fullName,
        variables: mergedVariables,
        renderedBody: rendered,
      };
    });

    // 3. Chunk into batches of 100 for MSG91 Flow API
    const BATCH_SIZE = 100;
    for (let i = 0; i < bulkItems.length; i += BATCH_SIZE) {
      const chunk = bulkItems.slice(i, i + BATCH_SIZE);
      results.batchCount += 1;

      try {
        const { requestId } = await provider.sendBulk(credentials, {
          templateId: template.provider_template_id,
          recipients: chunk.map((c) => ({ mobile: c.mobile, variables: c.variables })),
        });

        // Insert outbox rows
        for (const item of chunk) {
          await this.smsRepository.insertOutboxRow({
            campaignId: campaign.campaign_id,
            templateId: template.template_id,
            recipientPhone: item.mobile,
            recipientName: item.name,
            renderedBody: item.renderedBody,
            variables: item.variables,
            status: 'SENT',
            providerKey: provider.key,
            providerRequestId: requestId,
            sentAt: new Date(),
          });
        }
        results.sentCount += chunk.length;
      } catch (err: any) {
        this.logger.error(`Batch ${results.batchCount} failed: ${err.message}`);
        for (const item of chunk) {
          await this.smsRepository.insertOutboxRow({
            campaignId: campaign.campaign_id,
            templateId: template.template_id,
            recipientPhone: item.mobile,
            recipientName: item.name,
            renderedBody: item.renderedBody,
            variables: item.variables,
            status: 'FAILED',
            providerKey: provider.key,
            errorMessage: err.message,
          });
        }
        results.failedCount += chunk.length;
      }
    }

    // 4. Update campaign completion metrics
    await this.smsRepository.updateCampaignMetrics(campaign.campaign_id, {
      sentCount: results.sentCount,
      failedCount: results.failedCount,
      status: results.failedCount === targetRecipients.length ? 'failed' : 'completed',
    });

    return {
      success: true,
      message: `Dispatched campaign '${campaign.name}' to ${results.sentCount} recipient(s).`,
      results,
    };
  }

  // ── 3. CAMPAIGNS & LOGS AUDIT ─────────────────────────────────────────────

  async listCampaigns(limit: number = 50, offset: number = 0) {
    return this.smsRepository.listCampaigns(limit, offset);
  }

  async getCampaignDetails(campaignId: string) {
    const campaign = await this.smsRepository.findCampaignById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${campaignId}' not found.`);
    }
    const { logs, total } = await this.smsRepository.listOutboxByCampaign(campaignId, 100, 0);
    return { campaign, logs, totalLogs: total };
  }

  async listOutboxLogs(limit: number = 100) {
    return this.smsRepository.listRecentOutbox(limit);
  }

  async syncDeliveryStatuses(): Promise<{ synced: number }> {
    const config = await this.smsRepository.findConfig();
    if (!config || config.status !== 'active') return { synced: 0 };

    const provider = this.providerFactory.getProvider(config.provider_key);
    const credentials = JSON.parse(decryptSecret(config.credentials_encrypted) || '{}');

    try {
      const reports = await provider.fetchStatuses(credentials);
      let updated = 0;
      for (const report of reports) {
        if (!report.status) continue;
        const mappedStatus = report.status === 'delivered' ? 'DELIVERED' : report.status === 'rejected' ? 'REJECTED' : 'FAILED';
        updated += await this.smsRepository.applyDeliveryStatus(
          report.requestId,
          mappedStatus,
          report.at ? new Date(report.at) : new Date(),
        );
      }
      return { synced: updated };
    } catch (err: any) {
      this.logger.warn(`Delivery sync failed: ${err.message}`);
      return { synced: 0 };
    }
  }
}

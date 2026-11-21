import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsRepository } from './settings.repository';
import { CourseBadgeSettingsDto, CourseBadgeRules, DEFAULT_COURSE_BADGE_RULES } from './dto/course-badge-settings.dto';
import { encryptSecret, decryptSecret } from '../sms/utils/secret-box';

export interface GoogleOAuthSettingsDto {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface ZoomOAuthSettingsDto {
  accountId?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecretToken?: string;
  authType?: string; // 'server_to_server' | 'oauth'
}

export interface ZohoOAuthSettingsDto {
  clientId?: string;
  clientSecret?: string;
  dataCenter?: string; // 'com' | 'in' | 'eu'
  redirectUri?: string;
}

export interface RefundPolicySettingsDto {
  allowGlobalRefunds?: boolean;
  defaultRefundPeriodDays?: number;
  antiAbuseConsumptionThresholdPercent?: number;
  policyEnforcementMode?: 'flexible' | 'strict_no_refunds' | 'enforce_platform_guarantee';
  applyToAllCourses?: boolean;
}

export interface BulkCourseRefundUpdateDto {
  courseIds?: string[];
  isRefundable: boolean;
  refundPeriodDays?: number;
  allCourses?: boolean;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private static readonly GOOGLE_OAUTH_KEY = 'google_oauth';
  private static readonly ZOOM_OAUTH_KEY = 'zoom_oauth';
  private static readonly ZOHO_OAUTH_KEY = 'zoho_oauth';

  constructor(
    @Inject(SettingsRepository) private readonly settingsRepo: SettingsRepository,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.encryptExistingPlaintextSecrets();
  }

  /**
   * Automatically detect and encrypt any existing plaintext credentials (client_id, account_id,
   * client_secret, webhook_secret_token) stored in system_settings using AES-256-GCM.
   * Runs on application startup for zero-touch database migration and complete encryption at rest.
   */
  async encryptExistingPlaintextSecrets() {
    try {
      // 1. Google OAuth Client ID & Secret
      const google = await this.settingsRepo.getSetting(SettingsService.GOOGLE_OAUTH_KEY);
      if (google) {
        let changed = false;
        const updated = { ...google };
        if (
          google.client_id &&
          typeof google.client_id === 'string' &&
          !google.client_id.startsWith('v1:') &&
          google.client_id.trim().length > 0
        ) {
          updated.client_id = this.safeEncrypt(google.client_id.trim());
          changed = true;
        }
        if (
          google.client_secret &&
          typeof google.client_secret === 'string' &&
          !google.client_secret.startsWith('v1:') &&
          google.client_secret.trim().length > 0
        ) {
          updated.client_secret = this.safeEncrypt(google.client_secret.trim());
          changed = true;
        }
        if (changed) {
          await this.settingsRepo.upsertSetting(
            SettingsService.GOOGLE_OAUTH_KEY,
            updated,
            'Master Google OAuth 2.0 credentials (auto-encrypted with AES-256-GCM)',
          );
          this.logger.log('Google OAuth credentials automatically encrypted with AES-256-GCM in database.');
        }
      }

      // 2. Zoom OAuth Account ID, Client ID, Secret, and Webhook Token
      const zoom = await this.settingsRepo.getSetting(SettingsService.ZOOM_OAUTH_KEY);
      if (zoom) {
        let changed = false;
        const updated = { ...zoom };
        if (
          zoom.account_id &&
          typeof zoom.account_id === 'string' &&
          !zoom.account_id.startsWith('v1:') &&
          zoom.account_id.trim().length > 0
        ) {
          updated.account_id = this.safeEncrypt(zoom.account_id.trim());
          changed = true;
        }
        if (
          zoom.client_id &&
          typeof zoom.client_id === 'string' &&
          !zoom.client_id.startsWith('v1:') &&
          zoom.client_id.trim().length > 0
        ) {
          updated.client_id = this.safeEncrypt(zoom.client_id.trim());
          changed = true;
        }
        if (
          zoom.client_secret &&
          typeof zoom.client_secret === 'string' &&
          !zoom.client_secret.startsWith('v1:') &&
          zoom.client_secret.trim().length > 0
        ) {
          updated.client_secret = this.safeEncrypt(zoom.client_secret.trim());
          changed = true;
        }
        if (
          zoom.webhook_secret_token &&
          typeof zoom.webhook_secret_token === 'string' &&
          !zoom.webhook_secret_token.startsWith('v1:') &&
          zoom.webhook_secret_token.trim().length > 0
        ) {
          updated.webhook_secret_token = this.safeEncrypt(zoom.webhook_secret_token.trim());
          changed = true;
        }
        if (changed) {
          await this.settingsRepo.upsertSetting(
            SettingsService.ZOOM_OAUTH_KEY,
            updated,
            'Master Zoom OAuth credentials (auto-encrypted with AES-256-GCM)',
          );
          this.logger.log('Zoom OAuth credentials automatically encrypted with AES-256-GCM in database.');
        }
      }

      // 3. Zoho Meeting OAuth Client ID & Secret
      const zoho = await this.settingsRepo.getSetting(SettingsService.ZOHO_OAUTH_KEY);
      if (zoho) {
        let changed = false;
        const updated = { ...zoho };
        if (
          zoho.client_id &&
          typeof zoho.client_id === 'string' &&
          !zoho.client_id.startsWith('v1:') &&
          zoho.client_id.trim().length > 0
        ) {
          updated.client_id = this.safeEncrypt(zoho.client_id.trim());
          changed = true;
        }
        if (
          zoho.client_secret &&
          typeof zoho.client_secret === 'string' &&
          !zoho.client_secret.startsWith('v1:') &&
          zoho.client_secret.trim().length > 0
        ) {
          updated.client_secret = this.safeEncrypt(zoho.client_secret.trim());
          changed = true;
        }
        if (changed) {
          await this.settingsRepo.upsertSetting(
            SettingsService.ZOHO_OAUTH_KEY,
            updated,
            'Master Zoho Meeting OAuth credentials (auto-encrypted with AES-256-GCM)',
          );
          this.logger.log('Zoho Meeting credentials automatically encrypted with AES-256-GCM in database.');
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not run auto-encryption migration for system_settings: ${err.message}`);
    }
  }

  /**
   * Safely decrypt an AES-256-GCM encrypted secret string.
   * Seamlessly falls back to raw value if it is a legacy plaintext secret.
   */
  private safeDecrypt(value?: string): string {
    if (!value || typeof value !== 'string') return '';
    if (value.startsWith('v1:')) {
      const decrypted = decryptSecret(value);
      return decrypted || '';
    }
    return value;
  }

  /**
   * Safely encrypt a secret string using AES-256-GCM.
   */
  private safeEncrypt(secret?: string): string {
    if (!secret || typeof secret !== 'string') return '';
    if (secret.startsWith('v1:')) return secret; // already encrypted
    return encryptSecret(secret);
  }

  // ==========================================================
  // GOOGLE OAUTH SETTINGS
  // ==========================================================

  async getGoogleOAuthSettings(maskSecret = true) {
    const stored = await this.settingsRepo.getSetting(SettingsService.GOOGLE_OAUTH_KEY);
    const envClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const envRedirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    const storedClientId = this.safeDecrypt(stored?.client_id);
    const clientId = storedClientId || envClientId;
    const storedClientSecret = this.safeDecrypt(stored?.client_secret);
    const clientSecret = storedClientSecret || envClientSecret;
    const redirectUri = stored?.redirect_uri || envRedirectUri;

    return {
      isConfigured: Boolean(clientId && clientSecret),
      clientId,
      clientSecret: maskSecret ? '' : clientSecret,
      redirectUri,
      hasSecret: Boolean(clientSecret),
    };
  }

  async getRawGoogleOAuthSettings(): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    isConfigured: boolean;
  }> {
    const stored = await this.settingsRepo.getSetting(SettingsService.GOOGLE_OAUTH_KEY);
    const envClientId = this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const envRedirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    const clientId = this.safeDecrypt(stored?.client_id) || envClientId;
    const clientSecret = this.safeDecrypt(stored?.client_secret) || envClientSecret;
    const redirectUri = stored?.redirect_uri || envRedirectUri;

    return {
      isConfigured: Boolean(clientId && clientSecret),
      clientId,
      clientSecret,
      redirectUri,
    };
  }

  async updateGoogleOAuthSettings(dto: GoogleOAuthSettingsDto, updatedBy: string) {
    const current = (await this.settingsRepo.getSetting(SettingsService.GOOGLE_OAUTH_KEY)) || {};

    const hasNewClientId = Boolean(
      dto.clientId &&
      dto.clientId.trim().length > 0 &&
      !dto.clientId.includes('...') &&
      !dto.clientId.includes('••••')
    );

    const hasNewSecret = Boolean(
      dto.clientSecret &&
      dto.clientSecret.trim().length > 0 &&
      !dto.clientSecret.includes('...') &&
      !dto.clientSecret.includes('••••')
    );

    const updatedValue = {
      ...current,
      client_id: hasNewClientId ? this.safeEncrypt(dto.clientId!.trim()) : current.client_id,
      client_secret: hasNewSecret
        ? this.safeEncrypt(dto.clientSecret!.trim())
        : current.client_secret,
      redirect_uri: dto.redirectUri !== undefined ? dto.redirectUri.trim() : current.redirect_uri,
    };

    await this.settingsRepo.upsertSetting(
      SettingsService.GOOGLE_OAUTH_KEY,
      updatedValue,
      'Master Google OAuth 2.0 credentials configured by Super Admin (AES-256-GCM encrypted)',
      updatedBy,
    );

    this.logger.log(`Google OAuth settings updated by Super Admin user [${updatedBy}] with AES-256-GCM encryption`);
    return this.getGoogleOAuthSettings(true);
  }

  // ==========================================================
  // ZOOM OAUTH & SERVER-TO-SERVER SETTINGS
  // ==========================================================

  async getZoomOAuthSettings(maskSecret = true) {
    const stored = await this.settingsRepo.getSetting(SettingsService.ZOOM_OAUTH_KEY);
    const envAccountId = this.configService.get<string>('ZOOM_ACCOUNT_ID') || '';
    const envClientId = this.configService.get<string>('ZOOM_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET') || '';
    const envWebhookToken = this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN') || '';

    const accountId = this.safeDecrypt(stored?.account_id) || envAccountId;
    const clientId = this.safeDecrypt(stored?.client_id) || envClientId;
    const storedClientSecret = this.safeDecrypt(stored?.client_secret);
    const storedWebhookToken = this.safeDecrypt(stored?.webhook_secret_token);
    const clientSecret = storedClientSecret || envClientSecret;
    const webhookSecretToken = storedWebhookToken || envWebhookToken;
    const authType = stored?.auth_type || 'server_to_server';

    return {
      isConfigured: Boolean(accountId && clientId && clientSecret),
      accountId,
      clientId,
      clientSecret: maskSecret ? '' : clientSecret,
      webhookSecretToken: maskSecret ? '' : webhookSecretToken,
      authType,
      hasSecret: Boolean(clientSecret),
      hasWebhookToken: Boolean(webhookSecretToken),
    };
  }

  async getRawZoomOAuthSettings(): Promise<{
    accountId: string;
    clientId: string;
    clientSecret: string;
    webhookSecretToken: string;
    authType: string;
    isConfigured: boolean;
  }> {
    const stored = await this.settingsRepo.getSetting(SettingsService.ZOOM_OAUTH_KEY);
    const envAccountId = this.configService.get<string>('ZOOM_ACCOUNT_ID') || '';
    const envClientId = this.configService.get<string>('ZOOM_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET') || '';
    const envWebhookToken = this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN') || '';

    const accountId = this.safeDecrypt(stored?.account_id) || envAccountId;
    const clientId = this.safeDecrypt(stored?.client_id) || envClientId;
    const clientSecret = this.safeDecrypt(stored?.client_secret) || envClientSecret;
    const webhookSecretToken = this.safeDecrypt(stored?.webhook_secret_token) || envWebhookToken;
    const authType = stored?.auth_type || 'server_to_server';

    return {
      accountId,
      clientId,
      clientSecret,
      webhookSecretToken,
      authType,
      isConfigured: Boolean(accountId && clientId && clientSecret),
    };
  }

  async updateZoomOAuthSettings(dto: ZoomOAuthSettingsDto, updatedBy: string) {
    const current = (await this.settingsRepo.getSetting(SettingsService.ZOOM_OAUTH_KEY)) || {};

    const hasNewAccountId = Boolean(
      dto.accountId &&
      dto.accountId.trim().length > 0 &&
      !dto.accountId.includes('...') &&
      !dto.accountId.includes('••••')
    );

    const hasNewClientId = Boolean(
      dto.clientId &&
      dto.clientId.trim().length > 0 &&
      !dto.clientId.includes('...') &&
      !dto.clientId.includes('••••')
    );

    const hasNewSecret = Boolean(
      dto.clientSecret &&
      dto.clientSecret.trim().length > 0 &&
      !dto.clientSecret.includes('...') &&
      !dto.clientSecret.includes('••••')
    );

    const hasNewWebhookToken = Boolean(
      dto.webhookSecretToken &&
      dto.webhookSecretToken.trim().length > 0 &&
      !dto.webhookSecretToken.includes('...') &&
      !dto.webhookSecretToken.includes('••••')
    );

    const updatedValue = {
      ...current,
      account_id: hasNewAccountId ? this.safeEncrypt(dto.accountId!.trim()) : current.account_id,
      client_id: hasNewClientId ? this.safeEncrypt(dto.clientId!.trim()) : current.client_id,
      client_secret: hasNewSecret
        ? this.safeEncrypt(dto.clientSecret!.trim())
        : current.client_secret,
      webhook_secret_token: hasNewWebhookToken
        ? this.safeEncrypt(dto.webhookSecretToken!.trim())
        : current.webhook_secret_token,
      auth_type: dto.authType || current.auth_type || 'server_to_server',
    };

    await this.settingsRepo.upsertSetting(
      SettingsService.ZOOM_OAUTH_KEY,
      updatedValue,
      'Master Zoom OAuth / Server-to-Server credentials configured by Super Admin (AES-256-GCM encrypted)',
      updatedBy,
    );

    this.logger.log(`Zoom OAuth settings updated by Super Admin user [${updatedBy}] with AES-256-GCM encryption`);
    return this.getZoomOAuthSettings(true);
  }

  // ==========================================================
  // ZOHO MEETING OAUTH SETTINGS
  // ==========================================================

  async getZohoOAuthSettings(maskSecret = true) {
    const stored = await this.settingsRepo.getSetting(SettingsService.ZOHO_OAUTH_KEY);
    const envClientId = this.configService.get<string>('ZOHO_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET') || '';
    const envDataCenter = this.configService.get<string>('ZOHO_DATA_CENTER') || 'com';
    const envRedirectUri =
      this.configService.get<string>('ZOHO_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    const clientId = this.safeDecrypt(stored?.client_id) || envClientId;
    const storedClientSecret = this.safeDecrypt(stored?.client_secret);
    const clientSecret = storedClientSecret || envClientSecret;
    const dataCenter = stored?.data_center || envDataCenter;
    const redirectUri = stored?.redirect_uri || envRedirectUri;

    return {
      isConfigured: Boolean(clientId && clientSecret),
      clientId,
      clientSecret: maskSecret ? '' : clientSecret,
      dataCenter,
      redirectUri,
      hasSecret: Boolean(clientSecret),
    };
  }

  async getRawZohoOAuthSettings(): Promise<{
    clientId: string;
    clientSecret: string;
    dataCenter: string;
    redirectUri: string;
    isConfigured: boolean;
  }> {
    const stored = await this.settingsRepo.getSetting(SettingsService.ZOHO_OAUTH_KEY);
    const envClientId = this.configService.get<string>('ZOHO_CLIENT_ID') || '';
    const envClientSecret = this.configService.get<string>('ZOHO_CLIENT_SECRET') || '';
    const envDataCenter = this.configService.get<string>('ZOHO_DATA_CENTER') || 'com';
    const envRedirectUri =
      this.configService.get<string>('ZOHO_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    const clientId = this.safeDecrypt(stored?.client_id) || envClientId;
    const clientSecret = this.safeDecrypt(stored?.client_secret) || envClientSecret;
    const dataCenter = stored?.data_center || envDataCenter;
    const redirectUri = stored?.redirect_uri || envRedirectUri;

    return {
      clientId,
      clientSecret,
      dataCenter,
      redirectUri,
      isConfigured: Boolean(clientId && clientSecret),
    };
  }

  async updateZohoOAuthSettings(dto: ZohoOAuthSettingsDto, updatedBy: string) {
    const current = (await this.settingsRepo.getSetting(SettingsService.ZOHO_OAUTH_KEY)) || {};

    const hasNewClientId = Boolean(
      dto.clientId &&
      dto.clientId.trim().length > 0 &&
      !dto.clientId.includes('...') &&
      !dto.clientId.includes('••••')
    );

    const hasNewSecret = Boolean(
      dto.clientSecret &&
      dto.clientSecret.trim().length > 0 &&
      !dto.clientSecret.includes('...') &&
      !dto.clientSecret.includes('••••')
    );

    const updatedValue = {
      ...current,
      client_id: hasNewClientId ? this.safeEncrypt(dto.clientId!.trim()) : current.client_id,
      client_secret: hasNewSecret
        ? this.safeEncrypt(dto.clientSecret!.trim())
        : current.client_secret,
      data_center: dto.dataCenter || current.data_center || 'com',
      redirect_uri: dto.redirectUri !== undefined ? dto.redirectUri.trim() : current.redirect_uri,
    };

    await this.settingsRepo.upsertSetting(
      SettingsService.ZOHO_OAUTH_KEY,
      updatedValue,
      'Master Zoho Meeting OAuth credentials configured by Super Admin (AES-256-GCM encrypted)',
      updatedBy,
    );

    this.logger.log(`Zoho Meeting OAuth settings updated by Super Admin user [${updatedBy}] with AES-256-GCM encryption`);
    return this.getZohoOAuthSettings(true);
  }

  // ==========================================
  // DYNAMIC REFUND POLICY SETTINGS
  // ==========================================

  async getRefundPolicySettings() {
    const policy = await this.settingsRepo.getRefundPolicy();
    const stats = await this.settingsRepo.getCourseRefundStats();
    return {
      policy: {
        allowGlobalRefunds: policy.allowGlobalRefunds ?? true,
        defaultRefundPeriodDays: policy.defaultRefundPeriodDays ?? 30,
        antiAbuseConsumptionThresholdPercent: policy.antiAbuseConsumptionThresholdPercent ?? 50,
        policyEnforcementMode: policy.policyEnforcementMode || 'flexible',
      },
      stats,
    };
  }

  async updateRefundPolicySettings(dto: RefundPolicySettingsDto, updatedBy: string) {
    const current = await this.settingsRepo.getRefundPolicy();
    const updated = {
      allowGlobalRefunds:
        dto.allowGlobalRefunds !== undefined ? Boolean(dto.allowGlobalRefunds) : current.allowGlobalRefunds ?? true,
      defaultRefundPeriodDays:
        dto.defaultRefundPeriodDays !== undefined
          ? Math.max(0, Number(dto.defaultRefundPeriodDays))
          : current.defaultRefundPeriodDays ?? 30,
      antiAbuseConsumptionThresholdPercent:
        dto.antiAbuseConsumptionThresholdPercent !== undefined
          ? Math.min(100, Math.max(1, Number(dto.antiAbuseConsumptionThresholdPercent)))
          : current.antiAbuseConsumptionThresholdPercent ?? 50,
      policyEnforcementMode: dto.policyEnforcementMode || current.policyEnforcementMode || 'flexible',
    };

    await this.settingsRepo.upsertSetting(
      'refund_policy',
      updated,
      'Platform-wide refund policy and Udemy anti-abuse configuration',
      updatedBy,
    );

    if (dto.applyToAllCourses) {
      if (updated.policyEnforcementMode === 'strict_no_refunds' || !updated.allowGlobalRefunds) {
        await this.settingsRepo.bulkUpdateCoursesRefund(false, 0);
      } else if (updated.policyEnforcementMode === 'enforce_platform_guarantee') {
        await this.settingsRepo.bulkUpdateCoursesRefund(true, updated.defaultRefundPeriodDays);
      }
    }

    this.logger.log(`Platform refund policy updated by user [${updatedBy}]`);
    return this.getRefundPolicySettings();
  }

  async listCoursesWithRefund(params: {
    search?: string;
    refundable?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.settingsRepo.listCoursesWithRefundSettings(params);
  }

  async updateCourseRefund(
    courseId: string,
    dto: { isRefundable: boolean; refundPeriodDays?: number },
    updatedBy: string,
  ) {
    const updated = await this.settingsRepo.updateCourseRefund(
      courseId,
      dto.isRefundable,
      dto.refundPeriodDays ?? 30,
    );
    this.logger.log(
      `Course [${courseId}] refund setting updated by [${updatedBy}] -> isRefundable=${dto.isRefundable}, days=${dto.refundPeriodDays}`,
    );
    return updated;
  }

  async bulkUpdateCoursesRefund(dto: BulkCourseRefundUpdateDto, updatedBy: string) {
    const count = await this.settingsRepo.bulkUpdateCoursesRefund(
      dto.isRefundable,
      dto.refundPeriodDays ?? 30,
      dto.allCourses ? undefined : dto.courseIds,
    );
    this.logger.log(
      `Bulk updated ${count} courses refund setting by [${updatedBy}] -> isRefundable=${dto.isRefundable}, days=${dto.refundPeriodDays}`,
    );
    return { success: true, updatedCount: count };
  }

  // ==========================================================
  // INTEGRATIONS OVERVIEW (Super Admin, status only, no secrets)
  // ==========================================================

  /**
   * One status summary for every external integration, for the Integrations hub.
   * Configuration itself stays on each integration's own screen.
   */
  async getIntegrationsOverview() {
    const [google, zoom, zoho, gateways] = await Promise.all([
      this.getRawGoogleOAuthSettings(),
      this.getRawZoomOAuthSettings(),
      this.getRawZohoOAuthSettings(),
      this.settingsRepo.getGatewayConfigStatuses(),
    ]);

    const keyId = this.configService.get<string>('razorpay.keyId') || '';
    const mockMode = Boolean(this.configService.get<boolean>('razorpay.mockMode'));
    const hasWebhookSecret = Boolean(this.configService.get<string>('razorpay.webhookSecret'));
    const connected = (provider: string) =>
      gateways.meetingAccounts.find((a) => a.provider === provider)?.account_email || null;

    const gatewayStatus = (row: Record<string, any> | null) => ({
      status: !row ? 'not_configured' : ['active', 'validated'].includes(row.status) ? 'connected' : row.status === 'error' ? 'error' : 'configured',
      identity: row?.identity || null,
      lastValidatedAt: row?.last_validated_at || null,
      lastError: row?.last_error || null,
    });

    return {
      integrations: [
        {
          key: 'razorpay',
          name: 'Razorpay',
          category: 'payments',
          managedIn: 'environment',
          status: !keyId ? 'not_configured' : mockMode ? 'test_mode' : 'connected',
          identity: keyId ? `${keyId.startsWith('rzp_live_') ? 'Live' : 'Test'} key ${keyId.slice(0, 12)}…` : null,
          details: { mode: mockMode ? 'simulator' : keyId.startsWith('rzp_live_') ? 'live' : 'test', webhookSecret: hasWebhookSecret },
        },
        { key: 'email', name: 'Email (SMTP)', category: 'messaging', managedIn: 'email_gateway', ...gatewayStatus(gateways.email) },
        {
          key: 'sms',
          name: `SMS${gateways.sms?.provider_key ? ` (${String(gateways.sms.provider_key).toUpperCase()})` : ''}`,
          category: 'messaging',
          managedIn: 'sms_gateway',
          ...gatewayStatus(gateways.sms),
        },
        { key: 'whatsapp', name: 'WhatsApp Business', category: 'messaging', managedIn: 'whatsapp_gateway', ...gatewayStatus(gateways.whatsapp) },
        {
          key: 'google_meet',
          name: 'Google Meet',
          category: 'meetings',
          managedIn: 'settings',
          status: !google.isConfigured ? 'not_configured' : connected('google_meet') ? 'connected' : 'configured',
          identity: connected('google_meet'),
        },
        {
          key: 'zoom',
          name: 'Zoom',
          category: 'meetings',
          managedIn: 'settings',
          status: !zoom.isConfigured ? 'not_configured' : connected('zoom') ? 'connected' : 'configured',
          identity: connected('zoom'),
        },
        {
          key: 'zoho',
          name: 'Zoho Meeting',
          category: 'meetings',
          managedIn: 'settings',
          status: !zoho.isConfigured ? 'not_configured' : connected('zoho') ? 'connected' : 'configured',
          identity: connected('zoho'),
        },
      ],
    };
  }

  // ==========================================================
  // COURSE BADGE RULES (Admin + Super Admin)
  // ==========================================================

  /** Rules for Bestseller / Highest rated / New badges, merged over defaults. */
  async getCourseBadgeRules(): Promise<CourseBadgeRules> {
    const saved = (await this.settingsRepo.getSetting('course_badges')) || {};
    return {
      bestseller: { ...DEFAULT_COURSE_BADGE_RULES.bestseller, ...(saved.bestseller || {}) },
      highestRated: { ...DEFAULT_COURSE_BADGE_RULES.highestRated, ...(saved.highestRated || {}) },
      newCourse: { ...DEFAULT_COURSE_BADGE_RULES.newCourse, ...(saved.newCourse || {}) },
    };
  }

  async updateCourseBadgeRules(dto: CourseBadgeSettingsDto, updatedBy: string): Promise<CourseBadgeRules> {
    const current = await this.getCourseBadgeRules();
    const updated: CourseBadgeRules = {
      bestseller: { ...current.bestseller, ...this.defined(dto.bestseller) },
      highestRated: { ...current.highestRated, ...this.defined(dto.highestRated) },
      newCourse: { ...current.newCourse, ...this.defined(dto.newCourse) },
    };
    await this.settingsRepo.upsertSetting(
      'course_badges',
      updated,
      'Rules for Bestseller, Highest rated and New course badges',
      updatedBy,
    );
    this.logger.log(`Course badge rules updated by user [${updatedBy}]`);
    return updated;
  }

  private defined<T extends object>(obj?: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined)) as Partial<T>;
  }
}

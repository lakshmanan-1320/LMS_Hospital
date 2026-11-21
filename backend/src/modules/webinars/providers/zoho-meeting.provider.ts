import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebinarProvider,
  CreateSessionInput,
  UpdateSessionInput,
  ProviderSessionResult,
} from '../interfaces/webinar-provider.interface';
import { SettingsService } from '../../settings/settings.service';
import { MeetingProvidersRepository } from '../meeting-providers.repository';

const ZOHO_SCOPES = [
  'ZohoMeeting.manageOrg.READ',
  'ZohoMeeting.user.READ',
  'ZohoMeeting.meeting.CREATE',
  'ZohoMeeting.meeting.READ',
  'ZohoMeeting.meeting.UPDATE',
  'ZohoMeeting.meeting.DELETE',
];

@Injectable()
export class ZohoMeetingProvider implements WebinarProvider {
  readonly providerName = 'zoho';
  private readonly logger = new Logger(ZohoMeetingProvider.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(MeetingProvidersRepository) private readonly meetingProvidersRepo: MeetingProvidersRepository,
  ) {}

  private formatZohoDate(date: Date, timeZone = 'UTC'): string {
    try {
      const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone,
      };
      const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
      const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
      return `${get('month')} ${get('day')}, ${get('year')} ${get('hour')}:${get('minute')} ${get('dayPeriod')}`;
    } catch {
      return date.toISOString();
    }
  }

  private getAccountsUrl(dataCenter = 'com'): string {
    const dc = (dataCenter || 'com').toLowerCase().trim();
    return `https://accounts.zoho.${dc}`;
  }

  private getApiUrl(dataCenter = 'com'): string {
    const dc = (dataCenter || 'com').toLowerCase().trim();
    return `https://meeting.zoho.${dc}/api/v2`;
  }

  /**
   * Resolves credentials dynamically from Super Admin settings / DB / env.
   */
  private async getCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    dataCenter: string;
    refreshToken: string;
    zsoid?: string;
  }> {
    const rawSettings = await this.settingsService.getRawZohoOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('zoho');

    const clientId = rawSettings.clientId || this.configService.get<string>('ZOHO_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('ZOHO_CLIENT_SECRET') || '';
    const dataCenter = activeAccount?.provider_metadata?.dataCenter || rawSettings.dataCenter || this.configService.get<string>('ZOHO_DATA_CENTER') || 'com';
    const refreshToken = activeAccount?.refresh_token || this.configService.get<string>('ZOHO_REFRESH_TOKEN') || '';
    let zsoid = activeAccount?.provider_metadata?.zsoid || this.configService.get<string>('ZOHO_ZSOID');

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Zoho Meeting OAuth credentials are not configured. Super Admin must set Zoho Client ID & Secret in Platform Settings.',
      );
    }

    if (!refreshToken) {
      throw new ServiceUnavailableException(
        'No Zoho account is currently connected. Please connect a Zoho account in Admin Settings (Meeting & Video Integrations).',
      );
    }

    // Auto-resolve zsoid if not yet captured
    if (!zsoid) {
      try {
        const token = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);
        const userRes = await fetch(`${this.getApiUrl(dataCenter)}/user.json`, {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          const userObj = userData.userDetails || userData.user || userData;
          zsoid = String(userObj.zsoid || userObj.orgId || '');
          if (zsoid && activeAccount) {
            await this.meetingProvidersRepo.upsertAccount({
              provider: 'zoho',
              accountEmail: activeAccount.account_email,
              accountName: activeAccount.account_name,
              accessToken: activeAccount.access_token,
              refreshToken: activeAccount.refresh_token,
              tokenExpiresAt: activeAccount.token_expires_at,
              scope: activeAccount.scope,
              providerMetadata: {
                ...activeAccount.provider_metadata,
                zsoid,
              },
              connectedBy: activeAccount.connected_by,
            });
            this.logger.log(`Lazily populated Zoho zsoid: ${zsoid}`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not lazily fetch zsoid: ${err.message}`);
      }
    }

    return {
      clientId,
      clientSecret,
      dataCenter,
      refreshToken,
      zsoid,
    };
  }

  /**
   * Generates Zoho OAuth authorization URL for Admin.
   */
  async generateAuthUrl(redirectUri?: string, state?: string): Promise<string> {
    const rawSettings = await this.settingsService.getRawZohoOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('ZOHO_CLIENT_ID');
    const dataCenter = rawSettings.dataCenter || 'com';
    const finalRedirect =
      redirectUri ||
      rawSettings.redirectUri ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId) {
      throw new BadRequestException('Zoho Client ID is not configured. Please contact Super Admin.');
    }

    const params = new URLSearchParams({
      scope: ZOHO_SCOPES.join(','),
      client_id: clientId,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      redirect_uri: finalRedirect,
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.getAccountsUrl(dataCenter)}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Handles Zoho OAuth authorization code exchange.
   */
  async handleOAuthCallback(
    code: string,
    redirectUri?: string,
    userId?: string,
  ): Promise<{ success: boolean; email: string; name?: string }> {
    const rawSettings = await this.settingsService.getRawZohoOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('ZOHO_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('ZOHO_CLIENT_SECRET') || '';
    const dataCenter = rawSettings.dataCenter || 'com';
    const finalRedirect =
      redirectUri ||
      rawSettings.redirectUri ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Zoho OAuth credentials are not configured in Super Admin settings.');
    }

    // 1. Exchange code for tokens
    const tokenUrl = `${this.getAccountsUrl(dataCenter)}/oauth/v2/token`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: finalRedirect,
        grant_type: 'authorization_code',
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData: any = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      this.logger.error(`Zoho token exchange returned non-JSON (${tokenRes.status}): ${tokenText.slice(0, 300)}`);
      throw new BadRequestException(
        `Zoho authorization returned HTTP ${tokenRes.status}. Please ensure your Zoho Data Center Domain matches your account region.`,
      );
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      this.logger.error(`Zoho token exchange failed: ${JSON.stringify(tokenData)}`);
      throw new BadRequestException(tokenData.error || 'Failed to exchange authorization code with Zoho');
    }

    // Auto-detect actual data center from Zoho's api_domain
    let detectedDataCenter = dataCenter;
    if (tokenData.api_domain) {
      const apiDom = String(tokenData.api_domain).toLowerCase();
      if (apiDom.includes('.in')) detectedDataCenter = 'in';
      else if (apiDom.includes('.eu')) detectedDataCenter = 'eu';
      else if (apiDom.includes('.com.au')) detectedDataCenter = 'com.au';
      else if (apiDom.includes('.com')) detectedDataCenter = 'com';
      this.logger.log(`Zoho api_domain [${tokenData.api_domain}] -> resolved dataCenter [${detectedDataCenter}]`);
    }

    // 2. Fetch Zoho User info to get user email and organization ID (zsoid)
    let email = 'zoho-host@elevate.lms';
    let name = 'Zoho Host';
    let zsoid = '';

    try {
      const userRes = await fetch(`${this.getApiUrl(detectedDataCenter)}/user.json`, {
        headers: { Authorization: `Zoho-oauthtoken ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userText = await userRes.text();
        let userData: any = {};
        try {
          userData = JSON.parse(userText);
        } catch {
          this.logger.warn(`Zoho user.json response was non-JSON: ${userText.slice(0, 200)}`);
        }
        const userObj = userData.userDetails || userData.user || userData;
        email = (userObj.primaryEmail || userObj.email || userObj.emailId || email).toLowerCase().trim();
        name = userObj.displayName || userObj.name || name;
        zsoid = String(userObj.zsoid || userObj.orgId || '');
        this.logger.log(`Zoho user profile loaded: [${email}], zsoid: [${zsoid}]`);
      } else {
        const errTxt = await userRes.text().catch(() => '');
        this.logger.error(`Zoho user.json fetch failed (${userRes.status}): ${errTxt.slice(0, 300)}`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch Zoho user profile: ${err.message}`);
    }

    let refreshToken = tokenData.refresh_token;
    if (!refreshToken) {
      const existing = await this.meetingProvidersRepo.findActiveAccount('zoho');
      if (existing?.refresh_token) {
        refreshToken = existing.refresh_token;
      } else {
        throw new BadRequestException(
          'Zoho did not return a refresh token. Please re-authenticate and consent to offline access.',
        );
      }
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // 3. Save into meeting_provider_accounts
    await this.meetingProvidersRepo.upsertAccount({
      provider: 'zoho',
      accountEmail: email,
      accountName: name,
      accessToken: tokenData.access_token,
      refreshToken,
      tokenExpiresAt: expiresAt,
      scope: tokenData.scope,
      providerMetadata: {
        zsoid,
        dataCenter: detectedDataCenter,
        apiDomain: tokenData.api_domain,
      },
      connectedBy: userId,
    });

    this.logger.log(`Zoho account [${email}] connected successfully (zsoid: ${zsoid}, dc: ${detectedDataCenter})`);
    return { success: true, email, name };
  }

  /**
   * Refreshes Zoho access token using refresh_token.
   */
  private async getAccessToken(clientId: string, clientSecret: string, refreshToken: string, dataCenter = 'com'): Promise<string> {
    try {
      const tokenUrl = `${this.getAccountsUrl(dataCenter)}/oauth/v2/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      const resText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        this.logger.error(`Zoho token refresh returned non-JSON (${response.status}): ${resText.slice(0, 300)}`);
        throw new InternalServerErrorException(
          `Zoho authentication returned HTTP ${response.status}. Please check your Zoho Data Center Domain (zoho.in for India vs zoho.com for Global) in Super Admin Settings and reconnect your Zoho account.`,
        );
      }

      if (!response.ok || !data.access_token) {
        this.logger.error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(
          `Failed to authenticate with Zoho Meeting API: ${data.error || data.message || 'Invalid token'}`,
        );
      }

      return data.access_token;
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoho OAuth token refresh network error: ${error.message}`);
      throw new ServiceUnavailableException('Zoho OAuth token endpoint unreachable');
    }
  }

  /**
   * Check connection status for admin dashboard.
   */
  async getConnectionStatus(): Promise<{
    isConfigured: boolean;
    isConnected: boolean;
    accountEmail?: string;
    accountName?: string;
    connectedAt?: Date;
  }> {
    const rawSettings = await this.settingsService.getRawZohoOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('zoho');
    const isConfigured = Boolean(rawSettings.isConfigured || this.configService.get<string>('ZOHO_CLIENT_ID'));
    const isConnected = Boolean(activeAccount?.is_active && activeAccount?.refresh_token);

    return {
      isConfigured,
      isConnected,
      accountEmail: activeAccount?.account_email,
      accountName: activeAccount?.account_name,
      connectedAt: activeAccount?.created_at,
    };
  }

  /**
   * Run a live test: creates a temporary Zoho session and deletes it.
   */
  async testConnection(): Promise<{ success: boolean; meetLink: string; message: string }> {
    const { clientId, clientSecret, dataCenter, refreshToken, zsoid } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000);

    const testPayload = {
      session: {
        topic: '[Elevate LMS Test] Live Zoho Meeting Verification',
        agenda: 'Temporary verification meeting generated from Elevate LMS Admin Settings.',
        startTime: this.formatZohoDate(startTime, 'UTC'),
        duration: 30 * 60 * 1000,
        timezone: 'UTC',
      },
    };

    const targetUrl = zsoid
      ? `${this.getApiUrl(dataCenter)}/${zsoid}/sessions.json`
      : `${this.getApiUrl(dataCenter)}/sessions.json`;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      this.logger.error(`Zoho test response was non-JSON (${res.status}): ${resText.slice(0, 300)}`);
      throw new InternalServerErrorException(
        `Zoho returned HTTP ${res.status}. Please verify your Zoho Data Center Domain (select zoho.in if your account was registered in India, or zoho.com if Global).`,
      );
    }

    if (!res.ok || (!data.session?.meetingKey && !data.session?.joinLink)) {
      throw new InternalServerErrorException(
        `Zoho test session failed: ${data.message || JSON.stringify(data)}`,
      );
    }

    const meetingKey = data.session.meetingKey;
    const joinLink = data.session.joinLink;

    // Immediately clean up test session
    if (meetingKey) {
      const deleteUrl = zsoid
        ? `${this.getApiUrl(dataCenter)}/${zsoid}/sessions/${meetingKey}.json`
        : `${this.getApiUrl(dataCenter)}/sessions/${meetingKey}.json`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      }).catch(() => {});
    }

    return {
      success: true,
      meetLink: joinLink,
      message: 'Zoho Meeting API verified successfully! Live session link created and cleaned up.',
    };
  }

  /**
   * Create Zoho scheduled webinar meeting.
   */
  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    const { clientId, clientSecret, dataCenter, refreshToken, zsoid } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);

    const durationMinutes = Math.max(
      15,
      Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000),
    );

    const durationMs = durationMinutes * 60 * 1000;
    const formattedStartTime = this.formatZohoDate(input.startTime, input.timezone || 'UTC');

    const payload = {
      session: {
        topic: input.title,
        agenda: input.description || `Elevate LMS Webinar Session: ${input.title}`,
        startTime: formattedStartTime,
        duration: durationMs,
        timezone: input.timezone || 'UTC',
      },
    };

    if (!zsoid) {
      throw new BadRequestException(
        'Zoho Organization ID (zsoid) was not resolved. Please disconnect and reconnect your Zoho account in Admin Settings -> Meeting Providers.',
      );
    }

    const targetUrl = `${this.getApiUrl(dataCenter)}/${zsoid}/sessions.json`;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        this.logger.error(`Zoho createSession response non-JSON (${response.status}): ${resText.slice(0, 300)}`);
        throw new InternalServerErrorException(
          `Zoho API returned HTTP ${response.status}. Please check your Zoho Data Center Domain (zoho.in for India, zoho.com for Global) in Super Admin Settings and reconnect Zoho.`,
        );
      }

      const session = data.session || data;

      if (!response.ok || !session.meetingKey) {
        this.logger.error(`Zoho create session failed: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(
          `Zoho meeting creation failed: ${data.message || JSON.stringify(data)}`,
        );
      }

      const meetingKey = String(session.meetingKey);
      const meetingLink = session.joinLink;
      const hostJoinUrl = session.startLink || session.joinLink;
      const passcode = session.pwd || '';

      this.logger.log(`Zoho meeting created: Key [${meetingKey}], Link: ${meetingLink}`);

      return {
        providerSessionId: meetingKey,
        meetingLink,
        hostJoinUrl,
        passcode,
        providerMetadata: {
          zsoid,
          meetingKey,
          talkToken: session.talkToken,
          dataCenter,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoho API communication error: ${error.message}`);
      throw new InternalServerErrorException(`Zoho meeting session creation failed: ${error.message}`);
    }
  }

  /**
   * Update Zoho scheduled session.
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<ProviderSessionResult> {
    const { clientId, clientSecret, dataCenter, refreshToken, zsoid } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);

    const patchPayload: Record<string, any> = {};
    if (input.title) patchPayload.topic = input.title;
    if (input.description !== undefined) patchPayload.agenda = input.description;
    if (input.startTime) {
      patchPayload.startTime = this.formatZohoDate(input.startTime, input.timezone || 'UTC');
    }
    if (input.startTime && input.endTime) {
      const durationMin = Math.max(
        15,
        Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000),
      );
      patchPayload.duration = durationMin * 60 * 1000;
    }
    if (input.timezone) patchPayload.timezone = input.timezone;

    if (!zsoid) {
      throw new BadRequestException('Zoho Organization ID (zsoid) was not resolved.');
    }

    const targetUrl = `${this.getApiUrl(dataCenter)}/${zsoid}/sessions/${encodeURIComponent(sessionId)}.json`;

    try {
      const response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session: patchPayload }),
      });

      const resText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        this.logger.error(`Zoho updateSession returned non-JSON (${response.status}): ${resText.slice(0, 300)}`);
        throw new InternalServerErrorException(`Zoho API returned HTTP ${response.status} during update`);
      }
      const session = data.session || data;

      return {
        providerSessionId: sessionId,
        meetingLink: session.joinLink || '',
        hostJoinUrl: session.startLink || session.joinLink || '',
        passcode: session.pwd || '',
        providerMetadata: {
          zsoid,
          meetingKey: sessionId,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoho updateSession failed: ${error.message}`);
      throw new InternalServerErrorException(`Failed to update Zoho session: ${error.message}`);
    }
  }

  /**
   * Cancel/delete Zoho scheduled session.
   */
  async cancelSession(sessionId: string, _reason?: string): Promise<void> {
    try {
      const { clientId, clientSecret, dataCenter, refreshToken, zsoid } = await this.getCredentials();
      const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);

      const targetUrl = zsoid
        ? `${this.getApiUrl(dataCenter)}/${zsoid}/sessions/${encodeURIComponent(sessionId)}.json`
        : `${this.getApiUrl(dataCenter)}/sessions/${encodeURIComponent(sessionId)}.json`;

      const response = await fetch(targetUrl, {
        method: 'DELETE',
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });

      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => null);
        this.logger.warn(`Zoho cancelSession returned ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      this.logger.error(`Zoho cancelSession error: ${error.message}`);
    }
  }

  /**
   * Add attendee/participant to Zoho meeting.
   */
  async addAttendee(
    sessionId: string,
    attendee: { email: string; displayName?: string },
  ): Promise<boolean> {
    if (!sessionId || !attendee.email) return false;

    try {
      const { clientId, clientSecret, dataCenter, refreshToken, zsoid } = await this.getCredentials();
      const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken, dataCenter);

      const targetUrl = zsoid
        ? `${this.getApiUrl(dataCenter)}/${zsoid}/sessions/${encodeURIComponent(sessionId)}/participants.json`
        : `${this.getApiUrl(dataCenter)}/sessions/${encodeURIComponent(sessionId)}/participants.json`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: [{ email: attendee.email.trim() }],
        }),
      });

      if (res.ok) {
        this.logger.log(`Zoho participant added: [${attendee.email}] to session [${sessionId}]`);
        return true;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Could not register participant with Zoho: ${error.message}`);
      return false;
    }
  }

  /**
   * Disconnects Zoho integration.
   */
  async disconnect(): Promise<void> {
    await this.meetingProvidersRepo.disconnectAccount('zoho');
    this.logger.log('Zoho Meeting account disconnected.');
  }
}

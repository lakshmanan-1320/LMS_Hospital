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
  AttendeeResult,
} from '../interfaces/webinar-provider.interface';
import { SettingsService } from '../../settings/settings.service';
import { MeetingProvidersRepository } from '../meeting-providers.repository';

const ZOOM_API = 'https://api.zoom.us/v2';

/**
 * Registration lock-down applied to every LMS webinar meeting:
 * - approval_type 1 (manual): strangers who open the shared link and fill in Zoom's own
 *   registration form stay "pending". Only registrants the LMS approves via API can join.
 * - Each approved registrant gets a personal join link, usable on one device at a time.
 * - Zoom's own emails are off: the LMS sends the single confirmation email with the personal link.
 */
const REGISTRATION_ONLY_SETTINGS = {
  approval_type: 1,
  registrants_confirmation_email: false,
  registrants_email_notification: false,
  registrants_restrict_number_of_devices: true,
  waiting_room: true,
};

interface ZoomRegistrant {
  id: string;
  email: string;
  status?: string;
  join_url?: string;
}

interface CachedZoomToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class ZoomProvider implements WebinarProvider {
  readonly providerName = 'zoom';
  private readonly logger = new Logger(ZoomProvider.name);
  private cachedToken: CachedZoomToken | null = null;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(MeetingProvidersRepository) private readonly meetingProvidersRepo: MeetingProvidersRepository,
  ) {}

  /**
   * Resolves Zoom credentials dynamically:
   * 1. Server-to-Server OAuth credentials from Super Admin settings / .env
   * 2. Active User OAuth account from meeting_provider_accounts
   */
  private async getCredentials(): Promise<{
    accountId: string;
    clientId: string;
    clientSecret: string;
    authType: string;
    userRefreshToken?: string;
  }> {
    const rawSettings = await this.settingsService.getRawZoomOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('zoom');

    const accountId = rawSettings.accountId || this.configService.get<string>('ZOOM_ACCOUNT_ID') || '';
    const clientId = rawSettings.clientId || this.configService.get<string>('ZOOM_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('ZOOM_CLIENT_SECRET') || '';
    const authType = rawSettings.authType || 'server_to_server';

    if (!clientId || !clientSecret || (authType === 'server_to_server' && !accountId)) {
      throw new ServiceUnavailableException(
        'Zoom integration is not configured. Super Admin must set Zoom Account ID, Client ID, and Client Secret in Platform Settings.',
      );
    }

    return {
      accountId,
      clientId,
      clientSecret,
      authType,
      userRefreshToken: activeAccount?.refresh_token,
    };
  }

  /**
   * Obtain valid Zoom OAuth access token with automatic caching and refresh.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60000) {
      return this.cachedToken.accessToken;
    }

    const { accountId, clientId, clientSecret, authType, userRefreshToken } = await this.getCredentials();

    try {
      if (authType === 'server_to_server' || !userRefreshToken) {
        // Zoom Server-to-Server OAuth flow
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`;

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const data = await response.json();
        if (!response.ok || !data.access_token) {
          this.logger.error(`Zoom Server-to-Server OAuth token failed: ${JSON.stringify(data)}`);
          throw new InternalServerErrorException(
            `Zoom authentication failed: ${data.reason || data.message || 'Invalid credentials'}`,
          );
        }

        const expiresInMs = (data.expires_in || 3600) * 1000;
        this.cachedToken = {
          accessToken: data.access_token,
          expiresAt: now + expiresInMs,
        };

        return data.access_token;
      } else {
        // User-level OAuth token refresh
        const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tokenUrl = `https://zoom.us/oauth/token`;

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: userRefreshToken,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.access_token) {
          this.logger.error(`Zoom user refresh token failed: ${JSON.stringify(data)}`);
          throw new InternalServerErrorException('Failed to refresh Zoom user authorization token');
        }

        const expiresInMs = (data.expires_in || 3600) * 1000;
        this.cachedToken = {
          accessToken: data.access_token,
          expiresAt: now + expiresInMs,
        };

        return data.access_token;
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoom token acquisition network error: ${error.message}`);
      throw new ServiceUnavailableException('Zoom authentication service unreachable');
    }
  }

  /**
   * Generates Zoom OAuth authorization URL for Admin to connect their account.
   */
  async generateAuthUrl(redirectUri?: string, state?: string): Promise<string> {
    const rawSettings = await this.settingsService.getRawZoomOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('ZOOM_CLIENT_ID');
    const finalRedirect =
      redirectUri ||
      this.configService.get<string>('ZOOM_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId) {
      throw new BadRequestException('Zoom Client ID is not configured. Please contact Super Admin.');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: finalRedirect,
      state: state || 'zoom_connect',
    });

    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchanges Zoom authorization code for tokens, retrieves user profile, and saves connection.
   */
  async handleOAuthCallback(
    code: string,
    redirectUri?: string,
    userId?: string,
  ): Promise<{ success: boolean; email: string; name?: string }> {
    const rawSettings = await this.settingsService.getRawZoomOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('ZOOM_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('ZOOM_CLIENT_SECRET') || '';
    const finalRedirect =
      redirectUri ||
      this.configService.get<string>('ZOOM_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Zoom Client ID and Secret are not configured in Super Admin settings.');
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenUrl = `https://zoom.us/oauth/token?grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(finalRedirect)}`;

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        this.logger.error(`Zoom OAuth token exchange failed: ${JSON.stringify(tokenData)}`);
        throw new BadRequestException(
          `Zoom authorization failed: ${tokenData.reason || tokenData.message || 'Invalid authorization code'}`,
        );
      }

      // Fetch user profile from Zoom to identify account email
      const userRes = await fetch('https://api.zoom.us/v2/users/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const userData = await userRes.json();
      const accountEmail = userData.email || 'zoom-user@elevatelms.com';
      const accountName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || accountEmail;

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

      await this.meetingProvidersRepo.upsertAccount({
        provider: 'zoom',
        accountEmail,
        accountName,
        refreshToken: tokenData.refresh_token,
        accessToken: tokenData.access_token,
        tokenExpiresAt: expiresAt,
        providerMetadata: {
          zoomUserId: userData.id,
          accountId: userData.account_id,
          scope: tokenData.scope,
        },
        connectedBy: userId,
      });

      this.cachedToken = null;
      this.logger.log(`Zoom account [${accountEmail}] connected successfully via OAuth.`);
      return { success: true, email: accountEmail, name: accountName };
    } catch (err: any) {
      this.logger.error(`Zoom OAuth callback error: ${err.message}`);
      throw err instanceof BadRequestException ? err : new BadRequestException(`Zoom connection failed: ${err.message}`);
    }
  }

  /**
   * Check live connection status for dashboard.
   */
  async getConnectionStatus(): Promise<{
    isConfigured: boolean;
    isConnected: boolean;
    accountEmail?: string;
    accountName?: string;
    authType?: string;
    connectedAt?: Date;
  }> {
    const rawSettings = await this.settingsService.getRawZoomOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('zoom');
    const isConfigured = Boolean(
      (rawSettings.clientId && (rawSettings.clientSecret || rawSettings.accountId)) ||
      this.configService.get<string>('ZOOM_CLIENT_ID')
    );

    if (activeAccount && activeAccount.account_email) {
      return {
        isConfigured,
        isConnected: true,
        accountEmail: activeAccount.account_email,
        accountName: activeAccount.account_name,
        authType: 'oauth',
        connectedAt: activeAccount.created_at,
      };
    }

    let isConnected = false;
    let fallbackEmail: string | undefined;

    if (isConfigured) {
      try {
        const token = await this.getAccessToken();
        isConnected = Boolean(token);
        if (isConnected) {
          fallbackEmail = rawSettings.accountId ? `App Account (${rawSettings.accountId})` : 'Connected Server-to-Server';
        }
      } catch {
        isConnected = false;
      }
    }

    return {
      isConfigured,
      isConnected,
      accountEmail: fallbackEmail,
      accountName: isConnected ? 'Zoom App' : undefined,
      authType: rawSettings.authType || 'server_to_server',
      connectedAt: undefined,
    };
  }

  /**
   * Run a live verification test: creates a temporary meeting and immediately deletes it.
   */
  async testConnection(): Promise<{ success: boolean; meetLink: string; message: string }> {
    const accessToken = await this.getAccessToken();

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000);

    const testPayload = {
      topic: '[Elevate LMS Test] Live Zoom Verification Meeting',
      type: 2,
      start_time: startTime.toISOString(),
      duration: 30,
      timezone: 'UTC',
      agenda: 'Temporary test meeting generated from Elevate LMS Admin Settings.',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: true,
      },
    };

    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const data = await res.json();
    if (!res.ok) {
      this.cachedToken = null;
      throw new InternalServerErrorException(
        `Zoom test meeting creation failed: ${data.message || JSON.stringify(data)}`,
      );
    }

    const meetingId = data.id;
    const joinUrl = data.join_url;

    // Immediately clean up test meeting
    if (meetingId) {
      await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
    }

    return {
      success: true,
      meetLink: joinUrl,
      message: 'Zoom API verified successfully! Live meeting link generated and cleaned up.',
    };
  }

  /**
   * Create Zoom scheduled webinar meeting.
   */
  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    const accessToken = await this.getAccessToken();
    const durationMinutes = Math.max(
      15,
      Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000),
    );

    const payload = {
      topic: input.title,
      type: 2, // Scheduled meeting
      start_time: input.startTime.toISOString(),
      duration: durationMinutes,
      timezone: input.timezone || 'UTC',
      agenda: input.description || `Elevate LMS Webinar Session: ${input.title}`,
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        audio: 'both',
        auto_recording: 'none',
        meeting_authentication: false,
        ...REGISTRATION_ONLY_SETTINGS,
      },
    };

    try {
      const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        this.cachedToken = null;
        this.logger.error(`Zoom create meeting failed: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(
          `Zoom meeting creation failed: ${data.message || JSON.stringify(data)}`,
        );
      }

      const meetingId = String(data.id);
      const meetingLink = data.join_url;
      const hostJoinUrl = data.start_url || data.join_url;
      const passcode = data.password || '';

      this.logger.log(`Zoom meeting created: ID [${meetingId}], URL: ${meetingLink}`);

      return {
        providerSessionId: meetingId,
        meetingLink,
        hostJoinUrl,
        passcode,
        providerMetadata: {
          zoomMeetingId: data.id,
          uuid: data.uuid,
          hostId: data.host_id,
          registrationEnforced: true,
          createdAt: data.created_at,
          timezone: data.timezone,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoom API communication error: ${error.message}`);
      throw new InternalServerErrorException(`Zoom meeting session creation failed: ${error.message}`);
    }
  }

  /**
   * Update Zoom scheduled meeting.
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<ProviderSessionResult> {
    const accessToken = await this.getAccessToken();

    const patchPayload: Record<string, any> = {};
    if (input.title) patchPayload.topic = input.title;
    if (input.description !== undefined) patchPayload.agenda = input.description;
    if (input.startTime) patchPayload.start_time = input.startTime.toISOString();
    if (input.startTime && input.endTime) {
      patchPayload.duration = Math.max(
        15,
        Math.round((input.endTime.getTime() - input.startTime.getTime()) / 60000),
      );
    }
    if (input.timezone) patchPayload.timezone = input.timezone;

    try {
      const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchPayload),
      });

      if (!response.ok && response.status !== 204) {
        this.cachedToken = null;
        const data = await response.json().catch(() => ({}));
        this.logger.error(`Zoom update meeting failed: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(`Zoom update failed: ${data.message || 'Unknown error'}`);
      }

      // Fetch updated meeting details
      const getRes = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const updatedData = await getRes.json();

      return {
        providerSessionId: sessionId,
        meetingLink: updatedData.join_url || '',
        hostJoinUrl: updatedData.start_url || updatedData.join_url || '',
        passcode: updatedData.password || '',
        providerMetadata: {
          zoomMeetingId: updatedData.id,
          uuid: updatedData.uuid,
          hostId: updatedData.host_id,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Zoom updateSession failed: ${error.message}`);
      throw new InternalServerErrorException(`Failed to update Zoom session: ${error.message}`);
    }
  }

  /**
   * Cancel/delete Zoom scheduled meeting.
   */
  async cancelSession(sessionId: string, _reason?: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => null);
        this.logger.warn(`Zoom cancelSession returned ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      this.logger.error(`Zoom cancelSession error: ${error.message}`);
    }
  }

  /**
   * Register an attendee on the Zoom meeting, approve them, and return their personal join link.
   * Safe to call again for the same email: an existing registrant's link is returned.
   */
  async addAttendee(
    sessionId: string,
    attendee: { email: string; displayName?: string },
  ): Promise<AttendeeResult> {
    if (!sessionId || !attendee.email) {
      return { ok: false, error: 'Missing Zoom meeting ID or attendee email' };
    }

    const email = attendee.email.trim().toLowerCase();
    const nameParts = (attendee.displayName || email.split('@')[0]).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Participant';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      const accessToken = await this.getAccessToken();
      const res = await fetch(`${ZOOM_API}/meetings/${encodeURIComponent(sessionId)}/registrants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        // The meeting uses manual approval; registrants added by the LMS are approved immediately.
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName, auto_approve: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.join_url) {
        this.logger.log(`Zoom registrant approved: [${email}] on meeting [${sessionId}]`);
        return {
          ok: true,
          registrantId: String(data.registrant_id || ''),
          joinUrl: data.join_url,
        };
      }

      if (res.status === 401) this.cachedToken = null;

      // Already registered, or Zoom returned no link: look up the existing registrant.
      const existing = await this.findRegistrant(accessToken, sessionId, email);
      if (existing?.join_url) {
        if (existing.status === 'pending') {
          const approved = await this.updateRegistrantStatus(accessToken, sessionId, 'approve', existing.id, email);
          if (!approved) return { ok: false, error: 'Zoom registrant is pending and could not be approved' };
        }
        return { ok: true, registrantId: existing.id, joinUrl: existing.join_url };
      }

      const reason = data.message || 'no personal join link returned';
      this.logger.warn(`Zoom registrant failed for [${email}] on meeting [${sessionId}] (${res.status}): ${reason}`);
      return { ok: false, error: `Zoom (${res.status}): ${reason}` };
    } catch (error) {
      this.logger.warn(`Could not register attendee with Zoom: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  /**
   * Cancel a registrant so their personal join link stops working.
   */
  async removeAttendee(sessionId: string, attendee: { registrantId: string; email: string }): Promise<boolean> {
    if (!sessionId || !attendee.registrantId) return false;
    try {
      const accessToken = await this.getAccessToken();
      return await this.updateRegistrantStatus(accessToken, sessionId, 'cancel', attendee.registrantId, attendee.email);
    } catch (error) {
      this.logger.warn(`Could not cancel Zoom registrant [${attendee.email}]: ${error.message}`);
      return false;
    }
  }

  /**
   * Apply registration-only settings to an existing meeting (meetings created before
   * enforcement auto-approved anyone who registered through Zoom's own form).
   */
  async enforceRegistrationSettings(sessionId: string): Promise<void> {
    const accessToken = await this.getAccessToken();
    const res = await fetch(`${ZOOM_API}/meetings/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings: REGISTRATION_ONLY_SETTINGS }),
    });

    if (!res.ok && res.status !== 204) {
      if (res.status === 401) this.cachedToken = null;
      const data = await res.json().catch(() => ({}));
      throw new InternalServerErrorException(
        `Could not restrict Zoom meeting ${sessionId} to registrants: ${data.message || res.status}`,
      );
    }
    this.logger.log(`Zoom meeting [${sessionId}] restricted to approved registrants.`);
  }

  private async findRegistrant(
    accessToken: string,
    sessionId: string,
    email: string,
  ): Promise<ZoomRegistrant | null> {
    for (const status of ['approved', 'pending']) {
      let nextPageToken = '';
      do {
        const params = new URLSearchParams({ status, page_size: '300' });
        if (nextPageToken) params.set('next_page_token', nextPageToken);
        const res = await fetch(
          `${ZOOM_API}/meetings/${encodeURIComponent(sessionId)}/registrants?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        const match = (data.registrants || []).find(
          (r: any) => String(r.email || '').toLowerCase().trim() === email,
        );
        if (match) {
          return { id: String(match.id), email, status, join_url: match.join_url };
        }
        nextPageToken = data.next_page_token || '';
      } while (nextPageToken);
    }
    return null;
  }

  private async updateRegistrantStatus(
    accessToken: string,
    sessionId: string,
    action: 'approve' | 'cancel' | 'deny',
    registrantId: string,
    email: string,
  ): Promise<boolean> {
    const res = await fetch(`${ZOOM_API}/meetings/${encodeURIComponent(sessionId)}/registrants/status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, registrants: [{ id: registrantId, email }] }),
    });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      this.logger.warn(`Zoom registrant ${action} failed for [${email}] (${res.status}): ${data.message || ''}`);
      return false;
    }
    return true;
  }

  /**
   * Disconnects Zoom integration.
   */
  async disconnect(): Promise<void> {
    this.cachedToken = null;
    await this.meetingProvidersRepo.disconnectAccount('zoom');
    this.logger.log('Zoom account disconnected.');
  }
}

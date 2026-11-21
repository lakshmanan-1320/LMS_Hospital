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

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

@Injectable()
export class GoogleMeetProvider implements WebinarProvider {
  readonly providerName = 'google_meet';
  private readonly logger = new Logger(GoogleMeetProvider.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(MeetingProvidersRepository) private readonly meetingProvidersRepo: MeetingProvidersRepository,
  ) {}

  /**
   * Resolves credentials dynamically:
   * 1. OAuth App Client ID & Secret from Super Admin system_settings (fallback to .env).
   * 2. Active Google Account Refresh Token from meeting_provider_accounts (fallback to .env).
   */
  private async getCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarId: string;
    accountEmail?: string;
  }> {
    const rawSettings = await this.settingsService.getRawGoogleOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('google_meet');

    const clientId = rawSettings.clientId || this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const refreshToken = activeAccount?.refresh_token || this.configService.get<string>('GOOGLE_REFRESH_TOKEN') || '';
    const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID') || 'primary';

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Google OAuth App is not configured. Super Admin must set Google Client ID & Secret in Platform Settings.',
      );
    }

    if (!refreshToken) {
      throw new ServiceUnavailableException(
        'No Google account is currently connected. Please connect a Google account in Admin Settings (Meeting & Video Integrations) to create Google Meet webinars.',
      );
    }

    return {
      clientId,
      clientSecret,
      refreshToken,
      calendarId,
      accountEmail: activeAccount?.account_email,
    };
  }

  /**
   * Generates Google OAuth 2.0 authorization URL for Admin to connect.
   */
  async generateAuthUrl(redirectUri?: string, state?: string): Promise<string> {
    const rawSettings = await this.settingsService.getRawGoogleOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('GOOGLE_CLIENT_ID');
    const finalRedirect =
      redirectUri ||
      rawSettings.redirectUri ||
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId) {
      throw new BadRequestException('Google Client ID is not configured. Please contact Super Admin.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: finalRedirect,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for tokens, retrieves user profile, and stores in DB.
   */
  async handleOAuthCallback(
    code: string,
    redirectUri?: string,
    userId?: string,
  ): Promise<{ success: boolean; email: string; name?: string }> {
    const rawSettings = await this.settingsService.getRawGoogleOAuthSettings();
    const clientId = rawSettings.clientId || this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret = rawSettings.clientSecret || this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const finalRedirect =
      redirectUri ||
      rawSettings.redirectUri ||
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/dashboard/admin/settings';

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth App credentials are not configured in Super Admin settings.');
    }

    // 1. Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      this.logger.error(`Google token exchange failed: ${JSON.stringify(tokenData)}`);
      throw new BadRequestException(tokenData.error_description || 'Failed to exchange authorization code with Google');
    }

    const grantedScope = tokenData.scope || '';
    if (!grantedScope.includes('calendar')) {
      throw new BadRequestException(
        'Calendar permission was not granted. Please ensure the Google Calendar access checkbox is checked during authorization.',
      );
    }

    // 2. Fetch User Profile to get email and name
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = await profileRes.json();
    if (!profileRes.ok || !profileData.email) {
      throw new InternalServerErrorException('Failed to retrieve user profile from Google');
    }

    const email = profileData.email.toLowerCase().trim();
    const name = profileData.name || '';

    // If refresh token wasn't returned on this exchange (re-authorization), check existing
    let refreshToken = tokenData.refresh_token;
    if (!refreshToken) {
      const existing = await this.meetingProvidersRepo.findActiveAccount('google_meet');
      if (existing?.refresh_token) {
        refreshToken = existing.refresh_token;
      } else {
        throw new BadRequestException(
          'Google did not return a refresh token. Please disconnect app permissions in your Google Account security settings and reconnect.',
        );
      }
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : undefined;

    // 3. Save into meeting_provider_accounts
    await this.meetingProvidersRepo.upsertAccount({
      provider: 'google_meet',
      accountEmail: email,
      accountName: name,
      accessToken: tokenData.access_token,
      refreshToken,
      tokenExpiresAt: expiresAt,
      scope: tokenData.scope,
      providerMetadata: {
        picture: profileData.picture,
        verified_email: profileData.verified_email,
      },
      connectedBy: userId,
    });

    this.logger.log(`Google account [${email}] connected successfully by user [${userId}]`);
    return { success: true, email, name };
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
    const rawSettings = await this.settingsService.getRawGoogleOAuthSettings();
    const activeAccount = await this.meetingProvidersRepo.findActiveAccount('google_meet');
    const hasEnvRefresh = Boolean(this.configService.get<string>('GOOGLE_REFRESH_TOKEN'));

    const isConfigured = rawSettings.isConfigured || Boolean(this.configService.get<string>('GOOGLE_CLIENT_ID'));
    const isConnected = Boolean(activeAccount?.is_active || hasEnvRefresh);

    return {
      isConfigured,
      isConnected,
      accountEmail: activeAccount?.account_email || (hasEnvRefresh ? 'configured via environment' : undefined),
      accountName: activeAccount?.account_name,
      connectedAt: activeAccount?.created_at,
    };
  }

  /**
   * Disconnects the active Google account.
   */
  async disconnect(): Promise<void> {
    await this.meetingProvidersRepo.disconnectAccount('google_meet');
    this.logger.log('Google Meet account disconnected.');
  }

  /**
   * Refreshes OAuth access token using refresh token.
   */
  private async getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.access_token) {
        this.logger.error(`Failed to refresh Google OAuth token: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException('Failed to authenticate with Google API');
      }

      return data.access_token;
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      this.logger.error(`Network error connecting to Google OAuth endpoint: ${error.message}`);
      throw new ServiceUnavailableException('Google OAuth token endpoint unreachable');
    }
  }

  /**
   * Run a live test: creates a temporary event with Google Meet and deletes it.
   */
  async testConnection(): Promise<{ success: boolean; meetLink: string; message: string }> {
    const { clientId, clientSecret, refreshToken, calendarId } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);

    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000);
    const endTime = new Date(now.getTime() + 90 * 60 * 1000);

    const testPayload = {
      summary: '[Elevate LMS Test] Live Google Meet Verification',
      description: 'Temporary verification event created from Elevate Admin Settings. Safely cleaned up.',
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: `test-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=none`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const eventData = await res.json();
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Google Meet test failed: ${eventData.error?.message || JSON.stringify(eventData)}`,
      );
    }

    const meetEntry = eventData.conferenceData?.entryPoints?.find(
      (ep: any) => ep.entryPointType === 'video',
    );
    const meetLink = meetEntry?.uri || eventData.hangoutLink;

    // Immediately clean up the test event
    if (eventData.id) {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventData.id)}?sendUpdates=none`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ).catch(() => {});
    }

    return {
      success: true,
      meetLink: meetLink || 'https://meet.google.com',
      message: 'Google Calendar API verified successfully. Live Google Meet conference created!',
    };
  }

  /**
   * Creates Google Calendar event with Google Meet and automatically sends
   * Google Calendar invitation email to the Host.
   */
  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    const { clientId, clientSecret, refreshToken, calendarId } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);

    const attendees: Array<{ email: string; displayName?: string; responseStatus?: string }> = [];
    if (input.hostEmail && input.hostEmail.includes('@')) {
      attendees.push({
        email: input.hostEmail.trim(),
        displayName: input.hostName || 'Primary Host',
      });
    }

    const eventPayload: Record<string, any> = {
      summary: input.title,
      description:
        (input.description ? `${input.description}\n\n` : '') +
        `Webinar session hosted on Elevate LMS.\n` +
        `Join via the Google Meet link attached to this calendar invitation.`,
      start: {
        dateTime: input.startTime.toISOString(),
        timeZone: input.timezone || 'UTC',
      },
      end: {
        dateTime: input.endTime.toISOString(),
        timeZone: input.timezone || 'UTC',
      },
      attendees,
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      conferenceData: {
        createRequest: {
          requestId: input.webinarId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      // sendUpdates=all instructs Google Calendar to send the official invitation email with Google Meet button to attendees (the host)
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });

      const eventData = await response.json();
      if (!response.ok) {
        this.logger.error(`Google Calendar create event failed: ${JSON.stringify(eventData)}`);
        throw new InternalServerErrorException(
          `Google Calendar event creation failed: ${eventData.error?.message || 'Unknown error'}`,
        );
      }

      const meetEntry = eventData.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video',
      );

      const meetingLink = meetEntry?.uri || eventData.hangoutLink;
      if (!meetingLink) {
        throw new InternalServerErrorException(
          'Google Calendar created event but failed to generate Google Meet conference link.',
        );
      }

      this.logger.log(`Google Meet created: ${eventData.id}, Link: ${meetingLink}, Host invited: ${input.hostEmail}`);

      return {
        providerSessionId: eventData.id,
        meetingLink,
        hostJoinUrl: meetingLink,
        providerMetadata: {
          calendarId,
          eventId: eventData.id,
          htmlLink: eventData.htmlLink,
          conferenceId: eventData.conferenceData?.conferenceId,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Google Meet API communication failed: ${error.message}`);
      throw new InternalServerErrorException(`Google Meet session creation failed: ${error.message}`);
    }
  }

  /**
   * Adds an attendee (registrant) to the Google Calendar event and triggers
   * Google's automatic calendar invitation email with Meet link.
   */
  async addAttendee(
    sessionId: string,
    attendee: { email: string; displayName?: string },
  ): Promise<boolean> {
    if (!sessionId || !attendee.email) return false;

    try {
      const { clientId, clientSecret, refreshToken, calendarId } = await this.getCredentials();
      const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);

      // 1. Fetch current event attendees
      const getUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sessionId)}`;
      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!getRes.ok) {
        this.logger.warn(`Could not fetch Google Calendar event [${sessionId}] to add attendee.`);
        return false;
      }

      const eventData = await getRes.json();
      const currentAttendees: Array<{ email: string; displayName?: string }> = eventData.attendees || [];

      // Avoid duplicate
      const emailLower = attendee.email.toLowerCase().trim();
      const alreadyAdded = currentAttendees.some(
        (a) => a.email && a.email.toLowerCase().trim() === emailLower,
      );

      if (alreadyAdded) {
        this.logger.debug(`Attendee [${emailLower}] already on Google Calendar event.`);
        return true;
      }

      currentAttendees.push({
        email: emailLower,
        displayName: attendee.displayName || '',
      });

      // 2. Patch with sendUpdates=all so Google Calendar sends the invite email with Meet button
      const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sessionId)}?sendUpdates=all`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendees: currentAttendees,
        }),
      });

      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => ({}));
        this.logger.warn(`Failed to patch attendee to Google Calendar: ${JSON.stringify(patchErr)}`);
        return false;
      }

      this.logger.log(`Added attendee [${emailLower}] to Google Calendar event [${sessionId}] with sendUpdates=all`);
      return true;
    } catch (error) {
      this.logger.warn(`Could not add attendee to Google Calendar: ${error.message}`);
      return false;
    }
  }

  /**
   * Update session time or title on Google Calendar with sendUpdates=all.
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<ProviderSessionResult> {
    const { clientId, clientSecret, refreshToken, calendarId } = await this.getCredentials();
    const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);

    const patchPayload: Record<string, any> = {};
    if (input.title) patchPayload.summary = input.title;
    if (input.description !== undefined) patchPayload.description = input.description;
    if (input.startTime) {
      patchPayload.start = {
        dateTime: input.startTime.toISOString(),
        timeZone: input.timezone || 'UTC',
      };
    }
    if (input.endTime) {
      patchPayload.end = {
        dateTime: input.endTime.toISOString(),
        timeZone: input.timezone || 'UTC',
      };
    }

    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sessionId)}?conferenceDataVersion=1&sendUpdates=all`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patchPayload),
      });

      const eventData = await response.json();
      if (!response.ok) {
        this.logger.error(`Google Calendar patch event failed: ${JSON.stringify(eventData)}`);
        throw new InternalServerErrorException(
          `Google Calendar update failed: ${eventData.error?.message || 'Unknown error'}`,
        );
      }

      const meetEntry = eventData.conferenceData?.entryPoints?.find(
        (ep: any) => ep.entryPointType === 'video',
      );
      const meetingLink = meetEntry?.uri || eventData.hangoutLink;

      return {
        providerSessionId: eventData.id,
        meetingLink: meetingLink || '',
        hostJoinUrl: meetingLink || '',
        providerMetadata: {
          calendarId,
          eventId: eventData.id,
          htmlLink: eventData.htmlLink,
        },
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Google Meet session update failed: ${error.message}`);
      throw new InternalServerErrorException(`Failed to update Google Meet session: ${error.message}`);
    }
  }

  /**
   * Cancel event and notify attendees.
   */
  async cancelSession(sessionId: string, reason?: string): Promise<void> {
    try {
      const { clientId, clientSecret, refreshToken, calendarId } = await this.getCredentials();
      const accessToken = await this.getAccessToken(clientId, clientSecret, refreshToken);

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sessionId)}?sendUpdates=all`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok && response.status !== 404 && response.status !== 410) {
        const data = await response.json().catch(() => null);
        this.logger.warn(`Google Calendar delete event returned status ${response.status}: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      this.logger.error(`Google Meet cancelSession error: ${error.message}`);
    }
  }
}

import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { EmailService } from '../../email/email.service';
import { ConfigService } from '@nestjs/config';
import { WebinarsRepository } from './webinars.repository';
import { MeetingProvidersRepository } from './meeting-providers.repository';
import { WebinarProviderFactory } from './providers/webinar-provider.factory';
import { GoogleMeetProvider } from './providers/google-meet.provider';
import { ZoomProvider } from './providers/zoom.provider';
import { ZohoMeetingProvider } from './providers/zoho-meeting.provider';
import { SettingsService } from '../settings/settings.service';
import { CertificatesService } from '../../certificates/certificates.service';
import { Optional } from '@nestjs/common';
import {
  WebinarEntity,
  WebinarRegistrationEntity,
  WebinarAttendanceEntity,
} from './interfaces/webinar.interface';
import { AttendeeResult } from './interfaces/webinar-provider.interface';
import { CreateWebinarDto } from './dto/create-webinar.dto';
import { UpdateWebinarDto } from './dto/update-webinar.dto';
import { RescheduleWebinarDto } from './dto/reschedule-webinar.dto';
import { CancelWebinarDto } from './dto/cancel-webinar.dto';
import { RegisterWebinarDto } from './dto/register-webinar.dto';
import { QueryWebinarsDto } from './dto/query-webinar.dto';

export const STANDARD_REGISTRATION_FIELDS = [
  {
    id: 'first_name',
    label: 'First Name',
    type: 'text',
    required: true,
    isSystem: true,
    description: 'Participant identity for attendance records and the calendar invite.',
  },
  {
    id: 'last_name',
    label: 'Last Name',
    type: 'text',
    required: true,
    isSystem: true,
    description: 'Participant identity for attendance records and the calendar invite.',
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    isSystem: true,
    description: 'Receives unique join authorization link, calendar invite, and session updates.',
  },
  {
    id: 'phone',
    label: 'Phone Number',
    type: 'tel',
    required: true,
    isSystem: true,
    description: 'Contact verification and reminders (multiple participants may share a phone).',
  },
];

@Injectable()
export class WebinarsService {
  /** Max time registration waits for the meeting provider before deferring to retry. */
  private static readonly PROVIDER_SYNC_TIMEOUT_MS = 8000;
  private readonly logger = new Logger(WebinarsService.name);

  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(WebinarsRepository) private readonly webinarsRepository: WebinarsRepository,
    @Inject(WebinarProviderFactory) private readonly webinarProviderFactory: WebinarProviderFactory,
    @Inject(EmailService) private readonly emailService: EmailService,
    @Inject(GoogleMeetProvider) private readonly googleMeetProvider: GoogleMeetProvider,
    @Inject(ZoomProvider) private readonly zoomProvider: ZoomProvider,
    @Inject(ZohoMeetingProvider) private readonly zohoMeetingProvider: ZohoMeetingProvider,
    @Inject(MeetingProvidersRepository) private readonly meetingProvidersRepo: MeetingProvidersRepository,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Optional() @Inject(CertificatesService) private readonly certificatesService?: CertificatesService,
  ) {}

  /**
   * Helper: Generate a URL-friendly slug.
   */
  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    return `${baseSlug}-${randomSuffix}`;
  }

  /**
   * Helper: Generate a high-entropy 256-bit join token and its SHA-256 hash.
   */
  private generateJoinToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  /**
   * Providers that give every registrant a personal join link, so only registered emails can join.
   * For these, the shared meeting link is never sent to attendees.
   */
  private usesPersonalJoinLinks(webinar: Pick<WebinarEntity, 'provider'>): boolean {
    return webinar.provider === 'zoom';
  }

  /**
   * Register the attendee with the meeting provider and store their personal join link.
   * Never throws: failures are stored on the registration (provider_sync_status = 'failed')
   * so they can be retried, and no shared link is ever handed out instead.
   */
  private async syncRegistrantWithProvider(
    webinar: WebinarEntity,
    registration: WebinarRegistrationEntity,
  ): Promise<AttendeeResult> {
    if (registration.provider_sync_status === 'synced' && registration.provider_join_url) {
      return {
        ok: true,
        registrantId: registration.provider_registrant_id || undefined,
        joinUrl: registration.provider_join_url,
      };
    }

    let result: AttendeeResult;
    try {
      if (!webinar.provider_session_id) {
        throw new Error('Webinar has no provider meeting to register attendees on');
      }
      const provider = this.webinarProviderFactory.getProvider(webinar.provider);
      if (!provider.addAttendee) {
        throw new Error(`Provider ${webinar.provider} cannot register attendees`);
      }

      const work = (async (): Promise<AttendeeResult> => {
        // Meetings created before enforcement still auto-approve Zoom's own sign-up form: lock them first.
        if (!webinar.provider_metadata?.registrationEnforced && provider.enforceRegistrationSettings) {
          await provider.enforceRegistrationSettings(webinar.provider_session_id!);
          await this.webinarsRepository.markProviderRegistrationEnforced(webinar.webinar_id);
          webinar.provider_metadata = { ...(webinar.provider_metadata || {}), registrationEnforced: true };
        }
        const res = await provider.addAttendee!(webinar.provider_session_id!, {
          email: registration.email,
          displayName: `${registration.first_name} ${registration.last_name}`.trim(),
        });
        return typeof res === 'boolean' ? { ok: res, error: res ? undefined : 'Provider rejected attendee' } : res;
      })();

      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<AttendeeResult>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, error: `Provider did not respond within ${WebinarsService.PROVIDER_SYNC_TIMEOUT_MS}ms` }),
          WebinarsService.PROVIDER_SYNC_TIMEOUT_MS,
        );
      });
      result = await Promise.race([work, timeout]).finally(() => clearTimeout(timer));
    } catch (err: any) {
      result = { ok: false, error: err?.message || 'Unknown provider error' };
    }

    if (result.ok && !result.joinUrl) {
      result = { ok: false, error: 'Provider did not return a personal join link' };
    }

    if (result.ok) {
      await this.webinarsRepository.updateRegistrationProviderSync(registration.webinar_registration_id, {
        status: 'synced',
        registrantId: result.registrantId,
        joinUrl: result.joinUrl!,
      });
      registration.provider_sync_status = 'synced';
      registration.provider_registrant_id = result.registrantId || null;
      registration.provider_join_url = result.joinUrl!;
    } else {
      this.logger.warn(
        `Provider sync failed for registration [${registration.webinar_registration_id}] (${registration.email}): ${result.error}`,
      );
      await this.webinarsRepository.updateRegistrationProviderSync(registration.webinar_registration_id, {
        status: 'failed',
        error: result.error || 'Unknown provider error',
      });
      registration.provider_sync_status = 'failed';
    }
    return result;
  }

  /**
   * Helper: Generate standard iCalendar (.ics) content for email invites.
   */
  private generateIcsCalendar(webinar: WebinarEntity, joinUrl: string): string {
    const formatDate = (date: Date) =>
      date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const start = formatDate(new Date(webinar.start_time));
    const end = formatDate(new Date(webinar.end_time));
    const now = formatDate(new Date());

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Elevate LMS//Webinars//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${webinar.webinar_id}@lms.smjtechnology.online`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${webinar.title}`,
      `DESCRIPTION:${webinar.short_description || webinar.description || 'Elevate LMS Webinar'}\\n\\nJoin Link: ${joinUrl}`,
      `URL:${joinUrl}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * Helper: Resolve or auto-provision a single host user.
   */
  private async resolveSingleHostId(
    dto: { hostId?: string; hostEmail?: string; hostName?: string; hosts?: any[] },
    defaultUserId: string,
    client: PoolClient,
  ): Promise<string> {
    // 1. If explicit hostEmail is provided
    if (dto.hostEmail && dto.hostEmail.trim()) {
      const email = dto.hostEmail.trim().toLowerCase();
      const existingUserRes = await client.query(
        `SELECT user_id FROM users WHERE LOWER(email) = $1 LIMIT 1;`,
        [email],
      );

      if (existingUserRes.rows.length > 0) {
        return existingUserRes.rows[0].user_id;
      }

      // User does not exist - auto-provision host account
      const nameParts = (dto.hostName || email.split('@')[0]).trim().split(' ');
      const firstName = nameParts[0] || 'Host';
      const lastName = nameParts.slice(1).join(' ') || '';
      const dummyPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(dummyPassword, 10);

      const insertUserRes = await client.query(
        `
        INSERT INTO users (
          email, password_hash, first_name, last_name, is_active, is_verified
        )
        VALUES ($1, $2, $3, $4, TRUE, TRUE)
        RETURNING user_id;
        `,
        [email, passwordHash, firstName, lastName],
      );

      const newUserId = insertUserRes.rows[0].user_id;

      // Assign INSTRUCTOR role
      await client.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        SELECT $1, role_id FROM roles WHERE name = 'INSTRUCTOR'
        ON CONFLICT DO NOTHING;
        `,
        [newUserId],
      );

      this.logger.log(`Auto-provisioned new host user: ${email} (${newUserId})`);
      return newUserId;
    }

    // 2. If hostId is provided
    if (dto.hostId) {
      return dto.hostId;
    }

    // 3. If hosts array provided with at least 1 host
    if (dto.hosts && dto.hosts.length > 0 && dto.hosts[0].userId) {
      return dto.hosts[0].userId;
    }

    // 4. Fallback to creator
    return defaultUserId;
  }

  // ==========================================================
  // ADMIN MANAGEMENT METHODS (ADMIN Only)
  // ==========================================================

  /**
   * Create and schedule a new webinar.
   */
  async createWebinar(
    dto: CreateWebinarDto,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('Webinar end time must be after start time');
    }

    const slug = dto.slug ? dto.slug.toLowerCase().trim() : this.generateSlug(dto.title);
    const providerType = dto.provider || 'google_meet';
    const provider = this.webinarProviderFactory.getProvider(providerType);

    return this.databaseService.withTransaction(async (client) => {
      // 1. Resolve host user ID and fetch their contact email
      const hostUserId = await this.resolveSingleHostId(dto, currentUser.userId, client);
      const hostUserRes = await client.query(
        `SELECT email, first_name, last_name FROM users WHERE user_id = $1 LIMIT 1;`,
        [hostUserId],
      );
      const hostRow = hostUserRes.rows[0];
      const hostEmail = hostRow?.email || '';
      const hostName = `${hostRow?.first_name || ''} ${hostRow?.last_name || ''}`.trim() || hostEmail;

      // 2. Call meeting provider to create live meeting conference and invite Host
      const sessionResult = await provider.createSession({
        webinarId: crypto.randomUUID(),
        title: dto.title,
        description: dto.description,
        startTime,
        endTime,
        timezone: dto.timezone || 'UTC',
        hostEmail,
        hostName,
      });

      // 3. Persist webinar entity
      const webinar = await this.webinarsRepository.createWebinar(
        {
          title: dto.title,
          slug,
          description: dto.description,
          shortDescription: dto.shortDescription,
          coverImageUrl: dto.coverImageUrl,
          provider: providerType,
          providerSessionId: sessionResult.providerSessionId,
          providerMetadata: sessionResult.providerMetadata,
          meetingLink: sessionResult.meetingLink,
          hostJoinUrl: sessionResult.hostJoinUrl,
          passcode: sessionResult.passcode,
          startTime,
          endTime,
          timezone: dto.timezone || 'UTC',
          maxParticipants: dto.maxParticipants || 100,
          isPublicRegistration: dto.isPublicRegistration !== false,
          customRegistrationFields: dto.customRegistrationFields || [],
          createdBy: currentUser.userId,
        },
        client,
      );

      // 4. Assign strictly ONE single host
      await this.webinarsRepository.createWebinarHosts(
        webinar.webinar_id,
        [{ userId: hostUserId, hostRole: 'primary_host', displayOrder: 0 }],
        client,
      );

      await this.webinarsRepository.createAuditLog(
        {
          webinarId: webinar.webinar_id,
          actorId: currentUser.userId,
          actorRole: currentUser.role,
          action: 'WEBINAR_CREATED',
          details: { title: webinar.title, provider: providerType, startTime, endTime, hostUserId, hostEmail },
          ipAddress,
        },
        client,
      );

      // 5. Send host invitation email asynchronously after creation
      if (hostEmail) {
        this.sendHostInvitation(webinar, { email: hostEmail, name: hostName }).catch((err) =>
          this.logger.warn(`Could not dispatch host invitation: ${err.message}`),
        );
      }

      this.logger.log(`Webinar [${webinar.webinar_id}] created with single host ${hostUserId} (${hostEmail}) by ADMIN ${currentUser.userId}`);
      return webinar;
    });
  }

  /**
   * Update webinar metadata.
   */
  async updateWebinar(
    webinarId: string,
    dto: UpdateWebinarDto,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const existing = await this.webinarsRepository.findWebinarById(webinarId);
    if (!existing) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cannot update a cancelled webinar');
    }

    let startTime = existing.start_time;
    let endTime = existing.end_time;

    if (dto.startTime) startTime = new Date(dto.startTime);
    if (dto.endTime) endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('Webinar end time must be after start time');
    }

    // Synchronize external meeting provider ONLY if title or meeting timing actually changed
    const titleChanged = Boolean(dto.title && dto.title.trim() !== existing.title.trim());
    const timeChanged = Boolean(
      (dto.startTime && new Date(dto.startTime).getTime() !== new Date(existing.start_time).getTime()) ||
      (dto.endTime && new Date(dto.endTime).getTime() !== new Date(existing.end_time).getTime()),
    );

    if (existing.provider_session_id && (titleChanged || timeChanged)) {
      try {
        const provider = this.webinarProviderFactory.getProvider(existing.provider);
        await provider.updateSession(existing.provider_session_id, {
          title: dto.title || existing.title,
          description: dto.description || existing.description,
          startTime,
          endTime,
          timezone: dto.timezone || existing.timezone,
        });
      } catch (providerErr: any) {
        this.logger.warn(
          `Non-fatal: Could not synchronize session update to external provider ${existing.provider}: ${providerErr.message}`,
        );
      }
    }

    const actualId = existing.webinar_id;

    return this.databaseService.withTransaction(async (client) => {
      const updated = await this.webinarsRepository.updateWebinar(
        actualId,
        {
          title: dto.title,
          description: dto.description,
          shortDescription: dto.shortDescription,
          coverImageUrl: dto.coverImageUrl,
          startTime: dto.startTime ? startTime : undefined,
          endTime: dto.endTime ? endTime : undefined,
          timezone: dto.timezone,
          maxParticipants: dto.maxParticipants,
          isPublicRegistration: dto.isPublicRegistration,
          customRegistrationFields: dto.customRegistrationFields,
        },
        client,
      );

      if (dto.hostEmail || dto.hostId || (dto.hosts && dto.hosts.length > 0)) {
        const hostUserId = await this.resolveSingleHostId(dto, currentUser.userId, client);
        await this.webinarsRepository.replaceWebinarHosts(
          actualId,
          [{ userId: hostUserId, hostRole: 'primary_host', displayOrder: 0 }],
          client,
        );
      }

      await this.webinarsRepository.createAuditLog(
        {
          webinarId: actualId,
          actorId: currentUser.userId,
          actorRole: currentUser.role,
          action: 'WEBINAR_UPDATED',
          details: { updates: dto },
          ipAddress,
        },
        client,
      );

      return updated;
    });
  }

  /**
   * Reschedule a webinar and notify all confirmed registrants.
   */
  async rescheduleWebinar(
    webinarId: string,
    dto: RescheduleWebinarDto,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const existing = await this.webinarsRepository.findWebinarById(webinarId);
    if (!existing) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cannot reschedule a cancelled webinar');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('Webinar end time must be after start time');
    }

    // Synchronize with external provider if available
    if (existing.provider_session_id) {
      try {
        const provider = this.webinarProviderFactory.getProvider(existing.provider);
        await provider.updateSession(existing.provider_session_id, {
          startTime,
          endTime,
          timezone: dto.timezone || existing.timezone,
        });
      } catch (providerErr: any) {
        this.logger.warn(
          `Non-fatal: Could not synchronize reschedule to provider ${existing.provider}: ${providerErr.message}`,
        );
      }
    }

    const actualId = existing.webinar_id;

    const updated = await this.databaseService.withTransaction(async (client) => {
      const res = await this.webinarsRepository.updateWebinar(
        actualId,
        { startTime, endTime, timezone: dto.timezone || existing.timezone },
        client,
      );

      await this.webinarsRepository.createAuditLog(
        {
          webinarId: actualId,
          actorId: currentUser.userId,
          actorRole: currentUser.role,
          action: 'WEBINAR_RESCHEDULED',
          details: { oldStart: existing.start_time, newStart: startTime, reason: dto.reason },
          ipAddress,
        },
        client,
      );

      return res;
    });

    // Notify all confirmed registrants asynchronously
    this.sendRescheduleNotifications(updated, dto.reason).catch((err) =>
      this.logger.error(`Failed to send reschedule notifications: ${err.message}`),
    );

    return updated;
  }

  /**
   * Cancel a webinar and notify all confirmed registrants.
   */
  async cancelWebinar(
    webinarId: string,
    dto: CancelWebinarDto,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const existing = await this.webinarsRepository.findWebinarById(webinarId);
    if (!existing) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Webinar is already cancelled');
    }

    // Cancel provider session
    if (existing.provider_session_id) {
      const provider = this.webinarProviderFactory.getProvider(existing.provider);
      await provider.cancelSession(existing.provider_session_id, dto.reason);
    }

    const actualId = existing.webinar_id;

    const cancelled = await this.databaseService.withTransaction(async (client) => {
      const res = await this.webinarsRepository.updateWebinarStatus(
        actualId,
        'cancelled',
        { cancellationReason: dto.reason, cancelledAt: new Date() },
        client,
      );

      await this.webinarsRepository.createAuditLog(
        {
          webinarId: actualId,
          actorId: currentUser.userId,
          actorRole: currentUser.role,
          action: 'WEBINAR_CANCELLED',
          details: { reason: dto.reason },
          ipAddress,
        },
        client,
      );

      return res;
    });

    // Notify all confirmed registrants asynchronously
    this.sendCancellationNotifications(cancelled, dto.reason).catch((err) =>
      this.logger.error(`Failed to send cancellation notifications: ${err.message}`),
    );

    return cancelled;
  }

  /**
   * List webinars for Admin management.
   */
  async getAdminWebinars(query: QueryWebinarsDto) {
    return this.webinarsRepository.findAdminWebinars(query);
  }

  /**
   * Get registration fields schema (standard system fields & allowed custom field types).
   */
  getRegistrationFieldsSchema() {
    return {
      standardFields: STANDARD_REGISTRATION_FIELDS,
      allowedCustomFieldTypes: ['text', 'number', 'dropdown', 'checkbox'],
    };
  }

  /**
   * Get webinar details for Admin (includes hosts, provider info, and standard fields).
   */
  async getAdminWebinarDetails(webinarId: string) {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    const hosts = await this.webinarsRepository.findWebinarHosts(webinar.webinar_id);
    return {
      ...webinar,
      hosts,
      standard_registration_fields: STANDARD_REGISTRATION_FIELDS,
    };
  }

  /**
   * Get registrant roster for Admin.
   */
  async getWebinarRegistrants(webinarId: string, query: { page?: number; limit?: number; status?: string }) {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    return this.webinarsRepository.findRegistrationsByWebinarId(webinar.webinar_id, query);
  }

  /**
   * Get marketing attribution and attendance analytics for Admin.
   */
  async getWebinarAnalytics(webinarId: string) {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
    }

    return this.webinarsRepository.getAttributionAnalytics(webinar.webinar_id);
  }

  // ==========================================================
  // PUBLIC WEBINAR REGISTRATION & JOINING
  // ==========================================================

  /**
   * List public webinars for upcoming directory.
   */
  async getPublicWebinars(query: { search?: string; page?: number; limit?: number }) {
    return this.webinarsRepository.findPublicWebinars(query);
  }

  /**
   * Get single public webinar by vanity slug for landing page.
   */
  async getPublicWebinarBySlug(slug: string) {
    const webinar = await this.webinarsRepository.findWebinarBySlug(slug);
    if (!webinar) {
      throw new NotFoundException(`Webinar not found`);
    }

    const hosts = await this.webinarsRepository.findWebinarHosts(webinar.webinar_id);
    return {
      ...webinar,
      hosts,
      standard_registration_fields: STANDARD_REGISTRATION_FIELDS,
    };
  }

  /**
   * Public Webinar Registration (Unified funnel, no LMS login required).
   * Uses pessimistic row-locking to enforce capacity and prevent race conditions.
   */
  async registerPublic(
    webinarId: string,
    dto: RegisterWebinarDto,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ message: string; registrationId: string; webinar: any }> {
    const { rawToken, tokenHash } = this.generateJoinToken();

    // Concurrency Lock: Database transaction with SELECT FOR UPDATE
    const registration = await this.databaseService.withTransaction(async (client) => {
      // 1. Lock webinar row for capacity check
      const webinar = await this.webinarsRepository.lockWebinarForRegistration(client, webinarId);
      if (!webinar) {
        throw new NotFoundException(`Webinar with ID ${webinarId} not found`);
      }

      if (webinar.status === 'cancelled' || webinar.status === 'completed') {
        throw new BadRequestException(`Registration is closed for this webinar (Status: ${webinar.status})`);
      }

      if (!webinar.is_public_registration) {
        throw new ForbiddenException('Public registration is disabled for this webinar');
      }

      const actualWebinarId = webinar.webinar_id;

      // Validate answers against this webinar's admin-configured custom questions
      const customFieldResponses = this.validateCustomFieldResponses(
        webinar.custom_registration_fields,
        dto.customFieldResponses,
      );

      // 2. Duplicate Prevention (Checked before capacity check)
      const existing = await this.webinarsRepository.findRegistrationByEmail(actualWebinarId, dto.email, client);
      if (existing) {
        throw new ConflictException('You are already registered for this webinar');
      }

      // 3. Capacity Check
      const confirmedCount = await this.webinarsRepository.countConfirmedRegistrations(client, actualWebinarId);
      if (confirmedCount >= webinar.max_participants) {
        throw new BadRequestException('Webinar has reached maximum capacity');
      }

      // Token expires 1 hour after webinar end time
      const joinTokenExpiresAt = new Date(new Date(webinar.end_time).getTime() + 60 * 60 * 1000);

      // 4. Insert registration with status = 'confirmed' (Decoupled: NO user_id)
      return this.webinarsRepository.createRegistration(
        {
          webinarId: actualWebinarId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          customFieldResponses,
          joinTokenHash: tokenHash,
          joinTokenExpiresAt,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
          referrer: dto.referrer,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        client,
      );
    });

    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) throw new NotFoundException('Webinar not found');

    let message = 'Registration successful! Confirmation instructions have been sent to your email.';

    if (this.usesPersonalJoinLinks(webinar)) {
      // Zoom: register + approve first, then send ONE email with the attendee's personal join link.
      const sync = await this.syncRegistrantWithProvider(webinar, registration);
      if (sync.ok) {
        this.sendRegistrationConfirmation(webinar, registration, rawToken, false, sync.joinUrl).catch((err) =>
          this.logger.error(`Error in registration email lifecycle: ${err.message}`),
        );
      } else {
        // Registration is saved; the personal link is emailed once the provider sync succeeds (retry/resend).
        message = 'Registration successful! Your personal joining link will be emailed to you shortly.';
      }
    } else {
      // 1. Synchronize attendee with meeting provider (Google Calendar invite, Zoho Participant)
      if (webinar.provider && webinar.provider_session_id) {
        try {
          const provider = this.webinarProviderFactory.getProvider(webinar.provider);
          provider
            .addAttendee?.(webinar.provider_session_id, {
              email: registration.email,
              displayName: `${registration.first_name} ${registration.last_name}`.trim(),
            })
            .catch((err) =>
              this.logger.warn(`Could not add registrant to provider ${webinar.provider}: ${err.message}`),
            );
        } catch (providerErr: any) {
          this.logger.warn(`Could not resolve provider ${webinar.provider} for attendee sync: ${providerErr.message}`);
        }
      }

      // 2. Deliver Elevate LMS confirmation email asynchronously and track delivery lifecycle
      this.sendRegistrationConfirmation(webinar, registration, rawToken).catch((err) =>
        this.logger.error(`Error in registration email lifecycle: ${err.message}`),
      );
    }

    return {
      message,
      registrationId: registration.webinar_registration_id,
      webinar: {
        title: webinar.title,
        startTime: webinar.start_time,
        endTime: webinar.end_time,
        timezone: webinar.timezone,
      },
    };
  }

  /**
   * Resend Registration Confirmation email.
   */
  async resendConfirmation(
    webinarId: string,
    email: string,
  ): Promise<{ message: string }> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const registration = await this.webinarsRepository.findRegistrationByEmail(webinarId, email);
    if (!registration) {
      throw new NotFoundException('No active registration found for this email');
    }

    // Refresh join token on resend for security
    const { rawToken, tokenHash } = this.generateJoinToken();
    await this.databaseService.executeQuery(
      `UPDATE webinar_registrations SET join_token_hash = $1 WHERE webinar_registration_id = $2`,
      [tokenHash, registration.webinar_registration_id],
    );

    if (this.usesPersonalJoinLinks(webinar)) {
      const sync = await this.syncRegistrantWithProvider(webinar, registration);
      if (!sync.ok) {
        throw new ServiceUnavailableException(
          'We could not prepare your personal joining link yet. Please try again in a few minutes.',
        );
      }
      await this.sendRegistrationConfirmation(webinar, registration, rawToken, true, sync.joinUrl);
    } else {
      await this.sendRegistrationConfirmation(webinar, registration, rawToken, true);
    }

    return { message: 'Confirmation email resent successfully.' };
  }

  /**
   * Authenticate and authorize a participant to join.
   * Enforces time window (15 mins before start up to end time).
   */
  async authorizeJoin(
    webinarId: string,
    joinToken: string,
  ): Promise<{ meetingLink: string; provider?: string; passcode?: string; participant: { name: string; email: string; registrationId: string } }> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const tokenHash = crypto.createHash('sha256').update(joinToken).digest('hex');
    const registration = await this.webinarsRepository.findRegistrationByJoinTokenHash(tokenHash);

    if (!registration || registration.webinar_id !== webinar.webinar_id) {
      throw new ForbiddenException('Invalid or expired join token');
    }

    if (new Date() > new Date(registration.join_token_expires_at)) {
      throw new ForbiddenException('Join token has expired');
    }

    if (webinar.status === 'cancelled') {
      throw new BadRequestException('This webinar has been cancelled');
    }

    // Time window check: Allowed 15 minutes before scheduled start time up to end time
    const now = new Date().getTime();
    const allowedEarlyMs = 15 * 60 * 1000;
    const windowStart = new Date(webinar.start_time).getTime() - allowedEarlyMs;
    const windowEnd = new Date(webinar.end_time).getTime();

    if (now < windowStart) {
      throw new BadRequestException(
        `Session is not yet open. You can join starting 15 minutes before start time (${webinar.start_time.toISOString()}).`,
      );
    }

    if (now > windowEnd && webinar.status !== 'live') {
      throw new BadRequestException('This webinar session has ended');
    }

    if (this.usesPersonalJoinLinks(webinar)) {
      // Hand out only this registrant's personal link; never the shared meeting link.
      const sync = await this.syncRegistrantWithProvider(webinar, registration);
      if (!sync.ok) {
        throw new ServiceUnavailableException(
          'Your personal joining link is not ready yet. Please try again in a few minutes.',
        );
      }
      return {
        meetingLink: sync.joinUrl!,
        provider: webinar.provider,
        participant: {
          name: `${registration.first_name} ${registration.last_name}`,
          email: registration.email,
          registrationId: registration.webinar_registration_id,
        },
      };
    }

    if (!webinar.meeting_link) {
      throw new BadRequestException('Meeting conference link is not configured for this webinar');
    }

    return {
      meetingLink: webinar.meeting_link,
      provider: webinar.provider,
      passcode: webinar.passcode,
      participant: {
        name: `${registration.first_name} ${registration.last_name}`,
        email: registration.email,
        registrationId: registration.webinar_registration_id,
      },
    };
  }

  /**
   * Attendance Tracking: Record participant joined interval.
   */
  async recordAttendanceJoin(
    webinarId: string,
    registrationId: string,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<WebinarAttendanceEntity> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const registration = await this.databaseService.executeQuery<WebinarRegistrationEntity>(
      `SELECT * FROM webinar_registrations WHERE webinar_registration_id = $1 AND webinar_id = $2;`,
      [registrationId, webinar.webinar_id],
    );

    if (registration.rowCount === 0) {
      throw new NotFoundException('Registration record not found');
    }

    const reg = registration.rows[0];

    // Close any previous dangling unclosed interval if reconnecting
    const active = await this.webinarsRepository.findActiveAttendance(registrationId);
    if (active) {
      await this.webinarsRepository.closeAttendanceInterval(active.webinar_attendance_id);
    }

    return this.webinarsRepository.createAttendanceInterval({
      webinarId: webinar.webinar_id,
      webinarRegistrationId: registrationId,
      email: reg.email,
      displayName: `${reg.first_name} ${reg.last_name}`,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Attendance Tracking: Record participant left interval.
   */
  async recordAttendanceLeave(webinarId: string, registrationId: string): Promise<void> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const active = await this.webinarsRepository.findActiveAttendance(registrationId);
    if (active && active.webinar_id === webinar.webinar_id) {
      await this.webinarsRepository.closeAttendanceInterval(active.webinar_attendance_id);
    }
  }

  // ==========================================================
  // HOST CONTROLS (Assigned Host in webinar_hosts or ADMIN)
  // ==========================================================

  /**
   * Get host join launch URL (elevated host privileges).
   */
  async getHostJoinUrl(webinarId: string): Promise<{ hostJoinUrl: string; meetingLink: string }> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    if (!webinar.host_join_url && !webinar.meeting_link) {
      throw new BadRequestException('Host join URL is not configured');
    }

    return {
      hostJoinUrl: webinar.host_join_url || webinar.meeting_link || '',
      meetingLink: webinar.meeting_link || '',
    };
  }

  /**
   * Start live session (transitions status to 'live').
   */
  async startSession(
    webinarId: string,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    if (webinar.status === 'cancelled') {
      throw new BadRequestException('Cannot start a cancelled webinar');
    }

    const actualId = webinar.webinar_id;
    const updated = await this.webinarsRepository.updateWebinarStatus(actualId, 'live');

    await this.webinarsRepository.createAuditLog({
      webinarId: actualId,
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      action: 'SESSION_STARTED',
      details: { startedAt: new Date() },
      ipAddress,
    });

    this.logger.log(`Webinar [${actualId}] live session started by host ${currentUser.userId}`);
    return updated;
  }

  /**
   * End live session (transitions status to 'completed' and closes dangling attendances).
   */
  async endSession(
    webinarId: string,
    currentUser: { userId: string; role: string },
    ipAddress?: string,
  ): Promise<WebinarEntity> {
    const webinar = await this.webinarsRepository.findWebinarById(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const actualId = webinar.webinar_id;
    const updated = await this.webinarsRepository.updateWebinarStatus(actualId, 'completed');

    // Close any unclosed attendance intervals
    await this.databaseService.executeQuery(
      `
      UPDATE webinar_attendances
      SET
        left_at = CURRENT_TIMESTAMP,
        duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::int)
      WHERE webinar_id = $1 AND left_at IS NULL;
      `,
      [actualId],
    );

    await this.webinarsRepository.createAuditLog({
      webinarId: actualId,
      actorId: currentUser.userId,
      actorRole: currentUser.role,
      action: 'SESSION_ENDED',
      details: { endedAt: new Date() },
      ipAddress,
    });

    if (this.certificatesService) {
      try {
        await this.certificatesService.issueWebinarParticipationCertificates(actualId);
      } catch (certErr: any) {
        this.logger.warn(`Webinar certificate auto-issuance error: ${certErr?.message}`);
      }
    }

    this.logger.log(`Webinar [${webinarId}] live session ended by host ${currentUser.userId}`);
    return updated;
  }

  // ==========================================================
  // TRANSACTIONAL NOTIFICATION HELPERS (Email Lifecycle)
  // ==========================================================

  private async sendRegistrationConfirmation(
    webinar: WebinarEntity,
    registration: WebinarRegistrationEntity,
    rawJoinToken: string,
    isResend = false,
    personalJoinUrl?: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    // Personal-link providers (Zoom): the email carries ONE link, the attendee's own provider link.
    const isPersonal = Boolean(personalJoinUrl);
    const joinUrl = personalJoinUrl || `${frontendUrl}/webinars/${webinar.slug}/join?token=${rawJoinToken}`;
    const icsContent = this.generateIcsCalendar(webinar, joinUrl);

    const providerLabel =
      webinar.provider === 'zoom'
        ? 'Zoom Video'
        : webinar.provider === 'zoho'
        ? 'Zoho Meeting'
        : 'Google Meet';

    const activeAccount = await this.meetingProvidersRepo.findActiveAccount(webinar.provider).catch(() => null);
    const senderEmail = activeAccount?.account_email;
    const from = senderEmail ? `Elevate LMS <${senderEmail}>` : undefined;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.5;">
        <h2 style="color: #4f46e5;">Registration Confirmed!</h2>
        <p>Hi <strong>${registration.first_name}</strong>,</p>
        <p>You have successfully registered for <strong>${webinar.title}</strong>.</p>

        <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>📅 Date:</strong> ${new Date(webinar.start_time).toUTCString()}</p>
          <p style="margin: 4px 0;"><strong>⏰ Duration:</strong> ${Math.round((new Date(webinar.end_time).getTime() - new Date(webinar.start_time).getTime()) / 60000)} minutes</p>
          <p style="margin: 4px 0;"><strong>🌐 Timezone:</strong> ${webinar.timezone}</p>
          <p style="margin: 4px 0;"><strong>📹 Video Provider:</strong> ${providerLabel}</p>
          ${!isPersonal && webinar.passcode ? `<p style="margin: 4px 0;"><strong>🔑 Passcode:</strong> ${webinar.passcode}</p>` : ''}
        </div>

        ${!isPersonal && webinar.meeting_link ? `
        <div style="margin: 20px 0; padding: 16px; background: #e0e7ff; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 13px; color: #3730a3; font-weight: bold;">Direct ${providerLabel} Video Link:</p>
          <a href="${webinar.meeting_link}" style="color: #4338ca; word-break: break-all; font-size: 14px; font-weight: bold;">${webinar.meeting_link}</a>
        </div>
        ` : ''}

        <p>${isPersonal ? 'Your personal joining link:' : 'Access your personalized, secure join link on Elevate LMS below:'}</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${joinUrl}" style="background-color: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Join Live Webinar
          </a>
        </p>
        ${isPersonal ? `
        <p style="font-size: 12px; color: #6b7280;">
          This link is personal to <strong>${registration.email}</strong> and works on one device at a time. Please don't share it: anyone else who opens the meeting can't get in without registering.
        </p>` : ''}
        <p style="font-size: 12px; color: #6b7280;">
          The session room opens 15 minutes before the scheduled start time. Calendar invitation has also been attached.
        </p>
      </div>
    `;

    try {
      await this.emailService.sendEmail({
        to: registration.email,
        from,
        replyTo: senderEmail || undefined,
        subject: `Confirmed: ${webinar.title} - Your Meeting Link`,
        html,
        attachments: [
          {
            filename: 'webinar-invite.ics',
            content: icsContent,
            contentType: 'text/calendar',
          },
        ],
      });

      await this.webinarsRepository.updateRegistrationDeliveryStatus(
        registration.webinar_registration_id,
        'delivered',
        undefined,
        isResend,
      );
    } catch (error) {
      this.logger.error(`Failed to deliver registration confirmation email to ${registration.email}: ${error.message}`);
      await this.webinarsRepository.updateRegistrationDeliveryStatus(
        registration.webinar_registration_id,
        'failed',
        error.message,
        isResend,
      );
    }
  }

  /**
   * Dispatches Host Invitation Email with Video Meet link, Host Launch Room URL, and .ics file.
   */
  private async sendHostInvitation(
    webinar: WebinarEntity,
    host: { email: string; name: string },
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const hostRoomUrl = `${frontendUrl}/dashboard/admin/webinars/${webinar.slug}`;
    const icsContent = this.generateIcsCalendar(webinar, hostRoomUrl);

    const providerLabel =
      webinar.provider === 'zoom'
        ? 'Zoom Video'
        : webinar.provider === 'zoho'
        ? 'Zoho Meeting'
        : 'Google Meet';

    const activeAccount = await this.meetingProvidersRepo.findActiveAccount(webinar.provider).catch(() => null);
    const senderEmail = activeAccount?.account_email;
    const from = senderEmail ? `Elevate LMS <${senderEmail}>` : undefined;
    const hostMeetingLaunchUrl = webinar.host_join_url || webinar.meeting_link || hostRoomUrl;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.5;">
        <h2 style="color: #4f46e5;">Host Assignment: ${webinar.title}</h2>
        <p>Hi <strong>${host.name}</strong>,</p>
        <p>You have been assigned as the primary host for the upcoming live webinar on Elevate LMS.</p>

        <div style="background-color: #f3f4f6; padding: 18px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>📅 Date & Time:</strong> ${new Date(webinar.start_time).toUTCString()}</p>
          <p style="margin: 4px 0;"><strong>⏰ Duration:</strong> ${Math.round((new Date(webinar.end_time).getTime() - new Date(webinar.start_time).getTime()) / 60000)} minutes</p>
          <p style="margin: 4px 0;"><strong>🌐 Timezone:</strong> ${webinar.timezone}</p>
          <p style="margin: 4px 0;"><strong>📹 Video Provider:</strong> ${providerLabel}</p>
          ${webinar.meeting_link ? `<p style="margin: 4px 0;"><strong>🔗 Video Meeting Link:</strong> <a href="${webinar.meeting_link}">${webinar.meeting_link}</a></p>` : ''}
          ${webinar.host_join_url ? `<p style="margin: 4px 0;"><strong>🚀 Host Start URL:</strong> <a href="${webinar.host_join_url}">${webinar.host_join_url}</a></p>` : ''}
          ${webinar.passcode ? `<p style="margin: 4px 0;"><strong>🔑 Meeting Passcode:</strong> <strong>${webinar.passcode}</strong></p>` : ''}
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${hostMeetingLaunchUrl}" style="background-color: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-right: 10px;">
            Join ${providerLabel} as Host
          </a>
          <a href="${hostRoomUrl}" style="background-color: #e0e7ff; color: #4338ca; padding: 12px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Host Control Room
          </a>
        </div>

        <p style="font-size: 13px; color: #6b7280;">
          You can manage your session directly from the Host Control Room, or launch the live video room with the direct host link above. A calendar event (.ics) has also been attached to this email.
        </p>
      </div>
    `;

    try {
      await this.emailService.sendEmail({
        to: host.email,
        from,
        replyTo: senderEmail || undefined,
        subject: `Host Invitation & Meeting Link: ${webinar.title}`,
        html,
        attachments: [
          {
            filename: 'webinar-host-invite.ics',
            content: icsContent,
            contentType: 'text/calendar',
          },
        ],
      });
      this.logger.log(`Host invitation email sent to [${host.email}] from [${from || 'default'}] for webinar [${webinar.title}]`);
    } catch (error) {
      this.logger.warn(`Failed to deliver host invitation email to ${host.email}: ${error.message}`);
    }
  }

  private async sendRescheduleNotifications(webinar: WebinarEntity, reason?: string): Promise<void> {
    const registrants = await this.webinarsRepository.findConfirmedRegistrants(webinar.webinar_id);
    for (const reg of registrants) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #d97706;">Webinar Rescheduled</h2>
          <p>Hi <strong>${reg.first_name}</strong>,</p>
          <p>Please note that the webinar <strong>${webinar.title}</strong> has been rescheduled.</p>
          <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📅 New Date & Time:</strong> ${new Date(webinar.start_time).toUTCString()}</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>
          <p>Your joining credentials remain active. We look forward to seeing you then!</p>
        </div>
      `;

      this.emailService
        .sendEmail({
          to: reg.email,
          subject: `Rescheduled: ${webinar.title}`,
          html,
        })
        .catch((err) => this.logger.warn(`Reschedule email failed for ${reg.email}: ${err.message}`));
    }
  }

  private async sendCancellationNotifications(webinar: WebinarEntity, reason: string): Promise<void> {
    const registrants = await this.webinarsRepository.findConfirmedRegistrants(webinar.webinar_id);
    for (const reg of registrants) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #dc2626;">Webinar Cancelled</h2>
          <p>Hi <strong>${reg.first_name}</strong>,</p>
          <p>We regret to inform you that the webinar <strong>${webinar.title}</strong> has been cancelled.</p>
          <div style="background-color: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Reason:</strong> ${reason}</p>
          </div>
          <p>We apologize for the inconvenience and hope to see you in future sessions.</p>
        </div>
      `;

      this.emailService
        .sendEmail({
          to: reg.email,
          subject: `Cancelled: ${webinar.title}`,
          html,
        })
        .catch((err) => this.logger.warn(`Cancellation email failed for ${reg.email}: ${err.message}`));
    }
  }

  /**
   * Validate public registration answers against the webinar's custom field definitions.
   * - required fields must be answered
   * - number must be numeric, dropdown must be one of the options, checkbox must be boolean
   * - unknown keys are dropped (only configured questions are stored)
   * Throws 400 with every problem listed so the form can show them together.
   */
  private validateCustomFieldResponses(
    definitions: any,
    responses: Record<string, any> | undefined,
  ): Record<string, string | number | boolean> {
    const fields: Array<{ id: string; label: string; type: string; required: boolean; options?: string[] }> =
      Array.isArray(definitions) ? definitions : [];
    const input = responses && typeof responses === 'object' ? responses : {};
    const clean: Record<string, string | number | boolean> = {};
    const errors: string[] = [];

    for (const field of fields) {
      const raw = input[field.id];
      const isEmpty =
        raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '') || raw === false;

      if (isEmpty) {
        if (field.required) {
          errors.push(field.type === 'checkbox' ? `${field.label} must be checked` : `${field.label} is required`);
        } else if (field.type === 'checkbox') {
          clean[field.id] = false;
        }
        continue;
      }

      switch (field.type) {
        case 'number': {
          const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
          if (!Number.isFinite(num)) errors.push(`${field.label} must be a number`);
          else clean[field.id] = num;
          break;
        }
        case 'dropdown': {
          const value = String(raw).trim();
          if (!(field.options || []).includes(value)) errors.push(`${field.label} must be one of the listed options`);
          else clean[field.id] = value;
          break;
        }
        case 'checkbox': {
          if (raw !== true && raw !== 'true') errors.push(`${field.label} has an invalid value`);
          else clean[field.id] = true;
          break;
        }
        default: {
          const value = String(raw).trim();
          if (value.length > 500) errors.push(`${field.label} must be 500 characters or fewer`);
          else clean[field.id] = value;
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }
    return clean;
  }

  // ==========================================================
  // MEETING PROVIDER MANAGEMENT METHODS
  // ==========================================================

  /**
   * Returns connection status of supported meeting providers (Google Meet, Zoom, Zoho).
   */
  async getMeetingProvidersStatus() {
    const [googleStatus, zoomStatus, zohoStatus] = await Promise.all([
      this.googleMeetProvider.getConnectionStatus().catch((err) => {
        this.logger.warn(`Google status check failed: ${err.message}`);
        return { isConfigured: false, isConnected: false, accountEmail: undefined, accountName: undefined, connectedAt: undefined };
      }),
      this.zoomProvider.getConnectionStatus().catch((err) => {
        this.logger.warn(`Zoom status check failed: ${err.message}`);
        return { isConfigured: false, isConnected: false, accountEmail: undefined, accountName: undefined, connectedAt: undefined };
      }),
      this.zohoMeetingProvider.getConnectionStatus().catch((err) => {
        this.logger.warn(`Zoho status check failed: ${err.message}`);
        return { isConfigured: false, isConnected: false, accountEmail: undefined, accountName: undefined, connectedAt: undefined };
      }),
    ]);

    return {
      providers: [
        {
          id: 'google_meet',
          name: 'Google Meet',
          isConfigured: googleStatus.isConfigured,
          isConnected: googleStatus.isConnected,
          accountEmail: googleStatus.accountEmail,
          accountName: googleStatus.accountName,
          connectedAt: googleStatus.connectedAt,
        },
        {
          id: 'zoom',
          name: 'Zoom Video',
          isConfigured: zoomStatus.isConfigured,
          isConnected: zoomStatus.isConnected,
          accountEmail: zoomStatus.accountEmail,
          accountName: zoomStatus.accountName,
          connectedAt: zoomStatus.connectedAt,
        },
        {
          id: 'zoho',
          name: 'Zoho Meeting',
          isConfigured: zohoStatus.isConfigured,
          isConnected: zohoStatus.isConnected,
          accountEmail: zohoStatus.accountEmail,
          accountName: zohoStatus.accountName,
          connectedAt: zohoStatus.connectedAt,
        },
      ],
    };
  }

  // ----------------------------------------------------------
  // GOOGLE MEET & CALENDAR
  // ----------------------------------------------------------

  /**
   * Generates Google OAuth URL for Admin to connect.
   */
  async getGoogleAuthUrl(redirectUri?: string, state?: string): Promise<{ url: string }> {
    const url = await this.googleMeetProvider.generateAuthUrl(redirectUri, state);
    return { url };
  }

  /**
   * Handles Google OAuth authorization code callback.
   */
  async handleGoogleOAuthCallback(code: string, redirectUri?: string, userId?: string) {
    return this.googleMeetProvider.handleOAuthCallback(code, redirectUri, userId);
  }

  /**
   * Disconnects Google Meet account.
   */
  async disconnectGoogleProvider() {
    await this.googleMeetProvider.disconnect();
    return { success: true, message: 'Google account disconnected successfully.' };
  }

  /**
   * Verifies Google Meet and Calendar connection with live event creation/deletion test.
   */
  async testGoogleMeet() {
    return this.googleMeetProvider.testConnection();
  }

  // ----------------------------------------------------------
  // ZOOM VIDEO INTEGRATION
  // ----------------------------------------------------------

  /**
   * Generates Zoom OAuth authorization URL for Admin to connect.
   */
  async getZoomAuthUrl(redirectUri?: string, state?: string): Promise<{ url: string }> {
    const url = await this.zoomProvider.generateAuthUrl(redirectUri, state);
    return { url };
  }

  /**
   * Handles Zoom OAuth authorization code callback.
   */
  async handleZoomOAuthCallback(code: string, redirectUri?: string, userId?: string) {
    return this.zoomProvider.handleOAuthCallback(code, redirectUri, userId);
  }

  /**
   * Verifies Zoom credentials by creating and immediately cleaning up a test meeting.
   */
  async testZoomMeeting() {
    return this.zoomProvider.testConnection();
  }

  /**
   * Disconnects active Zoom account integration.
   */
  async disconnectZoom() {
    await this.zoomProvider.disconnect();
    return { success: true, message: 'Zoom integration disconnected successfully.' };
  }

  // ----------------------------------------------------------
  // ZOHO MEETING INTEGRATION
  // ----------------------------------------------------------

  /**
   * Generates Zoho OAuth authorization URL for Admin.
   */
  async getZohoAuthUrl(redirectUri?: string, state?: string): Promise<{ url: string }> {
    const url = await this.zohoMeetingProvider.generateAuthUrl(redirectUri, state);
    return { url };
  }

  /**
   * Handles Zoho OAuth authorization callback.
   */
  async handleZohoOAuthCallback(code: string, redirectUri?: string, userId?: string) {
    return this.zohoMeetingProvider.handleOAuthCallback(code, redirectUri, userId);
  }

  /**
   * Verifies Zoho Meeting connection by creating and deleting a test session.
   */
  async testZohoMeeting() {
    return this.zohoMeetingProvider.testConnection();
  }

  /**
   * Disconnects active Zoho Meeting integration.
   */
  async disconnectZoho() {
    await this.zohoMeetingProvider.disconnect();
    return { success: true, message: 'Zoho Meeting integration disconnected successfully.' };
  }

  // ==========================================================
  // WEBHOOK HANDLERS & REALTIME ATTENDANCE SYNCHRONIZATION
  // ==========================================================

  /**
   * Handles incoming Zoom Webhooks:
   * - Endpoint URL validation challenge (CRC handshake)
   * - Session lifecycle updates (meeting.started, meeting.ended)
   * - Participant telemetry & attendance interval tracking
   */
  async handleZoomWebhook(payload: any, headers?: Record<string, any>) {
    if (!payload) return { status: 'ignored', reason: 'empty_payload' };

    // 1. Zoom CRC URL Validation Handshake
    if (payload.event === 'endpoint.url_validation') {
      const plainToken = payload.payload?.plainToken;
      if (!plainToken) return { status: 'error', message: 'plainToken missing' };

      const zoomSettings = await this.settingsService.getRawZoomOAuthSettings();
      const secretToken = zoomSettings.webhookSecretToken || this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN') || '';

      const encryptedToken = crypto
        .createHmac('sha256', secretToken)
        .update(plainToken)
        .digest('hex');

      this.logger.log('Zoom webhook URL validation CRC challenge responded successfully');
      return {
        plainToken,
        encryptedToken,
      };
    }

    // 2. Webhook Signature Verification (if secret configured)
    const zoomSettings = await this.settingsService.getRawZoomOAuthSettings();
    const webhookSecret = zoomSettings.webhookSecretToken || this.configService.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN');
    if (webhookSecret && headers) {
      const signature = (headers['x-zm-signature'] || headers['X-Zm-Signature']) as string;
      const timestamp = (headers['x-zm-request-timestamp'] || headers['X-Zm-Request-Timestamp']) as string;

      if (signature && timestamp) {
        const message = `v0:${timestamp}:${JSON.stringify(payload)}`;
        const expectedSignature = `v0=${crypto.createHmac('sha256', webhookSecret).update(message).digest('hex')}`;
        if (signature !== expectedSignature) {
          this.logger.warn('Zoom webhook signature mismatch. Ignoring untrusted request.');
          return { status: 'ignored', reason: 'invalid_signature' };
        }
      }
    }

    const event = payload.event;
    const meetingObject = payload.payload?.object;
    const meetingId = meetingObject?.id ? String(meetingObject.id) : null;

    if (!meetingId) {
      return { status: 'ignored', reason: 'no_meeting_id' };
    }

    const webinar = await this.webinarsRepository.findWebinarByProviderSession('zoom', meetingId);
    if (!webinar) {
      this.logger.debug(`Zoom event [${event}] received for unknown/external meeting ID: ${meetingId}`);
      return { status: 'ignored', reason: 'webinar_not_found' };
    }

    this.logger.log(`Processing Zoom event [${event}] for webinar [${webinar.title}] (ID: ${webinar.webinar_id})`);

    // 3. Process Event Types
    switch (event) {
      case 'meeting.started': {
        if (webinar.status === 'scheduled' || webinar.status === 'published') {
          await this.webinarsRepository.updateWebinarStatus(webinar.webinar_id, 'live');
          this.logger.log(`Webinar [${webinar.webinar_id}] transitioned to 'live' via Zoom webhook`);
        }
        break;
      }

      case 'meeting.ended': {
        if (webinar.status !== 'completed' && webinar.status !== 'cancelled') {
          await this.webinarsRepository.updateWebinarStatus(webinar.webinar_id, 'completed');
          this.logger.log(`Webinar [${webinar.webinar_id}] transitioned to 'completed' via Zoom webhook`);
        }
        break;
      }

      case 'meeting.participant_joined': {
        const participant = meetingObject.participant;
        const participantEmail = participant?.email?.toLowerCase().trim();
        const displayName = participant?.user_name || participant?.name || 'Attendee';

        if (participantEmail) {
          const registration = await this.webinarsRepository.findRegistrationByEmail(webinar.webinar_id, participantEmail);
          if (registration) {
            const existingActive = await this.webinarsRepository.findActiveAttendance(registration.webinar_registration_id);
            if (!existingActive) {
              await this.webinarsRepository.createAttendanceInterval({
                webinarId: webinar.webinar_id,
                webinarRegistrationId: registration.webinar_registration_id,
                email: participantEmail,
                displayName,
              });
              this.logger.log(`Attendance join interval recorded for [${participantEmail}] in webinar [${webinar.webinar_id}]`);
            }
          } else {
            this.logger.warn(`Participant [${participantEmail}] joined webinar [${webinar.webinar_id}] without a registration (host or not registered)`);
          }
        }
        break;
      }

      case 'meeting.participant_left': {
        const participant = meetingObject.participant;
        const participantEmail = participant?.email?.toLowerCase().trim();

        if (participantEmail) {
          const registration = await this.webinarsRepository.findRegistrationByEmail(webinar.webinar_id, participantEmail);
          if (registration) {
            const activeAttendance = await this.webinarsRepository.findActiveAttendance(registration.webinar_registration_id);
            if (activeAttendance) {
              await this.webinarsRepository.closeAttendanceInterval(activeAttendance.webinar_attendance_id);
              this.logger.log(`Attendance leave interval closed for [${participantEmail}] in webinar [${webinar.webinar_id}]`);
            }
          }
        }
        break;
      }

      default:
        this.logger.debug(`Unhandled Zoom webhook event: ${event}`);
    }

    return { status: 'processed', event, webinarId: webinar.webinar_id };
  }

  /**
   * Handles incoming Zoho Meeting Webhooks:
   * - Session lifecycle updates (session_started, session_ended)
   * - Participant join / leave telemetry
   */
  async handleZohoWebhook(payload: any, headers?: Record<string, any>) {
    if (!payload) return { status: 'ignored', reason: 'empty_payload' };

    const event = (payload.event || payload.action || payload.eventType || '').toLowerCase();
    const sessionKey = String(payload.session_key || payload.meeting_key || payload.sessionKey || payload.session?.key || '');

    if (!sessionKey) {
      return { status: 'ignored', reason: 'no_session_key' };
    }

    const webinar = await this.webinarsRepository.findWebinarByProviderSession('zoho', sessionKey);
    if (!webinar) {
      this.logger.debug(`Zoho event [${event}] received for unknown/external session key: ${sessionKey}`);
      return { status: 'ignored', reason: 'webinar_not_found' };
    }

    this.logger.log(`Processing Zoho event [${event}] for webinar [${webinar.title}] (ID: ${webinar.webinar_id})`);

    if (event.includes('started')) {
      if (webinar.status === 'scheduled' || webinar.status === 'published') {
        await this.webinarsRepository.updateWebinarStatus(webinar.webinar_id, 'live');
        this.logger.log(`Webinar [${webinar.webinar_id}] transitioned to 'live' via Zoho webhook`);
      }
    } else if (event.includes('ended')) {
      if (webinar.status !== 'completed' && webinar.status !== 'cancelled') {
        await this.webinarsRepository.updateWebinarStatus(webinar.webinar_id, 'completed');
        this.logger.log(`Webinar [${webinar.webinar_id}] transitioned to 'completed' via Zoho webhook`);
      }
    } else if (event.includes('join')) {
      const email = (payload.user_email || payload.email || payload.participant?.email || '').toLowerCase().trim();
      const displayName = payload.user_name || payload.name || payload.participant?.name || 'Attendee';

      if (email) {
        const registration = await this.webinarsRepository.findRegistrationByEmail(webinar.webinar_id, email);
        if (registration) {
          const existing = await this.webinarsRepository.findActiveAttendance(registration.webinar_registration_id);
          if (!existing) {
            await this.webinarsRepository.createAttendanceInterval({
              webinarId: webinar.webinar_id,
              webinarRegistrationId: registration.webinar_registration_id,
              email,
              displayName,
            });
            this.logger.log(`Zoho attendance join recorded for [${email}] in webinar [${webinar.webinar_id}]`);
          }
        }
      }
    } else if (event.includes('left') || event.includes('leave')) {
      const email = (payload.user_email || payload.email || payload.participant?.email || '').toLowerCase().trim();
      if (email) {
        const registration = await this.webinarsRepository.findRegistrationByEmail(webinar.webinar_id, email);
        if (registration) {
          const active = await this.webinarsRepository.findActiveAttendance(registration.webinar_registration_id);
          if (active) {
            await this.webinarsRepository.closeAttendanceInterval(active.webinar_attendance_id);
            this.logger.log(`Zoho attendance leave closed for [${email}] in webinar [${webinar.webinar_id}]`);
          }
        }
      }
    }

    return { status: 'processed', event, webinarId: webinar.webinar_id };
  }
}

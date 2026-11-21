import { Injectable, Inject, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  WebinarEntity,
  WebinarHostEntity,
  WebinarRegistrationEntity,
  WebinarAttendanceEntity,
  WebinarStatus,
  WebinarHostRole,
  DeliveryStatus,
} from './interfaces/webinar.interface';

@Injectable()
export class WebinarsRepository {
  private readonly logger = new Logger(WebinarsRepository.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  /**
   * Insert a new webinar record.
   */
  async createWebinar(
    data: {
      title: string;
      slug: string;
      description?: string;
      shortDescription?: string;
      coverImageUrl?: string;
      provider: string;
      providerSessionId?: string;
      providerMetadata?: Record<string, any>;
      meetingLink?: string;
      hostJoinUrl?: string;
      passcode?: string;
      startTime: Date;
      endTime: Date;
      timezone: string;
      maxParticipants: number;
      isPublicRegistration: boolean;
      customRegistrationFields: any[];
      createdBy: string;
    },
    client?: PoolClient,
  ): Promise<WebinarEntity> {
    const sql = `
      INSERT INTO webinars (
        title, slug, description, short_description, cover_image_url,
        provider, provider_session_id, provider_metadata, meeting_link,
        host_join_url, passcode, start_time, end_time, timezone,
        max_participants, status, is_public_registration,
        custom_registration_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, 'published', $16,
        $17, $18
      )
      RETURNING *;
    `;

    const params = [
      data.title,
      data.slug,
      data.description || null,
      data.shortDescription || null,
      data.coverImageUrl || null,
      data.provider,
      data.providerSessionId || null,
      JSON.stringify(data.providerMetadata || {}),
      data.meetingLink || null,
      data.hostJoinUrl || null,
      data.passcode || null,
      data.startTime,
      data.endTime,
      data.timezone,
      data.maxParticipants,
      data.isPublicRegistration,
      JSON.stringify(data.customRegistrationFields || []),
      data.createdBy,
    ];

    const result = client
      ? await client.query<WebinarEntity>(sql, params)
      : await this.databaseService.executeQuery<WebinarEntity>(sql, params);

    return result.rows[0];
  }

  /**
   * Insert host assignments into webinar_hosts.
   */
  async createWebinarHosts(
    webinarId: string,
    hosts: Array<{ userId: string; hostRole?: WebinarHostRole; displayOrder?: number }>,
    client?: PoolClient,
  ): Promise<void> {
    if (!hosts || hosts.length === 0) return;

    for (const host of hosts) {
      const sql = `
        INSERT INTO webinar_hosts (webinar_id, user_id, host_role, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (webinar_id, user_id) DO UPDATE SET
          host_role = EXCLUDED.host_role,
          display_order = EXCLUDED.display_order;
      `;
      const params = [
        webinarId,
        host.userId,
        host.hostRole || 'primary_host',
        host.displayOrder || 0,
      ];

      if (client) {
        await client.query(sql, params);
      } else {
        await this.databaseService.executeQuery(sql, params);
      }
    }
  }

  /**
   * Find a webinar by ID or Slug (full details).
   */
  async findWebinarById(webinarIdOrSlug: string, client?: PoolClient): Promise<WebinarEntity | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(webinarIdOrSlug);
    const sql = isUuid
      ? `SELECT * FROM webinars WHERE webinar_id = $1 LIMIT 1;`
      : `SELECT * FROM webinars WHERE slug = $1 LIMIT 1;`;
    const result = client
      ? await client.query<WebinarEntity>(sql, [webinarIdOrSlug])
      : await this.databaseService.executeQuery<WebinarEntity>(sql, [webinarIdOrSlug]);

    return result.rows[0] || null;
  }

  /**
   * Find a published webinar by slug for public landing pages (omits private host_join_url).
   */
  async findWebinarBySlug(slug: string): Promise<WebinarEntity | null> {
    const sql = `
      SELECT 
        webinar_id, title, slug, description, short_description,
        cover_image_url, provider, start_time, end_time, timezone,
        max_participants, status, is_public_registration,
        custom_registration_fields, created_at, updated_at
      FROM webinars
      WHERE slug = $1 AND status != 'cancelled'
      LIMIT 1;
    `;
    const result = await this.databaseService.executeQuery<WebinarEntity>(sql, [slug]);
    return result.rows[0] || null;
  }

  /**
   * Find a webinar by meeting provider and provider session ID.
   */
  async findWebinarByProviderSession(provider: string, providerSessionId: string): Promise<WebinarEntity | null> {
    const sql = `
      SELECT * FROM webinars
      WHERE provider = $1 AND provider_session_id = $2
      LIMIT 1;
    `;
    const result = await this.databaseService.executeQuery<WebinarEntity>(sql, [provider, String(providerSessionId)]);
    return result.rows[0] || null;
  }

  /**
   * Find hosts for a webinar with profile information from users & instructor_profiles.
   */
  async findWebinarHosts(webinarId: string): Promise<WebinarHostEntity[]> {
    const sql = `
      SELECT 
        wh.webinar_host_id,
        wh.webinar_id,
        wh.user_id,
        wh.host_role,
        wh.display_order,
        wh.created_at,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(ip.avatar_url, NULL) as avatar_url,
        COALESCE(ip.headline, NULL) as headline
      FROM webinar_hosts wh
      JOIN users u ON u.user_id = wh.user_id
      LEFT JOIN instructor_profiles ip ON ip.user_id = u.user_id
      WHERE wh.webinar_id = $1
      ORDER BY wh.display_order ASC, wh.created_at ASC;
    `;
    const result = await this.databaseService.executeQuery<WebinarHostEntity>(sql, [webinarId]);
    return result.rows;
  }

  /**
   * List upcoming published webinars for public catalog.
   */
  async findPublicWebinars(query: { search?: string; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ["w.status IN ('published', 'scheduled', 'live') AND w.is_public_registration = TRUE"];
    const params: any[] = [];
    let pIdx = 1;

    if (query.search) {
      conditions.push(`(w.title ILIKE $${pIdx} OR w.description ILIKE $${pIdx})`);
      params.push(`%${query.search}%`);
      pIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM webinars w ${whereClause};`;
    const countRes = await this.databaseService.executeQuery(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        w.webinar_id, w.title, w.slug, w.short_description,
        w.cover_image_url, w.provider, w.start_time, w.end_time,
        w.timezone, w.max_participants, w.status, w.is_public_registration,
        (
          SELECT COUNT(*) 
          FROM webinar_registrations wr 
          WHERE wr.webinar_id = w.webinar_id AND wr.status = 'confirmed'
        )::int as confirmed_registrations_count
      FROM webinars w
      ${whereClause}
      ORDER BY w.start_time ASC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const dataRes = await this.databaseService.executeQuery(dataSql, params);
    return { data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * List all webinars for Admin management with registrant metrics.
   */
  async findAdminWebinars(query: { search?: string; status?: WebinarStatus; page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let pIdx = 1;

    if (query.status) {
      if (query.status === 'scheduled') {
        conditions.push(`(w.status = 'scheduled' OR w.status = 'published')`);
      } else {
        conditions.push(`w.status = $${pIdx}`);
        params.push(query.status);
        pIdx++;
      }
    }

    if (query.search) {
      conditions.push(`(w.title ILIKE $${pIdx} OR w.slug ILIKE $${pIdx})`);
      params.push(`%${query.search}%`);
      pIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM webinars w ${whereClause};`;
    const countRes = await this.databaseService.executeQuery(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        w.*,
        u.email as creator_email,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        (
          SELECT COUNT(*) 
          FROM webinar_registrations wr 
          WHERE wr.webinar_id = w.webinar_id AND wr.status = 'confirmed'
        )::int as confirmed_registrations_count,
        (
          SELECT COUNT(DISTINCT wa.webinar_registration_id) 
          FROM webinar_attendances wa 
          WHERE wa.webinar_id = w.webinar_id
        )::int as unique_attendees_count
      FROM webinars w
      JOIN users u ON u.user_id = w.created_by
      ${whereClause}
      ORDER BY w.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const dataRes = await this.databaseService.executeQuery(dataSql, params);
    return { data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Acquire a pessimistic row-level lock on the webinar for atomic capacity enforcement.
   * Supports both UUID and Slug.
   */
  async lockWebinarForRegistration(client: PoolClient, webinarIdOrSlug: string): Promise<WebinarEntity | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(webinarIdOrSlug);
    const sql = isUuid
      ? `SELECT * FROM webinars WHERE webinar_id = $1 FOR UPDATE;`
      : `SELECT * FROM webinars WHERE slug = $1 FOR UPDATE;`;
    const result = await client.query<WebinarEntity>(sql, [webinarIdOrSlug]);
    return result.rows[0] || null;
  }

  /**
   * Count current confirmed registrations for capacity validation within a transaction.
   */
  async countConfirmedRegistrations(client: PoolClient, webinarId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int as count 
      FROM webinar_registrations 
      WHERE webinar_id = $1 AND status = 'confirmed';
    `;
    const result = await client.query(sql, [webinarId]);
    return result.rows[0].count;
  }

  /**
   * Check if email is already registered for this webinar (where status != 'cancelled').
   */
  async findRegistrationByEmail(
    webinarId: string,
    email: string,
    client?: PoolClient,
  ): Promise<WebinarRegistrationEntity | null> {
    const sql = `
      SELECT * 
      FROM webinar_registrations 
      WHERE webinar_id = $1 AND LOWER(email) = LOWER($2) AND status != 'cancelled'
      LIMIT 1;
    `;
    const params = [webinarId, email];
    const result = client
      ? await client.query<WebinarRegistrationEntity>(sql, params)
      : await this.databaseService.executeQuery<WebinarRegistrationEntity>(sql, params);

    return result.rows[0] || null;
  }

  /**
   * Insert a verified public registration record. Decoupled from users table.
   */
  async createRegistration(
    data: {
      webinarId: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      customFieldResponses?: Record<string, any>;
      joinTokenHash: string;
      joinTokenExpiresAt: Date;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      utmTerm?: string;
      utmContent?: string;
      referrer?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    client: PoolClient,
  ): Promise<WebinarRegistrationEntity> {
    const sql = `
      INSERT INTO webinar_registrations (
        webinar_id, first_name, last_name, email, phone_number,
        custom_field_responses, status, join_token_hash, join_token_expires_at,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        referrer, ip_address, user_agent, confirmation_delivery_status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, 'confirmed', $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, 'pending'
      )
      RETURNING *;
    `;

    const params = [
      data.webinarId,
      data.firstName,
      data.lastName,
      data.email,
      data.phoneNumber || null,
      JSON.stringify(data.customFieldResponses || {}),
      data.joinTokenHash,
      data.joinTokenExpiresAt,
      data.utmSource || null,
      data.utmMedium || null,
      data.utmCampaign || null,
      data.utmTerm || null,
      data.utmContent || null,
      data.referrer || null,
      data.ipAddress || null,
      data.userAgent || null,
    ];

    const result = await client.query<WebinarRegistrationEntity>(sql, params);
    return result.rows[0];
  }

  /**
   * Update email confirmation delivery lifecycle.
   */
  async updateRegistrationDeliveryStatus(
    registrationId: string,
    status: DeliveryStatus,
    errorMessage?: string,
    incrementResend = false,
  ): Promise<void> {
    const sql = `
      UPDATE webinar_registrations
      SET 
        confirmation_delivery_status = $2::varchar,
        confirmation_sent_at = CASE WHEN $2::varchar = 'delivered' THEN CURRENT_TIMESTAMP ELSE confirmation_sent_at END,
        confirmation_error_message = $3,
        resend_count = CASE WHEN $4 = true THEN resend_count + 1 ELSE resend_count END,
        updated_at = CURRENT_TIMESTAMP
      WHERE webinar_registration_id = $1;
    `;
    await this.databaseService.executeQuery(sql, [
      registrationId,
      status,
      errorMessage || null,
      incrementResend,
    ]);
  }

  /**
   * Record the outcome of registering an attendee with the meeting provider.
   */
  async updateRegistrationProviderSync(
    registrationId: string,
    result:
      | { status: 'synced'; registrantId?: string; joinUrl: string }
      | { status: 'failed'; error: string },
  ): Promise<void> {
    if (result.status === 'synced') {
      await this.databaseService.executeQuery(
        `UPDATE webinar_registrations
         SET provider_sync_status = 'synced',
             provider_registrant_id = $2,
             provider_join_url = $3,
             provider_sync_error = NULL,
             provider_sync_attempts = provider_sync_attempts + 1,
             provider_synced_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE webinar_registration_id = $1;`,
        [registrationId, result.registrantId || null, result.joinUrl],
      );
      return;
    }

    await this.databaseService.executeQuery(
      `UPDATE webinar_registrations
       SET provider_sync_status = 'failed',
           provider_sync_error = $2,
           provider_sync_attempts = provider_sync_attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE webinar_registration_id = $1;`,
      [registrationId, result.error.slice(0, 1000)],
    );
  }

  /**
   * Mark a webinar's provider meeting as restricted to approved registrants.
   */
  async markProviderRegistrationEnforced(webinarId: string): Promise<void> {
    await this.databaseService.executeQuery(
      `UPDATE webinars
       SET provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || '{"registrationEnforced": true}'::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE webinar_id = $1;`,
      [webinarId],
    );
  }

  /**
   * Look up registration by join token hash.
   */
  async findRegistrationByJoinTokenHash(joinTokenHash: string): Promise<WebinarRegistrationEntity | null> {
    const sql = `
      SELECT * 
      FROM webinar_registrations 
      WHERE join_token_hash = $1 AND status = 'confirmed'
      LIMIT 1;
    `;
    const result = await this.databaseService.executeQuery<WebinarRegistrationEntity>(sql, [joinTokenHash]);
    return result.rows[0] || null;
  }

  /**
   * Record participant join attendance interval.
   */
  async createAttendanceInterval(data: {
    webinarId: string;
    webinarRegistrationId: string;
    email: string;
    displayName: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<WebinarAttendanceEntity> {
    const sql = `
      INSERT INTO webinar_attendances (
        webinar_id, webinar_registration_id, email, display_name,
        joined_at, ip_address, user_agent
      ) VALUES (
        $1, $2, $3, $4,
        CURRENT_TIMESTAMP, $5, $6
      )
      RETURNING *;
    `;
    const params = [
      data.webinarId,
      data.webinarRegistrationId,
      data.email,
      data.displayName,
      data.ipAddress || null,
      data.userAgent || null,
    ];

    const result = await this.databaseService.executeQuery<WebinarAttendanceEntity>(sql, params);
    return result.rows[0];
  }

  /**
   * Close active attendance interval when participant leaves.
   */
  async closeAttendanceInterval(attendanceId: string): Promise<void> {
    const sql = `
      UPDATE webinar_attendances
      SET 
        left_at = CURRENT_TIMESTAMP,
        duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::int)
      WHERE webinar_attendance_id = $1 AND left_at IS NULL;
    `;
    await this.databaseService.executeQuery(sql, [attendanceId]);
  }

  /**
   * Find open attendance interval for registration.
   */
  async findActiveAttendance(registrationId: string): Promise<WebinarAttendanceEntity | null> {
    const sql = `
      SELECT * 
      FROM webinar_attendances 
      WHERE webinar_registration_id = $1 AND left_at IS NULL
      ORDER BY joined_at DESC
      LIMIT 1;
    `;
    const result = await this.databaseService.executeQuery<WebinarAttendanceEntity>(sql, [registrationId]);
    return result.rows[0] || null;
  }

  /**
   * Update webinar metadata.
   */
  async updateWebinar(
    webinarId: string,
    updates: Partial<{
      title: string;
      description: string;
      shortDescription: string;
      coverImageUrl: string;
      startTime: Date;
      endTime: Date;
      timezone: string;
      maxParticipants: number;
      isPublicRegistration: boolean;
      customRegistrationFields: any[];
    }>,
    client?: PoolClient,
  ): Promise<WebinarEntity> {
    const setClauses: string[] = [];
    const params: any[] = [webinarId];
    let pIdx = 2;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${pIdx++}`);
      params.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${pIdx++}`);
      params.push(updates.description);
    }
    if (updates.shortDescription !== undefined) {
      setClauses.push(`short_description = $${pIdx++}`);
      params.push(updates.shortDescription);
    }
    if (updates.coverImageUrl !== undefined) {
      setClauses.push(`cover_image_url = $${pIdx++}`);
      params.push(updates.coverImageUrl);
    }
    if (updates.startTime !== undefined) {
      setClauses.push(`start_time = $${pIdx++}`);
      params.push(updates.startTime);
    }
    if (updates.endTime !== undefined) {
      setClauses.push(`end_time = $${pIdx++}`);
      params.push(updates.endTime);
    }
    if (updates.timezone !== undefined) {
      setClauses.push(`timezone = $${pIdx++}`);
      params.push(updates.timezone);
    }
    if (updates.maxParticipants !== undefined) {
      setClauses.push(`max_participants = $${pIdx++}`);
      params.push(updates.maxParticipants);
    }
    if (updates.isPublicRegistration !== undefined) {
      setClauses.push(`is_public_registration = $${pIdx++}`);
      params.push(updates.isPublicRegistration);
    }
    if (updates.customRegistrationFields !== undefined) {
      setClauses.push(`custom_registration_fields = $${pIdx++}`);
      params.push(JSON.stringify(updates.customRegistrationFields));
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
      UPDATE webinars
      SET ${setClauses.join(', ')}
      WHERE webinar_id = $1
      RETURNING *;
    `;

    const result = client
      ? await client.query<WebinarEntity>(sql, params)
      : await this.databaseService.executeQuery<WebinarEntity>(sql, params);

    return result.rows[0];
  }

  /**
   * Update webinar status (e.g. live, completed, cancelled).
   */
  async updateWebinarStatus(
    webinarId: string,
    status: WebinarStatus,
    extra?: { cancellationReason?: string; cancelledAt?: Date },
    client?: PoolClient,
  ): Promise<WebinarEntity> {
    const sql = `
      UPDATE webinars
      SET 
        status = $2,
        cancellation_reason = COALESCE($3, cancellation_reason),
        cancelled_at = COALESCE($4, cancelled_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE webinar_id = $1
      RETURNING *;
    `;
    const params = [
      webinarId,
      status,
      extra?.cancellationReason || null,
      extra?.cancelledAt || null,
    ];

    const result = client
      ? await client.query<WebinarEntity>(sql, params)
      : await this.databaseService.executeQuery<WebinarEntity>(sql, params);

    return result.rows[0];
  }

  /**
   * Replace all hosts for a webinar.
   */
  async replaceWebinarHosts(
    webinarId: string,
    hosts: Array<{ userId: string; hostRole?: WebinarHostRole; displayOrder?: number }>,
    client?: PoolClient,
  ): Promise<void> {
    const deleteSql = `DELETE FROM webinar_hosts WHERE webinar_id = $1;`;
    if (client) {
      await client.query(deleteSql, [webinarId]);
    } else {
      await this.databaseService.executeQuery(deleteSql, [webinarId]);
    }

    await this.createWebinarHosts(webinarId, hosts, client);
  }

  /**
   * Fetch all registrants for admin review.
   */
  async findRegistrationsByWebinarId(
    webinarId: string,
    query: { page?: number; limit?: number; status?: string },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['wr.webinar_id = $1'];
    const params: any[] = [webinarId];
    let pIdx = 2;

    if (query.status) {
      conditions.push(`wr.status = $${pIdx++}`);
      params.push(query.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as total FROM webinar_registrations wr ${whereClause};`;
    const countRes = await this.databaseService.executeQuery(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        wr.*,
        TRIM(CONCAT(wr.first_name, ' ', COALESCE(wr.last_name, ''))) as full_name,
        wr.phone_number as phone,
        ROUND(COALESCE((SELECT SUM(wa.duration_seconds) FROM webinar_attendances wa WHERE wa.webinar_registration_id = wr.webinar_registration_id), 0) / 60.0)::int as total_duration_minutes,
        COALESCE(
          (SELECT SUM(wa.duration_seconds) FROM webinar_attendances wa WHERE wa.webinar_registration_id = wr.webinar_registration_id),
          0
        )::int as total_attendance_seconds,
        COALESCE(
          (SELECT COUNT(*) FROM webinar_attendances wa WHERE wa.webinar_registration_id = wr.webinar_registration_id),
          0
        )::int as join_intervals_count,
        CASE 
          WHEN wr.confirmation_sent_at IS NOT NULL THEN 'delivered'
          ELSE 'pending'
        END as confirmation_delivery_status
      FROM webinar_registrations wr
      ${whereClause}
      ORDER BY wr.created_at DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const dataRes = await this.databaseService.executeQuery(dataSql, params);
    // Personal join links and token hashes are credentials: never send them to the admin UI.
    const data = dataRes.rows.map(({ provider_join_url, join_token_hash, ...row }: any) => row);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Fetch confirmed registrants for email notifications (reschedule, cancellation).
   */
  async findConfirmedRegistrants(webinarId: string): Promise<WebinarRegistrationEntity[]> {
    const sql = `
      SELECT * 
      FROM webinar_registrations 
      WHERE webinar_id = $1 AND status = 'confirmed'
      ORDER BY created_at ASC;
    `;
    const result = await this.databaseService.executeQuery<WebinarRegistrationEntity>(sql, [webinarId]);
    return result.rows;
  }

  /**
   * Record audit log entry.
   */
  async createAuditLog(
    data: {
      webinarId?: string;
      actorId?: string;
      actorRole?: string;
      action: string;
      details?: Record<string, any>;
      ipAddress?: string;
    },
    client?: PoolClient,
  ): Promise<void> {
    const sql = `
      INSERT INTO webinar_audit_logs (
        webinar_id, actor_id, actor_role, action, details, ip_address
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      );
    `;
    const params = [
      data.webinarId || null,
      data.actorId || null,
      data.actorRole || null,
      data.action,
      JSON.stringify(data.details || {}),
      data.ipAddress || null,
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await this.databaseService.executeQuery(sql, params);
    }
  }

  /**
   * Marketing Attribution & Attendance Analytics.
   */
  async getAttributionAnalytics(webinarId: string) {
    const sourcesSql = `
      SELECT 
        COALESCE(utm_source, 'unspecified') as utm_source,
        COUNT(*)::int as registrations_count,
        COUNT(DISTINCT wa.webinar_registration_id)::int as attended_count
      FROM webinar_registrations wr
      LEFT JOIN webinar_attendances wa ON wa.webinar_registration_id = wr.webinar_registration_id
      WHERE wr.webinar_id = $1 AND wr.status = 'confirmed'
      GROUP BY COALESCE(utm_source, 'unspecified')
      ORDER BY registrations_count DESC;
    `;

    const campaignsSql = `
      SELECT 
        COALESCE(utm_campaign, 'unspecified') as utm_campaign,
        COUNT(*)::int as registrations_count
      FROM webinar_registrations
      WHERE webinar_id = $1 AND status = 'confirmed'
      GROUP BY COALESCE(utm_campaign, 'unspecified')
      ORDER BY registrations_count DESC;
    `;

    const mediumsSql = `
      SELECT 
        COALESCE(utm_medium, 'unspecified') as utm_medium,
        COUNT(*)::int as registrations_count
      FROM webinar_registrations
      WHERE webinar_id = $1 AND status = 'confirmed'
      GROUP BY COALESCE(utm_medium, 'unspecified')
      ORDER BY registrations_count DESC;
    `;

    const summarySql = `
      SELECT 
        COUNT(*)::int as total_registrations,
        COUNT(DISTINCT wa.webinar_registration_id)::int as total_attendees,
        COALESCE(SUM(wa.duration_seconds), 0)::int as total_attended_seconds,
        COALESCE(AVG(wa.duration_seconds), 0)::int as avg_attended_seconds
      FROM webinar_registrations wr
      LEFT JOIN webinar_attendances wa ON wa.webinar_registration_id = wr.webinar_registration_id
      WHERE wr.webinar_id = $1 AND wr.status = 'confirmed';
    `;

    const [sourcesRes, campaignsRes, mediumsRes, summaryRes] = await Promise.all([
      this.databaseService.executeQuery(sourcesSql, [webinarId]),
      this.databaseService.executeQuery(campaignsSql, [webinarId]),
      this.databaseService.executeQuery(mediumsSql, [webinarId]),
      this.databaseService.executeQuery(summarySql, [webinarId]),
    ]);

    return {
      summary: summaryRes.rows[0],
      bySource: sourcesRes.rows,
      byCampaign: campaignsRes.rows,
      byMedium: mediumsRes.rows,
    };
  }
}

import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { normalizeMobile, detectCountry, renderTemplate } from './utils/sms.utils';

export interface AudienceRecipient {
  registrationId?: string;
  userId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  rawPhone: string | null;
  normalizedPhone: string | null;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  isValidPhone: boolean;
  contextValues: Record<string, string>;
}

export interface AudiencePreviewResult {
  targetType: string;
  targetId?: string;
  targetTitle?: string;
  totalAudience: number;
  validPhoneCount: number;
  missingPhoneCount: number;
  countryDistribution: Array<{ code: string; name: string; flag: string; count: number }>;
  recipients: AudienceRecipient[];
}

@Injectable()
export class SmsAudienceService {
  private readonly logger = new Logger(SmsAudienceService.name);

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  /**
   * List available webinars for audience targeting with registrant & phone counts.
   */
  async listWebinarAudiences(): Promise<any[]> {
    const sql = `
      SELECT w.webinar_id, w.title, w.slug, w.start_time, w.end_time, w.status, w.provider,
             COUNT(r.webinar_registration_id) AS total_registrations,
             COUNT(r.phone_number) FILTER (WHERE r.phone_number IS NOT NULL AND TRIM(r.phone_number) != '') AS total_with_phone
      FROM webinars w
      LEFT JOIN webinar_registrations r ON w.webinar_id = r.webinar_id AND r.status = 'confirmed'
      GROUP BY w.webinar_id
      ORDER BY w.start_time DESC
      LIMIT 100
    `;
    const res = await this.databaseService.executeQuery<any>(sql);
    return res.rows.map((row) => ({
      webinarId: row.webinar_id,
      title: row.title,
      slug: row.slug,
      startTime: row.start_time,
      status: row.status,
      provider: row.provider,
      totalRegistrations: parseInt(row.total_registrations || '0', 10),
      totalWithPhone: parseInt(row.total_with_phone || '0', 10),
    }));
  }

  /**
   * Fetch and resolve webinar registrants for campaign dispatching.
   */
  async resolveWebinarAudience(webinarId: string, defaultCountryCode: string = '91'): Promise<AudiencePreviewResult> {
    const webinarSql = `SELECT * FROM webinars WHERE webinar_id = $1`;
    const webinarRes = await this.databaseService.executeQuery<any>(webinarSql, [webinarId]);
    const webinar = webinarRes.rows[0];
    if (!webinar) {
      throw new NotFoundException(`Webinar with ID '${webinarId}' not found.`);
    }

    const regSql = `
      SELECT webinar_registration_id, first_name, last_name, email, phone_number, status, created_at
      FROM webinar_registrations
      WHERE webinar_id = $1 AND status = 'confirmed'
      ORDER BY created_at ASC
    `;
    const regRes = await this.databaseService.executeQuery<any>(regSql, [webinarId]);

    const formattedStartTime = new Date(webinar.start_time).toLocaleString('en-US', {
      timeZone: webinar.timezone || 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const countryMap = new Map<string, { code: string; name: string; flag: string; count: number }>();
    const recipients: AudienceRecipient[] = [];
    let validCount = 0;
    let missingCount = 0;

    for (const reg of regRes.rows) {
      const normalized = normalizeMobile(reg.phone_number, defaultCountryCode);
      const isValid = Boolean(normalized);
      if (isValid) validCount++;
      else missingCount++;

      const country = detectCountry(normalized || reg.phone_number);
      const countryKey = country.code || 'unknown';
      if (!countryMap.has(countryKey)) {
        countryMap.set(countryKey, { code: country.code, name: country.name, flag: country.flag, count: 0 });
      }
      countryMap.get(countryKey)!.count += 1;

      const fullName = `${reg.first_name} ${reg.last_name || ''}`.trim();
      const contextValues: Record<string, string> = {
        name: fullName,
        firstName: reg.first_name,
        lastName: reg.last_name || '',
        phone: normalized || reg.phone_number || '',
        email: reg.email,
        webinar_title: webinar.title,
        meeting_link: webinar.meeting_link || `https://elevate.edu/webinars/${webinar.slug}`,
        start_time: formattedStartTime,
      };

      recipients.push({
        registrationId: reg.webinar_registration_id,
        firstName: reg.first_name,
        lastName: reg.last_name || '',
        fullName,
        email: reg.email,
        rawPhone: reg.phone_number,
        normalizedPhone: normalized,
        countryCode: country.code,
        countryName: country.name,
        countryFlag: country.flag,
        isValidPhone: isValid,
        contextValues,
      });
    }

    const countryDistribution = Array.from(countryMap.values()).sort((a, b) => b.count - a.count);

    return {
      targetType: 'webinar_registrants',
      targetId: webinarId,
      targetTitle: webinar.title,
      totalAudience: recipients.length,
      validPhoneCount: validCount,
      missingPhoneCount: missingCount,
      countryDistribution,
      recipients,
    };
  }
}


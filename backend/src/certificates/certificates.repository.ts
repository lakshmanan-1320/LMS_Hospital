import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface IssuedCertificateEntity {
  certificate_id: string;
  certificate_number: string;
  certificate_type: 'course_completion' | 'webinar_participation';
  student_id: string;
  course_id?: string | null;
  webinar_id?: string | null;
  template_id?: string | null;
  student_name_snapshot: string;
  course_name_snapshot?: string | null;
  webinar_name_snapshot?: string | null;
  instructor_name_snapshot?: string | null;
  completion_or_event_date: Date;
  issued_at: Date;
  certificate_file_storage_key: string;
  verification_token_hash: string;
  status: 'valid' | 'revoked';
  revocation_reason?: string | null;
  revoked_by?: string | null;
  revoked_at?: Date | null;
  reissued_from_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CertificateTemplateEntity {
  template_id: string;
  name: string;
  certificate_type: 'course_completion' | 'webinar_participation';
  description?: string | null;
  template_configuration: Record<string, any>;
  logo_storage_key?: string | null;
  signature_storage_key?: string | null;
  is_default: boolean;
  status: 'active' | 'archived';
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WebinarCertificateSettingEntity {
  setting_id: string;
  webinar_id: string;
  enabled: boolean;
  minimum_attendance_percentage: number;
  minimum_attendance_minutes?: number | null;
  template_id?: string | null;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class CertificatesRepository {
  constructor(private readonly db: DatabaseService) {}

  // ==========================================
  // TEMPLATES
  // ==========================================

  async createTemplate(data: {
    name: string;
    certificateType: 'course_completion' | 'webinar_participation';
    description?: string;
    templateConfiguration?: Record<string, any>;
    logoStorageKey?: string;
    signatureStorageKey?: string;
    isDefault?: boolean;
    createdBy?: string;
  }): Promise<CertificateTemplateEntity> {
    if (data.isDefault) {
      await this.db.executeQuery(
        `UPDATE certificate_templates
         SET is_default = false
         WHERE certificate_type = $1`,
        [data.certificateType],
      );
    }

    const res = await this.db.executeQuery<CertificateTemplateEntity>(
      `INSERT INTO certificate_templates (
        name,
        certificate_type,
        description,
        template_configuration,
        logo_storage_key,
        signature_storage_key,
        is_default,
        status,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
      RETURNING *`,
      [
        data.name,
        data.certificateType,
        data.description || null,
        JSON.stringify(data.templateConfiguration || {}),
        data.logoStorageKey || null,
        data.signatureStorageKey || null,
        Boolean(data.isDefault),
        data.createdBy || null,
      ],
    );

    return res.rows[0];
  }

  async updateTemplate(
    templateId: string,
    data: {
      name?: string;
      description?: string;
      templateConfiguration?: Record<string, any>;
      logoStorageKey?: string;
      signatureStorageKey?: string;
      isDefault?: boolean;
      status?: 'active' | 'archived';
    },
  ): Promise<CertificateTemplateEntity | null> {
    const current = await this.findTemplateById(templateId);
    if (!current) return null;

    if (data.isDefault) {
      await this.db.executeQuery(
        `UPDATE certificate_templates
         SET is_default = false
         WHERE certificate_type = $1 AND template_id != $2`,
        [current.certificate_type, templateId],
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.templateConfiguration !== undefined) {
      updates.push(`template_configuration = $${idx++}`);
      values.push(JSON.stringify(data.templateConfiguration));
    }
    if (data.logoStorageKey !== undefined) {
      updates.push(`logo_storage_key = $${idx++}`);
      values.push(data.logoStorageKey);
    }
    if (data.signatureStorageKey !== undefined) {
      updates.push(`signature_storage_key = $${idx++}`);
      values.push(data.signatureStorageKey);
    }
    if (data.isDefault !== undefined) {
      updates.push(`is_default = $${idx++}`);
      values.push(data.isDefault);
    }
    if (data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(data.status);
    }

    if (updates.length === 0) return current;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(templateId);

    const res = await this.db.executeQuery<CertificateTemplateEntity>(
      `UPDATE certificate_templates
       SET ${updates.join(', ')}
       WHERE template_id = $${idx}
       RETURNING *`,
      values,
    );

    return res.rows[0] || null;
  }

  async findTemplateById(templateId: string): Promise<CertificateTemplateEntity | null> {
    const res = await this.db.executeQuery<CertificateTemplateEntity>(
      `SELECT * FROM certificate_templates WHERE template_id = $1`,
      [templateId],
    );
    return res.rows[0] || null;
  }

  async findDefaultTemplate(
    type: 'course_completion' | 'webinar_participation',
  ): Promise<CertificateTemplateEntity | null> {
    const res = await this.db.executeQuery<CertificateTemplateEntity>(
      `SELECT * FROM certificate_templates
       WHERE certificate_type = $1 AND status = 'active'
       ORDER BY is_default DESC, created_at ASC
       LIMIT 1`,
      [type],
    );
    return res.rows[0] || null;
  }

  async listTemplates(certificateType?: string): Promise<CertificateTemplateEntity[]> {
    let query = `SELECT * FROM certificate_templates WHERE status != 'archived'`;
    const params: any[] = [];
    if (certificateType && certificateType !== 'all') {
      params.push(certificateType);
      query += ` AND certificate_type = $1`;
    }
    query += ` ORDER BY is_default DESC, created_at DESC`;

    const res = await this.db.executeQuery<CertificateTemplateEntity>(query, params);
    return res.rows;
  }

  // ==========================================
  // WEBINAR SETTINGS
  // ==========================================

  async getWebinarSettings(webinarId: string): Promise<WebinarCertificateSettingEntity | null> {
    const res = await this.db.executeQuery<WebinarCertificateSettingEntity>(
      `SELECT * FROM webinar_certificate_settings WHERE webinar_id = $1`,
      [webinarId],
    );
    return res.rows[0] || null;
  }

  async upsertWebinarSettings(
    webinarId: string,
    data: {
      enabled: boolean;
      minimumAttendancePercentage?: number;
      minimumAttendanceMinutes?: number;
      templateId?: string;
      createdBy?: string;
    },
  ): Promise<WebinarCertificateSettingEntity> {
    const res = await this.db.executeQuery<WebinarCertificateSettingEntity>(
      `INSERT INTO webinar_certificate_settings (
        webinar_id,
        enabled,
        minimum_attendance_percentage,
        minimum_attendance_minutes,
        template_id,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (webinar_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        minimum_attendance_percentage = EXCLUDED.minimum_attendance_percentage,
        minimum_attendance_minutes = EXCLUDED.minimum_attendance_minutes,
        template_id = EXCLUDED.template_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        webinarId,
        data.enabled,
        data.minimumAttendancePercentage ?? 75.0,
        data.minimumAttendanceMinutes ?? null,
        data.templateId || null,
        data.createdBy || null,
      ],
    );

    return res.rows[0];
  }

  // ==========================================
  // ISSUED CERTIFICATES
  // ==========================================

  async findCertificateById(certificateId: string): Promise<IssuedCertificateEntity | null> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `SELECT * FROM issued_certificates WHERE certificate_id = $1`,
      [certificateId],
    );
    return res.rows[0] || null;
  }

  async findValidCertificateByCourse(
    studentId: string,
    courseId: string,
  ): Promise<IssuedCertificateEntity | null> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `SELECT * FROM issued_certificates
       WHERE student_id = $1 AND course_id = $2 AND certificate_type = 'course_completion' AND status = 'valid'
       LIMIT 1`,
      [studentId, courseId],
    );
    return res.rows[0] || null;
  }

  async findValidCertificateByWebinar(
    studentId: string,
    webinarId: string,
  ): Promise<IssuedCertificateEntity | null> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `SELECT * FROM issued_certificates
       WHERE student_id = $1 AND webinar_id = $2 AND certificate_type = 'webinar_participation' AND status = 'valid'
       LIMIT 1`,
      [studentId, webinarId],
    );
    return res.rows[0] || null;
  }

  async findCertificateByTokenHash(
    tokenHash: string,
  ): Promise<IssuedCertificateEntity | null> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `SELECT * FROM issued_certificates WHERE verification_token_hash = $1`,
      [tokenHash],
    );
    return res.rows[0] || null;
  }

  async createCertificate(data: {
    certificateNumber: string;
    certificateType: 'course_completion' | 'webinar_participation';
    studentId: string;
    courseId?: string;
    webinarId?: string;
    templateId?: string;
    studentNameSnapshot: string;
    courseNameSnapshot?: string;
    webinarNameSnapshot?: string;
    instructorNameSnapshot?: string;
    completionOrEventDate: Date;
    certificateFileStorageKey: string;
    verificationTokenHash: string;
    reissuedFromId?: string;
  }): Promise<IssuedCertificateEntity> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `INSERT INTO issued_certificates (
        certificate_number,
        certificate_type,
        student_id,
        course_id,
        webinar_id,
        template_id,
        student_name_snapshot,
        course_name_snapshot,
        webinar_name_snapshot,
        instructor_name_snapshot,
        completion_or_event_date,
        certificate_file_storage_key,
        verification_token_hash,
        status,
        reissued_from_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'valid', $14)
      RETURNING *`,
      [
        data.certificateNumber,
        data.certificateType,
        data.studentId,
        data.courseId || null,
        data.webinarId || null,
        data.templateId || null,
        data.studentNameSnapshot,
        data.courseNameSnapshot || null,
        data.webinarNameSnapshot || null,
        data.instructorNameSnapshot || null,
        data.completionOrEventDate,
        data.certificateFileStorageKey,
        data.verificationTokenHash,
        data.reissuedFromId || null,
      ],
    );

    return res.rows[0];
  }

  async revokeCertificate(
    certificateId: string,
    revokedBy: string,
    reason: string,
  ): Promise<IssuedCertificateEntity | null> {
    const res = await this.db.executeQuery<IssuedCertificateEntity>(
      `UPDATE issued_certificates
       SET status = 'revoked',
           revocation_reason = $1,
           revoked_by = $2,
           revoked_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE certificate_id = $3 AND status = 'valid'
       RETURNING *`,
      [reason, revokedBy, certificateId],
    );

    return res.rows[0] || null;
  }

  async listStudentCertificates(
    studentId: string,
    query: {
      certificateType?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ data: any[]; total: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['c.student_id = $1'];
    const params: any[] = [studentId];
    let idx = 2;

    if (query.certificateType && query.certificateType !== 'all') {
      conditions.push(`c.certificate_type = $${idx++}`);
      params.push(query.certificateType);
    }

    if (query.search && query.search.trim()) {
      conditions.push(
        `(c.certificate_number ILIKE $${idx} OR c.course_name_snapshot ILIKE $${idx} OR c.webinar_name_snapshot ILIKE $${idx})`,
      );
      params.push(`%${query.search.trim()}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.db.executeQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM issued_certificates c
       ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listQuery = `
      SELECT
        c.certificate_id AS "certificateId",
        c.certificate_number AS "certificateNumber",
        c.certificate_type AS "certificateType",
        c.student_id AS "studentId",
        c.course_id AS "courseId",
        c.webinar_id AS "webinarId",
        c.student_name_snapshot AS "studentNameSnapshot",
        c.course_name_snapshot AS "courseNameSnapshot",
        c.webinar_name_snapshot AS "webinarNameSnapshot",
        COALESCE(c.course_name_snapshot, c.webinar_name_snapshot) AS "subjectTitle",
        c.instructor_name_snapshot AS "instructorNameSnapshot",
        c.completion_or_event_date AS "completionOrEventDate",
        c.issued_at AS "issuedAt",
        c.status,
        c.revocation_reason AS "revocationReason",
        c.revoked_at AS "revokedAt",
        c.reissued_from_id AS "reissuedFromId"
      FROM issued_certificates c
      ${whereClause}
      ORDER BY c.issued_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(limit, offset);
    const listRes = await this.db.executeQuery(listQuery, params);

    return {
      data: listRes.rows,
      total,
    };
  }

  async listAdminCertificates(query: {
    search?: string;
    certificateType?: string;
    status?: string;
    courseId?: string;
    webinarId?: string;
    page?: number;
    limit?: number;
    instructorId?: string;
  }): Promise<{ data: any[]; total: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (query.instructorId) {
      conditions.push(
        `((c.course_id IS NOT NULL AND c.course_id IN (SELECT course_id FROM courses WHERE instructor_id = $${idx}))
         OR
         (c.webinar_id IS NOT NULL AND (
            c.webinar_id IN (SELECT webinar_id FROM webinar_hosts WHERE user_id = $${idx})
            OR c.webinar_id IN (SELECT webinar_id FROM webinars WHERE created_by = $${idx})
         )))`,
      );
      params.push(query.instructorId);
      idx++;
    }

    if (query.certificateType && query.certificateType !== 'all') {
      conditions.push(`c.certificate_type = $${idx++}`);
      params.push(query.certificateType);
    }

    if (query.status && query.status !== 'all') {
      conditions.push(`c.status = $${idx++}`);
      params.push(query.status);
    }

    if (query.courseId) {
      conditions.push(`c.course_id = $${idx++}`);
      params.push(query.courseId);
    }

    if (query.webinarId) {
      conditions.push(`c.webinar_id = $${idx++}`);
      params.push(query.webinarId);
    }

    if (query.search && query.search.trim()) {
      conditions.push(
        `(c.certificate_number ILIKE $${idx} OR c.student_name_snapshot ILIKE $${idx} OR u.email ILIKE $${idx} OR c.course_name_snapshot ILIKE $${idx} OR c.webinar_name_snapshot ILIKE $${idx})`,
      );
      params.push(`%${query.search.trim()}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await this.db.executeQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM issued_certificates c
       JOIN users u ON c.student_id = u.user_id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const listQuery = `
      SELECT
        c.certificate_id AS "certificateId",
        c.certificate_number AS "certificateNumber",
        c.certificate_type AS "certificateType",
        c.student_id AS "studentId",
        u.email AS "studentEmail",
        c.course_id AS "courseId",
        c.webinar_id AS "webinarId",
        c.student_name_snapshot AS "studentNameSnapshot",
        c.course_name_snapshot AS "courseNameSnapshot",
        c.webinar_name_snapshot AS "webinarNameSnapshot",
        COALESCE(c.course_name_snapshot, c.webinar_name_snapshot) AS "subjectTitle",
        c.instructor_name_snapshot AS "instructorNameSnapshot",
        c.completion_or_event_date AS "completionOrEventDate",
        c.issued_at AS "issuedAt",
        c.status,
        c.revocation_reason AS "revocationReason",
        c.revoked_at AS "revokedAt",
        c.reissued_from_id AS "reissuedFromId"
      FROM issued_certificates c
      JOIN users u ON c.student_id = u.user_id
      ${whereClause}
      ORDER BY c.issued_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    params.push(limit, offset);
    const listRes = await this.db.executeQuery(listQuery, params);

    return {
      data: listRes.rows,
      total,
    };
  }

  async getOverviewStats(): Promise<{
    totalIssued: number;
    totalCourseCertificates: number;
    totalWebinarCertificates: number;
    totalRevoked: number;
  }> {
    const res = await this.db.executeQuery<{
      total_issued: string;
      total_course: string;
      total_webinar: string;
      total_revoked: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_issued,
        COUNT(*) FILTER (WHERE certificate_type = 'course_completion')::text AS total_course,
        COUNT(*) FILTER (WHERE certificate_type = 'webinar_participation')::text AS total_webinar,
        COUNT(*) FILTER (WHERE status = 'revoked')::text AS total_revoked
      FROM issued_certificates
    `);

    const row = res.rows[0];
    return {
      totalIssued: parseInt(row?.total_issued || '0', 10),
      totalCourseCertificates: parseInt(row?.total_course || '0', 10),
      totalWebinarCertificates: parseInt(row?.total_webinar || '0', 10),
      totalRevoked: parseInt(row?.total_revoked || '0', 10),
    };
  }

  // ==========================================
  // SNAPSHOT & WEBINAR HELPERS
  // ==========================================

  async calculateCourseCompletion(
    studentId: string,
    courseId: string,
  ): Promise<{
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    isCourseCompleted: boolean;
  }> {
    // Check if the enrollment is already officially marked as completed
    const enrollmentResult = await this.db.executeQuery<{ enrollment_status: string }>(
      `SELECT enrollment_status FROM course_enrollments
       WHERE student_id = $1 AND course_id = $2
       ORDER BY enrolled_at DESC LIMIT 1`,
      [studentId, courseId],
    );
    const isEnrollmentCompleted = enrollmentResult.rows[0]?.enrollment_status === 'completed';

    const totalResult = await this.db.executeQuery<{ total: string }>(
      `SELECT COUNT(l.lesson_id) AS total
       FROM course_lessons l
       INNER JOIN course_sections s ON s.section_id = l.section_id
       WHERE l.course_id = $1
         AND l.is_active = TRUE
         AND s.is_active = TRUE
         AND COALESCE(l.is_optional, FALSE) = FALSE`,
      [courseId],
    );

    const completedResult = await this.db.executeQuery<{ completed: string }>(
      `SELECT COUNT(p.progress_id) AS completed
       FROM student_lesson_progress p
       INNER JOIN course_lessons l ON l.lesson_id = p.lesson_id
       INNER JOIN course_sections s ON s.section_id = l.section_id
       WHERE p.student_id = $1
         AND p.course_id = $2
         AND p.is_completed = TRUE
         AND l.is_active = TRUE
         AND s.is_active = TRUE
         AND COALESCE(l.is_optional, FALSE) = FALSE`,
      [studentId, courseId],
    );

    const total = Number(totalResult.rows[0]?.total || 0);
    const completed = Number(completedResult.rows[0]?.completed || 0);
    const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : (isEnrollmentCompleted ? 100 : 0);

    return {
      totalLessons: total,
      completedLessons: isEnrollmentCompleted && total > 0 && completed < total ? total : completed,
      completionPercentage: isEnrollmentCompleted ? 100 : percentage,
      isCourseCompleted: isEnrollmentCompleted || (total > 0 && completed >= total),
    };
  }

  async findCompletedCoursesMissingCertificates(studentId: string): Promise<string[]> {
    const res = await this.db.executeQuery<{ course_id: string }>(
      `SELECT DISTINCT e.course_id
       FROM course_enrollments e
       LEFT JOIN issued_certificates c
         ON c.student_id = e.student_id
         AND c.course_id = e.course_id
         AND c.certificate_type = 'course_completion'
         AND c.status = 'valid'
       WHERE e.student_id = $1
         AND e.enrollment_status = 'completed'
         AND c.certificate_id IS NULL`,
      [studentId],
    );
    return res.rows.map((r) => r.course_id);
  }

  async getStudentSnapshot(studentId: string): Promise<{ name: string; email: string } | null> {
    const res = await this.db.executeQuery<{ first_name: string; last_name: string; email: string }>(
      `SELECT first_name, last_name, email FROM users WHERE user_id = $1`,
      [studentId],
    );
    if (!res.rows[0]) return null;
    const { first_name, last_name, email } = res.rows[0];
    return {
      name: `${first_name || ''} ${last_name || ''}`.trim() || 'Learner',
      email,
    };
  }

  async getCourseSnapshot(courseId: string): Promise<{
    title: string;
    instructorName: string;
  } | null> {
    const res = await this.db.executeQuery<{
      title: string;
      instructor_first: string;
      instructor_last: string;
    }>(
      `SELECT
         c.title,
         u.first_name AS instructor_first,
         u.last_name AS instructor_last
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.user_id
       WHERE c.course_id = $1`,
      [courseId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      title: row.title,
      instructorName: `${row.instructor_first || ''} ${row.instructor_last || ''}`.trim() || 'LMS Faculty',
    };
  }

  async getWebinarSnapshot(webinarId: string): Promise<{
    title: string;
    status: string;
    instructorName: string;
    eventDate: Date;
    durationMinutes: number;
    durationSeconds: number;
  } | null> {
    const res = await this.db.executeQuery<{
      title: string;
      status: string;
      instructor_first: string;
      instructor_last: string;
      start_time: Date;
      end_time: Date;
      duration_minutes: number;
    }>(
      `SELECT
         w.title,
         w.status,
         w.start_time,
         w.end_time,
         w.duration_minutes,
         u.first_name AS instructor_first,
         u.last_name AS instructor_last
       FROM webinars w
       LEFT JOIN users u ON w.created_by = u.user_id
       WHERE w.webinar_id = $1`,
      [webinarId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    let durationSec = 0;
    if (row.start_time && row.end_time) {
      durationSec = Math.max(60, Math.round((new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 1000));
    } else if (row.duration_minutes) {
      durationSec = Math.max(60, Number(row.duration_minutes) * 60);
    } else {
      durationSec = 3600;
    }
    const durationMin = Math.round(durationSec / 60);

    return {
      title: row.title,
      status: row.status,
      instructorName: `${row.instructor_first || ''} ${row.instructor_last || ''}`.trim() || 'Host / Instructor',
      eventDate: row.start_time || new Date(),
      durationMinutes: durationMin,
      durationSeconds: durationSec,
    };
  }

  async checkWebinarHost(webinarId: string, userId: string): Promise<boolean> {
    const res = await this.db.executeQuery(
      `SELECT 1 FROM webinars w
       LEFT JOIN webinar_hosts wh ON wh.webinar_id = w.webinar_id
       WHERE w.webinar_id = $1 AND (w.created_by = $2 OR wh.user_id = $2)`,
      [webinarId, userId],
    );
    return res.rows.length > 0;
  }

  async checkCourseInstructor(courseId: string, userId: string): Promise<boolean> {
    const res = await this.db.executeQuery(
      `SELECT 1 FROM courses WHERE course_id = $1 AND instructor_id = $2`,
      [courseId, userId],
    );
    return res.rows.length > 0;
  }

  async getWebinarAttendanceIntervals(webinarId: string): Promise<Array<{
    webinarRegistrationId: string;
    joinedAt: Date;
    leftAt: Date;
  }>> {
    const res = await this.db.executeQuery(
      `SELECT
        webinar_registration_id AS "webinarRegistrationId",
        joined_at AS "joinedAt",
        COALESCE(left_at, CURRENT_TIMESTAMP) AS "leftAt"
       FROM webinar_attendances
       WHERE webinar_id = $1
       ORDER BY joined_at ASC`,
      [webinarId],
    );
    return res.rows;
  }

  async getWebinarAttendanceReport(webinarId: string): Promise<any[]> {
    const query = `
      SELECT
        wr.webinar_registration_id AS "webinarRegistrationId",
        wr.webinar_id AS "webinarId",
        wr.email,
        TRIM(CONCAT(wr.first_name, ' ', wr.last_name)) AS "participantName",
        u.user_id AS "studentId",
        ic.certificate_id AS "issuedCertificateId",
        ic.certificate_number AS "certificateNumber",
        ic.status AS "certificateStatus"
      FROM webinar_registrations wr
      LEFT JOIN users u ON LOWER(u.email) = LOWER(wr.email) AND u.is_active = TRUE
      LEFT JOIN issued_certificates ic ON ic.student_id = u.user_id AND ic.webinar_id = wr.webinar_id AND ic.status = 'valid'
      WHERE wr.webinar_id = $1 AND wr.status = 'confirmed'
      ORDER BY wr.email ASC
    `;
    const [regsRes, intervals] = await Promise.all([
      this.db.executeQuery(query, [webinarId]),
      this.getWebinarAttendanceIntervals(webinarId),
    ]);

    // Group intervals by registration ID and calculate non-overlapping attended seconds
    const intervalsByReg = new Map<string, Array<{ start: number; end: number }>>();
    for (const inv of intervals) {
      if (!intervalsByReg.has(inv.webinarRegistrationId)) {
        intervalsByReg.set(inv.webinarRegistrationId, []);
      }
      const start = new Date(inv.joinedAt).getTime() / 1000;
      const end = new Date(inv.leftAt).getTime() / 1000;
      if (end > start) {
        intervalsByReg.get(inv.webinarRegistrationId)!.push({ start, end });
      }
    }

    return regsRes.rows.map((row) => {
      const regIntervals = intervalsByReg.get(row.webinarRegistrationId) || [];
      let totalNonOverlappingSeconds = 0;

      if (regIntervals.length > 0) {
        regIntervals.sort((a, b) => a.start - b.start);
        let curStart = regIntervals[0].start;
        let curEnd = regIntervals[0].end;

        for (let i = 1; i < regIntervals.length; i++) {
          if (regIntervals[i].start <= curEnd) {
            curEnd = Math.max(curEnd, regIntervals[i].end);
          } else {
            totalNonOverlappingSeconds += Math.round(curEnd - curStart);
            curStart = regIntervals[i].start;
            curEnd = regIntervals[i].end;
          }
        }
        totalNonOverlappingSeconds += Math.round(curEnd - curStart);
      }

      return {
        ...row,
        totalAttendedSeconds: totalNonOverlappingSeconds,
      };
    });
  }

  async addManualAttendance(
    webinarId: string,
    webinarRegistrationId: string,
    additionalSeconds: number,
  ): Promise<void> {
    const regRes = await this.db.executeQuery<{ email: string; first_name: string; last_name: string }>(
      `SELECT email, first_name, last_name FROM webinar_registrations WHERE webinar_registration_id = $1`,
      [webinarRegistrationId],
    );
    const reg = regRes.rows[0];
    const email = reg ? reg.email : 'manual@attendance.record';
    const displayName = reg ? `${reg.first_name} ${reg.last_name}`.trim() : 'Manual Attendance';

    await this.db.executeQuery(
      `INSERT INTO webinar_attendances (
        webinar_id,
        webinar_registration_id,
        email,
        display_name,
        joined_at,
        left_at,
        duration_seconds
      ) VALUES (
        $1, $2, $3, $4, CURRENT_TIMESTAMP - ($5 || ' seconds')::interval, CURRENT_TIMESTAMP, $5
      )`,
      [webinarId, webinarRegistrationId, email, displayName, additionalSeconds],
    );
  }

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  async createAuditLog(
    certificateId: string,
    action: string,
    performedBy?: string,
    reason?: string,
    oldValues?: any,
    newValues?: any,
  ): Promise<void> {
    await this.db.executeQuery(
      `INSERT INTO certificate_audit_logs (
        certificate_id,
        action,
        performed_by,
        reason,
        old_values,
        new_values
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        certificateId,
        action,
        performedBy || null,
        reason || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
      ],
    );
  }

  async getAuditLogsForCertificate(certificateId: string): Promise<any[]> {
    const res = await this.db.executeQuery(
      `SELECT
        l.log_id AS "logId",
        l.certificate_id AS "certificateId",
        l.action,
        l.performed_by AS "performedBy",
        u.email AS "performedByEmail",
        l.reason,
        l.old_values AS "oldValues",
        l.new_values AS "newValues",
        l.created_at AS "createdAt"
       FROM certificate_audit_logs l
       LEFT JOIN users u ON l.performed_by = u.user_id
       WHERE l.certificate_id = $1
       ORDER BY l.created_at DESC`,
      [certificateId],
    );
    return res.rows;
  }
}

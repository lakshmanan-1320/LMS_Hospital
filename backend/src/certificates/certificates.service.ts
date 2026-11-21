import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigService } from '@nestjs/config';
import {
  CertificatesRepository,
  IssuedCertificateEntity,
  CertificateTemplateEntity,
  WebinarCertificateSettingEntity,
} from './certificates.repository';
import { PdfGeneratorService } from './pdf-generator.service';
import { StorageService } from '../providers/storage/storage.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);
  private readonly appUrl: string;

  constructor(
    private readonly repository: CertificatesRepository,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    this.appUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
  }

  // ==========================================
  // TEMPLATES MANAGEMENT
  // ==========================================

  async createTemplate(
    data: any,
    user: AuthenticatedUser,
  ): Promise<CertificateTemplateEntity> {
    return this.repository.createTemplate({
      ...data,
      createdBy: user.userId,
    });
  }

  async updateTemplate(
    templateId: string,
    data: any,
  ): Promise<CertificateTemplateEntity> {
    const updated = await this.repository.updateTemplate(templateId, data);
    if (!updated) {
      throw new NotFoundException('Certificate template not found');
    }
    return updated;
  }

  async listTemplates(certificateType?: string): Promise<CertificateTemplateEntity[]> {
    return this.repository.listTemplates(certificateType);
  }

  async getTemplateById(templateId: string): Promise<CertificateTemplateEntity> {
    const template = await this.repository.findTemplateById(templateId);
    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }
    return template;
  }

  // ==========================================
  // WEBINAR SETTINGS
  // ==========================================

  async getWebinarCertificateSettings(
    webinarId: string,
    user?: AuthenticatedUser,
  ): Promise<WebinarCertificateSettingEntity> {
    if (
      user &&
      user.roles?.includes('instructor') &&
      !user.roles?.includes('admin') &&
      !user.roles?.includes('super_admin')
    ) {
      const isHost = await this.repository.checkWebinarHost(webinarId, user.userId);
      if (!isHost) {
        throw new ForbiddenException('You are not authorized to view settings for this webinar');
      }
    }

    let settings = await this.repository.getWebinarSettings(webinarId);
    if (!settings) {
      // Return default inactive settings if not configured yet
      return {
        setting_id: '',
        webinar_id: webinarId,
        enabled: false,
        minimum_attendance_percentage: 75.0,
        minimum_attendance_minutes: null,
        template_id: null,
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
    }
    return settings;
  }

  async updateWebinarCertificateSettings(
    webinarId: string,
    data: {
      enabled: boolean;
      minimumAttendancePercentage?: number;
      minimumAttendanceMinutes?: number;
      templateId?: string;
    },
    user: AuthenticatedUser,
  ): Promise<WebinarCertificateSettingEntity> {
    if (
      user.roles?.includes('instructor') &&
      !user.roles?.includes('admin') &&
      !user.roles?.includes('super_admin')
    ) {
      const isHost = await this.repository.checkWebinarHost(webinarId, user.userId);
      if (!isHost) {
        throw new ForbiddenException('You are not authorized to modify settings for this webinar');
      }
    }

    return this.repository.upsertWebinarSettings(webinarId, {
      ...data,
      createdBy: user.userId,
    });
  }

  async getWebinarAttendanceReport(webinarId: string) {
    const webinar = await this.repository.getWebinarSnapshot(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    const settings = await this.getWebinarCertificateSettings(webinarId);
    const report = await this.repository.getWebinarAttendanceReport(webinarId);

    const totalDurationSeconds = Math.max(1, webinar.durationMinutes * 60);

    const mapped = report.map((row) => {
      const attendedSeconds = Number(row.totalAttendedSeconds) || 0;
      const attendedPercentage = Math.min(
        100,
        Math.round((attendedSeconds / totalDurationSeconds) * 100 * 10) / 10,
      );
      const attendedMinutes = Math.round(attendedSeconds / 60);

      const qualifies =
        settings.enabled &&
        attendedPercentage >= Number(settings.minimum_attendance_percentage) &&
        (!settings.minimum_attendance_minutes ||
          attendedMinutes >= Number(settings.minimum_attendance_minutes));

      return {
        ...row,
        totalDurationSeconds,
        attendedSeconds,
        attendedMinutes,
        attendedPercentage,
        qualifies,
        isIssued: !!row.issuedCertificateId,
      };
    });

    return {
      webinar,
      settings,
      participants: mapped,
    };
  }

  async correctWebinarAttendance(
    webinarId: string,
    webinarRegistrationId: string,
    additionalSeconds: number,
    adminUser: AuthenticatedUser,
    reason?: string,
  ) {
    await this.repository.addManualAttendance(
      webinarId,
      webinarRegistrationId,
      additionalSeconds,
    );
    return {
      success: true,
      message: `Added ${additionalSeconds} seconds to participant attendance`,
    };
  }

  // ==========================================
  // CERTIFICATE ISSUANCE (COURSE COMPLETION)
  // ==========================================

  async issueCourseCompletionCertificate(
    studentId: string,
    courseId: string,
  ): Promise<{
    certificate: IssuedCertificateEntity;
    isNew: boolean;
    verificationUrl: string;
  }> {
    // 1. Idempotency Check: Already issued and valid?
    const existing = await this.repository.findValidCertificateByCourse(
      studentId,
      courseId,
    );
    if (existing) {
      return {
        certificate: existing,
        isNew: false,
        verificationUrl: `${this.appUrl}/verify-certificate/${existing.certificate_number}`,
      };
    }

    // 2. Authoritative Completion Check
    const completion = await this.repository.calculateCourseCompletion(
      studentId,
      courseId,
    );
    if (!completion.isCourseCompleted) {
      throw new BadRequestException(
        'Cannot issue certificate: Course curriculum is not 100% completed.',
      );
    }

    // 3. Collect Snapshots
    const student = await this.repository.getStudentSnapshot(studentId);
    if (!student) {
      throw new NotFoundException('Student account not found');
    }

    const course = await this.repository.getCourseSnapshot(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // 4. Resolve Template
    const template = await this.repository.findDefaultTemplate('course_completion');

    // 5. Generate Secure Verification Token & Hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 6. Generate Certificate Display Number
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const certificateNumber = `LMS-${year}-${randomHex}`;

    const verificationUrl = `${this.appUrl}/verify-certificate/${rawToken}`;
    const storageKey = `certificates/courses/${courseId}/${studentId}_${Date.now()}.pdf`;

    // 7. Persist to Database FIRST to guarantee certificate existence
    const cert = await this.repository.createCertificate({
      certificateNumber,
      certificateType: 'course_completion',
      studentId,
      courseId,
      templateId: template?.template_id,
      studentNameSnapshot: student.name,
      courseNameSnapshot: course.title,
      instructorNameSnapshot: course.instructorName,
      completionOrEventDate: new Date(),
      certificateFileStorageKey: storageKey,
      verificationTokenHash: tokenHash,
    });

    // 8. Audit Log
    await this.repository.createAuditLog(
      cert.certificate_id,
      'issued',
      studentId,
      'Automatic course completion certificate issued',
      null,
      { certificateNumber, courseTitle: course.title },
    );

    this.logger.log(
      `Persisted course completion certificate record ${certificateNumber} (ID: ${cert.certificate_id}) for student ${studentId}`,
    );

    // 9. Generate and Save PDF Buffer (Safe execution, self-healing)
    try {
      const pdfBuffer = await this.pdfGenerator.generateCertificatePdf({
        certificateNumber,
        certificateType: 'course_completion',
        studentName: student.name,
        subjectTitle: course.title,
        instructorName: course.instructorName,
        completionDate: new Date(),
        verificationUrl,
        templateConfig: template?.template_configuration,
      });

      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `cert_${Date.now()}_${Math.random()}.pdf`);
      await fs.writeFile(tempFilePath, pdfBuffer);

      try {
        await this.storageService.save(tempFilePath, storageKey, 'application/pdf');
      } finally {
        await fs.unlink(tempFilePath).catch(() => {});
      }
    } catch (pdfErr: any) {
      this.logger.error(
        `Failed to generate/store PDF for certificate ${certificateNumber}: ${pdfErr.message}. File will be regenerated on demand.`,
        pdfErr.stack,
      );
    }

    this.logger.log(
      `Issued course completion certificate ${certificateNumber} to student ${studentId} for course ${courseId}`,
    );

    return {
      certificate: cert,
      isNew: true,
      verificationUrl,
    };
  }

  // ==========================================
  // CERTIFICATE ISSUANCE (WEBINAR PARTICIPATION)
  // ==========================================

  async issueWebinarParticipationCertificates(webinarId: string): Promise<IssuedCertificateEntity[]> {
    const settings = await this.repository.getWebinarSettings(webinarId);
    if (!settings || !settings.enabled) {
      this.logger.log(`Webinar certificates not enabled for webinar ${webinarId}`);
      return [];
    }

    const webinar = await this.repository.getWebinarSnapshot(webinarId);
    if (!webinar) {
      this.logger.warn(`Webinar snapshot not found for ${webinarId}`);
      return [];
    }

    if (webinar.status !== 'completed') {
      this.logger.warn(
        `Webinar ${webinarId} is not completed (current status: ${webinar.status}). Cannot issue participation certificates.`,
      );
      return [];
    }

    const template = settings.template_id
      ? await this.repository.findTemplateById(settings.template_id)
      : await this.repository.findDefaultTemplate('webinar_participation');

    const report = await this.repository.getWebinarAttendanceReport(webinarId);
    const totalDurationSeconds = Math.max(1, webinar.durationMinutes * 60);

    const issuedList: IssuedCertificateEntity[] = [];
    const processedStudentIds = new Set<string>();

    for (const participant of report) {
      if (!participant.studentId) {
        // Participant is not a registered LMS user
        continue;
      }

      if (processedStudentIds.has(participant.studentId)) {
        // Guard against duplicate registrations for the same user in report
        continue;
      }

      const attendedSeconds = Number(participant.totalAttendedSeconds) || 0;
      if (attendedSeconds <= 0) {
        // Participant registered but never attended
        continue;
      }

      // Check if already has valid certificate
      const existing = await this.repository.findValidCertificateByWebinar(
        participant.studentId,
        webinarId,
      );
      if (existing) {
        processedStudentIds.add(participant.studentId);
        continue;
      }

      const attendedPercentage = (attendedSeconds / totalDurationSeconds) * 100;
      const attendedMinutes = attendedSeconds / 60;

      const meetsPercentage =
        attendedPercentage >= Number(settings.minimum_attendance_percentage);
      const meetsMinutes =
        !settings.minimum_attendance_minutes ||
        attendedMinutes >= Number(settings.minimum_attendance_minutes);

      if (meetsPercentage && meetsMinutes) {
        try {
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const year = new Date().getFullYear();
          const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
          const certificateNumber = `WEB-${year}-${randomHex}`;
          const verificationUrl = `${this.appUrl}/verify-certificate/${rawToken}`;

          const pdfBuffer = await this.pdfGenerator.generateCertificatePdf({
            certificateNumber,
            certificateType: 'webinar_participation',
            studentName: participant.participantName || 'Webinar Participant',
            subjectTitle: webinar.title,
            instructorName: webinar.instructorName,
            completionDate: webinar.eventDate,
            verificationUrl,
            templateConfig: template?.template_configuration,
          });

          const storageKey = `certificates/webinars/${webinarId}/${participant.studentId}_${Date.now()}.pdf`;
          const tempFilePath = path.join(os.tmpdir(), `cert_web_${Date.now()}_${Math.random()}.pdf`);
          await fs.writeFile(tempFilePath, pdfBuffer);

          try {
            await this.storageService.save(tempFilePath, storageKey, 'application/pdf');
          } finally {
            await fs.unlink(tempFilePath).catch(() => {});
          }

          const cert = await this.repository.createCertificate({
            certificateNumber,
            certificateType: 'webinar_participation',
            studentId: participant.studentId,
            webinarId,
            templateId: template?.template_id,
            studentNameSnapshot: participant.participantName || 'Webinar Participant',
            webinarNameSnapshot: webinar.title,
            instructorNameSnapshot: webinar.instructorName,
            completionOrEventDate: webinar.eventDate,
            certificateFileStorageKey: storageKey,
            verificationTokenHash: tokenHash,
          });

          await this.repository.createAuditLog(
            cert.certificate_id,
            'issued',
            undefined,
            'Automatic webinar attendance certificate issued',
            null,
            { certificateNumber, webinarTitle: webinar.title, attendedPercentage },
          );

          issuedList.push(cert);
          processedStudentIds.add(participant.studentId);
        } catch (err) {
          this.logger.error(
            `Failed to issue webinar certificate for student ${participant.studentId} in webinar ${webinarId}`,
            err,
          );
        }
      }
    }

    this.logger.log(`Issued ${issuedList.length} webinar participation certificates for webinar ${webinarId}`);
    return issuedList;
  }

  async manualIssueWebinarCertificate(
    webinarId: string,
    studentId: string,
    adminUser: AuthenticatedUser,
    reason?: string,
  ): Promise<IssuedCertificateEntity> {
    const existing = await this.repository.findValidCertificateByWebinar(
      studentId,
      webinarId,
    );
    if (existing) {
      return existing;
    }

    const webinar = await this.repository.getWebinarSnapshot(webinarId);
    if (!webinar) {
      throw new NotFoundException('Webinar not found');
    }

    if (webinar.status !== 'completed') {
      throw new BadRequestException(
        `Cannot issue certificate: Webinar session is not completed (status: ${webinar.status}).`,
      );
    }

    const student = await this.repository.getStudentSnapshot(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const settings = await this.repository.getWebinarSettings(webinarId);
    const template = settings?.template_id
      ? await this.repository.findTemplateById(settings.template_id)
      : await this.repository.findDefaultTemplate('webinar_participation');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const certificateNumber = `WEB-${year}-${randomHex}`;
    const verificationUrl = `${this.appUrl}/verify-certificate/${rawToken}`;

    const pdfBuffer = await this.pdfGenerator.generateCertificatePdf({
      certificateNumber,
      certificateType: 'webinar_participation',
      studentName: student.name,
      subjectTitle: webinar.title,
      instructorName: webinar.instructorName,
      completionDate: webinar.eventDate,
      verificationUrl,
      templateConfig: template?.template_configuration,
    });

    const storageKey = `certificates/webinars/${webinarId}/${studentId}_${Date.now()}.pdf`;
    const tempFilePath = path.join(os.tmpdir(), `cert_web_${Date.now()}_${Math.random()}.pdf`);
    await fs.writeFile(tempFilePath, pdfBuffer);

    try {
      await this.storageService.save(tempFilePath, storageKey, 'application/pdf');
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    const cert = await this.repository.createCertificate({
      certificateNumber,
      certificateType: 'webinar_participation',
      studentId,
      webinarId,
      templateId: template?.template_id,
      studentNameSnapshot: student.name,
      webinarNameSnapshot: webinar.title,
      instructorNameSnapshot: webinar.instructorName,
      completionOrEventDate: webinar.eventDate,
      certificateFileStorageKey: storageKey,
      verificationTokenHash: tokenHash,
    });

    await this.repository.createAuditLog(
      cert.certificate_id,
      'manually_issued',
      adminUser.userId,
      reason || 'Administrator manual issuance waiver',
      null,
      { certificateNumber, issuedBy: adminUser.email },
    );

    return cert;
  }

  // ==========================================
  // REVOKE & REISSUE
  // ==========================================

  async revokeCertificate(
    certificateId: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<IssuedCertificateEntity> {
    const cert = await this.repository.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    if (cert.status === 'revoked') {
      throw new BadRequestException('Certificate is already revoked');
    }

    const updated = await this.repository.revokeCertificate(
      certificateId,
      user.userId,
      reason,
    );
    if (!updated) {
      throw new BadRequestException('Failed to revoke certificate');
    }

    await this.repository.createAuditLog(
      certificateId,
      'revoked',
      user.userId,
      reason,
      { status: 'valid' },
      { status: 'revoked', revocationReason: reason },
    );

    return updated;
  }

  async reissueCertificate(
    certificateId: string,
    data: { reason: string; correctedStudentName?: string },
    user: AuthenticatedUser,
  ): Promise<IssuedCertificateEntity> {
    const cert = await this.repository.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException('Original certificate not found');
    }

    // If still valid, revoke the old one
    if (cert.status === 'valid') {
      await this.revokeCertificate(
        certificateId,
        `Reissued: ${data.reason}`,
        user,
      );
    }

    // Determine student name snapshot
    const studentName =
      data.correctedStudentName?.trim() || cert.student_name_snapshot;

    const template = cert.template_id
      ? await this.repository.findTemplateById(cert.template_id)
      : await this.repository.findDefaultTemplate(cert.certificate_type);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const year = new Date().getFullYear();
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const prefix = cert.certificate_type === 'course_completion' ? 'LMS' : 'WEB';
    const certificateNumber = `${prefix}-${year}-${randomHex}`;
    const verificationUrl = `${this.appUrl}/verify-certificate/${rawToken}`;

    const subjectTitle =
      cert.certificate_type === 'course_completion'
        ? cert.course_name_snapshot || 'Course Completion'
        : cert.webinar_name_snapshot || 'Webinar Participation';

    const pdfBuffer = await this.pdfGenerator.generateCertificatePdf({
      certificateNumber,
      certificateType: cert.certificate_type,
      studentName,
      subjectTitle,
      instructorName: cert.instructor_name_snapshot || undefined,
      completionDate: cert.completion_or_event_date,
      verificationUrl,
      templateConfig: template?.template_configuration,
    });

    const folder = cert.certificate_type === 'course_completion' ? 'courses' : 'webinars';
    const refId = cert.course_id || cert.webinar_id || 'general';
    const storageKey = `certificates/${folder}/${refId}/${cert.student_id}_reissued_${Date.now()}.pdf`;

    const tempFilePath = path.join(os.tmpdir(), `reissue_${Date.now()}_${Math.random()}.pdf`);
    await fs.writeFile(tempFilePath, pdfBuffer);

    try {
      await this.storageService.save(tempFilePath, storageKey, 'application/pdf');
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }

    const reissued = await this.repository.createCertificate({
      certificateNumber,
      certificateType: cert.certificate_type,
      studentId: cert.student_id,
      courseId: cert.course_id || undefined,
      webinarId: cert.webinar_id || undefined,
      templateId: cert.template_id || undefined,
      studentNameSnapshot: studentName,
      courseNameSnapshot: cert.course_name_snapshot || undefined,
      webinarNameSnapshot: cert.webinar_name_snapshot || undefined,
      instructorNameSnapshot: cert.instructor_name_snapshot || undefined,
      completionOrEventDate: cert.completion_or_event_date,
      certificateFileStorageKey: storageKey,
      verificationTokenHash: tokenHash,
      reissuedFromId: certificateId,
    });

    await this.repository.createAuditLog(
      reissued.certificate_id,
      'reissued',
      user.userId,
      data.reason,
      { reissuedFromId: certificateId },
      { certificateNumber, studentName },
    );

    return reissued;
  }

  // ==========================================
  // PUBLIC VERIFICATION (ANONYMOUS SAFE)
  // ==========================================

  async verifyPublicCertificate(tokenOrNumber: string): Promise<any> {
    if (!tokenOrNumber || tokenOrNumber.trim().length === 0) {
      return {
        valid: false,
        status: 'not_found',
        message: 'Invalid certificate token or number.',
      };
    }

    // Try hashing as 32-byte token first
    const tokenHash = crypto.createHash('sha256').update(tokenOrNumber).digest('hex');
    let cert = await this.repository.findCertificateByTokenHash(tokenHash);

    // If not found by hash, try finding by certificate number
    if (!cert) {
      const byNum = await this.repository.listAdminCertificates({
        search: tokenOrNumber.trim(),
        limit: 1,
      });
      if (byNum.data.length > 0 && byNum.data[0].certificateNumber === tokenOrNumber.trim()) {
        cert = await this.repository.findCertificateById(byNum.data[0].certificateId);
      }
    }

    if (!cert) {
      return {
        valid: false,
        status: 'not_found',
        message: 'Certificate not found. The verification token or certificate number is invalid.',
      };
    }

    if (cert.status === 'revoked') {
      return {
        valid: false,
        status: 'revoked',
        message: 'This certificate has been revoked and is no longer valid.',
        certificateNumber: cert.certificate_number,
        certificateType: cert.certificate_type,
        studentName: cert.student_name_snapshot,
        subjectTitle: cert.course_name_snapshot || cert.webinar_name_snapshot,
        instructorName: cert.instructor_name_snapshot,
        revocationReason: cert.revocation_reason,
        revokedAt: cert.revoked_at,
        issuedAt: cert.issued_at,
      };
    }

    return {
      valid: true,
      status: 'valid',
      message: 'Certificate verified successfully and is authentic.',
      certificateNumber: cert.certificate_number,
      certificateType: cert.certificate_type,
      studentName: cert.student_name_snapshot,
      subjectTitle: cert.course_name_snapshot || cert.webinar_name_snapshot,
      instructorName: cert.instructor_name_snapshot,
      issueDate: cert.issued_at,
      completionDate: cert.completion_or_event_date,
    };
  }

  // ==========================================
  // RETRIEVAL & DOWNLOAD (AUTHORIZED)
  // ==========================================

  async getCertificateById(
    certificateId: string,
    user: AuthenticatedUser,
  ): Promise<any> {
    const cert = await this.repository.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    // Authorize
    const isAdmin = user.roles?.some((r) =>
      ['super_admin', 'admin'].includes(r),
    );
    const isOwner = cert.student_id === user.userId;
    let isAuthorizedInstructor = false;

    if (user.roles?.includes('instructor') && !isAdmin) {
      if (cert.course_id) {
        isAuthorizedInstructor = await this.repository.checkCourseInstructor(
          cert.course_id,
          user.userId,
        );
      } else if (cert.webinar_id) {
        isAuthorizedInstructor = await this.repository.checkWebinarHost(
          cert.webinar_id,
          user.userId,
        );
      }
    }

    if (!isAdmin && !isOwner && !isAuthorizedInstructor) {
      throw new ForbiddenException(
        'You do not have permission to view this certificate',
      );
    }

    const auditLogs = isAdmin
      ? await this.repository.getAuditLogsForCertificate(certificateId)
      : [];

    return {
      certificate: cert,
      auditLogs,
    };
  }

  async getCertificateFileStream(
    certificateId: string,
    user: AuthenticatedUser,
  ) {
    const cert = await this.repository.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    // Authorize
    const isAdmin = user.roles?.some((r) =>
      ['super_admin', 'admin'].includes(r),
    );
    const isOwner = cert.student_id === user.userId;
    let isAuthorizedInstructor = false;

    if (user.roles?.includes('instructor') && !isAdmin) {
      if (cert.course_id) {
        isAuthorizedInstructor = await this.repository.checkCourseInstructor(
          cert.course_id,
          user.userId,
        );
      } else if (cert.webinar_id) {
        isAuthorizedInstructor = await this.repository.checkWebinarHost(
          cert.webinar_id,
          user.userId,
        );
      }
    }

    if (!isAdmin && !isOwner && !isAuthorizedInstructor) {
      throw new ForbiddenException(
        'You do not have permission to download this certificate',
      );
    }

    let exists = await this.storageService.exists(
      cert.certificate_file_storage_key,
    );
    if (!exists) {
      this.logger.warn(
        `Certificate file not found at ${cert.certificate_file_storage_key}. Auto-regenerating PDF...`,
      );
      try {
        await this.regeneratePdfFile(cert);
        exists = await this.storageService.exists(
          cert.certificate_file_storage_key,
        );
      } catch (regenErr: any) {
        this.logger.error(`Failed to auto-regenerate PDF: ${regenErr.message}`);
      }
    }

    if (!exists) {
      throw new NotFoundException('Certificate file not found in storage');
    }

    const stream = await this.storageService.getReadStream(
      cert.certificate_file_storage_key,
    );
    const filename = `${cert.certificate_number}.pdf`;

    return {
      stream,
      filename,
    };
  }

  async regeneratePdfFile(cert: IssuedCertificateEntity): Promise<void> {
    const template = cert.template_id
      ? await this.repository.findTemplateById(cert.template_id)
      : await this.repository.findDefaultTemplate(cert.certificate_type);

    const verificationUrl = `${this.appUrl}/verify-certificate/${cert.certificate_number}`;
    const subjectTitle =
      cert.certificate_type === 'course_completion'
        ? cert.course_name_snapshot || 'Course Completion'
        : cert.webinar_name_snapshot || 'Webinar Participation';

    const pdfBuffer = await this.pdfGenerator.generateCertificatePdf({
      certificateNumber: cert.certificate_number,
      certificateType: cert.certificate_type,
      studentName: cert.student_name_snapshot,
      subjectTitle,
      instructorName: cert.instructor_name_snapshot || undefined,
      completionDate: cert.completion_or_event_date,
      verificationUrl,
      templateConfig: template?.template_configuration,
    });

    const tempFilePath = path.join(os.tmpdir(), `cert_regen_${Date.now()}_${Math.random()}.pdf`);
    await fs.writeFile(tempFilePath, pdfBuffer);
    try {
      await this.storageService.save(tempFilePath, cert.certificate_file_storage_key, 'application/pdf');
    } finally {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }

  async reconcileCompletedCourseCertificates(studentId: string): Promise<void> {
    try {
      const missingCourseIds = await this.repository.findCompletedCoursesMissingCertificates(studentId);
      if (missingCourseIds && missingCourseIds.length > 0) {
        this.logger.log(`Reconciling ${missingCourseIds.length} missing certificate(s) for student ${studentId}`);
        for (const courseId of missingCourseIds) {
          try {
            await this.issueCourseCompletionCertificate(studentId, courseId);
          } catch (issueErr: any) {
            this.logger.warn(`Failed reconciling certificate for course ${courseId}, student ${studentId}: ${issueErr.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error during certificate reconciliation for student ${studentId}: ${err.message}`);
    }
  }

  async listStudentCertificates(studentId: string, query: any) {
    await this.reconcileCompletedCourseCertificates(studentId);
    return this.repository.listStudentCertificates(studentId, query);
  }

  async listAdminCertificates(query: any, user?: AuthenticatedUser) {
    const isInstructorOnly =
      user?.roles?.includes('instructor') &&
      !user?.roles?.includes('admin') &&
      !user?.roles?.includes('super_admin');

    const filterQuery = {
      ...query,
      ...(isInstructorOnly ? { instructorId: user.userId } : {}),
    };

    return this.repository.listAdminCertificates(filterQuery);
  }

  async getOverviewStats() {
    return this.repository.getOverviewStats();
  }
}

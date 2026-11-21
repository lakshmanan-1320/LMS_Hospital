import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Res,
  ParseUUIDPipe,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UpdateWebinarCertificateSettingsDto } from './dto/webinar-certificate-settings.dto';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import { ReissueCertificateDto } from './dto/reissue-certificate.dto';
import { QueryCertificatesDto } from './dto/query-certificates.dto';
import { ManualIssueCertificateDto } from './dto/manual-issue.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  // ==========================================
  // PUBLIC VERIFICATION (NO AUTH REQUIRED)
  // ==========================================

  @Public()
  @Get('public/verify/:token')
  async verifyCertificate(@Param('token') token: string) {
    return this.certificatesService.verifyPublicCertificate(token);
  }

  // ==========================================
  // STUDENT / MY CERTIFICATES
  // ==========================================

  @Get('my')
  async getMyCertificates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryCertificatesDto,
  ) {
    return this.certificatesService.listStudentCertificates(user.userId, query);
  }

  @Post('courses/:courseId/claim')
  async claimCourseCertificate(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.issueCourseCompletionCertificate(
      user.userId,
      courseId,
    );
  }

  @Get(':id/download')
  async downloadCertificate(
    @Param('id', ParseUUIDPipe) certificateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { stream, filename } =
      await this.certificatesService.getCertificateFileStream(
        certificateId,
        user,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Get(':id/view')
  async viewCertificate(
    @Param('id', ParseUUIDPipe) certificateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { stream, filename } =
      await this.certificatesService.getCertificateFileStream(
        certificateId,
        user,
      );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    stream.pipe(res);
  }

  // ==========================================
  // WEBINAR SETTINGS (ADMIN & INSTRUCTOR)
  // ==========================================

  @Roles('super_admin', 'admin', 'instructor')
  @Get('webinars/:webinarId/settings')
  async getWebinarSettings(
    @Param('webinarId', ParseUUIDPipe) webinarId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.getWebinarCertificateSettings(webinarId, user);
  }

  @Roles('super_admin', 'admin', 'instructor')
  @Put('webinars/:webinarId/settings')
  async updateWebinarSettings(
    @Param('webinarId', ParseUUIDPipe) webinarId: string,
    @Body() dto: UpdateWebinarCertificateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.updateWebinarCertificateSettings(
      webinarId,
      dto,
      user,
    );
  }

  // ==========================================
  // ADMIN DASHBOARD & MANAGEMENT
  // ==========================================

  @Roles('super_admin', 'admin')
  @Get('admin/overview')
  async getAdminOverview() {
    return this.certificatesService.getOverviewStats();
  }

  @Roles('super_admin', 'admin', 'instructor')
  @Get('admin/list')
  async getAdminCertificatesList(
    @Query() query: QueryCertificatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.listAdminCertificates(query, user);
  }

  @Roles('super_admin', 'admin')
  @Get('admin/webinars/:webinarId/attendance-report')
  async getWebinarAttendanceReport(
    @Param('webinarId', ParseUUIDPipe) webinarId: string,
  ) {
    return this.certificatesService.getWebinarAttendanceReport(webinarId);
  }

  @Roles('super_admin', 'admin')
  @Post('admin/webinars/correct-attendance')
  async correctWebinarAttendance(
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.correctWebinarAttendance(
      dto.webinarId,
      dto.webinarRegistrationId,
      dto.additionalSeconds,
      user,
      dto.reason,
    );
  }

  @Roles('super_admin', 'admin')
  @Post('admin/webinars/manual-issue')
  async manualIssueWebinarCertificate(
    @Body() dto: ManualIssueCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.manualIssueWebinarCertificate(
      dto.webinarId,
      dto.studentId,
      user,
      dto.reason,
    );
  }

  @Roles('super_admin', 'admin')
  @Post('admin/:id/revoke')
  async revokeCertificate(
    @Param('id', ParseUUIDPipe) certificateId: string,
    @Body() dto: RevokeCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.revokeCertificate(
      certificateId,
      dto.reason,
      user,
    );
  }

  @Roles('super_admin', 'admin')
  @Post('admin/:id/reissue')
  async reissueCertificate(
    @Param('id', ParseUUIDPipe) certificateId: string,
    @Body() dto: ReissueCertificateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.reissueCertificate(
      certificateId,
      dto,
      user,
    );
  }

  // ==========================================
  // TEMPLATES MANAGEMENT (ADMIN)
  // ==========================================

  @Roles('super_admin', 'admin')
  @Get('admin/templates')
  async listTemplates(@Query('type') type?: string) {
    return this.certificatesService.listTemplates(type);
  }

  @Roles('super_admin', 'admin')
  @Post('admin/templates')
  async createTemplate(
    @Body() dto: CreateTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.createTemplate(dto, user);
  }

  @Roles('super_admin', 'admin')
  @Put('admin/templates/:id')
  async updateTemplate(
    @Param('id', ParseUUIDPipe) templateId: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.certificatesService.updateTemplate(templateId, dto);
  }

  @Roles('super_admin', 'admin', 'instructor')
  @Get('admin/:id')
  async getCertificateDetails(
    @Param('id', ParseUUIDPipe) certificateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.getCertificateById(certificateId, user);
  }
}

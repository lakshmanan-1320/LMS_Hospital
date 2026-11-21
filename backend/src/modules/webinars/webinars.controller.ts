import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Ip,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WebinarAdminGuard } from './guards/webinar-admin.guard';
import { WebinarHostGuard } from './guards/webinar-host.guard';
import { WebinarsService } from './webinars.service';
import { CreateWebinarDto } from './dto/create-webinar.dto';
import { UpdateWebinarDto } from './dto/update-webinar.dto';
import { RescheduleWebinarDto } from './dto/reschedule-webinar.dto';
import { CancelWebinarDto } from './dto/cancel-webinar.dto';
import { RegisterWebinarDto } from './dto/register-webinar.dto';
import { ResendConfirmationDto } from './dto/resend-confirmation.dto';
import { JoinWebinarDto, AttendanceIntervalDto } from './dto/join-webinar.dto';
import { QueryWebinarsDto } from './dto/query-webinar.dto';
import { RequireModule, SkipModuleCheck } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.WEBINARS)
@Controller('webinars')
export class WebinarsController {
  constructor(private readonly webinarsService: WebinarsService) {}

  // ==========================================================
  // PUBLIC ENDPOINTS (No LMS Login Required)
  // ==========================================================

  /**
   * Get registration fields schema (standard system fields & allowed custom field types).
   */
  @Public()
  @Get('registration-fields')
  async getRegistrationFields() {
    return this.webinarsService.getRegistrationFieldsSchema();
  }

  /**
   * Public directory of upcoming published webinars.
   */
  @Public()
  @Get('public')
  async getPublicWebinars(@Query() query: { search?: string; page?: number; limit?: number }) {
    return this.webinarsService.getPublicWebinars(query);
  }

  /**
   * Public landing page details by vanity slug.
   */
  @Public()
  @Get('public/:slug')
  async getPublicWebinarBySlug(@Param('slug') slug: string) {
    return this.webinarsService.getPublicWebinarBySlug(slug);
  }

  /**
   * Unified Public Registration.
   * Works identically across all traffic channels (Google Ads, Meta Ads, WhatsApp, search, direct).
   * Saves with 'confirmed' status and sends confirmation email with calendar details.
   */
  @Public()
  @Post(':webinarId/register')
  @HttpCode(HttpStatus.CREATED)
  async registerPublic(
    @Param('webinarId') webinarId: string,
    @Body() dto: RegisterWebinarDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrerHeader?: string,
  ) {
    return this.webinarsService.registerPublic(
      webinarId,
      {
        ...dto,
        referrer: dto.referrer || referrerHeader,
      },
      { ipAddress, userAgent },
    );
  }

  /**
   * Resend Registration Confirmation email.
   */
  @Public()
  @Post(':webinarId/resend-confirmation')
  @HttpCode(HttpStatus.OK)
  async resendConfirmation(
    @Param('webinarId') webinarId: string,
    @Body() dto: ResendConfirmationDto,
  ) {
    return this.webinarsService.resendConfirmation(webinarId, dto.email);
  }

  /**
   * Public Participant Join Authorization.
   * Authenticates time-limited join token, enforces time window, and yields conference link.
   */
  @Public()
  @Post(':webinarId/join-token')
  @HttpCode(HttpStatus.OK)
  async authorizeJoin(
    @Param('webinarId') webinarId: string,
    @Body() dto: JoinWebinarDto,
  ) {
    return this.webinarsService.authorizeJoin(webinarId, dto.joinToken);
  }

  /**
   * Attendance Tracking: Record session entry interval.
   */
  @Public()
  @Post(':webinarId/attendance/join')
  @HttpCode(HttpStatus.CREATED)
  async recordAttendanceJoin(
    @Param('webinarId') webinarId: string,
    @Body() dto: AttendanceIntervalDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.webinarsService.recordAttendanceJoin(
      webinarId,
      dto.webinarRegistrationId,
      { ipAddress, userAgent },
    );
  }

  /**
   * Attendance Tracking: Record session exit interval.
   */
  @Public()
  @Post(':webinarId/attendance/leave')
  @HttpCode(HttpStatus.OK)
  async recordAttendanceLeave(
    @Param('webinarId') webinarId: string,
    @Body() dto: AttendanceIntervalDto,
  ) {
    await this.webinarsService.recordAttendanceLeave(webinarId, dto.webinarRegistrationId);
    return { message: 'Attendance interval closed successfully' };
  }

  // ==========================================================
  // ADMIN MANAGEMENT ENDPOINTS (ADMIN Role Only - SUPER_ADMIN Blocked)
  // ==========================================================

  /**
   * Upload webinar cover image (JPG, JPEG, PNG, WebP <= 5MB).
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Post('upload-cover')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('coverImage', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = path.join(process.cwd(), 'uploads', 'webinars');
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `cover-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException('Only JPG, JPEG, PNG, and WebP images are allowed.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadCoverImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const protocol = req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5001}`;
    const fileUrl = `${protocol}://${host}/uploads/webinars/${file.filename}`;

    return {
      message: 'Cover image uploaded successfully',
      url: fileUrl,
      filename: file.filename,
      size: file.size,
    };
  }

  /**
   * Create and schedule a new webinar.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWebinar(
    @Body() dto: CreateWebinarDto,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.createWebinar(
      dto,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  /**
   * Admin management listing with filters and attendance counts.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Get('admin')
  async getAdminWebinars(@Query() query: QueryWebinarsDto) {
    return this.webinarsService.getAdminWebinars(query);
  }

  /**
   * Detailed webinar view for Admin.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Get('admin/:webinarId')
  async getAdminWebinarDetails(@Param('webinarId') webinarId: string) {
    return this.webinarsService.getAdminWebinarDetails(webinarId);
  }

  /**
   * Update webinar metadata.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Patch('admin/:webinarId')
  async updateWebinar(
    @Param('webinarId') webinarId: string,
    @Body() dto: UpdateWebinarDto,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.updateWebinar(
      webinarId,
      dto,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  /**
   * Reschedule webinar date/time.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Post('admin/:webinarId/reschedule')
  @HttpCode(HttpStatus.OK)
  async rescheduleWebinar(
    @Param('webinarId') webinarId: string,
    @Body() dto: RescheduleWebinarDto,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.rescheduleWebinar(
      webinarId,
      dto,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  /**
   * Cancel webinar.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Post('admin/:webinarId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelWebinar(
    @Param('webinarId') webinarId: string,
    @Body() dto: CancelWebinarDto,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.cancelWebinar(
      webinarId,
      dto,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  /**
   * Registrant roster with attribution details.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Get('admin/:webinarId/registrants')
  async getWebinarRegistrants(
    @Param('webinarId') webinarId: string,
    @Query() query: { page?: number; limit?: number; status?: string },
  ) {
    return this.webinarsService.getWebinarRegistrants(webinarId, query);
  }

  /**
   * Traffic attribution and attendance analytics.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @Get('admin/:webinarId/analytics')
  async getWebinarAnalytics(@Param('webinarId') webinarId: string) {
    return this.webinarsService.getWebinarAnalytics(webinarId);
  }

  // ==========================================================
  // HOST LIVE SESSION CONTROLS (Assigned Host or ADMIN)
  // ==========================================================

  /**
   * Elevated Host Launch URL.
   */
  @UseGuards(JwtAuthGuard, WebinarHostGuard)
  @Get(':webinarId/host-join')
  async getHostJoinUrl(@Param('webinarId') webinarId: string) {
    return this.webinarsService.getHostJoinUrl(webinarId);
  }

  /**
   * Transition session status to 'live'.
   */
  @UseGuards(JwtAuthGuard, WebinarHostGuard)
  @Post(':webinarId/start')
  @HttpCode(HttpStatus.OK)
  async startSession(
    @Param('webinarId') webinarId: string,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.startSession(
      webinarId,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  /**
   * Transition session status to 'completed'.
   */
  @UseGuards(JwtAuthGuard, WebinarHostGuard)
  @Post(':webinarId/end')
  @HttpCode(HttpStatus.OK)
  async endSession(
    @Param('webinarId') webinarId: string,
    @CurrentUser() user: any,
    @Ip() ipAddress: string,
  ) {
    return this.webinarsService.endSession(
      webinarId,
      { userId: user.userId, role: user.roles[0] },
      ipAddress,
    );
  }

  // ==========================================================
  // MEETING PROVIDER MANAGEMENT ENDPOINTS (ADMIN & SUPER_ADMIN)
  // ==========================================================

  /**
   * Check connection status of meeting providers.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('providers/status')
  async getProvidersStatus() {
    return this.webinarsService.getMeetingProvidersStatus();
  }

  /**
   * Generate Google OAuth authorization URL.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('providers/google/auth-url')
  async getGoogleAuthUrl(
    @Query('redirectUri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    return this.webinarsService.getGoogleAuthUrl(redirectUri, state);
  }

  /**
   * Handle Google OAuth callback: exchange code and connect admin's Google account.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/google/callback')
  @HttpCode(HttpStatus.OK)
  async handleGoogleOAuthCallback(
    @Body() body: { code: string; redirectUri?: string },
    @CurrentUser() user: any,
  ) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.webinarsService.handleGoogleOAuthCallback(body.code, body.redirectUri, user.userId);
  }

  /**
   * Disconnect active Google Meet integration.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/google/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectGoogle() {
    return this.webinarsService.disconnectGoogleProvider();
  }

  /**
   * Test live Google Meet event creation and verification.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/google/test')
  @HttpCode(HttpStatus.OK)
  async testGoogle() {
    return this.webinarsService.testGoogleMeet();
  }

  // ==========================================================
  // ZOOM PROVIDER ROUTES
  // ==========================================================

  /**
   * Generate Zoom OAuth authorization URL for Admin to connect.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('providers/zoom/auth-url')
  async getZoomAuthUrl(
    @Query('redirectUri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    return this.webinarsService.getZoomAuthUrl(redirectUri, state);
  }

  /**
   * Handle Zoom OAuth authorization code return and connect account.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoom/callback')
  @HttpCode(HttpStatus.OK)
  async handleZoomOAuthCallback(
    @Body() body: { code: string; redirectUri?: string },
    @CurrentUser() user: any,
  ) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.webinarsService.handleZoomOAuthCallback(body.code, body.redirectUri, user.userId);
  }

  /**
   * Test Zoom Server-to-Server / OAuth connection and API authentication.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoom/test')
  @HttpCode(HttpStatus.OK)
  async testZoom() {
    return this.webinarsService.testZoomMeeting();
  }

  /**
   * Disconnect Zoom integration.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoom/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectZoom() {
    return this.webinarsService.disconnectZoom();
  }

  // ==========================================================
  // ZOHO MEETING PROVIDER ROUTES
  // ==========================================================

  /**
   * Generate Zoho OAuth authorization URL.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('providers/zoho/auth-url')
  async getZohoAuthUrl(
    @Query('redirectUri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    return this.webinarsService.getZohoAuthUrl(redirectUri, state);
  }

  /**
   * Handle Zoho OAuth callback: exchange code and store credentials.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoho/callback')
  @HttpCode(HttpStatus.OK)
  async handleZohoOAuthCallback(
    @Body() body: { code: string; redirectUri?: string },
    @CurrentUser() user: any,
  ) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.webinarsService.handleZohoOAuthCallback(body.code, body.redirectUri, user.userId);
  }

  /**
   * Test Zoho Meeting session creation and API authentication.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoho/test')
  @HttpCode(HttpStatus.OK)
  async testZoho() {
    return this.webinarsService.testZohoMeeting();
  }

  /**
   * Disconnect Zoho Meeting integration.
   */
  @UseGuards(JwtAuthGuard, WebinarAdminGuard)
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('providers/zoho/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnectZoho() {
    return this.webinarsService.disconnectZoho();
  }

  // ==========================================================
  // INCOMING WEBHOOK ROUTES (PUBLIC)
  // ==========================================================

  /**
   * Incoming Zoom Webhook:
   * - Endpoint URL validation challenge (CRC handshake)
   * - Meeting lifecycle & attendance telemetry
   */
  @Public()
  @SkipModuleCheck()
  @Post('webhooks/zoom')
  @HttpCode(HttpStatus.OK)
  async handleZoomWebhook(@Body() body: any, @Req() req: any) {
    return this.webinarsService.handleZoomWebhook(body, req.headers);
  }

  /**
   * Incoming Zoho Meeting Webhook:
   * - Session lifecycle & participant telemetry
   */
  @Public()
  @SkipModuleCheck()
  @Post('webhooks/zoho')
  @HttpCode(HttpStatus.OK)
  async handleZohoWebhook(@Body() body: any, @Req() req: any) {
    return this.webinarsService.handleZohoWebhook(body, req.headers);
  }
}


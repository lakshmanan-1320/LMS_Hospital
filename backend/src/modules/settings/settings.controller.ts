import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  SettingsService,
  GoogleOAuthSettingsDto,
  ZoomOAuthSettingsDto,
  ZohoOAuthSettingsDto,
  RefundPolicySettingsDto,
  BulkCourseRefundUpdateDto,
} from './settings.service';
import { CourseBadgeSettingsDto } from './dto/course-badge-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.PLATFORM_SETTINGS)
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ==========================================
  // INTEGRATIONS OVERVIEW
  // ==========================================

  /**
   * Status of every external integration (no secrets).
   * GET /settings/integrations
   */
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('integrations')
  @Roles('SUPER_ADMIN')
  async getIntegrationsOverview() {
    return this.settingsService.getIntegrationsOverview();
  }

  // ==========================================
  // GOOGLE OAUTH
  // ==========================================

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('google-oauth')
  @Roles('SUPER_ADMIN')
  async getGoogleOAuth() {
    return this.settingsService.getGoogleOAuthSettings(true);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Patch('google-oauth')
  @Roles('SUPER_ADMIN')
  async updateGoogleOAuth(
    @Body() dto: GoogleOAuthSettingsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.updateGoogleOAuthSettings(dto, userId);
  }

  // ==========================================
  // ZOOM OAUTH & SERVER-TO-SERVER
  // ==========================================

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('zoom-oauth')
  @Roles('SUPER_ADMIN')
  async getZoomOAuth() {
    return this.settingsService.getZoomOAuthSettings(true);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Patch('zoom-oauth')
  @Roles('SUPER_ADMIN')
  async updateZoomOAuth(
    @Body() dto: ZoomOAuthSettingsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.updateZoomOAuthSettings(dto, userId);
  }

  // ==========================================
  // ZOHO MEETING OAUTH
  // ==========================================

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('zoho-oauth')
  @Roles('SUPER_ADMIN')
  async getZohoOAuth() {
    return this.settingsService.getZohoOAuthSettings(true);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Patch('zoho-oauth')
  @Roles('SUPER_ADMIN')
  async updateZohoOAuth(
    @Body() dto: ZohoOAuthSettingsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.updateZohoOAuthSettings(dto, userId);
  }

  // ==========================================
  // DYNAMIC REFUND POLICY & GUARANTEE CONTROLS
  // (Accessible by ADMIN and SUPER_ADMIN)
  // ==========================================

  // ==========================================
  // COURSE BADGE RULES (Admin + Super Admin)
  // ==========================================

  @Get('course-badges')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getCourseBadgeRules() {
    return this.settingsService.getCourseBadgeRules();
  }

  @Patch('course-badges')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateCourseBadgeRules(@Body() dto: CourseBadgeSettingsDto, @Req() req: any) {
    return this.settingsService.updateCourseBadgeRules(dto, req.user?.userId);
  }

  @Get('refund-policy')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getRefundPolicy() {
    return this.settingsService.getRefundPolicySettings();
  }

  @Patch('refund-policy')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateRefundPolicy(
    @Body() dto: RefundPolicySettingsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.updateRefundPolicySettings(dto, userId);
  }

  @Get('refund-policy/courses')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async listCoursesWithRefund(
    @Query('search') search?: string,
    @Query('refundable') refundable?: string,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.settingsService.listCoursesWithRefund({
      search,
      refundable,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Patch('refund-policy/courses/bulk')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async bulkUpdateCoursesRefund(
    @Body() dto: BulkCourseRefundUpdateDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.bulkUpdateCoursesRefund(dto, userId);
  }

  @Patch('refund-policy/courses/:courseId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateCourseRefund(
    @Param('courseId') courseId: string,
    @Body() dto: { isRefundable: boolean; refundPeriodDays?: number },
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.settingsService.updateCourseRefund(courseId, dto, userId);
  }
}

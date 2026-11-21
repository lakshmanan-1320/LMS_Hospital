import {
  Controller,
  Inject,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SmsService } from './sms.service';
import { SmsTemplateService } from './sms-template.service';
import { SmsAudienceService } from './sms-audience.service';
import { SaveSmsConfigDto, TestConnectionDto } from './dto/sms-config.dto';
import { CreateSmsTemplateDto, UpdateSmsTemplateDto } from './dto/sms-template.dto';
import { SendBulkCampaignDto } from './dto/send-bulk-campaign.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.SMS_CAMPAIGNS)
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SmsController {
  constructor(
    @Inject(SmsService) private readonly smsService: SmsService,
    @Inject(SmsTemplateService) private readonly templateService: SmsTemplateService,
    @Inject(SmsAudienceService) private readonly audienceService: SmsAudienceService,
  ) {}

  // ── 1. CONFIG & PROVIDERS ─────────────────────────────────────────────────

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('sms/config')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getConfig() {
    return this.smsService.getConfig();
  }

  /**
   * Super Admin only: Save gateway credentials.
   */
  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('sms/config')
  @Roles('SUPER_ADMIN')
  async saveConfig(@Body() body: SaveSmsConfigDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.smsService.saveConfig({ ...body, userId });
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('sms/config/test')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async testConnection(@Body() body: TestConnectionDto) {
    return this.smsService.testConnection(body.phoneNumber);
  }

  // ── 2. TEMPLATES (STRICTLY REQUIRED FOR CAMPAIGNS) ────────────────────────

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('sms/templates')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async listTemplates(@Query('activeOnly') activeOnly?: string) {
    return this.templateService.listTemplates(activeOnly === 'true');
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('sms/templates/sources')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getVariableSources() {
    return this.templateService.getVariableSources();
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('sms/templates/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getTemplate(@Param('id') id: string) {
    return this.templateService.getTemplateById(id);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('sms/templates')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async createTemplate(@Body() body: CreateSmsTemplateDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.templateService.createTemplate({ ...body, userId });
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Put('sms/templates/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updateTemplate(@Param('id') id: string, @Body() body: UpdateSmsTemplateDto) {
    return this.templateService.updateTemplate(id, body);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Delete('sms/templates/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async deleteTemplate(@Param('id') id: string) {
    return this.templateService.deleteTemplate(id);
  }

  // ── 3. AUDIENCE RESOLUTION & PREVIEWS ─────────────────────────────────────

  @Get('audiences/webinars')
  @Roles('ADMIN')
  async listWebinarAudiences() {
    return this.audienceService.listWebinarAudiences();
  }

  @Get('audiences/webinars/:id/preview')
  @Roles('ADMIN')
  async previewWebinarAudience(@Param('id') id: string, @Query('countryCode') countryCode?: string) {
    return this.audienceService.resolveWebinarAudience(id, countryCode || '91');
  }

  // ── 4. CAMPAIGN DISPATCH (STRICTLY TEMPLATE-BASED) ────────────────────────

  @Post('sms/send-bulk')
  @Roles('ADMIN')
  async sendBulkSmsCampaign(@Body() body: SendBulkCampaignDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.smsService.sendBulkCampaign({ ...body, userId });
  }

  @Get()
  @Roles('ADMIN')
  async listCampaigns(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const l = Math.min(100, Math.max(1, parseInt(limit || '50', 10)));
    const o = Math.max(0, parseInt(offset || '0', 10));
    return this.smsService.listCampaigns(l, o);
  }

  @Get(':id')
  @Roles('ADMIN')
  async getCampaignDetails(@Param('id') id: string) {
    return this.smsService.getCampaignDetails(id);
  }

  @Get('sms/outbox/logs')
  @Roles('ADMIN')
  async listOutboxLogs(@Query('limit') limit?: string) {
    const l = Math.min(200, Math.max(1, parseInt(limit || '100', 10)));
    return this.smsService.listOutboxLogs(l);
  }

  @Post('sms/sync-statuses')
  @Roles('ADMIN')
  async syncStatuses() {
    return this.smsService.syncDeliveryStatuses();
  }
}

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
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailTemplateService } from './email-template.service';
import { EmailAudienceService } from './email-audience.service';
import {
  SaveEmailConfigDto,
  TestEmailGatewayDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendBulkEmailDto,
} from './dto/email-campaign.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.EMAIL_CAMPAIGNS)
@Controller('campaigns/email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailCampaignsController {
  constructor(
    @Inject(EmailCampaignsService)
    private readonly campaignsService: EmailCampaignsService,
    @Inject(EmailTemplateService)
    private readonly templateService: EmailTemplateService,
    @Inject(EmailAudienceService)
    private readonly audienceService: EmailAudienceService,
  ) {}

  // ========================================================
  // 1. SUPER ADMIN SMTP GATEWAY SETTINGS
  // ========================================================

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('config')
  @Roles('SUPER_ADMIN')
  async getConfig() {
    return this.campaignsService.getConfig();
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('config')
  @Roles('SUPER_ADMIN')
  async saveConfig(@Body() body: SaveEmailConfigDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.campaignsService.saveConfig(body, userId);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('config/test')
  @Roles('SUPER_ADMIN')
  async testGateway(@Body() body: TestEmailGatewayDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.campaignsService.testGateway(body, userId);
  }

  // ========================================================
  // 2. EMAIL TEMPLATES (ADMIN & SUPER ADMIN)
  // ========================================================

  @Get('templates/presets')
  @Roles('ADMIN')
  async getPresets() {
    return this.templateService.getStarterPresets();
  }

  @Get('templates')
  @Roles('ADMIN')
  async listTemplates(@Query('activeOnly') activeOnly?: string) {
    return this.templateService.listTemplates(activeOnly === 'true');
  }

  @Get('templates/:id')
  @Roles('ADMIN')
  async getTemplate(@Param('id') id: string) {
    return this.templateService.getTemplate(id);
  }

  @Post('templates')
  @Roles('ADMIN')
  async createTemplate(@Body() body: CreateEmailTemplateDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.templateService.createTemplate(body, userId);
  }

  @Put('templates/:id')
  @Roles('ADMIN')
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: UpdateEmailTemplateDto,
  ) {
    return this.templateService.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  @Roles('ADMIN')
  async deleteTemplate(@Param('id') id: string) {
    return this.templateService.deleteTemplate(id);
  }

  // ========================================================
  // 3. TARGET AUDIENCES (ADMIN)
  // ========================================================

  @Get('audiences/count')
  @Roles('ADMIN')
  async getAudienceCount(@Query('target_type') targetType: any) {
    const count = await this.audienceService.getAudienceCount(targetType || 'all_users');
    return { target_type: targetType, count };
  }

  // ========================================================
  // 4. BULK EMAIL CAMPAIGNS & AUDIT LOGS (ADMIN)
  // ========================================================

  @Post('send-bulk')
  @Roles('ADMIN')
  async sendBulkEmail(@Body() body: SendBulkEmailDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.campaignsService.sendBulkCampaign(body, userId);
  }

  @Get()
  @Roles('ADMIN')
  async getCampaigns(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.campaignsService.getCampaigns(
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('outbox/logs')
  @Roles('ADMIN')
  async getOutboxLogs(
    @Query('campaign_id') campaignId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.campaignsService.getOutboxLogs({
      campaignId,
      search,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}


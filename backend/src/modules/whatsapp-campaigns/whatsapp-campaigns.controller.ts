import {
  Controller,
  Inject,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { WhatsappCampaignsService } from './whatsapp-campaigns.service';
import { WhatsappTemplateService } from './whatsapp-template.service';
import {
  SaveWhatsappConfigDto,
  TestWhatsappGatewayDto,
  SendBulkWhatsappDto,
} from './dto/whatsapp-campaign.dto';
import { RequireModule, SkipModuleCheck } from '../../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.WHATSAPP_CAMPAIGNS)
@Controller('campaigns/whatsapp')
export class WhatsappCampaignsController {
  constructor(
    @Inject(WhatsappCampaignsService)
    private readonly campaignsService: WhatsappCampaignsService,
    @Inject(WhatsappTemplateService)
    private readonly templateService: WhatsappTemplateService,
  ) {}

  // ========================================================
  // 1. SUPER ADMIN GATEWAY SETTINGS
  // ========================================================

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Get('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async getConfig() {
    return this.campaignsService.getConfig();
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async saveConfig(@Body() body: SaveWhatsappConfigDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.campaignsService.saveConfig(body, userId);
  }

  @RequireModule(MODULE_KEYS.INTEGRATIONS)
  @Post('config/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async testGateway(@Body() body: TestWhatsappGatewayDto) {
    return this.campaignsService.testGateway(body);
  }

  // ========================================================
  // 2. TEMPLATES (Synced with Meta Cloud API)
  // ========================================================

  @Get('templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listTemplates(@Query('activeOnly') activeOnly?: string) {
    return this.templateService.listTemplates(activeOnly === 'true');
  }

  @Post('templates/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async syncTemplates() {
    return this.templateService.syncMetaTemplates();
  }

  // ========================================================
  // 3. AUDIENCES & CAMPAIGN DISPATCH
  // ========================================================

  @Get('audiences/webinars')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listWebinarAudiences() {
    return this.campaignsService.listWebinarAudiences();
  }

  @Post('send-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async sendBulk(@Body() body: SendBulkWhatsappDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.user_id;
    return this.campaignsService.sendBulkCampaign(body, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listCampaigns(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.campaignsService.listCampaigns(Number(limit), Number(offset));
  }

  // ========================================================
  // 4. OUTBOX LOGS & STATS
  // ========================================================

  @Get('outbox/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listOutboxLogs(
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
    @Query('status') status?: string,
  ) {
    return this.campaignsService.listOutboxLogs(
      Number(limit),
      Number(offset),
      status,
    );
  }

  @Get('outbox/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getOutboxStats() {
    return this.campaignsService.getOutboxStats();
  }

  // ========================================================
  // 5. PUBLIC WEBHOOK FOR META HANDSHAKE & DELIVERY STATUS
  // ========================================================

  @SkipModuleCheck()
  @Get('webhook')
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const validChallenge = this.campaignsService.verifyWebhook(mode, token, challenge);
    if (validChallenge) {
      return res.status(HttpStatus.OK).send(validChallenge);
    }
    throw new ForbiddenException('Invalid Meta webhook verification token');
  }

  @SkipModuleCheck()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    await this.campaignsService.processWebhook(payload);
    return { success: true };
  }
}


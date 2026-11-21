import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WhatsappCampaignsRepository } from './whatsapp-campaigns.repository';
import { MetaWhatsappProvider } from './providers/meta-whatsapp.provider';
import { WhatsappTemplateService } from './whatsapp-template.service';
import { WhatsappCampaignsService } from './whatsapp-campaigns.service';
import { WhatsappCampaignsController } from './whatsapp-campaigns.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [WhatsappCampaignsController],
  providers: [
    WhatsappCampaignsRepository,
    MetaWhatsappProvider,
    WhatsappTemplateService,
    WhatsappCampaignsService,
  ],
  exports: [
    WhatsappCampaignsService,
    WhatsappTemplateService,
    MetaWhatsappProvider,
  ],
})
export class WhatsappCampaignsModule {}


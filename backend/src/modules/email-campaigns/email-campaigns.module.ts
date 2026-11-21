import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmailCampaignsRepository } from './email-campaigns.repository';
import { EmailSmtpProvider } from './providers/email-smtp.provider';
import { EmailAudienceService } from './email-audience.service';
import { EmailTemplateService } from './email-template.service';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailCampaignsController } from './email-campaigns.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [EmailCampaignsController],
  providers: [
    EmailCampaignsRepository,
    EmailSmtpProvider,
    EmailAudienceService,
    EmailTemplateService,
    EmailCampaignsService,
  ],
  exports: [
    EmailCampaignsService,
    EmailTemplateService,
    EmailSmtpProvider,
  ],
})
export class EmailCampaignsModule {}


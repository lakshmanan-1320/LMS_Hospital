import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SmsTemplateService } from './sms-template.service';
import { SmsAudienceService } from './sms-audience.service';
import { SmsRepository } from './sms.repository';
import { SmsProviderFactory } from './providers/sms-provider.factory';
import { Msg91Provider } from './providers/msg91.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';
import { RolesGuard } from '../../common/guards/roles.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), DatabaseModule],
  controllers: [SmsController],
  providers: [
    SmsService,
    SmsTemplateService,
    SmsAudienceService,
    SmsRepository,
    SmsProviderFactory,
    Msg91Provider,
    MockSmsProvider,
    RolesGuard,
  ],
  exports: [SmsService, SmsTemplateService, SmsRepository],
})
export class SmsModule {}

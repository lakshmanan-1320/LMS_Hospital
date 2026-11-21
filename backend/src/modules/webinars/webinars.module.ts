import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { WebinarsController } from './webinars.controller';
import { WebinarsService } from './webinars.service';
import { WebinarsRepository } from './webinars.repository';
import { MeetingProvidersRepository } from './meeting-providers.repository';
import { WebinarProviderFactory } from './providers/webinar-provider.factory';
import { GoogleMeetProvider } from './providers/google-meet.provider';
import { ZoomProvider } from './providers/zoom.provider';
import { ZohoMeetingProvider } from './providers/zoho-meeting.provider';
import { CertificatesModule } from '../../certificates/certificates.module';
import { WebinarAdminGuard } from './guards/webinar-admin.guard';
import { WebinarHostGuard } from './guards/webinar-host.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({}), CertificatesModule],
  controllers: [WebinarsController],
  providers: [
    WebinarsService,
    WebinarsRepository,
    MeetingProvidersRepository,
    WebinarProviderFactory,
    GoogleMeetProvider,
    ZoomProvider,
    ZohoMeetingProvider,
    WebinarAdminGuard,
    WebinarHostGuard,
  ],
  exports: [WebinarsService, WebinarsRepository],
})
export class WebinarsModule {}


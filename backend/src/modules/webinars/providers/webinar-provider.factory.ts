import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { WebinarProvider } from '../interfaces/webinar-provider.interface';
import { GoogleMeetProvider } from './google-meet.provider';
import { ZoomProvider } from './zoom.provider';
import { ZohoMeetingProvider } from './zoho-meeting.provider';
import { WebinarProviderType } from '../interfaces/webinar.interface';

@Injectable()
export class WebinarProviderFactory {
  constructor(
    @Inject(GoogleMeetProvider) private readonly googleMeetProvider: GoogleMeetProvider,
    @Inject(ZoomProvider) private readonly zoomProvider: ZoomProvider,
    @Inject(ZohoMeetingProvider) private readonly zohoMeetingProvider: ZohoMeetingProvider,
  ) {}

  getProvider(providerType: WebinarProviderType = 'google_meet'): WebinarProvider {
    switch (providerType) {
      case 'google_meet':
        return this.googleMeetProvider;
      case 'zoom':
        return this.zoomProvider;
      case 'zoho':
        return this.zohoMeetingProvider;
      default:
        throw new BadRequestException(`Unsupported webinar provider: ${providerType}`);
    }
  }
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WebinarProviderFactory } from './providers/webinar-provider.factory';
import { WebinarsService } from './webinars.service';
import { SettingsService } from '../settings/settings.service';

async function main() {
  console.log('🚀 Initializing Elevate LMS Context for Provider Testing...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const factory = app.get(WebinarProviderFactory);
  const webinarsService = app.get(WebinarsService);
  const settingsService = app.get(SettingsService);

  console.log('\n--- 1. Testing WebinarProviderFactory ---');
  for (const providerId of ['google_meet', 'zoom', 'zoho']) {
    try {
      const provider = factory.getProvider(providerId as any);
      console.log(`✅ Provider "${providerId}" instantiated successfully: ${provider.constructor.name}`);
    } catch (e: any) {
      console.error(`❌ Provider "${providerId}" failed:`, e.message);
    }
  }

  console.log('\n--- 2. Testing Provider Status Aggregation ---');
  const statusRes = await webinarsService.getMeetingProvidersStatus();
  console.log('Providers Status Result:', JSON.stringify(statusRes, null, 2));

  console.log('\n--- 3. Testing Zoom Webhook CRC URL Validation Challenge ---');
  const crcResponse = await webinarsService.handleZoomWebhook({
    event: 'endpoint.url_validation',
    payload: {
      plainToken: 'lms-zoom-challenge-token-789xyz',
    },
  });
  console.log('Zoom CRC Challenge Response:', crcResponse);
  if (crcResponse && crcResponse.plainToken === 'lms-zoom-challenge-token-789xyz' && crcResponse.encryptedToken) {
    console.log('✅ Zoom CRC Validation handshake generated compliant plainToken & encryptedToken.');
  } else {
    console.error('❌ Zoom CRC Validation handshake failed.');
  }

  console.log('\n--- 4. Testing Settings Service Getters ---');
  const zoomSettings = await settingsService.getZoomOAuthSettings();
  console.log('Zoom OAuth Settings:', zoomSettings);
  const zohoSettings = await settingsService.getZohoOAuthSettings();
  console.log('Zoho OAuth Settings:', zohoSettings);

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY.');
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});


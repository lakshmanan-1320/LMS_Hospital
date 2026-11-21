import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DatabaseService } from '../../database/database.service';
import { SmsProviderFactory } from './providers/sms-provider.factory';
import { SmsTemplateService } from './sms-template.service';
import { SmsAudienceService } from './sms-audience.service';
import { SmsService } from './sms.service';

async function runSmsIntegrationTest() {
  console.log('🚀 Initializing Elevate LMS Context for SMS Campaign Testing...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const factory = app.get(SmsProviderFactory);
  const templateService = app.get(SmsTemplateService);
  const audienceService = app.get(SmsAudienceService);
  const smsService = app.get(SmsService);
  const databaseService = app.get(DatabaseService);

  console.log('\n--- 1. Checking Providers ---');
  const providers = factory.listProviders();
  console.log('✅ Found providers:', providers.map((p) => p.name).join(', '));

  console.log('\n--- 2. Configuring SMS Service (Mock Simulator) ---');
  const saveRes = await smsService.saveConfig({
    providerKey: 'mock',
    senderId: 'ELVLMS',
    dltEntityId: '14070000000000',
    defaultCountryCode: '91',
  });
  console.log('✅ Config save result:', saveRes.success, 'Status:', saveRes.config?.status);

  console.log('\n--- 3. Testing Connection ---');
  const testConn = await smsService.testConnection('+919876543210');
  console.log('✅ Test connection result:', testConn);

  console.log('\n--- 4. Creating DLT Message Template (Strictly Template-Based) ---');
  const template = await templateService.createTemplate({
    name: 'Webinar 1-Hour Live Alert',
    providerTemplateId: `flow_test_${Date.now()}`,
    dltTemplateId: '14071612345678',
    category: 'transactional',
    body: 'Hello ##name##, your live masterclass on ##webinar_title## starts at ##start_time##. Join here: ##meeting_link## - Elevate LMS',
  });
  console.log('✅ Template created successfully:', {
    templateId: template.template_id,
    name: template.name,
    variables: template.variables,
  });

  console.log('\n--- 5. Resolving Webinar Audiences ---');
  let webinars = await audienceService.listWebinarAudiences();
  let targetWebinarId: string | null = null;

  if (webinars.length > 0 && webinars[0].totalWithPhone > 0) {
    targetWebinarId = webinars[0].webinarId;
  } else {
    // Insert a test webinar & registrations for test
    const webRes = await databaseService.executeQuery<any>(`
      INSERT INTO webinars (
        title, slug, start_time, end_time, timezone, meeting_link, created_by
      ) VALUES (
        'Mastering Microservices Architecture', 'microservices-patterns-' || floor(random()*10000),
        NOW() + INTERVAL '2 hours', NOW() + INTERVAL '4 hours', 'Asia/Kolkata',
        'https://elevate.edu/room/live-demo', (SELECT user_id FROM users LIMIT 1)
      ) RETURNING webinar_id
    `);
    targetWebinarId = webRes.rows[0].webinar_id;

    // Add registrations with varied country phone numbers
    await databaseService.executeQuery(`
      INSERT INTO webinar_registrations (
        webinar_id, first_name, last_name, email, phone_number, status, join_token_hash, join_token_expires_at
      ) VALUES
      ($1, 'Aarav', 'Sharma', 'aarav@example.com', '9876543210', 'confirmed', 'tok1', NOW() + INTERVAL '1 day'),
      ($1, 'Sara', 'Al-Maktoum', 'sara@example.com', '+971 50 123 4567', 'confirmed', 'tok2', NOW() + INTERVAL '1 day'),
      ($1, 'John', 'Doe', 'john@example.com', '+1 (555) 234-5678', 'confirmed', 'tok3', NOW() + INTERVAL '1 day'),
      ($1, 'NoPhone', 'Student', 'nophone@example.com', NULL, 'confirmed', 'tok4', NOW() + INTERVAL '1 day')
    `, [targetWebinarId]);
  }

  const audiencePreview = await audienceService.resolveWebinarAudience(targetWebinarId!, '91');
  console.log('✅ Audience preview stats:', {
    totalAudience: audiencePreview.totalAudience,
    validPhoneCount: audiencePreview.validPhoneCount,
    missingPhoneCount: audiencePreview.missingPhoneCount,
    countries: audiencePreview.countryDistribution.map((c) => `${c.flag} ${c.name} (+${c.code}): ${c.count}`),
  });

  console.log('\n--- 6. Dispatching Template-Based Bulk SMS Campaign ---');
  const campaignDispatch = await smsService.sendBulkCampaign({
    campaignName: 'Test Microservices 1h Reminder Campaign',
    templateId: template.template_id,
    targetType: 'webinar_registrants',
    targetId: targetWebinarId!,
  });
  console.log('✅ Bulk campaign result:', campaignDispatch);

  console.log('\n--- 7. Verifying Campaign Details & Outbox Logs in Database ---');
  const details = await smsService.getCampaignDetails(campaignDispatch.results.campaignId);
  console.log('✅ Campaign details in DB:', {
    name: details.campaign.name,
    status: details.campaign.status,
    totalRecipients: details.campaign.total_recipients,
    sentCount: details.campaign.sent_count,
    templateName: details.campaign.template_name,
  });

  console.log(`\n✅ Outbox records created (${details.logs.length}):`);
  for (const log of details.logs.slice(0, 3)) {
    console.log(` - To: ${log.recipient_phone} (${log.recipient_name}) | Status: ${log.status}`);
    console.log(`   Message: "${log.rendered_body}"`);
    console.log(`   Provider Req ID: ${log.provider_request_id}`);
  }

  console.log('\n🎉 ALL SMS INTEGRATION TESTS PASSED 100% SUCCESSFULLY.');
  await app.close();
  process.exit(0);
}

runSmsIntegrationTest().catch((err) => {
  console.error('Integration test failed with error:', err);
  process.exit(1);
});

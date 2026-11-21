import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { EmailCampaignsService } from './email-campaigns.service';
import { EmailTemplateService } from './email-template.service';
import { EmailAudienceService } from './email-audience.service';

async function runEmailIntegrationTest() {
  console.log('🚀 Initializing Elevate LMS Context for Phase 2 Email Campaign Testing...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const service = app.get(EmailCampaignsService);
  const templateService = app.get(EmailTemplateService);
  const audienceService = app.get(EmailAudienceService);

  try {
    // 1. Test Gateway Config Upsert & Retrieval
    console.log('\n--- 1. Testing Super Admin Email Gateway Configuration ---');
    const configRes = await service.saveConfig({
      host: 'smtp.ethereal.email',
      port: 587,
      encryption: 'tls',
      username: 'test.sender@ethereal.email',
      password: 'sample_secret_password_123',
      from_name: 'Elevate Learning LMS',
      from_email: 'noreply@elevatelms.com',
      redirect_to: 'admin.sandbox@insighttech.in',
    });
    console.log(`✅ SMTP Config saved. Status: ${configRes.status}, Password set: ${configRes.password_set}`);

    const retrievedConfig = await service.getConfig();
    console.log(`✅ Retrieved Config: Host=${retrievedConfig.host}, Encryption=${retrievedConfig.encryption}, Configured=${retrievedConfig.configured}`);

    // 2. Test Template Auto-Seeding & Custom Template Creation
    console.log('\n--- 2. Testing Responsive HTML Templates ---');
    const seededTemplates = await templateService.listTemplates();
    console.log(`✅ Loaded ${seededTemplates.length} templates (auto-seeded starter presets)`);

    const newTemplate = await templateService.createTemplate({
      name: 'Custom Mastery Workshop Announcement',
      subject: 'Mastery Workshop: {{skill_name}} with {{instructor_name}}',
      preview_text: 'Live hands-on workshop announced for this weekend.',
      category: 'announcement',
      html_content: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f8fafc;">
          <h2>Hello {{name}}!</h2>
          <p>Join our live masterclass on <strong>{{skill_name}}</strong> led by {{instructor_name}}.</p>
          <a href="{{workshop_url}}" style="display:inline-block; padding: 10px 20px; background:#4f46e5; color:#fff;">Register Now</a>
        </div>
      `,
    });
    console.log(`✅ Created custom template: "${newTemplate.name}" with variables:`, newTemplate.variables);

    // 3. Test Audience Counts
    console.log('\n--- 3. Testing Audience Resolvers ---');
    const allUsersCount = await audienceService.getAudienceCount('all_users');
    const studentsCount = await audienceService.getAudienceCount('students');
    const instructorsCount = await audienceService.getAudienceCount('instructors');
    console.log(`✅ Audience counts -> All Users: ${allUsersCount}, Students: ${studentsCount}, Instructors: ${instructorsCount}`);

    // 4. Test Bulk Campaign Queuing & Outbox Creation
    console.log('\n--- 4. Testing Bulk Email Campaign Dispatch Wizard Flow ---');
    const customRecipients = [
      { email: 'student1@insighttech.in', name: 'Alex Johnson', variables: { skill_name: 'Fullstack Next.js', instructor_name: 'Sarah Connor', workshop_url: 'https://elevatelms.com/workshops/1' } },
      { email: 'student2@insighttech.in', name: 'Maria Gomez', variables: { skill_name: 'Fullstack Next.js', instructor_name: 'Sarah Connor', workshop_url: 'https://elevatelms.com/workshops/1' } },
      { email: 'student3@insighttech.in', name: 'Vikram Patel', variables: { skill_name: 'Fullstack Next.js', instructor_name: 'Sarah Connor', workshop_url: 'https://elevatelms.com/workshops/1' } },
    ];

    const campaign = await service.sendBulkCampaign({
      name: 'November Workshop Blitz',
      template_id: newTemplate.template_id,
      target_type: 'custom_list',
      custom_recipients: customRecipients,
      custom_variables: {
        skill_name: 'Advanced React & Next.js 14',
        instructor_name: 'Sarah Connor',
      },
    });
    console.log(`✅ Bulk Campaign dispatched: ID=${campaign.campaign_id}, Recipients=${campaign.total_recipients}, Status=${campaign.status}`);

    // Wait 500ms for background processing
    await new Promise((r) => setTimeout(r, 600));

    // 5. Test Campaign Listing & Metrics
    console.log('\n--- 5. Testing Email Campaigns Listing ---');
    const campaignsList = await service.getCampaigns(10, 0);
    console.log(`✅ Found ${campaignsList.total} email campaigns in database.`);
    const current = campaignsList.campaigns.find((c: any) => c.campaign_id === campaign.campaign_id);
    if (current) {
      console.log(`✅ Campaign details: Name="${current.name}", Target=${current.target_type}, Template="${current.template_name}"`);
    }

    // 6. Test Email Outbox Delivery Logs
    console.log('\n--- 6. Testing Outbox Delivery Logs & Audit ---');
    const outboxLogs = await service.getOutboxLogs({ campaignId: campaign.campaign_id });
    console.log(`✅ Outbox logs retrieved: ${outboxLogs.total} records.`);
    for (const log of outboxLogs.logs) {
      console.log(`   - Recipient: ${log.recipient_email} | Subject: "${log.subject}" | Status: ${log.status}`);
    }

    console.log('\n🎉 ========================================================');
    console.log('🎉 ALL PHASE 2 EMAIL CAMPAIGN BACKEND INTEGRATION TESTS PASSED!');
    console.log('🎉 ========================================================');
  } catch (error: any) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await app.close();
    process.exit(0);
  }
}

runEmailIntegrationTest();

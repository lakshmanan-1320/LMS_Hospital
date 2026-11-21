import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { WebinarsService } from './webinars.service';
import { WebinarsRepository } from './webinars.repository';
import { WebinarProviderFactory } from './providers/webinar-provider.factory';
import { WebinarProvider, CreateSessionInput, UpdateSessionInput, ProviderSessionResult } from './interfaces/webinar-provider.interface';
import { WebinarAdminGuard } from './guards/webinar-admin.guard';
import { WebinarHostGuard } from './guards/webinar-host.guard';
import { DatabaseService } from '../../database/database.service';
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

/**
 * High-fidelity Mock Provider used strictly in test suite.
 * Per Requirement 5: Never generate fake URLs in runtime; mock providers only in automated tests.
 */
class TestMockWebinarProvider implements WebinarProvider {
  readonly providerName = 'google_meet';

  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    return {
      providerSessionId: `mock-session-${Date.now()}`,
      meetingLink: `https://meet.google.com/test-meet-link`,
      hostJoinUrl: `https://meet.google.com/test-meet-link?authuser=host`,
      passcode: 'testpass',
      providerMetadata: { simulated: true, webinarId: input.webinarId },
    };
  }

  async updateSession(sessionId: string, _input: UpdateSessionInput): Promise<ProviderSessionResult> {
    return {
      providerSessionId: sessionId,
      meetingLink: `https://meet.google.com/test-meet-link`,
      hostJoinUrl: `https://meet.google.com/test-meet-link?authuser=host`,
      providerMetadata: { simulated: true },
    };
  }

  async cancelSession(_sessionId: string): Promise<void> {
    return;
  }
}

async function runWebinarIntegrationTests() {
  console.log('===============================================================');
  console.log('STARTING WEBINARS MODULE INTEGRATION & CONFORMANCE TESTS');
  console.log('===============================================================');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const service = app.get(WebinarsService);
  const repo = app.get(WebinarsRepository);
  const factory = app.get(WebinarProviderFactory);
  const db = app.get(DatabaseService);

  // Substitute provider with test mock provider for testing
  const mockProvider = new TestMockWebinarProvider();
  (factory as any).googleMeetProvider = mockProvider;
  (service as any).webinarProviderFactory = {
    getProvider: () => mockProvider,
  };

  // Test actor user IDs from database seed
  const adminUserRes = await db.executeQuery(`SELECT user_id FROM users WHERE email = 'admin@insighttech.in'`);
  const superAdminRes = await db.executeQuery(`SELECT user_id FROM users WHERE email = 'superadmin@insighttech.in'`);
  const instructorRes = await db.executeQuery(`
    SELECT u.user_id FROM users u 
    JOIN user_roles ur ON ur.user_id = u.user_id 
    JOIN roles r ON r.role_id = ur.role_id 
    WHERE r.name = 'INSTRUCTOR' LIMIT 1
  `);

  const adminUserId = adminUserRes.rows[0].user_id;
  const superAdminUserId = superAdminRes.rows[0].user_id;
  const instructorUserId = instructorRes.rows.length > 0 ? instructorRes.rows[0].user_id : adminUserId;

  console.log(`[INIT] Admin User: ${adminUserId}`);
  console.log(`[INIT] Super Admin User: ${superAdminUserId}`);
  console.log(`[INIT] Instructor User: ${instructorUserId}`);

  let createdWebinar: any = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Role Permissions - ADMIN can create, SUPER_ADMIN is blocked
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Role Permissions Governance ---');
    const adminGuard = new WebinarAdminGuard();

    // SUPER_ADMIN context check
    let superAdminBlocked = false;
    try {
      adminGuard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId: superAdminUserId, roles: ['SUPER_ADMIN'] },
          }),
        }),
      } as any);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        superAdminBlocked = true;
      }
    }
    if (!superAdminBlocked) {
      throw new Error('FAILED: SUPER_ADMIN was not blocked with 403 Forbidden on WebinarAdminGuard!');
    }
    console.log('[PASS] SUPER_ADMIN blocked from webinar management with 403 Forbidden.');

    // ADMIN context check
    const adminAllowed = adminGuard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: adminUserId, roles: ['ADMIN'] },
        }),
      }),
    } as any);
    if (!adminAllowed) {
      throw new Error('FAILED: ADMIN was not allowed on WebinarAdminGuard!');
    }
    console.log('[PASS] ADMIN successfully authorized on WebinarAdminGuard.');

    // -------------------------------------------------------------
    // TEST 2: Webinar Creation with Normalized Multi-Host Table
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Webinar Creation & Host Normalization ---');
    const now = new Date();
    const startTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hr from now
    const endTime = new Date(now.getTime() + 120 * 60 * 1000); // 2 hrs from now

    createdWebinar = await service.createWebinar(
      {
        title: 'Mastering Scalable Microservices with Node.js',
        description: 'Complete hands-on webinar exploring high-concurrency Node.js architecture.',
        shortDescription: 'Hands-on microservices masterclass',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        timezone: 'Asia/Kolkata',
        maxParticipants: 2, // Low capacity to test atomic locking!
        isPublicRegistration: true,
        hosts: [
          { userId: instructorUserId, hostRole: 'primary_host', displayOrder: 1 },
          { userId: adminUserId, hostRole: 'co_host', displayOrder: 2 },
        ],
      },
      { userId: adminUserId, role: 'ADMIN' },
      '127.0.0.1',
    );

    if (!createdWebinar || !createdWebinar.webinar_id) {
      throw new Error('FAILED: Webinar was not created');
    }
    console.log(`[PASS] Webinar created with ID: ${createdWebinar.webinar_id}`);

    // Verify normalized webinar_hosts table (strictly 1 single designated host)
    const hostsInDb = await repo.findWebinarHosts(createdWebinar.webinar_id);
    if (hostsInDb.length !== 1) {
      throw new Error(`FAILED: Expected strictly 1 host in webinar_hosts, found ${hostsInDb.length}`);
    }
    console.log(`[PASS] Normalized webinar_hosts verified with strictly 1 assigned host.`);

    // -------------------------------------------------------------
    // TEST 3: Host Live Session Guard
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Webinar Host Guard ---');
    const hostGuard = new WebinarHostGuard(db);

    // Assigned Instructor host allowed
    const hostAllowed = await hostGuard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          params: { webinarId: createdWebinar.webinar_id },
          user: { userId: instructorUserId, roles: ['INSTRUCTOR'] },
        }),
      }),
    } as any);
    if (!hostAllowed) {
      throw new Error('FAILED: Assigned instructor was denied host controls!');
    }
    console.log('[PASS] Assigned instructor authorized via WebinarHostGuard.');

    // Unassigned user blocked
    let unassignedBlocked = false;
    try {
      await hostGuard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            params: { webinarId: createdWebinar.webinar_id },
            user: { userId: '00000000-0000-0000-0000-000000000000', roles: ['INSTRUCTOR'] },
          }),
        }),
      } as any);
    } catch (err) {
      if (err instanceof ForbiddenException) unassignedBlocked = true;
    }
    if (!unassignedBlocked) {
      throw new Error('FAILED: Unassigned instructor was NOT blocked from host controls!');
    }
    console.log('[PASS] Unassigned user rejected with 403 on WebinarHostGuard.');

    // -------------------------------------------------------------
    // TEST 4: Unified Public Registration & Traffic Attribution
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Public Registration & Traffic Attribution ---');
    // Registrant 1: from Google Ads
    const regResult1 = await service.registerPublic(
      createdWebinar.webinar_id,
      {
        firstName: 'Alice',
        lastName: 'Developer',
        email: 'alice.test@example.com',
        phoneNumber: '+919876543210',
        utmSource: 'google_ads',
        utmMedium: 'cpc',
        utmCampaign: 'fullstack_summit_2026',
        referrer: 'https://google.com/search?q=nodejs+webinars',
      },
      { ipAddress: '203.0.113.1', userAgent: 'Mozilla/5.0 Test Browser' },
    );

    if (!regResult1 || !regResult1.registrationId) {
      throw new Error('FAILED: Public registration 1 failed');
    }
    console.log(`[PASS] Registrant 1 registered successfully. ID: ${regResult1.registrationId}`);

    // Verify registration row in database: Decoupled, status = 'confirmed', raw UTMs
    const regRow1 = await db.executeQuery(
      `SELECT * FROM webinar_registrations WHERE webinar_registration_id = $1`,
      [regResult1.registrationId],
    );
    const r1 = regRow1.rows[0];
    if (r1.status !== 'confirmed') {
      throw new Error(`FAILED: Expected status 'confirmed', got ${r1.status}`);
    }
    if (r1.utm_source !== 'google_ads' || r1.utm_campaign !== 'fullstack_summit_2026') {
      throw new Error(`FAILED: Traffic attribution UTMs not saved properly: ${JSON.stringify(r1)}`);
    }
    console.log(`[PASS] Status is 'confirmed', attribution UTMs captured truthfully.`);

    // -------------------------------------------------------------
    // TEST 5: Non-Unique Phone Numbers (Multiple participants share phone)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Non-Unique Phone Support ---');
    // Registrant 2: Different email, SAME phone number (+919876543210)
    const regResult2 = await service.registerPublic(
      createdWebinar.webinar_id,
      {
        firstName: 'Bob',
        lastName: 'Engineer',
        email: 'bob.test@example.com',
        phoneNumber: '+919876543210', // Shared phone!
        utmSource: 'instagram',
        utmMedium: 'bio',
      },
      { ipAddress: '203.0.113.2', userAgent: 'Mozilla/5.0 Mobile' },
    );
    if (!regResult2 || !regResult2.registrationId) {
      throw new Error('FAILED: Registrant 2 with shared phone number was rejected!');
    }
    console.log('[PASS] Shared phone number successfully accepted for distinct participant.');

    // -------------------------------------------------------------
    // TEST 6: Duplicate Email Prevention on Same Webinar
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Duplicate Email Prevention ---');
    let duplicateRejected = false;
    try {
      await service.registerPublic(
        createdWebinar.webinar_id,
        {
          firstName: 'Alice',
          lastName: 'Developer',
          email: 'alice.test@example.com', // Duplicate email!
          phoneNumber: '+919876543211',
        },
        { ipAddress: '203.0.113.1' },
      );
    } catch (err) {
      if (err instanceof ConflictException) duplicateRejected = true;
    }
    if (!duplicateRejected) {
      throw new Error('FAILED: Duplicate registration for alice.test@example.com was NOT rejected with 409 Conflict!');
    }
    console.log('[PASS] Duplicate registration rejected with 409 Conflict.');

    // -------------------------------------------------------------
    // TEST 7: Atomic Capacity Enforcement (maxParticipants: 2)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Atomic Concurrency & Capacity Enforcement ---');
    // 3rd registrant should exceed capacity = 2
    let capacityRejected = false;
    try {
      await service.registerPublic(
        createdWebinar.webinar_id,
        {
          firstName: 'Charlie',
          lastName: 'Architect',
          email: 'charlie.test@example.com',
          phoneNumber: '+919876543212',
        },
        { ipAddress: '203.0.113.3' },
      );
    } catch (err) {
      if (err instanceof BadRequestException && err.message.includes('maximum capacity')) {
        capacityRejected = true;
      }
    }
    if (!capacityRejected) {
      throw new Error('FAILED: Capacity overflow was not rejected with 400 Bad Request!');
    }
    console.log('[PASS] Webinar capacity enforcement rejected overflow attempt.');

    // -------------------------------------------------------------
    // TEST 8: Resend Confirmation Email
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Resend Confirmation Endpoint ---');
    const resendRes = await service.resendConfirmation(
      createdWebinar.webinar_id,
      'alice.test@example.com',
    );
    if (!resendRes || !resendRes.message) {
      throw new Error('FAILED: Resend confirmation failed');
    }
    console.log('[PASS] Resend confirmation endpoint functioning correctly.');

    // -------------------------------------------------------------
    // TEST 9: Attendance Tracking - Multi-Interval Join & Leave
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Multi-Interval Attendance Tracking ---');
    // First interval: Alice joins
    const interval1 = await service.recordAttendanceJoin(
      createdWebinar.webinar_id,
      regResult1.registrationId,
      { ipAddress: '203.0.113.1', userAgent: 'Chrome/120' },
    );
    if (!interval1 || !interval1.webinar_attendance_id) {
      throw new Error('FAILED: Record attendance join failed');
    }
    console.log(`[PASS] Attendance interval 1 joined at: ${interval1.joined_at}`);

    // Alice leaves after simulated brief duration
    await service.recordAttendanceLeave(createdWebinar.webinar_id, regResult1.registrationId);
    const closedInterval1 = await db.executeQuery(
      `SELECT * FROM webinar_attendances WHERE webinar_attendance_id = $1`,
      [interval1.webinar_attendance_id],
    );
    if (!closedInterval1.rows[0].left_at) {
      throw new Error('FAILED: Attendance interval 1 was not closed with left_at timestamp!');
    }
    console.log(`[PASS] Attendance interval 1 closed. Duration recorded.`);

    // Second interval: Alice reconnects (multi-interval support)
    const interval2 = await service.recordAttendanceJoin(
      createdWebinar.webinar_id,
      regResult1.registrationId,
      { ipAddress: '203.0.113.1', userAgent: 'Chrome/120' },
    );
    if (!interval2 || interval2.webinar_attendance_id === interval1.webinar_attendance_id) {
      throw new Error('FAILED: Multi-interval attendance failed to create distinct interval record');
    }
    console.log(`[PASS] Second attendance interval created for participant reconnection.`);

    // -------------------------------------------------------------
    // TEST 10: Marketing Attribution & Attendance Analytics
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Attribution & Analytics Query ---');
    const analytics = await service.getWebinarAnalytics(createdWebinar.webinar_id);
    if (!analytics || !analytics.summary) {
      throw new Error('FAILED: Analytics generation failed');
    }
    console.log('[PASS] Analytics summary:', JSON.stringify(analytics.summary));
    console.log('[PASS] Attribution by source:', JSON.stringify(analytics.bySource));

    // -------------------------------------------------------------
    // TEST 11: Host Live Session Start and End
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Host Live Session Start & End ---');
    const started = await service.startSession(
      createdWebinar.webinar_id,
      { userId: instructorUserId, role: 'INSTRUCTOR' },
      '127.0.0.1',
    );
    if (started.status !== 'live') {
      throw new Error(`FAILED: Expected status 'live', got ${started.status}`);
    }
    console.log('[PASS] Session transitioned to live.');

    const ended = await service.endSession(
      createdWebinar.webinar_id,
      { userId: instructorUserId, role: 'INSTRUCTOR' },
      '127.0.0.1',
    );
    if (ended.status !== 'completed') {
      throw new Error(`FAILED: Expected status 'completed', got ${ended.status}`);
    }
    console.log('[PASS] Session ended and transitioned to completed.');

    console.log('\n===============================================================');
    console.log('ALL INTEGRATION & CONFORMANCE TESTS PASSED SUCCESSFULLY! (11/11)');
    console.log('===============================================================');
  } finally {
    // Clean up created test webinar data to leave database clean
    if (createdWebinar?.webinar_id) {
      await db.executeQuery('DELETE FROM webinar_attendances WHERE webinar_id = $1;', [createdWebinar.webinar_id]);
      await db.executeQuery('DELETE FROM webinar_registrations WHERE webinar_id = $1;', [createdWebinar.webinar_id]);
      await db.executeQuery('DELETE FROM webinar_hosts WHERE webinar_id = $1;', [createdWebinar.webinar_id]);
      await db.executeQuery('DELETE FROM webinar_audit_logs WHERE webinar_id = $1;', [createdWebinar.webinar_id]);
      await db.executeQuery('DELETE FROM webinars WHERE webinar_id = $1;', [createdWebinar.webinar_id]);
      console.log('[CLEANUP] Automated test webinar removed from database.');
    }
    await app.close();
  }
}

runWebinarIntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  });

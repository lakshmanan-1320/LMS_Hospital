/**
 * Zoom personal join links: only registered emails can join.
 *
 * Part A: ZoomProvider against a stubbed Zoom API (no network).
 * Part B: WebinarsService registration/resend/join flow against the real database,
 *         with a mock Zoom provider and a captured email transport.
 *
 * Run: npx ts-node --transpile-only src/modules/webinars/test-zoom-personal-links.ts
 */
import { NestFactory } from '@nestjs/core';
import * as crypto from 'crypto';
import { AppModule } from '../../app.module';
import { WebinarsService } from './webinars.service';
import { DatabaseService } from '../../database/database.service';
import { ZoomProvider } from './providers/zoom.provider';
import {
  WebinarProvider,
  CreateSessionInput,
  UpdateSessionInput,
  ProviderSessionResult,
  AttendeeResult,
} from './interfaces/webinar-provider.interface';

let passed = 0;
function check(condition: any, label: string) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  passed++;
  console.log(`[PASS] ${label}`);
}

// ---------------------------------------------------------------------------
// Part A: ZoomProvider with a stubbed Zoom API
// ---------------------------------------------------------------------------
type FetchCall = { url: string; method: string; body: any };

function makeZoomProvider() {
  const provider = new ZoomProvider({ get: () => undefined } as any, {} as any, {} as any);
  (provider as any).getAccessToken = async () => 'test-token';
  return provider;
}

function stubFetch(handler: (call: FetchCall) => { status: number; body?: any }) {
  const calls: FetchCall[] = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const call = { url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const { status, body } = handler(call);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body ?? {},
      text: async () => JSON.stringify(body ?? {}),
    };
  };
  return calls;
}

async function runProviderTests() {
  console.log('\n--- PART A: ZoomProvider (stubbed Zoom API) ---');
  const realFetch = globalThis.fetch;
  try {
    // A1: new meetings are registration-only, with Zoom's own emails off
    let calls = stubFetch(() => ({
      status: 201,
      body: { id: 111, join_url: 'https://zoom.us/j/111?pwd=x', start_url: 'https://zoom.us/s/111', password: 'x' },
    }));
    const zoom = makeZoomProvider();
    const created = await zoom.createSession({
      webinarId: 'w1',
      title: 'T',
      startTime: new Date(Date.now() + 3600_000),
      endTime: new Date(Date.now() + 7200_000),
      timezone: 'UTC',
      hostEmail: 'host@example.com',
    });
    const settings = calls[0].body.settings;
    check(settings.approval_type === 1, 'A1 meeting uses manual approval (strangers stay pending)');
    check(settings.registrants_email_notification === false && settings.registrants_confirmation_email === false, 'A1 Zoom registration emails are off');
    check(settings.registrants_restrict_number_of_devices === true, 'A1 personal link limited to one device');
    check(created.providerMetadata.registrationEnforced === true, 'A1 meeting flagged as registration-enforced');

    // A2: adding a registrant returns their personal link, auto-approved
    calls = stubFetch(() => ({
      status: 201,
      body: { id: 111, registrant_id: 'reg-1', join_url: 'https://zoom.us/w/111?tk=personal-1' },
    }));
    let res = (await zoom.addAttendee('111', { email: 'Alice@Example.com', displayName: 'Alice Smith' })) as AttendeeResult;
    check(res.ok && res.joinUrl === 'https://zoom.us/w/111?tk=personal-1' && res.registrantId === 'reg-1', 'A2 addAttendee returns personal join link');
    check(calls[0].body.auto_approve === true && calls[0].body.email === 'alice@example.com', 'A2 registrant auto-approved with normalized email');

    // A3: already registered -> existing approved registrant's link is returned
    calls = stubFetch((c) => {
      if (c.method === 'POST') return { status: 400, body: { code: 3027, message: 'Registrant already exists' } };
      if (c.url.includes('status=approved')) {
        return { status: 200, body: { registrants: [{ id: 'reg-9', email: 'alice@example.com', join_url: 'https://zoom.us/w/111?tk=existing' }] } };
      }
      return { status: 200, body: { registrants: [] } };
    });
    res = (await zoom.addAttendee('111', { email: 'alice@example.com' })) as AttendeeResult;
    check(res.ok && res.joinUrl === 'https://zoom.us/w/111?tk=existing' && res.registrantId === 'reg-9', 'A3 retry returns existing registrant link');

    // A4: existing registrant is pending -> approved via status API
    calls = stubFetch((c) => {
      if (c.method === 'POST') return { status: 400, body: { message: 'Registrant already exists' } };
      if (c.method === 'PUT') return { status: 204 };
      if (c.url.includes('status=pending')) {
        return { status: 200, body: { registrants: [{ id: 'reg-p', email: 'bob@example.com', join_url: 'https://zoom.us/w/111?tk=bob' }] } };
      }
      return { status: 200, body: { registrants: [] } };
    });
    res = (await zoom.addAttendee('111', { email: 'bob@example.com' })) as AttendeeResult;
    const approveCall = calls.find((c) => c.method === 'PUT');
    check(res.ok && approveCall?.body.action === 'approve' && approveCall.body.registrants[0].id === 'reg-p', 'A4 pending registrant gets approved');

    // A5: Zoom rejects and no registrant exists -> reported as failure (used to return true)
    stubFetch((c) =>
      c.method === 'POST'
        ? { status: 400, body: { code: 200, message: 'Only available for paid users' } }
        : { status: 200, body: { registrants: [] } },
    );
    res = (await zoom.addAttendee('111', { email: 'carol@example.com' })) as AttendeeResult;
    check(!res.ok && /paid users/.test(res.error || ''), 'A5 Zoom rejection is reported as failure');

    // A6: enforceRegistrationSettings patches an existing meeting
    calls = stubFetch(() => ({ status: 204 }));
    await zoom.enforceRegistrationSettings('222');
    check(calls[0].method === 'PATCH' && calls[0].body.settings.approval_type === 1, 'A6 existing meeting switched to manual approval');

    // A7: removeAttendee cancels the registrant
    calls = stubFetch(() => ({ status: 204 }));
    const removed = await zoom.removeAttendee('111', { registrantId: 'reg-1', email: 'alice@example.com' });
    check(removed && calls[0].body.action === 'cancel', 'A7 removeAttendee cancels the registrant');
  } finally {
    (globalThis as any).fetch = realFetch;
  }
}

// ---------------------------------------------------------------------------
// Part B: WebinarsService with the database
// ---------------------------------------------------------------------------
const SHARED_LINK = 'https://zoom.us/j/999000?pwd=SHAREDPWD';

class MockZoomProvider implements WebinarProvider {
  readonly providerName = 'zoom';
  fail = false;
  enforceCalls = 0;
  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    return {
      providerSessionId: `zoom-${input.webinarId}`,
      meetingLink: SHARED_LINK,
      hostJoinUrl: 'https://zoom.us/s/999000',
      passcode: 'SHAREDPWD',
      providerMetadata: { registrationEnforced: true },
    };
  }
  async updateSession(sessionId: string, _input: UpdateSessionInput): Promise<ProviderSessionResult> {
    return { providerSessionId: sessionId, meetingLink: SHARED_LINK, providerMetadata: {} };
  }
  async cancelSession(): Promise<void> {}
  async addAttendee(_sessionId: string, attendee: { email: string }): Promise<AttendeeResult> {
    if (this.fail) return { ok: false, error: 'Zoom unavailable (test)' };
    const tk = crypto.createHash('sha1').update(attendee.email).digest('hex').slice(0, 12);
    return { ok: true, registrantId: `reg-${tk}`, joinUrl: `https://zoom.us/w/999000?tk=${tk}` };
  }
  async enforceRegistrationSettings(): Promise<void> {
    this.enforceCalls++;
  }
}

class MockGoogleProvider implements WebinarProvider {
  readonly providerName = 'google_meet';
  async createSession(input: CreateSessionInput): Promise<ProviderSessionResult> {
    return { providerSessionId: `g-${input.webinarId}`, meetingLink: 'https://meet.google.com/abc-defg-hij', providerMetadata: {} };
  }
  async updateSession(sessionId: string): Promise<ProviderSessionResult> {
    return { providerSessionId: sessionId, meetingLink: 'https://meet.google.com/abc-defg-hij', providerMetadata: {} };
  }
  async cancelSession(): Promise<void> {}
  async addAttendee(): Promise<boolean> {
    return true;
  }
}

async function waitFor<T>(fn: () => T | undefined, ms = 3000): Promise<T | undefined> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  return undefined;
}

async function runServiceTests() {
  console.log('\n--- PART B: WebinarsService registration flow (database) ---');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
  const service = app.get(WebinarsService);
  const db = app.get(DatabaseService);

  const zoomMock = new MockZoomProvider();
  const googleMock = new MockGoogleProvider();
  (service as any).webinarProviderFactory = {
    getProvider: (type: string) => (type === 'zoom' ? zoomMock : googleMock),
  };
  const sent: any[] = [];
  (service as any).emailService = { sendEmail: async (opts: any) => { sent.push(opts); } };

  const adminRes = await db.executeQuery(`SELECT user_id FROM users WHERE email = 'admin@insighttech.in'`);
  const adminUserId = adminRes.rows[0].user_id;
  const actor = { userId: adminUserId, role: 'ADMIN' };
  const createdIds: string[] = [];
  const stamp = Date.now();

  const makeWebinar = async (provider: 'zoom' | 'google_meet', title: string) => {
    const w = await service.createWebinar(
      {
        title,
        startTime: new Date(Date.now() + 5 * 60_000).toISOString(), // inside the 15-min join window
        endTime: new Date(Date.now() + 65 * 60_000).toISOString(),
        timezone: 'UTC',
        maxParticipants: 50,
        isPublicRegistration: true,
        provider,
        hosts: [{ userId: adminUserId, hostRole: 'primary_host', displayOrder: 1 }],
      } as any,
      actor,
      '127.0.0.1',
    );
    createdIds.push(w.webinar_id);
    return w;
  };
  const getReg = async (id: string) =>
    (await db.executeQuery(`SELECT * FROM webinar_registrations WHERE webinar_registration_id = $1`, [id])).rows[0];
  const register = (webinarId: string, email: string) =>
    service.registerPublic(webinarId, { firstName: 'Test', lastName: 'User', email } as any, { ipAddress: '127.0.0.1' });

  try {
    const zoomWebinar = await makeWebinar('zoom', `Zoom personal links ${stamp}`);

    // B1: registration stores the personal link and sends ONE email with only that link
    const email1 = `zoom-a-${stamp}@example.com`;
    const r1 = await register(zoomWebinar.webinar_id, email1);
    const reg1 = await getReg(r1.registrationId);
    check(reg1.provider_sync_status === 'synced' && reg1.provider_join_url?.includes('?tk='), 'B1 registration stored personal join link');
    const mail1 = await waitFor(() => sent.find((m) => m.to === email1));
    check(mail1, 'B1 confirmation email sent');
    check(mail1.html.includes(reg1.provider_join_url), 'B1 email contains the personal link');
    check(!mail1.html.includes(SHARED_LINK) && !mail1.html.includes('SHAREDPWD'), 'B1 email has no shared link or passcode');
    check(!mail1.html.includes('/join?token='), 'B1 email has no second (LMS join page) link');
    check(String(mail1.attachments?.[0]?.content).includes(reg1.provider_join_url), 'B1 calendar invite uses the personal link');
    check(sent.filter((m) => m.to === email1).length === 1, 'B1 exactly one email sent to registrant');

    // B2: provider failure -> registration saved, no email; resend syncs and sends the link
    zoomMock.fail = true;
    const email2 = `zoom-b-${stamp}@example.com`;
    const r2 = await register(zoomWebinar.webinar_id, email2);
    const reg2 = await getReg(r2.registrationId);
    check(/shortly/.test(r2.message) && reg2.provider_sync_status === 'failed' && !reg2.provider_join_url, 'B2 failed sync saved as failed, link pending');
    await new Promise((r) => setTimeout(r, 300));
    check(!sent.some((m) => m.to === email2), 'B2 no email with a shared link sent on failure');

    let resendBlocked = false;
    try {
      await service.resendConfirmation(zoomWebinar.webinar_id, email2);
    } catch (e: any) {
      resendBlocked = e?.status === 503;
    }
    check(resendBlocked, 'B2 resend refuses while provider is still failing');

    zoomMock.fail = false;
    await service.resendConfirmation(zoomWebinar.webinar_id, email2);
    const reg2b = await getReg(r2.registrationId);
    const mail2 = sent.find((m) => m.to === email2);
    check(reg2b.provider_sync_status === 'synced' && reg2b.provider_sync_attempts === 3, 'B2 resend synced the registrant');
    check(mail2?.html.includes(reg2b.provider_join_url) && !mail2.html.includes(SHARED_LINK), 'B2 resent email carries only the personal link');

    // B3: join page (older emails) hands out the personal link, never the shared one
    const rawToken = crypto.randomBytes(32).toString('hex');
    await db.executeQuery(`UPDATE webinar_registrations SET join_token_hash = $1 WHERE webinar_registration_id = $2`, [
      crypto.createHash('sha256').update(rawToken).digest('hex'),
      r1.registrationId,
    ]);
    const joined = await service.authorizeJoin(zoomWebinar.webinar_id, rawToken);
    check(joined.meetingLink === reg1.provider_join_url && !joined.passcode, 'B3 authorizeJoin returns personal link without passcode');

    // B4: admin registrant list never exposes personal links or token hashes
    const list = await service.getWebinarRegistrants(zoomWebinar.webinar_id, {});
    const rows = (list as any).data;
    check(rows.length === 2 && rows.every((r: any) => !('provider_join_url' in r) && !('join_token_hash' in r)), 'B4 admin list hides personal links');
    check(rows.every((r: any) => r.provider_sync_status === 'synced'), 'B4 admin list shows sync status');

    // B5: meeting created before enforcement gets locked down on first registration
    const legacy = await makeWebinar('zoom', `Zoom legacy ${stamp}`);
    await db.executeQuery(`UPDATE webinars SET provider_metadata = '{}'::jsonb WHERE webinar_id = $1`, [legacy.webinar_id]);
    const before = zoomMock.enforceCalls;
    await register(legacy.webinar_id, `zoom-c-${stamp}@example.com`);
    await register(legacy.webinar_id, `zoom-d-${stamp}@example.com`);
    const legacyRow = (await db.executeQuery(`SELECT provider_metadata FROM webinars WHERE webinar_id = $1`, [legacy.webinar_id])).rows[0];
    check(zoomMock.enforceCalls === before + 1 && legacyRow.provider_metadata.registrationEnforced === true, 'B5 legacy meeting restricted once, then flagged');

    // B6: Google Meet flow unchanged (LMS join page link in the email)
    const gWebinar = await makeWebinar('google_meet', `Google unchanged ${stamp}`);
    const gEmail = `google-${stamp}@example.com`;
    await register(gWebinar.webinar_id, gEmail);
    const gMail = await waitFor(() => sent.find((m) => m.to === gEmail));
    check(gMail?.html.includes('/join?token='), 'B6 Google Meet email still uses the LMS join link');
  } finally {
    for (const id of createdIds) {
      await db.executeQuery('DELETE FROM webinar_attendances WHERE webinar_id = $1;', [id]);
      await db.executeQuery('DELETE FROM webinar_registrations WHERE webinar_id = $1;', [id]);
      await db.executeQuery('DELETE FROM webinar_hosts WHERE webinar_id = $1;', [id]);
      await db.executeQuery('DELETE FROM webinar_audit_logs WHERE webinar_id = $1;', [id]);
      await db.executeQuery('DELETE FROM webinars WHERE webinar_id = $1;', [id]);
    }
    console.log('[CLEANUP] Test webinars removed.');
    await app.close();
  }
}

(async () => {
  console.log('===============================================================');
  console.log('ZOOM PERSONAL JOIN LINKS: REGISTERED EMAILS ONLY');
  console.log('===============================================================');
  await runProviderTests();
  await runServiceTests();
  console.log(`\nALL ${passed} CHECKS PASSED`);
})()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  });

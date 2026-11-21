/**
 * Forgot / reset password: real HTTP requests through the full guard chain, against the database.
 * The mail transport is replaced with a capture so no real email is sent; everything else is live.
 * A temporary user is created and fully removed at the end.
 *
 * Run: npx ts-node --transpile-only src/auth/test-password-reset.ts
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';

let passed = 0;
function check(condition: any, label: string, detail?: any) {
  if (!condition) throw new Error(`FAILED: ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
  passed++;
  console.log(`[PASS] ${label}`);
}

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false, rawBody: true });
  app.use(((cookieParser as any).default || cookieParser)());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');
  const db = app.get(DatabaseService);

  // Capture outgoing reset emails instead of sending them.
  const email = app.get(EmailService) as any;
  let sent: { to: string; url: string; minutes: number; firstName?: string }[] = [];
  let failMail = false;
  email.sendPasswordResetLink = async (to: string, url: string, minutes: number, firstName?: string) => {
    if (failMail) throw new Error('SMTP down (simulated)');
    sent.push({ to, url, minutes, firstName });
  };

  const post = async (path: string, body: any) => {
    const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json: any = await res.json().catch(() => ({}));
    return { status: res.status, body: json?.data?.data ?? json?.data ?? json };
  };

  const testEmail = `reset_test_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const oldPassword = 'OldPassword123';
  const newPassword = 'BrandNewPass456';
  const user = (
    await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
       VALUES ($1, $2, 'Reset', 'Tester', TRUE, TRUE) RETURNING user_id`,
      [testEmail, await bcrypt.hash(oldPassword, 10)],
    )
  ).rows[0];
  await db.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, role_id FROM roles WHERE name = 'STUDENT'`, [user.user_id]);

  try {
    const generic = 'If an account with that email exists, password reset instructions have been sent.';

    // 1. Unknown email: same answer, nothing sent.
    let r = await post('/auth/forgot-password', { email: `nobody_${Date.now()}@example.com` });
    check(r.status === 200 && r.body.message === generic, 'unknown email gets the generic answer', r);
    check(sent.length === 0, 'no email is sent for an unknown address');

    // 2. Invalid email format is rejected by validation.
    r = await post('/auth/forgot-password', { email: 'not-an-email' });
    check(r.status === 400, 'malformed email is rejected', r);

    // 3. Known email (mixed case + spaces): same answer, one reset email with a link to the frontend.
    r = await post('/auth/forgot-password', { email: `  ${testEmail.toUpperCase()} ` });
    check(r.status === 200 && r.body.message === generic, 'known email gets the same generic answer', r);
    check(sent.length === 1 && sent[0].to === testEmail, 'one reset email goes to the account address', sent);
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    check(sent[0].url.startsWith(`${frontend}/reset-password?token=`), 'email links to the frontend reset page', sent[0].url);
    check(sent[0].minutes > 0 && sent[0].firstName === 'Reset', 'email states validity and greets by first name', sent[0]);
    const token = new URL(sent[0].url).searchParams.get('token');
    const stored = (await db.query(`SELECT token_hash FROM password_reset_tokens WHERE user_id = $1`, [user.user_id])).rows;
    check(stored.length === 1 && stored[0].token_hash !== token, 'only a hash of the token is stored', stored);

    // 4. Bad inputs to reset.
    r = await post('/auth/reset-password', { token: 'deadbeef', newPassword });
    check(r.status === 400 && /invalid or expired/i.test(r.body.message), 'a wrong token is rejected', r);
    r = await post('/auth/reset-password', { token, newPassword: 'short' });
    check(r.status === 400, 'a password under 8 characters is rejected', r);

    // 5. Valid reset, then sign in with the new password only.
    r = await post('/auth/reset-password', { token, newPassword });
    check(r.status === 200 && /reset successfully/i.test(r.body.message), 'valid token resets the password', r);
    r = await post('/auth/login', { email: testEmail, password: oldPassword });
    check(r.status === 401, 'the old password no longer works', r.status);
    r = await post('/auth/login', { email: testEmail, password: newPassword });
    check(r.status === 200, 'the new password signs in', r);

    // 6. The link is single use.
    r = await post('/auth/reset-password', { token, newPassword: 'AnotherPass789' });
    check(r.status === 400, 'the same link cannot be used twice', r);

    // 7. Mail failure still returns the generic answer (no account enumeration, no 500).
    failMail = true;
    r = await post('/auth/forgot-password', { email: testEmail });
    check(r.status === 200 && r.body.message === generic, 'a mail failure still returns the generic answer', r);
    failMail = false;

    // 8. Inactive accounts get no reset email.
    sent = [];
    await db.query(`UPDATE users SET is_active = FALSE WHERE user_id = $1`, [user.user_id]);
    r = await post('/auth/forgot-password', { email: testEmail });
    check(r.status === 200 && r.body.message === generic && sent.length === 0, 'inactive accounts get the generic answer and no email', { r, sent });
  } finally {
    await db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.user_id]);
    await db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [user.user_id]).catch(() => null);
    await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [user.user_id]);
    await db.query(`DELETE FROM users WHERE user_id = $1`, [user.user_id]);
    await app.close();
  }

  console.log(`\nAll ${passed} password reset checks passed.`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

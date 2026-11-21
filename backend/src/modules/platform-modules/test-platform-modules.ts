/**
 * Dynamic Module Management, Phase 1: registry + backend enforcement.
 * Real HTTP requests through the full global guard chain, against the database.
 *
 * Covers the scenarios required before approval (docs/module-access-rules.md):
 *  - every route is tagged with a module (or explicitly exempt)
 *  - default seed changes nothing
 *  - Super Admin validation rules (core, coming soon, dependencies, audiences, reason)
 *  - PAID-COURSE: pausing sales never blocks paid learning, orders, payment completion or webhooks
 *  - HISTORICAL DATA: a disabled module stays readable (GET) for Admin, blocked for everyone else
 *  - role and public-website visibility, audit log
 *
 * Run: npx ts-node --transpile-only src/modules/platform-modules/test-platform-modules.ts
 */
import { NestFactory, ModulesContainer } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../app.module';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { DatabaseService } from '../../database/database.service';
import { ModuleRegistryService } from './module-registry.service';
import { REQUIRE_MODULE_KEY, SKIP_MODULE_CHECK_KEY } from '../../common/decorators/require-module.decorator';

let passed = 0;
function check(condition: any, label: string, detail?: any) {
  if (!condition) throw new Error(`FAILED: ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  passed++;
  console.log(`[PASS] ${label}`);
}

const TEST_REASON = 'TEST: platform module enforcement';

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false, rawBody: true });
  app.use(((cookieParser as any).default || cookieParser)());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');

  const db = app.get(DatabaseService);
  const registry = app.get(ModuleRegistryService);
  const jwt = app.get(JwtService);
  const secret = app.get(ConfigService).get<string>('auth.jwtAccessSecret');

  // ---- actors -------------------------------------------------------------
  const one = async (sql: string) => (await db.query(sql)).rows[0];
  const admin = await one(`SELECT user_id, email FROM users WHERE email = 'admin@insighttech.in'`);
  const superAdmin = await one(`SELECT user_id, email FROM users WHERE email = 'superadmin@insighttech.in'`);
  const instructor = await one(`
    SELECT u.user_id, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.user_id
    JOIN roles r ON r.role_id = ur.role_id WHERE r.name = 'INSTRUCTOR' AND u.is_active LIMIT 1`);
  const paid = await one(`
    SELECT ce.student_id AS user_id, u.email, ce.course_id, ce.order_id
    FROM course_enrollments ce
    JOIN users u ON u.user_id = ce.student_id AND u.is_active AND u.deleted_at IS NULL
    JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id AND r.name = 'STUDENT'
    WHERE ce.order_id IS NOT NULL AND ce.enrollment_status IN ('active', 'completed')
    LIMIT 1`);
  if (!admin || !superAdmin || !instructor || !paid) throw new Error('Seed data missing (admin, superadmin, instructor, paid student)');

  const token = (u: { user_id: string; email: string }) =>
    jwt.sign({ sub: u.user_id, userId: u.user_id, email: u.email, roles: [], permissions: [] }, { secret, expiresIn: '10m' });
  const T = {
    admin: token(admin),
    superAdmin: token(superAdmin),
    instructor: token(instructor),
    student: token(paid),
  };

  const call = async (method: string, path: string, who?: keyof typeof T, body?: any) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(who ? { Authorization: `Bearer ${T[who]}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => ({}));
    return { status: res.status, code: json.code as string | undefined, json };
  };
  const patch = (key: string, body: any, who: keyof typeof T = 'superAdmin') =>
    call('PATCH', `/platform-modules/${key}`, who, { reason: TEST_REASON, ...body });
  const notModuleBlocked = (r: { status: number; code?: string }) =>
    r.code !== 'MODULE_DISABLED' && r.code !== 'MODULE_NOT_AVAILABLE';

  // Snapshot state to restore afterwards
  const before = (await db.query(`SELECT module_key, is_enabled, public_visible FROM platform_modules`)).rows;
  const beforeRoles = (await db.query(`SELECT module_key, role_id, is_visible FROM module_role_access`)).rows;
  const beforePerms = (await db.query(`SELECT role_id, permission_id FROM role_permissions`)).rows;

  try {
    // ---------------------------------------------------------------------------
    console.log('\n--- 1. Every route is tagged ---');
    const untagged: string[] = [];
    const unknownKeys = new Set<string>();
    for (const mod of app.get(ModulesContainer).values()) {
      for (const wrapper of mod.controllers.values()) {
        const ctrl = wrapper.metatype as any;
        if (!ctrl || !Reflect.getMetadata(PATH_METADATA, ctrl)) continue;
        const classKey = Reflect.getMetadata(REQUIRE_MODULE_KEY, ctrl);
        const classSkip = Reflect.getMetadata(SKIP_MODULE_CHECK_KEY, ctrl);
        for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
          const handler = ctrl.prototype[name];
          if (typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
          const key = Reflect.getMetadata(REQUIRE_MODULE_KEY, handler) || classKey;
          const skip = Reflect.getMetadata(SKIP_MODULE_CHECK_KEY, handler) || classSkip;
          if (!key && !skip) untagged.push(`${ctrl.name}.${name}`);
          if (key && !registry.getModule(key)) unknownKeys.add(key);
        }
      }
    }
    check(untagged.length === 0, 'every route has @RequireModule or @SkipModuleCheck', untagged);
    check(unknownKeys.size === 0, 'every module key used by routes exists in the registry', [...unknownKeys]);

    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Default seed changes nothing ---');
    check((await call('GET', '/courses/catalog')).status === 200, 'public catalog open');
    check((await call('GET', '/webinars/public')).status === 200, 'public webinars open');
    check((await call('GET', '/instructors')).status === 200, 'public instructor directory open');
    check((await call('GET', '/orders', 'student')).status === 200, 'student order history open');
    check((await call('GET', '/cart', 'student')).status === 200, 'student cart open');
    check((await call('GET', '/coupons', 'admin')).status === 200, 'admin coupons open');
    check((await call('GET', '/orders/admin/all', 'admin')).status === 200, 'admin order ledger open');
    const pub = await call('GET', '/platform-modules/public-config');
    check(pub.status === 200 && pub.json.data.modules.some((m: any) => m.key === 'webinars' && m.enabled), 'public config lists webinars as on');

    // ---------------------------------------------------------------------------
    console.log('\n--- 3. Super Admin validation rules ---');
    check((await call('GET', '/platform-modules', 'superAdmin')).json.data.every((m: any) => m.key !== 'auth'), 'sign-in is not listed as a module');
    check((await call('POST', '/auth/login', undefined, { email: 'nobody@example.com', password: 'wrong-pass-1' })).status === 401, 'sign-in works without module checks');
    check((await patch('module_management', { roleVisibility: { SUPER_ADMIN: false } })).status === 400, 'safety lock: Module Management stays visible to Super Admin');
    check((await patch('module_management', { isEnabled: false })).status === 400, 'safety lock: Module Management cannot be turned off');
    check((await patch('wishlist', { isEnabled: true })).status === 400, 'coming-soon module cannot be enabled');
    check((await call('PATCH', '/platform-modules/webinars', 'superAdmin', { isEnabled: false })).status === 400, 'reason is required');
    check((await patch('webinars', { roleVisibility: { GUEST: true } })).status === 400, 'unknown role rejected');
    check((await patch('coupons', { publicVisible: true })).status === 400, 'public toggle rejected for non-public module');
    check((await patch('cart_checkout', { isEnabled: false })).status === 400, 'cannot turn off a module another enabled module depends on');
    check((await patch('webinars', { isEnabled: false }, 'admin')).status === 403, 'Admin cannot manage modules');
    check((await patch('no_such_module', { isEnabled: false })).status === 404, 'unknown module -> 404');

    // ---------------------------------------------------------------------------
    console.log('\n--- 4. PAID-COURSE: pause sales (coupons + cart_checkout off) ---');
    check((await patch('coupons', { isEnabled: false })).status === 200, 'coupons turned off');
    check((await patch('cart_checkout', { isEnabled: false })).status === 200, 'cart & checkout turned off');

    const learn = await call('GET', `/student-learning/courses/${paid.course_id}`, 'student');
    check(learn.status === 200, 'paid student still opens the purchased course', learn.json.message);
    check((await call('GET', `/student-learning/courses/${paid.course_id}/progress`, 'student')).status === 200, 'paid student progress still loads');
    check((await call('GET', '/orders', 'student')).status === 200, 'purchase history still loads');
    check((await call('GET', `/orders/${paid.order_id}`, 'student')).status === 200, 'paid order detail still loads');

    const verify = await call('POST', '/payments/verify', 'student', {});
    check(notModuleBlocked(verify), 'payment verification not blocked (money in flight)', verify);
    const checkout = await call('POST', '/orders/checkout', 'student', {});
    check(notModuleBlocked(checkout), 'checkout completion not blocked (money in flight)', checkout);
    const webhook = await call('POST', '/payments/webhook', undefined, {});
    check(notModuleBlocked(webhook), 'Razorpay webhook not blocked', webhook);

    const newSale = await call('POST', '/payments/orders', 'student', {});
    check(newSale.status === 403 && newSale.code === 'MODULE_DISABLED', 'starting a NEW payment is blocked', newSale);
    const addItem = await call('POST', '/cart/items', 'student', { courseId: paid.course_id });
    check(addItem.status === 403 && addItem.code === 'MODULE_DISABLED', 'adding to cart is blocked', addItem);
    const studentCart = await call('GET', '/cart', 'student');
    check(studentCart.status === 403 && studentCart.code === 'MODULE_DISABLED', 'student has no read path into a disabled module');

    // Historical read for Admin on the disabled coupons module
    check((await call('GET', '/coupons', 'admin')).status === 200, 'Admin can still READ coupons history');
    const saHistory = await call('GET', '/coupons', 'superAdmin');
    check(saHistory.status === 403, 'Super Admin has no historical read path (governance-only)', saHistory);
    const adminWrite = await call('POST', '/coupons', 'admin', {});
    check(adminWrite.status === 403 && adminWrite.code === 'MODULE_DISABLED', 'Admin cannot WRITE to disabled coupons', adminWrite);

    check((await patch('coupons', { isEnabled: true })).status === 400, 'coupons cannot be enabled before cart & checkout');
    check((await patch('cart_checkout', { isEnabled: true })).status === 200, 'cart & checkout back on');
    check((await patch('coupons', { isEnabled: true })).status === 200, 'coupons back on');
    check((await call('GET', '/cart', 'student')).status === 200, 'student cart works again');

    // ---------------------------------------------------------------------------
    console.log('\n--- 5. HISTORICAL DATA: webinars off ---');
    check((await patch('webinars', { isEnabled: false })).status === 200, 'webinars turned off');

    const anonList = await call('GET', '/webinars/public');
    check(anonList.status === 404 && anonList.code === 'MODULE_DISABLED', 'public list hidden (404)', anonList);
    const anonReg = await call('POST', '/webinars/any/register', undefined, {});
    check(anonReg.status === 404 && anonReg.code === 'MODULE_DISABLED', 'public registration blocked');

    const adminList = await call('GET', '/webinars/admin', 'admin');
    check(adminList.status === 200, 'Admin still READS webinar history (explicit historical path)', adminList.json.message);
    const adminCreate = await call('POST', '/webinars', 'admin', {});
    check(adminCreate.status === 403 && adminCreate.code === 'MODULE_DISABLED', 'Admin cannot create webinars while off', adminCreate);
    check((await call('GET', '/webinars/providers/status', 'admin')).status === 200, 'provider integrations stay configurable');
    const hostStart = await call('POST', '/webinars/any/start', 'instructor', {});
    check(hostStart.status === 403 && hostStart.code === 'MODULE_DISABLED', 'instructor host actions blocked');
    const zoomHook = await call('POST', '/webinars/webhooks/zoom', undefined, {});
    check(notModuleBlocked(zoomHook), 'Zoom webhook not blocked (attendance history)', zoomHook);

    check((await patch('webinars', { isEnabled: true })).status === 200, 'webinars back on');
    check((await call('GET', '/webinars/public')).status === 200, 'public list back');

    // ---------------------------------------------------------------------------
    console.log('\n--- 6. Audience visibility ---');
    check((await patch('coupons', { roleVisibility: { STUDENT: false } })).status === 200, 'coupons hidden from students');
    const stuCoupon = await call('POST', '/coupons/validate', 'student', { code: 'X', courseIds: [] });
    check(stuCoupon.status === 403 && stuCoupon.code === 'MODULE_NOT_AVAILABLE', 'student blocked from coupons', stuCoupon);
    check((await call('GET', '/coupons/my-courses', 'instructor')).status === 200, 'instructor still uses coupons');
    check((await patch('coupons', { roleVisibility: { STUDENT: true } })).status === 200, 'coupons visible to students again');

    check((await patch('webinars', { publicVisible: false })).status === 200, 'webinars hidden from public website');
    const hidden = await call('GET', '/webinars/public');
    check(hidden.status === 404 && hidden.code === 'MODULE_NOT_AVAILABLE', 'public webinars 404 while hidden');
    check((await call('GET', '/webinars/admin', 'admin')).status === 200, 'Admin unaffected by public visibility');
    check((await patch('webinars', { publicVisible: true })).status === 200, 'webinars public again');

    // ---------------------------------------------------------------------------
    console.log('\n--- 7. Audit log ---');
    const audit = await call('GET', '/platform-modules/audit-logs?moduleKey=webinars&limit=50', 'superAdmin');
    const entries = audit.json.data?.data || [];
    check(audit.status === 200 && entries.filter((e: any) => e.reason === TEST_REASON).length >= 4, 'webinar changes audited with reason');
    const offEntry = entries.find((e: any) => e.previous_state.isEnabled === true && e.new_state.isEnabled === false);
    check(offEntry && offEntry.actor_email === superAdmin.email, 'audit records before/after and actor');
    check((await call('GET', '/platform-modules/audit-logs', 'admin')).status === 403, 'Admin cannot read module audit log');

    // ---------------------------------------------------------------------------
    console.log('\n--- 8. Phase 2: Super Admin is governance-only ---');
    const blocked: Array<[string, string, any?]> = [
      ['GET', '/orders/admin/all'],
      ['GET', `/orders/${paid.order_id}`],
      ['GET', '/coupons'],
      ['POST', '/coupons', {}],
      ['GET', '/refunds/admin/all'],
      ['PATCH', '/refunds/any/review', { decision: 'approve' }],
      ['GET', '/enrollments/admin'],
      ['GET', '/courses/admin'],
      ['POST', '/categories', {}],
      ['GET', '/webinars/admin'],
      ['GET', '/campaigns'],
      ['POST', '/campaigns/sms/send-bulk', {}],
      ['GET', '/campaigns/email/templates'],
      ['GET', '/campaigns/whatsapp/templates'],
    ];
    for (const [method, path, body] of blocked) {
      const r = await call(method, path, 'superAdmin', body);
      check(r.status === 403, `Super Admin blocked: ${method} ${path}`, r);
    }

    const allowed: Array<[string, string]> = [
      ['GET', '/platform-modules'],
      ['GET', '/settings/google-oauth'],
      ['GET', '/settings/refund-policy'],
      ['GET', '/campaigns/sms/config'],
      ['GET', '/campaigns/sms/templates'],
      ['GET', '/campaigns/email/config'],
      ['GET', '/campaigns/whatsapp/config'],
      ['GET', '/users'],
      ['GET', '/dashboard/overview'],
      ['GET', '/cart'],
      ['GET', '/orders'],
    ];
    for (const [method, path] of allowed) {
      const r = await call(method, path, 'superAdmin');
      check(r.status === 200, `Super Admin allowed (governance / own purchases): ${method} ${path}`, r);
    }
    const saCoupon = await call('POST', '/coupons/validate', 'superAdmin', { code: 'X', courseIds: [] });
    check(saCoupon.status !== 403, 'Super Admin can still apply coupons as a buyer', saCoupon);

    for (const path of ['/orders/admin/all', '/refunds/admin/all', '/enrollments/admin', '/campaigns/email/templates', '/campaigns/sms/templates', '/campaigns']) {
      check((await call('GET', path, 'admin')).status === 200, `Admin keeps operations: GET ${path}`);
    }

    // ---------------------------------------------------------------------------
    console.log('\n--- 9. Phase 3: governance screens backend ---');
    const impact = await call('GET', '/platform-modules/webinars/impact', 'superAdmin');
    check(
      impact.status === 200 && typeof impact.json.data.affectedUsers === 'number' && impact.json.data.workload.length === 2,
      'impact preview lists affected users and webinar workload',
      impact.json,
    );
    const cartImpact = await call('GET', '/platform-modules/cart_checkout/impact', 'superAdmin');
    check(cartImpact.status === 200 && cartImpact.json.data.dependents.some((d: any) => d.key === 'coupons'), 'impact preview lists dependent modules');
    check((await call('GET', '/platform-modules/webinars/impact', 'admin')).status === 403, 'Admin cannot preview module impact');

    await patch('webinars', { publicVisible: false });
    await patch('webinars', { publicVisible: true });
    const logs = await call('GET', '/audit-logs?source=modules&search=Webinars&limit=10', 'superAdmin');
    check(logs.status === 200 && logs.json.data.data.length >= 2 && logs.json.data.data.every((l: any) => l.source === 'modules'), 'audit log filters by source and search', logs.json);
    check(logs.json.data.data[0].details.reason === TEST_REASON && logs.json.data.data[0].actor_email === superAdmin.email, 'audit entries carry reason and actor');
    const allLogs = await call('GET', '/audit-logs?limit=5', 'superAdmin');
    check(allLogs.status === 200 && typeof allLogs.json.data.total === 'number', 'unified audit log across sources');
    check((await call('GET', '/audit-logs', 'admin')).status === 403, 'Admin cannot read the governance audit log');
    check((await call('GET', '/audit-logs?from=2026-12-01T00:00:00Z&to=2026-01-01T00:00:00Z', 'superAdmin')).status === 400, 'audit log rejects from > to');

    const integrations = await call('GET', '/settings/integrations', 'superAdmin');
    const raw = JSON.stringify(integrations.json);
    check(integrations.status === 200 && integrations.json.data.integrations.length === 7, 'integrations overview lists 7 integrations');
    check(!/secret|password|access_token|refresh_token|credentials/i.test(raw.replace(/"webhookSecret":(true|false)/, '')), 'integrations overview leaks no secrets', raw.slice(0, 300));
    check((await call('GET', '/settings/integrations', 'admin')).status === 403, 'Admin cannot read integrations overview');

    const saUsers = await call('GET', '/users?limit=100', 'superAdmin');
    const saUserRows = saUsers.json.data?.data || saUsers.json.data?.users || saUsers.json.data || [];
    const rowsArr = Array.isArray(saUserRows) ? saUserRows : [];
    check(saUsers.status === 200 && rowsArr.length > 0 && !rowsArr.some((u: any) => u.user_id === paid.user_id || u.userId === paid.user_id || u.id === paid.user_id), 'Super Admin user list shows privileged accounts only');
    check((await call('GET', `/users/${paid.user_id}`, 'superAdmin')).status === 403, 'Super Admin cannot open a student account');
    const saCreateStudent = await call('POST', '/users', 'superAdmin', {
      email: `sa-student-${Date.now()}@example.com`, firstName: 'No', lastName: 'Access', role: 'STUDENT', password: 'Temp#Pass2026',
    });
    check(saCreateStudent.status === 403 || saCreateStudent.status === 400, 'Super Admin cannot create a student account', saCreateStudent);
    check((await call('GET', `/users/${paid.user_id}`, 'admin')).status === 200, 'Admin still manages students');

    // ---------------------------------------------------------------------------
    console.log('\n--- 10. Phase 4: Roles & Permissions ---');
    const createCourse = await call('POST', '/courses', 'admin', {});
    check(createCourse.status !== 403, 'Admin can create courses (courses:create granted by migration 025)', createCourse);

    const matrix = await call('GET', '/roles-permissions', 'superAdmin');
    const roleNames = (matrix.json.data?.roles || []).map((r: any) => r.name);
    check(matrix.status === 200 && ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT'].every((r) => roleNames.includes(r)), 'matrix lists the four roles');
    const catalog = matrix.json.data.permissions;
    check(catalog.some((p: any) => p.code === 'courses:create' && p.moduleKey === 'teaching'), 'permission catalog grouped by module');
    check(!catalog.some((p: any) => p.code === 'quizzes:submit'), 'out-of-scope permissions are gone');
    check(matrix.json.data.roles.find((r: any) => r.name === 'SUPER_ADMIN').isLocked === true, 'Super Admin role is locked');
    check((await call('GET', '/roles-permissions', 'admin')).status === 403, 'Admin cannot open Roles & Permissions');

    const adminPerms: string[] = matrix.json.data.roles.find((r: any) => r.name === 'ADMIN').permissions;
    const rp = (role: string, permissions: string[], who: keyof typeof T = 'superAdmin', reason = TEST_REASON) =>
      call('PATCH', `/roles-permissions/roles/${role}`, who, { permissions, reason });

    check((await rp('SUPER_ADMIN', ['platform:manage'])).status === 400, 'cannot edit the Super Admin role');
    check((await rp('ADMIN', [...adminPerms, 'platform:manage'])).status === 400, 'cannot grant governance permissions to Admin');
    check((await rp('ADMIN', [...adminPerms, 'nope:unknown'])).status === 400, 'unknown permission rejected');
    check((await rp('ADMIN', adminPerms)).status === 400, 'no-op change rejected');
    check((await call('PATCH', '/roles-permissions/roles/ADMIN', 'superAdmin', { permissions: adminPerms })).status === 400, 'reason required');
    check((await rp('ADMIN', adminPerms, 'admin')).status === 403, 'Admin cannot change permissions');

    // Live effect: removing categories:manage blocks Admin immediately, restoring re-allows
    const removed = await rp('ADMIN', adminPerms.filter((c) => c !== 'categories:manage'));
    check(removed.status === 200 && removed.json.data.removed.includes('categories:manage'), 'categories:manage removed from Admin');
    const blockedCat = await call('POST', '/categories', 'admin', {});
    check(blockedCat.status === 403, 'Admin blocked from creating categories on the next request', blockedCat);
    check((await rp('ADMIN', adminPerms)).status === 200, 'categories:manage restored');
    check((await call('POST', '/categories', 'admin', {})).status !== 403, 'Admin can manage categories again');

    // Guard fix: a role with zero permissions must not fall back to stale token claims
    const studentPerms: string[] = matrix.json.data.roles.find((r: any) => r.name === 'STUDENT').permissions;
    check((await rp('STUDENT', [])).status === 200, 'all permissions removed from Student');
    const staleToken = jwt.sign(
      { sub: paid.user_id, userId: paid.user_id, email: paid.email, roles: ['STUDENT'], permissions: ['categories:manage'] },
      { secret, expiresIn: '10m' },
    );
    const staleRes = await fetch(base + '/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staleToken}` },
      body: '{}',
    });
    check(staleRes.status === 403, 'stale token permissions are ignored when the role has none', staleRes.status);
    check((await rp('STUDENT', studentPerms)).status === 200, 'Student permissions restored');

    const roleLogs = await call('GET', '/audit-logs?source=roles&limit=10', 'superAdmin');
    const roleEntry = (roleLogs.json.data?.data || []).find((l: any) => l.subject === 'ADMIN' && (l.details.removed || []).includes('categories:manage'));
    check(roleEntry && roleEntry.details.reason === TEST_REASON, 'permission changes appear in the audit log with reason');

    // ---------------------------------------------------------------------------
    console.log('\n--- 11. Phase 5: menus & pages follow module access ---');
    const accessOf = async (who: keyof typeof T) => {
      const r = await call('GET', '/platform-modules/my-access', who);
      return Object.fromEntries((r.json.data?.modules || []).map((m: any) => [m.key, m.access]));
    };
    const stuAccess = await accessOf('student');
    check(stuAccess.cart_checkout === 'full' && stuAccess.learning === 'full', 'student: cart and learning available');
    check(stuAccess.sms_campaigns === 'none' && stuAccess.webinars === 'none', 'student: admin-only modules not available');
    const saAccess = await accessOf('superAdmin');
    check(saAccess.coupons === 'full' && saAccess.sms_campaigns === 'none' && saAccess.module_management === 'full', 'super admin: buyer modules + governance only');
    check((await call('GET', '/platform-modules/my-access')).status === 401, 'my-access requires sign-in');

    await patch('webinars', { isEnabled: false });
    const adminOff = await accessOf('admin');
    const instrOff = await accessOf('instructor');
    check(adminOff.webinars === 'read_only', 'admin sees a turned-off module as read_only');
    check(instrOff.webinars === 'none', 'instructor loses a turned-off module');
    const pubOff = await call('GET', '/platform-modules/public-config');
    check(pubOff.json.data.modules.find((m: any) => m.key === 'webinars').enabled === false, 'public config reports webinars off');
    await patch('webinars', { isEnabled: true });
    check((await accessOf('admin')).webinars === 'full', 'admin access back to full after re-enable');

    // ---------------------------------------------------------------------------
    console.log('\n--- 11b. Fully dynamic: former core modules are configurable ---');
    check((await call('GET', '/orders', 'student')).status === 200, 'student order history open (baseline)');
    check((await patch('orders', { roleVisibility: { STUDENT: false } })).status === 200, 'Orders hidden from students');
    const hiddenOrders = await call('GET', '/orders', 'student');
    check(hiddenOrders.status === 403 && hiddenOrders.code === 'MODULE_NOT_AVAILABLE', 'student blocked from Orders while hidden', hiddenOrders);
    check((await call('GET', '/orders/admin/all', 'admin')).status === 200, 'Admin unaffected');
    check((await patch('orders', { roleVisibility: { STUDENT: true } })).status === 200, 'Orders visible to students again');
    check((await call('GET', '/orders', 'student')).status === 200, 'student order history back');
    check((await patch('learning', { isEnabled: false })).status === 200, 'My Learning can be turned off (with warning in UI)');
    const learnOff = await call('GET', `/student-learning/courses/${paid.course_id}`, 'student');
    check(learnOff.status === 403 && learnOff.code === 'MODULE_DISABLED', 'course player blocked while My Learning is off');
    check((await patch('learning', { isEnabled: true })).status === 200, 'My Learning back on');
    check((await call('GET', '/platform-modules/public-config')).status === 200, 'public config always reachable');
    check((await call('GET', '/platform-modules/my-access', 'student')).status === 200, 'my-access always reachable for menus');

    console.log('\n--- 11c. Reviews follows the dynamic pattern ---');
    check((await call('GET', '/admin/reviews', 'superAdmin')).status === 403, 'Super Admin cannot moderate reviews (governance-only permissions)');
    check((await call('GET', '/admin/reviews', 'admin')).status === 200, 'Admin moderates reviews (holds reviews:moderate)');
    check((await call('GET', '/admin/reviews', 'instructor')).status === 403, 'Instructor cannot moderate by default');
    const instrMatrix = await call('GET', '/roles-permissions', 'superAdmin');
    const instrPerms: string[] = instrMatrix.json.data.roles.find((r: any) => r.name === 'INSTRUCTOR').permissions;
    check((await call('PATCH', '/roles-permissions/roles/INSTRUCTOR', 'superAdmin', { permissions: [...instrPerms, 'reviews:moderate'], reason: TEST_REASON })).status === 200, 'reviews:moderate granted to Instructors in Roles & Permissions');
    check((await call('GET', '/admin/reviews', 'instructor')).status === 200, 'Instructor can moderate immediately after the grant');
    check((await call('PATCH', '/roles-permissions/roles/INSTRUCTOR', 'superAdmin', { permissions: instrPerms, reason: TEST_REASON })).status === 200, 'grant removed');
    check((await patch('reviews_ratings', { roleVisibility: { ADMIN: false } })).status === 200, 'Reviews hidden from Admins in Module Management');
    const adminRevHidden = await call('GET', '/admin/reviews', 'admin');
    check(adminRevHidden.status === 403 && adminRevHidden.code === 'MODULE_NOT_AVAILABLE', 'Admin blocked from Reviews while hidden', adminRevHidden);
    check((await patch('reviews_ratings', { roleVisibility: { ADMIN: true } })).status === 200, 'Reviews visible to Admins again');

    console.log('\n--- 12. Batch save (Module Management screen) ---');
    const batch = (changes: any[], who: keyof typeof T = 'superAdmin') =>
      call('PATCH', '/platform-modules', who, { changes, reason: TEST_REASON });
    const enabledOf = async (key: string) =>
      (await db.query(`SELECT is_enabled FROM platform_modules WHERE module_key = $1`, [key])).rows[0].is_enabled;

    const both = await batch([{ key: 'cart_checkout', isEnabled: false }, { key: 'coupons', isEnabled: false }]);
    check(both.status === 200 && both.json.data.modules.length === 2, 'turning off a module and its dependent in one save is allowed', both.json);
    check((await enabledOf('cart_checkout')) === false && (await enabledOf('coupons')) === false, 'both turned off');
    check((await batch([{ key: 'coupons', isEnabled: true }])).status === 400, 'enabling coupons alone fails while cart is off');
    check((await batch([{ key: 'coupons', isEnabled: true }, { key: 'cart_checkout', isEnabled: true }])).status === 200, 'enabling both in one save is allowed (final state)');

    const atomic = await batch([{ key: 'webinars', publicVisible: false }, { key: 'module_management', isEnabled: false }]);
    check(atomic.status === 400, 'a save with one invalid change is rejected');
    const webPublic = (await db.query(`SELECT public_visible FROM platform_modules WHERE module_key = 'webinars'`)).rows[0].public_visible;
    check(webPublic === true, 'all or nothing: the valid change in a rejected save is not applied');
    check((await batch([{ key: 'webinars', publicVisible: false }, { key: 'webinars', publicVisible: true }])).status === 400, 'duplicate module in one save rejected');
    check((await batch([{ key: 'webinars', roleVisibility: { INSTRUCTOR: false } }], 'admin')).status === 403, 'Admin cannot batch-save modules');
    const roleSave = await batch([
      { key: 'webinars', roleVisibility: { INSTRUCTOR: false } },
      { key: 'instructor_profiles', roleVisibility: { INSTRUCTOR: false } },
    ]);
    check(roleSave.status === 200, 'role visibility for several modules saved together');
    const batchLogs = await call('GET', '/audit-logs?source=modules&limit=50', 'superAdmin');
    const instrHidden = (batchLogs.json.data?.data || []).filter((l: any) => l.details.after?.roleVisibility?.INSTRUCTOR === false);
    check(instrHidden.length >= 2, 'each module in a batch gets its own audit entry');
    await batch([
      { key: 'webinars', roleVisibility: { INSTRUCTOR: true } },
      { key: 'instructor_profiles', roleVisibility: { INSTRUCTOR: true } },
    ]);
  } finally {
    // Restore the exact pre-test state and remove test audit rows
    for (const m of before) {
      await db.query(`UPDATE platform_modules SET is_enabled = $2, public_visible = $3 WHERE module_key = $1`, [
        m.module_key, m.is_enabled, m.public_visible,
      ]);
    }
    for (const r of beforeRoles) {
      await db.query(`UPDATE module_role_access SET is_visible = $3 WHERE module_key = $1 AND role_id = $2`, [
        r.module_key, r.role_id, r.is_visible,
      ]);
    }
    await db.query(`DELETE FROM module_audit_logs WHERE reason = $1`, [TEST_REASON]);
    await db.query(`DELETE FROM role_permissions`);
    for (const r of beforePerms) {
      await db.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [r.role_id, r.permission_id]);
    }
    await db.query(`DELETE FROM role_permission_audit_logs WHERE reason = $1`, [TEST_REASON]);
    await registry.reload();
    console.log('[CLEANUP] Module state restored.');
    await app.close();
  }
}

run()
  .then(() => {
    console.log(`\nALL ${passed} CHECKS PASSED`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err);
    process.exit(1);
  });

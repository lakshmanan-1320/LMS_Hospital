/**
 * Course cards, course landing page, related courses, dynamic badges and guest previews.
 * Real HTTP requests through the full global guard chain, against the database.
 *
 * Run: npx ts-node --transpile-only src/courses/test-course-landing.ts
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AppModule } from '../app.module';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { DatabaseService } from '../database/database.service';
import { ModuleRegistryService } from '../modules/platform-modules/module-registry.service';

let passed = 0;
function check(condition: any, label: string, detail?: any) {
  if (!condition) throw new Error(`FAILED: ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
  passed++;
  console.log(`[PASS] ${label}`);
}

const TEST_REASON = 'TEST: course landing suite';

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
  const one = async (sql: string, params: any[] = []) => (await db.query(sql, params)).rows[0];

  const userOf = (role: string) =>
    one(
      `SELECT u.user_id, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id
       WHERE r.name = $1 AND u.is_active AND u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM user_roles x JOIN roles y ON y.role_id = x.role_id WHERE x.user_id = u.user_id AND y.name <> $1)
       LIMIT 1`,
      [role],
    );
  const actors: Record<string, any> = {
    admin: await userOf('ADMIN'),
    superAdmin: await userOf('SUPER_ADMIN'),
    instructor: await userOf('INSTRUCTOR'),
    student: await userOf('STUDENT'),
  };
  const token = (u: any) => jwt.sign({ sub: u.user_id, userId: u.user_id, email: u.email, roles: [], permissions: [] }, { secret, expiresIn: '10m' });

  const call = async (method: string, p: string, who?: string, body?: any, headers: Record<string, string> = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${token(actors[who])}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const ct = res.headers.get('content-type') || '';
    const json: any = ct.includes('json') ? await res.json().catch(() => ({})) : {};
    return { status: res.status, json, headers: res.headers, data: json?.data };
  };

  // Snapshots to restore
  const badgeSettingBefore = await one(`SELECT setting_value FROM system_settings WHERE setting_key = 'course_badges'`);
  const refundsBefore = await one(`SELECT is_enabled FROM platform_modules WHERE module_key = 'refunds'`);
  let tempAsset: { assetId: string; file: string; lessonId: string; prevPreview: boolean; prevAsset: string | null } | null = null;

  try {
    // ------------------------------------------------------------------
    console.log('\n--- 1. Badge rules in Settings (Admin + Super Admin) ---');
    const adminGet = await call('GET', '/settings/course-badges', 'admin');
    check(adminGet.status === 200 && adminGet.data.bestseller && adminGet.data.highestRated && adminGet.data.newCourse, 'Admin reads badge rules');
    check((await call('GET', '/settings/course-badges', 'superAdmin')).status === 200, 'Super Admin reads badge rules');
    check((await call('GET', '/settings/course-badges', 'instructor')).status === 403, 'Instructor cannot read badge rules');
    check((await call('GET', '/settings/course-badges', 'student')).status === 403, 'Student cannot read badge rules');
    check((await call('PATCH', '/settings/course-badges', 'admin', { bestseller: { topPercent: 0 } })).status === 400, 'invalid rule rejected (topPercent 0)');
    check((await call('PATCH', '/settings/course-badges', 'admin', { highestRated: { minRating: 6 } })).status === 400, 'invalid rule rejected (rating above 5)');
    check((await call('PATCH', '/settings/course-badges', 'admin', { surprise: true })).status === 400, 'unknown field rejected');
    check((await call('PATCH', '/settings/course-badges', 'instructor', { newCourse: { withinDays: 10 } })).status === 403, 'Instructor cannot change badge rules');
    const saPatch = await call('PATCH', '/settings/course-badges', 'superAdmin', { newCourse: { withinDays: 45 } });
    check(saPatch.status === 200 && saPatch.data.newCourse.withinDays === 45 && saPatch.data.bestseller, 'Super Admin updates one rule; others kept');

    // ------------------------------------------------------------------
    console.log('\n--- 2. Catalog cards: stats, badges, sorting ---');
    const generous = {
      bestseller: { enabled: true, windowDays: 365, topPercent: 100, minStudents: 1 },
      highestRated: { enabled: true, minRating: 1, minReviews: 1 },
      newCourse: { enabled: true, withinDays: 365 },
    };
    check((await call('PATCH', '/settings/course-badges', 'admin', generous)).status === 200, 'generous rules saved');
    const cat = await call('GET', '/courses/catalog?limit=50');
    const items = cat.data.items;
    check(cat.status === 200 && items.length > 0, 'catalog loads', cat.status);
    const sample = items[0];
    check(['totalStudents', 'totalLectures', 'totalDurationSeconds', 'badges'].every((k) => k in sample), 'cards carry students, lectures, length and badges');

    let badgeMismatch: any = null;
    for (const it of items) {
      const keys = it.badges.map((b: any) => b.key);
      const expectBest = it.totalStudents >= 1;
      const expectRated = it.totalReviewsCount >= 1 && it.averageRating >= 1;
      const expectNew = Boolean(it.publishedAt) && Date.now() - new Date(it.publishedAt).getTime() <= 365 * 86400000;
      if (keys.includes('bestseller') !== expectBest || keys.includes('highest_rated') !== expectRated || keys.includes('new') !== expectNew) {
        badgeMismatch = { title: it.title, keys, totalStudents: it.totalStudents, reviews: it.totalReviewsCount, publishedAt: it.publishedAt };
        break;
      }
    }
    check(!badgeMismatch, 'badges follow the saved rules exactly', badgeMismatch);

    const dbStudents = await one(`SELECT COUNT(*)::int c FROM course_enrollments WHERE course_id = $1 AND enrollment_status IN ('active','completed')`, [sample.courseId]);
    check(sample.totalStudents === dbStudents.c, 'student count matches the database');

    check((await call('PATCH', '/settings/course-badges', 'admin', {
      bestseller: { enabled: false }, highestRated: { enabled: false }, newCourse: { enabled: false },
    })).status === 200, 'all badges switched off');
    const noBadges = await call('GET', '/courses/catalog?limit=50');
    check(noBadges.data.items.every((i: any) => i.badges.length === 0), 'no badges when every rule is off');

    check((await call('PATCH', '/settings/course-badges', 'admin', { bestseller: { enabled: true, topPercent: 1, minStudents: 1, windowDays: 365 } })).status === 200, 'strict bestseller rule (top 1%)');
    const strict = await call('GET', '/courses/catalog?limit=50');
    const bests = strict.data.items.filter((i: any) => i.badges.some((b: any) => b.key === 'bestseller'));
    let rankOk = true;
    for (const b of bests) {
      const top = await one(
        `SELECT MAX(n)::int m FROM (SELECT c.course_id, (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.course_id AND ce.enrollment_status IN ('active','completed')) n
           FROM courses c WHERE c.status = 'published' AND c.deleted_at IS NULL AND c.is_active AND c.category_id IS NOT DISTINCT FROM $1) x`,
        [b.categoryId],
      );
      if (b.totalStudents < top.m) rankOk = false;
    }
    check(rankOk, 'top-1% bestseller only goes to the category leader', bests.map((b: any) => b.title));

    const byStudents = (await call('GET', '/courses/catalog?limit=50&sortBy=students&sortOrder=DESC')).data.items;
    check(byStudents.every((c: any, i: number) => i === 0 || byStudents[i - 1].totalStudents >= c.totalStudents), 'sort by students (most first)');
    const byRating = (await call('GET', '/courses/catalog?limit=50&sortBy=rating&sortOrder=DESC')).data.items;
    check(byRating.every((c: any, i: number) => i === 0 || byRating[i - 1].averageRating >= c.averageRating), 'sort by rating (highest first)');
    check((await call('GET', '/courses/catalog?sortBy=nonsense')).status === 400, 'unknown sort rejected');

    // ------------------------------------------------------------------
    console.log('\n--- 3. Course landing page ---');
    const course = await one(
      `SELECT c.course_id, c.slug, c.category_id FROM courses c
       WHERE c.status = 'published' AND c.deleted_at IS NULL AND c.is_active
         AND EXISTS (SELECT 1 FROM course_lessons l WHERE l.course_id = c.course_id AND l.is_active)
       ORDER BY c.published_at DESC NULLS LAST LIMIT 1`,
    );
    check(course, 'a published course with lessons exists');
    const landing = await call('GET', `/courses/${course.slug}/landing`);
    check(landing.status === 200, 'landing loads for guests by slug', landing.json);
    const L = landing.data;
    check(L.course.courseId === course.course_id && Array.isArray(L.course.badges), 'course and badges returned');
    check((await call('GET', `/courses/${course.course_id}/landing`)).status === 200, 'landing loads by id too');
    const dbLessons = await one(
      `SELECT COUNT(*)::int n, COALESCE(SUM(l.duration_seconds),0)::int d FROM course_lessons l JOIN course_sections s ON s.section_id = l.section_id
       WHERE l.course_id = $1 AND l.is_active AND s.is_active`, [course.course_id]);
    check(L.curriculum.totalLectures === dbLessons.n && L.curriculum.totalDurationSeconds === dbLessons.d, 'curriculum totals match the database', { api: L.curriculum.totalLectures, db: dbLessons });
    check(L.curriculum.sections.every((s: any) => s.lectures === s.lessons.length), 'section lecture counts consistent');
    const leaked = JSON.stringify(L).match(/contentText|content_text|storageKey|storage_key/);
    check(!leaked, 'no lesson content or storage keys leak to guests');
    check(L.includes && typeof L.includes.videoSeconds === 'number' && typeof L.includes.resources === 'number', '"This course includes" figures present');
    check(L.includes.certificate === Boolean(registry.getModule('certificates')?.is_enabled), 'certificate line follows the Certificates module');
    check(L.instructor && typeof L.instructor.totalCourses === 'number' && typeof L.instructor.totalStudents === 'number', 'instructor card with totals');
    check(Array.isArray(L.breadcrumb), 'breadcrumb returned');
    check('lastUpdatedAt' in L.course && 'totalStudents' in L.course, 'last updated and students on the page');

    const refundable = await one(
      `SELECT slug FROM courses WHERE status = 'published' AND deleted_at IS NULL AND is_active AND is_refundable AND refund_period_days > 0 AND NOT is_free LIMIT 1`);
    if (refundable) {
      const withRefunds = await call('GET', `/courses/${refundable.slug}/landing`);
      if (refundsBefore.is_enabled) check(withRefunds.data.refundGuarantee && withRefunds.data.refundGuarantee.days > 0, 'refund guarantee shown while Refunds is on');
      await call('PATCH', '/platform-modules', 'superAdmin', { changes: [{ key: 'refunds', isEnabled: false }], reason: TEST_REASON });
      const noRefunds = await call('GET', `/courses/${refundable.slug}/landing`);
      check(noRefunds.data.refundGuarantee === null, 'refund guarantee hidden while Refunds is off');
      await call('PATCH', '/platform-modules', 'superAdmin', { changes: [{ key: 'refunds', isEnabled: refundsBefore.is_enabled }], reason: TEST_REASON });
    }
    check((await call('GET', '/courses/does-not-exist-xyz/landing')).status === 404, 'unknown course -> 404');
    const draft = await one(`SELECT slug FROM courses WHERE status <> 'published' AND deleted_at IS NULL LIMIT 1`);
    if (draft) check((await call('GET', `/courses/${draft.slug}/landing`)).status === 404, 'unpublished course -> 404');

    // ------------------------------------------------------------------
    console.log('\n--- 4. Related courses ---');
    const rel = await call('GET', `/courses/${course.slug}/related?limit=3`);
    check(rel.status === 200 && Array.isArray(rel.data.items) && rel.data.items.length <= 3, 'related courses respect the limit');
    check(rel.data.items.every((i: any) => i.courseId !== course.course_id), 'current course excluded');
    check(rel.data.items.every((i: any) => Array.isArray(i.badges) && 'totalStudents' in i), 'related cards carry badges and stats');
    if (course.category_id && rel.data.items.length > 1) {
      const firstOther = rel.data.items.findIndex((i: any) => i.categoryId !== course.category_id);
      const sameAfterOther = firstOther >= 0 && rel.data.items.slice(firstOther).some((i: any) => i.categoryId === course.category_id);
      check(!sameAfterOther, 'same-category courses listed first');
    }

    // ------------------------------------------------------------------
    console.log('\n--- 5. Guest preview of free-preview lessons ---');
    const lesson = await one(
      `SELECT l.lesson_id, l.is_preview, l.content_asset_id, c.instructor_id, c.course_id, l.course_id AS lc
       FROM course_lessons l JOIN courses c ON c.course_id = l.course_id
       WHERE c.status = 'published' AND c.deleted_at IS NULL AND l.is_active AND l.lesson_type = 'video' LIMIT 1`);
    check(lesson, 'a video lesson in a published course exists');
    const storageRoot = process.env.LOCAL_STORAGE_ROOT || path.resolve(process.cwd(), 'private-storage');
    const key = `test-preview/${crypto.randomUUID()}.mp4`;
    const file = path.join(storageRoot, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const bytes = crypto.randomBytes(4096);
    fs.writeFileSync(file, bytes);
    const asset = await one(
      `INSERT INTO media_assets (owner_id, course_id, asset_type, title, original_file_name, mime_type, file_size_bytes,
                                 storage_provider, storage_key, visibility, processing_status, duration_seconds)
       VALUES ($1, $2, 'video', 'Test preview', 'preview.mp4', 'video/mp4', $3, 'local', $4, 'private', 'ready', 30)
       RETURNING asset_id`,
      [lesson.instructor_id, lesson.course_id, bytes.length, key],
    );
    tempAsset = { assetId: asset.asset_id, file, lessonId: lesson.lesson_id, prevPreview: lesson.is_preview, prevAsset: lesson.content_asset_id };
    await db.query(`UPDATE course_lessons SET content_asset_id = $1, is_preview = TRUE WHERE lesson_id = $2`, [asset.asset_id, lesson.lesson_id]);

    const previewUrl = `/student-learning/public/lessons/${lesson.lesson_id}/media`;
    const full = await fetch(base + previewUrl);
    const fullBody = Buffer.from(await full.arrayBuffer());
    check(full.status === 200 && fullBody.equals(bytes), 'guest streams a preview lesson without signing in');
    const ranged = await fetch(base + previewUrl, { headers: { Range: 'bytes=0-99' } });
    const rangedBody = Buffer.from(await ranged.arrayBuffer());
    check(ranged.status === 206 && rangedBody.length === 100 && ranged.headers.get('content-range') === `bytes 0-99/${bytes.length}`, 'range requests (seeking) work');
    check((await fetch(base + previewUrl, { method: 'HEAD' })).status === 200, 'HEAD works');

    const landingWithPreview = await call('GET', `/courses/${lesson.course_id}/landing`);
    const pl = landingWithPreview.data.curriculum.sections.flatMap((s: any) => s.lessons).find((l: any) => l.lessonId === lesson.lesson_id);
    check(pl && pl.isPreview && pl.previewAvailable, 'landing marks the lesson as previewable');

    await db.query(`UPDATE course_lessons SET is_preview = FALSE WHERE lesson_id = $1`, [lesson.lesson_id]);
    check((await fetch(base + previewUrl)).status === 404, 'non-preview lesson refused to guests');
    check((await fetch(base + `/student-learning/public/lessons/${crypto.randomUUID()}/media`)).status === 404, 'unknown lesson -> 404');
    check((await fetch(base + `/student-learning/public/lessons/not-a-uuid/media`)).status === 400, 'invalid id -> 400');
  } finally {
    if (tempAsset) {
      await db.query(`UPDATE course_lessons SET content_asset_id = $1, is_preview = $2 WHERE lesson_id = $3`, [tempAsset.prevAsset, tempAsset.prevPreview, tempAsset.lessonId]);
      await db.query(`DELETE FROM media_assets WHERE asset_id = $1`, [tempAsset.assetId]);
      try { fs.unlinkSync(tempAsset.file); } catch {}
    }
    if (badgeSettingBefore) {
      await db.query(`UPDATE system_settings SET setting_value = $1 WHERE setting_key = 'course_badges'`, [badgeSettingBefore.setting_value]);
    } else {
      await db.query(`DELETE FROM system_settings WHERE setting_key = 'course_badges'`);
    }
    await db.query(`UPDATE platform_modules SET is_enabled = $1 WHERE module_key = 'refunds'`, [refundsBefore.is_enabled]);
    await db.query(`DELETE FROM module_audit_logs WHERE reason = $1`, [TEST_REASON]);
    await registry.reload();
    console.log('[CLEANUP] Settings, module state and test files restored.');
    await app.close();
  }
}

run()
  .then(() => {
    console.log(`\nALL ${passed} CHECKS PASSED`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('TEST SUITE FAILED:', err.message || err);
    process.exit(1);
  });

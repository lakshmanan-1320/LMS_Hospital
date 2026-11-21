/**
 * Video playback without waiting on FFmpeg: the MP4 streams immediately, HLS is prepared in the
 * background (once per video, written atomically) and only used when complete.
 * FFmpeg is replaced by a slow fake so the test runs anywhere; everything else is live.
 *
 * Run: npx ts-node --transpile-only src/student-learning/test-hls-background.ts
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
import { VideoProcessorService } from '../curriculum/video-processor.service';

let passed = 0;
function check(condition: any, label: string, detail?: any) {
  if (!condition) throw new Error(`FAILED: ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 600)}` : ''}`);
  passed++;
  console.log(`[PASS] ${label}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false, rawBody: true });
  app.use(((cookieParser as any).default || cookieParser)());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const base = (await app.getUrl()).replace('[::1]', 'localhost');
  const db = app.get(DatabaseService);
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);
  const secret = config.get<string>('auth.jwtAccessSecret');
  const one = async (sql: string, params: any[] = []) => (await db.query(sql, params)).rows[0];

  // Fake FFmpeg: slow, writes a playlist + one segment, counts runs, can be told to fail.
  const processor = app.get(VideoProcessorService) as any;
  let runs = 0;
  let failNext = false;
  processor.generateHls = async (_src: string, outDir: string) => {
    runs++;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'master.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3\n'); // partial, as FFmpeg writes it
    await sleep(1500);
    if (failNext) {
      failNext = false;
      throw new Error('simulated ffmpeg failure');
    }
    fs.writeFileSync(path.join(outDir, 'segment_000.ts'), Buffer.alloc(188, 0x47));
    fs.writeFileSync(path.join(outDir, 'master.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:6.0,\nsegment_000.ts\n#EXT-X-ENDLIST\n');
    return path.join(outDir, 'master.m3u8');
  };

  const lesson = await one(
    `SELECT l.lesson_id, l.is_preview, l.content_asset_id, c.instructor_id, c.course_id
     FROM course_lessons l JOIN courses c ON c.course_id = l.course_id
     WHERE c.status = 'published' AND c.deleted_at IS NULL AND c.is_active AND l.is_active AND l.lesson_type = 'video' LIMIT 1`,
  );
  check(lesson, 'a video lesson in a published course exists');
  const viewer = await one(`SELECT user_id, email FROM users WHERE is_active AND deleted_at IS NULL AND user_id <> $1 LIMIT 1`, [lesson.instructor_id]);
  const token = jwt.sign({ sub: viewer.user_id, userId: viewer.user_id, email: viewer.email, roles: [], permissions: [] }, { secret, expiresIn: '10m' });
  const get = (p: string, headers: Record<string, string> = {}) => fetch(base + p, { headers: { Authorization: `Bearer ${token}`, ...headers } });

  const storageRoot = path.resolve(config.get<string>('storage.localRoot') || 'private-storage');
  const key = `test-hls/${crypto.randomUUID()}.mp4`;
  const file = path.join(storageRoot, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const bytes = crypto.randomBytes(8192);
  fs.writeFileSync(file, bytes);
  const asset = await one(
    `INSERT INTO media_assets (owner_id, course_id, asset_type, title, original_file_name, mime_type, file_size_bytes,
                               storage_provider, storage_key, visibility, processing_status, duration_seconds, has_audio)
     VALUES ($1, $2, 'video', 'Test HLS', 'hls.mp4', 'video/mp4', $3, 'local', $4, 'private', 'ready', 12, TRUE)
     RETURNING asset_id`,
    [lesson.instructor_id, lesson.course_id, bytes.length, key],
  );
  // Preview lesson so any signed-in viewer may open it (access rules are covered elsewhere).
  await db.query(`UPDATE course_lessons SET content_asset_id = $1, is_preview = TRUE WHERE lesson_id = $2`, [asset.asset_id, lesson.lesson_id]);
  const hlsDir = path.join(storageRoot, `courses/${lesson.course_id}/media/${asset.asset_id}-hls`);
  const L = `/student-learning/lessons/${lesson.lesson_id}`;

  try {
    // 1. First open: HLS not ready, conversion starts in the background, response is immediate.
    let t = Date.now();
    let res = await get(L);
    let body: any = await res.json();
    let media = (body?.data?.data ?? body?.data)?.media;
    check(res.status === 200 && media?.hlsReady === false, 'lesson says HLS is not ready yet', media);
    check(Date.now() - t < 1000, 'opening the lesson does not wait for the conversion', Date.now() - t);

    // 2. MP4 streams right away (with seeking).
    res = await get(`${L}/media`, { Range: 'bytes=0-99' });
    check(res.status === 206 && Buffer.from(await res.arrayBuffer()).length === 100, 'MP4 streams immediately with range support');

    // 3. HLS requests answer fast with 404 while preparing, and never serve the partial playlist.
    t = Date.now();
    res = await get(`${L}/hls/master.m3u8`);
    check(res.status === 404 && Date.now() - t < 1000, 'HLS request answers at once (404) while preparing', { status: res.status, ms: Date.now() - t });
    check(!fs.existsSync(path.join(hlsDir, 'master.m3u8')), 'the half-written playlist is not in the served folder');

    // 4. Only one conversion even when many requests arrive.
    await Promise.all([get(L), get(`${L}/hls/master.m3u8`), get(L)]);
    check(runs === 1, 'only one FFmpeg run per video', runs);

    // 5. When finished, HLS is complete and used.
    await sleep(2200);
    res = await get(L);
    body = await res.json();
    media = (body?.data?.data ?? body?.data)?.media;
    check(media?.hlsReady === true, 'lesson reports HLS ready after the conversion', media);
    res = await get(`${L}/hls/master.m3u8`);
    const playlist = await res.text();
    check(res.status === 200 && playlist.includes('#EXT-X-ENDLIST'), 'complete playlist is served');
    res = await get(`${L}/hls/segment_000.ts`);
    check(res.status === 200 && (await res.arrayBuffer()).byteLength === 188, 'segments are served');
    check(!fs.existsSync(`${hlsDir}.tmp`), 'temporary folder is cleaned up');
    check(runs === 1, 'no further conversions once ready', runs);

    // 6. A failed conversion leaves nothing half-done and can be retried.
    fs.rmSync(hlsDir, { recursive: true, force: true });
    failNext = true;
    await get(L);
    await sleep(2000);
    check(!fs.existsSync(hlsDir) && !fs.existsSync(`${hlsDir}.tmp`), 'a failed conversion leaves no partial output');
    res = await get(`${L}/media`, { Range: 'bytes=0-15' });
    check(res.status === 206, 'MP4 still plays after a failed conversion');
    await get(L);
    await sleep(2200);
    check(runs === 3 && fs.existsSync(path.join(hlsDir, 'master.m3u8')), 'the next open retries the conversion and succeeds', runs);
  } finally {
    await db.query(`UPDATE course_lessons SET content_asset_id = $1, is_preview = $2 WHERE lesson_id = $3`, [lesson.content_asset_id, lesson.is_preview, lesson.lesson_id]);
    await db.query(`DELETE FROM media_assets WHERE asset_id = $1`, [asset.asset_id]);
    fs.rmSync(hlsDir, { recursive: true, force: true });
    fs.rmSync(`${hlsDir}.tmp`, { recursive: true, force: true });
    fs.rmSync(file, { force: true });
    await app.close();
  }
  console.log(`\nAll ${passed} HLS checks passed.`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

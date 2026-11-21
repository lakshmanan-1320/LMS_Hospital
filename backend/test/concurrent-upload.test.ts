import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lms_db',
});

async function simulateMediaUpload(
  courseId: string,
  userId: string,
  checksum: string,
  simulatedProcessingDelayMs: number,
  clientTag: string
): Promise<{ assetId: string; wasReused: boolean; log: string[] }> {
  const logs: string[] = [];
  const client = await pool.connect();
  let lockAcquired = false;
  const assetId = randomUUID();

  try {
    logs.push(`[${clientTag}] Requesting advisory lock for course=${courseId}`);
    const t0 = Date.now();
    await client.query('SELECT pg_advisory_lock(hashtext($1), hashtext($2))', [courseId, checksum]);
    lockAcquired = true;
    logs.push(`[${clientTag}] Lock acquired in ${Date.now() - t0}ms`);

    // Check duplicate
    const checkRes = await client.query(
      `SELECT asset_id, processing_status FROM media_assets
 WHERE course_id = $1 AND checksum_sha256 = $2
       LIMIT 1`,
      [courseId, checksum]
    );

    if (checkRes.rows.length > 0 && checkRes.rows[0].processing_status === 'ready') {
      logs.push(`[${clientTag}] Duplicate detected! Reusing asset ${checkRes.rows[0].asset_id}`);
      return { assetId: checkRes.rows[0].asset_id, wasReused: true, log: logs };
    }

    logs.push(`[${clientTag}] No duplicate found. Creating media asset ${assetId}`);
    await client.query(
      `INSERT INTO media_assets (
        asset_id, owner_id, course_id, asset_type, title, original_file_name,
        mime_type, file_size_bytes, checksum_sha256, storage_key, storage_provider, processing_status
      ) VALUES ($1, $2, $3, 'video', 'test.mp4', 'test.mp4', 'video/mp4', 1024, $4, $5, 'local', 'processing')`,
      [assetId, userId, courseId, checksum, `courses/${courseId}/media/${assetId}.mp4`]
    );

    // Simulate transcode / processing delay
    logs.push(`[${clientTag}] Processing media (simulating ${simulatedProcessingDelayMs}ms delay)...`);
    await new Promise((r) => setTimeout(r, simulatedProcessingDelayMs));

    // Mark ready
    await client.query(
      `UPDATE media_assets SET processing_status = 'ready', duration_seconds = 60, has_audio = true WHERE asset_id = $1`,
      [assetId]
    );
    logs.push(`[${clientTag}] Media asset ${assetId} marked ready`);

    return { assetId, wasReused: false, log: logs };
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock(hashtext($1), hashtext($2))', [courseId, checksum]);
      logs.push(`[${clientTag}] Lock released`);
    }
    client.release();
  }
}

async function run() {
  console.log('=== REAL POSTGRESQL CONCURRENT ADVISORY LOCK INTEGRATION TEST ===\n');

  // Verify DB connection
  const check = await pool.query('SELECT current_user, current_database()');
  console.log(`Connected to database "${check.rows[0].current_database}" as user "${check.rows[0].current_user}"\n`);

  // Find a valid user to use as owner
  const userRes = await pool.query('SELECT user_id FROM users LIMIT 1');
  const userId = userRes.rows[0]?.user_id;
  if (!userId) {
    throw new Error('No user found in database for test.');
  }

  // Find a valid course
  const courseRes = await pool.query('SELECT course_id FROM courses LIMIT 2');
  const course1 = courseRes.rows[0]?.course_id;
  const course2 = courseRes.rows[1]?.course_id || course1;
  if (!course1) {
    throw new Error('No course found in database for test.');
  }

  const testChecksum = 'concurrent_test_' + randomUUID().replace(/-/g, '').slice(0, 32);

  console.log(`Test Parameters:`);
  console.log(`- Course 1 ID: ${course1}`);
  console.log(`- Course 2 ID: ${course2}`);
  console.log(`- Test SHA-256 Checksum: ${testChecksum}\n`);

  console.log('Test 1: Launching 2 simultaneous uploads of SAME file to SAME course (course1)...');
  const tStart = Date.now();
  const [result1, result2] = await Promise.all([
    simulateMediaUpload(course1, userId, testChecksum, 300, 'Client-A'),
    simulateMediaUpload(course1, userId, testChecksum, 300, 'Client-B'),
  ]);
  const totalDuration = Date.now() - tStart;

  console.log('\n--- Execution Timeline ---');
  for (const l of result1.log) console.log(' ', l);
  for (const l of result2.log) console.log(' ', l);

  console.log(`\nTotal Concurrent Execution Time: ${totalDuration}ms`);
  console.log(`Client-A Result: assetId=${result1.assetId}, wasReused=${result1.wasReused}`);
  console.log(`Client-B Result: assetId=${result2.assetId}, wasReused=${result2.wasReused}`);

  // Assertions
  const countRes = await pool.query(
    'SELECT count(*) FROM media_assets WHERE course_id = $1 AND checksum_sha256 = $2',
    [course1, testChecksum]
  );
  const totalAssetsCreated = parseInt(countRes.rows[0].count, 10);
  console.log(`\nAssets in DB for this (course, checksum): ${totalAssetsCreated}`);

  if (totalAssetsCreated !== 1) {
    throw new Error(`FAIL: Expected exactly 1 asset in DB, found ${totalAssetsCreated}`);
  }
  if (result1.assetId !== result2.assetId) {
    throw new Error(`FAIL: Expected both clients to resolve to the same asset ID (${result1.assetId} vs ${result2.assetId})`);
  }
  const oneReused = (result1.wasReused && !result2.wasReused) || (!result1.wasReused && result2.wasReused);
  if (!oneReused) {
    throw new Error(`FAIL: Expected exactly one client to create and one to reuse`);
  }
  console.log('✅ TEST 1 PASSED: Concurrency serialized by advisory lock; duplicate prevented, single asset reused!\n');

  // Test 2: Isolation across different courses
  if (course1 !== course2) {
    console.log('Test 2: Launching simultaneous upload of SAME file to DIFFERENT courses...');
    const diffChecksum = 'concurrent_diff_' + randomUUID().replace(/-/g, '').slice(0, 32);
    const [resDiff1, resDiff2] = await Promise.all([
      simulateMediaUpload(course1, userId, diffChecksum, 200, 'Course1-Upload'),
      simulateMediaUpload(course2, userId, diffChecksum, 200, 'Course2-Upload'),
    ]);

    const countCourse1 = await pool.query('SELECT count(*) FROM media_assets WHERE course_id = $1 AND checksum_sha256 = $2', [course1, diffChecksum]);
    const countCourse2 = await pool.query('SELECT count(*) FROM media_assets WHERE course_id = $1 AND checksum_sha256 = $2', [course2, diffChecksum]);

    console.log(`Course 1 assets: ${countCourse1.rows[0].count}, Course 2 assets: ${countCourse2.rows[0].count}`);
    if (parseInt(countCourse1.rows[0].count, 10) !== 1 || parseInt(countCourse2.rows[0].count, 10) !== 1) {
      throw new Error('FAIL: Multi-course isolation failed');
    }
    console.log('✅ TEST 2 PASSED: Multi-course isolation preserved! Both courses have their own asset.\n');

    // Clean up test 2 records
    await pool.query('DELETE FROM media_assets WHERE checksum_sha256 = $1', [diffChecksum]);
  }

  // Clean up test 1 records
  await pool.query('DELETE FROM media_assets WHERE checksum_sha256 = $1', [testChecksum]);
  console.log('Test records cleaned up successfully.');

  await pool.end();
  console.log('\nAll Real PostgreSQL Concurrent Advisory Lock Integration Tests PASSED!');
}

run().catch((err) => {
  console.error('Integration test error:', err);
  process.exit(1);
});

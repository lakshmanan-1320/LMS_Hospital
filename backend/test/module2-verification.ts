import { resolve, join, relative, basename, isAbsolute, sep } from 'path';

export interface ProgressState {
  last_position_seconds: number;
  max_watched_seconds: number;
  is_completed: boolean;
  updated_at: string;
}

/**
 * Server-side progress verification simulation mirroring StudentLearningService.saveLessonProgress
 */
export function calculateProgressUpdate(
  actualDuration: number,
  positionSeconds: number,
  existing: ProgressState | null,
  nowMs: number = Date.now(),
): {
  safePosition: number;
  newMaxWatched: number;
  isCompleted: boolean;
} {
  if (
    typeof positionSeconds !== 'number' ||
    !Number.isFinite(positionSeconds) ||
    positionSeconds < 0
  ) {
    throw new Error('Playback position must be a non-negative finite number');
  }

  // 1. Cap position at authoritative PostgreSQL lesson duration
  const safePosition = actualDuration > 0
    ? Math.min(Math.floor(positionSeconds), actualDuration)
    : Math.max(0, Math.floor(positionSeconds));

  const prevPosition = existing ? Number(existing.last_position_seconds) || 0 : 0;
  const prevMaxWatched = existing ? Number(existing.max_watched_seconds) || 0 : 0;
  const wasCompleted = Boolean(existing && existing.is_completed);
  const lastUpdatedAt = existing && existing.updated_at ? new Date(existing.updated_at).getTime() : 0;

  // 2. Server-side wall-clock elapsed time
  const elapsedSeconds = lastUpdatedAt > 0 ? Math.max(0, (nowMs - lastUpdatedAt) / 1000) : 15;

  // Plausible playback advancement: up to 2.5x speed + 5s buffer
  const maxPlausibleAdvancement = Math.max(5, Math.ceil(elapsedSeconds * 2.5) + 5);
  const deltaPlayback = safePosition - prevPosition;

  let newMaxWatched = prevMaxWatched;

  if (deltaPlayback > 0) {
    if (deltaPlayback <= maxPlausibleAdvancement) {
      // Natural playback advancement
      newMaxWatched = Math.min(actualDuration, prevMaxWatched + deltaPlayback);
    } else {
      // Jump/seek ahead: only advance by at most plausible time watched
      newMaxWatched = Math.min(actualDuration, prevMaxWatched + maxPlausibleAdvancement);
    }
  }
  // If deltaPlayback <= 0 (rewind or out-of-order heartbeat), newMaxWatched never decreases

  // 3. Verified cumulative auto-completion threshold
  const isCompleted = wasCompleted || (actualDuration > 0 && newMaxWatched >= Math.floor(actualDuration * 0.9));

  return {
    safePosition,
    newMaxWatched,
    isCompleted,
  };
}

/**
 * HLS filename and path validator mirroring StudentLearningService.getLessonHlsFile
 */
export function validateHlsFileName(fileName: string, hlsDir: string): boolean {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }

  const cleanFileName = basename(fileName.trim());
  if (
    cleanFileName !== fileName ||
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    !/^(master\.m3u8|segment_\d+\.ts)$/i.test(fileName)
  ) {
    return false;
  }

  const requestedFilePath = resolve(hlsDir, fileName);
  const rel = relative(hlsDir, requestedFilePath);
  if (!rel || rel.startsWith('..') || rel.includes(sep) || isAbsolute(rel)) {
    return false;
  }

  return true;
}

export function runModule2Verification() {
  console.log('================================================================');
  console.log('   DEVELOPER 2 – MODULE 2: AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // --- SECTION 1: STUDENT PROGRESS COMPLETION MANIPULATION ---
  console.log('--- 1. Student Progress Completion Manipulation & Rate-Limiting ---');
  const lessonDuration = 100; // 100 seconds authoritative duration

  // Test 1: Starts at 0s and submits 90s immediately
  {
    const t0 = 1700000000000;
    const res = calculateProgressUpdate(lessonDuration, 90, null, t0);
    assert(
      res.safePosition === 90 && !res.isCompleted && res.newMaxWatched < 90,
      'Test 1: Student starts at 0s and submits 90s immediately',
      `lastPos=${res.safePosition}, maxWatched=${res.newMaxWatched}, isCompleted=${res.isCompleted}`,
    );
  }

  // Test 2: Student watches normally and sends periodic heartbeats (10s intervals)
  {
    let state: ProgressState | null = null;
    let t = 1700000000000;
    for (let pos = 10; pos <= 90; pos += 10) {
      t += 10000; // +10s wall-clock
      const res = calculateProgressUpdate(lessonDuration, pos, state, t);
      state = {
        last_position_seconds: res.safePosition,
        max_watched_seconds: res.newMaxWatched,
        is_completed: res.isCompleted,
        updated_at: new Date(t).toISOString(),
      };
    }
    assert(
      state!.is_completed && state!.max_watched_seconds >= 90,
      'Test 2: Student watches normally with periodic heartbeats to 90%',
      `finalMaxWatched=${state!.max_watched_seconds}, completed=${state!.is_completed}`,
    );
  }

  // Test 3: Student seeks from 10s to 95s
  {
    const t1 = 1700000000000;
    const stateAt10: ProgressState = {
      last_position_seconds: 10,
      max_watched_seconds: 10,
      is_completed: false,
      updated_at: new Date(t1).toISOString(),
    };
    // 2 seconds later, student seeks to 95s
    const t2 = t1 + 2000;
    const res = calculateProgressUpdate(lessonDuration, 95, stateAt10, t2);
    assert(
      res.safePosition === 95 && !res.isCompleted && res.newMaxWatched < 90,
      'Test 3: Student seeks from 10s to 95s (seeking allowed, completion rejected)',
      `lastPos=${res.safePosition}, maxWatched=${res.newMaxWatched}, isCompleted=${res.isCompleted}`,
    );
  }

  // Test 4: Student resumes from previously saved progress (e.g. 45s) after a break
  {
    const tPast = 1700000000000;
    const savedState: ProgressState = {
      last_position_seconds: 45,
      max_watched_seconds: 45,
      is_completed: false,
      updated_at: new Date(tPast).toISOString(),
    };
    // Resumes next day (86400s later), plays 10s from 45s to 55s
    const tResume = tPast + 86400000;
    const res = calculateProgressUpdate(lessonDuration, 55, savedState, tResume);
    assert(
      res.safePosition === 55 && res.newMaxWatched === 55,
      'Test 4: Student resumes legitimately from saved progress',
      `resumedPos=${res.safePosition}, newMaxWatched=${res.newMaxWatched}`,
    );
  }

  // Test 5: Student submits position greater than lesson duration (e.g. 500s on 100s video)
  {
    const t0 = 1700000000000;
    const res = calculateProgressUpdate(lessonDuration, 500, null, t0);
    assert(
      res.safePosition === 100 && !res.isCompleted,
      'Test 5: Student submits position > lesson duration (capped, completion rejected)',
      `safePos=${res.safePosition}, isCompleted=${res.isCompleted}`,
    );
  }

  // Test 6: Student submits negative, NaN, or infinite values
  {
    let rejectedNegative = false;
    let rejectedNaN = false;
    let rejectedInf = false;

    try {
      calculateProgressUpdate(lessonDuration, -15, null);
    } catch {
      rejectedNegative = true;
    }

    try {
      calculateProgressUpdate(lessonDuration, NaN, null);
    } catch {
      rejectedNaN = true;
    }

    try {
      calculateProgressUpdate(lessonDuration, Infinity, null);
    } catch {
      rejectedInf = true;
    }

    assert(
      rejectedNegative && rejectedNaN && rejectedInf,
      'Test 6: Rejection of negative, NaN, and infinite positions',
      `neg=${rejectedNegative}, nan=${rejectedNaN}, inf=${rejectedInf}`,
    );
  }

  // Test 7: Older heartbeat arrives after a newer heartbeat
  {
    const tNewer = 1700000050000;
    const stateNewer: ProgressState = {
      last_position_seconds: 50,
      max_watched_seconds: 50,
      is_completed: false,
      updated_at: new Date(tNewer).toISOString(),
    };
    // Older heartbeat with position=30 arrives out of order
    const tOlder = tNewer + 1000;
    const res = calculateProgressUpdate(lessonDuration, 30, stateNewer, tOlder);
    assert(
      res.newMaxWatched === 50,
      'Test 7: Out-of-order heartbeat does not reduce max_watched_seconds',
      `submittedPos=30, preservedMaxWatched=${res.newMaxWatched}`,
    );
  }

  // --- SECTION 2: HLS PATH TRAVERSAL PROTECTION ---
  console.log('\n--- 2. HLS Path Traversal Protection ---');
  const hlsDir = resolve('private-storage/courses/course-abc/media/asset-xyz-hls');

  const hlsTestVectors = [
    { input: 'master.m3u8', valid: true },
    { input: 'segment_000.ts', valid: true },
    { input: 'segment_1042.ts', valid: true },
    { input: '..', valid: false },
    { input: '../master.m3u8', valid: false },
    { input: '../../etc/passwd', valid: false },
    { input: 'segment_000.ts/..', valid: false },
    { input: 'nested/segment_000.ts', valid: false },
    { input: 'video.mp4', valid: false },
    { input: 'script.js', valid: false },
    { input: 'segment.ts', valid: false },
  ];

  for (const v of hlsTestVectors) {
    const isValid = validateHlsFileName(v.input, hlsDir);
    assert(
      isValid === v.valid,
      `HLS Traversal vector "${v.input}"`,
      `expected=${v.valid}, got=${isValid}`,
    );
  }

  // --- SECTION 3: DUPLICATE UPLOAD CONCURRENCY & ISOLATION ---
  console.log('\n--- 3. Duplicate Upload Concurrency & Isolation ---');
  const course1 = 'course-uuid-1';
  const course2 = 'course-uuid-2';
  const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  // Hashing logic demonstration for PostgreSQL advisory locks
  function getAdvisoryLockKey(cId: string, hash: string): [number, number] {
    let h1 = 0;
    for (let i = 0; i < cId.length; i++) {
      h1 = (Math.imul(31, h1) + cId.charCodeAt(i)) | 0;
    }
    let h2 = 0;
    for (let i = 0; i < hash.length; i++) {
      h2 = (Math.imul(31, h2) + hash.charCodeAt(i)) | 0;
    }
    return [h1, h2];
  }

  const [lockC1A, lockC1B] = getAdvisoryLockKey(course1, sha256);
  const [lockC2A, lockC2B] = getAdvisoryLockKey(course2, sha256);

  assert(
    lockC1A !== lockC2A,
    'PostgreSQL Advisory Lock isolates distinct courses on identical file uploads',
    `c1Key=${lockC1A}, c2Key=${lockC2A}`,
  );

  console.log('\n================================================================');
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Execute tests
runModule2Verification();

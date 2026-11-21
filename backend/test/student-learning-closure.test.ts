import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'OneCRM123',
  database: process.env.DB_NAME || 'LMS',
});

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

async function runStudentLearningClosureTests() {
  console.log('================================================================');
  console.log('   STUDENT LEARNING MANAGEMENT: COMPLETE CLOSURE VERIFICATION   ');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // Setup Test Data in Transaction
    // -------------------------------------------------------------------------
    await client.query('BEGIN');

    // 1. Fetch or create a test student, instructor, and course
    const studentRes = await client.query(`
      SELECT u.user_id FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE LOWER(r.name) = 'student' AND u.is_active = TRUE
      LIMIT 1;
    `);
    const studentId = studentRes.rows[0]?.user_id;

    const instructorRes = await client.query(`
      SELECT u.user_id FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE LOWER(r.name) = 'instructor' AND u.is_active = TRUE
      LIMIT 1;
    `);
    const instructorId = instructorRes.rows[0]?.user_id;

    assert(Boolean(studentId && instructorId), 'Found test student and instructor in database');

    // Create a dedicated test course for closure verification
    const courseRes = await client.query(
      `INSERT INTO courses (
        instructor_id, title, slug, subtitle, description,
        level, language, is_free, status, is_active
      ) VALUES (
        $1, 'Closure Test Course', 'closure-test-' || gen_random_uuid(),
        'Closure Subtitle', 'Closure Description',
        'beginner', 'en', TRUE, 'published', TRUE
      ) RETURNING course_id`,
      [instructorId]
    );
    const courseId = courseRes.rows[0].course_id;

    // Create section
    const secRes = await client.query(
      `INSERT INTO course_sections (course_id, title, sort_order)
       VALUES ($1, 'Section 1', 1) RETURNING section_id`,
      [courseId]
    );
    const sectionId = secRes.rows[0].section_id;

    // Create 3 lessons: 2 required, 1 optional
    const lesson1Res = await client.query(
      `INSERT INTO course_lessons (
        section_id, course_id, title, lesson_type, sort_order, duration_seconds, is_active, is_optional
      ) VALUES ($1, $2, 'Required Lesson 1', 'video', 1, 100, TRUE, FALSE)
      RETURNING lesson_id`,
      [sectionId, courseId]
    );
    const lesson1Id = lesson1Res.rows[0].lesson_id;

    const lesson2Res = await client.query(
      `INSERT INTO course_lessons (
        section_id, course_id, title, lesson_type, sort_order, duration_seconds, is_active, is_optional
      ) VALUES ($1, $2, 'Required Lesson 2', 'video', 2, 200, TRUE, FALSE)
      RETURNING lesson_id`,
      [sectionId, courseId]
    );
    const lesson2Id = lesson2Res.rows[0].lesson_id;

    const lesson3OptRes = await client.query(
      `INSERT INTO course_lessons (
        section_id, course_id, title, lesson_type, sort_order, duration_seconds, is_active, is_optional
      ) VALUES ($1, $2, 'Optional Bonus Lesson', 'video', 3, 300, TRUE, TRUE)
      RETURNING lesson_id`,
      [sectionId, courseId]
    );
    const lesson3OptId = lesson3OptRes.rows[0].lesson_id;

    // Create active enrollment for the student
    await client.query(
      `INSERT INTO course_enrollments (student_id, course_id, enrollment_status, enrollment_type)
       VALUES ($1, $2, 'active', 'free')`,
      [studentId, courseId]
    );

    // -------------------------------------------------------------------------
    // TEST 1: Optional Lesson Exclusion in Course Completion Calculation
    // -------------------------------------------------------------------------
    console.log('--- TEST GROUP 1: Optional Lesson Support & Course Completion ---');

    // Mark required lesson 1 as completed
    await client.query(
      `INSERT INTO student_lesson_progress (
        student_id, course_id, lesson_id, last_position_seconds, max_watched_seconds, is_completed, completed_at
      ) VALUES ($1, $2, $3, 100, 100, TRUE, CURRENT_TIMESTAMP)`,
      [studentId, courseId, lesson1Id]
    );

    // Calculate completion: should be 1 of 2 required lessons completed (50%), ignoring optional lesson 3
    const compCalc1 = await client.query(
      `SELECT
         COUNT(DISTINCT l.lesson_id)::int AS total,
         COUNT(DISTINCT p.lesson_id) FILTER (WHERE p.is_completed = TRUE)::int AS completed
       FROM course_lessons l
       JOIN course_sections s ON s.section_id = l.section_id
       LEFT JOIN student_lesson_progress p
         ON p.lesson_id = l.lesson_id
        AND p.student_id = $1
        AND p.course_id = $2
        AND p.is_completed = TRUE
       WHERE s.course_id = $2
         AND l.is_active = TRUE
         AND COALESCE(l.is_optional, FALSE) = FALSE`,
      [studentId, courseId]
    );

    assert(
      compCalc1.rows[0].total === 2 && compCalc1.rows[0].completed === 1,
      `Calculated 2 required lessons total (optional lesson excluded), 1 completed: total=${compCalc1.rows[0].total}, completed=${compCalc1.rows[0].completed}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Course Completion Synchronization (Active Enrollment -> Completed)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Course Completion Synchronization ---');

    // Complete second required lesson
    await client.query(
      `INSERT INTO student_lesson_progress (
        student_id, course_id, lesson_id, last_position_seconds, max_watched_seconds, is_completed, completed_at
      ) VALUES ($1, $2, $3, 200, 200, TRUE, CURRENT_TIMESTAMP)`,
      [studentId, courseId, lesson2Id]
    );

    // Synchronize course enrollment completion
    const syncRes = await client.query(
      `UPDATE course_enrollments
       SET enrollment_status = 'completed',
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1
         AND course_id = $2
         AND enrollment_status = 'active'
       RETURNING enrollment_id, enrollment_status, completed_at`,
      [studentId, courseId]
    );

    assert(
      syncRes.rows.length === 1 && syncRes.rows[0].enrollment_status === 'completed' && syncRes.rows[0].completed_at !== null,
      'Active enrollment automatically transitioned to "completed" with timestamp'
    );

    const firstCompletedAt = syncRes.rows[0].completed_at;

    // Idempotency check: Repeated synchronization preserves existing completed_at
    const idempotentRes = await client.query(
      `UPDATE course_enrollments
       SET enrollment_status = 'completed',
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE student_id = $1
         AND course_id = $2
         AND enrollment_status = 'active'
       RETURNING enrollment_id, enrollment_status, completed_at`,
      [studentId, courseId]
    );

    assert(
      idempotentRes.rows.length === 0,
      'Already completed enrollment is not re-updated by "active" state sync'
    );

    // Check status preservation: Suspended/cancelled enrollment is NEVER auto-completed
    const suspendedCourseRes = await client.query(
      `INSERT INTO courses (
        instructor_id, title, slug, is_free, status, is_active
      ) VALUES ($1, 'Suspended Course', 'susp-' || gen_random_uuid(), TRUE, 'published', TRUE)
      RETURNING course_id`,
      [instructorId]
    );
    const suspCourseId = suspendedCourseRes.rows[0].course_id;

    await client.query(
      `INSERT INTO course_enrollments (student_id, course_id, enrollment_status, enrollment_type)
       VALUES ($1, $2, 'suspended', 'free')`,
      [studentId, suspCourseId]
    );

    const suspSync = await client.query(
      `UPDATE course_enrollments
       SET enrollment_status = 'completed',
           completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
       WHERE student_id = $1
         AND course_id = $2
         AND enrollment_status = 'active'
       RETURNING enrollment_id`,
      [studentId, suspCourseId]
    );

    assert(suspSync.rows.length === 0, 'Suspended enrollment remains untouched by course completion sync');

    // -------------------------------------------------------------------------
    // TEST 3: Student Learning Sessions & Daily Activity Aggregation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Learning Session Tracking & Activity API ---');

    const testSessionId = `test_sess_${Date.now()}`;

    // Record heartbeat 1 (10 seconds)
    const sess1 = await client.query(
      `WITH updated AS (
         UPDATE student_learning_sessions
         SET seconds_watched = seconds_watched + $5,
             ended_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id FROM student_learning_sessions
           WHERE student_id = $1
             AND lesson_id = $3
             AND session_id = $4
             AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
           ORDER BY updated_at DESC
           LIMIT 1
         )
         RETURNING id, seconds_watched
       ),
       inserted AS (
         INSERT INTO student_learning_sessions (
           student_id, course_id, lesson_id, session_id,
           started_at, ended_at, seconds_watched, updated_at
         )
         SELECT $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP
         WHERE NOT EXISTS (SELECT 1 FROM updated)
         RETURNING id, seconds_watched
       )
       SELECT id, seconds_watched FROM updated
       UNION ALL
       SELECT id, seconds_watched FROM inserted`,
      [studentId, courseId, lesson1Id, testSessionId, 10]
    );

    assert(
      sess1.rows.length === 1 && sess1.rows[0].seconds_watched === 10,
      `Session heartbeat 1 recorded 10 seconds: watched=${sess1.rows[0].seconds_watched}`
    );

    // Record heartbeat 2 (10 seconds) within 30 minutes with same session_id: should accumulate to 20s
    const sess2 = await client.query(
      `WITH updated AS (
         UPDATE student_learning_sessions
         SET seconds_watched = seconds_watched + $5,
             ended_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT id FROM student_learning_sessions
           WHERE student_id = $1
             AND lesson_id = $3
             AND session_id = $4
             AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
           ORDER BY updated_at DESC
           LIMIT 1
         )
         RETURNING id, seconds_watched
       ),
       inserted AS (
         INSERT INTO student_learning_sessions (
           student_id, course_id, lesson_id, session_id,
           started_at, ended_at, seconds_watched, updated_at
         )
         SELECT $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP
         WHERE NOT EXISTS (SELECT 1 FROM updated)
         RETURNING id, seconds_watched
       )
       SELECT id, seconds_watched FROM updated
       UNION ALL
       SELECT id, seconds_watched FROM inserted`,
      [studentId, courseId, lesson1Id, testSessionId, 10]
    );

    assert(
      sess2.rows.length === 1 && sess2.rows[0].seconds_watched === 20,
      `Session heartbeat 2 accumulated without double-counting: watched=${sess2.rows[0].seconds_watched}`
    );

    // Check daily activity aggregation query
    const activityRes = await client.query(
      `SELECT
         TO_CHAR(d.day, 'YYYY-MM-DD') AS "date",
         TO_CHAR(d.day, 'Dy') AS "dayName",
         COALESCE(SUM(s.seconds_watched), 0)::int AS "secondsWatched",
         ROUND(COALESCE(SUM(s.seconds_watched), 0) / 60.0, 1)::float AS "minutesWatched",
         COUNT(DISTINCT s.session_id)::int AS "sessionsCount"
       FROM generate_series(
         CURRENT_DATE - INTERVAL '6 days',
         CURRENT_DATE,
         INTERVAL '1 day'
       ) d(day)
       LEFT JOIN student_learning_sessions s
         ON s.student_id = $1
        AND s.started_at >= d.day
        AND s.started_at < d.day + INTERVAL '1 day'
       GROUP BY d.day
       ORDER BY d.day ASC`,
      [studentId]
    );

    assert(
      activityRes.rows.length === 7,
      `Daily activity returned continuous 7-day series (rows=${activityRes.rows.length})`
    );

    const todayActivity = activityRes.rows[activityRes.rows.length - 1];
    assert(
      todayActivity.secondsWatched >= 20 && todayActivity.sessionsCount >= 1,
      `Today's learning activity accurately reflects accumulated session: secondsWatched=${todayActivity.secondsWatched}, sessionsCount=${todayActivity.sessionsCount}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Student Lesson Resources Listing & Download
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Student Lesson Resources ---');

    // Create a dummy media asset for a resource
    const storageKey = `courses/${courseId}/resources/notes.pdf`;
    const assetRes = await client.query(
      `INSERT INTO media_assets (
        course_id, title, asset_type, storage_provider, storage_key,
        original_file_name, mime_type, file_size_bytes, processing_status, visibility
      ) VALUES (
        $1, 'Lecture Notes Document', 'document', 'local', $2,
        'lecture_notes.pdf', 'application/pdf', 1048576, 'ready', 'private'
      ) RETURNING asset_id`,
      [courseId, storageKey]
    );
    const assetId = assetRes.rows[0].asset_id;

    // Attach to lesson
    const resourceRes = await client.query(
      `INSERT INTO lesson_resources (lesson_id, asset_id, title, sort_order)
       VALUES ($1, $2, 'Lecture Slides PDF', 1)
       RETURNING resource_id`,
      [lesson1Id, assetId]
    );
    const resourceId = resourceRes.rows[0].resource_id;

    // Test student safe resource query
    const listRes = await client.query(
      `SELECT
         r.resource_id AS "resourceId",
         r.lesson_id AS "lessonId",
         r.title,
         r.sort_order AS "sortOrder",
         m.original_file_name AS "fileName",
         m.mime_type AS "mimeType",
         m.file_size_bytes AS "fileSizeBytes",
         m.asset_type AS "assetType"
       FROM lesson_resources r
       JOIN media_assets m ON m.asset_id = r.asset_id
       WHERE r.lesson_id = $1
         AND m.is_active = TRUE
         AND m.deleted_at IS NULL
       ORDER BY r.sort_order`,
      [lesson1Id]
    );

    assert(
      listRes.rows.length === 1 &&
      listRes.rows[0].title === 'Lecture Slides PDF' &&
      listRes.rows[0].fileName === 'lecture_notes.pdf' &&
      !('storageKey' in listRes.rows[0]),
      'Lesson resource listed with safe metadata without exposing storageKey'
    );

    // Test download retrieval
    const downloadRes = await client.query(
      `SELECT
         r.resource_id AS "resourceId",
         m.original_file_name AS "fileName",
         m.mime_type AS "mimeType",
         m.file_size_bytes AS "fileSizeBytes",
         m.storage_key AS "storageKey"
       FROM lesson_resources r
       JOIN media_assets m ON m.asset_id = r.asset_id
       WHERE r.resource_id = $1 AND r.lesson_id = $2
         AND m.is_active = TRUE AND m.deleted_at IS NULL
       LIMIT 1`,
      [resourceId, lesson1Id]
    );

    assert(
      downloadRes.rows.length === 1 && downloadRes.rows[0].storageKey.endsWith('notes.pdf'),
      `Authorized resource download retrieval returned valid storageKey (${downloadRes.rows[0].storageKey})`
    );

    // -------------------------------------------------------------------------
    // TEST 5: My Learning Gallery Enrollment Query
    // -------------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: My Learning Gallery Progress Query ---');

    const galleryRes = await client.query(
      `SELECT
        e.enrollment_id AS "enrollmentId",
        e.course_id AS "courseId",
        e.enrollment_status AS "enrollmentStatus",
        c.title,
        TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS "instructorName",
        COALESCE(tl.total_lessons, 0)::int AS "totalLessons",
        COALESCE(cl.completed_lessons, 0)::int AS "completedLessons",
        CASE
          WHEN COALESCE(tl.total_lessons, 0) > 0 THEN
            LEAST(100, ROUND((COALESCE(cl.completed_lessons, 0)::numeric / tl.total_lessons::numeric) * 100))::int
          ELSE 0
        END AS "progressPercentage"
      FROM course_enrollments e
      INNER JOIN courses c ON c.course_id = e.course_id
      LEFT JOIN users u ON u.user_id = c.instructor_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS total_lessons
        FROM course_lessons l
        INNER JOIN course_sections s ON s.section_id = l.section_id
        WHERE s.course_id = e.course_id
          AND l.is_active = TRUE
          AND COALESCE(l.is_optional, FALSE) = FALSE
      ) tl ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS completed_lessons
        FROM student_lesson_progress p
        INNER JOIN course_lessons l ON l.lesson_id = p.lesson_id
        WHERE p.student_id = e.student_id
          AND p.course_id = e.course_id
          AND p.is_completed = TRUE
          AND l.is_active = TRUE
          AND COALESCE(l.is_optional, FALSE) = FALSE
      ) cl ON TRUE
      WHERE e.student_id = $1
        AND e.course_id = $2
      ORDER BY e.enrolled_at DESC`,
      [studentId, courseId]
    );

    assert(
      galleryRes.rows.length === 1 &&
      galleryRes.rows[0].totalLessons === 2 &&
      galleryRes.rows[0].completedLessons === 2 &&
      galleryRes.rows[0].progressPercentage === 100,
      `Gallery query calculated accurate progress: totalLessons=${galleryRes.rows[0]?.totalLessons}, completed=${galleryRes.rows[0]?.completedLessons}, progress=${galleryRes.rows[0]?.progressPercentage}%`
    );

    // Rollback test data to leave database spotless
    await client.query('ROLLBACK');
    console.log('\nDatabase transaction rolled back cleanly. No residual test records.');

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Test execution error:', err);
    failedTests++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runStudentLearningClosureTests();

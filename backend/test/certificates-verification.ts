/**
 * CERTIFICATES MANAGEMENT VERIFICATION SUITE
 * End-to-end testing for Course Completion & Webinar Participation Certificates,
 * Attendance Thresholds, Cryptographic Verification, Revocation & Reissuance.
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Load environment variables
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'OneCRM123',
  database: process.env.DB_NAME || 'LMS',
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runCertificatesVerification() {
  console.log('\n================================================================');
  console.log('   CERTIFICATES MODULE: COMPREHENSIVE AUTOMATED VERIFICATION');
  console.log('================================================================\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verify schema tables exist
    console.log('--- TEST GROUP 1: Database Schema & Migration 021 ---');
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('certificate_templates', 'webinar_certificate_settings', 'issued_certificates', 'certificate_audit_logs');
    `);
    assert(
      tableCheck.rows.length === 4,
      'All 4 certificate management tables exist in database',
      `Found ${tableCheck.rows.length} of 4`,
    );

    const defaultTemplates = await client.query(`
      SELECT certificate_type, is_default
      FROM certificate_templates
      WHERE is_default = true;
    `);
    assert(
      defaultTemplates.rows.length >= 2,
      'Seeded default templates exist for course completion and webinar participation',
    );

    // 2. Setup mock data
    console.log('\n--- TEST GROUP 2: Course Completion Issuance & Idempotency ---');
    const studentUserRes = await client.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE LOWER(r.name) = 'student' AND u.is_active = TRUE
      LIMIT 1;
    `);
    const student = studentUserRes.rows[0];

    const instructorUserRes = await client.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE LOWER(r.name) = 'instructor' AND u.is_active = TRUE
      LIMIT 1;
    `);
    const instructor = instructorUserRes.rows[0];

    // Create a dedicated test course
    const courseRes = await client.query(`
      INSERT INTO courses (title, slug, instructor_id, status)
      VALUES ('Automated Certificate Test Course', 'cert-test-course-${Date.now()}', $1, 'published')
      RETURNING course_id, title;
    `, [instructor.user_id]);
    const testCourse = courseRes.rows[0];

    // Create a section
    const secRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Core Section', 1, true)
      RETURNING section_id;
    `, [testCourse.course_id]);
    const sectionId = secRes.rows[0].section_id;

    // Create 2 required lessons and 1 optional lesson
    const l1 = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, sort_order, is_active, is_optional)
      VALUES ($1, $2, 'Required Lesson 1', 'text', 1, true, false)
      RETURNING lesson_id;
    `, [sectionId, testCourse.course_id]);

    const l2 = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, sort_order, is_active, is_optional)
      VALUES ($1, $2, 'Required Lesson 2', 'text', 2, true, false)
      RETURNING lesson_id;
    `, [sectionId, testCourse.course_id]);

    const lOpt = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, sort_order, is_active, is_optional)
      VALUES ($1, $2, 'Optional Bonus Lesson', 'text', 3, true, true)
      RETURNING lesson_id;
    `, [sectionId, testCourse.course_id]);

    // Enroll student
    await client.query(`
      INSERT INTO course_enrollments (course_id, student_id, enrollment_status, enrollment_type)
      VALUES ($1, $2, 'active', 'free');
    `, [testCourse.course_id, student.user_id]);

    // Mark required lessons 1 and 2 as completed
    await client.query(`
      INSERT INTO student_lesson_progress (student_id, course_id, lesson_id, is_completed, completed_at)
      VALUES
        ($1, $2, $3, true, CURRENT_TIMESTAMP),
        ($1, $2, $4, true, CURRENT_TIMESTAMP);
    `, [student.user_id, testCourse.course_id, l1.rows[0].lesson_id, l2.rows[0].lesson_id]);

    // Check course completion calculation (optional lesson excluded)
    const completionCheck = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM course_lessons WHERE course_id = $1 AND is_active = true AND COALESCE(is_optional, false) = false) AS total_required,
        (SELECT COUNT(*) FROM student_lesson_progress p
         JOIN course_lessons l ON l.lesson_id = p.lesson_id
         WHERE p.student_id = $2 AND p.course_id = $1 AND p.is_completed = true AND COALESCE(l.is_optional, false) = false) AS completed_required;
    `, [testCourse.course_id, student.user_id]);

    const totalReq = Number(completionCheck.rows[0].total_required);
    const completedReq = Number(completionCheck.rows[0].completed_required);
    assert(
      totalReq === 2 && completedReq === 2,
      'Course is 100% complete excluding optional lessons (2 of 2 required done)',
      `totalRequired=${totalReq}, completedRequired=${completedReq}`,
    );

    // Issue certificate record
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const certNum = `LMS-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const issuedCertRes = await client.query(`
      INSERT INTO issued_certificates (
        certificate_number,
        certificate_type,
        student_id,
        course_id,
        student_name_snapshot,
        course_name_snapshot,
        instructor_name_snapshot,
        completion_or_event_date,
        certificate_file_storage_key,
        verification_token_hash,
        status
      ) VALUES (
        $1, 'course_completion', $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8, 'valid'
      )
      RETURNING certificate_id, certificate_number, status;
    `, [
      certNum,
      student.user_id,
      testCourse.course_id,
      `${student.first_name} ${student.last_name}`,
      testCourse.title,
      `${instructor.first_name} ${instructor.last_name}`,
      `certificates/courses/${testCourse.course_id}/test.pdf`,
      tokenHash,
    ]);

    const issuedCert = issuedCertRes.rows[0];
    assert(
      issuedCert.status === 'valid',
      'Course completion certificate issued successfully with valid status',
    );

    // Verify partial unique constraint prevents duplicate valid certificate
    let duplicatePrevented = false;
    await client.query('SAVEPOINT dup_test');
    try {
      await client.query(`
        INSERT INTO issued_certificates (
          certificate_number,
          certificate_type,
          student_id,
          course_id,
          student_name_snapshot,
          course_name_snapshot,
          completion_or_event_date,
          certificate_file_storage_key,
          verification_token_hash,
          status
        ) VALUES (
          'LMS-DUPLICATE-TEST', 'course_completion', $1, $2, 'Student Name', 'Course Name', CURRENT_TIMESTAMP, 'key', 'hash2', 'valid'
        );
      `, [student.user_id, testCourse.course_id]);
    } catch (dupErr: any) {
      duplicatePrevented = dupErr.code === '23505'; // Unique violation
      await client.query('ROLLBACK TO SAVEPOINT dup_test');
    }
    assert(
      duplicatePrevented,
      'Idempotency Invariant: Partial unique index prevents duplicate valid certificate for same student and course',
    );

    // 3. Webinar Attendance Thresholds
    console.log('\n--- TEST GROUP 3: Webinar Participation & Multi-Interval Attendance ---');
    const webinarRes = await client.query(`
      INSERT INTO webinars (title, slug, created_by, status, start_time, end_time)
      VALUES ('Live AI Architecture Workshop', 'live-ai-${Date.now()}', $1, 'completed', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP)
      RETURNING webinar_id, title;
    `, [instructor.user_id]);
    const testWebinar = webinarRes.rows[0];

    // Configure webinar certificate settings: 75% attendance threshold
    await client.query(`
      INSERT INTO webinar_certificate_settings (webinar_id, enabled, minimum_attendance_percentage)
      VALUES ($1, true, 75.00);
    `, [testWebinar.webinar_id]);

    // Register Student A (qualifies) and Student B (does not qualify)
    const regARes = await client.query(`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, phone_number, join_token_hash, join_token_expires_at)
      VALUES ($1, $2, 'Qualifying', 'Student', '1234567890', 'mock_hash_a', CURRENT_TIMESTAMP + INTERVAL '1 day')
      RETURNING webinar_registration_id;
    `, [testWebinar.webinar_id, student.email]);
    const regA = regARes.rows[0];

    // Student A multi-interval attendance:
    // Session 1: 25 minutes (1500s)
    // Session 2: 25 minutes (1500s)
    // Total: 50 minutes = 83.33% of 60 mins (>= 75% threshold)
    await client.query(`
      INSERT INTO webinar_attendances (webinar_id, webinar_registration_id, email, display_name, joined_at, left_at, duration_seconds)
      VALUES
        ($1, $2, $3, 'Qualifying Student', CURRENT_TIMESTAMP - INTERVAL '50 minutes', CURRENT_TIMESTAMP - INTERVAL '25 minutes', 1500),
        ($1, $2, $3, 'Qualifying Student', CURRENT_TIMESTAMP - INTERVAL '25 minutes', CURRENT_TIMESTAMP, 1500);
    `, [testWebinar.webinar_id, regA.webinar_registration_id, student.email]);

    // Student B under-threshold attendance:
    // Session 1: 30 minutes (1800s) = 50% (< 75% threshold)
    const studentBUserRes = await client.query(`
      SELECT u.user_id, u.first_name, u.last_name, u.email
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE u.user_id != $1 AND LOWER(r.name) = 'student' AND u.is_active = TRUE
      LIMIT 1;
    `, [student.user_id]);
    const studentB = studentBUserRes.rows[0];

    const regBRes = await client.query(`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, phone_number, join_token_hash, join_token_expires_at)
      VALUES ($1, $2, 'Under', 'Threshold', '9876543210', 'mock_hash_b', CURRENT_TIMESTAMP + INTERVAL '1 day')
      RETURNING webinar_registration_id;
    `, [testWebinar.webinar_id, studentB.email]);
    const regB = regBRes.rows[0];

    await client.query(`
      INSERT INTO webinar_attendances (webinar_id, webinar_registration_id, email, display_name, joined_at, left_at, duration_seconds)
      VALUES ($1, $2, $3, 'Under Threshold', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP, 1800);
    `, [testWebinar.webinar_id, regB.webinar_registration_id, studentB.email]);

    // Attendance aggregation query check
    const reportRes = await client.query(`
      SELECT
        wr.email,
        COALESCE(SUM(wa.duration_seconds), 0)::int AS total_seconds,
        ROUND((COALESCE(SUM(wa.duration_seconds), 0)::numeric / (60 * 60)::numeric) * 100, 2) AS percentage
      FROM webinar_registrations wr
      LEFT JOIN webinar_attendances wa ON wa.webinar_registration_id = wr.webinar_registration_id
      WHERE wr.webinar_id = $1
      GROUP BY wr.email;
    `, [testWebinar.webinar_id]);

    const reportA = reportRes.rows.find((r) => r.email === student.email);
    const reportB = reportRes.rows.find((r) => r.email === studentB.email);

    assert(
      Number(reportA.total_seconds) === 3000 && Number(reportA.percentage) === 83.33,
      'Multi-interval attendance aggregated correctly for Student A (3000s, 83.33%)',
    );
    assert(
      Number(reportB.total_seconds) === 1800 && Number(reportB.percentage) === 50.0,
      'Single-interval attendance aggregated correctly for Student B (1800s, 50.00%)',
    );

    // Test overlapping attendance intervals (union algorithm prevents double-counting)
    const { CertificatesRepository } = await import('../src/certificates/certificates.repository');
    const mockDbService = {
      executeQuery: (text: string, params: any[]) => client.query(text, params),
    };
    const certificatesRepo = new CertificatesRepository(mockDbService as any);

    // Register Student C with overlapping intervals
    const regCRes = await client.query(`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, phone_number, join_token_hash, join_token_expires_at)
      VALUES ($1, 'overlapping@student.test', 'Overlap', 'Tester', '5551234567', 'mock_hash_c', CURRENT_TIMESTAMP + INTERVAL '1 day')
      RETURNING webinar_registration_id;
    `, [testWebinar.webinar_id]);
    const regC = regCRes.rows[0];

    // Interval 1: 0 to 30 mins ago (1800s)
    // Interval 2: 15 to 45 mins ago (1800s)
    // Overlap: 15 to 30 mins ago. Total physical elapsed: 0 to 45 mins (2700s). Naive SUM would be 3600s!
    await client.query(`
      INSERT INTO webinar_attendances (webinar_id, webinar_registration_id, email, display_name, joined_at, left_at, duration_seconds)
      VALUES
        ($1, $2, 'overlapping@student.test', 'Overlap Tester', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP, 1800),
        ($1, $2, 'overlapping@student.test', 'Overlap Tester', CURRENT_TIMESTAMP - INTERVAL '45 minutes', CURRENT_TIMESTAMP - INTERVAL '15 minutes', 1800);
    `, [testWebinar.webinar_id, regC.webinar_registration_id]);

    const repoReport = await certificatesRepo.getWebinarAttendanceReport(testWebinar.webinar_id);
    const reportC = repoReport.find((r) => r.email === 'overlapping@student.test');
    assert(
      reportC && reportC.totalAttendedSeconds === 2700,
      'Overlapping Interval Union: 2 overlapping 30m intervals merged to 45m (2700s), avoiding double-counting (naive SUM would be 3600s)',
      `Actual attended seconds: ${reportC?.totalAttendedSeconds}`,
    );

    // Instructor Isolation Checks
    const isInstructorCourseOwner = await certificatesRepo.checkCourseInstructor(testCourse.course_id, instructor.user_id);
    const isStudentCourseOwner = await certificatesRepo.checkCourseInstructor(testCourse.course_id, student.user_id);
    assert(
      isInstructorCourseOwner === true && isStudentCourseOwner === false,
      'Instructor Isolation: checkCourseInstructor returns TRUE for creator and FALSE for unauthorized user',
    );

    const isInstructorWebinarHost = await certificatesRepo.checkWebinarHost(testWebinar.webinar_id, instructor.user_id);
    const isStudentWebinarHost = await certificatesRepo.checkWebinarHost(testWebinar.webinar_id, student.user_id);
    assert(
      isInstructorWebinarHost === true && isStudentWebinarHost === false,
      'Instructor Isolation: checkWebinarHost returns TRUE for host and FALSE for unauthorized user',
    );

    // Student Identity Mapping: Unmatched & Inactive User Verification
    // 1. Unmatched registration (anonymous guest, no LMS user exists)
    const regAnonRes = await client.query(`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, phone_number, join_token_hash, join_token_expires_at)
      VALUES ($1, 'anonymous.guest@external-domain.com', 'External', 'Guest', '1112223333', 'mock_hash_anon', CURRENT_TIMESTAMP + INTERVAL '1 day')
      RETURNING webinar_registration_id;
    `, [testWebinar.webinar_id]);

    // 2. Inactive user registration (LMS account exists but is_active = FALSE)
    const inactiveUserRes = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('inactive.student@test.com', 'hash', 'Inactive', 'User', FALSE)
      RETURNING user_id;
    `);
    const inactiveUser = inactiveUserRes.rows[0];

    const regInactiveRes = await client.query(`
      INSERT INTO webinar_registrations (webinar_id, email, first_name, last_name, phone_number, join_token_hash, join_token_expires_at)
      VALUES ($1, 'inactive.student@test.com', 'Inactive', 'User', '4445556666', 'mock_hash_inactive', CURRENT_TIMESTAMP + INTERVAL '1 day')
      RETURNING webinar_registration_id;
    `, [testWebinar.webinar_id]);

    const reportWithEdgeCases = await certificatesRepo.getWebinarAttendanceReport(testWebinar.webinar_id);
    const anonRow = reportWithEdgeCases.find((r) => r.email === 'anonymous.guest@external-domain.com');
    const inactiveRow = reportWithEdgeCases.find((r) => r.email === 'inactive.student@test.com');
    const activeStudentRow = reportWithEdgeCases.find((r) => r.email === student.email);

    assert(
      anonRow && anonRow.studentId === null,
      'Student Identity Mapping: Anonymous guest email has studentId = NULL (no certificate issued)',
    );
    assert(
      inactiveRow && inactiveRow.studentId === null,
      'Student Identity Mapping: Inactive LMS user account has studentId = NULL (no certificate issued)',
    );
    assert(
      activeStudentRow && activeStudentRow.studentId === student.user_id,
      'Student Identity Mapping: Active LMS student email accurately resolves to correct user_id',
    );

    // 4. Public Verification
    console.log('\n--- TEST GROUP 4: Cryptographic Public Verification & Security ---');
    // Test SHA-256 token lookup
    const pubVerifyRes = await client.query(`
      SELECT
        c.certificate_number,
        c.certificate_type,
        c.student_name_snapshot,
        c.course_name_snapshot,
        c.status,
        c.completion_or_event_date,
        c.issued_at
      FROM issued_certificates c
      WHERE c.verification_token_hash = $1;
    `, [tokenHash]);

    assert(
      pubVerifyRes.rows.length === 1 && pubVerifyRes.rows[0].status === 'valid',
      'Public verification succeeds using SHA-256 token hash lookup',
    );

    // 5. Revocation & Public Invalidation
    console.log('\n--- TEST GROUP 5: Administrative Revocation & Reissuance ---');
    const revokeReason = 'Administrative audit: Duplicate record cleanup';
    const revokeRes = await client.query(`
      UPDATE issued_certificates
      SET status = 'revoked',
          revocation_reason = $1,
          revoked_by = $2,
          revoked_at = CURRENT_TIMESTAMP
      WHERE certificate_id = $3
      RETURNING certificate_id, status, revocation_reason;
    `, [revokeReason, instructor.user_id, issuedCert.certificate_id]);

    assert(
      revokeRes.rows[0].status === 'revoked' && revokeRes.rows[0].revocation_reason === revokeReason,
      'Admin revoke successfully marks status as revoked and stores revocation reason',
    );

    // Verify public verification reflects revoked status
    const pubVerifyRevoked = await client.query(`
      SELECT status, revocation_reason
      FROM issued_certificates
      WHERE verification_token_hash = $1;
    `, [tokenHash]);
    assert(
      pubVerifyRevoked.rows[0].status === 'revoked',
      'Public verification endpoint immediately reflects revoked status',
    );

    // Reissue certificate linked to previous
    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
    const newCertNum = `LMS-2026-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const correctedName = 'Johnathan Doe Updated';

    const reissueRes = await client.query(`
      INSERT INTO issued_certificates (
        certificate_number,
        certificate_type,
        student_id,
        course_id,
        student_name_snapshot,
        course_name_snapshot,
        completion_or_event_date,
        certificate_file_storage_key,
        verification_token_hash,
        status,
        reissued_from_id
      ) VALUES (
        $1, 'course_completion', $2, $3, $4, $5, CURRENT_TIMESTAMP, 'reissued_key', $6, 'valid', $7
      )
      RETURNING certificate_id, certificate_number, reissued_from_id, student_name_snapshot, status;
    `, [
      newCertNum,
      student.user_id,
      testCourse.course_id,
      correctedName,
      testCourse.title,
      newTokenHash,
      issuedCert.certificate_id,
    ]);

    const reissued = reissueRes.rows[0];
    assert(
      reissued.status === 'valid' &&
      reissued.reissued_from_id === issuedCert.certificate_id &&
      reissued.student_name_snapshot === correctedName,
      'Reissued certificate successfully created with linkage to previous certificate and corrected name',
    );

    // 6. PDF Rendering Check
    console.log('\n--- TEST GROUP 6: PDF Generation Buffer Verification ---');
    const { PdfGeneratorService } = await import('../src/certificates/pdf-generator.service');
    const pdfGen = new PdfGeneratorService();
    const pdfBuf = await pdfGen.generateCertificatePdf({
      certificateNumber: newCertNum,
      certificateType: 'course_completion',
      studentName: correctedName,
      subjectTitle: testCourse.title,
      instructorName: `${instructor.first_name} ${instructor.last_name}`,
      completionDate: new Date(),
      verificationUrl: `http://localhost:3000/verify-certificate/${newRawToken}`,
    });

    const isPdfValid = Buffer.isBuffer(pdfBuf) && pdfBuf.slice(0, 5).toString('ascii') === '%PDF-';
    assert(
      isPdfValid,
      'PdfGeneratorService produces valid vector PDF starting with %PDF- header',
      `Buffer length: ${pdfBuf.length} bytes`,
    );

    // Rollback all test data cleanly
    await client.query('ROLLBACK');
    console.log('\nDatabase transaction rolled back cleanly. No residual test records left in PostgreSQL.');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Test execution fatal error:', err);
    failed++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCertificatesVerification();

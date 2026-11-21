import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';
import { StudentLearningRepository } from '../src/student-learning/student-learning.repository';
import { StudentLearningService } from '../src/student-learning/student-learning.service';

async function runE2ECourseCertificatesTest() {
  console.log('================================================================');
  console.log('  E2E COURSE COMPLETION & AUTOMATIC CERTIFICATE GENERATION TEST');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:OneCRM123@localhost:5432/LMS',
  });

  const client = await pool.connect();

  const mockDbService = {
    query: async <T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> => {
      const res = await client.query(query, params);
      return { rows: res.rows };
    },
    executeQuery: async <T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> => {
      const res = await client.query(query, params);
      return { rows: res.rows };
    },
  } as any;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'APP_URL') return 'http://localhost:3000';
      if (key === 'storage.localRoot') return path.resolve('private-storage');
      return null;
    },
  } as any;

  const localStorageProvider = new LocalStorageProvider(mockConfigService);
  const storageService = new StorageService(localStorageProvider);
  const pdfGeneratorService = new PdfGeneratorService();
  const certificatesRepo = new CertificatesRepository(mockDbService);
  const certificatesService = new CertificatesService(
    certificatesRepo,
    pdfGeneratorService,
    storageService,
    mockConfigService,
  );

  const studentLearningRepo = new StudentLearningRepository(mockDbService);
  const mockEnrollmentsService = {
    getEnrollmentStatus: async (courseId: string, user: any) => ({
      isEnrolled: true,
      enrollmentStatus: 'active',
    }),
  } as any;

  const mockVideoProcessor = {
    generateHls: async () => {},
  } as any;

  const studentLearningService = new StudentLearningService(
    studentLearningRepo,
    mockEnrollmentsService,
    storageService,
    mockVideoProcessor,
    mockConfigService,
    certificatesService,
  );

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    await client.query('BEGIN');

    const studentRoleIdRes = await client.query(`SELECT role_id FROM roles WHERE LOWER(name) = 'student' LIMIT 1;`);
    const studentRoleId = studentRoleIdRes.rows[0]?.role_id;
    const instructorRoleIdRes = await client.query(`SELECT role_id FROM roles WHERE LOWER(name) = 'instructor' LIMIT 1;`);
    const instructorRoleId = instructorRoleIdRes.rows[0]?.role_id;

    // Setup Test Instructor
    const instructorRes = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('instructor_cert_test@example.com', 'hash', 'Prof', 'Turing', true)
      RETURNING user_id;
    `);
    const instructorId = instructorRes.rows[0].user_id;
    if (instructorRoleId) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`, [instructorId, instructorRoleId]);
    }

    // Setup Test Students
    const student1Res = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('student1_cert_test@example.com', 'hash', 'Ada', 'Lovelace', true)
      RETURNING user_id;
    `);
    const student1Id = student1Res.rows[0].user_id;
    if (studentRoleId) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`, [student1Id, studentRoleId]);
    }

    const student2Res = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('student2_cert_test@example.com', 'hash', 'Grace', 'Hopper', true)
      RETURNING user_id;
    `);
    const student2Id = student2Res.rows[0].user_id;
    if (studentRoleId) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`, [student2Id, studentRoleId]);
    }

    const student3Res = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('student3_cert_test@example.com', 'hash', 'Katherine', 'Johnson', true)
      RETURNING user_id;
    `);
    const student3Id = student3Res.rows[0].user_id;
    if (studentRoleId) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`, [student3Id, studentRoleId]);
    }

    console.log('--- TEST SCENARIO 1: Free Course with Optional Lessons ---');
    // Create Free Course with 2 required lessons + 1 optional lesson
    const freeCourseRes = await client.query(`
      INSERT INTO courses (title, slug, instructor_id, is_free, price, status)
      VALUES ('Full Stack Development Free', 'full-stack-dev-free-${Date.now()}', $1, true, 0, 'published')
      RETURNING course_id;
    `, [instructorId]);
    const freeCourseId = freeCourseRes.rows[0].course_id;

    const sectionRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Core Curriculum', 1, true)
      RETURNING section_id;
    `, [freeCourseId]);
    const sectionId = sectionRes.rows[0].section_id;

    const l1Res = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Required Lesson 1', 'video', 300, false, true)
      RETURNING lesson_id;
    `, [sectionId, freeCourseId]);
    const l1Id = l1Res.rows[0].lesson_id;

    const l2Res = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Optional Bonus Lesson', 'video', 200, true, true)
      RETURNING lesson_id;
    `, [sectionId, freeCourseId]);
    const l2Id = l2Res.rows[0].lesson_id;

    const l3Res = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Required Final Lesson', 'video', 400, false, true)
      RETURNING lesson_id;
    `, [sectionId, freeCourseId]);
    const l3Id = l3Res.rows[0].lesson_id;

    // Enroll Student 1 in Free Course
    await client.query(`
      INSERT INTO course_enrollments (student_id, course_id, enrollment_status)
      VALUES ($1, $2, 'active');
    `, [student1Id, freeCourseId]);

    // Student 1 completes Lesson 1 (Required)
    const authStudent1 = { userId: student1Id, email: 'student1_cert_test@example.com', roles: ['student'], permissions: [] } as any;
    await studentLearningService.completeLesson(l1Id, authStudent1);

    let cert1Check = await certificatesRepo.findValidCertificateByCourse(student1Id, freeCourseId);
    assert(cert1Check === null, 'Lesson 1 complete (50% required): No certificate issued prematurely');

    // Student 1 completes Lesson 2 (Optional)
    await studentLearningService.completeLesson(l2Id, authStudent1);
    cert1Check = await certificatesRepo.findValidCertificateByCourse(student1Id, freeCourseId);
    assert(cert1Check === null, 'Optional Lesson complete: Still 50% of required, no certificate issued');

    // Student 1 completes Lesson 3 (Final Required)
    const comp3Result = await studentLearningService.completeLesson(l3Id, authStudent1);
    assert(comp3Result.courseCompletion.isCourseCompleted === true, 'All required lessons complete: Course isCourseCompleted = true');

    // Verify certificate was automatically generated!
    cert1Check = await certificatesRepo.findValidCertificateByCourse(student1Id, freeCourseId);
    assert(cert1Check !== null, 'Automatic issuance: Valid certificate record created in PostgreSQL');
    assert(cert1Check?.certificate_type === 'course_completion', 'Certificate type is "course_completion"');
    assert(cert1Check?.student_name_snapshot === 'Ada Lovelace', 'Student snapshot name correctly preserved as "Ada Lovelace"');
    assert(cert1Check?.course_name_snapshot === 'Full Stack Development Free', 'Course snapshot title preserved correctly');
    assert(cert1Check?.instructor_name_snapshot === 'Prof Turing', 'Instructor snapshot name preserved correctly');
    assert(cert1Check?.status === 'valid', 'Certificate status is "valid"');

    // Verify PDF can be streamed/downloaded
    const downloadRes = await certificatesService.getCertificateFileStream(cert1Check!.certificate_id, authStudent1);
    assert(downloadRes.stream !== null && typeof downloadRes.stream.pipe === 'function', 'Certificate PDF file stream generated and accessible');
    assert(downloadRes.filename === `${cert1Check!.certificate_number}.pdf`, 'Certificate filename matches certificate number');

    console.log('\n--- TEST SCENARIO 2: Paid Course with Video 90% Threshold Completion ---');
    // Create Paid Course
    const paidCourseRes = await client.query(`
      INSERT INTO courses (title, slug, instructor_id, is_free, price, status)
      VALUES ('Advanced AI Systems Paid', 'advanced-ai-paid-${Date.now()}', $1, false, 9999, 'published')
      RETURNING course_id;
    `, [instructorId]);
    const paidCourseId = paidCourseRes.rows[0].course_id;

    const paidSectionRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Module 1', 1, true)
      RETURNING section_id;
    `, [paidCourseId]);
    const paidSectionId = paidSectionRes.rows[0].section_id;

    const paidLessonRes = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'AI Architecture Overview', 'video', 1000, false, true)
      RETURNING lesson_id;
    `, [paidSectionId, paidCourseId]);
    const paidLessonId = paidLessonRes.rows[0].lesson_id;

    // Enroll Student 2 in Paid Course
    await client.query(`
      INSERT INTO course_enrollments (student_id, course_id, enrollment_status)
      VALUES ($1, $2, 'active');
    `, [student2Id, paidCourseId]);

    const authStudent2 = { userId: student2Id, email: 'student2_cert_test@example.com', roles: ['student'], permissions: [] } as any;

    // Student 2 has watched up to 895 seconds previously
    await client.query(`
      INSERT INTO student_lesson_progress (student_id, course_id, lesson_id, last_position_seconds, max_watched_seconds, is_completed, updated_at)
      VALUES ($1, $2, $3, 895, 895, false, CURRENT_TIMESTAMP - INTERVAL '10 seconds');
    `, [student2Id, paidCourseId, paidLessonId]);

    let cert2Check = await certificatesRepo.findValidCertificateByCourse(student2Id, paidCourseId);
    assert(cert2Check === null, 'Watched 895s (< 900s / 90% threshold): Course not complete, no certificate issued');

    // Advance by 10s to 905s (905s / 1000s = 90.5% >= 90% threshold, elapsed wall time 10s allows 30s advance)
    const progress91 = await studentLearningService.saveLessonProgress(paidLessonId, authStudent2, 905);
    assert(progress91.progress.isCompleted === true, 'Watched 90.5% (>= 90% threshold): Lesson marked completed');
    assert(progress91.courseCompletion.isCourseCompleted === true, 'Course completion = 100%');

    // Check certificate issued automatically for Paid Course
    cert2Check = await certificatesRepo.findValidCertificateByCourse(student2Id, paidCourseId);
    assert(cert2Check !== null, 'Automatic issuance for paid course: Valid certificate record created in PostgreSQL');
    assert(cert2Check?.student_name_snapshot === 'Grace Hopper', 'Student snapshot name correctly preserved as "Grace Hopper"');
    assert(cert2Check?.course_name_snapshot === 'Advanced AI Systems Paid', 'Course snapshot title preserved correctly');

    console.log('\n--- TEST SCENARIO 3: Idempotency & Duplicate Prevention ---');
    // Call completeLesson again on already completed course
    await studentLearningService.completeLesson(paidLessonId, authStudent2);
    // Explicitly invoke issueCourseCompletionCertificate directly
    const reIssueResult = await certificatesService.issueCourseCompletionCertificate(student2Id, paidCourseId);
    assert(reIssueResult.isNew === false, 'Re-triggering issuance returns existing certificate with isNew = false');
    assert(reIssueResult.certificate.certificate_id === cert2Check!.certificate_id, 'Same certificate ID returned');

    const totalCertsForStudent2 = await client.query(`
      SELECT COUNT(*) as count FROM issued_certificates
      WHERE student_id = $1 AND course_id = $2 AND status = 'valid';
    `, [student2Id, paidCourseId]);
    assert(Number(totalCertsForStudent2.rows[0].count) === 1, 'Idempotency verified: Exactly 1 certificate exists in DB');

    console.log('\n--- TEST SCENARIO 4: Incomplete Course Eligibility Validation ---');
    // Student 3 in a 2-lesson course, only completes 1 lesson
    const multiCourseRes = await client.query(`
      INSERT INTO courses (title, slug, instructor_id, is_free, price, status)
      VALUES ('Quantum Computing Intro', 'quantum-intro-${Date.now()}', $1, true, 0, 'published')
      RETURNING course_id;
    `, [instructorId]);
    const multiCourseId = multiCourseRes.rows[0].course_id;

    const multiSecRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Part 1', 1, true)
      RETURNING section_id;
    `, [multiCourseId]);
    const multiSecId = multiSecRes.rows[0].section_id;

    const ml1 = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Quantum Lesson 1', 'video', 500, false, true)
      RETURNING lesson_id;
    `, [multiSecId, multiCourseId]);

    await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Quantum Lesson 2', 'video', 500, false, true);
    `, [multiSecId, multiCourseId]);

    await client.query(`
      INSERT INTO course_enrollments (student_id, course_id, enrollment_status)
      VALUES ($1, $2, 'active');
    `, [student3Id, multiCourseId]);

    const authStudent3 = { userId: student3Id, email: 'student3_cert_test@example.com', roles: ['student'], permissions: [] } as any;
    await studentLearningService.completeLesson(ml1.rows[0].lesson_id, authStudent3);

    let threwExpected = false;
    try {
      await certificatesService.issueCourseCompletionCertificate(student3Id, multiCourseId);
    } catch (err: any) {
      threwExpected = true;
      assert(err.message.includes('Course curriculum is not 100% completed'), 'Rejects issuance for incomplete course with 400 BadRequestException');
    }
    assert(threwExpected, 'Incomplete course issuance strictly rejected');

    console.log('\n--- TEST SCENARIO 5: Automatic Reconciliation on My Certificates ---');
    // Simulate a student who had enrollment completed previously (e.g. historical data or missing cert)
    // Mark student 3 completed in course_enrollments
    await client.query(`
      UPDATE course_enrollments SET enrollment_status = 'completed'
      WHERE student_id = $1 AND course_id = $2;
    `, [student3Id, multiCourseId]);

    // Student 3 views "My Certificates"
    const myCertificatesBefore = await client.query(`
      SELECT * FROM issued_certificates WHERE student_id = $1;
    `, [student3Id]);
    assert(myCertificatesBefore.rows.length === 0, 'Before viewing My Certificates: student 3 has 0 certificates');

    // Calling listStudentCertificates triggers auto-reconciliation
    const student3CertList = await certificatesService.listStudentCertificates(student3Id, {});
    assert(student3CertList.data.length === 1, 'My Certificates auto-reconciliation: 1 certificate issued and returned');
    assert(student3CertList.data[0].studentNameSnapshot === 'Katherine Johnson', 'Certificate accurately linked to Katherine Johnson');
    assert(student3CertList.data[0].subjectTitle === 'Quantum Computing Intro', 'Certificate accurately linked to Quantum Computing Intro');

    console.log('\n--- TEST SCENARIO 6: Public Verification Endpoint ---');
    const pubVerifyResult = await certificatesService.verifyPublicCertificate(cert1Check!.certificate_number);
    assert(pubVerifyResult.valid === true, 'Public verification by certificate number returns valid: true');
    assert(pubVerifyResult.status === 'valid', 'Public verification status: "valid"');
    assert(pubVerifyResult.studentName === 'Ada Lovelace', 'Public verification snapshot studentName: "Ada Lovelace"');
    assert(pubVerifyResult.subjectTitle === 'Full Stack Development Free', 'Public verification snapshot subjectTitle: "Full Stack Development Free"');

  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    console.log('\nDatabase transaction rolled back cleanly. No residual test records left in PostgreSQL.');
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ECourseCertificatesTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

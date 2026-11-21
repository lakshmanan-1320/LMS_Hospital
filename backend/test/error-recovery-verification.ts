import { Pool } from 'pg';
import * as path from 'path';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';

async function runErrorRecoveryVerification() {
  console.log('================================================================');
  console.log('  CONTROLLED TEST: PDF STORAGE FAILURE & ON-DEMAND RECOVERY');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:OneCRM123@localhost:5432/LMS',
  });

  const client = await pool.connect();

  const dbService = {
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

  const realLocalStorageProvider = new LocalStorageProvider(mockConfigService);
  const realStorageService = new StorageService(realLocalStorageProvider);
  const pdfGeneratorService = new PdfGeneratorService();
  const certificatesRepo = new CertificatesRepository(dbService);

  // Fault-injected storage provider
  let simulateFailure = true;
  const faultInjectingStorageProvider = {
    name: 'local' as const,
    save: async (sourcePath: string, storageKey: string, contentType: string) => {
      if (simulateFailure) {
        throw new Error('SIMULATED_DISK_IO_FAILURE: Out of space or write permission error');
      }
      return realStorageService.save(sourcePath, storageKey, contentType);
    },
    exists: async (storageKey: string) => {
      if (simulateFailure) return false;
      return realStorageService.exists(storageKey);
    },
    getReadStream: async (storageKey: string, range?: any) => {
      return realStorageService.getReadStream(storageKey, range);
    },
    delete: async (storageKey: string) => {
      return realStorageService.delete(storageKey);
    },
  };

  const controlledStorageService = new StorageService(faultInjectingStorageProvider as any);
  const testCertificatesService = new CertificatesService(
    certificatesRepo,
    pdfGeneratorService,
    controlledStorageService,
    mockConfigService,
  );

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    await client.query('BEGIN');

    // Setup Test Instructor, Student, Course, Section, Lesson
    const instructorRes = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('fault_inst@example.com', 'hash', 'Fault', 'Instructor', true)
      RETURNING user_id;
    `);
    const instructorId = instructorRes.rows[0].user_id;

    const studentRes = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, is_active)
      VALUES ('fault_student@example.com', 'hash', 'Fault', 'Student', true)
      RETURNING user_id;
    `);
    const studentId = studentRes.rows[0].user_id;

    const courseRes = await client.query(`
      INSERT INTO courses (title, slug, instructor_id, is_free, price, status)
      VALUES ('Resilience 101', 'resilience-101-${Date.now()}', $1, true, 0, 'published')
      RETURNING course_id;
    `, [instructorId]);
    const courseId = courseRes.rows[0].course_id;

    const sectionRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Section 1', 1, true)
      RETURNING section_id;
    `, [courseId]);
    const sectionId = sectionRes.rows[0].section_id;

    const lessonRes = await client.query(`
      INSERT INTO course_lessons (section_id, course_id, title, lesson_type, duration_seconds, is_optional, is_active)
      VALUES ($1, $2, 'Lesson 1', 'video', 100, false, true)
      RETURNING lesson_id;
    `, [sectionId, courseId]);
    const lessonId = lessonRes.rows[0].lesson_id;

    // Enroll and complete
    await client.query(`
      INSERT INTO course_enrollments (student_id, course_id, enrollment_status)
      VALUES ($1, $2, 'completed');
    `, [studentId, courseId]);

    await client.query(`
      INSERT INTO student_lesson_progress (student_id, course_id, lesson_id, is_completed, last_position_seconds, max_watched_seconds)
      VALUES ($1, $2, $3, true, 100, 100);
    `, [studentId, courseId, lessonId]);

    console.log('--- Step 1: Issue certificate during simulated storage failure ---');
    simulateFailure = true;

    // Issue certificate while storage save fails
    const issueResult = await testCertificatesService.issueCourseCompletionCertificate(studentId, courseId);

    assert(issueResult.certificate !== null, 'issueCourseCompletionCertificate returns certificate object despite storage failure');
    assert(issueResult.certificate.status === 'valid', 'Certificate record in DB is valid');

    // Confirm DB record exists
    const dbCheck = await client.query(
      `SELECT * FROM issued_certificates WHERE certificate_id = $1`,
      [issueResult.certificate.certificate_id]
    );
    assert(dbCheck.rows.length === 1, 'Database certificate record is safely retained in PostgreSQL');
    assert(dbCheck.rows[0].certificate_number === issueResult.certificate.certificate_number, 'Certificate number matches');

    console.log('\n--- Step 2: Restore normal storage and verify on-demand PDF generation on download ---');
    simulateFailure = false;

    const authStudent = { userId: studentId, email: 'fault_student@example.com', roles: ['student'], permissions: [] } as any;
    const downloadRes = await testCertificatesService.getCertificateFileStream(issueResult.certificate.certificate_id, authStudent);

    assert(downloadRes.stream !== null, 'Download stream acquired');
    assert(downloadRes.filename === `${issueResult.certificate.certificate_number}.pdf`, 'Filename matches certificate number');

    const chunks: Buffer[] = [];
    for await (const chunk of downloadRes.stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const pdfBuf = Buffer.concat(chunks);
    assert(pdfBuf.slice(0, 5).toString('ascii') === '%PDF-', 'Self-healing regeneration produced a valid PDF document');

    console.log('\n--- Step 3: Verify duplicate prevention on subsequent calls ---');
    const reIssue = await testCertificatesService.issueCourseCompletionCertificate(studentId, courseId);
    assert(reIssue.isNew === false, 'Subsequent issuance returns isNew = false');
    assert(reIssue.certificate.certificate_id === issueResult.certificate.certificate_id, 'Existing certificate ID returned');

    const countCheck = await client.query(
      `SELECT COUNT(*) as count FROM issued_certificates WHERE student_id = $1 AND course_id = $2`,
      [studentId, courseId]
    );
    assert(Number(countCheck.rows[0].count) === 1, 'Total certificate count in DB is strictly 1 (no duplicates)');

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

runErrorRecoveryVerification().catch(err => {
  console.error('Error recovery test failed:', err);
  process.exit(1);
});

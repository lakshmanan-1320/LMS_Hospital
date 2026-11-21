import { Pool } from 'pg';
import * as path from 'path';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';

async function runReconciliationVerification() {
  console.log('================================================================');
  console.log('  LIVE DATABASE: COMPLETED ENROLLMENTS RECONCILIATION VERIFICATION');
  console.log('================================================================\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:OneCRM123@localhost:5432/LMS',
  });

  const dbService = {
    executeQuery: async <T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> => {
      const res = await pool.query(query, params);
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
  const certificatesRepo = new CertificatesRepository(dbService);
  const certificatesService = new CertificatesService(
    certificatesRepo,
    pdfGeneratorService,
    storageService,
    mockConfigService,
  );

  // 1. Inspect existing database state before reconciliation
  const completedEnrollmentsRes = await pool.query(`
    SELECT e.enrollment_id, e.student_id, e.course_id, e.enrollment_status, e.completed_at,
           u.email as student_email, u.first_name, u.last_name,
           c.title as course_title
    FROM course_enrollments e
    JOIN users u ON u.user_id = e.student_id
    JOIN courses c ON c.course_id = e.course_id
    WHERE e.enrollment_status = 'completed';
  `);

  const activeIncompleteEnrollmentsRes = await pool.query(`
    SELECT e.enrollment_id, e.student_id, e.course_id, e.enrollment_status,
           u.email as student_email, c.title as course_title
    FROM course_enrollments e
    JOIN users u ON u.user_id = e.student_id
    JOIN courses c ON c.course_id = e.course_id
    WHERE e.enrollment_status = 'active';
  `);

  const totalValidCertificatesBeforeRes = await pool.query(`
    SELECT COUNT(*) as count FROM issued_certificates WHERE status = 'valid';
  `);
  const certsBeforeCount = Number(totalValidCertificatesBeforeRes.rows[0].count);

  console.log(`[BEFORE] Total valid certificates in DB: ${certsBeforeCount}`);
  console.log(`[BEFORE] Completed enrollments found: ${completedEnrollmentsRes.rows.length}`);
  completedEnrollmentsRes.rows.forEach((r, idx) => {
    console.log(`  ${idx + 1}. Student: ${r.student_email} (${r.first_name} ${r.last_name}) | Course: "${r.course_title}" | Completed At: ${r.completed_at}`);
  });
  console.log(`[BEFORE] Active incomplete enrollments found: ${activeIncompleteEnrollmentsRes.rows.length}`);

  // Find distinct completed students
  const distinctCompletedStudentIds = [...new Set(completedEnrollmentsRes.rows.map(r => r.student_id))];

  console.log(`\n--- Running Reconciliation via CertificatesService for ${distinctCompletedStudentIds.length} distinct completed student(s) ---`);
  for (const studentId of distinctCompletedStudentIds) {
    await certificatesService.reconcileCompletedCourseCertificates(studentId);
  }

  // 2. Inspect database state after reconciliation
  const totalValidCertificatesAfterRes = await pool.query(`
    SELECT COUNT(*) as count FROM issued_certificates WHERE status = 'valid';
  `);
  const certsAfterCount = Number(totalValidCertificatesAfterRes.rows[0].count);

  const issuedCertsDetails = await pool.query(`
    SELECT c.certificate_id, c.certificate_number, c.certificate_type, c.status,
           c.student_name_snapshot, c.course_name_snapshot, c.student_id, c.course_id,
           u.email as student_email
    FROM issued_certificates c
    JOIN users u ON u.user_id = c.student_id
    WHERE c.status = 'valid'
    ORDER BY c.issued_at ASC;
  `);

  console.log(`\n[AFTER] Total valid certificates in DB: ${certsAfterCount}`);
  console.log(`[AFTER] Certificates currently issued:`);
  issuedCertsDetails.rows.forEach((c, idx) => {
    console.log(`  ${idx + 1}. Number: ${c.certificate_number} | Student: ${c.student_name_snapshot} (${c.student_email}) | Course: "${c.course_name_snapshot}"`);
  });

  // 3. Verification assertions
  console.log('\n--- VERIFICATION CHECKS ---');
  let allChecksPassed = true;

  // Check: Exactly one certificate per completed enrollment
  for (const enr of completedEnrollmentsRes.rows) {
    const certsForEnr = issuedCertsDetails.rows.filter(
      c => c.student_id === enr.student_id && c.course_id === enr.course_id
    );
    if (certsForEnr.length === 1) {
      console.log(`  [PASS] Student ${enr.student_email} has exactly 1 valid certificate for "${enr.course_title}" (${certsForEnr[0].certificate_number})`);
    } else {
      console.error(`  [FAIL] Expected 1 certificate for ${enr.student_email} in "${enr.course_title}", found ${certsForEnr.length}`);
      allChecksPassed = false;
    }
  }

  // Check: No incomplete enrollment received a certificate
  for (const inc of activeIncompleteEnrollmentsRes.rows) {
    const certsForInc = issuedCertsDetails.rows.filter(
      c => c.student_id === inc.student_id && c.course_id === inc.course_id
    );
    if (certsForInc.length === 0) {
      console.log(`  [PASS] Incomplete student ${inc.student_email} for "${inc.course_title}" received NO certificate`);
    } else {
      console.error(`  [FAIL] Incomplete enrollment for ${inc.student_email} in "${inc.course_title}" incorrectly received a certificate!`);
      allChecksPassed = false;
    }
  }

  // Check: Idempotency of re-reconciling
  console.log('\n--- Checking Idempotent Re-reconciliation ---');
  for (const studentId of distinctCompletedStudentIds) {
    await certificatesService.reconcileCompletedCourseCertificates(studentId);
  }
  const certsAfterReReconcileRes = await pool.query(`SELECT COUNT(*) as count FROM issued_certificates WHERE status = 'valid';`);
  const certsAfterReReconcile = Number(certsAfterReReconcileRes.rows[0].count);
  if (certsAfterReReconcile === certsAfterCount) {
    console.log(`  [PASS] Idempotency verified: Total certificates remain ${certsAfterCount} (no duplicates created)`);
  } else {
    console.error(`  [FAIL] Duplicate certificate created on second reconciliation! Count changed from ${certsAfterCount} to ${certsAfterReReconcile}`);
    allChecksPassed = false;
  }

  await pool.end();

  if (!allChecksPassed) {
    process.exit(1);
  }
  console.log('\nReconciliation verification completed successfully.');
}

runReconciliationVerification().catch(err => {
  console.error('Reconciliation verification failed:', err);
  process.exit(1);
});

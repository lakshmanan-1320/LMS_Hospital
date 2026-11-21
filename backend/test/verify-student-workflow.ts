import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';

async function verifyStudentWorkflow() {
  console.log('================================================================');
  console.log('  REAL STUDENT WORKFLOW VERIFICATION: MY CERTIFICATES & PDF DOWNLOAD');
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

  const students = [
    { email: 'lav@gmail.com' },
    { email: 'ash@example.com' },
  ];

  for (const st of students) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`Verifying workflow for student: ${st.email}`);
    console.log(`--------------------------------------------------------------`);

    const userRes = await pool.query(
      `SELECT user_id, email, first_name, last_name FROM users WHERE email = $1`,
      [st.email]
    );
    if (userRes.rows.length === 0) {
      console.error(`Student ${st.email} not found in database!`);
      continue;
    }
    const studentUser = userRes.rows[0];
    const authUser = {
      userId: studentUser.user_id,
      email: studentUser.email,
      roles: ['student'],
      permissions: [],
    } as any;

    // 1. Student opens My Certificates (GET /certificates/my)
    const myCertificates = await certificatesService.listStudentCertificates(studentUser.user_id, {});
    console.log(`[My Certificates] Retrieved ${myCertificates.data.length} certificate(s) for ${st.email}:`);

    if (myCertificates.data.length === 0) {
      console.error(`  [FAIL] No certificates found for completed student ${st.email}!`);
      process.exit(1);
    }

    const certItem = myCertificates.data[0];
    console.log(`  - Certificate ID: ${certItem.certificateId}`);
    console.log(`  - Certificate Number: ${certItem.certificateNumber}`);
    console.log(`  - Type: ${certItem.certificateType}`);
    console.log(`  - Student Name: ${certItem.studentNameSnapshot}`);
    console.log(`  - Subject/Course: ${certItem.subjectTitle}`);
    console.log(`  - Status: ${certItem.status}`);
    console.log(`  - Issued At: ${certItem.issuedAt}`);

    if (certItem.status !== 'valid') {
      console.error(`  [FAIL] Certificate status is not valid! Status: ${certItem.status}`);
      process.exit(1);
    }

    // 2. Student downloads Certificate PDF (GET /certificates/:id/download)
    console.log(`\n[PDF Download Stream] Requesting PDF download for certificate ${certItem.certificateId}...`);
    const downloadResult = await certificatesService.getCertificateFileStream(certItem.certificateId, authUser);
    console.log(`  - Filename: ${downloadResult.filename}`);

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResult.stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    console.log(`  - Downloaded byte size: ${pdfBuffer.length} bytes`);

    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (pdfHeader === '%PDF-') {
      console.log(`  [PASS] File is a valid PDF document (starts with '%PDF-')`);
    } else {
      console.error(`  [FAIL] Downloaded file is not a valid PDF! Header: ${pdfHeader}`);
      process.exit(1);
    }

    // 3. Public Verification
    console.log(`\n[Public Verification] Verifying certificate ${certItem.certificateNumber}...`);
    const verifyResult = await certificatesService.verifyPublicCertificate(certItem.certificateNumber);
    console.log(`  - Valid: ${verifyResult.valid}`);
    console.log(`  - Verification Status: ${verifyResult.status}`);
    console.log(`  - Student Name: ${verifyResult.studentName}`);
    console.log(`  - Subject: ${verifyResult.subjectTitle}`);

    if (!verifyResult.valid || verifyResult.status !== 'valid') {
      console.error(`  [FAIL] Public verification failed!`);
      process.exit(1);
    }
    console.log(`  [PASS] Student workflow successfully verified end-to-end for ${st.email}`);
  }

  await pool.end();
  console.log('\n================================================================');
  console.log('ALL REAL STUDENT WORKFLOW CHECKS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

verifyStudentWorkflow().catch(err => {
  console.error('Workflow verification failed:', err);
  process.exit(1);
});

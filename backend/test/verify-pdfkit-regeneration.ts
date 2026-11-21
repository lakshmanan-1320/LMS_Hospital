import { Pool } from 'pg';
import * as path from 'path';
import * as fs from 'fs';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';

// Also test compiled dist directly to verify compiled JS
const { PdfGeneratorService: DistPdfGeneratorService } = require('../dist/src/certificates/pdf-generator.service');

async function testPdfKitRegeneration() {
  console.log('================================================================');
  console.log('  PDFKIT RUNTIME & AUTO-REGENERATION VERIFICATION');
  console.log('================================================================\n');

  // 1. Direct compiled DistPdfGeneratorService instantiation and rendering
  console.log('--- STEP 1: Verify Compiled DistPdfGeneratorService ---');
  const distGenerator = new DistPdfGeneratorService();
  const testBuffer = await distGenerator.generateCertificatePdf({
    certificateNumber: 'TEST-2026-PDFKIT',
    certificateType: 'course_completion',
    studentName: 'Test Student',
    subjectTitle: 'Test Course Subject',
    completionDate: new Date(),
    verificationUrl: 'http://localhost:3000/verify-certificate/test',
  });

  const header = testBuffer.subarray(0, 5).toString('ascii');
  console.log(`Compiled service generated PDF buffer length: ${testBuffer.length} bytes`);
  console.log(`Buffer header: "${header}"`);
  if (header === '%PDF-') {
    console.log('[PASS] Compiled PdfGeneratorService successfully created a valid PDF beginning with %PDF-');
  } else {
    throw new Error(`[FAIL] Compiled PdfGeneratorService output does not begin with %PDF-, got: "${header}"`);
  }

  // 2. Set up services with actual PostgreSQL database and local storage
  console.log('\n--- STEP 2: Database & Auto-Regeneration of Missing Certificate File ---');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:OneCRM123@localhost:5432/LMS',
  });

  const dbService = {
    executeQuery: async <T = any>(query: string, params?: any[]): Promise<{ rows: T[] }> => {
      const res = await pool.query(query, params);
      return { rows: res.rows };
    },
    query: async (query: string, params?: any[]) => {
      return pool.query(query, params);
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

  // Count certificates before test
  const countBeforeRes = await pool.query('SELECT COUNT(*)::int AS count FROM issued_certificates');
  const totalBefore = countBeforeRes.rows[0].count;
  console.log(`Total certificate records in database before test: ${totalBefore}`);

  // Find an existing valid certificate
  const certRes = await pool.query(
    `SELECT * FROM issued_certificates WHERE status = 'valid' ORDER BY created_at DESC LIMIT 1`
  );
  if (certRes.rows.length === 0) {
    throw new Error('No valid certificate found in database to test regeneration!');
  }
  const cert = certRes.rows[0];
  console.log(`Selected existing certificate:`);
  console.log(`- ID: ${cert.certificate_id}`);
  console.log(`- Number: ${cert.certificate_number}`);
  console.log(`- Student: ${cert.student_name_snapshot}`);
  console.log(`- Storage Key: ${cert.certificate_file_storage_key}`);

  // Intentionally delete/unlink the storage file if it exists to simulate a missing file
  const localStorageRoot = path.resolve('private-storage');
  const physicalPath = path.join(localStorageRoot, cert.certificate_file_storage_key);

  if (fs.existsSync(physicalPath)) {
    console.log(`Deleting physical file to simulate missing storage: ${physicalPath}`);
    fs.unlinkSync(physicalPath);
  }
  const existsBefore = await storageService.exists(cert.certificate_file_storage_key);
  console.log(`Storage file exists before auto-regeneration: ${existsBefore}`);
  if (existsBefore) {
    throw new Error('Failed to simulate missing file in storage!');
  }

  // Now call getCertificateFileStream as the owner (this triggers auto-regeneration when missing)
  console.log('\n--- STEP 3: Trigger Auto-Regeneration via getCertificateFileStream ---');
  const ownerAuth = {
    userId: cert.student_id,
    email: 'student@example.com',
    roles: ['student'],
    permissions: [],
  };

  const streamResult = await certificatesService.getCertificateFileStream(cert.certificate_id, ownerAuth as any);
  console.log(`Stream filename: ${streamResult.filename}`);

  // Collect stream into Buffer
  const chunks: Buffer[] = [];
  const regeneratedBuffer = await new Promise<Buffer>((resolve, reject) => {
    streamResult.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    streamResult.stream.on('end', () => resolve(Buffer.concat(chunks)));
    streamResult.stream.on('error', reject);
  });

  console.log(`Auto-regenerated file size: ${regeneratedBuffer.length} bytes`);
  const regeneratedHeader = regeneratedBuffer.subarray(0, 5).toString('ascii');
  console.log(`Auto-regenerated file header: "${regeneratedHeader}"`);

  if (regeneratedHeader === '%PDF-') {
    console.log('[PASS] Auto-regenerated file starts with %PDF-');
  } else {
    throw new Error(`[FAIL] Auto-regenerated file does not begin with %PDF-, got: "${regeneratedHeader}"`);
  }

  // Verify file now exists in storage
  const existsAfter = await storageService.exists(cert.certificate_file_storage_key);
  console.log(`Storage file exists after auto-regeneration: ${existsAfter}`);
  if (!existsAfter) {
    throw new Error('[FAIL] Storage file does not exist after auto-regeneration!');
  }

  // Count certificates after test to ensure NO duplicate records were created
  const countAfterRes = await pool.query('SELECT COUNT(*)::int AS count FROM issued_certificates');
  const totalAfter = countAfterRes.rows[0].count;
  console.log(`\nTotal certificate records in database after test: ${totalAfter}`);
  if (totalBefore === totalAfter) {
    console.log('[PASS] Invariant Verified: No duplicate certificate records created in PostgreSQL.');
  } else {
    throw new Error(`[FAIL] Duplicate certificate records created! Before: ${totalBefore}, After: ${totalAfter}`);
  }

  await pool.end();

  console.log('\n================================================================');
  console.log('  PDFKIT RUNTIME & REGENERATION TESTS COMPLETED SUCCESSFULLY!   ');
  console.log('================================================================');
}

testPdfKitRegeneration().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

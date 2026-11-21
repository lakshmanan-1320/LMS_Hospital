import { Pool } from 'pg';
import * as path from 'path';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CertificatesRepository } from '../src/certificates/certificates.repository';
import { CertificatesService } from '../src/certificates/certificates.service';
import { PdfGeneratorService } from '../src/certificates/pdf-generator.service';
import { StorageService } from '../src/providers/storage/storage.service';
import { LocalStorageProvider } from '../src/providers/storage/local/local-storage.provider';
import { CertificatesController } from '../src/certificates/certificates.controller';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { DashboardRepository } from '../src/dashboard/dashboard.repository';
import { DashboardService } from '../src/dashboard/dashboard.service';

function createMockExecutionContext(handler: Function, targetClass: any, user: any): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => targetClass,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

async function runRoleAuthorizationTests() {
  console.log('================================================================');
  console.log('  ROLE-BASED AUTHORIZATION & DASHBOARD/CERTIFICATE VERIFICATION');
  console.log('================================================================\n');

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
  const certificatesController = new CertificatesController(certificatesService);
  const reflector = new Reflector();
  const rolesGuard = new RolesGuard(reflector);

  const dashboardRepo = new DashboardRepository(dbService);
  const dashboardService = new DashboardService(dashboardRepo);

  // Retrieve actual users from database
  const studentRes = await pool.query(
    `SELECT u.user_id, u.email, u.first_name, u.last_name
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     WHERE LOWER(r.name) = 'student'
     LIMIT 2`
  );
  const student1 = studentRes.rows[0];
  const student2 = studentRes.rows[1];

  const adminRes = await pool.query(
    `SELECT u.user_id, u.email
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     WHERE LOWER(r.name) = 'admin'
     LIMIT 1`
  );
  const adminUser = adminRes.rows[0];

  const superAdminRes = await pool.query(
    `SELECT u.user_id, u.email
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     WHERE LOWER(r.name) IN ('super_admin', 'super-admin')
     LIMIT 1`
  );
  const superAdminUser = superAdminRes.rows[0];

  const instructorRes = await pool.query(
    `SELECT u.user_id, u.email
     FROM users u
     JOIN user_roles ur ON u.user_id = ur.user_id
     JOIN roles r ON ur.role_id = r.role_id
     WHERE LOWER(r.name) = 'instructor'
     LIMIT 1`
  );
  const instructorUser = instructorRes.rows[0];

  console.log(`Found test users:`);
  console.log(`- Student 1: ${student1?.email} (${student1?.user_id})`);
  console.log(`- Student 2: ${student2?.email} (${student2?.user_id})`);
  console.log(`- Instructor: ${instructorUser?.email} (${instructorUser?.user_id})`);
  console.log(`- Admin: ${adminUser?.email} (${adminUser?.user_id})`);
  console.log(`- Super Admin: ${superAdminUser?.email} (${superAdminUser?.user_id})\n`);

  let allPassed = true;

  const studentAuth = {
    userId: student1.user_id,
    email: student1.email,
    roles: ['student'],
    permissions: [],
  };

  // -------------------------------------------------------------
  // TEST 1: Student calls GET /certificates/my
  // -------------------------------------------------------------
  console.log('--- TEST 1: Student calls GET /certificates/my ---');
  try {
    const res = await certificatesController.getMyCertificates(studentAuth as any, {});
    console.log(`[PASS] Student getMyCertificates succeeded. Found ${res.total} certificates.`);
  } catch (err: any) {
    console.error(`[FAIL] Student getMyCertificates threw error:`, err.message);
    allPassed = false;
  }

  // -------------------------------------------------------------
  // TEST 2: Student attempts GET /certificates/admin/overview
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Student attempts GET /certificates/admin/overview ---');
  try {
    const studentAuth = {
      userId: student1.user_id,
      email: student1.email,
      roles: ['student'],
      permissions: [],
    };
    const ctx = createMockExecutionContext(
      certificatesController.getAdminOverview,
      CertificatesController,
      studentAuth,
    );
    rolesGuard.canActivate(ctx);
    console.error(`[FAIL] Expected RolesGuard to reject student from admin overview!`);
    allPassed = false;
  } catch (err: any) {
    if (err instanceof ForbiddenException && err.message.includes('Required role: [super_admin, admin]')) {
      console.log(`[PASS] Correctly rejected with 403 Forbidden: "${err.message}"`);
    } else {
      console.error(`[FAIL] Unexpected error:`, err);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------
  // TEST 3: Student attempts GET /certificates/admin/list
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Student attempts GET /certificates/admin/list ---');
  try {
    const studentAuth = {
      userId: student1.user_id,
      email: student1.email,
      roles: ['student'],
      permissions: [],
    };
    const ctx = createMockExecutionContext(
      certificatesController.getAdminCertificatesList,
      CertificatesController,
      studentAuth,
    );
    rolesGuard.canActivate(ctx);
    console.error(`[FAIL] Expected RolesGuard to reject student from admin certificate list!`);
    allPassed = false;
  } catch (err: any) {
    if (
      err instanceof ForbiddenException &&
      err.message.includes('Required role: [super_admin, admin, instructor]')
    ) {
      console.log(`[PASS] Correctly rejected with 403 Forbidden: "${err.message}"`);
    } else {
      console.error(`[FAIL] Unexpected error:`, err);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------
  // TEST 4: Student attempts to download another student's certificate
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Cross-student Certificate Download Isolation ---');
  const certRes = await pool.query(
    `SELECT certificate_id, certificate_number, student_id FROM issued_certificates LIMIT 1`
  );
  if (certRes.rows.length > 0) {
    const cert = certRes.rows[0];
    const foreignStudentAuth = {
      userId: '00000000-0000-0000-0000-000000000000',
      email: 'intruder@example.com',
      roles: ['student'],
      permissions: [],
    };
    try {
      await certificatesService.getCertificateFileStream(cert.certificate_id, foreignStudentAuth as any);
      console.error(`[FAIL] Expected download of certificate ${cert.certificate_number} to be blocked!`);
      allPassed = false;
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        console.log(`[PASS] Cross-student access blocked with 403 Forbidden: "${err.message}"`);
      } else {
        console.error(`[FAIL] Unexpected error:`, err);
        allPassed = false;
      }
    }

    // Owner downloading should succeed
    const ownerAuth = {
      userId: cert.student_id,
      email: 'owner@example.com',
      roles: ['student'],
      permissions: [],
    };
    try {
      const streamRes = await certificatesService.getCertificateFileStream(cert.certificate_id, ownerAuth as any);
      console.log(`[PASS] Owner successfully accessed certificate download stream: ${streamRes.filename}`);
    } catch (err: any) {
      console.error(`[FAIL] Owner failed to download certificate:`, err.message);
      allPassed = false;
    }
  } else {
    console.log('[SKIP] No issued certificates found to test cross-download.');
  }

  // -------------------------------------------------------------
  // TEST 5: Instructor access to admin list vs overview
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Instructor Role Permissions ---');
  const instructorAuth = {
    userId: instructorUser?.user_id || '11111111-1111-1111-1111-111111111111',
    email: instructorUser?.email || 'instructor@example.com',
    roles: ['instructor'],
    permissions: [],
  };

  // Instructor should be allowed on admin/list
  const ctxInstList = createMockExecutionContext(
    certificatesController.getAdminCertificatesList,
    CertificatesController,
    instructorAuth,
  );
  const canInstList = rolesGuard.canActivate(ctxInstList);
  if (canInstList) {
    console.log(`[PASS] Instructor is authorized for GET /certificates/admin/list`);
  } else {
    console.error(`[FAIL] Instructor was rejected on admin list!`);
    allPassed = false;
  }

  // Instructor should be rejected on admin/overview
  const ctxInstOverview = createMockExecutionContext(
    certificatesController.getAdminOverview,
    CertificatesController,
    instructorAuth,
  );
  try {
    rolesGuard.canActivate(ctxInstOverview);
    console.error(`[FAIL] Instructor should NOT have access to admin overview!`);
    allPassed = false;
  } catch (err: any) {
    if (err instanceof ForbiddenException && err.message.includes('Required role: [super_admin, admin]')) {
      console.log(`[PASS] Instructor correctly forbidden from admin overview: "${err.message}"`);
    } else {
      console.error(`[FAIL] Unexpected error:`, err);
      allPassed = false;
    }
  }

  // -------------------------------------------------------------
  // TEST 6: Admin and Super Admin access
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Admin and Super Admin Permissions ---');
  const adminAuth = {
    userId: adminUser?.user_id || '22222222-2222-2222-2222-222222222222',
    email: adminUser?.email || 'admin@example.com',
    roles: ['admin'],
    permissions: [],
  };
  const ctxAdminOverview = createMockExecutionContext(
    certificatesController.getAdminOverview,
    CertificatesController,
    adminAuth,
  );
  const canAdminOverview = rolesGuard.canActivate(ctxAdminOverview);
  console.log(`[${canAdminOverview ? 'PASS' : 'FAIL'}] Admin can access admin overview`);

  const superAdminAuth = {
    userId: superAdminUser?.user_id || '33333333-3333-3333-3333-333333333333',
    email: superAdminUser?.email || 'superadmin@example.com',
    roles: ['super_admin'],
    permissions: [],
  };
  const ctxSuperAdminOverview = createMockExecutionContext(
    certificatesController.getAdminOverview,
    CertificatesController,
    superAdminAuth,
  );
  const canSuperAdminOverview = rolesGuard.canActivate(ctxSuperAdminOverview);
  console.log(`[${canSuperAdminOverview ? 'PASS' : 'FAIL'}] Super Admin can access admin overview`);

  // -------------------------------------------------------------
  // TEST 7: Dashboard Overview for each role
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Dashboard Service Overview Across Roles ---');
  try {
    const studentOverview = await dashboardService.getOverview(studentAuth as any);
    console.log(`[PASS] Student dashboard overview loaded: role=${studentOverview.role}`);

    const instructorOverview = await dashboardService.getOverview(instructorAuth as any);
    console.log(`[PASS] Instructor dashboard overview loaded: role=${instructorOverview.role}`);

    const adminOverview = await dashboardService.getOverview(adminAuth as any);
    console.log(`[PASS] Admin dashboard overview loaded: role=${adminOverview.role}`);

    const superAdminOverview = await dashboardService.getOverview(superAdminAuth as any);
    console.log(`[PASS] Super Admin dashboard overview loaded: role=${superAdminOverview.role}`);
  } catch (err: any) {
    console.error(`[FAIL] Dashboard overview error:`, err);
    allPassed = false;
  }

  await pool.end();

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  ALL AUTHORIZATION & ROLE ISOLATION TESTS PASSED SUCCESSFULLY!  ');
  } else {
    console.error('  SOME TESTS FAILED! CHECK OUTPUT ABOVE.  ');
    process.exit(1);
  }
  console.log('================================================================');
}

runRoleAuthorizationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

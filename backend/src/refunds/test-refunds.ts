import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RefundsService } from './refunds.service';
import { OrdersService } from '../orders/orders.service';
import { CartService } from '../cart/cart.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayGatewayService } from '../payments/services/razorpay-gateway.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

async function runRefundsTests() {
  console.log('================================================================');
  console.log('--- STARTING PHASE 5: REFUNDS & AUDITING INTEGRATION TESTS ---');
  console.log('================================================================\n');

  // Payment tests run against the simulator, never real Razorpay. Must be set before the app
  // (and RazorpayGatewayService) is created. Real flow: create order -> verify -> checkout.
  process.env.RAZORPAY_MOCK_MODE = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const refundsService = app.get(RefundsService);
  const ordersService = app.get(OrdersService);
  const cartService = app.get(CartService);
  const paymentsService = app.get(PaymentsService);
  const razorpayGateway = app.get(RazorpayGatewayService);
  const db = app.get(DatabaseService);

  let passedTests = 0;
  const totalTests = 12;

  try {
    // 0. Setup test student A, student B, and admin
    let studentUser = (
      await db.query(`
        SELECT u.user_id, u.email, array_agg(r.name) as roles
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'STUDENT'
        GROUP BY u.user_id, u.email
        LIMIT 1;
      `)
    ).rows[0];

    if (!studentUser) {
      const uRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.refund.student@example.com', 'dummy_hash', 'Refund', 'Student', TRUE, TRUE)
        RETURNING user_id, email;
      `);
      studentUser = uRes.rows[0];
      const roleRes = await db.query(`SELECT role_id FROM roles WHERE name = 'STUDENT' LIMIT 1;`);
      if (roleRes.rows[0]) {
        await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2);`, [
          studentUser.user_id,
          roleRes.rows[0].role_id,
        ]);
      }
    }

    const studentAuth: AuthenticatedUser = {
      userId: studentUser.user_id,
      email: studentUser.email,
      roles: ['STUDENT'],
      permissions: [],
    };

    let otherStudent = (
      await db.query(`SELECT user_id, email FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];
    if (!otherStudent) {
      const u2 = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('other.refund.student@example.com', 'dummy_hash', 'Other', 'Student', TRUE, TRUE)
        RETURNING user_id, email;
      `);
      otherStudent = u2.rows[0];
    }
    const otherAuth: AuthenticatedUser = {
      userId: otherStudent.user_id,
      email: otherStudent.email,
      roles: ['STUDENT'],
      permissions: [],
    };

    const adminAuth: AuthenticatedUser = {
      userId: studentAuth.userId,
      email: 'admin.refunds@example.com',
      roles: ['ADMIN'],
      permissions: [],
    };

    // Instructor fixture
    let instructor = (
      await db.query(`SELECT user_id FROM users WHERE user_id != $1 AND user_id != $2 LIMIT 1;`, [
        studentAuth.userId,
        otherAuth.userId,
      ])
    ).rows[0];
    if (!instructor) {
      const ins = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('refund.instructor@example.com', 'dummy_hash', 'Refund', 'Instructor', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructor = ins.rows[0];
    }

    // Clean carts
    await cartService.clearCart(studentAuth);
    await cartService.clearCart(otherAuth);

    // Prepare courses: Paid Course 1 (₹1200), Paid Course 2 (₹800), Free Course (₹0)
    const course1Res = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, currency, status, is_active
      )
      VALUES ($1, 'Full-Stack Rust Engineering', 'rust-eng-' || substr(md5(random()::text), 1, 8), FALSE, 1200, 'INR', 'published', TRUE)
      RETURNING course_id, title, price;
    `, [instructor.user_id]);
    const course1 = course1Res.rows[0];

    const course2Res = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, currency, status, is_active
      )
      VALUES ($1, 'Go Microservices & Kafka', 'go-kafka-' || substr(md5(random()::text), 1, 8), FALSE, 800, 'INR', 'published', TRUE)
      RETURNING course_id, title, price;
    `, [instructor.user_id]);
    const course2 = course2Res.rows[0];

    const courseFreeRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, currency, status, is_active
      )
      VALUES ($1, 'Free Shell Scripting Basics', 'shell-free-' || substr(md5(random()::text), 1, 8), TRUE, 0, 'INR', 'published', TRUE)
      RETURNING course_id, title, price;
    `, [instructor.user_id]);
    const courseFree = courseFreeRes.rows[0];

    console.log(`[SETUP] Prepared test courses:`);
    console.log(`  - Course 1 (Paid): ₹${course1.price} (ID: ${course1.course_id})`);
    console.log(`  - Course 2 (Paid): ₹${course2.price} (ID: ${course2.course_id})`);
    console.log(`  - Course Free: ₹0 (ID: ${courseFree.course_id})\n`);

    // Helper to create and checkout a completed order
    async function setupCompletedOrder(courseId: string, student: AuthenticatedUser) {
      await cartService.clearCart(student);
      await cartService.addToCart({ courseId }, student);
      const payOrder = await paymentsService.createPaymentOrder(student);
      const mockPayId = `pay_mock_rfnd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const sig = razorpayGateway.generateMockSignature(payOrder.orderId, mockPayId);
      await paymentsService.verifyPayment(
        { razorpay_order_id: payOrder.orderId, razorpay_payment_id: mockPayId, razorpay_signature: sig },
        student,
      );
      return ordersService.checkout(
        {
          razorpay_order_id: payOrder.orderId,
          razorpay_payment_id: mockPayId,
          razorpay_signature: sig,
        },
        student,
      );
    }

    // ==============================================================
    // TEST 1: Student Requests Refund for Completed Paid Order
    // ==============================================================
    console.log('>>> TEST 1: Student Requests Refund for Completed Paid Order');
    const order1 = await setupCompletedOrder(course1.course_id, studentAuth);

    const refundRequest = await refundsService.requestRefund(
      {
        order_id: order1.orderId,
        reason: 'Course content did not match my expectations.',
      },
      studentAuth,
    );

    if (
      refundRequest.status === 'pending' &&
      refundRequest.refundNumber.startsWith('RFND-') &&
      refundRequest.amount === 1200 &&
      refundRequest.orderId === order1.orderId
    ) {
      console.log(`  [PASS] Refund request created: ${refundRequest.refundNumber}, Status: 'pending', Amount: ₹${refundRequest.amount}`);
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: Refund request creation mismatch: ${JSON.stringify(refundRequest)}`);
    }

    // ==============================================================
    // TEST 2: Duplicate Refund Request Guard
    // ==============================================================
    console.log('\n>>> TEST 2: Duplicate Refund Request Guard');
    try {
      await refundsService.requestRefund(
        {
          order_id: order1.orderId,
          reason: 'Submitting duplicate refund request.',
        },
        studentAuth,
      );
      throw new Error('Test 2 Failed: Duplicate refund request should throw ConflictException');
    } catch (err: any) {
      if (err instanceof ConflictException && err.message.includes('already')) {
        console.log(`  [PASS] Duplicate refund request blocked with ConflictException.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 3: Free / Zero-Amount Order Refund Rejection
    // ==============================================================
    console.log('\n>>> TEST 3: Free / Zero-Amount Order Refund Rejection');
    await cartService.clearCart(studentAuth);
    await cartService.addToCart({ courseId: courseFree.course_id }, studentAuth);
    const freeOrder = await ordersService.checkout({}, studentAuth);

    try {
      await refundsService.requestRefund(
        {
          order_id: freeOrder.orderId,
          reason: 'Requesting refund for free course.',
        },
        studentAuth,
      );
      throw new Error('Test 3 Failed: Free order refund request should throw BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('Free / ₹0 orders cannot be refunded')) {
        console.log(`  [PASS] Free course refund request correctly rejected.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 4: Non-Owner Refund Request Rejection
    // ==============================================================
    console.log('\n>>> TEST 4: Non-Owner Refund Request Rejection');
    try {
      // otherAuth tries to request refund for studentAuth's order
      await refundsService.requestRefund(
        {
          order_id: order1.orderId,
          reason: 'Unauthorized refund request by another student.',
        },
        otherAuth,
      );
      throw new Error('Test 4 Failed: Cross-user refund request should throw ForbiddenException');
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        console.log(`  [PASS] Cross-user refund request correctly rejected with ForbiddenException.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 5: Admin Approves Refund & Processes Gateway Reversal
    // ==============================================================
    console.log('\n>>> TEST 5: Admin Approves Refund & Processes Gateway Reversal');
    const approveResult = await refundsService.reviewRefund(
      refundRequest.refundId,
      {
        decision: 'approve',
        admin_notes: 'Eligible for 30-day money back guarantee.',
      },
      adminAuth,
    );

    if (
      approveResult.success === true &&
      approveResult.refund.status === 'processed' &&
      approveResult.refund.gatewayRefundId &&
      approveResult.revokedCount === 1
    ) {
      console.log(`  [PASS] Refund approved! Gateway Refund ID: ${approveResult.refund.gatewayRefundId}, Revoked: ${approveResult.revokedCount} enrollment.`);
      passedTests++;
    } else {
      throw new Error(`Test 5 Failed: Refund approval failed: ${JSON.stringify(approveResult)}`);
    }

    // Verify order status in DB
    const orderCheck = await db.query(`SELECT status, payment_status FROM orders WHERE order_id = $1`, [
      order1.orderId,
    ]);
    if (orderCheck.rows[0]?.status === 'refunded' && orderCheck.rows[0]?.payment_status === 'refunded') {
      console.log(`  [PASS] Order status updated in DB to 'refunded' and payment_status to 'refunded'.`);
    } else {
      throw new Error('Test 5 Failed: Order status was not updated to refunded in DB');
    }

    // ==============================================================
    // TEST 6: Automatic Course Enrollment Revocation Verification
    // ==============================================================
    console.log('\n>>> TEST 6: Automatic Course Enrollment Revocation Verification');
    const enrollmentCheck = await db.query(
      `SELECT enrollment_status FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
      [studentAuth.userId, course1.course_id],
    );

    if (enrollmentCheck.rows[0]?.enrollment_status === 'cancelled') {
      console.log(`  [PASS] Student course enrollment immediately revoked: enrollment_status='cancelled'. Course access denied.`);
      passedTests++;
    } else {
      throw new Error(`Test 6 Failed: Enrollment was not cancelled in DB: ${JSON.stringify(enrollmentCheck.rows[0])}`);
    }

    // ==============================================================
    // TEST 7: Admin Rejects Refund Request
    // ==============================================================
    console.log('\n>>> TEST 7: Admin Rejects Refund Request');
    // Setup a new completed order for Course 2
    const order2 = await setupCompletedOrder(course2.course_id, studentAuth);
    const refund2 = await refundsService.requestRefund(
      {
        order_id: order2.orderId,
        reason: 'Finished course, requesting refund.',
      },
      studentAuth,
    );

    const rejectResult = await refundsService.reviewRefund(
      refund2.refundId,
      {
        decision: 'reject',
        admin_notes: 'Course was 100% completed, ineligible for refund under policy.',
      },
      adminAuth,
    );

    if (rejectResult.success === true && rejectResult.refund.status === 'rejected') {
      // Verify enrollment remains ACTIVE
      const enroll2Check = await db.query(
        `SELECT enrollment_status FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
        [studentAuth.userId, course2.course_id],
      );
      const order2Check = await db.query(`SELECT status FROM orders WHERE order_id = $1`, [order2.orderId]);

      if (enroll2Check.rows[0]?.enrollment_status === 'active' && order2Check.rows[0]?.status === 'completed') {
        console.log(`  [PASS] Refund rejected: status='rejected'. Order remains 'completed' and enrollment remains 'active'.`);
        passedTests++;
      } else {
        throw new Error('Test 7 Failed: Enrollment status was modified upon rejection');
      }
    } else {
      throw new Error('Test 7 Failed: Refund rejection failed');
    }

    // ==============================================================
    // TEST 8: Prevent Reviewing Already-Processed Refund
    // ==============================================================
    console.log('\n>>> TEST 8: Prevent Reviewing Already-Processed Refund');
    try {
      await refundsService.reviewRefund(
        refundRequest.refundId, // Already processed
        { decision: 'reject', admin_notes: 'Trying to reject already processed refund' },
        adminAuth,
      );
      throw new Error('Test 8 Failed: Reviewing processed refund should throw BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('already been reviewed')) {
        console.log(`  [PASS] Reviewing already-processed refund rejected: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 9: Non-Admin Review Attempt Rejection
    // ==============================================================
    console.log('\n>>> TEST 9: Non-Admin Review Attempt Rejection');
    try {
      await refundsService.reviewRefund(
        refund2.refundId,
        { decision: 'approve' },
        studentAuth, // Student trying to approve
      );
      throw new Error('Test 9 Failed: Student reviewing refund should throw ForbiddenException');
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        console.log(`  [PASS] Student unauthorized from reviewing refunds (ForbiddenException).`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 10: Student Lists Own Refunds
    // ==============================================================
    console.log('\n>>> TEST 10: Student Lists Own Refunds');
    const studentRefunds = await refundsService.listStudentRefunds(studentAuth, { limit: 10 });

    if (studentRefunds.total >= 2 && studentRefunds.items.length >= 2) {
      console.log(`  [PASS] Student retrieved their refund requests: ${studentRefunds.total} found.`);
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: Expected at least 2 refunds, got ${studentRefunds.total}`);
    }

    // ==============================================================
    // TEST 11: Admin Lists All Platform Refunds
    // ==============================================================
    console.log('\n>>> TEST 11: Admin Lists All Platform Refunds');
    const allRefunds = await refundsService.listAllRefunds({ limit: 50 }, adminAuth);

    if (allRefunds.total >= 2 && allRefunds.items.length >= 2) {
      console.log(`  [PASS] Admin retrieved all platform refunds: ${allRefunds.total} total.`);
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: Expected platform refunds, got ${allRefunds.total}`);
    }

    // ==============================================================
    // TEST 12: Financial Audit Ledger Inspection
    // ==============================================================
    console.log('\n>>> TEST 12: Financial Audit Ledger Inspection');
    const ledger = await refundsService.listAuditLogs({ limit: 50 }, adminAuth);

    const eventTypes = ledger.items.map((i) => i.event_type);
    const hasRequested = eventTypes.includes('REFUND_REQUESTED');
    const hasProcessed = eventTypes.includes('REFUND_PROCESSED');
    const hasRevoked = eventTypes.includes('ENROLLMENT_REVOKED');
    const hasRejected = eventTypes.includes('REFUND_REJECTED');

    if (hasRequested && hasProcessed && hasRevoked && hasRejected && ledger.total >= 4) {
      console.log(`  [PASS] Financial Audit Ledger verified with all financial lifecycle events:`);
      console.log(`    - REFUND_REQUESTED`);
      console.log(`    - REFUND_PROCESSED`);
      console.log(`    - ENROLLMENT_REVOKED`);
      console.log(`    - REFUND_REJECTED`);
      console.log(`    - Total logged events: ${ledger.total}`);
      passedTests++;
    } else {
      throw new Error(`Test 12 Failed: Missing events in ledger: ${JSON.stringify(eventTypes)}`);
    }

    // Clean fixtures
    await cartService.clearCart(studentAuth);
    await cartService.clearCart(otherAuth);
    await db.query(`DELETE FROM course_enrollments WHERE course_id IN ($1, $2, $3)`, [
      course1.course_id,
      course2.course_id,
      courseFree.course_id,
    ]);
    await db.query(`DELETE FROM order_items WHERE course_id IN ($1, $2, $3)`, [
      course1.course_id,
      course2.course_id,
      courseFree.course_id,
    ]);
    await db.query(`DELETE FROM courses WHERE course_id IN ($1, $2, $3)`, [
      course1.course_id,
      course2.course_id,
      courseFree.course_id,
    ]);

    console.log('\n================================================================');
    console.log(`=== ALL ${passedTests}/${totalTests} PHASE 5 INTEGRATION TESTS PASSED SUCCESSFULLY! ===`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n[FATAL TEST FAILURE]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runRefundsTests();


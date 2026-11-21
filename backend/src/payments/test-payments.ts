import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from './payments.service';
import { RazorpayGatewayService } from './services/razorpay-gateway.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

async function runPaymentTests() {
  console.log('================================================================');
  console.log('--- STARTING PHASE 3: RAZORPAY MOCK PAYMENT GATEWAY TESTS ---');
  console.log('================================================================\n');

  // Payment tests run against the simulator, never real Razorpay. Must be set before the app
  // (and RazorpayGatewayService) is created. Real flow: create order -> verify -> checkout.
  process.env.RAZORPAY_MOCK_MODE = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const paymentsService = app.get(PaymentsService);
  const razorpayGateway = app.get(RazorpayGatewayService);
  const cartService = app.get(CartService);
  const couponsService = app.get(CouponsService);
  const db = app.get(DatabaseService);

  let passedTests = 0;
  const totalTests = 15;

  try {
    // 0. Setup test users (Student 1 and Student 2)
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
      console.log('Creating test student...');
      const uRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.payment.student@example.com', 'dummy_hash', 'Payment', 'Student', TRUE, TRUE)
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
      studentUser.roles = ['STUDENT'];
    }

    const studentAuth: AuthenticatedUser = {
      userId: studentUser.user_id,
      email: studentUser.email,
      roles: ['STUDENT'],
      permissions: [],
    };

    // Another student for authorization tests
    let otherStudent = (
      await db.query(`SELECT user_id, email FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];

    if (!otherStudent) {
      const u2Res = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.other.student@example.com', 'dummy_hash', 'Other', 'Student', TRUE, TRUE)
        RETURNING user_id, email;
      `);
      otherStudent = u2Res.rows[0];
    }

    const otherAuth: AuthenticatedUser = {
      userId: otherStudent.user_id,
      email: otherStudent.email,
      roles: ['STUDENT'],
      permissions: [],
    };

    // Clean previous cart and payment records for reproducibility
    await db.query(`DELETE FROM payment_webhooks_log`);
    await db.query(`DELETE FROM payment_transactions WHERE student_id = $1`, [studentAuth.userId]);
    const existingCart = await db.query(`SELECT cart_id FROM carts WHERE student_id = $1`, [
      studentAuth.userId,
    ]);
    if (existingCart.rows[0]) {
      await db.query(`DELETE FROM cart_items WHERE cart_id = $1`, [existingCart.rows[0].cart_id]);
      await db.query(`UPDATE carts SET applied_coupon_id = NULL WHERE cart_id = $1`, [
        existingCart.rows[0].cart_id,
      ]);
    }

    // Prepare courses: Paid Course 1 (₹1000) and Free Course (₹0)
    let instructorUser = (
      await db.query(`SELECT user_id FROM users WHERE user_id != $1 AND user_id != $2 LIMIT 1;`, [
        studentAuth.userId,
        otherAuth.userId,
      ])
    ).rows[0];

    if (!instructorUser) {
      const insRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.instructor.payment@example.com', 'dummy_hash', 'Payment', 'Instructor', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructorUser = insRes.rows[0];
    }

    // Paid Course: ₹1000
    const paidCourseRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Test Docker & Kubernetes Mastery', 'test-docker-k8s-' || substr(md5(random()::text), 1, 8),
        FALSE, 1000, 1000, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructorUser.user_id]);
    const paidCourse = paidCourseRes.rows[0];

    // Free Course: ₹0
    const freeCourseRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Test Linux Essentials Free', 'test-linux-free-' || substr(md5(random()::text), 1, 8),
        TRUE, 0, NULL, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructorUser.user_id]);
    const freeCourse = freeCourseRes.rows[0];

    console.log(`[SETUP DONE] Prepared test courses:`);
    console.log(`  - Paid Course: ₹${paidCourse.price} (ID: ${paidCourse.course_id})`);
    console.log(`  - Free Course: ₹0 (ID: ${freeCourse.course_id})\n`);

    // ==============================================================
    // TEST 1: Create Razorpay Order from Student Cart
    // ==============================================================
    console.log('>>> TEST 1: Create Razorpay Order from Student Cart');
    await cartService.addToCart({ courseId: paidCourse.course_id }, studentAuth);

    const orderConfig = await paymentsService.createPaymentOrder(studentAuth);

    if (
      orderConfig.orderId.startsWith('order_mock_') &&
      orderConfig.amount === 100000 && // ₹1000 in paise
      orderConfig.currency === 'INR' &&
      orderConfig.isMockMode === true
    ) {
      console.log(`  [PASS] Razorpay order created: ${orderConfig.orderId}, Amount: ${orderConfig.amount} paise (₹1000)`);
      passedTests++;
    } else {
      throw new Error(`Test 1 Failed: Order config mismatch: ${JSON.stringify(orderConfig)}`);
    }

    // Verify stored transaction in DB
    const tx1 = await db.query(`SELECT * FROM payment_transactions WHERE order_id = $1`, [
      orderConfig.orderId,
    ]);
    if (tx1.rows.length === 1 && tx1.rows[0].status === 'created') {
      console.log(`  [PASS] Transaction record verified in DB with status: 'created'`);
    } else {
      throw new Error('Test 1 Failed: Transaction was not properly saved in DB');
    }

    // ==============================================================
    // TEST 2: Order Creation with Coupon Discount Applied
    // ==============================================================
    console.log('\n>>> TEST 2: Order Creation with Coupon Discount Applied');
    // Create a coupon: ₹300 off on ₹1000
    await db.query(`DELETE FROM coupons WHERE code = 'TEST_RZP300'`);
    await couponsService.createCoupon({
      code: 'TEST_RZP300',
      discount_type: 'fixed',
      discount_value: 300,
      min_order_value: 500,
    });

    await cartService.applyCoupon('TEST_RZP300', studentAuth);
    const orderWithCoupon = await paymentsService.createPaymentOrder(studentAuth);

    // ₹1000 - ₹300 = ₹700 -> 70000 paise
    if (orderWithCoupon.amount === 70000 && orderWithCoupon.notes.couponCode === 'TEST_RZP300') {
      console.log(`  [PASS] Discounted order created: ${orderWithCoupon.orderId}, Amount: ${orderWithCoupon.amount} paise (₹700)`);
      passedTests++;
    } else {
      throw new Error(`Test 2 Failed: Expected 70000 paise, got ${orderWithCoupon.amount}`);
    }

    // ==============================================================
    // TEST 3: Pure Free Cart Rejection
    // ==============================================================
    console.log('\n>>> TEST 3: Pure Free Cart Rejection');
    await cartService.clearCart(studentAuth);
    await cartService.addToCart({ courseId: freeCourse.course_id }, studentAuth);

    try {
      await paymentsService.createPaymentOrder(studentAuth);
      throw new Error('Test 3 Failed: Pure free cart should have been rejected');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('free courses')) {
        console.log(`  [PASS] Correctly rejected free-only cart from checkout: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 4: Empty Cart Rejection
    // ==============================================================
    console.log('\n>>> TEST 4: Empty Cart Rejection');
    await cartService.clearCart(studentAuth);

    try {
      await paymentsService.createPaymentOrder(studentAuth);
      throw new Error('Test 4 Failed: Empty cart should have been rejected');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('cart is empty')) {
        console.log(`  [PASS] Correctly rejected empty cart: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 5: Cryptographic Payment Verification (Valid Signature)
    // ==============================================================
    console.log('\n>>> TEST 5: Cryptographic Payment Verification (Valid HMAC Signature)');
    // Set up a new order
    await cartService.addToCart({ courseId: paidCourse.course_id }, studentAuth);
    const orderToVerify = await paymentsService.createPaymentOrder(studentAuth);

    const mockPaymentId = `pay_mock_${Date.now()}`;
    const validSignature = razorpayGateway.generateMockSignature(
      orderToVerify.orderId,
      mockPaymentId,
    );

    const verifyResult = await paymentsService.verifyPayment(
      {
        razorpay_order_id: orderToVerify.orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: validSignature,
      },
      studentAuth,
    );

    if (
      verifyResult.success === true &&
      verifyResult.transaction.status === 'captured' &&
      verifyResult.transaction.payment_id === mockPaymentId
    ) {
      console.log(`  [PASS] Cryptographic HMAC-SHA256 signature verified. Status updated to 'captured'.`);
      passedTests++;
    } else {
      throw new Error('Test 5 Failed: Verification did not capture transaction');
    }

    // ==============================================================
    // TEST 6: Idempotent Payment Verification
    // ==============================================================
    console.log('\n>>> TEST 6: Idempotent Payment Verification');
    const idempotentResult = await paymentsService.verifyPayment(
      {
        razorpay_order_id: orderToVerify.orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: validSignature,
      },
      studentAuth,
    );

    if (idempotentResult.success === true && idempotentResult.message.includes('already been verified')) {
      console.log(`  [PASS] Idempotent verification returned cleanly without error.`);
      passedTests++;
    } else {
      throw new Error('Test 6 Failed: Idempotent check failed');
    }

    // ==============================================================
    // TEST 7: Tampered / Invalid Signature Rejection
    // ==============================================================
    console.log('\n>>> TEST 7: Tampered / Invalid Signature Rejection');
    const orderTampered = await paymentsService.createPaymentOrder(studentAuth);

    try {
      await paymentsService.verifyPayment(
        {
          razorpay_order_id: orderTampered.orderId,
          razorpay_payment_id: 'pay_mock_fake_123',
          razorpay_signature: 'invalid_tampered_signature_hex_value_000000000000000000000000',
        },
        studentAuth,
      );
      throw new Error('Test 7 Failed: Tampered signature should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('Invalid cryptographic signature')) {
        console.log(`  [PASS] Correctly rejected invalid signature: "${err.message}"`);
        // Verify status in DB updated to failed
        const failedTx = await db.query(
          `SELECT status, error_code FROM payment_transactions WHERE order_id = $1`,
          [orderTampered.orderId],
        );
        if (failedTx.rows[0]?.status === 'failed' && failedTx.rows[0]?.error_code === 'INVALID_SIGNATURE') {
          console.log(`  [PASS] Transaction marked 'failed' in DB with error_code: 'INVALID_SIGNATURE'`);
          passedTests++;
        } else {
          throw new Error('Test 7 Failed: Transaction status was not set to failed in DB');
        }
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 8: Unauthorized Verification Attempt by Another User
    // ==============================================================
    console.log('\n>>> TEST 8: Unauthorized Verification Attempt by Another User');
    const orderAuthCheck = await paymentsService.createPaymentOrder(studentAuth);
    const mockPayIdAuth = `pay_mock_auth_${Date.now()}`;
    const sigAuth = razorpayGateway.generateMockSignature(orderAuthCheck.orderId, mockPayIdAuth);

    try {
      // otherAuth attempts to verify studentAuth's transaction
      await paymentsService.verifyPayment(
        {
          razorpay_order_id: orderAuthCheck.orderId,
          razorpay_payment_id: mockPayIdAuth,
          razorpay_signature: sigAuth,
        },
        otherAuth,
      );
      throw new Error('Test 8 Failed: Cross-user verification should have thrown ForbiddenException');
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        console.log(`  [PASS] Correctly blocked cross-user verification with ForbiddenException.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 9: Mock Payment Simulator - SUCCESS Scenario
    // ==============================================================
    console.log('\n>>> TEST 9: Mock Payment Simulator - SUCCESS Scenario');
    const orderSimSuccess = await paymentsService.createPaymentOrder(studentAuth);

    const simSuccess = await paymentsService.simulatePayment(
      {
        orderId: orderSimSuccess.orderId,
        scenario: 'SUCCESS',
        method: 'upi',
      },
      studentAuth,
    );

    if (
      simSuccess.success === true &&
      simSuccess.status === 'captured' &&
      simSuccess.paymentId?.startsWith('pay_mock_') &&
      simSuccess.transaction.payment_method === 'upi'
    ) {
      console.log(`  [PASS] Simulation SUCCESS: Payment ${simSuccess.paymentId} captured via UPI.`);
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: Simulation failed: ${JSON.stringify(simSuccess)}`);
    }

    // ==============================================================
    // TEST 10: Mock Payment Simulator - FAILURE Scenario
    // ==============================================================
    console.log('\n>>> TEST 10: Mock Payment Simulator - FAILURE Scenario');
    const orderSimFail = await paymentsService.createPaymentOrder(studentAuth);

    const simFail = await paymentsService.simulatePayment(
      {
        orderId: orderSimFail.orderId,
        scenario: 'FAILURE',
        method: 'card',
      },
      studentAuth,
    );

    if (
      simFail.success === false &&
      simFail.status === 'failed' &&
      simFail.error?.code === 'BAD_REQUEST_ERROR' &&
      simFail.transaction.status === 'failed'
    ) {
      console.log(`  [PASS] Simulation FAILURE: Marked failed with error "${simFail.error?.description}"`);
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: Simulation failure mismatch: ${JSON.stringify(simFail)}`);
    }

    // ==============================================================
    // TEST 11: Mock Payment Simulator - CANCELLED Scenario
    // ==============================================================
    console.log('\n>>> TEST 11: Mock Payment Simulator - CANCELLED Scenario');
    const orderSimCancel = await paymentsService.createPaymentOrder(studentAuth);

    const simCancel = await paymentsService.simulatePayment(
      {
        orderId: orderSimCancel.orderId,
        scenario: 'CANCELLED',
      },
      studentAuth,
    );

    if (
      simCancel.success === false &&
      simCancel.status === 'cancelled' &&
      simCancel.transaction.status === 'cancelled'
    ) {
      console.log(`  [PASS] Simulation CANCELLED: Status correctly set to 'cancelled'.`);
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: Cancelled mismatch: ${JSON.stringify(simCancel)}`);
    }

    // ==============================================================
    // TEST 12: Webhook Event - payment.captured
    // ==============================================================
    console.log('\n>>> TEST 12: Webhook Event - payment.captured');
    const orderWebhookCapture = await paymentsService.createPaymentOrder(studentAuth);
    const webhookPayId = `pay_mock_wh_${Date.now()}`;

    const webhookResult = await paymentsService.simulateWebhookDispatch(
      'payment.captured',
      orderWebhookCapture.orderId,
      webhookPayId,
    );

    if (webhookResult.status === 'ok' && webhookResult.event === 'payment.captured') {
      const updatedTx = await db.query(
        `SELECT status, payment_id FROM payment_transactions WHERE order_id = $1`,
        [orderWebhookCapture.orderId],
      );
      if (updatedTx.rows[0]?.status === 'captured' && updatedTx.rows[0]?.payment_id === webhookPayId) {
        console.log(`  [PASS] Webhook payment.captured verified & transaction updated to 'captured' in DB.`);
        passedTests++;
      } else {
        throw new Error('Test 12 Failed: Webhook did not update transaction status');
      }
    } else {
      throw new Error('Test 12 Failed: Webhook dispatch failed');
    }

    // ==============================================================
    // TEST 13: Webhook Event - payment.failed
    // ==============================================================
    console.log('\n>>> TEST 13: Webhook Event - payment.failed');
    const orderWebhookFail = await paymentsService.createPaymentOrder(studentAuth);

    await paymentsService.simulateWebhookDispatch(
      'payment.failed',
      orderWebhookFail.orderId,
    );

    const failedTx = await db.query(
      `SELECT status, error_code FROM payment_transactions WHERE order_id = $1`,
      [orderWebhookFail.orderId],
    );
    if (failedTx.rows[0]?.status === 'failed') {
      console.log(`  [PASS] Webhook payment.failed verified & transaction marked 'failed' in DB.`);
      passedTests++;
    } else {
      throw new Error('Test 13 Failed: Webhook failed event did not update transaction');
    }

    // ==============================================================
    // TEST 14: Webhook Rejection on Bad Signature
    // ==============================================================
    console.log('\n>>> TEST 14: Webhook Rejection on Bad Signature');
    const fakePayload = { event: 'payment.captured', test: true };
    const fakeRaw = JSON.stringify(fakePayload);

    try {
      await paymentsService.handleWebhook(
        fakeRaw,
        'invalid_webhook_signature_hex_00000000000000000000000000000000',
        fakePayload,
      );
      throw new Error('Test 14 Failed: Webhook with invalid signature should throw BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('Webhook signature verification failed')) {
        console.log(`  [PASS] Unauthorized webhook rejected with BadRequestException.`);
        // Verify logged with is_verified = false
        const logRes = await db.query(
          `SELECT is_verified FROM payment_webhooks_log ORDER BY received_at DESC LIMIT 1`,
        );
        if (logRes.rows[0]?.is_verified === false) {
          console.log(`  [PASS] Rejected webhook logged with is_verified: false in DB.`);
          passedTests++;
        } else {
          throw new Error('Test 14 Failed: Webhook was not logged with is_verified: false');
        }
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 15: Student Payment Transaction History Retrieval
    // ==============================================================
    console.log('\n>>> TEST 15: Student Payment Transaction History Retrieval');
    const history = await paymentsService.listTransactions(studentAuth, { limit: 10 });

    if (history.total >= 5 && history.items.length > 0) {
      console.log(`  [PASS] Transaction history retrieved: ${history.total} total transactions found.`);
      passedTests++;
    } else {
      throw new Error(`Test 15 Failed: Expected at least 5 transactions, got ${history.total}`);
    }

    // Clean up test courses and test coupons
    await cartService.clearCart(studentAuth);
    await db.query(`DELETE FROM coupons WHERE code LIKE 'TEST_%'`);
    await db.query(`DELETE FROM courses WHERE course_id IN ($1, $2)`, [
      paidCourse.course_id,
      freeCourse.course_id,
    ]);

    console.log('\n================================================================');
    console.log(`=== ALL ${passedTests}/${totalTests} PHASE 3 INTEGRATION TESTS PASSED SUCCESSFULLY! ===`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n[FATAL TEST FAILURE]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runPaymentTests();


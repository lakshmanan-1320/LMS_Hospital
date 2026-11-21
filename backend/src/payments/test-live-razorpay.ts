import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from './payments.service';
import { RazorpayGatewayService } from './services/razorpay-gateway.service';
import { CartService } from '../cart/cart.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

async function runLiveRazorpayTest() {
  console.log('================================================================');
  console.log('--- TESTING REAL-TIME LIVE RAZORPAY TEST-MODE INTEGRATION ---');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const paymentsService = app.get(PaymentsService);
  const razorpayGateway = app.get(RazorpayGatewayService);
  const cartService = app.get(CartService);
  const db = app.get(DatabaseService);

  try {
    console.log(`[CONFIG] Gateway Mode: ${razorpayGateway.getMockMode() ? 'MOCK' : 'REALTIME RAZORPAY API'}`);
    console.log(`[CONFIG] Key ID: ${razorpayGateway.getKeyId()}`);

    if (razorpayGateway.getMockMode()) {
      throw new Error('Expected RAZORPAY_MOCK_MODE=false to run real-time Razorpay test.');
    }

    // 1. Get or create test student
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
        VALUES ('live.razorpay.student@example.com', 'dummy_hash', 'Live', 'Student', TRUE, TRUE)
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

    // 2. Prepare paid course fixture
    let instructorUser = (
      await db.query(`SELECT user_id FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];
    if (!instructorUser) {
      const insRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.live.instructor@example.com', 'dummy_hash', 'Live', 'Instructor', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructorUser = insRes.rows[0];
    }

    const courseRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Live Razorpay Test Course', 'live-razorpay-test-' || substr(md5(random()::text), 1, 8),
        FALSE, 499, 499, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price;
    `, [instructorUser.user_id]);
    const testCourse = courseRes.rows[0];

    console.log(`[SETUP] Prepared live course: "${testCourse.title}" (₹${testCourse.price})`);

    // Clean student's cart and add the course
    await cartService.clearCart(studentAuth);
    await cartService.addToCart({ courseId: testCourse.course_id }, studentAuth);

    // 3. Create real order on Razorpay live servers
    console.log('\n>>> STEP 1: Calling Razorpay Live Orders API (POST https://api.razorpay.com/v1/orders)...');
    const checkoutConfig = await paymentsService.createPaymentOrder(studentAuth);

    console.log(`  [REALTIME API SUCCESS] Razorpay Order Created!`);
    console.log(`    - Razorpay Order ID: ${checkoutConfig.orderId}`);
    console.log(`    - Amount: ${checkoutConfig.amount} paise (₹${checkoutConfig.amount / 100})`);
    console.log(`    - Currency: ${checkoutConfig.currency}`);
    console.log(`    - Receipt: ${checkoutConfig.receipt}`);
    console.log(`    - Key ID: ${checkoutConfig.keyId}`);

    if (checkoutConfig.orderId.startsWith('order_mock_')) {
      throw new Error(`FAILURE: Order was created locally as mock instead of real Razorpay API.`);
    }

    // 4. Verify order directly from Razorpay's live server
    console.log('\n>>> STEP 2: Querying Razorpay server directly (GET https://api.razorpay.com/v1/orders/:id)...');
    const liveRazorpayOrder = await razorpayGateway.fetchOrder(checkoutConfig.orderId);

    if (!liveRazorpayOrder) {
      throw new Error(`FAILURE: Order ${checkoutConfig.orderId} was not found on Razorpay's servers!`);
    }

    console.log(`  [VERIFIED ON RAZORPAY] Razorpay servers confirmed order exists:`);
    console.log(`    - Server Order ID: ${liveRazorpayOrder.id}`);
    console.log(`    - Server Status: ${liveRazorpayOrder.status}`);
    console.log(`    - Server Amount: ${liveRazorpayOrder.amount} paise`);
    console.log(`    - Server Receipt: ${liveRazorpayOrder.receipt}`);

    // 5. Test cryptographic signature verification with user's actual secret
    console.log('\n>>> STEP 3: Cryptographic HMAC-SHA256 signature verification...');
    const testPaymentId = `pay_test_${Date.now()}`;
    const validSignature = razorpayGateway.generateMockSignature(
      checkoutConfig.orderId,
      testPaymentId,
    );

    const verifyResult = await paymentsService.verifyPayment(
      {
        razorpay_order_id: checkoutConfig.orderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      },
      studentAuth,
    );

    if (verifyResult.success && verifyResult.transaction.status === 'captured') {
      console.log(`  [PASS] Signature verified cryptographically with RAZORPAY_KEY_SECRET!`);
      console.log(`  [PASS] Transaction updated to 'captured' in local PostgreSQL database.`);
    } else {
      throw new Error('FAILURE: Signature verification failed.');
    }

    // Clean up test course and cart
    await cartService.clearCart(studentAuth);
    await db.query(`DELETE FROM courses WHERE course_id = $1`, [testCourse.course_id]);

    console.log('\n================================================================');
    console.log('=== REAL-TIME RAZORPAY TEST COMPLETED WITH 100% SUCCESS! ===');
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n[FATAL ERROR]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runLiveRazorpayTest();


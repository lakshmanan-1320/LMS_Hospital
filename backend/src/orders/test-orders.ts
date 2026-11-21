import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { OrdersService } from './orders.service';
import { CartService } from '../cart/cart.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayGatewayService } from '../payments/services/razorpay-gateway.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

async function runOrdersTests() {
  console.log('================================================================');
  console.log('--- STARTING PHASE 4: ORDERS & TRANSACTIONS INTEGRATION TESTS ---');
  console.log('================================================================\n');

  // Payment tests run against the simulator, never real Razorpay. Must be set before the app
  // (and RazorpayGatewayService) is created. Real flow: create order -> verify -> checkout.
  process.env.RAZORPAY_MOCK_MODE = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ordersService = app.get(OrdersService);
  const cartService = app.get(CartService);
  const couponsService = app.get(CouponsService);
  const paymentsService = app.get(PaymentsService);
  const razorpayGateway = app.get(RazorpayGatewayService);
  const db = app.get(DatabaseService);

  let passedTests = 0;
  const totalTests = 17;

  try {
    // 0. Setup test students and admin
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
        VALUES ('test.orders.student@example.com', 'dummy_hash', 'Order', 'Student', TRUE, TRUE)
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

    // Another student for cross-access guard
    let otherStudent = (
      await db.query(`SELECT user_id, email FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];
    if (!otherStudent) {
      const u2 = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('other.orders.student@example.com', 'dummy_hash', 'Other', 'Student', TRUE, TRUE)
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
      email: 'admin.orders@example.com',
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
        VALUES ('orders.instructor@example.com', 'dummy_hash', 'Order', 'Instructor', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructor = ins.rows[0];
    }

    // Clean cart and prior enrollments for test idempotency
    await cartService.clearCart(studentAuth);
    await cartService.clearCart(otherAuth);

    // Prepare courses: Paid A (₹1000), Paid B (₹600), Free C (₹0)
    const courseARes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Next.js 15 Full Stack Mastery', 'nextjs-15-' || substr(md5(random()::text), 1, 8),
        FALSE, 1000, 1000, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructor.user_id]);
    const courseA = courseARes.rows[0];

    const courseBRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'PostgreSQL Database Engineering', 'pg-engineering-' || substr(md5(random()::text), 1, 8),
        FALSE, 600, 600, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructor.user_id]);
    const courseB = courseBRes.rows[0];

    const courseCRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Git and GitHub Crash Course', 'git-crash-' || substr(md5(random()::text), 1, 8),
        TRUE, 0, NULL, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructor.user_id]);
    const courseC = courseCRes.rows[0];

    console.log(`[SETUP] Prepared test courses:`);
    console.log(`  - Course A (Paid): ₹${courseA.price} (ID: ${courseA.course_id})`);
    console.log(`  - Course B (Paid): ₹${courseB.price} (ID: ${courseB.course_id})`);
    console.log(`  - Course C (Free): ₹0 (ID: ${courseC.course_id})\n`);

    // ==============================================================
    // TEST 1: Paid Course Checkout with Verified Payment
    // ==============================================================
    console.log('>>> TEST 1: Paid Course Checkout with Verified Payment');
    await cartService.addToCart({ courseId: courseA.course_id }, studentAuth);

    // Create payment order
    const orderConfig = await paymentsService.createPaymentOrder(studentAuth);
    const mockPayId = `pay_mock_${Date.now()}`;
    const validSig = razorpayGateway.generateMockSignature(orderConfig.orderId, mockPayId);

    // Complete checkout
    await paymentsService.verifyPayment(
      { razorpay_order_id: orderConfig.orderId, razorpay_payment_id: mockPayId, razorpay_signature: validSig },
      studentAuth,
    );
    const checkoutResult = await ordersService.checkout(
      {
        razorpay_order_id: orderConfig.orderId,
        razorpay_payment_id: mockPayId,
        razorpay_signature: validSig,
        billing_details: { studentName: 'Test Student', city: 'Bangalore' },
      },
      studentAuth,
    );

    if (
      checkoutResult.status === 'completed' &&
      checkoutResult.paymentStatus === 'paid' &&
      checkoutResult.orderNumber.startsWith('ORD-') &&
      checkoutResult.invoiceNumber.startsWith('INV-') &&
      checkoutResult.totalAmount === 1000 &&
      checkoutResult.items.length === 1 &&
      checkoutResult.items[0].courseId === courseA.course_id
    ) {
      console.log(`  [PASS] Order created: ${checkoutResult.orderNumber}, Invoice: ${checkoutResult.invoiceNumber}, Status: 'completed'`);
    } else {
      throw new Error(`Test 1 Failed: Order checkout result mismatch: ${JSON.stringify(checkoutResult)}`);
    }

    // Verify course_enrollments in DB: must be paid and active!
    const enrollmentA = await db.query(
      `SELECT enrollment_status, enrollment_type, amount_paid, order_id FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
      [studentAuth.userId, courseA.course_id],
    );
    if (
      enrollmentA.rows[0]?.enrollment_status === 'active' &&
      enrollmentA.rows[0]?.enrollment_type === 'paid' &&
      Number(enrollmentA.rows[0]?.amount_paid) === 1000 &&
      enrollmentA.rows[0]?.order_id === checkoutResult.orderId
    ) {
      console.log(`  [PASS] Course enrollment dispatched: status='active', type='paid', amount_paid=₹1000, linked to order.`);
    } else {
      throw new Error(`Test 1 Failed: Enrollment verification failed: ${JSON.stringify(enrollmentA.rows[0])}`);
    }

    // Verify cart was cleared
    const cartAfterCheckout = await cartService.getCart(studentAuth);
    if (cartAfterCheckout.items.length === 0) {
      console.log(`  [PASS] Student cart was automatically cleared.`);
      passedTests++;
    } else {
      throw new Error('Test 1 Failed: Cart was not cleared after checkout');
    }

    // ==============================================================
    // TEST 2: Checkout with Applied Coupon Discount
    // ==============================================================
    console.log('\n>>> TEST 2: Checkout with Applied Coupon Discount');
    // Create coupon: Flat ₹200 off on ₹600
    await db.query(`DELETE FROM coupons WHERE code = 'TEST_ORD_FLAT200'`);
    const couponRec = await couponsService.createCoupon({
      code: 'TEST_ORD_FLAT200',
      discount_type: 'fixed',
      discount_value: 200,
      min_order_value: 500,
    });

    await cartService.addToCart({ courseId: courseB.course_id }, studentAuth);
    await cartService.applyCoupon('TEST_ORD_FLAT200', studentAuth);

    // Course B is ₹600 - ₹200 coupon = ₹400 payable
    const orderConfigCoupon = await paymentsService.createPaymentOrder(studentAuth);
    const mockPayIdCoupon = `pay_mock_cpn_${Date.now()}`;
    const validSigCoupon = razorpayGateway.generateMockSignature(
      orderConfigCoupon.orderId,
      mockPayIdCoupon,
    );

    await paymentsService.verifyPayment(
      { razorpay_order_id: orderConfigCoupon.orderId, razorpay_payment_id: mockPayIdCoupon, razorpay_signature: validSigCoupon },
      studentAuth,
    );
    const checkoutCouponResult = await ordersService.checkout(
      {
        razorpay_order_id: orderConfigCoupon.orderId,
        razorpay_payment_id: mockPayIdCoupon,
        razorpay_signature: validSigCoupon,
      },
      studentAuth,
    );

    if (
      checkoutCouponResult.subtotal === 600 &&
      checkoutCouponResult.couponDiscount === 200 &&
      checkoutCouponResult.totalAmount === 400 &&
      checkoutCouponResult.items[0].finalPrice === 400
    ) {
      console.log(`  [PASS] Order with coupon discount created: Total ₹${checkoutCouponResult.totalAmount} (Subtotal ₹600 - Discount ₹200).`);
    } else {
      throw new Error(`Test 2 Failed: Coupon pricing mismatch: ${JSON.stringify(checkoutCouponResult)}`);
    }

    // Verify coupon usage in DB and used_count increment
    const usageCheck = await db.query(
      `SELECT * FROM coupon_usages WHERE coupon_id = $1 AND student_id = $2`,
      [couponRec.coupon_id, studentAuth.userId],
    );
    const couponCheck = await db.query(
      `SELECT used_count FROM coupons WHERE coupon_id = $1`,
      [couponRec.coupon_id],
    );
    if (usageCheck.rows.length === 1 && couponCheck.rows[0]?.used_count === 1) {
      console.log(`  [PASS] Coupon redemption recorded in coupon_usages and coupons.used_count incremented to 1.`);
      passedTests++;
    } else {
      throw new Error('Test 2 Failed: Coupon usage tracking failed');
    }

    // ==============================================================
    // TEST 3: Mixed Cart Checkout (1 Paid + 1 Free Course)
    // ==============================================================
    console.log('\n>>> TEST 3: Mixed Cart Checkout (1 Paid + 1 Free Course)');
    // Clean student enrollments for Course A and Course C to test mixed checkout
    await db.query(`DELETE FROM course_enrollments WHERE student_id = $1 AND course_id IN ($2, $3)`, [
      otherAuth.userId,
      courseA.course_id,
      courseC.course_id,
    ]);

    await cartService.addToCart({ courseId: courseA.course_id }, otherAuth); // Paid ₹1000
    await cartService.addToCart({ courseId: courseC.course_id }, otherAuth); // Free ₹0

    const mixedOrderConfig = await paymentsService.createPaymentOrder(otherAuth);
    // Paid subtotal is ₹1000 (free course is ₹0)
    const mockPayMixed = `pay_mock_mix_${Date.now()}`;
    const sigMixed = razorpayGateway.generateMockSignature(mixedOrderConfig.orderId, mockPayMixed);

    await paymentsService.verifyPayment(
      { razorpay_order_id: mixedOrderConfig.orderId, razorpay_payment_id: mockPayMixed, razorpay_signature: sigMixed },
      otherAuth,
    );
    const mixedCheckout = await ordersService.checkout(
      {
        razorpay_order_id: mixedOrderConfig.orderId,
        razorpay_payment_id: mockPayMixed,
        razorpay_signature: sigMixed,
      },
      otherAuth,
    );

    if (mixedCheckout.items.length === 2 && mixedCheckout.totalAmount === 1000) {
      const enrollA = await db.query(
        `SELECT enrollment_type, amount_paid FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
        [otherAuth.userId, courseA.course_id],
      );
      const enrollC = await db.query(
        `SELECT enrollment_type, amount_paid FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
        [otherAuth.userId, courseC.course_id],
      );

      if (
        enrollA.rows[0]?.enrollment_type === 'paid' && Number(enrollA.rows[0]?.amount_paid) === 1000 &&
        enrollC.rows[0]?.enrollment_type === 'free' && Number(enrollC.rows[0]?.amount_paid) === 0
      ) {
        console.log(`  [PASS] Mixed cart handled accurately: Paid course enrolled with type='paid' (₹1000), Free course enrolled with type='free' (₹0).`);
        passedTests++;
      } else {
        throw new Error('Test 3 Failed: Mixed enrollment types mismatch');
      }
    } else {
      throw new Error('Test 3 Failed: Mixed checkout failed');
    }

    // ==============================================================
    // TEST 4: Pure Free Cart Checkout (Zero-Payment)
    // ==============================================================
    console.log('\n>>> TEST 4: Pure Free Cart Checkout (Direct Zero-Payment)');
    // Clean enrollment for Course C for studentAuth
    await db.query(`DELETE FROM course_enrollments WHERE student_id = $1 AND course_id = $2`, [
      studentAuth.userId,
      courseC.course_id,
    ]);

    await cartService.addToCart({ courseId: courseC.course_id }, studentAuth);
    // Directly checkout with no payment parameters
    const freeCheckout = await ordersService.checkout({}, studentAuth);

    if (
      freeCheckout.totalAmount === 0 &&
      freeCheckout.paymentMethod === 'free' &&
      freeCheckout.paymentStatus === 'paid' &&
      freeCheckout.status === 'completed'
    ) {
      console.log(`  [PASS] Pure free cart checked out directly: Total ₹0, PaymentMethod 'free', Status 'completed'.`);
      passedTests++;
    } else {
      throw new Error(`Test 4 Failed: Free checkout failed: ${JSON.stringify(freeCheckout)}`);
    }

    // ==============================================================
    // TEST 5: Empty Cart Rejection
    // ==============================================================
    console.log('\n>>> TEST 5: Empty Cart Checkout Rejection');
    try {
      await ordersService.checkout({}, studentAuth);
      throw new Error('Test 5 Failed: Empty cart checkout should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('cart is empty')) {
        console.log(`  [PASS] Empty cart checkout rejected with BadRequestException.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 6: Missing Payment Details for Paid Checkout Rejection
    // ==============================================================
    console.log('\n>>> TEST 6: Missing Payment Details for Paid Checkout Rejection');
    // Prepare a new paid course D
    const courseDRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, currency, status, is_active
      )
      VALUES ($1, 'Test Course D', 'course-d-' || substr(md5(random()::text), 1, 8), FALSE, 800, 'INR', 'published', TRUE)
      RETURNING course_id;
    `, [instructor.user_id]);
    const courseD = courseDRes.rows[0];

    await cartService.addToCart({ courseId: courseD.course_id }, studentAuth);

    try {
      // Missing payment details on paid cart
      await ordersService.checkout({}, studentAuth);
      throw new Error('Test 6 Failed: Missing payment details should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('Payment verification details')) {
        console.log(`  [PASS] Paid checkout without payment credentials correctly rejected.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 7: Tampered Payment Signature Rejection on Checkout
    // ==============================================================
    console.log('\n>>> TEST 7: Tampered Payment Signature Rejection on Checkout');
    const orderDConfig = await paymentsService.createPaymentOrder(studentAuth);

    try {
      await ordersService.checkout(
        {
          razorpay_order_id: orderDConfig.orderId,
          razorpay_payment_id: 'pay_mock_fake',
          razorpay_signature: 'invalid_tampered_signature_00000000000000000000',
        },
        studentAuth,
      );
      throw new Error('Test 7 Failed: Tampered signature should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('Invalid cryptographic signature')) {
        console.log(`  [PASS] Tampered signature rejected on checkout: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 8: Duplicate Enrollment Guard on Checkout
    // ==============================================================
    console.log('\n>>> TEST 8: Duplicate Enrollment Guard on Checkout');
    // Clean cart and add Course A (which studentAuth is already enrolled in from Test 1)
    await cartService.clearCart(studentAuth);
    // Add Course A directly via DB into cart
    const cartRec = await db.query(`SELECT cart_id FROM carts WHERE student_id = $1`, [studentAuth.userId]);
    await db.query(
      `INSERT INTO cart_items (cart_id, course_id, price_at_addition) VALUES ($1, $2, 1000) ON CONFLICT DO NOTHING`,
      [cartRec.rows[0].cart_id, courseA.course_id],
    );

    try {
      await ordersService.checkout(
        {
          razorpay_order_id: orderDConfig.orderId,
          razorpay_payment_id: 'pay_mock_dup',
          razorpay_signature: razorpayGateway.generateMockSignature(orderDConfig.orderId, 'pay_mock_dup'),
        },
        studentAuth,
      );
      throw new Error('Test 8 Failed: Already enrolled course should throw ConflictException');
    } catch (err: any) {
      if (err instanceof ConflictException && err.message.includes('already actively enrolled')) {
        console.log(`  [PASS] Duplicate course checkout correctly blocked with ConflictException.`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // Clean cart
    await cartService.clearCart(studentAuth);

    // ==============================================================
    // TEST 9: Invoice Retrieval (GET /orders/:id/invoice)
    // ==============================================================
    console.log('\n>>> TEST 9: Invoice Retrieval (GET /orders/:id/invoice)');
    const invoice = await ordersService.getInvoice(checkoutResult.orderNumber, studentAuth);

    if (
      invoice.invoiceNumber === checkoutResult.invoiceNumber &&
      invoice.orderNumber === checkoutResult.orderNumber &&
      invoice.pricing.totalAmount === 1000 &&
      invoice.items.length === 1 &&
      invoice.seller.name.includes('Elevate Learning') &&
      invoice.student.userId === studentAuth.userId
    ) {
      console.log(`  [PASS] Invoice generated and verified: ${invoice.invoiceNumber} for Order ${invoice.orderNumber}. Total: ₹${invoice.pricing.totalAmount}`);
      passedTests++;
    } else {
      throw new Error(`Test 9 Failed: Invoice data mismatch: ${JSON.stringify(invoice)}`);
    }

    // ==============================================================
    // TEST 10: Student Order History Retrieval (GET /orders)
    // ==============================================================
    console.log('\n>>> TEST 10: Student Order History Retrieval (GET /orders)');
    const studentOrders = await ordersService.listStudentOrders(studentAuth, { limit: 10, offset: 0 });

    if (studentOrders.total >= 2 && studentOrders.items.length >= 2) {
      console.log(`  [PASS] Student order history retrieved: ${studentOrders.total} total orders.`);
      passedTests++;
    } else {
      throw new Error(`Test 10 Failed: Expected at least 2 orders for student, got ${studentOrders.total}`);
    }

    // ==============================================================
    // TEST 11: Admin Order Listing (GET /orders/admin/all)
    // ==============================================================
    console.log('\n>>> TEST 11: Admin Order Listing (GET /orders/admin/all)');
    const allOrders = await ordersService.listAllOrders({ limit: 50, offset: 0 });

    if (allOrders.total >= 3 && allOrders.items.length >= 3) {
      console.log(`  [PASS] Admin order listing retrieved: ${allOrders.total} platform orders.`);
      passedTests++;
    } else {
      throw new Error(`Test 11 Failed: Expected platform orders, got ${allOrders.total}`);
    }

    // ==============================================================
    // TEST 12: Cross-Student Order Access Guard
    // ==============================================================
    console.log('\n>>> TEST 12: Cross-Student Order Access Guard');
    try {
      // otherAuth tries to view studentAuth's order
      await ordersService.getOrderDetails(checkoutResult.orderNumber, otherAuth);
      throw new Error('Test 12 Failed: Cross-student order access should throw ForbiddenException');
    } catch (err: any) {
      if (err instanceof ForbiddenException) {
        console.log(`  [PASS] Unauthorized cross-student access blocked with ForbiddenException.`);
        passedTests++;
      } else {
        throw err;
      }
    }


    // ==============================================================
    // TESTS 13-17: Role-independent purchasing + verified-payment rules
    // ==============================================================
    const mkCourse = async (title: string, price: number) =>
      (
        await db.query(
          `INSERT INTO courses (instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active)
           VALUES ($1, $2, 'buy-test-' || substr(md5(random()::text), 1, 10), FALSE, $3, $3, 'INR', 'published', TRUE)
           RETURNING course_id, title, price`,
          [instructor.user_id, title, price],
        )
      ).rows[0];
    const courseE = await mkCourse('Buy Test E', 500);
    const courseF = await mkCourse('Buy Test F', 300);
    const courseG = await mkCourse('Buy Test G', 500);

    // An INSTRUCTOR (not a student) buying another instructor's course
    const instructorBuyer: AuthenticatedUser = { ...otherAuth, roles: ['INSTRUCTOR'] };
    await cartService.clearCart(instructorBuyer);
    await db.query(`DELETE FROM course_enrollments WHERE student_id = $1 AND course_id IN ($2, $3, $4)`, [
      instructorBuyer.userId,
      courseE.course_id,
      courseF.course_id,
      courseG.course_id,
    ]);
    await cartService.addToCart({ courseId: courseE.course_id }, instructorBuyer);
    const payE = await paymentsService.createPaymentOrder(instructorBuyer);
    const payEId = `pay_mock_buyE_${Date.now()}`;
    const sigE = razorpayGateway.generateMockSignature(payE.orderId, payEId);
    const payEDto = { razorpay_order_id: payE.orderId, razorpay_payment_id: payEId, razorpay_signature: sigE };

    console.log('\n>>> TEST 13: Valid signature but unverified payment is rejected');
    try {
      await ordersService.checkout(payEDto, instructorBuyer);
      throw new Error('Test 13 Failed: unverified payment should not grant access');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('not been verified')) {
        console.log(`  [PASS] Unverified payment rejected: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    console.log('\n>>> TEST 14: Cart changed after payment is rejected (pay for ₹500, add ₹300 more)');
    await paymentsService.verifyPayment(payEDto, instructorBuyer);
    await cartService.addToCart({ courseId: courseF.course_id }, instructorBuyer);
    try {
      await ordersService.checkout(payEDto, instructorBuyer);
      throw new Error('Test 14 Failed: payment for a smaller cart should not cover a bigger cart');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('cart changed')) {
        console.log(`  [PASS] Amount mismatch rejected: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    console.log("\n>>> TEST 15: INSTRUCTOR buys another instructor's course with a verified payment");
    await cartService.removeFromCart(courseF.course_id, instructorBuyer);
    const instructorOrder = await ordersService.checkout(payEDto, instructorBuyer);
    const instructorEnrollment = await db.query(
      `SELECT enrollment_status FROM course_enrollments WHERE student_id = $1 AND course_id = $2`,
      [instructorBuyer.userId, courseE.course_id],
    );
    if (instructorOrder.totalAmount === 500 && instructorEnrollment.rows[0]?.enrollment_status === 'active') {
      console.log(`  [PASS] Instructor purchase completed: ${instructorOrder.orderNumber}, enrollment active.`);
      passedTests++;
    } else {
      throw new Error(`Test 15 Failed: ${JSON.stringify({ instructorOrder, e: instructorEnrollment.rows })}`);
    }

    console.log('\n>>> TEST 16: Same verified payment cannot be reused for a second order');
    await cartService.addToCart({ courseId: courseG.course_id }, instructorBuyer); // also ₹500
    try {
      await ordersService.checkout(payEDto, instructorBuyer);
      throw new Error('Test 16 Failed: payment replay should be rejected');
    } catch (err: any) {
      if (err instanceof ConflictException && err.message.includes('already been used')) {
        console.log(`  [PASS] Payment replay rejected: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }
    await cartService.clearCart(instructorBuyer);

    console.log('\n>>> TEST 17: Instructor cannot buy their own course');
    const ownerAuth: AuthenticatedUser = {
      userId: instructor.user_id,
      email: 'owner.instructor@example.com',
      roles: ['INSTRUCTOR'],
      permissions: [],
    };
    try {
      await cartService.addToCart({ courseId: courseE.course_id }, ownerAuth);
      throw new Error('Test 17 Failed: own course should be rejected');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('your own course')) {
        console.log(`  [PASS] Own-course purchase rejected: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // Clean test courses, enrollments, and orders
    await cartService.clearCart(studentAuth);
    await cartService.clearCart(otherAuth);
    await db.query(`DELETE FROM coupons WHERE code LIKE 'TEST_%'`);
    await db.query(`DELETE FROM course_enrollments WHERE course_id IN ($1, $2, $3, $4, $5, $6, $7)`, [
      courseA.course_id,
      courseB.course_id,
      courseC.course_id,
      courseD.course_id,
      courseE.course_id,
      courseF.course_id,
      courseG.course_id,
    ]);
    await db.query(`DELETE FROM order_items WHERE course_id IN ($1, $2, $3, $4, $5, $6, $7)`, [
      courseA.course_id,
      courseB.course_id,
      courseC.course_id,
      courseD.course_id,
      courseE.course_id,
      courseF.course_id,
      courseG.course_id,
    ]);
    await db.query(`DELETE FROM courses WHERE course_id IN ($1, $2, $3, $4, $5, $6, $7)`, [
      courseA.course_id,
      courseB.course_id,
      courseC.course_id,
      courseD.course_id,
      courseE.course_id,
      courseF.course_id,
      courseG.course_id,
    ]);

    console.log('\n================================================================');
    console.log(`=== ALL ${passedTests}/${totalTests} PHASE 4 INTEGRATION TESTS PASSED SUCCESSFULLY! ===`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n[FATAL TEST FAILURE]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runOrdersTests();

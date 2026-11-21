import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CouponsService } from './coupons.service';
import { CartService } from '../cart/cart.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { BadRequestException, NotFoundException } from '@nestjs/common';

async function runCouponsTests() {
  console.log('================================================================');
  console.log('--- STARTING PHASE 2: COUPONS & DISCOUNTS INTEGRATION TESTS ---');
  console.log('================================================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const couponsService = app.get(CouponsService);
  const cartService = app.get(CartService);
  const db = app.get(DatabaseService);

  let passedTests = 0;
  let totalTests = 12;

  try {
    // 0. Setup test users (Student and Admin)
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
        VALUES ('test.coupon.student@example.com', 'dummy_hash', 'Coupon', 'Student', TRUE, TRUE)
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

    const adminAuth: AuthenticatedUser = {
      userId: studentUser.user_id,
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: [],
    };

    // Clean previous cart and test coupons for reproducibility
    await db.query(`DELETE FROM coupons WHERE code LIKE 'TEST_%'`);
    const existingCart = await db.query(`SELECT cart_id FROM carts WHERE student_id = $1`, [
      studentAuth.userId,
    ]);
    if (existingCart.rows[0]) {
      await db.query(`DELETE FROM cart_items WHERE cart_id = $1`, [existingCart.rows[0].cart_id]);
      await db.query(`UPDATE carts SET applied_coupon_id = NULL WHERE cart_id = $1`, [
        existingCart.rows[0].cart_id,
      ]);
    }

    // Prepare courses: Paid Course 1 (₹1000), Paid Course 2 (₹600), Free Course (₹0)
    let instructorUser = (
      await db.query(`SELECT user_id FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];

    if (!instructorUser) {
      const insRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.instructor.coupon@example.com', 'dummy_hash', 'Coupon', 'Instructor', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructorUser = insRes.rows[0];
    }

    // Paid Course A: ₹1000
    const courseARes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Test React Advanced', 'test-react-adv-' || substr(md5(random()::text), 1, 8),
        FALSE, 1000, 1000, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructorUser.user_id]);
    const courseA = courseARes.rows[0];

    // Paid Course B: ₹600
    const courseBRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Test Node Microservices', 'test-node-micro-' || substr(md5(random()::text), 1, 8),
        FALSE, 600, 600, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructorUser.user_id]);
    const courseB = courseBRes.rows[0];

    // Free Course C: ₹0
    const courseCRes = await db.query(`
      INSERT INTO courses (
        instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
      )
      VALUES (
        $1, 'Test Git Fundamentals Free', 'test-git-free-' || substr(md5(random()::text), 1, 8),
        TRUE, 0, NULL, 'INR', 'published', TRUE
      )
      RETURNING course_id, title, price, is_free;
    `, [instructorUser.user_id]);
    const courseC = courseCRes.rows[0];

    console.log(`[SETUP DONE] Prepared test courses:`);
    console.log(`  - Course A (Paid): ₹${courseA.price} (ID: ${courseA.course_id})`);
    console.log(`  - Course B (Paid): ₹${courseB.price} (ID: ${courseB.course_id})`);
    console.log(`  - Course C (Free): ₹0 (ID: ${courseC.course_id})\n`);

    // ==============================================================
    // TEST 1: Admin creates percentage coupon with discount cap
    // ==============================================================
    console.log('>>> TEST 1: Admin creates percentage coupon with max cap');
    const percentCoupon = await couponsService.createCoupon(
      {
        code: 'TEST_SAVE20',
        description: '20% off up to ₹250 on orders above ₹800',
        discount_type: 'percentage',
        discount_value: 20,
        min_order_value: 800,
        max_discount_amount: 250,
        usage_limit: 100,
        per_user_limit: 1,
      },
      adminAuth,
    );
    if (
      percentCoupon.code === 'TEST_SAVE20' &&
      Number(percentCoupon.discount_value) === 20 &&
      Number(percentCoupon.max_discount_amount) === 250 &&
      Number(percentCoupon.min_order_value) === 800
    ) {
      console.log(`  [PASS] Percentage coupon created: ${percentCoupon.code} (20% cap ₹250, min ₹800)`);
      passedTests++;
    } else {
      throw new Error('Test 1 Failed: Percentage coupon mismatch');
    }

    // ==============================================================
    // TEST 2: Admin creates fixed amount coupon
    // ==============================================================
    console.log('\n>>> TEST 2: Admin creates fixed amount coupon');
    const fixedCoupon = await couponsService.createCoupon(
      {
        code: 'TEST_FLAT150',
        description: 'Flat ₹150 off on orders above ₹500',
        discount_type: 'fixed',
        discount_value: 150,
        min_order_value: 500,
        usage_limit: 50,
        per_user_limit: 2,
      },
      adminAuth,
    );
    if (
      fixedCoupon.code === 'TEST_FLAT150' &&
      Number(fixedCoupon.discount_value) === 150 &&
      Number(fixedCoupon.min_order_value) === 500
    ) {
      console.log(`  [PASS] Fixed coupon created: ${fixedCoupon.code} (Flat ₹150 off, min ₹500)`);
      passedTests++;
    } else {
      throw new Error('Test 2 Failed: Fixed coupon mismatch');
    }

    // ==============================================================
    // TEST 3: Validation fails for non-existent coupon (404)
    // ==============================================================
    console.log('\n>>> TEST 3: Validation fails for non-existent coupon');
    try {
      await couponsService.validateCoupon('DOES_NOT_EXIST', 1000, studentAuth.userId);
      throw new Error('Test 3 Failed: Non-existent coupon should have thrown NotFoundException');
    } catch (err: any) {
      if (err instanceof NotFoundException) {
        console.log(`  [PASS] Correctly rejected with NotFoundException: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 4: Validation fails for expired coupon (400)
    // ==============================================================
    console.log('\n>>> TEST 4: Validation fails for expired coupon');
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expiredCoupon = await couponsService.createCoupon({
      code: 'TEST_EXPIRED',
      discount_type: 'fixed',
      discount_value: 50,
      valid_from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      valid_until: pastDate.toISOString(),
    });

    try {
      await couponsService.validateCoupon(expiredCoupon.code, 1000, studentAuth.userId);
      throw new Error('Test 4 Failed: Expired coupon should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('expired')) {
        console.log(`  [PASS] Correctly rejected expired coupon: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 5: Validation fails when cart amount < min_order_value (400)
    // ==============================================================
    console.log('\n>>> TEST 5: Validation fails when cart amount < min_order_value');
    try {
      // TEST_SAVE20 requires min ₹800; passing ₹600
      await couponsService.validateCoupon('TEST_SAVE20', 600, studentAuth.userId);
      throw new Error('Test 5 Failed: Under-minimum cart amount should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('minimum cart amount')) {
        console.log(`  [PASS] Correctly rejected under-minimum amount: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 6: Per-user redemption limit enforcement
    // ==============================================================
    console.log('\n>>> TEST 6: Per-user redemption limit enforcement');
    // TEST_SAVE20 has per_user_limit: 1. Let's record 1 mock usage and test validation.
    await db.query(
      `INSERT INTO coupon_usages (coupon_id, student_id, discount_amount, used_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [percentCoupon.coupon_id, studentAuth.userId, 200],
    );

    try {
      await couponsService.validateCoupon('TEST_SAVE20', 1000, studentAuth.userId);
      throw new Error('Test 6 Failed: Reached per-user limit should have thrown BadRequestException');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('maximum number of times allowed')) {
        console.log(`  [PASS] Correctly rejected when user limit reached: "${err.message}"`);
        passedTests++;
      } else {
        throw err;
      }
    }
    // Clean mock usage so TEST_SAVE20 can be used in subsequent tests
    await db.query(`DELETE FROM coupon_usages WHERE coupon_id = $1`, [percentCoupon.coupon_id]);

    // ==============================================================
    // TEST 7: Apply percentage coupon to student cart & verify max cap
    // ==============================================================
    console.log('\n>>> TEST 7: Apply percentage coupon to student cart & verify max discount cap');
    // Add Course A (₹1000) and Course B (₹600) -> total paid = ₹1600
    await cartService.addToCart({ courseId: courseA.course_id }, studentAuth);
    await cartService.addToCart({ courseId: courseB.course_id }, studentAuth);

    // TEST_SAVE20: 20% of ₹1600 is ₹320, but max_discount_amount is ₹250!
    // Expected discount = ₹250, Total = ₹1600 - ₹250 = ₹1350
    const cartWithPercent = await cartService.applyCoupon('TEST_SAVE20', studentAuth);
    const summaryPercent = cartWithPercent.summary;

    if (
      summaryPercent.couponDiscount === 250 &&
      summaryPercent.total === 1350 &&
      summaryPercent.appliedCoupon?.code === 'TEST_SAVE20'
    ) {
      console.log(`  [PASS] 20% coupon capped at ₹250. Subtotal: ₹1600, Total: ₹1350, Discount: ₹${summaryPercent.couponDiscount}`);
      passedTests++;
    } else {
      throw new Error(
        `Test 7 Failed: Expected couponDiscount=250, total=1350. Got discount=${summaryPercent.couponDiscount}, total=${summaryPercent.total}`,
      );
    }

    // ==============================================================
    // TEST 8: Apply fixed coupon & verify exact reduction
    // ==============================================================
    console.log('\n>>> TEST 8: Apply fixed coupon (FLAT150) to student cart');
    // Overriding coupon with TEST_FLAT150 (Flat ₹150 off on ₹1600 -> Total = ₹1450)
    const cartWithFixed = await cartService.applyCoupon('TEST_FLAT150', studentAuth);
    const summaryFixed = cartWithFixed.summary;

    if (
      summaryFixed.couponDiscount === 150 &&
      summaryFixed.total === 1450 &&
      summaryFixed.appliedCoupon?.code === 'TEST_FLAT150'
    ) {
      console.log(`  [PASS] Fixed coupon applied. Subtotal: ₹1600, Discount: ₹150, Payable Total: ₹1450`);
      passedTests++;
    } else {
      throw new Error(
        `Test 8 Failed: Expected couponDiscount=150, total=1450. Got discount=${summaryFixed.couponDiscount}, total=${summaryFixed.total}`,
      );
    }

    // ==============================================================
    // TEST 9: Free course isolation (free courses don't inflate discount or satisfy min_order_value)
    // ==============================================================
    console.log('\n>>> TEST 9: Free course isolation with coupons');
    // Add Course C (Free ₹0)
    const cartWithFree = await cartService.addToCart({ courseId: courseC.course_id }, studentAuth);
    // Free course added: paidSubtotal should still be exactly 1600, and couponDiscount remains 150
    if (
      cartWithFree.summary.paidSubtotal === 1600 &&
      cartWithFree.summary.couponDiscount === 150 &&
      cartWithFree.summary.total === 1450 &&
      cartWithFree.summary.hasFreeCourses === true
    ) {
      console.log(`  [PASS] Free course isolated: paidSubtotal is ₹1600, discount is ₹150, free courses not discounted.`);
      passedTests++;
    } else {
      throw new Error('Test 9 Failed: Free course incorrectly affected coupon calculation');
    }

    // Also verify pure free cart rejects coupon application
    await cartService.clearCart(studentAuth);
    await cartService.addToCart({ courseId: courseC.course_id }, studentAuth);
    try {
      await cartService.applyCoupon('TEST_FLAT150', studentAuth);
      throw new Error('Pure free cart should not accept coupons');
    } catch (err: any) {
      if (err instanceof BadRequestException && err.message.includes('paid courses')) {
        console.log(`  [PASS] Pure free cart correctly rejected coupon application: "${err.message}"`);
        // We'll count this as part of Test 9
      } else {
        throw err;
      }
    }

    // ==============================================================
    // TEST 10: Auto-removal / dynamic invalidation when paidSubtotal < min_order_value
    // ==============================================================
    console.log('\n>>> TEST 10: Dynamic coupon auto-removal when items removed below min_order_value');
    // Add Course A (₹1000) and Course B (₹600)
    await cartService.clearCart(studentAuth);
    await cartService.addToCart({ courseId: courseA.course_id }, studentAuth);
    await cartService.addToCart({ courseId: courseB.course_id }, studentAuth);
    // Apply TEST_SAVE20 (min_order_value: 800)
    await cartService.applyCoupon('TEST_SAVE20', studentAuth);

    // Now remove Course A (₹1000). Remaining in cart: Course B (₹600).
    // ₹600 < ₹800 (min_order_value), so coupon must be automatically invalidated & detached!
    const cartAfterRemoval = await cartService.removeFromCart(courseA.course_id, studentAuth);
    if (
      cartAfterRemoval.summary.appliedCoupon === null &&
      cartAfterRemoval.summary.couponDiscount === 0 &&
      cartAfterRemoval.summary.total === 600
    ) {
      console.log(`  [PASS] Coupon automatically detached because paidSubtotal (₹600) dropped below min_order_value (₹800).`);
      passedTests++;
    } else {
      throw new Error(
        `Test 10 Failed: Coupon was not auto-detached. appliedCoupon=${JSON.stringify(cartAfterRemoval.summary.appliedCoupon)}`,
      );
    }

    // ==============================================================
    // TEST 11: Remove coupon from cart manually (DELETE /cart/coupon)
    // ==============================================================
    console.log('\n>>> TEST 11: Manual coupon removal from cart');
    // Re-add Course A (total = ₹1600) and apply TEST_FLAT150 (payable total = ₹1450)
    await cartService.addToCart({ courseId: courseA.course_id }, studentAuth);
    await cartService.applyCoupon('TEST_FLAT150', studentAuth);

    // Call removeCoupon
    const cartAfterManualRemove = await cartService.removeCoupon(studentAuth);
    if (
      cartAfterManualRemove.summary.appliedCoupon === null &&
      cartAfterManualRemove.summary.couponDiscount === 0 &&
      cartAfterManualRemove.summary.total === 1600
    ) {
      console.log(`  [PASS] Coupon manually removed. Payable total restored from ₹1450 to original ₹1600.`);
      passedTests++;
    } else {
      throw new Error('Test 11 Failed: Manual coupon removal did not restore total.');
    }

    // ==============================================================
    // TEST 12: Coupon admin management (list, update, delete)
    // ==============================================================
    console.log('\n>>> TEST 12: Admin coupon management (list, update, delete)');
    // List
    const listRes = await couponsService.listCoupons({ search: 'TEST_' });
    if (listRes.total < 2) {
      throw new Error(`Test 12 Failed: Expected at least 2 coupons, got ${listRes.total}`);
    }

    // Update
    const updated = await couponsService.updateCoupon(percentCoupon.coupon_id, {
      description: 'Updated 20% discount description',
      is_active: false,
    });
    if (!updated || updated.is_active !== false) {
      throw new Error('Test 12 Failed: Coupon update failed');
    }

    // Delete
    const deleted = await couponsService.deleteCoupon(percentCoupon.coupon_id);
    if (!deleted) {
      throw new Error('Test 12 Failed: Coupon delete failed');
    }

    console.log(`  [PASS] Admin list, update (deactivated), and delete succeeded.`);
    passedTests++;

    // Clean up test fixtures
    await cartService.clearCart(studentAuth);
    await db.query(`DELETE FROM coupons WHERE code LIKE 'TEST_%'`);
    await db.query(`DELETE FROM courses WHERE course_id IN ($1, $2, $3)`, [
      courseA.course_id,
      courseB.course_id,
      courseC.course_id,
    ]);

    console.log('\n================================================================');
    console.log(`=== ALL ${passedTests}/${totalTests} PHASE 2 INTEGRATION TESTS PASSED SUCCESSFULLY! ===`);
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n[FATAL TEST FAILURE]:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runCouponsTests();


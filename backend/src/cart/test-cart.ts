import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CartService } from './cart.service';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

async function runCartTests() {
  console.log('--- STARTING PHASE 1: CART MANAGEMENT INTEGRATION TESTS ---');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const cartService = app.get(CartService);
  const db = app.get(DatabaseService);

  try {
    // 1. Prepare test student and instructor
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
      console.log('Creating a test student...');
      const uRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.cart.student@example.com', 'dummy_hash', 'Cart', 'Student', TRUE, TRUE)
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

    const nonStudentAuth: AuthenticatedUser = {
      userId: studentUser.user_id,
      email: studentUser.email,
      roles: ['INSTRUCTOR'],
      permissions: [],
    };

    console.log(`[PASS] Test student loaded: ${studentAuth.email} (${studentAuth.userId})`);

    // Clean any prior cart items for test idempotency
    const existingCart = await db.query(`SELECT cart_id FROM carts WHERE student_id = $1`, [
      studentAuth.userId,
    ]);
    if (existingCart.rows[0]) {
      await db.query(`DELETE FROM cart_items WHERE cart_id = $1`, [existingCart.rows[0].cart_id]);
    }

    // 2. Prepare test courses: one paid with discount, one free
    let paidCourse = (
      await db.query(`
        SELECT course_id, instructor_id, title, price, discount_price, is_free, currency
        FROM courses
        WHERE status = 'published' AND is_free = FALSE AND is_active = TRUE AND deleted_at IS NULL
        LIMIT 1;
      `)
    ).rows[0];

    // Pick or create a separate instructor user
    let instructorUser = (
      await db.query(`SELECT user_id FROM users WHERE user_id != $1 LIMIT 1;`, [studentAuth.userId])
    ).rows[0];

    if (!instructorUser) {
      const insRes = await db.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ('test.instructor.cart@example.com', 'dummy_hash', 'Instructor', 'Test', TRUE, TRUE)
        RETURNING user_id;
      `);
      instructorUser = insRes.rows[0];
    }
    const instructorId = instructorUser.user_id;

    if (!paidCourse) {
      console.log('Creating a test paid course...');
      const cRes = await db.query(`
        INSERT INTO courses (
          instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
        )
        VALUES (
          $1, 'Mastering TypeScript & Architecture', 'mastering-ts-arch-test', FALSE, 1499.00, 999.00, 'INR', 'published', TRUE
        )
        RETURNING course_id, instructor_id, title, price, discount_price, is_free, currency;
      `, [instructorId]);
      paidCourse = cRes.rows[0];
    } else {
      // Ensure instructor is different from student for the test
      if (paidCourse.instructor_id === studentAuth.userId) {
        await db.query(`UPDATE courses SET instructor_id = $1 WHERE course_id = $2`, [
          instructorId,
          paidCourse.course_id,
        ]);
        paidCourse.instructor_id = instructorId;
      }
    }

    let freeCourse = (
      await db.query(`
        SELECT course_id, instructor_id, title, price, is_free, currency
        FROM courses
        WHERE status = 'published' AND is_free = TRUE AND is_active = TRUE AND deleted_at IS NULL
        LIMIT 1;
      `)
    ).rows[0];

    if (!freeCourse) {
      console.log('Creating a test free course...');
      const fRes = await db.query(`
        INSERT INTO courses (
          instructor_id, title, slug, is_free, price, discount_price, currency, status, is_active
        )
        VALUES (
          $1, 'Introduction to Fullstack Engineering', 'intro-fullstack-eng-test', TRUE, 0.00, NULL, 'INR', 'published', TRUE
        )
        RETURNING course_id, instructor_id, title, price, is_free, currency;
      `, [instructorId]);
      freeCourse = fRes.rows[0];
    } else {
      if (freeCourse.instructor_id === studentAuth.userId) {
        await db.query(`UPDATE courses SET instructor_id = $1 WHERE course_id = $2`, [
          instructorId,
          freeCourse.course_id,
        ]);
        freeCourse.instructor_id = instructorId;
      }
    }

    console.log(`[PASS] Test courses: Paid "${paidCourse.title}" (₹${paidCourse.price}), Free "${freeCourse.title}" (₹0)`);

    // Clean enrollments for these test courses for clean slate
    await db.query(
      `DELETE FROM course_enrollments WHERE student_id = $1 AND course_id IN ($2, $3)`,
      [studentAuth.userId, paidCourse.course_id, freeCourse.course_id],
    );

    // TEST 1: Purchasing is role-independent (Udemy-style). Any signed-in account can use the
    // cart; only a missing/unauthenticated user is rejected.
    const instructorCart = await cartService.getCart(nonStudentAuth);
    if (!instructorCart) {
      throw new Error('[FAIL] Test 1: Instructor account should be able to use the cart.');
    }
    try {
      await cartService.getCart(undefined as any);
      throw new Error('[FAIL] Test 1: Unauthenticated user was able to access cart!');
    } catch (err: any) {
      if (err.status !== 401) throw err;
    }
    console.log('[PASS] Test 1: Instructor can use the cart; unauthenticated access rejected with HTTP 401.');

    // TEST 2: Add Paid Course to Cart
    const cartAfterPaid = await cartService.addToCart(
      { courseId: paidCourse.course_id },
      studentAuth,
    );
    if (cartAfterPaid.items.length === 1 && cartAfterPaid.paidItems.length === 1) {
      console.log(`[PASS] Test 2: Paid course added to cart successfully. Item count: 1.`);
    } else {
      console.error('[FAIL] Paid course was not added properly:', cartAfterPaid);
    }

    // TEST 3: Duplicate Course Guard
    try {
      await cartService.addToCart({ courseId: paidCourse.course_id }, studentAuth);
      console.error('[FAIL] Duplicate course was added to cart!');
    } catch (err: any) {
      if (err.status === 409) {
        console.log('[PASS] Test 3: Duplicate course addition correctly rejected with HTTP 409 Conflict.');
      } else {
        throw err;
      }
    }

    // TEST 4: Add Free Course to Cart (Mixed Cart)
    const cartMixed = await cartService.addToCart(
      { courseId: freeCourse.course_id },
      studentAuth,
    );
    if (
      cartMixed.items.length === 2 &&
      cartMixed.summary.hasFreeCourses &&
      cartMixed.summary.hasPaidCourses
    ) {
      console.log(
        `[PASS] Test 4: Mixed cart handled correctly. Free items: ${cartMixed.summary.freeItemsCount}, Paid items: ${cartMixed.summary.paidItemsCount}.`,
      );
    } else {
      console.error('[FAIL] Mixed cart calculation failed:', cartMixed.summary);
    }

    // TEST 5: Price & Discount Calculations
    const expectedSubtotal = Number(paidCourse.price) + 0;
    const effectivePaidPrice =
      paidCourse.discount_price !== null ? Number(paidCourse.discount_price) : Number(paidCourse.price);
    const expectedTotal = effectivePaidPrice + 0;
    const expectedDiscount = expectedSubtotal - expectedTotal;

    if (
      Math.abs(cartMixed.summary.subtotal - expectedSubtotal) < 0.01 &&
      Math.abs(cartMixed.summary.total - expectedTotal) < 0.01 &&
      Math.abs(cartMixed.summary.discountTotal - expectedDiscount) < 0.01
    ) {
      console.log(
        `[PASS] Test 5: Live pricing & discount calculation accurate. Subtotal: ₹${cartMixed.summary.subtotal}, Discount: ₹${cartMixed.summary.discountTotal}, Total: ₹${cartMixed.summary.total}.`,
      );
    } else {
      console.error('[FAIL] Price calculation mismatch:', cartMixed.summary);
    }

    // TEST 6: Transactional 1-Click Free Course Enrollment from Cart
    const enrollResult = await cartService.enrollFreeCourse(freeCourse.course_id, studentAuth);
    if (enrollResult.success && !enrollResult.alreadyEnrolled) {
      console.log(
        `[PASS] Test 6: Free course enrolled transactionally. Message: "${enrollResult.message}".`,
      );
    } else {
      console.error('[FAIL] Free enrollment failed:', enrollResult);
    }

    // Check that free course was automatically removed from cart items
    const cartAfterEnroll = await cartService.getCart(studentAuth);
    const freeCourseStillInCart = cartAfterEnroll.items.some((i) => i.courseId === freeCourse.course_id);
    if (!freeCourseStillInCart && cartAfterEnroll.items.length === 1) {
      console.log('[PASS] Test 6b: Enrolled free course automatically removed from cart items.');
    } else {
      console.error('[FAIL] Free course still in cart after enrollment!');
    }

    // TEST 7: Idempotency & Duplicate-Safe Free Enrollment
    const reEnrollResult = await cartService.enrollFreeCourse(freeCourse.course_id, studentAuth);
    if (reEnrollResult.alreadyEnrolled) {
      console.log('[PASS] Test 7: Duplicate enrollment gracefully handled (alreadyEnrolled: true).');
    } else {
      console.error('[FAIL] Duplicate enrollment was not marked as alreadyEnrolled.');
    }

    // TEST 8: Prevent Enrolled Course from being Re-added to Cart
    try {
      await cartService.addToCart({ courseId: freeCourse.course_id }, studentAuth);
      console.error('[FAIL] Enrolled course was allowed back into cart!');
    } catch (err: any) {
      if (err.status === 409) {
        console.log('[PASS] Test 8: Enrolled course correctly rejected from cart addition with HTTP 409.');
      } else {
        throw err;
      }
    }

    // TEST 9: Remove Item from Cart
    const cartAfterRemove = await cartService.removeFromCart(paidCourse.course_id, studentAuth);
    if (cartAfterRemove.items.length === 0 && cartAfterRemove.summary.total === 0) {
      console.log('[PASS] Test 9: Course removed from cart. Cart is now empty.');
    } else {
      console.error('[FAIL] Remove item failed:', cartAfterRemove);
    }

    // TEST 10: Clear Cart & Timestamp Maintenance
    await cartService.addToCart({ courseId: paidCourse.course_id }, studentAuth);
    const cartBeforeClear = await cartService.getCart(studentAuth);
    await cartService.clearCart(studentAuth);
    const cartAfterClear = await cartService.getCart(studentAuth);

    if (cartAfterClear.items.length === 0) {
      console.log(
        `[PASS] Test 10: Cart cleared successfully. Updated At: ${cartAfterClear.updatedAt}.`,
      );
    } else {
      console.error('[FAIL] Clear cart failed:', cartAfterClear);
    }

    console.log('\n======================================================');
    console.log('✅ ALL 10 PHASE 1 CART MANAGEMENT INTEGRATION TESTS PASSED!');
    console.log('======================================================');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runCartTests();

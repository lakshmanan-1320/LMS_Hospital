/**
 * Comprehensive End-to-End Automated Test Suite for Reviews & Ratings Module
 * Run with: npx tsx backend/src/reviews/test-reviews.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lms_db',
});

// Mock DatabaseService
const db = {
  query: async <T = any>(text: string, params?: any[]) => {
    return pool.query<T>(text, params);
  },
};

// Import services & repository
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

const reviewsRepo = new ReviewsRepository(db as any);
const reviewsService = new ReviewsService(reviewsRepo);

async function runTests() {
  console.log('====================================================');
  console.log('   REVIEWS & RATINGS MODULE - AUTOMATED TEST SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  // 1. Fixtures Setup
  console.log('1. Setting up test fixtures (users, course, section, lesson)...');

  // Helper to get or create a user
  async function getOrCreateUser(email: string, firstName: string, lastName: string, roleName: string) {
    let res = await db.query(`SELECT user_id FROM users WHERE email = $1`, [email]);
    let userId: string;
    if (res.rows.length === 0) {
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, is_active)
         VALUES ($1, 'testhash', $2, $3, TRUE) RETURNING user_id`,
        [email, firstName, lastName],
      );
      userId = ins.rows[0].user_id;
    } else {
      userId = res.rows[0].user_id;
    }

    // Assign role
    const roleRes = await db.query(`SELECT role_id FROM roles WHERE name = $1`, [roleName]);
    if (roleRes.rows.length > 0) {
      await db.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, roleRes.rows[0].role_id],
      );
    }

    return {
      userId,
      email,
      firstName,
      lastName,
      roles: [roleName],
      permissions: [],
    };
  }

  const instructorUser = await getOrCreateUser(
    'review_instructor@test.com',
    'Alice',
    'Instructor',
    'INSTRUCTOR',
  );
  instructorUser.permissions = ['reviews:reply', 'courses:create', 'courses:edit_own'];

  const otherInstructorUser = await getOrCreateUser(
    'other_instructor@test.com',
    'Dave',
    'Other',
    'INSTRUCTOR',
  );
  otherInstructorUser.permissions = ['reviews:reply'];

  const studentA = await getOrCreateUser(
    'student_review_a@test.com',
    'Bob',
    'Learner',
    'STUDENT',
  );
  studentA.permissions = ['reviews:create'];

  const studentB = await getOrCreateUser(
    'student_review_b@test.com',
    'Charlie',
    'Scholar',
    'STUDENT',
  );
  studentB.permissions = ['reviews:create'];

  const adminUser = await getOrCreateUser(
    'admin_review_moderator@test.com',
    'Super',
    'Admin',
    'ADMIN',
  );
  adminUser.permissions = ['reviews:moderate', 'reviews:reply'];

  // Create a published course
  const courseSlug = `test-review-course-${Date.now()}`;
  const courseRes = await db.query(
    `
    INSERT INTO courses (
      instructor_id, title, slug, description, level, language,
      is_free, price, status, is_active, average_rating, total_reviews_count
    )
    VALUES ($1, 'Test Course for Reviews', $2, 'Comprehensive description', 'all_levels', 'English', FALSE, 1000, 'published', TRUE, 0.00, 0)
    RETURNING course_id, title, slug
    `,
    [instructorUser.userId, courseSlug],
  );
  const courseId = courseRes.rows[0].course_id;

  // Create section and lesson
  const sectionRes = await db.query(
    `INSERT INTO course_sections (course_id, title, sort_order) VALUES ($1, 'Section 1', 1) RETURNING section_id`,
    [courseId],
  );
  const sectionId = sectionRes.rows[0].section_id;

  const lessonRes = await db.query(
    `INSERT INTO course_lessons (course_id, section_id, title, sort_order, is_active, duration_seconds)
     VALUES ($1, $2, 'Lesson 1', 1, TRUE, 600) RETURNING lesson_id`,
    [courseId, sectionId],
  );
  const lessonId = lessonRes.rows[0].lesson_id;

  console.log(`   Course ID: ${courseId} (${courseSlug})`);
  console.log(`   Lesson ID: ${lessonId}\n`);

  try {
    // TEST 1: Non-enrolled student attempts to review
    console.log('2. Running Rule Tests...');
    try {
      await reviewsService.submitReview(courseId, { rating: 5, reviewText: 'Great!' }, studentA);
      assert(false, 'TEST 1: Non-enrolled student must be rejected');
    } catch (e: any) {
      assert(
        e.status === 403 && e.message.includes('actively enrolled'),
        'TEST 1: Non-enrolled student rejected with 403 Forbidden',
      );
    }

    // Enroll Student A (active status)
    await db.query(
      `
      INSERT INTO course_enrollments (student_id, course_id, enrollment_status, enrollment_type, amount_paid)
      VALUES ($1, $2, 'active', 'paid', 1000)
      ON CONFLICT (student_id, course_id) DO UPDATE SET enrollment_status = 'active'
      `,
      [studentA.userId, courseId],
    );

    // TEST 2: Verify non-enrolled Student B cannot review (read-only for non-purchased)
    try {
      await reviewsService.submitReview(courseId, { rating: 5, reviewText: 'Not enrolled' }, studentB);
      assert(false, 'TEST 2: Non-enrolled student B must be rejected');
    } catch (e: any) {
      assert(
        e.status === 403 && e.message.includes('actively enrolled'),
        'TEST 2: Non-enrolled student B rejected with 403 (read-only for non-purchasers)',
      );
    }

    // TEST 3: Course instructor attempts to review their own course (Anti-self-review)
    try {
      await reviewsService.submitReview(courseId, { rating: 5, reviewText: 'My own course is 5 stars' }, instructorUser);
      assert(false, 'TEST 3: Course instructor self-review must be rejected');
    } catch (e: any) {
      assert(
        e.status === 403 && e.message.includes('Instructors cannot submit'),
        'TEST 3: Course instructor self-review rejected with 403 Forbidden',
      );
    }

    // TEST 4: Student A submits a 5-star review
    const review1 = await reviewsService.submitReview(
      courseId,
      {
        rating: 5,
        reviewTitle: 'Exceptional Masterclass',
        reviewText: 'Deeply comprehensive, well-structured lessons and real-world projects.',
      },
      studentA,
    );
    assert(
      review1 && review1.rating === 5 && review1.status === 'published',
      'TEST 4: Student A successfully submitted 5-star review',
    );

    // TEST 5: Verify course average rating is updated to 5.00
    const courseStats1 = await db.query(
      `SELECT average_rating, total_reviews_count FROM courses WHERE course_id = $1`,
      [courseId],
    );
    assert(
      parseFloat(courseStats1.rows[0].average_rating) === 5.0 &&
        parseInt(courseStats1.rows[0].total_reviews_count, 10) === 1,
      'TEST 5: Course average_rating = 5.00 and total_reviews_count = 1',
    );

    // TEST 6: Student A attempts to submit a second review for the same course (Duplicate check)
    try {
      await reviewsService.submitReview(courseId, { rating: 4, reviewText: 'Another review' }, studentA);
      assert(false, 'TEST 6: Duplicate review for same course must be rejected');
    } catch (e: any) {
      assert(
        e.status === 409 && e.message.includes('already submitted a review'),
        'TEST 6: Duplicate review rejected with 409 Conflict',
      );
    }

    // TEST 7: Student B attempts to edit Student A's review
    try {
      await reviewsService.updateOwnReview(
        review1.reviewId,
        { rating: 1, reviewText: 'Hacked review' },
        studentB,
      );
      assert(false, 'TEST 7: Non-author cannot edit another review');
    } catch (e: any) {
      assert(
        e.status === 403 && e.message.includes('only edit your own review'),
        'TEST 7: Unauthorized edit rejected with 403 Forbidden',
      );
    }

    // TEST 8: Student A edits their review to 4 stars
    const editedReview = await reviewsService.updateOwnReview(
      review1.reviewId,
      {
        rating: 4,
        reviewTitle: 'Solid Course with Great Pacing',
        reviewText: 'Really enjoyed it, pacing was steady and clear.',
      },
      studentA,
    );
    assert(
      editedReview.rating === 4 && editedReview.isEdited === true,
      'TEST 8: Student A successfully edited review to 4 stars (is_edited = true)',
    );

    const courseStats2 = await db.query(
      `SELECT average_rating FROM courses WHERE course_id = $1`,
      [courseId],
    );
    assert(
      parseFloat(courseStats2.rows[0].average_rating) === 4.0,
      'TEST 8b: Course average_rating recalculated to 4.00',
    );

    // TEST 9: Other Instructor attempts to reply to Student A's review
    try {
      await reviewsService.replyToReview(
        review1.reviewId,
        { replyText: 'Thank you for enrolling!' },
        otherInstructorUser,
      );
      assert(false, 'TEST 9: Non-course instructor cannot reply');
    } catch (e: any) {
      assert(
        e.status === 403 && e.message.includes('Only the course instructor'),
        'TEST 9: Other instructor reply rejected with 403 Forbidden',
      );
    }

    // TEST 10: Course author replies to Student A's review
    const reply = await reviewsService.replyToReview(
      review1.reviewId,
      { replyText: 'Thank you Bob for the wonderful feedback! Happy learning.' },
      instructorUser,
    );
    assert(
      reply && reply.replyText.includes('Thank you Bob'),
      'TEST 10: Course author successfully posted official instructor reply',
    );

    // TEST 11: Public Review Summary & Breakdown
    const summary = await reviewsService.getCourseReviewSummary(courseId);
    assert(
      summary.averageRating === 4.0 &&
        summary.totalReviews === 1 &&
        summary.breakdown[4].count === 1 &&
        summary.breakdown[4].percentage === 100.0 &&
        summary.breakdown[5].count === 0,
      'TEST 11: Public summary: averageRating = 4.0, 100% 4-star distribution',
    );

    // TEST 12: Public Reviews List with Instructor Reply
    const publicList = await reviewsService.getCourseReviews(courseId, { page: 1, limit: 10 });
    assert(
      publicList.reviews.length === 1 &&
        publicList.reviews[0].instructorReply !== null &&
        publicList.reviews[0].instructorReply?.replyText.includes('Thank you Bob'),
      'TEST 12: Public listing includes formatted review with nested instructor reply',
    );

    // TEST 13: Admin Moderation - Hide Review
    const moderated = await reviewsService.moderateReview(
      review1.reviewId,
      { status: 'hidden', moderationReason: 'Flagged for moderation check' },
      adminUser,
    );
    assert(
      moderated.status === 'hidden' && moderated.moderationReason === 'Flagged for moderation check',
      'TEST 13: Admin successfully marked review as hidden with reason',
    );

    // Verify hidden review does NOT count towards course rating
    const courseStats3 = await db.query(
      `SELECT average_rating, total_reviews_count FROM courses WHERE course_id = $1`,
      [courseId],
    );
    assert(
      parseFloat(courseStats3.rows[0].average_rating) === 0.0 &&
        parseInt(courseStats3.rows[0].total_reviews_count, 10) === 0,
      'TEST 13b: Hidden review excluded from course stats: average_rating = 0.00, count = 0',
    );

    const publicListAfterHide = await reviewsService.getCourseReviews(courseId, {});
    assert(
      publicListAfterHide.reviews.length === 0,
      'TEST 13c: Hidden review excluded from public reviews list',
    );

    // TEST 14: Admin Moderation - Restore Review
    await reviewsService.moderateReview(
      review1.reviewId,
      { status: 'published', moderationReason: 'Cleared by admin' },
      adminUser,
    );
    const courseStats4 = await db.query(
      `SELECT average_rating, total_reviews_count FROM courses WHERE course_id = $1`,
      [courseId],
    );
    assert(
      parseFloat(courseStats4.rows[0].average_rating) === 4.0 &&
        parseInt(courseStats4.rows[0].total_reviews_count, 10) === 1,
      'TEST 14: Admin restored review: course stats restored to 4.00, count = 1',
    );

    // TEST 15: Student deletes own review (soft delete)
    const delRes = await reviewsService.deleteReview(review1.reviewId, studentA);
    assert(delRes.success === true, 'TEST 15: Student successfully deleted own review');

    const courseStats5 = await db.query(
      `SELECT average_rating, total_reviews_count FROM courses WHERE course_id = $1`,
      [courseId],
    );
    assert(
      parseFloat(courseStats5.rows[0].average_rating) === 0.0 &&
        parseInt(courseStats5.rows[0].total_reviews_count, 10) === 0,
      'TEST 15b: Deleted review removed from course stats: average_rating = 0.00, count = 0',
    );

    // TEST 16: Instructor Dashboard Reviews Query
    const instructorReviews = await reviewsService.getInstructorReviews(instructorUser, {});
    assert(
      instructorReviews && instructorReviews.pagination !== undefined,
      'TEST 16: Instructor reviews dashboard query executed successfully',
    );

    // TEST 17: Admin Panel Reviews Query
    const adminReviews = await reviewsService.getAdminReviews({});
    assert(
      adminReviews && adminReviews.pagination !== undefined,
      'TEST 17: Admin moderation reviews query executed successfully',
    );

  } finally {
    // Cleanup fixtures
    console.log('\n3. Cleaning up test data...');
    await db.query(`DELETE FROM course_review_replies WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM course_reviews WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM student_lesson_progress WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM course_enrollments WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM course_lessons WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM course_sections WHERE course_id = $1`, [courseId]);
    await db.query(`DELETE FROM courses WHERE course_id = $1`, [courseId]);
    console.log('   Cleanup completed.');
  }

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  pool.end();
  process.exit(1);
});

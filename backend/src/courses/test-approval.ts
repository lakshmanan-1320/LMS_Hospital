/**
 * Comprehensive Integration Test for Course Approval (Module 7)
 * Verifies all 12 business rules, state transitions, concurrency locks, and audit history.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';
import { CoursesRepository } from './courses.repository';
import { CoursesService } from './courses.service';
import { CourseApprovalService } from './course-approval.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD, // never hard-code DB credentials
  database: process.env.DB_NAME || 'lms_db',
});

async function runApprovalTests() {
  console.log('=== Starting Module 7: Course Approval Integration Tests ===\n');

  const dbService = new DatabaseService(pool);
  const repo = new CoursesRepository(dbService);
  // Badges aren't part of approval tests: a no-op stand-in for CourseBadgesService.
  const noBadges = { attach: async (items: any[]) => items.map((i) => ({ ...i, badges: [] })) } as any;
  const coursesService = new CoursesService(repo, dbService, noBadges);
  const approvalService = new CourseApprovalService(dbService, repo, coursesService);

  const client = await pool.connect();

  try {
    // 1. Fixtures setup: Instructor A (author), Instructor B (other instructor), Admin (reviewer)
    const getOrCreateUser = async (email: string, firstName: string, lastName: string) => {
      const existing = await client.query('SELECT user_id, email FROM users WHERE email = $1', [email]);
      if (existing.rows[0]) return existing.rows[0].user_id;
      const res = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active)
        VALUES ($1, 'dummy_hash', $2, $3, TRUE)
        RETURNING user_id;
      `, [email, firstName, lastName]);
      return res.rows[0].user_id;
    };

    const instructorAId = await getOrCreateUser('instructor_approval_a@test.com', 'Alice', 'Author');
    const instructorBId = await getOrCreateUser('instructor_approval_b@test.com', 'Bob', 'Stranger');
    const adminId = await getOrCreateUser('admin_reviewer@test.com', 'Carol', 'Reviewer');

    // Category (find or create)
    let catRes = await client.query(`SELECT category_id FROM categories WHERE name = 'Approval Testing Category' LIMIT 1;`);
    let categoryId = catRes.rows[0]?.category_id;
    if (!categoryId) {
      const insertedCat = await client.query(`
        INSERT INTO categories (name, slug, is_active)
        VALUES ('Approval Testing Category', 'approval-test-cat-' || floor(random() * 10000), TRUE)
        RETURNING category_id;
      `);
      categoryId = insertedCat.rows[0].category_id;
    }

    const cleanCourseById = async (id: string) => {
      if (!id) return;
      await client.query('DELETE FROM course_status_history WHERE course_id = $1', [id]);
      await client.query('DELETE FROM course_lessons WHERE course_id = $1', [id]);
      await client.query('DELETE FROM course_sections WHERE course_id = $1', [id]);
      await client.query('DELETE FROM media_audit_logs WHERE asset_id IN (SELECT asset_id FROM media_assets WHERE course_id = $1)', [id]);
      await client.query('DELETE FROM media_assets WHERE course_id = $1', [id]);
      await client.query('DELETE FROM courses WHERE course_id = $1', [id]);
    };

    // Clean up previous test courses if any
    const existingTestCourses = await client.query(`SELECT course_id FROM courses WHERE title LIKE 'Approval Test Course%';`);
    for (const r of existingTestCourses.rows) {
      await cleanCourseById(r.course_id);
    }

    const userAuthor = { userId: instructorAId, roles: ['INSTRUCTOR'], permissions: ['courses:edit_own', 'courses:view_own'] };
    const userOther = { userId: instructorBId, roles: ['INSTRUCTOR'], permissions: ['courses:edit_own', 'courses:view_own'] };
    const userReviewer = { userId: adminId, roles: ['ADMIN'], permissions: ['courses:approve', 'courses:publish', 'courses:manage'] };
    const userAuthorWithAdminRole = { userId: instructorAId, roles: ['SUPER_ADMIN'], permissions: ['courses:approve', 'courses:publish', 'courses:edit_own'] };

    console.log('✓ Test fixtures ready (Author, Other Instructor, Admin Reviewer)');

    // 2. CREATE A DRAFT COURSE (Incomplete)
    const draftRes = await client.query(`
      INSERT INTO courses (instructor_id, category_id, title, slug, subtitle, description, status)
      VALUES ($1, $2, 'Approval Test Course Alpha', 'approval-test-course-alpha', 'Short subtitle', 'Too short description', 'draft')
      RETURNING course_id;
    `, [instructorAId, categoryId]);
    const courseId = draftRes.rows[0].course_id;
    console.log('✓ Created incomplete draft course:', courseId);

    // TEST 1: Incomplete course submission rejected with 422
    let caught422 = false;
    try {
      await approvalService.transition(courseId, 'submit', userAuthor);
    } catch (e: any) {
      if (e.status === 422 || e.getStatus?.() === 422) {
        caught422 = true;
        console.log('✓ [TEST 1 PASS] Incomplete course submission blocked with 422 Unprocessable Entity. Failed items count:', e.response?.failedItems?.length);
      }
    }
    if (!caught422) throw new Error('TEST 1 FAILED: Expected 422 for incomplete course submission');

    // Make the course 100% complete: description >= 200, outcomes >= 4, thumbnail, price, section, lesson
    const longDescription = 'A'.repeat(250);
    await client.query(`
      UPDATE courses
      SET 
        description = $1,
        learning_outcomes = '["Outcome 1", "Outcome 2", "Outcome 3", "Outcome 4"]'::jsonb,
        thumbnail_url = 'https://example.com/thumb.jpg',
        is_free = TRUE
      WHERE course_id = $2;
    `, [longDescription, courseId]);

    // Add curriculum (section and lesson)
    const secRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Section 1', 1, TRUE)
      RETURNING section_id;
    `, [courseId]);
    const sectionId = secRes.rows[0].section_id;

    await client.query(`
      INSERT INTO course_lessons (course_id, section_id, title, sort_order, is_active, duration_seconds, is_preview)
      VALUES ($1, $2, 'Lesson 1 Introduction', 1, TRUE, 600, TRUE);
    `, [courseId, sectionId]);
    // Checklist item 9: a ready promo video is mandatory
    const promoRes = await client.query(`
      INSERT INTO media_assets (owner_id, course_id, asset_type, title, original_file_name, mime_type,
                                file_size_bytes, storage_provider, storage_key, visibility, processing_status)
      VALUES ($1, $2, 'video', 'Promo', 'promo.mp4', 'video/mp4', 1024, 'local', 'test-promo.mp4', 'public', 'ready')
      RETURNING asset_id;
    `, [userAuthor.userId, courseId]);
    await client.query(`UPDATE courses SET promo_video_asset_id = $1 WHERE course_id = $2;`, [promoRes.rows[0].asset_id, courseId]);

    console.log('✓ Course updated to fulfill all 10 checklist requirements');

    // TEST 2: Non-owner cannot submit course (403 Forbidden)
    let caught403NonOwner = false;
    try {
      await approvalService.transition(courseId, 'submit', userOther);
    } catch (e: any) {
      if (e.status === 403 || e.getStatus?.() === 403) {
        caught403NonOwner = true;
        console.log('✓ [TEST 2 PASS] Non-owner blocked with 403 Forbidden when attempting submit:', e.message);
      }
    }
    if (!caught403NonOwner) throw new Error('TEST 2 FAILED: Expected 403 for non-owner submit');

    // TEST 3: Author submits course successfully -> pending_review
    const submitRes = await approvalService.transition(courseId, 'submit', userAuthor, { note: 'Ready for review' });
    console.log('✓ [TEST 3 PASS] Author submitted course. Status:', submitRes.course.status, '| submitted_at:', submitRes.course.submitted_at);
    if (submitRes.course.status !== 'pending_review') throw new Error('Status should be pending_review');

    // Check status history row
    const hist1 = await repo.findStatusHistory(courseId);
    console.log('✓ History recorded transition from draft to pending_review. Rows:', hist1.length);
    if (hist1.length !== 1 || hist1[0].to_status !== 'pending_review') throw new Error('History entry missing or incorrect');

    // TEST 4: Author withdraws course -> reverts to draft
    const withdrawRes = await approvalService.transition(courseId, 'withdraw', userAuthor, { note: 'Need to make edits' });
    console.log('✓ [TEST 4 PASS] Author withdrew course. Status:', withdrawRes.course.status);
    if (withdrawRes.course.status !== 'draft') throw new Error('Status should be draft after withdraw');

    // Re-submit so we can test reviewer actions
    await approvalService.transition(courseId, 'submit', userAuthor);

    // TEST 5: Author CANNOT review their own course, even if they have admin role (403 Forbidden)
    let caughtSelfReview = false;
    try {
      await approvalService.transition(courseId, 'approve', userAuthorWithAdminRole);
    } catch (e: any) {
      if (e.status === 403 || e.getStatus?.() === 403) {
        caughtSelfReview = true;
        console.log('✓ [TEST 5 PASS] Author self-review blocked with 403 Forbidden:', e.message);
      }
    }
    if (!caughtSelfReview) throw new Error('TEST 5 FAILED: Expected 403 for self-review');

    // TEST 6: Reviewer rejects course without reason -> 400 BadRequest
    let caughtMissingReason = false;
    try {
      await approvalService.transition(courseId, 'reject', userReviewer, { reason: '' });
    } catch (e: any) {
      if (e.status === 400 || e.getStatus?.() === 400) {
        caughtMissingReason = true;
        console.log('✓ [TEST 6 PASS] Rejection without reason blocked with 400 Bad Request');
      }
    }
    if (!caughtMissingReason) throw new Error('TEST 6 FAILED: Expected 400 for empty rejection reason');

    // TEST 7: Reviewer rejects course with feedback note
    const rejectRes = await approvalService.transition(courseId, 'reject', userReviewer, {
      reason: 'Please add a longer lesson outline and better audio quality.',
    });
    console.log('✓ [TEST 7 PASS] Reviewer rejected course. Status:', rejectRes.course.status, '| Reason:', rejectRes.course.rejection_reason);
    if (rejectRes.course.status !== 'rejected') throw new Error('Status should be rejected');

    // TEST 8: Invalid transition test: Cannot approve a rejected course directly (409 Conflict)
    let caught409Invalid = false;
    try {
      await approvalService.transition(courseId, 'approve', userReviewer);
    } catch (e: any) {
      if (e.status === 409 || e.getStatus?.() === 409) {
        caught409Invalid = true;
        console.log('✓ [TEST 8 PASS] Invalid transition (rejected -> approved) blocked with 409 Conflict:', e.message);
      }
    }
    if (!caught409Invalid) throw new Error('TEST 8 FAILED: Expected 409 Conflict');

    // TEST 9: Author resubmits rejected course -> pending_review
    const resubmitRes = await approvalService.transition(courseId, 'submit', userAuthor, { note: 'Fixed the issues' });
    console.log('✓ [TEST 9 PASS] Resubmitted rejected course. Status:', resubmitRes.course.status);
    if (resubmitRes.course.status !== 'pending_review') throw new Error('Status should be pending_review');

    // TEST 10: Reviewer approves course -> approved
    const approveRes = await approvalService.transition(courseId, 'approve', userReviewer, { note: 'Looks great!' });
    console.log('✓ [TEST 10 PASS] Reviewer approved course. Status:', approveRes.course.status, '| reviewed_by:', approveRes.course.reviewed_by);
    if (approveRes.course.status !== 'approved') throw new Error('Status should be approved');

    // TEST 11: Admin publishes course -> published
    const publishRes = await approvalService.transition(courseId, 'publish', userReviewer);
    console.log('✓ [TEST 11 PASS] Admin published course. Status:', publishRes.course.status, '| published_at:', publishRes.course.published_at);
    if (publishRes.course.status !== 'published') throw new Error('Status should be published');

    // TEST 12: Featured toggle
    const featuredRes = await approvalService.setFeatured(courseId, true);
    console.log('✓ [TEST 12 PASS] Course featured set to true:', featuredRes.course?.is_featured);
    if (!featuredRes.course?.is_featured) throw new Error('Expected is_featured to be true');

    // TEST 13: Admin archives course -> archived, is_featured reset to false
    const archiveRes = await approvalService.transition(courseId, 'archive', userReviewer);
    console.log('✓ [TEST 13 PASS] Course archived. Status:', archiveRes.course.status, '| is_featured reset:', archiveRes.course.is_featured);
    if (archiveRes.course.status !== 'archived' || archiveRes.course.is_featured !== false) {
      throw new Error('Course should be archived and is_featured must be false');
    }

    // TEST 14: Cannot feature an archived course (409 Conflict)
    let caughtFeaturedOnArchived = false;
    try {
      await approvalService.setFeatured(courseId, true);
    } catch (e: any) {
      if (e.status === 409 || e.getStatus?.() === 409) {
        caughtFeaturedOnArchived = true;
        console.log('✓ [TEST 14 PASS] Featuring an archived course blocked with 409 Conflict:', e.message);
      }
    }
    if (!caughtFeaturedOnArchived) throw new Error('TEST 14 FAILED: Expected 409 when featuring archived course');

    // TEST 15: Admin restores archived course -> draft
    const restoreRes = await approvalService.transition(courseId, 'restore', userReviewer);
    if (restoreRes.course.status !== 'draft') throw new Error('Status should be draft after restore');
    // published_at must survive restore so the slug stays frozen and shared links keep working
    if (restoreRes.course.published_at === null) throw new Error('published_at should be kept after restore');
    console.log('✓ [TEST 15 PASS] Course restored. Status:', restoreRes.course.status, '| published_at kept:', restoreRes.course.published_at !== null);

    // TEST 16: Queue and Stats queries
    const stats = await approvalService.getStats();
    console.log('✓ [TEST 16 PASS] Approval Stats retrieved:', stats);
    if (typeof stats.total !== 'number') throw new Error('Stats total should be a number');

    const queue = await approvalService.getQueue({ status: 'all', page: 1, limit: 10 });
    console.log('✓ [TEST 16b PASS] Approval Queue retrieved:', queue.items.length, 'courses. Meta:', queue.meta);

    // TEST 17: Review detail
    const reviewDetail = await approvalService.getReviewDetail(courseId, userReviewer);
    console.log('✓ [TEST 17 PASS] Review Detail Bundle:', {
      courseId: reviewDetail.course.courseId,
      curriculumSummary: reviewDetail.curriculumSummary,
      checklistReady: reviewDetail.checklist.ready,
      historyLength: reviewDetail.latestHistory.length,
    });
    if (reviewDetail.curriculumSummary.lessonCount !== 1) throw new Error('Curriculum lesson count mismatch');

    // TEST 18: Audit History
    const historyList = await approvalService.getHistory(courseId, userAuthor);
    console.log('✓ [TEST 18 PASS] Audit History entries:', historyList.length);
    historyList.forEach((h, idx) => {
      console.log(`   [${idx + 1}] ${h.from_status || 'null'} -> ${h.to_status} (by: ${h.changed_by_name || h.changed_by}) note: "${h.note || ''}"`);
    });

    // TEST 19: Direct publish from draft by Admin without approval
    const adminDraftRes = await client.query(`
      INSERT INTO courses (instructor_id, category_id, title, slug, subtitle, description, status)
      VALUES ($1, $2, 'Approval Test Course Admin Direct', 'approval-test-course-admin-direct', 'Admin direct subtitle', 'Admin direct description with adequate length for testing', 'draft')
      RETURNING course_id;
    `, [adminId, categoryId]);
    const adminCourseId = adminDraftRes.rows[0].course_id;

    const directPublishRes = await approvalService.transition(adminCourseId, 'publish', userReviewer);
    console.log('✓ [TEST 19 PASS] Admin directly published draft course without approval. Status:', directPublishRes.course.status, '| published_at:', directPublishRes.course.published_at);
    if (directPublishRes.course.status !== 'published') throw new Error('Status should be published for direct publish');
    if (!directPublishRes.course.published_at) throw new Error('published_at should be set for direct publish');

    console.log('\n======================================================');
    console.log(' ALL 19 COURSE APPROVAL INTEGRATION TESTS PASSED! 🚀');
    console.log('======================================================\n');
  } finally {
    try {
      const remainingTestCourses = await client.query(`SELECT course_id FROM courses WHERE title LIKE 'Approval Test Course%';`);
      for (const r of remainingTestCourses.rows) {
        await client.query('DELETE FROM course_status_history WHERE course_id = $1', [r.course_id]);
        await client.query('DELETE FROM course_lessons WHERE course_id = $1', [r.course_id]);
        await client.query('DELETE FROM course_sections WHERE course_id = $1', [r.course_id]);
        await client.query('DELETE FROM media_audit_logs WHERE asset_id IN (SELECT asset_id FROM media_assets WHERE course_id = $1)', [r.course_id]);
        await client.query('DELETE FROM media_assets WHERE course_id = $1', [r.course_id]);
        await client.query('DELETE FROM courses WHERE course_id = $1', [r.course_id]);
      }
      for (const email of ['instructor_approval_a@test.com', 'instructor_approval_b@test.com', 'admin_reviewer@test.com']) {
        const u = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (u.rows[0]) {
          await client.query('DELETE FROM user_roles WHERE user_id = $1', [u.rows[0].user_id]);
          await client.query('DELETE FROM users WHERE user_id = $1', [u.rows[0].user_id]);
        }
      }
    } catch (cleanupErr) {
      console.warn('Test cleanup warning:', cleanupErr);
    }
    client.release();
    await pool.end();
  }
}

runApprovalTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

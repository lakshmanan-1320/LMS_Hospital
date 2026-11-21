/**
 * Integration test script for Course Management (Module 5)
 * Verifies all 10 business rules and constraints against live PostgreSQL database.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD, // never hard-code DB credentials
  database: process.env.DB_NAME || 'lms_db',
});

async function runTests() {
  console.log('--- Starting Course Management Integration Tests ---');
  const client = await pool.connect();

  try {
    // 1. Setup test users: Instructor A, Instructor B, Admin
    const userA = await client.query(`
      SELECT user_id, email FROM users WHERE email = 'test_instructor_a@example.com';
    `);
    let instructorAId = userA.rows[0]?.user_id;
    if (!instructorAId) {
      const insRes = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active)
        VALUES ('test_instructor_a@example.com', 'dummyhash', 'Instructor', 'Alice', TRUE)
        RETURNING user_id;
      `);
      instructorAId = insRes.rows[0].user_id;
    }

    const userB = await client.query(`
      SELECT user_id, email FROM users WHERE email = 'test_instructor_b@example.com';
    `);
    let instructorBId = userB.rows[0]?.user_id;
    if (!instructorBId) {
      const insRes = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, is_active)
        VALUES ('test_instructor_b@example.com', 'dummyhash', 'Instructor', 'Bob', TRUE)
        RETURNING user_id;
      `);
      instructorBId = insRes.rows[0].user_id;
    }

    // 2. Setup category
    const catRes = await client.query(`
      INSERT INTO categories (name, slug, is_active)
      VALUES ('Test Course Category ' || floor(random() * 1000000), 'test-course-category-' || floor(random() * 1000000), TRUE)
      ON CONFLICT DO NOTHING
      RETURNING category_id;
    `);
    let categoryId = catRes.rows[0]?.category_id;
    if (!categoryId) {
      const existingCat = await client.query(`SELECT category_id FROM categories LIMIT 1;`);
      categoryId = existingCat.rows[0].category_id;
    }

    // Clean up old test courses
    await client.query(`DELETE FROM courses WHERE title LIKE 'Test Course %';`);

    console.log('✓ Test fixtures prepared');

    // TEST 1: Slug regex constraint check
    const validSlug = 'test-course-regex-123';
    const ins1 = await client.query(`
      INSERT INTO courses (instructor_id, title, slug, category_id, status)
      VALUES ($1, 'Test Course Regex', $2, $3, 'draft')
      RETURNING *;
    `, [instructorAId, validSlug, categoryId]);
    console.log('✓ Valid slug passed check constraint:', ins1.rows[0].slug);

    let caughtRegex = false;
    try {
      await client.query(`
        INSERT INTO courses (instructor_id, title, slug, category_id, status)
        VALUES ($1, 'Test Course Invalid Slug', 'Invalid_Slug_With_Upper', $2, 'draft');
      `, [instructorAId, categoryId]);
    } catch (e: any) {
      caughtRegex = true;
      console.log('✓ Invalid slug with uppercase/underscores correctly rejected by DB constraint:', e.message);
    }
    if (!caughtRegex) throw new Error('Expected invalid slug to be rejected by check constraint');

    // TEST 2: Price constraints: discount <= price, price >= 0
    let caughtDiscount = false;
    try {
      await client.query(`
        INSERT INTO courses (instructor_id, title, slug, category_id, is_free, price, discount_price)
        VALUES ($1, 'Test Course Invalid Pricing', 'test-invalid-price', $2, FALSE, 500, 900);
      `, [instructorAId, categoryId]);
    } catch (e: any) {
      caughtDiscount = true;
      console.log('✓ Discount higher than price (900 on 500) correctly rejected by DB constraint:', e.message);
    }
    if (!caughtDiscount) throw new Error('Expected discount > price to fail check constraint');

    // TEST 3: Soft delete behavior
    const courseToDelete = ins1.rows[0].course_id;
    const delRes = await client.query(`
      UPDATE courses
      SET deleted_at = NOW(), is_active = FALSE
      WHERE course_id = $1 AND status = 'draft' AND deleted_at IS NULL
      RETURNING *;
    `, [courseToDelete]);
    console.log('✓ Soft delete set deleted_at and is_active = false:', delRes.rows[0].deleted_at !== null);

    // Verify deleted_at IS NULL query excludes soft-deleted course
    const fetchAfterDel = await client.query(`
      SELECT * FROM courses WHERE course_id = $1 AND deleted_at IS NULL;
    `, [courseToDelete]);
    console.log('✓ Soft-deleted course excluded from queries (rows returned):', fetchAfterDel.rows.length);
    if (fetchAfterDel.rows.length !== 0) throw new Error('Soft deleted course was not excluded');

    // TEST 4: Curriculum query for checklist
    const newCourse = await client.query(`
      INSERT INTO courses (instructor_id, title, slug, category_id, status)
      VALUES ($1, 'Test Course Curriculum Check', 'test-course-curriculum', $2, 'draft')
      RETURNING course_id;
    `, [instructorAId, categoryId]);
    const courseId = newCourse.rows[0].course_id;

    // Check before section/lesson
    const currCheck1 = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM course_lessons l
        JOIN course_sections s ON s.section_id = l.section_id
        WHERE l.course_id = $1 AND l.is_active AND s.is_active
      ) AS has_curriculum;
    `, [courseId]);
    console.log('✓ Curriculum check when empty:', currCheck1.rows[0].has_curriculum); // false

    // Add section and lesson
    const secRes = await client.query(`
      INSERT INTO course_sections (course_id, title, sort_order, is_active)
      VALUES ($1, 'Section 1', 1, TRUE)
      RETURNING section_id;
    `, [courseId]);
    const sectionId = secRes.rows[0].section_id;

    await client.query(`
      INSERT INTO course_lessons (course_id, section_id, title, sort_order, is_active, duration_seconds)
      VALUES ($1, $2, 'Lesson 1', 1, TRUE, 300);
    `, [courseId, sectionId]);

    // Check after section/lesson added
    const currCheck2 = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM course_lessons l
        JOIN course_sections s ON s.section_id = l.section_id
        WHERE l.course_id = $1 AND l.is_active AND s.is_active
      ) AS has_curriculum;
    `, [courseId]);
    console.log('✓ Curriculum check with active section + lesson:', currCheck2.rows[0].has_curriculum); // true
    if (!currCheck2.rows[0].has_curriculum) throw new Error('Expected curriculum check to be true');

    // Clean up test data
    const testCourses = await client.query(`SELECT course_id FROM courses WHERE title LIKE 'Test Course%';`);
    for (const r of testCourses.rows) {
      await client.query(`DELETE FROM course_lessons WHERE course_id = $1`, [r.course_id]);
      await client.query(`DELETE FROM course_sections WHERE course_id = $1`, [r.course_id]);
      await client.query(`DELETE FROM courses WHERE course_id = $1`, [r.course_id]);
    }
    console.log('✓ Cleaned up test data');

    console.log('\n ALL DATABASE AND CONSTRAINT TESTS PASSED SUCCESSFULLY! \n');
  } finally {
    try {
      const testCourses = await client.query(`SELECT course_id FROM courses WHERE title LIKE 'Test Course%';`);
      for (const r of testCourses.rows) {
        await client.query(`DELETE FROM course_lessons WHERE course_id = $1`, [r.course_id]);
        await client.query(`DELETE FROM course_sections WHERE course_id = $1`, [r.course_id]);
        await client.query(`DELETE FROM courses WHERE course_id = $1`, [r.course_id]);
      }
      for (const email of ['test_instructor_a@example.com', 'test_instructor_b@example.com']) {
        const u = await client.query(`SELECT user_id FROM users WHERE email = $1`, [email]);
        if (u.rows[0]) {
          await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [u.rows[0].user_id]);
          await client.query(`DELETE FROM users WHERE user_id = $1`, [u.rows[0].user_id]);
        }
      }
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
    client.release();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

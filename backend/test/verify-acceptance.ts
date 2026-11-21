import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lms_db',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('--- 1. APPLIED MIGRATIONS ---');
    const migs = await client.query('SELECT id, filename, applied_at FROM schema_migrations ORDER BY id ASC');
    console.table(migs.rows);

    console.log('\n--- 2. TABLES CHECK ---');
    const tables = ['media_assets', 'lesson_media_replacement_requests', 'student_lesson_progress', 'media_audit_logs'];
    for (const t of tables) {
      const exists = await client.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)",
        [t]
      );
      console.log(`Table "${t}": exists = ${exists.rows[0].exists}`);
    }

    console.log('\n--- 3. COLUMNS IN media_assets ---');
    const cols = await client.query(
      "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'media_assets' ORDER BY ordinal_position"
    );
    console.table(cols.rows);

    console.log('\n--- 4. COLUMNS IN lesson_media_replacement_requests ---');
    const replCols = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'lesson_media_replacement_requests' ORDER BY ordinal_position"
    );
    console.table(replCols.rows);

    console.log('\n--- 5. COLUMNS IN student_lesson_progress ---');
    const progCols = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'student_lesson_progress' ORDER BY ordinal_position"
    );
    console.table(progCols.rows);

    console.log('\n--- 6. CONSTRAINTS ---');
    const constrs = await client.query(`
      SELECT conname, contype, conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE conrelid::regclass::text IN ('student_lesson_progress', 'lesson_media_replacement_requests', 'media_assets')
    `);
    console.table(constrs.rows);

    console.log('\n--- 7. INDEXES ---');
    const indexes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('student_lesson_progress', 'lesson_media_replacement_requests', 'media_assets', 'media_audit_logs')
      ORDER BY tablename, indexname
    `);
    console.table(indexes.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);

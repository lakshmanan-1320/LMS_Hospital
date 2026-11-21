
import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from backend or root .env
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lms_db',
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

const MIGRATIONS_DIR = path.resolve(__dirname);

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER NOT NULL
    );
  `);
}

async function getAppliedMigrations(
  client: PoolClient,
): Promise<Array<{ id: number; filename: string }>> {
  const result = await client.query(`
    SELECT id, filename
    FROM schema_migrations
    ORDER BY id ASC;
  `);

  return result.rows;
}

async function runUp(): Promise<void> {
  console.log('Checking database connection and pending migrations...');

  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);

    const appliedRows = await getAppliedMigrations(client);
    const appliedSet = new Set(appliedRows.map((row) => row.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(
        (file) =>
          file.endsWith('.sql') &&
          !file.endsWith('.down.sql'),
      )
      .sort();

    const pending = files.filter((file) => !appliedSet.has(file));

    if (pending.length === 0) {
      console.log('Database is already up to date.');
      return;
    }

    console.log(`Found ${pending.length} pending migration(s):`);

    for (const file of pending) {
      console.log(` - ${file}`);
    }

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Applying ${file}...`);

      const startTime = Date.now();

      await client.query('BEGIN');

      try {
        await client.query(sql);

        const duration = Date.now() - startTime;

        await client.query(
          `INSERT INTO schema_migrations
           (filename, execution_time_ms)
           VALUES ($1, $2);`,
          [file, duration],
        );

        await client.query('COMMIT');

        console.log(`Applied ${file} successfully in ${duration}ms`);
      } catch (error) {
        await client.query('ROLLBACK');

        console.error(`Failed to apply migration: ${file}`);
        throw error;
      }
    }

    console.log('All pending migrations completed.');
  } finally {
    client.release();
  }
}

async function runDown(): Promise<void> {
  console.log('Rolling back the latest migration...');

  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);

    const appliedRows = await getAppliedMigrations(client);

    if (appliedRows.length === 0) {
      console.log('No applied migrations found to roll back.');
      return;
    }

    const lastApplied = appliedRows[appliedRows.length - 1];

    const downFilename = lastApplied.filename.replace(
      '.sql',
      '.down.sql',
    );

    const downFilePath = path.join(
      MIGRATIONS_DIR,
      downFilename,
    );

    if (!fs.existsSync(downFilePath)) {
      throw new Error(
        `Rollback file not found: ${downFilename}`,
      );
    }

    const sql = fs.readFileSync(downFilePath, 'utf-8');

    console.log(`Rolling back ${lastApplied.filename}...`);

    const startTime = Date.now();

    await client.query('BEGIN');

    try {
      await client.query(sql);

      await client.query(
        `DELETE FROM schema_migrations WHERE id = $1;`,
        [lastApplied.id],
      );

      await client.query('COMMIT');

      const duration = Date.now() - startTime;

      console.log(
        `Successfully rolled back ${lastApplied.filename} in ${duration}ms`,
      );
    } catch (error) {
      await client.query('ROLLBACK');

      console.error(
        `Failed to roll back ${lastApplied.filename}`,
      );

      throw error;
    }
  } finally {
    client.release();
  }
}

async function createMigration(): Promise<void> {
  const migrationName = process.argv[3];

  if (!migrationName) {
    throw new Error(
      'Provide a migration name. Example: npm run migrate:create -- add_user_management',
    );
  }

  const safeName = migrationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!safeName) {
    throw new Error('Invalid migration name.');
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(
      (file) =>
        /^\d+_.*\.sql$/.test(file) &&
        !file.endsWith('.down.sql'),
    );

  const nextNumber =
    files.reduce((max, file) => {
      const match = file.match(/^(\d+)_/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;

  const prefix = String(nextNumber).padStart(3, '0');
  const filename = `${prefix}_${safeName}.sql`;
  const downFilename = `${prefix}_${safeName}.down.sql`;

  const upPath = path.join(MIGRATIONS_DIR, filename);
  const downPath = path.join(MIGRATIONS_DIR, downFilename);

  if (fs.existsSync(upPath) || fs.existsSync(downPath)) {
    throw new Error('Migration file already exists.');
  }

  fs.writeFileSync(
    upPath,
    `-- Migration ${prefix}: ${safeName}\n\n`,
    'utf-8',
  );

  fs.writeFileSync(
    downPath,
    `-- Rollback migration ${prefix}: ${safeName}\n\n`,
    'utf-8',
  );

  console.log(`Created ${filename}`);
  console.log(`Created ${downFilename}`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'up';

  try {
    switch (command) {
      case 'up':
        await runUp();
        break;

      case 'down':
        await runDown();
        break;

      case 'create':
        await createMigration();
        break;

      default:
        throw new Error(
          `Unknown command: ${command}. Use up, down, or create.`,
        );
    }
  } catch (error) {
    console.error('Migration command failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();

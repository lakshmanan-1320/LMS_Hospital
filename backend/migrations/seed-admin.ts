import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env
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
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Pre-computed one-way cryptographic bcrypt hash (Cost: 12)
 * One-way hash cannot be reversed. Plaintext password is never stored.
 */
const INITIAL_ACCOUNT_PASSWORD_HASH =
  process.env.INITIAL_ACCOUNT_PASSWORD_HASH ||
  '$2b$12$/zMb3zELtZvdbUdI5qjxYenIrMvSFGgLrgbNTCKvtLnoBdpe9YNeG';

const USERS_TO_SEED = [
  {
    email: 'superadmin@insighttech.in',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
    passwordHash: INITIAL_ACCOUNT_PASSWORD_HASH,
  },
  {
    email: 'admin@insighttech.in',
    firstName: 'System',
    lastName: 'Admin',
    role: 'ADMIN',
    passwordHash: INITIAL_ACCOUNT_PASSWORD_HASH,
  },
];

async function seedInitialUsers() {
  console.log('🔐 Seeding initial platform accounts using secure one-way bcrypt hashes...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const user of USERS_TO_SEED) {
      // 1. Get role_id
      const roleRes = await client.query(`SELECT role_id FROM roles WHERE name = $1;`, [user.role]);
      if (roleRes.rows.length === 0) {
        throw new Error(`Role [${user.role}] not found. Run migrations first.`);
      }
      const roleId = roleRes.rows[0].role_id;

      // 2. Upsert user with one-way password hash
      const userRes = await client.query(
        `
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ($1, $2, $3, $4, true, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          is_active = true,
          is_verified = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING user_id, email;
        `,
        [user.email, user.passwordHash, user.firstName, user.lastName],
      );

      const userId = userRes.rows[0].user_id;

      // 3. Assign role
      await client.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        `,
        [userId, roleId],
      );

      console.log(`✅ Seeded ${user.role}: ${user.email} (User ID: ${userId}) [Verified & Hashed]`);
    }

    await client.query('COMMIT');
    console.log('🎉 Initial accounts successfully seeded with secure bcrypt hashes!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed initial accounts:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedInitialUsers();

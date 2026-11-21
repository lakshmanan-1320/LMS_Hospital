import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { RoleMetadata } from './interfaces/auth-result.interface';

export interface UserRow {
  user_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RefreshTokenRow {
  refresh_token_id: string;
  user_id: string;
  token_hash: string;
  is_revoked: boolean;
  replaced_by_hash: string | null;
  expires_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PasswordResetTokenRow {
  password_reset_token_id: string;
  user_id: string;
  token_hash: string;
  is_used: boolean;
  expires_at: Date;
  created_at: Date;
}

export interface EmailOtpRow {
  email_otp_id: string;
  user_id: string;
  email: string;
  otp_hash: string;
  purpose: string;
  attempts: number;
  is_used: boolean;
  expires_at: Date;
  created_at: Date;
}

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find a user by lowercase normalized email
   */
  async findUserByEmail(email: string, client?: PoolClient): Promise<UserRow | null> {
    const query = `SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`;
    const res = client ? await client.query(query, [email]) : await this.db.query(query, [email]);
    return res.rows[0] || null;
  }

  /**
   * Find a user by user_id
   */
  async findUserById(userId: string, client?: PoolClient): Promise<UserRow | null> {
    const query = `SELECT * FROM users WHERE user_id = $1 LIMIT 1;`;
    const res = client ? await client.query(query, [userId]) : await this.db.query(query, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Create a new user record
   */
  async createUser(
    userData: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      isActive?: boolean;
      isVerified?: boolean;
    },
    client?: PoolClient,
  ): Promise<UserRow> {
    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const params = [
      userData.email.toLowerCase().trim(),
      userData.passwordHash,
      userData.firstName.trim(),
      userData.lastName.trim(),
      userData.isActive !== undefined ? userData.isActive : true,
      userData.isVerified !== undefined ? userData.isVerified : false,
    ];

    const res = client ? await client.query(query, params) : await this.db.query(query, params);
    return res.rows[0];
  }

  /**
   * Mark user email as verified
   */
  async setUserVerified(userId: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE users
      SET is_verified = true, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1;
    `;
    if (client) {
      await client.query(query, [userId]);
    } else {
      await this.db.query(query, [userId]);
    }
  }

  /**
   * Update user's password
   */
  async updateUserPassword(userId: string, passwordHash: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2;
    `;
    if (client) {
      await client.query(query, [passwordHash, userId]);
    } else {
      await this.db.query(query, [passwordHash, userId]);
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1;`,
      [userId],
    );
  }

  /**
   * Lookup role_id by role name (e.g., 'STUDENT', 'INSTRUCTOR')
   */
  async getRoleIdByName(roleName: string, client?: PoolClient): Promise<string | null> {
    const query = `SELECT role_id FROM roles WHERE name = $1 LIMIT 1;`;
    const res = client ? await client.query(query, [roleName]) : await this.db.query(query, [roleName]);
    return res.rows[0]?.role_id || null;
  }

  /**
   * Assign a role to a user
   */
  async assignUserRole(userId: string, roleId: string, client?: PoolClient): Promise<void> {
    const query = `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role_id) DO NOTHING;
    `;
    if (client) {
      await client.query(query, [userId, roleId]);
    } else {
      await this.db.query(query, [userId, roleId]);
    }
  }

  /**
   * Fetch all roles and granular permissions for a given user dynamically from DB
   */
  async getUserRolesAndPermissions(userId: string, client?: PoolClient): Promise<{
    roles: RoleMetadata[];
    roleNames: string[];
    permissions: string[];
    primaryDashboardRoute: string;
    primaryRoleSlug: string;
  }> {
    const rolesQuery = `
      SELECT 
        r.role_id AS "roleId",
        r.name,
        r.description
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.role_id
      WHERE ur.user_id = $1
      ORDER BY ur.assigned_at ASC;
    `;
    const permQuery = `
      SELECT DISTINCT p.code
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.permission_id
      WHERE ur.user_id = $1;
    `;

    const rolesRes = client ? await client.query(rolesQuery, [userId]) : await this.db.query(rolesQuery, [userId]);
    const permRes = client ? await client.query(permQuery, [userId]) : await this.db.query(permQuery, [userId]);

    const formatDisplayName = (roleName: string): string => {
      return roleName
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    };

    const roles: RoleMetadata[] = rolesRes.rows.map((row) => {
      const slug = row.name.toLowerCase().replace(/_/g, '-');
      return {
        roleId: row.roleId,
        name: row.name,
        displayName: formatDisplayName(row.name),
        slug,
        dashboardRoute: `/dashboard/${slug}`,
        description: row.description,
      };
    });

    const roleNames: string[] = roles.map((r) => r.name);
    const permissions: string[] = permRes.rows.map((row) => row.code);
    const primaryRole = roles[0];

    return {
      roles,
      roleNames,
      permissions,
      primaryDashboardRoute: primaryRole?.dashboardRoute || '/dashboard/student',
      primaryRoleSlug: primaryRole?.slug || 'student',
    };
  }

  /**
   * Insert a new refresh token
   */
  async createRefreshToken(
    tokenData: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      ipAddress?: string;
      userAgent?: string;
    },
    client?: PoolClient,
  ): Promise<RefreshTokenRow> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const params = [
      tokenData.userId,
      tokenData.tokenHash,
      tokenData.expiresAt,
      tokenData.ipAddress || null,
      tokenData.userAgent || null,
    ];

    const res = client ? await client.query(query, params) : await this.db.query(query, params);
    return res.rows[0];
  }

  /**
   * Query refresh token row with ROW-LEVEL LOCKING (FOR UPDATE)
   */
  async findRefreshTokenForUpdate(tokenHash: string, client: PoolClient): Promise<RefreshTokenRow | null> {
    const query = `
      SELECT * FROM refresh_tokens
      WHERE token_hash = $1
      FOR UPDATE;
    `;
    const res = await client.query(query, [tokenHash]);
    return res.rows[0] || null;
  }

  /**
   * Query refresh token row without lock (for read checks)
   */
  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | null> {
    const query = `SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1;`;
    const res = await this.db.query(query, [tokenHash]);
    return res.rows[0] || null;
  }

  /**
   * Mark a refresh token as revoked
   */
  async revokeRefreshToken(
    refreshTokenId: string,
    replacedByHash?: string,
    client?: PoolClient,
  ): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET is_revoked = true, replaced_by_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE refresh_token_id = $2;
    `;
    if (client) {
      await client.query(query, [replacedByHash || null, refreshTokenId]);
    } else {
      await this.db.query(query, [replacedByHash || null, refreshTokenId]);
    }
  }

  /**
   * Revoke all active refresh tokens for a user
   */
  async revokeAllUserRefreshTokens(userId: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE refresh_tokens
      SET is_revoked = true, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_revoked = false;
    `;
    if (client) {
      await client.query(query, [userId]);
    } else {
      await this.db.query(query, [userId]);
    }
  }

  /**
   * Create a password reset token
   */
  async createPasswordResetToken(
    tokenData: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    client?: PoolClient,
  ): Promise<PasswordResetTokenRow> {
    const query = `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const params = [tokenData.userId, tokenData.tokenHash, tokenData.expiresAt];
    const res = client ? await client.query(query, params) : await this.db.query(query, params);
    return res.rows[0];
  }

  /**
   * Find a valid, unexpired, unused password reset token
   */
 async findValidPasswordResetToken(
  tokenHash: string,
  client: PoolClient,
): Promise<PasswordResetTokenRow | null> {
  const query = `
    SELECT *
    FROM password_reset_tokens
    WHERE token_hash = $1
      AND is_used = false
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
    FOR UPDATE;
  `;

  const res = await client.query(query, [tokenHash]);
  return res.rows[0] || null;
}

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenUsed(resetTokenId: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE password_reset_tokens
      SET is_used = true
      WHERE password_reset_token_id = $1;
    `;
    if (client) {
      await client.query(query, [resetTokenId]);
    } else {
      await this.db.query(query, [resetTokenId]);
    }
  }

  // ==========================================================
  // EMAIL OTP METHODS
  // ==========================================================

  /**
   * Invalidate any previous unexpired OTPs for this email and purpose
   */
  async invalidateExistingOtps(email: string, purpose: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE email_otps
      SET is_used = true
      WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_used = false;
    `;
    if (client) {
      await client.query(query, [email, purpose]);
    } else {
      await this.db.query(query, [email, purpose]);
    }
  }

  /**
   * Insert a new OTP record
   */
  async createEmailOtp(
    otpData: {
      userId: string;
      email: string;
      otpHash: string;
      purpose: string;
      expiresAt: Date;
    },
    client?: PoolClient,
  ): Promise<EmailOtpRow> {
    const query = `
      INSERT INTO email_otps (user_id, email, otp_hash, purpose, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const params = [
      otpData.userId,
      otpData.email.toLowerCase().trim(),
      otpData.otpHash,
      otpData.purpose,
      otpData.expiresAt,
    ];
    const res = client ? await client.query(query, params) : await this.db.query(query, params);
    return res.rows[0];
  }

  /**
   * Find the latest active OTP for email & purpose
   */
  async findLatestActiveOtp(email: string, purpose: string): Promise<EmailOtpRow | null> {
    const query = `
      SELECT * FROM email_otps
      WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND is_used = false AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await this.db.query(query, [email, purpose]);
    return res.rows[0] || null;
  }

  /**
   * Increment attempt counter on an OTP
   */
  async incrementOtpAttempts(emailOtpId: string, client?: PoolClient): Promise<number> {
    const query = `
      UPDATE email_otps
      SET attempts = attempts + 1
      WHERE email_otp_id = $1
      RETURNING attempts;
    `;
    const res = client ? await client.query(query, [emailOtpId]) : await this.db.query(query, [emailOtpId]);
    return res.rows[0]?.attempts || 0;
  }

  /**
   * Mark an OTP as used
   */
  async markOtpUsed(emailOtpId: string, client?: PoolClient): Promise<void> {
    const query = `
      UPDATE email_otps
      SET is_used = true
      WHERE email_otp_id = $1;
    `;
    if (client) {
      await client.query(query, [emailOtpId]);
    } else {
      await this.db.query(query, [emailOtpId]);
    }
  }
}

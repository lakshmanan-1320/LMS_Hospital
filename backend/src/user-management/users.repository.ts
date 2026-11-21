
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export interface UserListFilters {
  search?: string;
  role?: string;
  status?: 'active' | 'inactive';
  allowedRoles?: string[];
  page: number;
  limit: number;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable()
export class UsersRepository {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  // List users with search, role, status and pagination.
  async findAll(filters: UserListFilters) {
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const values: unknown[] = [];

    if (filters.search) {
      values.push(`%${filters.search.trim()}%`);
      conditions.push(
        `(u.first_name ILIKE $${values.length}
          OR u.last_name ILIKE $${values.length}
          OR u.email ILIKE $${values.length})`,
      );
    }

    if (filters.status === 'active') {
      conditions.push('u.is_active = TRUE');
    } else if (filters.status === 'inactive') {
      conditions.push('u.is_active = FALSE');
    }

    if (filters.role) {
      values.push(filters.role.toUpperCase());
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM user_roles ur
          INNER JOIN roles r ON r.role_id = ur.role_id
          WHERE ur.user_id = u.user_id
          AND r.name = $${values.length}
        )
      `);
    }

    if (filters.allowedRoles?.length) {
  values.push(filters.allowedRoles.map((role) => role.toUpperCase()));
  conditions.push(`
    EXISTS (
      SELECT 1
      FROM user_roles ur
      INNER JOIN roles r ON r.role_id = ur.role_id
      WHERE ur.user_id = u.user_id
        AND r.name = ANY($${values.length}::VARCHAR[])
    )
  `);
}

    const whereClause = conditions.join(' AND ');

    const page = Math.max(1, filters.page);
    const limit = Math.min(100, Math.max(1, filters.limit));
    const offset = (page - 1) * limit;

    const countResult = await this.databaseService.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM users u
        WHERE ${whereClause};
      `,
      values,
    );

    const dataValues = [...values, limit, offset];

    const usersResult = await this.databaseService.query(
      `
        SELECT
          u.user_id,
          u.email,
          u.first_name,
          u.last_name,
          u.is_active,
          u.is_verified,
          u.last_login_at,
          u.created_at,
          COALESCE(
            ARRAY_AGG(DISTINCT r.name)
              FILTER (WHERE r.name IS NOT NULL),
            ARRAY[]::VARCHAR[]
          ) AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.user_id
        LEFT JOIN roles r ON r.role_id = ur.role_id
        WHERE ${whereClause}
        GROUP BY u.user_id
        ORDER BY u.created_at DESC NULLS LAST
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length};
      `,
      dataValues,
    );

    return {
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(
          Number(countResult.rows[0].total) / limit,
        ),
      },
    };
  }

  // Find one user by ID.
  async findById(userId: string, client?: PoolClient) {
    const query = `
      SELECT
        u.user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_verified,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        u.deleted_at,
        COALESCE(
          ARRAY_AGG(DISTINCT r.name)
            FILTER (WHERE r.name IS NOT NULL),
          ARRAY[]::VARCHAR[]
        ) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.user_id
      LEFT JOIN roles r ON r.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id;
    `;

    const result = client
      ? await client.query(query, [userId])
      : await this.databaseService.query(query, [userId]);

    return result.rows[0] || null;
  }

  // Find a role by its name.
  async findRoleByName(roleName: string, client: PoolClient) {
    const result = await client.query(
      `
        SELECT role_id, name
        FROM roles
        WHERE name = $1
        LIMIT 1;
      `,
      [roleName.toUpperCase()],
    );

    return result.rows[0] || null;
  }

  // Create a user.
  async createUser(
    data: CreateUserData,
    client: PoolClient,
  ) {
    const result = await client.query(
      `
        INSERT INTO users (
          email,
          password_hash,
          first_name,
          last_name,
          is_active,
          is_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          user_id,
          email,
          first_name,
          last_name,
          is_active,
          is_verified,
          created_at;
      `,
      [
        data.email,
        data.passwordHash,
        data.firstName,
        data.lastName,
        data.isActive,
        data.isVerified,
      ],
    );

    return result.rows[0];
  }

  // Assign a role to a user.
  async assignRole(
    userId: string,
    roleId: string,
    client: PoolClient,
  ) {
    await client.query(
      `
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, role_id) DO NOTHING;
      `,
      [userId, roleId],
    );
  }

  // Update basic user details.
  async updateUser(
    userId: string,
    data: UpdateUserData,
    client: PoolClient,
  ) {
    const result = await client.query(
      `
        UPDATE users
        SET
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          email = COALESCE($4, email),
          updated_at = NOW()
        WHERE user_id = $1
          AND deleted_at IS NULL
        RETURNING
          user_id,
          email,
          first_name,
          last_name,
          is_active,
          is_verified,
          updated_at;
      `,
      [
        userId,
        data.firstName ?? null,
        data.lastName ?? null,
        data.email ?? null,
      ],
    );

    return result.rows[0] || null;
  }

  // Activate or deactivate a user.
  async updateStatus(
    userId: string,
    isActive: boolean,
    client: PoolClient,
  ) {
    const result = await client.query(
      `
        UPDATE users
        SET
          is_active = $2,
          updated_at = NOW()
        WHERE user_id = $1
          AND deleted_at IS NULL
        RETURNING user_id, is_active;
      `,
      [userId, isActive],
    );

    return result.rows[0] || null;
  }

  // Soft-delete a user.
  async softDelete(userId: string, client: PoolClient) {
    const result = await client.query(
      `
        UPDATE users
        SET
          deleted_at = NOW(),
          is_active = FALSE,
          updated_at = NOW()
        WHERE user_id = $1
          AND deleted_at IS NULL
        RETURNING user_id, deleted_at;
      `,
      [userId],
    );

    return result.rows[0] || null;
  }

  // Remove a user's role assignment.
  async removeRole(
    userId: string,
    roleId: string,
    client: PoolClient,
  ) {
    await client.query(
      `
        DELETE FROM user_roles
        WHERE user_id = $1
          AND role_id = $2;
      `,
      [userId, roleId],
    );
  }

  // Count active, non-deleted Super Admins.
  async countActiveSuperAdmins(client: PoolClient) {
    const result = await client.query(
      `
        SELECT COUNT(DISTINCT u.user_id)::INTEGER AS total
        FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.user_id
        INNER JOIN roles r ON r.role_id = ur.role_id
        WHERE r.name = 'SUPER_ADMIN'
          AND u.is_active = TRUE
          AND u.deleted_at IS NULL;
      `,
    );

    return Number(result.rows[0].total);
  }
}

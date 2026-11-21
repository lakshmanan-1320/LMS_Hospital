import { Injectable, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { RoleWithPermissions, PermissionEntity } from './interfaces/role-permission.interface';

@Injectable()
export class RolesPermissionsRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findRoles(client?: PoolClient): Promise<RoleWithPermissions[]> {
    const sql = `
      SELECT r.role_id, r.name, r.description,
             COALESCE(ARRAY_AGG(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::VARCHAR[]) AS permissions,
             (SELECT COUNT(DISTINCT u.user_id)::int
                FROM user_roles ur2
                JOIN users u ON u.user_id = ur2.user_id
               WHERE ur2.role_id = r.role_id AND u.is_active = TRUE AND u.deleted_at IS NULL) AS active_users
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
      LEFT JOIN permissions p ON p.permission_id = rp.permission_id
      GROUP BY r.role_id, r.name, r.description
      ORDER BY CASE r.name WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'INSTRUCTOR' THEN 3 WHEN 'STUDENT' THEN 4 ELSE 5 END;
    `;
    const res = client
      ? await client.query<RoleWithPermissions>(sql)
      : await this.databaseService.query<RoleWithPermissions>(sql);
    return res.rows;
  }

  async findPermissions(client?: PoolClient): Promise<PermissionEntity[]> {
    const sql = `
      SELECT p.permission_id, p.code, p.description, p.module_key, m.name AS module_name
      FROM permissions p
      LEFT JOIN platform_modules m ON m.module_key = p.module_key
      ORDER BY m.sort_order NULLS LAST, p.code;
    `;
    const res = client
      ? await client.query<PermissionEntity>(sql)
      : await this.databaseService.query<PermissionEntity>(sql);
    return res.rows;
  }

  /** Locks the role row for the rest of the transaction. Returns its id, or null. */
  async lockRole(client: PoolClient, roleName: string): Promise<string | null> {
    const res = await client.query(`SELECT role_id FROM roles WHERE name = $1 FOR UPDATE;`, [roleName]);
    return res.rows[0]?.role_id || null;
  }

  async addPermissions(client: PoolClient, roleId: string, codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, p.permission_id FROM permissions p WHERE p.code = ANY ($2)
       ON CONFLICT DO NOTHING;`,
      [roleId, codes],
    );
  }

  async removePermissions(client: PoolClient, roleId: string, codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    await client.query(
      `DELETE FROM role_permissions rp
       USING permissions p
       WHERE rp.permission_id = p.permission_id AND rp.role_id = $1 AND p.code = ANY ($2);`,
      [roleId, codes],
    );
  }

  async createAuditLog(
    client: PoolClient,
    entry: { roleId: string; added: string[]; removed: string[]; reason: string; actorId: string; ipAddress?: string },
  ): Promise<void> {
    await client.query(
      `INSERT INTO role_permission_audit_logs
         (role_id, action, added_permissions, removed_permissions, reason, actor_id, ip_address)
       VALUES ($1, 'PERMISSIONS_UPDATED', $2, $3, $4, $5, $6);`,
      [entry.roleId, entry.added, entry.removed, entry.reason, entry.actorId, entry.ipAddress || null],
    );
  }
}

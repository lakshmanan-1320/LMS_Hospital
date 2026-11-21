import { Injectable, Inject } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import { PlatformModuleEntity, ModuleAuditLogEntity } from './interfaces/platform-module.interface';

const MODULE_SELECT = `
  SELECT
    m.module_key, m.name, m.description, m.module_group, m.lifecycle_status,
    m.is_core, m.is_enabled, m.supports_public, m.public_visible,
    m.supported_roles, m.audience_roles, m.depends_on, m.sort_order, m.updated_by, m.updated_at,
    COALESCE(
      (SELECT jsonb_object_agg(r.name, mra.is_visible)
         FROM module_role_access mra
         JOIN roles r ON r.role_id = mra.role_id
        WHERE mra.module_key = m.module_key
          AND r.name = ANY (m.supported_roles)),
      '{}'::jsonb
    ) AS role_visibility
  FROM platform_modules m
`;

@Injectable()
export class PlatformModulesRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findAllModules(client?: PoolClient): Promise<PlatformModuleEntity[]> {
    const sql = `${MODULE_SELECT} ORDER BY m.sort_order ASC, m.module_key ASC;`;
    const res = client
      ? await client.query<PlatformModuleEntity>(sql)
      : await this.databaseService.query<PlatformModuleEntity>(sql);
    return res.rows;
  }

  /** Locks the module row for the rest of the transaction. */
  async lockModule(client: PoolClient, moduleKey: string): Promise<boolean> {
    const res = await client.query(`SELECT 1 FROM platform_modules WHERE module_key = $1 FOR UPDATE;`, [moduleKey]);
    return (res.rowCount ?? 0) > 0;
  }

  async updateModuleState(
    client: PoolClient,
    moduleKey: string,
    state: { isEnabled: boolean; publicVisible: boolean },
    actorId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE platform_modules
       SET is_enabled = $2, public_visible = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP
       WHERE module_key = $1;`,
      [moduleKey, state.isEnabled, state.publicVisible, actorId],
    );
  }

  async setRoleVisibility(client: PoolClient, moduleKey: string, roleName: string, isVisible: boolean): Promise<void> {
    await client.query(
      `INSERT INTO module_role_access (module_key, role_id, is_visible, updated_at)
       SELECT $1, r.role_id, $3, CURRENT_TIMESTAMP FROM roles r WHERE r.name = $2
       ON CONFLICT (module_key, role_id)
       DO UPDATE SET is_visible = EXCLUDED.is_visible, updated_at = CURRENT_TIMESTAMP;`,
      [moduleKey, roleName, isVisible],
    );
  }

  async createAuditLog(
    client: PoolClient,
    entry: {
      moduleKey: string;
      action: string;
      previousState: Record<string, any>;
      newState: Record<string, any>;
      reason: string;
      actorId: string;
      ipAddress?: string;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO module_audit_logs
         (module_key, action, previous_state, new_state, reason, actor_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [
        entry.moduleKey,
        entry.action,
        JSON.stringify(entry.previousState),
        JSON.stringify(entry.newState),
        entry.reason,
        entry.actorId,
        entry.ipAddress || null,
      ],
    );
  }

  /** Active accounts that hold any of these roles (people who lose the feature's menu items). */
  async countActiveUsersWithRoles(roleNames: string[]): Promise<number> {
    if (roleNames.length === 0) return 0;
    const res = await this.databaseService.query(
      `SELECT COUNT(DISTINCT u.user_id)::int AS total
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.user_id
       JOIN roles r ON r.role_id = ur.role_id
       WHERE r.name = ANY ($1) AND u.is_active = TRUE AND u.deleted_at IS NULL;`,
      [roleNames],
    );
    return res.rows[0].total;
  }

  /**
   * Module-specific work in progress that pauses or becomes unreachable when the module is
   * turned off. Keys without an entry have no extra impact beyond hidden menu items.
   */
  async getModuleWorkload(moduleKey: string): Promise<Array<{ label: string; count: number }>> {
    const queries: Record<string, Array<{ label: string; sql: string }>> = {
      webinars: [
        { label: 'Upcoming published webinars', sql: `SELECT COUNT(*)::int AS c FROM webinars WHERE status IN ('published', 'live') AND end_time > NOW()` },
        { label: 'Registrations for upcoming webinars', sql: `SELECT COUNT(*)::int AS c FROM webinar_registrations wr JOIN webinars w ON w.webinar_id = wr.webinar_id WHERE wr.status = 'confirmed' AND w.end_time > NOW() AND w.status <> 'cancelled'` },
      ],
      cart_checkout: [
        { label: 'Carts with items', sql: `SELECT COUNT(DISTINCT cart_id)::int AS c FROM cart_items` },
        { label: 'Payments started in the last 24 hours, not yet captured', sql: `SELECT COUNT(*)::int AS c FROM payment_transactions WHERE status IN ('created', 'attempted') AND created_at > NOW() - INTERVAL '24 hours'` },
      ],
      coupons: [
        { label: 'Active coupons', sql: `SELECT COUNT(*)::int AS c FROM coupons WHERE is_active = TRUE AND (valid_until IS NULL OR valid_until > NOW())` },
        { label: 'Carts with a coupon applied', sql: `SELECT COUNT(*)::int AS c FROM carts WHERE applied_coupon_id IS NOT NULL` },
      ],
      refunds: [
        { label: 'Refund requests awaiting review', sql: `SELECT COUNT(*)::int AS c FROM order_refunds WHERE status = 'pending'` },
      ],
      sms_campaigns: [
        { label: 'SMS campaigns queued or sending', sql: `SELECT COUNT(*)::int AS c FROM campaigns WHERE channel = 'sms' AND status IN ('queued', 'processing')` },
      ],
      email_campaigns: [
        { label: 'Email campaigns queued or sending', sql: `SELECT COUNT(*)::int AS c FROM campaigns WHERE channel = 'email' AND status IN ('queued', 'processing')` },
      ],
      whatsapp_campaigns: [
        { label: 'WhatsApp campaigns queued or sending', sql: `SELECT COUNT(*)::int AS c FROM campaigns WHERE channel = 'whatsapp' AND status IN ('queued', 'processing')` },
      ],
      instructor_profiles: [
        { label: 'Public instructor profiles', sql: `SELECT COUNT(*)::int AS c FROM instructor_profiles WHERE is_public = TRUE` },
      ],
    };

    const items: Array<{ label: string; count: number }> = [];
    for (const q of queries[moduleKey] || []) {
      const res = await this.databaseService.query(q.sql);
      items.push({ label: q.label, count: res.rows[0].c });
    }
    return items;
  }

  async findAuditLogs(query: { moduleKey?: string; page: number; limit: number }) {
    const params: any[] = [];
    let where = '';
    if (query.moduleKey) {
      params.push(query.moduleKey);
      where = `WHERE l.module_key = $1`;
    }

    const countRes = await this.databaseService.query(
      `SELECT COUNT(*)::int AS total FROM module_audit_logs l ${where};`,
      params,
    );
    const total = countRes.rows[0].total;

    const offset = (query.page - 1) * query.limit;
    const dataRes = await this.databaseService.query<ModuleAuditLogEntity>(
      `SELECT l.module_audit_log_id, l.module_key, l.action, l.previous_state, l.new_state,
              l.reason, l.actor_id, u.email AS actor_email, l.ip_address, l.created_at
       FROM module_audit_logs l
       LEFT JOIN users u ON u.user_id = l.actor_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2};`,
      [...params, query.limit, offset],
    );

    return {
      data: dataRes.rows,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditLogEntry, AuditLogSource } from './interfaces/audit-log.interface';

/**
 * One normalized view over the governance audit tables. Each source is a SELECT with the
 * same columns, combined with UNION ALL and filtered/paginated in SQL.
 */
const SOURCE_SQL: Record<AuditLogSource, string> = {
  modules: `
    SELECT l.module_audit_log_id::text AS id, 'modules' AS source, l.action,
           m.name AS subject, l.actor_id,
           jsonb_build_object('module', l.module_key, 'before', l.previous_state,
                              'after', l.new_state, 'reason', l.reason) AS details,
           l.ip_address, l.created_at
    FROM module_audit_logs l
    LEFT JOIN platform_modules m ON m.module_key = l.module_key`,
  roles: `
    SELECT l.role_permission_audit_log_id::text AS id, 'roles' AS source, l.action,
           r.name AS subject, l.actor_id,
           jsonb_build_object('role', r.name, 'added', to_jsonb(l.added_permissions),
                              'removed', to_jsonb(l.removed_permissions), 'reason', l.reason) AS details,
           l.ip_address, l.created_at
    FROM role_permission_audit_logs l
    LEFT JOIN roles r ON r.role_id = l.role_id`,
  webinars: `
    SELECT l.webinar_audit_log_id::text AS id, 'webinars' AS source, l.action,
           w.title AS subject, l.actor_id,
           COALESCE(l.details, '{}'::jsonb) || jsonb_build_object('actorRole', l.actor_role) AS details,
           l.ip_address, l.created_at
    FROM webinar_audit_logs l
    LEFT JOIN webinars w ON w.webinar_id = l.webinar_id`,
  media: `
    SELECT l.log_id::text AS id, 'media' AS source, l.action,
           c.title AS subject, l.actor_id,
           COALESCE(l.details, '{}'::jsonb) AS details,
           NULL::varchar AS ip_address, l.created_at
    FROM media_audit_logs l
    LEFT JOIN courses c ON c.course_id = l.course_id`,
};

@Injectable()
export class AuditLogsRepository {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async findAuditLogs(query: {
    sources: AuditLogSource[];
    search?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }) {
    const union = query.sources.map((s) => SOURCE_SQL[s]).join('\n    UNION ALL\n');

    const conditions: string[] = [];
    const params: any[] = [];
    if (query.search) {
      params.push(`%${query.search}%`);
      conditions.push(
        `(a.action ILIKE $${params.length} OR a.subject ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
      );
    }
    if (query.from) {
      params.push(query.from);
      conditions.push(`a.created_at >= $${params.length}`);
    }
    if (query.to) {
      params.push(query.to);
      conditions.push(`a.created_at <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const base = `
      FROM (${union}) a
      LEFT JOIN users u ON u.user_id = a.actor_id
      ${where}`;

    const countRes = await this.databaseService.query(`SELECT COUNT(*)::int AS total ${base};`, params);
    const total = countRes.rows[0].total;

    const offset = (query.page - 1) * query.limit;
    const dataRes = await this.databaseService.query<AuditLogEntry>(
      `SELECT a.id, a.source, a.action, a.subject, a.actor_id,
              u.email AS actor_email,
              NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS actor_name,
              a.details, a.ip_address, a.created_at
       ${base}
       ORDER BY a.created_at DESC
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

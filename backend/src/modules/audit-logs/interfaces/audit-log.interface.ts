/**
 * Governance audit trail sources. The financial ledger (orders/refunds) is an Admin
 * operation and stays in the Refunds module.
 */
export const AUDIT_LOG_SOURCES = ['modules', 'roles', 'webinars', 'media'] as const;
export type AuditLogSource = (typeof AUDIT_LOG_SOURCES)[number];

export interface AuditLogEntry {
  id: string;
  source: AuditLogSource;
  action: string;
  /** What the action was about: module name, webinar title, course title. */
  subject: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: Date;
}

/** Roles whose permissions Super Admin can edit. */
export const EDITABLE_ROLES = ['ADMIN', 'INSTRUCTOR', 'STUDENT'];

/** Super Admin's role is locked: editing it could lock everyone out of governance. */
export const LOCKED_ROLES = ['SUPER_ADMIN'];

/** Governance permissions stay exclusively with Super Admin (governance-only role split). */
export const GOVERNANCE_PERMISSIONS = ['admins:manage', 'audit_logs:read', 'platform:manage'];

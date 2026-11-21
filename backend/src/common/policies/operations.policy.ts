import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Operations policy: who runs day-to-day platform operations (orders, refunds, coupons,
 * enrollments, courses, curriculum, campaigns).
 *
 * Only ADMIN. SUPER_ADMIN is governance-only (settings, integrations, module management,
 * roles & permissions, audit logs, admin accounts) and deliberately has no operational access.
 * See docs/module-access-rules.md.
 */
export const OPERATIONS_ADMIN_ROLE = 'ADMIN';

export function hasOperationsAdminRole(roles: string[] | undefined | null): boolean {
  return Array.isArray(roles) && roles.some((r) => String(r).toUpperCase() === OPERATIONS_ADMIN_ROLE);
}

export function isOperationsAdmin(user: Partial<Pick<AuthenticatedUser, 'roles'>> | undefined | null): boolean {
  return hasOperationsAdminRole(user?.roles);
}

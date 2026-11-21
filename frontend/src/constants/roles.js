/**
 * Dynamic Role & Authorization Utilities (100% Database-Driven)
 * 
 * All role names, permissions, and dashboard route configurations
 * are fetched dynamically from the PostgreSQL database via API.
 * NO role names or route paths are hardcoded here.
 */

/**
 * Returns the primary dashboard route from the database-driven user profile
 * @param {object} user - The authenticated user object returned by backend
 * @returns {string} Dynamic dashboard URL (e.g., user.primaryDashboardRoute)
 */
export const getDashboardRoute = (user) => {
  if (!user) return '/login';

  // 1. Database-provided primary dashboard route
  if (user.primaryDashboardRoute) {
    return user.primaryDashboardRoute;
  }

  // 2. Check dynamic roles array
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const primary = user.roles[0];
    if (typeof primary === 'object' && primary.dashboardRoute) {
      return primary.dashboardRoute;
    }
    if (typeof primary === 'object' && primary.slug) {
      return `/dashboard/${primary.slug}`;
    }
    if (typeof primary === 'string') {
      return `/dashboard/${primary.toLowerCase().replace(/_/g, '-')}`;
    }
  }

  return '/login';
};

/**
 * Checks whether user has a specific role dynamically (by slug or name)
 * @param {object} user
 * @param {string} roleIdentifier
 * @returns {boolean}
 */
export const hasRole = (user, roleIdentifier) => {
  if (!user || !roleIdentifier) return false;
  const target = roleIdentifier.toString().toLowerCase().trim();

  if (Array.isArray(user.roles)) {
    return user.roles.some((r) => {
      if (typeof r === 'object') {
        return (
          r.slug?.toLowerCase() === target ||
          r.name?.toLowerCase() === target ||
          r.displayName?.toLowerCase() === target
        );
      }
      return r.toLowerCase().replace(/_/g, '-') === target || r.toLowerCase() === target;
    });
  }

  if (Array.isArray(user.roleNames)) {
    return user.roleNames.some(
      (name) => name.toLowerCase() === target || name.toLowerCase().replace(/_/g, '-') === target,
    );
  }

  return false;
};

/**
 * Checks whether user has permission dynamically based on permissions returned from DB
 * @param {object} user
 * @param {string|string[]} requiredPermissions
 * @returns {boolean}
 */
export const hasPermission = (user, requiredPermissions) => {
  if (!user || !user.permissions || !Array.isArray(user.permissions)) return false;

  if (Array.isArray(requiredPermissions)) {
    return requiredPermissions.every((perm) => user.permissions.includes(perm));
  }
  return user.permissions.includes(requiredPermissions);
};

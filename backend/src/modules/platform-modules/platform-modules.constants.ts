/**
 * Platform module keys (rows in platform_modules). Use these with @RequireModule().
 * Rules: docs/module-access-rules.md
 */
export const MODULE_KEYS = {
  // Governance (Super Admin), core
  PLATFORM_SETTINGS: 'platform_settings',
  INTEGRATIONS: 'integrations',
  MODULE_MANAGEMENT: 'module_management',
  ROLES_PERMISSIONS: 'roles_permissions',
  AUDIT_LOGS: 'audit_logs',
  ADMIN_ACCOUNTS: 'admin_accounts',

  // Platform core
  COURSE_CATALOG: 'course_catalog',
  CATEGORIES: 'categories',
  LEARNING: 'learning',
  PAYMENTS: 'payments',
  ORDERS: 'orders',
  TEACHING: 'teaching',
  USER_MANAGEMENT: 'user_management',
  ENROLLMENTS: 'enrollments',
  DASHBOARD: 'dashboard',

  // Toggleable
  INSTRUCTOR_PROFILES: 'instructor_profiles',
  WEBINARS: 'webinars',
  CART_CHECKOUT: 'cart_checkout',
  COUPONS: 'coupons',
  REFUNDS: 'refunds',
  INSTRUCTOR_STUDENTS: 'instructor_students',
  INSTRUCTOR_PERFORMANCE: 'instructor_performance',
  SMS_CAMPAIGNS: 'sms_campaigns',
  EMAIL_CAMPAIGNS: 'email_campaigns',
  WHATSAPP_CAMPAIGNS: 'whatsapp_campaigns',
  REPORTS: 'reports',

  // Coming soon
  REVIEWS_RATINGS: 'reviews_ratings',
  CERTIFICATES: 'certificates',
  WISHLIST: 'wishlist',
  NOTIFICATIONS: 'notifications',
  INSTRUCTOR_EARNINGS: 'instructor_earnings',
} as const;

export type ModuleKey = (typeof MODULE_KEYS)[keyof typeof MODULE_KEYS];

/** Error codes returned in the API error body (`code`), so the frontend can tell them apart. */
export const MODULE_ERROR_CODES = {
  /** Module is turned off platform-wide. */
  MODULE_DISABLED: 'MODULE_DISABLED',
  /** Module is on, but not visible to this audience (public website or the caller's role). */
  MODULE_NOT_AVAILABLE: 'MODULE_NOT_AVAILABLE',
} as const;

/**
 * Roles that keep read-only (GET/HEAD) access to a disabled module's historical data.
 * Admin only: Super Admin is governance-only and has no operational data access.
 */
export const HISTORICAL_READ_ROLES = ['ADMIN'];

export const READ_ONLY_METHODS = ['GET', 'HEAD'];

/** How often each backend instance reloads the registry (picks up changes made on other instances). */
export const MODULE_REGISTRY_REFRESH_MS = 30_000;

/**
 * The only module Super Admin can't switch off or hide, so nobody gets locked out:
 * - module_management: always on, visible to Super Admin (so every change can be undone)
 * Sign-in is not a module at all (auth routes skip module checks). Everything else is fully
 * configurable from Module Management.
 */
export const SAFETY_LOCKS: Record<string, { reason: string; lockedRoles: string[] | 'all'; lockPublic: boolean }> = {
  module_management: {
    reason: 'Super Admin must always reach Module Management to undo changes.',
    lockedRoles: ['SUPER_ADMIN'],
    lockPublic: false,
  },
};

export const ALL_ROLES = ['STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'];

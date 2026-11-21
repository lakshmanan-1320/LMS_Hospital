'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { getDashboardRoute, hasRole, hasPermission } from '@/constants/roles';

/**
 * Client-Side Dynamic Route Guard
 * Verifies authentication, database-driven roles and permissions
 * before rendering protected dashboard views.
 */
export default function ProtectedRoute({ allowedRoles = [], requiredPermissions = [], children }) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    // Dynamic Permission Check (if specified)
    if (requiredPermissions.length > 0) {
      const allowed = hasPermission(user, requiredPermissions);
      if (!allowed) {
        router.replace(getDashboardRoute(user));
        return;
      }
    }

    // Dynamic Role Check (if specified)
    if (allowedRoles.length > 0) {
      // No Super Admin bypass: Super Admin is governance-only and uses its own dashboard,
      // not the Admin/Instructor/Student workspaces.
      const isAllowed = allowedRoles.some((roleIdentifier) => hasRole(user, roleIdentifier));

      if (!isAllowed) {
        // Redirect to user's assigned database-driven dashboard
        router.replace(getDashboardRoute(user));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, isLoading, allowedRoles.join('|'), requiredPermissions.join('|'), router]);

  // Clean loading placeholder matching Elevate design
  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return children;
}

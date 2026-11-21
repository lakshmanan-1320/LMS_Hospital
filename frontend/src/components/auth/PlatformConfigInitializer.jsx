'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { usePlatformConfigStore } from '@/modules/platform-modules/stores/usePlatformConfigStore';

/** Re-check module availability on navigation at most this often (matches the backend registry refresh). */
const REFRESH_MS = 30_000;

/**
 * Loads module availability (Dynamic Module Management) next to AuthInitializer:
 * the public website config, and the signed-in user's access whenever the user changes.
 * Re-checks on navigation so a module a Super Admin just turned off disappears without a reload.
 */
export default function PlatformConfigInitializer() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { fetchPublicConfig, fetchMyAccess, clearMyAccess, myAccessUserId } = usePlatformConfigStore();
  const lastFetch = useRef({ public: 0, mine: 0 });

  useEffect(() => {
    const now = Date.now();
    if (now - lastFetch.current.public > REFRESH_MS) {
      lastFetch.current.public = now;
      fetchPublicConfig();
    }
  }, [pathname, fetchPublicConfig]);

  useEffect(() => {
    if (isAuthenticated && user?.userId) {
      const now = Date.now();
      const userChanged = myAccessUserId !== user.userId;
      if (userChanged || now - lastFetch.current.mine > REFRESH_MS) {
        lastFetch.current.mine = now;
        fetchMyAccess(user.userId);
      }
    } else if (!isAuthenticated && myAccessUserId) {
      lastFetch.current.mine = 0;
      clearMyAccess();
    }
  }, [pathname, isAuthenticated, user?.userId, myAccessUserId, fetchMyAccess, clearMyAccess]);

  return null;
}

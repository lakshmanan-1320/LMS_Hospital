'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Silent Session Initializer
 * Hydrates authentication state once per app load (or page refresh), not on every navigation:
 * login/logout update the store directly, and expired sessions are handled by the API client's
 * 401 → refresh flow. Skips /login and /register to avoid redundant 401s.
 */
export default function AuthInitializer() {
  const pathname = usePathname();
  const checkSession = useAuthStore((state) => state.checkSession);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    // Do not probe session on public auth pages (login, register, password recovery)
    if (pathname && AUTH_PAGES.some((p) => pathname.startsWith(p))) {
      return;
    }

    checked.current = true;
    checkSession();
  }, [pathname, checkSession]);

  return null;
}

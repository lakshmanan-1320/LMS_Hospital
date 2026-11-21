'use client';

import { createContext, useContext } from 'react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

/**
 * Whether the browser sent the `hasSession` cookie with the page request (read by the root
 * layout on the server). It holds no secret: it only says "a refreshable session may exist".
 *
 * Without it, the server-rendered header can't know who is visiting, so it rendered a blank
 * slot until the JavaScript loaded and /auth/me answered: on a first visit, guests saw no
 * "Log in" and signed-in users saw no profile.
 */
const SessionHintContext = createContext(true);

export function SessionHintProvider({ hasSession, children }) {
  return <SessionHintContext.Provider value={Boolean(hasSession)}>{children}</SessionHintContext.Provider>;
}

/**
 * What the header's account area should show:
 * - 'user'    signed in (profile menu)
 * - 'loading' a session cookie exists and is still being verified (avatar skeleton)
 * - 'guest'   no session (Log in), rendered straight from the server, no waiting for JS
 */
export function useHeaderAuthState() {
  const hasSessionHint = useContext(SessionHintContext);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isAuthenticated) return 'user';
  if (isLoading && hasSessionHint) return 'loading';
  return 'guest';
}

/** Placeholder the same size as the profile avatar, shown while the session is verified. */
export function AccountSkeleton() {
  return (
    <span
      aria-label="Loading account"
      role="status"
      className="inline-block h-10 w-10 animate-pulse rounded-full bg-slate-200"
      style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 9999, backgroundColor: '#e2e8f0' }}
    />
  );
}

'use client';

import { useModuleAccess, usePublicModule } from '@/stores/usePlatformConfigStore';
import ModuleUnavailable from './ModuleUnavailable';

/**
 * Renders children only if the module is available; otherwise "This feature isn't available".
 *
 * - audience="public" (default): public website visibility (anyone browsing the site).
 * - audience="user": the signed-in user's access (e.g. the cart, which requires sign-in).
 *
 * UI only: the backend ModuleAccessGuard still enforces every request.
 */
export default function ModuleGate({ moduleKey, audience = 'public', children }) {
  const publicVisible = usePublicModule(moduleKey);
  const access = useModuleAccess(moduleKey);

  const blocked = audience === 'user' ? access === 'none' : !publicVisible;
  if (blocked) return <ModuleUnavailable />;
  return children;
}

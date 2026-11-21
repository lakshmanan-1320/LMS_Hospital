'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

/**
 * Client-side guard for public learner pages that need an account (cart, my learning).
 * Any role is allowed: these pages are about the signed-in person's own purchases.
 * The API enforces the real rules (ownership, enrollment); this only avoids showing an empty page.
 */
export default function RequireSignIn({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname;
      router.replace(`/login?redirect=${encodeURIComponent(back)}`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }
  return children;
}

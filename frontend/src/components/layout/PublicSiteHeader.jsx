'use client';

import Link from 'next/link';
import { Layers3, ShoppingCart, LogIn } from 'lucide-react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useHeaderAuthState, AccountSkeleton } from '@/components/auth/SessionHint';
import { useModuleAccess, usePublicModule } from '@/stores/usePlatformConfigStore';
import AccountMenu from './AccountMenu';

/**
 * Header for the public learner-facing pages (cart, my learning, course player).
 * Learning and buying live on the public site for every role (Udemy-style); the dashboard
 * link is only shown to roles that actually have a management workspace.
 */
export default function PublicSiteHeader() {
  const { isAuthenticated } = useAuthStore();
  const headerAuth = useHeaderAuthState();
  const showWebinars = usePublicModule('webinars');
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
      <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
          <Layers3 size={18} />
        </span>
        <span>
          elevate<span className="text-violet-600">.</span>
        </span>
      </Link>

      <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
        <Link href="/#courses" className="transition hover:text-violet-600">Explore Courses</Link>
        {showWebinars && (
          <Link href="/webinars" className="transition hover:text-violet-600">Live Webinars</Link>
        )}
        {isAuthenticated && (
          <Link href="/my-learning" className="transition hover:text-violet-600">My learning</Link>
        )}
      </nav>

      <div className="flex items-center gap-3">
        {salesOpen && (
        <Link
          href="/cart"
          aria-label="Cart"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-900 transition hover:bg-slate-200"
        >
          <ShoppingCart size={18} />
        </Link>
        )}
        {headerAuth === 'loading' ? (
          <AccountSkeleton />
        ) : headerAuth === 'guest' ? (
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogIn size={15} /> Log in
          </Link>
        ) : (
          <AccountMenu />
        )}
      </div>
    </header>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, ShoppingCart, LayoutDashboard, LogOut, Receipt } from 'lucide-react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { getDashboardRoute, hasRole } from '@/constants/roles';
import { useModuleAccess } from '@/stores/usePlatformConfigStore';

/**
 * Signed-in profile menu for the public site (Udemy-style): shows who is signed in, so every
 * purchase and course in "My learning" is clearly tied to this account.
 */
export default function AccountMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email?.split('@')[0] || 'Account';
  const initials =
    (user.firstName?.[0] || '') + (user.lastName?.[0] || '') || (user.email?.[0] || 'U');
  const roleLabel = user.roleNames?.[0] || (typeof user.roles?.[0] === 'string' ? user.roles[0] : '');
  const hasWorkspace =
    hasRole(user, 'INSTRUCTOR') || hasRole(user, 'ADMIN') || hasRole(user, 'SUPER_ADMIN');

  const handleLogout = async () => {
    setOpen(false);
    try {
      await logout();
    } finally {
      router.push('/');
    }
  };

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${fullName} (${user.email})`}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold uppercase text-white ring-offset-2 transition hover:ring-2 hover:ring-violet-500"
      >
        {initials.toUpperCase()}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-[#191b38] shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 pb-3 pt-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold uppercase text-white">
              {initials.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{fullName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
              {roleLabel && (
                <span className="mt-1 inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  {String(roleLabel).replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="py-1">
            <Link href="/my-learning" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <GraduationCap size={16} /> My learning
            </Link>
            {salesOpen && (
            <Link href="/cart" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                <ShoppingCart size={16} /> My cart
              </Link>
            )}
            {/* Admin runs operations (all orders). Super Admin is governance-only: it sees just its own purchases. */}
            <Link
              href={
                hasRole(user, 'ADMIN')
                  ? '/dashboard/admin/orders'
                  : hasRole(user, 'SUPER_ADMIN')
                  ? '/dashboard/super-admin/orders'
                  : hasRole(user, 'INSTRUCTOR')
                  ? '/dashboard/instructor/orders'
                  : '/dashboard/student/orders'
              }
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <Receipt size={16} /> {hasRole(user, 'ADMIN') ? 'Platform Orders' : 'Purchase history'}
            </Link>
            {hasWorkspace && (
              <Link
                href={getDashboardRoute(user)}
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                <LayoutDashboard size={16} /> Dashboard
              </Link>
            )}
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button type="button" role="menuitem" onClick={handleLogout} className={`${itemClass} text-rose-600 hover:bg-rose-50`}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

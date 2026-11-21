'use client';

import { Suspense } from 'react';
import PublicSiteHeader from '@/components/layout/PublicSiteHeader';
import RequireSignIn from '@/components/auth/RequireSignIn';
import CartView from '@/modules/cart/components/CartView';
import ModuleGate from '@/components/layout/ModuleGate';

/**
 * Public shopping cart (Udemy-style): on the website, not inside a dashboard, same for every role.
 * No guest checkout: signed-out visitors are sent to log in / register and brought back here (?coupon= kept).
 */
export default function CartPage() {
  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      <PublicSiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <RequireSignIn>
          <ModuleGate moduleKey="cart_checkout" audience="user">
            <Suspense fallback={null}>
              <CartView browseHref="/#courses" />
            </Suspense>
          </ModuleGate>
        </RequireSignIn>
      </main>
    </div>
  );
}

'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * The cart lives on the public website now (/cart), like Udemy.
 * This route only forwards old links/bookmarks there, keeping any ?coupon= code.
 */
function DashboardCartRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    router.replace(qs ? `/cart?${qs}` : '/cart');
  }, [router, searchParams]);

  return null;
}

export default function DashboardCartPage() {
  return (
    <Suspense fallback={null}>
      <DashboardCartRedirect />
    </Suspense>
  );
}

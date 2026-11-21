'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CouponManagementView from '@/modules/coupons/components/CouponManagementView';

export default function CouponsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // Instructors and Admins manage coupons; Super Admin is governance-only
    if (rawRole === 'student') {
      router.replace('/cart');
    } else if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'student' || rawRole === 'super-admin') {
    return null;
  }

  return <CouponManagementView role={rawRole || 'admin'} />;
}


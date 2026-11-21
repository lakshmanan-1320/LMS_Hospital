'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import OrderListView from '@/modules/orders/components/OrderListView';

/**
 * Orders: Admin sees the platform ledger; every other role (students, instructors who buy
 * other instructors' courses, Super Admin) sees its own purchase history.
 */
export default function OrdersDashboardPage() {
  const params = useParams();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role || 'student';

  return <OrderListView role={rawRole} />;
}

'use client';

import React from 'react';
import StudentPurchaseHistoryView from './StudentPurchaseHistoryView';
import AdminOrdersLedgerView from './AdminOrdersLedgerView';

/**
 * OrderListView
 * Routes to the consumer-grade Udemy-style "Purchase history" for students,
 * or the full-featured platform ledger for administrators.
 */
export default function OrderListView({ role = 'student' }) {
  // Only Admin sees the platform order ledger; Super Admin (governance-only) sees its own purchases.
  const isAdmin = role === 'admin';

  if (isAdmin) {
    return <AdminOrdersLedgerView role={role} />;
  }

  return <StudentPurchaseHistoryView />;
}

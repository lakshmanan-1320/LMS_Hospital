'use client';

import { useParams } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function RoleDashboardLayout({ children }) {
  const params = useParams();

  const rawRole = Array.isArray(params.role)
    ? params.role[0]
    : params.role;

  return (
    <ProtectedRoute allowedRoles={[rawRole]}>
      <DashboardShell role={rawRole}>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
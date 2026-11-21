'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdminAccountsView from '@/modules/admin-accounts/components/AdminAccountsView';

export default function AdminAccountsPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // Admin Accounts is a Super Admin governance screen
    if (rawRole && rawRole !== 'super-admin') {
      router.replace(`/dashboard/${rawRole}`);
    }
  }, [rawRole, router]);

  if (rawRole !== 'super-admin') {
    return null;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminAccountsView />
    </div>
  );
}

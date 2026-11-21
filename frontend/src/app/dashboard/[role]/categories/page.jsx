
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CategoryManagementView from '@/modules/categories/components/CategoryManagementView';

export default function CategoriesPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // Categories module is restricted to admin, not super-admin
    if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'super-admin') {
    return null;
  }

  return <CategoryManagementView />;
}

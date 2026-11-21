'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import InstructorReviewsView from '@/modules/reviews/components/InstructorReviewsView';
import AdminReviewsModerationView from '@/modules/reviews/components/AdminReviewsModerationView';

export default function ReviewsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;

  useEffect(() => {
    if (rawRole === 'student') {
      router.replace('/my-learning');
    }
  }, [rawRole, router]);

  if (rawRole === 'student') {
    return null;
  }

  if (rawRole === 'instructor') {
    return <InstructorReviewsView />;
  }

  // Admin or Super Admin
  return <AdminReviewsModerationView />;
}

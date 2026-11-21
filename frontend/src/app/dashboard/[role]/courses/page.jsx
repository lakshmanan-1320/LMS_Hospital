'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CourseManagementView from '@/modules/courses/components/CourseManagementView';

export default function CoursesPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;

  useEffect(() => {
    // Courses module is restricted to admin and instructor, not super-admin
    if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'super-admin') {
    return null;
  }

  return <CourseManagementView role={rawRole || 'instructor'} />;
}


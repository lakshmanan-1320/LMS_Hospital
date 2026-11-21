'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import CourseEditorView from '@/modules/courses/components/CourseEditorView';

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    // Courses module is restricted to admin and instructor, not super-admin
    if (rawRole === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [rawRole, router]);

  if (rawRole === 'super-admin') {
    return null;
  }

  // The URL segment is the course slug (older links with a UUID still work)
  return <CourseEditorView courseRef={rawId} role={rawRole || 'instructor'} />;
}


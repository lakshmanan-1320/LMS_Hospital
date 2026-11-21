'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** The course player lives on the public site (/my-learning/[courseId]). Forwards old links. */
export default function DashboardCoursePlayerRedirect() {
  const router = useRouter();
  const { courseId } = useParams();
  useEffect(() => {
    router.replace(courseId ? `/my-learning/${encodeURIComponent(courseId)}` : '/my-learning');
  }, [router, courseId]);
  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Learning lives on the public site (/my-learning), not in a dashboard. Forwards old links. */
export default function DashboardMyLearningRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/my-learning');
  }, [router]);
  return null;
}

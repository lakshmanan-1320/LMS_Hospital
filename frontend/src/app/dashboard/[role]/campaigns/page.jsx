'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CampaignsRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const role = params?.role || 'admin';

  useEffect(() => {
    router.replace(`/dashboard/${role}/campaigns/sms`);
  }, [role, router]);

  return (
    <div className="p-12 text-center text-slate-400 text-xs">
      Loading Campaigns module...
    </div>
  );
}

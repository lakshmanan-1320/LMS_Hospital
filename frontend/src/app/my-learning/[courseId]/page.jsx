'use client';

import PublicSiteHeader from '@/components/layout/PublicSiteHeader';
import RequireSignIn from '@/components/auth/RequireSignIn';
import CoursePlayerView from '@/modules/learning/components/CoursePlayerView';

/** Course player on the public site. Lesson access is enforced server-side by enrollment. */
export default function CoursePlayerPage() {
  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      <PublicSiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <RequireSignIn>
          <CoursePlayerView />
        </RequireSignIn>
      </main>
    </div>
  );
}

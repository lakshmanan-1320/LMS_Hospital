'use client';

import PublicSiteHeader from '@/components/layout/PublicSiteHeader';
import RequireSignIn from '@/components/auth/RequireSignIn';
import MyLearningView from '@/modules/learning/components/MyLearningView';

/** Public learner area (Udemy-style /my-learning): every role's purchased/enrolled courses. */
export default function MyLearningPage() {
  return (
    <div className="min-h-screen bg-[#f7f6ff] text-[#191b38]">
      <PublicSiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <RequireSignIn>
          <MyLearningView />
        </RequireSignIn>
      </main>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { UserCheck, Loader2 } from 'lucide-react';
import { useInstructorStore } from '@/modules/instructors/stores/useInstructorStore';
import InstructorProfileEditor from '@/modules/instructors/components/InstructorProfileEditor';

export default function InstructorProfilePage() {
  const params = useParams();
  const role = Array.isArray(params.role) ? params.role[0] : params.role;

  const {
    profile,
    fetchMyProfile,
    updateMyProfile,
    uploadAvatar,
    isLoading,
    isSaving,
    isUploadingAvatar,
    error,
    successMessage,
    clearMessages,
  } = useInstructorStore();

  useEffect(() => {
    fetchMyProfile().catch(() => {});
  }, [fetchMyProfile]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Instructor Profile & Brand Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure your professional headline, biography, qualifications, expertise, and public directory visibility.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs">
          <UserCheck size={16} className="text-violet-600" />
          <span>Profile Settings</span>
        </div>
      </div>

      {isLoading && !profile ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-16">
          <Loader2 size={32} className="animate-spin text-violet-600" />
          <p className="mt-3 text-sm text-slate-500">Loading your profile details...</p>
        </div>
      ) : (
        <InstructorProfileEditor
          profile={profile}
          onSave={updateMyProfile}
          onUploadAvatar={uploadAvatar}
          isSaving={isSaving}
          isUploadingAvatar={isUploadingAvatar}
          error={error}
          successMessage={successMessage}
          onClearMessages={clearMessages}
        />
      )}
    </div>
  );
}


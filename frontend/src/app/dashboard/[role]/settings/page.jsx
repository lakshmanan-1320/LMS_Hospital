'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Globe, Video, Settings as SettingsIcon, RotateCcw, Award, KeyRound } from 'lucide-react';
import CourseLanguageSettingsView from '@/modules/courses/components/CourseLanguageSettingsView';
import MeetingProvidersSettingsView from '@/modules/settings/components/MeetingProvidersSettingsView';
import SuperAdminSettingsView from '@/modules/settings/components/SuperAdminSettingsView';
import RefundPolicySettingsView from '@/modules/settings/components/RefundPolicySettingsView';
import CourseBadgeSettingsView from '@/modules/settings/components/CourseBadgeSettingsView';

export default function SettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = params?.role || 'admin';

  // For Admin role: Support tab navigation (?tab=languages, ?tab=meeting-providers, or ?tab=refunds)
  const tabFromUrl = searchParams.get('tab');
  const initialTab =
    tabFromUrl === 'refunds'
      ? 'refunds'
      : tabFromUrl === 'badges'
      ? 'badges'
      : tabFromUrl === 'meeting-providers' || searchParams.get('code')
      ? 'meeting-providers'
      : 'languages';

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const codeParam = searchParams.get('code');
    if (tabParam === 'refunds') {
      setActiveTab('refunds');
    } else if (tabParam === 'badges') {
      setActiveTab('badges');
    } else if (tabParam === 'meeting-providers' || codeParam) {
      setActiveTab('meeting-providers');
    }
  }, [searchParams]);

  // 1. Super Admin View: Platform settings (Google OAuth master keys, system configuration)
  if (role === 'super-admin') {
    const saTab = activeTab === 'badges' ? 'badges' : 'providers';
    const tabClass = (on) =>
      `py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
        on ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`;
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Settings Tabs">
            <button
              type="button"
              className={tabClass(saTab === 'providers')}
              onClick={() => {
                setActiveTab('meeting-providers');
                router.replace(`/dashboard/${role}/settings`, { scroll: false });
              }}
            >
              <KeyRound size={18} />
              <span>Provider credentials</span>
            </button>
            <button
              type="button"
              className={tabClass(saTab === 'badges')}
              onClick={() => {
                setActiveTab('badges');
                router.replace(`/dashboard/${role}/settings?tab=badges`, { scroll: false });
              }}
            >
              <Award size={18} />
              <span>Course badges</span>
            </button>
          </nav>
        </div>
        {saTab === 'badges' ? <CourseBadgeSettingsView /> : <SuperAdminSettingsView />}
      </div>
    );
  }

  // 2. Admin View: Tabbed settings (Course Languages, Meeting & Video Providers)
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admin Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage system configurations, supported course languages, and video meeting integrations.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Settings Tabs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('languages');
              router.replace(`/dashboard/${role}/settings?tab=languages`, { scroll: false });
            }}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'languages'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe size={18} />
            <span>Course Languages</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('meeting-providers');
              router.replace(`/dashboard/${role}/settings?tab=meeting-providers`, { scroll: false });
            }}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'meeting-providers'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Video size={18} />
            <span>Meeting &amp; Video Providers</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('refunds');
              router.replace(`/dashboard/${role}/settings?tab=refunds`, { scroll: false });
            }}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'refunds'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <RotateCcw size={18} />
            <span>Refund Policy &amp; Guarantee</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('badges');
              router.replace(`/dashboard/${role}/settings?tab=badges`, { scroll: false });
            }}
            className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'badges'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Award size={18} />
            <span>Course Badges</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'languages' ? (
          <CourseLanguageSettingsView role={role} />
        ) : activeTab === 'meeting-providers' ? (
          <MeetingProvidersSettingsView role={role} />
        ) : activeTab === 'badges' ? (
          <CourseBadgeSettingsView />
        ) : (
          <RefundPolicySettingsView />
        )}
      </div>
    </div>
  );
}

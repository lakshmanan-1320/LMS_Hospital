'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Video,
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Shield,
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Mail,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  Globe,
  Radio,
  Pencil,
  AlertTriangle,
  Send,
  Timer,
  Lock,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { webinarService } from '@/modules/webinars/services/webinar.service';

export default function WebinarDetailsHubPage() {
  const params = useParams();
  const router = useRouter();
  const rawRole = Array.isArray(params.role) ? params.role[0] : params.role;
  const role = rawRole?.toLowerCase() || 'admin';
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const { user } = useAuthStore();
  const {
    adminWebinarDetails,
    fetchAdminWebinarDetails,
    registrants,
    fetchRegistrants,
    analytics,
    fetchAnalytics,
    startLiveSession,
    endLiveSession,
    rescheduleWebinar,
    cancelWebinar,
    resendConfirmation,
    isLoading,
    isSaving,
    error,
    successMessage,
    clearMessages,
  } = useWebinarStore();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'roster' | 'analytics' | 'host'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHostLink, setCopiedHostLink] = useState(false);

  // Host Join URL state
  const [hostJoinUrl, setHostJoinUrl] = useState('');
  const [loadingHostUrl, setLoadingHostUrl] = useState(false);

  // Modals state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'UTC',
    reason: '',
  });

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Roster Filters
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const [resendingEmailId, setResendingEmailId] = useState(null);

  // Guard: SUPER_ADMIN blocked
  useEffect(() => {
    if (role === 'super-admin') {
      router.replace('/dashboard/super-admin');
    }
  }, [role, router]);

  // Initial load
  const loadData = useCallback(async () => {
    if (!slug) return;
    try {
      await fetchAdminWebinarDetails(slug);
      await fetchAnalytics(slug);
    } catch (err) {
      console.error('Failed to load webinar hub details:', err);
    }
  }, [slug, fetchAdminWebinarDetails, fetchAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load roster when roster tab is active
  useEffect(() => {
    if (activeTab === 'roster' && slug) {
      fetchRegistrants(slug, {
        search: rosterSearch,
        page: rosterPage,
        limit: 50,
      }).catch(console.error);
    }
  }, [activeTab, slug, rosterSearch, rosterPage, fetchRegistrants]);

  // Fetch host join link securely
  const handleFetchHostUrl = async () => {
    try {
      setLoadingHostUrl(true);
      const res = await webinarService.getHostJoinUrl(slug);
      if (res?.hostJoinUrl) {
        setHostJoinUrl(res.hostJoinUrl);
        window.open(res.hostJoinUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(err?.message || 'Failed to retrieve elevated host launch link');
    } finally {
      setLoadingHostUrl(false);
    }
  };

  // Copy public landing URL
  const handleCopyPublicUrl = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/webinars/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Format date helper
  const formatDateTime = (dateStr) => {
    if (!dateStr) return { date: '—', time: '—' };
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  // Start Live Session
  const handleStartSession = async () => {
    const confirmed = window.confirm(
      'Are you ready to transition this session to LIVE? Participants will be able to enter the live room.'
    );
    if (!confirmed) return;
    try {
      await startLiveSession(slug);
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to start live session');
    }
  };

  // End Live Session
  const handleEndSession = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to end this live session? This will finalize attendance duration for all participants.'
    );
    if (!confirmed) return;
    try {
      await endLiveSession(slug);
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to end live session');
    }
  };

  // Handle Reschedule submit
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleData.startDate || !rescheduleData.startTime || !rescheduleData.endDate || !rescheduleData.endTime) {
      alert('Please fill all date and time fields.');
      return;
    }
    const startIso = new Date(`${rescheduleData.startDate}T${rescheduleData.startTime}`).toISOString();
    const endIso = new Date(`${rescheduleData.endDate}T${rescheduleData.endTime}`).toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      alert('End time must be after start time.');
      return;
    }

    try {
      await rescheduleWebinar(slug, {
        startTime: startIso,
        endTime: endIso,
        timezone: rescheduleData.timezone,
        reason: rescheduleData.reason.trim() || undefined,
      });
      setShowRescheduleModal(false);
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to reschedule webinar.');
    }
  };

  // Handle Cancel submit
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancelling this event.');
      return;
    }
    try {
      await cancelWebinar(slug, cancelReason.trim());
      setShowCancelModal(false);
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to cancel webinar.');
    }
  };

  // Resend Confirmation Email
  const handleResendEmail = async (email, regId) => {
    try {
      setResendingEmailId(regId);
      await resendConfirmation(slug, email);
      alert(`Confirmation instructions resent to ${email}`);
    } catch (err) {
      alert(err?.message || 'Failed to resend confirmation email.');
    } finally {
      setResendingEmailId(null);
    }
  };

  const webinar = adminWebinarDetails;
  const isAssignedHost = webinar?.hosts?.some((h) => h.user_id === user?.userId);
  const canManage = role === 'admin' || isAssignedHost;

  if (role === 'super-admin') return null;

  if (isLoading && !webinar) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Loading webinar command hub...</p>
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Webinar Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">
          The requested webinar slug <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">/{slug}</code> was not found or has been removed.
        </p>
        <Link
          href={`/dashboard/${role}/webinars`}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Webinars</span>
        </Link>
      </div>
    );
  }

  const { date: startDateStr, time: startTimeStr } = formatDateTime(webinar.start_time);
  const { date: endDateStr, time: endTimeStr } = formatDateTime(webinar.end_time);

  return (
    <div className="w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            href={`/dashboard/${role}/webinars`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Webinars</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{webinar.title}</h1>
            {/* Status Chip */}
            {webinar.status === 'live' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                LIVE NOW
              </span>
            )}
            {webinar.status === 'scheduled' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Calendar className="w-3 h-3" />
                Scheduled
              </span>
            )}
            {webinar.status === 'completed' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <CheckCircle2 className="w-3 h-3" />
                Completed
              </span>
            )}
            {webinar.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <XCircle className="w-3 h-3" />
                Cancelled
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {startDateStr}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {startTimeStr} - {endTimeStr} ({webinar.timezone || 'UTC'})
            </span>
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
              /{webinar.slug}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Public Page Share */}
          <button
            type="button"
            onClick={handleCopyPublicUrl}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied Public URL!' : 'Copy Public Link'}</span>
          </button>

          <Link
            href={`/webinars/${webinar.slug}`}
            target="_blank"
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
            title="Open Public Registration Landing Page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>

          {/* Edit Button (Admin Only) */}
          {role === 'admin' && webinar.status !== 'completed' && webinar.status !== 'cancelled' && (
            <Link
              href={`/dashboard/${role}/webinars/${webinar.slug}/edit`}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Link>
          )}

          {/* Host Launch Link */}
          {canManage && (
            <button
              type="button"
              disabled={loadingHostUrl}
              onClick={handleFetchHostUrl}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <Video className="w-4 h-4" />
              <span>{loadingHostUrl ? 'Opening Meeting...' : 'Join Live Meeting'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications banner */}
      {(successMessage || error) && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            error
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{error || successMessage}</span>
          </div>
          <button
            onClick={clearMessages}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live State Action Bar */}
      {webinar.status === 'scheduled' && canManage && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Broadcast Control Center</h4>
              <p className="text-xs text-slate-600">
                Ready to go live? Starting the broadcast will transition the webinar status and permit registrants into the session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRescheduleData({
                  startDate: webinar.start_time?.split('T')[0] || '',
                  startTime: webinar.start_time?.split('T')[1]?.substring(0, 5) || '',
                  endDate: webinar.end_time?.split('T')[0] || '',
                  endTime: webinar.end_time?.split('T')[1]?.substring(0, 5) || '',
                  timezone: webinar.timezone || 'UTC',
                  reason: '',
                });
                setShowRescheduleModal(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
            >
              Reschedule
            </button>

            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 shadow-sm"
            >
              Cancel Event
            </button>

            <button
              onClick={handleStartSession}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Live Broadcast</span>
            </button>
          </div>
        </div>
      )}

      {webinar.status === 'live' && canManage && (
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md">
              <Radio className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-900">Event is Currently LIVE!</h4>
              <p className="text-xs text-rose-700">
                Participants are entering the live room. Attendance intervals are being recorded automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchHostUrl}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
            >
              Open Host Room
            </button>
            <button
              onClick={handleEndSession}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-sm"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>End Live Broadcast</span>
            </button>
          </div>
        </div>
      )}

      {/* Hub Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview & Host Access
          </button>

          <button
            onClick={() => setActiveTab('roster')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'roster'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Registrants Roster</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
              {webinar.total_registrations || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Campaign & Traffic Attribution</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: OVERVIEW & HOST CREDENTIALS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description & Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">About this Webinar</h3>
              {webinar.short_description && (
                <p className="text-sm font-medium text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {webinar.short_description}
                </p>
              )}
              <div className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {webinar.description || 'No detailed agenda provided.'}
              </div>
            </div>

            {/* Registration Form Fields (Standard System Fields + Custom Fields) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Registration Form Fields</h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Configured for Public Landing Page
                </span>
              </div>

              {/* Standard Fields */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Standard System Fields (Required)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(webinar.standard_registration_fields || [
                    { id: 'first_name', label: 'First Name', type: 'text' },
                    { id: 'last_name', label: 'Last Name', type: 'text' },
                    { id: 'email', label: 'Email Address', type: 'email' },
                    { id: 'phone', label: 'Phone Number', type: 'tel' },
                  ]).map((f) => (
                    <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{f.label}</span>
                        <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-slate-500 bg-white border border-slate-200 px-1 py-0.5 rounded">
                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                          Required
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-indigo-600 mt-1 uppercase">
                        Type: {f.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Questions */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Additional Custom Questions
                </span>
                {webinar.custom_registration_fields?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {webinar.custom_registration_fields.map((f) => (
                      <div key={f.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <div className="font-semibold text-slate-800">{f.label}</div>
                        <div className="text-slate-500 mt-1 flex items-center justify-between">
                          <span className="uppercase font-mono">{f.type}</span>
                          {f.required ? (
                            <span className="text-rose-600 font-semibold">Required</span>
                          ) : (
                            <span className="text-slate-400">Optional</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No custom questions configured. Participants only provide the standard system fields above.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Info (1 Col) */}
          <div className="space-y-6">
            {/* Provider Conference & Host Access Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {webinar.provider === 'zoom'
                        ? 'Zoom Video Session'
                        : webinar.provider === 'zoho'
                        ? 'Zoho Meeting Session'
                        : 'Google Meet Session'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Auto-generated conference meeting</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Active
                </span>
              </div>

              {/* Real Generated Meet Link */}
              {webinar.meeting_link ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Conference Video Link
                    </label>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 break-all">
                      <span className="truncate pr-2">{webinar.meeting_link}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(webinar.meeting_link);
                          setCopiedHostLink(true);
                          setTimeout(() => setCopiedHostLink(false), 2000);
                        }}
                        className="text-slate-500 hover:text-indigo-600 flex-shrink-0 p-1"
                        title="Copy Video Link"
                      >
                        {copiedHostLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {webinar.passcode && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Passcode:</span>
                      <span className="font-bold">{webinar.passcode}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 text-amber-600" />
                  <span>Meeting link will be generated automatically once the provider account is connected.</span>
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed">
                This meeting room was automatically scheduled via{' '}
                <strong className="text-slate-700">
                  {webinar.provider === 'zoom'
                    ? 'Zoom Video'
                    : webinar.provider === 'zoho'
                    ? 'Zoho Meeting'
                    : 'Google Meet'}
                </strong>{' '}
                for this webinar. The host and all registered students receive this link and session invitations.
              </p>

              {canManage && (
                <button
                  type="button"
                  disabled={loadingHostUrl}
                  onClick={handleFetchHostUrl}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  <span>
                    {loadingHostUrl
                      ? 'Opening Meeting...'
                      : `Join ${
                          webinar.provider === 'zoom'
                            ? 'Zoom'
                            : webinar.provider === 'zoho'
                            ? 'Zoho'
                            : 'Google Meet'
                        } as Host`}
                  </span>
                </button>
              )}
            </div>

            {/* Designated Host */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Designated Host</h3>
              <div className="space-y-3">
                {webinar.hosts && webinar.hosts.length > 0 ? (
                  webinar.hosts.map((host) => (
                    <div key={host.user_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {host.first_name} {host.last_name}
                        </div>
                        <div className="text-xs text-slate-500">{host.email}</div>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                        Session Host
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 p-2">No host assigned</div>
                )}
              </div>
            </div>

            {/* Capacity Meter */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">Capacity & Registrations</h3>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-2xl font-bold text-slate-900">
                    {webinar.total_registrations || 0}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">
                    / {webinar.max_participants || 100} capacity
                  </span>
                </div>
                <span className="text-xs font-semibold text-indigo-600">
                  {Math.round(
                    ((webinar.total_registrations || 0) / (webinar.max_participants || 100)) * 100
                  )}%
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((webinar.total_registrations || 0) / (webinar.max_participants || 100)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTRANTS ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search registrants by name, email, or phone..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-500">
              Total Verified: <span className="font-bold text-slate-800">{registrants.total}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400">Loading roster...</div>
            ) : registrants.items.length === 0 ? (
              <div className="py-16 text-center text-slate-400 px-4">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No registrants found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Share the public landing link to begin gathering registrations.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">Participant</th>
                      <th className="px-5 py-3.5">Contact Details</th>
                      <th className="px-5 py-3.5">Traffic Attribution</th>
                      <th className="px-5 py-3.5">Email Delivery</th>
                      <th className="px-5 py-3.5">Attendance</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrants.items.map((reg) => (
                      <tr key={reg.webinar_registration_id} className="hover:bg-slate-50/70 transition">
                        {/* Name */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{reg.full_name}</div>
                          <div className="text-[11px] text-slate-400">
                            Registered {new Date(reg.created_at).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="text-slate-800 font-medium">{reg.email}</div>
                          <div className="text-xs text-slate-400">{reg.phone || '—'}</div>
                        </td>

                        {/* Attribution */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {reg.utm_source ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Globe className="w-3 h-3" />
                              {reg.utm_source}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">direct / referral</span>
                          )}
                          {reg.utm_campaign && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {reg.utm_campaign}
                            </div>
                          )}
                        </td>

                        {/* Email Delivery */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {reg.confirmation_delivery_status === 'delivered' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Delivered
                            </span>
                          ) : reg.confirmation_delivery_status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                              <XCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pending</span>
                          )}
                        </td>

                        {/* Attendance */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {reg.total_duration_minutes > 0 ? (
                            <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                              <Timer className="w-3.5 h-3.5" />
                              <span>{reg.total_duration_minutes} mins attended</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Not joined</span>
                          )}
                        </td>

                        {/* Resend email */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <button
                            type="button"
                            disabled={resendingEmailId === reg.webinar_registration_id}
                            onClick={() => handleResendEmail(reg.email, reg.webinar_registration_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            <span>
                              {resendingEmailId === reg.webinar_registration_id ? 'Sending...' : 'Resend'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MARKETING ATTRIBUTION & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Registrations
              </span>
              <p className="text-3xl font-extrabold text-slate-900 mt-2">
                {analytics.summary?.total_registrations || webinar.total_registrations || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Capacity: {webinar.max_participants || 100}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Attended Participants
              </span>
              <p className="text-3xl font-extrabold text-emerald-700 mt-2">
                {analytics.summary?.attended_count || 0}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-1">
                {analytics.summary?.total_registrations
                  ? Math.round(
                      ((analytics.summary?.attended_count || 0) /
                        analytics.summary.total_registrations) *
                        100
                    )
                  : 0}
                % Turnout Rate
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                Avg. Attended Duration
              </span>
              <p className="text-3xl font-extrabold text-indigo-700 mt-2">
                {Math.round(analytics.summary?.avg_duration_minutes || 0)} min
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Tracked across all entry/leave intervals
              </p>
            </div>
          </div>

          {/* Traffic Sources Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Traffic Source Attribution</h3>
                <p className="text-xs text-slate-500">
                  Where did your registrants arrive from? Captured automatically from UTM parameters and referrers.
                </p>
              </div>
            </div>

            {analytics.bySource?.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No marketing attribution data collected yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {analytics.bySource.map((src, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                        {src.source?.substring(0, 2) || 'DI'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 capitalize">
                          {src.source || 'Direct / Organic'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {src.medium ? `Medium: ${src.medium}` : 'Direct link access'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">
                        {src.registration_count} registrations
                      </div>
                      <div className="text-xs text-slate-400">
                        {src.attended_count || 0} attended
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campaign Breakdown */}
          {analytics.byCampaign?.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Campaign Conversions (utm_campaign)</h3>
              <div className="divide-y divide-slate-100">
                {analytics.byCampaign.map((camp, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="font-mono text-slate-700">{camp.campaign}</span>
                    <span className="font-bold text-indigo-600">{camp.registration_count} leads</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Reschedule */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Reschedule Webinar</h3>
            <p className="text-xs text-slate-500">
              Updating the schedule will automatically send notification emails with new calendar invites to all confirmed registrants.
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    New Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleData.startDate}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    New Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleData.startTime}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, startTime: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    New End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleData.endDate}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    New End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleData.endTime}
                    onChange={(e) =>
                      setRescheduleData({ ...rescheduleData, endTime: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Reason for Rescheduling
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why the session is rescheduled (included in participant email)..."
                  value={rescheduleData.reason}
                  onChange={(e) =>
                    setRescheduleData({ ...rescheduleData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {isSaving ? 'Rescheduling...' : 'Confirm & Notify Registrants'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancel */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-900">Cancel Webinar</h3>
            </div>
            <p className="text-xs text-slate-500">
              Are you sure you want to cancel this event? A cancellation notice will be immediately emailed to all registered participants.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide the reason for cancelling this event..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Keep Event
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  {isSaving ? 'Cancelling...' : 'Yes, Cancel Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


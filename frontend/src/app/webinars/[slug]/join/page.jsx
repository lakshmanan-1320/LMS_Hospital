'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Layers3,
  Video,
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useWebinarStore } from '@/modules/webinars/stores/useWebinarStore';

export default function WebinarJoinPage() {
  const { slug } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const {
    publicWebinar,
    joinSession,
    isLoading,
    error,
    fetchPublicWebinarBySlug,
    authorizeJoin,
    startAttendanceTracking,
    stopAttendanceTracking,
  } = useWebinarStore();

  const [inputToken, setInputToken] = useState(token || '');
  const [authorized, setAuthorized] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [participantInfo, setParticipantInfo] = useState(null);
  const [sessionProvider, setSessionProvider] = useState(null);
  const [sessionPasscode, setSessionPasscode] = useState('');

  useEffect(() => {
    if (slug) {
      fetchPublicWebinarBySlug(slug);
    }
  }, [slug, fetchPublicWebinarBySlug]);

  useEffect(() => {
    if (slug && token) {
      handleAuthorize(token);
    }
  }, [slug, token]);

  const handleAuthorize = async (joinTokenToUse) => {
    const t = joinTokenToUse || inputToken;
    if (!t) return;

    try {
      const res = await authorizeJoin(slug, t);
      setAuthorized(true);
      setMeetingUrl(res.meetingLink);
      setParticipantInfo(res.participant);
      if (res.provider) setSessionProvider(res.provider);
      if (res.passcode) setSessionPasscode(res.passcode);

      // Start attendance tracking interval
      if (res.participant?.registrationId) {
        startAttendanceTracking(slug, res.participant.registrationId);
      }
    } catch {
      // Error handled in store
    }
  };

  // Close attendance interval when leaving page
  useEffect(() => {
    const handleUnload = () => {
      if (slug && participantInfo?.registrationId) {
        stopAttendanceTracking(slug, participantInfo.registrationId);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      handleUnload();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [slug, participantInfo, stopAttendanceTracking]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6ff] text-[#191b38]">
      {/* Header */}
      <header className="flex h-20 items-center justify-between border-b border-slate-200/60 bg-white/90 px-6 backdrop-blur-md sm:px-12">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white shadow-xs">
            <Layers3 size={18} />
          </span>
          <span>
            elevate<span className="text-violet-600">.</span>
          </span>
        </Link>

        <Link
          href={`/webinars/${slug}`}
          className="text-xs font-semibold text-slate-600 hover:text-violet-600 transition-colors"
        >
          ← Webinar Overview
        </Link>
      </header>

      {/* Main Entrance Card */}
      <main className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-10 shadow-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-700 shadow-xs mb-6">
            <Video size={30} />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 mb-4">
            <Sparkles size={13} />
            <span>Interactive Live Session Portal</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {publicWebinar?.title || 'Live Webinar Entrance'}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Secure, identity-verified entrance for confirmed webinar attendees.
          </p>

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-xs font-medium text-rose-800">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Access Denied</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {authorized && meetingUrl ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 text-left text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Attendee:</span>
                  <span className="font-bold text-slate-900">{participantInfo?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <span className="font-mono text-slate-800">{participantInfo?.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Provider:</span>
                  <span className="font-semibold text-slate-800">
                    {(sessionProvider || publicWebinar?.provider) === 'zoom'
                      ? 'Zoom Video'
                      : (sessionProvider || publicWebinar?.provider) === 'zoho'
                      ? 'Zoho Meeting'
                      : 'Google Meet'}
                  </span>
                </div>
                {sessionPasscode && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Passcode:</span>
                    <span className="font-mono font-bold text-violet-700">{sessionPasscode}</span>
                  </div>
                )}
              </div>

              <a
                href={meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/25 hover:bg-violet-700 transition-all"
              >
                <span>
                  Launch {(sessionProvider || publicWebinar?.provider) === 'zoom'
                    ? 'Zoom Meeting'
                    : (sessionProvider || publicWebinar?.provider) === 'zoho'
                    ? 'Zoho Meeting'
                    : 'Google Meet'}
                </span>
                <ExternalLink size={18} />
              </a>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 text-left space-y-1.5">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" /> Host Room Admission Rules:
                </p>
                <p>
                  {(sessionProvider || publicWebinar?.provider) === 'zoom'
                    ? 'When Zoom opens, click "Open Zoom Meetings" or join directly in browser. Passcode is embedded in link.'
                    : (sessionProvider || publicWebinar?.provider) === 'zoho'
                    ? 'When Zoho opens, enter your registered identity and join the live session.'
                    : 'When Google Meet opens, click "Ask to join". The webinar host will admit you using your registered identity.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-8">
              {!token && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuthorize(inputToken);
                  }}
                  className="space-y-4"
                >
                  <label className="block text-left text-xs font-semibold text-slate-700">
                    Paste your private Join Token (from confirmation email):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter 64-character join token..."
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-xs text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Verify Access & Join'}
                  </button>
                </form>
              )}

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                  <Loader2 size={32} className="animate-spin text-violet-600 mb-2" />
                  <p className="text-xs font-medium">Validating join credentials & checking session schedule...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


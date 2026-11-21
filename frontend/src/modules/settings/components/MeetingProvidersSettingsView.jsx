'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Video,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ExternalLink,
  Trash2,
  Mail,
  Check,
  Building2,
  Radio,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { webinarService } from '@/modules/webinars/services/webinar.service';

export default function MeetingProvidersSettingsView({ role = 'admin' }) {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [disconnectingProvider, setDisconnectingProvider] = useState(null);
  const [activeTestingProvider, setActiveTestingProvider] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [statusData, setStatusData] = useState({
    google: null,
    zoom: null,
    zoho: null,
    providers: [],
  });
  const [message, setMessage] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await webinarService.getProvidersStatus();
      const providers = res?.providers || [];
      const google = providers.find((p) => p.id === 'google_meet') || null;
      const zoom = providers.find((p) => p.id === 'zoom') || null;
      const zoho = providers.find((p) => p.id === 'zoho') || null;
      setStatusData({
        google,
        zoom,
        zoho,
        providers,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not fetch meeting provider status.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Check for incoming Google, Zoom, or Zoho OAuth callback code in URL
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setMessage({
        type: 'error',
        text: `Authorization failed: ${decodeURIComponent(errorParam)}`,
      });
      fetchStatus();
      return;
    }

    if (code) {
      const processOAuth = async () => {
        const isZoho = state && state.includes('zoho');
        const isZoom = state && state.includes('zoom');
        const providerKey = isZoho ? 'zoho' : isZoom ? 'zoom' : 'google';
        const providerName = isZoho ? 'Zoho Meeting' : isZoom ? 'Zoom' : 'Google';

        setConnectingProvider(providerKey);

        setMessage({
          type: 'info',
          text: `Finalizing ${providerName} account connection...`,
        });

        try {
          const redirectUri = window.location.origin + window.location.pathname;
          if (isZoho) {
            const res = await webinarService.handleZohoCallback(code, redirectUri);
            setMessage({
              type: 'success',
              text: `Zoho Meeting account (${res.email || 'Admin'}) connected successfully!`,
            });
          } else if (isZoom) {
            const res = await webinarService.handleZoomCallback(code, redirectUri);
            setMessage({
              type: 'success',
              text: `Zoom account (${res.email || 'Admin'}) connected successfully!`,
            });
          } else {
            const res = await webinarService.handleGoogleCallback(code, redirectUri);
            setMessage({
              type: 'success',
              text: `Google Account (${res.email}) connected successfully! Live Meet links will now be automatically generated.`,
            });
          }
          // Clean query params from URL without page reload
          window.history.replaceState({}, document.title, window.location.pathname + '?tab=meeting-providers');
        } catch (err) {
          setMessage({
            type: 'error',
            text: err.response?.data?.message || 'Failed to exchange authorization code.',
          });
        } finally {
          setConnectingProvider(null);
          await fetchStatus();
        }
      };
      processOAuth();
    } else {
      fetchStatus();
    }
  }, [searchParams]);

  // -----------------------------------------------------------------
  // 1. GOOGLE MEET ACTIONS
  // -----------------------------------------------------------------
  const handleConnectGoogle = async () => {
    setConnectingProvider('google');
    setMessage(null);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await webinarService.getGoogleAuthUrl(redirectUri, 'google_meet_connect');
      if (res.url) {
        window.location.href = res.url;
      } else {
        setConnectingProvider(null);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not generate Google authorization link.',
      });
      setConnectingProvider(null);
    }
  };

  const handleTestGoogle = async () => {
    setActiveTestingProvider('google');
    setMessage(null);
    setTestResult(null);
    try {
      const res = await webinarService.testGoogleMeet();
      setTestResult({ provider: 'google', ...res });
      setMessage({
        type: 'success',
        text: 'Google Meet verified! Created live test conference successfully.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Google Meet test failed. Please verify credentials.',
      });
    } finally {
      setActiveTestingProvider(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Account? Future webinars using Google Meet will require reconnection.')) {
      return;
    }
    setDisconnectingProvider('google');
    setMessage(null);
    try {
      await webinarService.disconnectGoogle();
      setMessage({ type: 'success', text: 'Google account disconnected successfully.' });
      await fetchStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disconnect Google account.' });
    } finally {
      setDisconnectingProvider(null);
    }
  };

  // -----------------------------------------------------------------
  // 2. ZOOM VIDEO ACTIONS
  // -----------------------------------------------------------------
  const handleConnectZoom = async () => {
    setConnectingProvider('zoom');
    setMessage(null);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await webinarService.getZoomAuthUrl(redirectUri, 'zoom_connect');
      if (res.url) {
        window.location.href = res.url;
      } else {
        setConnectingProvider(null);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not generate Zoom authorization link. Verify Super Admin Zoom credentials.',
      });
      setConnectingProvider(null);
    }
  };

  const handleTestZoom = async () => {
    setActiveTestingProvider('zoom');
    setMessage(null);
    setTestResult(null);
    try {
      const res = await webinarService.testZoom();
      setTestResult({ provider: 'zoom', ...res });
      setMessage({
        type: 'success',
        text: 'Zoom verified! Created and tested live session successfully.',
      });
      await fetchStatus();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Zoom connection test failed.',
      });
    } finally {
      setActiveTestingProvider(null);
    }
  };

  const handleDisconnectZoom = async () => {
    if (!window.confirm('Disconnect Zoom Integration?')) return;
    setDisconnectingProvider('zoom');
    setMessage(null);
    try {
      await webinarService.disconnectZoom();
      setMessage({ type: 'success', text: 'Zoom integration disconnected successfully.' });
      await fetchStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disconnect Zoom.' });
    } finally {
      setDisconnectingProvider(null);
    }
  };

  // -----------------------------------------------------------------
  // 3. ZOHO MEETING ACTIONS
  // -----------------------------------------------------------------
  const handleConnectZoho = async () => {
    setConnectingProvider('zoho');
    setMessage(null);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await webinarService.getZohoAuthUrl(redirectUri, 'zoho_meeting_connect');
      if (res.url) {
        window.location.href = res.url;
      } else {
        setConnectingProvider(null);
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Could not generate Zoho authorization link. Verify Super Admin Zoho credentials.',
      });
      setConnectingProvider(null);
    }
  };

  const handleTestZoho = async () => {
    setActiveTestingProvider('zoho');
    setMessage(null);
    setTestResult(null);
    try {
      const res = await webinarService.testZoho();
      setTestResult({ provider: 'zoho', ...res });
      setMessage({
        type: 'success',
        text: 'Zoho Meeting verified! Created and deleted sample session successfully.',
      });
      await fetchStatus();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Zoho Meeting test connection failed.',
      });
    } finally {
      setActiveTestingProvider(null);
    }
  };

  const handleDisconnectZoho = async () => {
    if (!window.confirm('Disconnect Zoho Meeting account?')) return;
    setDisconnectingProvider('zoho');
    setMessage(null);
    try {
      await webinarService.disconnectZoho();
      setMessage({ type: 'success', text: 'Zoho Meeting account disconnected successfully.' });
      await fetchStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to disconnect Zoho account.' });
    } finally {
      setDisconnectingProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[300px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Checking provider connections...</span>
        </div>
      </div>
    );
  }

  const { google, zoom, zoho } = statusData;
  const isGoogleConnected = Boolean(google?.isConnected && google?.accountEmail);
  const isZoomConnected = Boolean(zoom?.isConnected);
  const isZohoConnected = Boolean(zoho?.isConnected);
  const isAnyActionBusy = Boolean(connectingProvider || disconnectingProvider || activeTestingProvider);

  return (
    <div className="w-full space-y-6">
      {/* Intro Description */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">Meeting &amp; Video Providers</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Connect your video meeting accounts. Elevate LMS supports strictly one meeting provider per webinar with automated host launch links and attendee email synchronization.
        </p>
      </div>

      {/* Global Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : message.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          ) : message.type === 'info' ? (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* ALL 3 MEETING PROVIDERS IN A NEAT, SINGLE ROW (3-COL GRID) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* ------------------------------------------------------------ */}
        {/* CARD 1: GOOGLE MEET */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          {/* Card Header & Body */}
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center p-2.5 shadow-sm">
                  <svg viewBox="0 0 48 48" className="w-full h-full">
                    <path fill="#4caf50" d="M12 28l-8-8 8-8v16z"/>
                    <path fill="#2e7d32" d="M28 6H8C5.8 6 4 7.8 4 10v6l8 6 8-6v-6c0-2.2-1.8-4-4-4z"/>
                    <path fill="#388e3c" d="M28 42H8c-2.2 0-4-1.8-4-4v-6l8-6 8 6v6c0 2.2-1.8 4-4 4z"/>
                    <path fill="#1b5e20" d="M28 20l-8-6-8 6 8 6 8-6z"/>
                    <path fill="#4caf50" d="M44 14.5L34 22v4l10 7.5c1.1.8 2-.2 2-1.5V16c0-1.3-.9-2.3-2-1.5z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Google Meet</h3>
                  <span className="text-[11px] font-semibold text-emerald-700">Google Workspace &amp; Gmail</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isGoogleConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isGoogleConnected ? 'bg-emerald-600 animate-pulse' : 'bg-gray-400'}`} />
                {isGoogleConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed min-h-[36px]">
              Automatically generates Google Meet rooms and synchronizes Google Calendar invitations for hosts and attendees.
            </p>

            {/* Connection Info Box */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 min-h-[82px] flex flex-col justify-center">
              {isGoogleConnected ? (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Account</div>
                  <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                    <Mail size={13} className="text-emerald-600 flex-shrink-0" />
                    <span>{google.accountEmail}</span>
                  </div>
                  {google.accountName && (
                    <span className="text-[11px] text-gray-500 truncate block">{google.accountName}</span>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Authorize your Google account to enable Google Meet.</span>
                </div>
              )}
            </div>

            {/* Feature Checkpoints */}
            <div className="space-y-1.5 text-xs text-gray-600 pt-1">
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600 flex-shrink-0" />
                <span>Auto-generate Meet conference links</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600 flex-shrink-0" />
                <span>Google Calendar host &amp; student invite</span>
              </div>
            </div>
          </div>

          {/* Card Footer Actions */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl mt-auto space-y-2">
            {!isGoogleConnected ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isAnyActionBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-50"
              >
                {connectingProvider === 'google' ? (
                  <RotateCw size={14} className="animate-spin" />
                ) : (
                  <Video size={14} />
                )}
                <span>{connectingProvider === 'google' ? 'Connecting...' : 'Connect with Google'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestGoogle}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={activeTestingProvider === 'google' ? 'animate-spin' : ''} />
                    <span>{activeTestingProvider === 'google' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectGoogle}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={connectingProvider === 'google' ? 'animate-spin' : ''} />
                    <span>{connectingProvider === 'google' ? 'Switching...' : 'Switch'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  disabled={isAnyActionBusy}
                  className="w-full text-center text-[11px] font-medium text-red-600 hover:text-red-700 py-1 transition-colors disabled:opacity-50"
                >
                  {disconnectingProvider === 'google' ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* CARD 2: ZOOM VIDEO */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          {/* Card Header & Body */}
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-sky-500 border border-sky-600 flex items-center justify-center text-white font-black text-2xl shadow-sm">
                  Z
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Zoom Video</h3>
                  <span className="text-[11px] font-semibold text-sky-700">Zoom Meetings &amp; Rooms</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isZoomConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : zoom?.isConfigured
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isZoomConnected ? 'bg-emerald-600 animate-pulse' : zoom?.isConfigured ? 'bg-sky-600' : 'bg-gray-400'
                  }`}
                />
                {isZoomConnected ? 'Connected' : zoom?.isConfigured ? 'Ready to Connect' : 'Not Connected'}
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed min-h-[36px]">
              Host webinars on Zoom with direct host room launch, registrant synchronization, and webhook attendance logging.
            </p>

            {/* Connection Info Box */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 min-h-[82px] flex flex-col justify-center">
              {isZoomConnected ? (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Account</div>
                  <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                    <Mail size={13} className="text-sky-600 flex-shrink-0" />
                    <span>{zoom.accountEmail}</span>
                  </div>
                  {zoom.accountName && (
                    <span className="text-[11px] text-gray-500 truncate block">{zoom.accountName}</span>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Authorize your Zoom account or connect via Super Admin credentials.</span>
                </div>
              )}
            </div>

            {/* Feature Checkpoints */}
            <div className="space-y-1.5 text-xs text-gray-600 pt-1">
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-sky-600 flex-shrink-0" />
                <span>Host launch link with passcode</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-sky-600 flex-shrink-0" />
                <span>Webhook URL validation &amp; duration tracking</span>
              </div>
            </div>
          </div>

          {/* Card Footer Actions */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl mt-auto space-y-2">
            {!isZoomConnected ? (
              <button
                type="button"
                onClick={handleConnectZoom}
                disabled={isAnyActionBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-xs hover:bg-sky-700 shadow-sm transition-all disabled:opacity-50"
              >
                {connectingProvider === 'zoom' ? (
                  <RotateCw size={14} className="animate-spin" />
                ) : (
                  <Video size={14} />
                )}
                <span>{connectingProvider === 'zoom' ? 'Connecting...' : 'Connect with Zoom'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestZoom}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={activeTestingProvider === 'zoom' ? 'animate-spin' : ''} />
                    <span>{activeTestingProvider === 'zoom' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectZoom}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={connectingProvider === 'zoom' ? 'animate-spin' : ''} />
                    <span>{connectingProvider === 'zoom' ? 'Switching...' : 'Switch'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectZoom}
                  disabled={isAnyActionBusy}
                  className="w-full text-center text-[11px] font-medium text-red-600 hover:text-red-700 py-1 transition-colors disabled:opacity-50"
                >
                  {disconnectingProvider === 'zoom' ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* CARD 3: ZOHO MEETING */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          {/* Card Header & Body */}
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500 border border-red-600 flex items-center justify-center text-white font-black text-2xl shadow-sm">
                  ZM
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Zoho Meeting</h3>
                  <span className="text-[11px] font-semibold text-red-700">OAuth 2.0 &amp; Multi-DC</span>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  isZohoConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : zoho?.isConfigured
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isZohoConnected ? 'bg-emerald-600 animate-pulse' : zoho?.isConfigured ? 'bg-amber-600' : 'bg-gray-400'
                  }`}
                />
                {isZohoConnected ? 'Connected' : zoho?.isConfigured ? 'Ready to Connect' : 'Not Connected'}
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed min-h-[36px]">
              Schedule meetings using Zoho Meeting API v2 with complete data-center isolation, host start links, and participant sync.
            </p>

            {/* Connection Info Box */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 min-h-[82px] flex flex-col justify-center">
              {isZohoConnected ? (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Connected Account</div>
                  <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1.5">
                    <Mail size={13} className="text-red-600 flex-shrink-0" />
                    <span>{zoho.accountEmail}</span>
                  </div>
                  {zoho.accountName && (
                    <span className="text-[11px] text-gray-500 truncate block">{zoho.accountName}</span>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-gray-400 flex-shrink-0" />
                  <span>Authorize your Zoho Meeting account to schedule sessions.</span>
                </div>
              )}
            </div>

            {/* Feature Checkpoints */}
            <div className="space-y-1.5 text-xs text-gray-600 pt-1">
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-red-600 flex-shrink-0" />
                <span>Host StartLink generation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={13} className="text-red-600 flex-shrink-0" />
                <span>Global &amp; India data center support</span>
              </div>
            </div>
          </div>

          {/* Card Footer Actions */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl mt-auto space-y-2">
            {!isZohoConnected ? (
              <button
                type="button"
                onClick={handleConnectZoho}
                disabled={isAnyActionBusy}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-xs hover:bg-red-700 shadow-sm transition-all disabled:opacity-50"
              >
                {connectingProvider === 'zoho' ? (
                  <RotateCw size={14} className="animate-spin" />
                ) : (
                  <Video size={14} />
                )}
                <span>{connectingProvider === 'zoho' ? 'Connecting...' : 'Connect with Zoho'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestZoho}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={activeTestingProvider === 'zoho' ? 'animate-spin' : ''} />
                    <span>{activeTestingProvider === 'zoho' ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectZoho}
                    disabled={isAnyActionBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-xs hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                  >
                    <RotateCw size={12} className={connectingProvider === 'zoho' ? 'animate-spin' : ''} />
                    <span>{connectingProvider === 'zoho' ? 'Switching...' : 'Switch'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectZoho}
                  disabled={isAnyActionBusy}
                  className="w-full text-center text-[11px] font-medium text-red-600 hover:text-red-700 py-1 transition-colors disabled:opacity-50"
                >
                  {disconnectingProvider === 'zoho' ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

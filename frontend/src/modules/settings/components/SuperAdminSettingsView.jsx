'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Lock,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Video,
  Webhook,
  Database,
  Radio,
} from 'lucide-react';
import { settingsService } from '../services/settings.service';

export default function SuperAdminSettingsView() {
  const [activeTab, setActiveTab] = useState('google');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Visibility toggles for client IDs and secrets (confidential masking)
  const [showGoogleClientId, setShowGoogleClientId] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [showZoomAccountId, setShowZoomAccountId] = useState(false);
  const [showZoomClientId, setShowZoomClientId] = useState(false);
  const [showZoomSecret, setShowZoomSecret] = useState(false);
  const [showZoomWebhookSecret, setShowZoomWebhookSecret] = useState(false);
  const [showZohoClientId, setShowZohoClientId] = useState(false);
  const [showZohoSecret, setShowZohoSecret] = useState(false);

  // Forms state
  const [googleForm, setGoogleForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:3000/dashboard/admin/settings',
    isConfigured: false,
    hasSecret: false,
  });

  const [zoomForm, setZoomForm] = useState({
    accountId: '',
    clientId: '',
    clientSecret: '',
    webhookSecretToken: '',
    authType: 'server_to_server',
    isConfigured: false,
    hasSecret: false,
    hasWebhookToken: false,
  });

  const [zohoForm, setZohoForm] = useState({
    clientId: '',
    clientSecret: '',
    dataCenter: 'com',
    redirectUri: 'http://localhost:3000/dashboard/admin/settings',
    isConfigured: false,
    hasSecret: false,
  });

  const fetchAllSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [googleRes, zoomRes, zohoRes] = await Promise.all([
        settingsService.getGoogleOAuthSettings().catch(() => ({})),
        settingsService.getZoomOAuthSettings().catch(() => ({})),
        settingsService.getZohoOAuthSettings().catch(() => ({})),
      ]);

      const dynamicDefaultRedirect =
        typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/admin/settings`
          : 'http://localhost:3000/dashboard/admin/settings';

      if (googleRes) {
        setGoogleForm({
          clientId: googleRes.clientId || '',
          clientSecret: '',
          redirectUri: googleRes.redirectUri || dynamicDefaultRedirect,
          isConfigured: Boolean(googleRes.isConfigured),
          hasSecret: Boolean(googleRes.hasSecret),
        });
      }

      if (zoomRes) {
        setZoomForm({
          accountId: zoomRes.accountId || '',
          clientId: zoomRes.clientId || '',
          clientSecret: '',
          webhookSecretToken: '',
          authType: zoomRes.authType || 'server_to_server',
          isConfigured: Boolean(zoomRes.isConfigured),
          hasSecret: Boolean(zoomRes.hasSecret),
          hasWebhookToken: Boolean(zoomRes.hasWebhookToken),
        });
      }

      if (zohoRes) {
        setZohoForm({
          clientId: zohoRes.clientId || '',
          clientSecret: '',
          dataCenter: zohoRes.dataCenter || 'com',
          redirectUri: zohoRes.redirectUri || dynamicDefaultRedirect,
          isConfigured: Boolean(zohoRes.isConfigured),
          hasSecret: Boolean(zohoRes.hasSecret),
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load Super Admin provider settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettings();
  }, []);

  const handleCopy = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Save Google OAuth
  const handleSaveGoogle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        clientId: googleForm.clientId.trim(),
        redirectUri: googleForm.redirectUri.trim(),
      };
      if (googleForm.clientSecret && googleForm.clientSecret.trim().length > 0) {
        payload.clientSecret = googleForm.clientSecret.trim();
      }

      const updated = await settingsService.updateGoogleOAuthSettings(payload);
      setGoogleForm((prev) => ({
        ...prev,
        clientId: updated.clientId,
        clientSecret: '',
        redirectUri: updated.redirectUri,
        isConfigured: updated.isConfigured,
        hasSecret: updated.hasSecret,
      }));
      setShowGoogleSecret(false);
      setMessage({ type: 'success', text: 'Google OAuth platform credentials updated & encrypted with AES-256-GCM successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save Google OAuth settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Zoom OAuth
  const handleSaveZoom = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        accountId: zoomForm.accountId.trim(),
        clientId: zoomForm.clientId.trim(),
        authType: zoomForm.authType,
      };
      if (zoomForm.clientSecret && zoomForm.clientSecret.trim().length > 0) {
        payload.clientSecret = zoomForm.clientSecret.trim();
      }
      if (zoomForm.webhookSecretToken && zoomForm.webhookSecretToken.trim().length > 0) {
        payload.webhookSecretToken = zoomForm.webhookSecretToken.trim();
      }

      const updated = await settingsService.updateZoomOAuthSettings(payload);
      setZoomForm((prev) => ({
        ...prev,
        accountId: updated.accountId,
        clientId: updated.clientId,
        clientSecret: '',
        webhookSecretToken: '',
        authType: updated.authType,
        isConfigured: updated.isConfigured,
        hasSecret: updated.hasSecret,
        hasWebhookToken: updated.hasWebhookToken,
      }));
      setShowZoomSecret(false);
      setShowZoomWebhookSecret(false);
      setMessage({ type: 'success', text: 'Zoom integration credentials saved & encrypted with AES-256-GCM successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save Zoom settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Save Zoho OAuth
  const handleSaveZoho = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        clientId: zohoForm.clientId.trim(),
        dataCenter: zohoForm.dataCenter.trim(),
        redirectUri: zohoForm.redirectUri.trim(),
      };
      if (zohoForm.clientSecret && zohoForm.clientSecret.trim().length > 0) {
        payload.clientSecret = zohoForm.clientSecret.trim();
      }

      const updated = await settingsService.updateZohoOAuthSettings(payload);
      setZohoForm((prev) => ({
        ...prev,
        clientId: updated.clientId,
        clientSecret: '',
        dataCenter: updated.dataCenter,
        redirectUri: updated.redirectUri,
        isConfigured: updated.isConfigured,
        hasSecret: updated.hasSecret,
      }));
      setShowZohoSecret(false);
      setMessage({ type: 'success', text: 'Zoho Meeting integration credentials saved & encrypted with AES-256-GCM successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save Zoho settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading platform settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Super Admin Platform Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure master credentials and API keys for supported meeting providers (Google Meet, Zoom, Zoho).
            </p>
          </div>
        </div>
      </div>

      {/* Status Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-3 border-b border-gray-200">
        <button
          type="button"
          onClick={() => { setActiveTab('google'); setMessage(null); }}
          className={`pb-3.5 px-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'google'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">
            G
          </div>
          <span>Google Meet &amp; Calendar</span>
          <span
            className={`w-2 h-2 rounded-full ${
              googleForm.isConfigured ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('zoom'); setMessage(null); }}
          className={`pb-3.5 px-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'zoom'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-[10px]">
            Z
          </div>
          <span>Zoom Video (Server-to-Server)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              zoomForm.isConfigured ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('zoho'); setMessage(null); }}
          className={`pb-3.5 px-3 font-semibold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'zoho'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[10px]">
            ZM
          </div>
          <span>Zoho Meeting</span>
          <span
            className={`w-2 h-2 rounded-full ${
              zohoForm.isConfigured ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: GOOGLE MEET & CALENDAR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'google' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Video size={19} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Google OAuth &amp; Meet Credentials</h2>
                <p className="text-xs text-gray-500">
                  Master Google Cloud Project OAuth 2.0 Client credentials used for Google Meet &amp; Calendar integrations.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                googleForm.isConfigured
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${googleForm.isConfigured ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              {googleForm.isConfigured ? 'Active & Configured' : 'Credentials Incomplete'}
            </span>
          </div>

          <form onSubmit={handleSaveGoogle} className="p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Google Client ID <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Key size={16} />
                </div>
                <input
                  type={showGoogleClientId ? 'text' : 'password'}
                  required
                  value={googleForm.clientId}
                  onChange={(e) => setGoogleForm({ ...googleForm, clientId: e.target.value })}
                  placeholder="e.g., 1052853118234-xxx.apps.googleusercontent.com"
                  className="block w-full pl-10 pr-20 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGoogleClientId(!showGoogleClientId)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={showGoogleClientId ? 'Hide Client ID' : 'Show Client ID'}
                  >
                    {showGoogleClientId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(googleForm.clientId, 'g_clientId')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Client ID"
                  >
                    {copiedField === 'g_clientId' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                From Google Cloud Console &gt; APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client IDs.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Google Client Secret {!googleForm.hasSecret && <span className="text-red-500">*</span>}
                </label>
                {googleForm.hasSecret && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} /> Saved with AES-256-GCM
                  </span>
                )}
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showGoogleSecret ? 'text' : 'password'}
                  required={!googleForm.hasSecret}
                  value={googleForm.clientSecret}
                  onChange={(e) => setGoogleForm({ ...googleForm, clientSecret: e.target.value })}
                  placeholder={
                    googleForm.hasSecret
                      ? '•••••••••••••••• (Leave blank to keep existing secret)'
                      : 'Enter Google Client Secret (e.g., GOCSPX-xxxx)'
                  }
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                {googleForm.clientSecret ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title={showGoogleSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showGoogleSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Encrypted at rest using AES-256-GCM in <code className="font-mono text-indigo-600">system_settings</code>. Never transmitted back in plain text.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Authorized Redirect URI
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Globe size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={googleForm.redirectUri}
                  onChange={(e) => setGoogleForm({ ...googleForm, redirectUri: e.target.value })}
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(googleForm.redirectUri, 'g_redirectUri')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {copiedField === 'g_redirectUri' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Ensure this URL is added under &quot;Authorized redirect URIs&quot; in Google Cloud Console.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Save Google Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ZOOM VIDEO (SERVER-TO-SERVER OAUTH & WEBHOOKS) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'zoom' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <Video size={19} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Zoom Server-to-Server OAuth &amp; Webhooks</h2>
                <p className="text-xs text-gray-500">
                  Connect your Zoom App Marketplace Server-to-Server OAuth app. No individual host logins required.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                zoomForm.isConfigured
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${zoomForm.isConfigured ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              {zoomForm.isConfigured ? 'Active & Configured' : 'Credentials Incomplete'}
            </span>
          </div>

          <form onSubmit={handleSaveZoom} className="p-6 sm:p-8 space-y-6">
            {/* Account ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Zoom Account ID <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Database size={16} />
                </div>
                <input
                  type={showZoomAccountId ? 'text' : 'password'}
                  required
                  value={zoomForm.accountId}
                  onChange={(e) => setZoomForm({ ...zoomForm, accountId: e.target.value })}
                  placeholder="e.g., abcdef123456"
                  className="block w-full pl-10 pr-20 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowZoomAccountId(!showZoomAccountId)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={showZoomAccountId ? 'Hide Account ID' : 'Show Account ID'}
                  >
                    {showZoomAccountId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(zoomForm.accountId, 'z_accountId')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Account ID"
                  >
                    {copiedField === 'z_accountId' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Obtained from Zoom App Marketplace &gt; Server-to-Server OAuth App &gt; App Credentials.
              </p>
            </div>

            {/* Client ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Zoom Client ID <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Key size={16} />
                </div>
                <input
                  type={showZoomClientId ? 'text' : 'password'}
                  required
                  value={zoomForm.clientId}
                  onChange={(e) => setZoomForm({ ...zoomForm, clientId: e.target.value })}
                  placeholder="e.g., v8X_z9L3Qy6m"
                  className="block w-full pl-10 pr-20 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowZoomClientId(!showZoomClientId)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={showZoomClientId ? 'Hide Client ID' : 'Show Client ID'}
                  >
                    {showZoomClientId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(zoomForm.clientId, 'z_clientId')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Client ID"
                  >
                    {copiedField === 'z_clientId' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Client Secret */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Zoom Client Secret {!zoomForm.hasSecret && <span className="text-red-500">*</span>}
                </label>
                {zoomForm.hasSecret && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} /> Saved with AES-256-GCM
                  </span>
                )}
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showZoomSecret ? 'text' : 'password'}
                  required={!zoomForm.hasSecret}
                  value={zoomForm.clientSecret}
                  onChange={(e) => setZoomForm({ ...zoomForm, clientSecret: e.target.value })}
                  placeholder={
                    zoomForm.hasSecret
                      ? '•••••••••••••••• (Leave blank to keep existing secret)'
                      : 'Enter Zoom Client Secret'
                  }
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                {zoomForm.clientSecret ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowZoomSecret(!showZoomSecret)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title={showZoomSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showZoomSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Encrypted at rest using AES-256-GCM in <code className="font-mono text-indigo-600">system_settings</code>. Never transmitted back in plain text.
              </p>
            </div>

            {/* Webhook Secret Token */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Zoom Webhook Secret Token (Endpoint URL Validation CRC &amp; HMAC Signature)
                </label>
                {zoomForm.hasWebhookToken && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} /> Saved with AES-256-GCM
                  </span>
                )}
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Webhook size={16} />
                </div>
                <input
                  type={showZoomWebhookSecret ? 'text' : 'password'}
                  value={zoomForm.webhookSecretToken}
                  onChange={(e) => setZoomForm({ ...zoomForm, webhookSecretToken: e.target.value })}
                  placeholder={
                    zoomForm.hasWebhookToken
                      ? '•••••••••••••••• (Leave blank to keep existing token)'
                      : 'Enter Webhook Secret Token (e.g. Ob7qR1sT...)'
                  }
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                {zoomForm.webhookSecretToken ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowZoomWebhookSecret(!showZoomWebhookSecret)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title={showZoomWebhookSecret ? 'Hide token' : 'Show token'}
                    >
                      {showZoomWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Webhook URL to enter in Zoom Marketplace: <code className="font-mono text-indigo-600">{typeof window !== 'undefined' ? `${window.location.origin}/api/webinars/webhooks/zoom` : 'https://lms.smjtechnology.online/api/webinars/webhooks/zoom'}</code>. Elevate LMS automatically responds to Zoom&apos;s CRC challenge and tracks participant attendance in real time.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Save Zoom Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ZOHO MEETING (OAUTH 2.0 & MULTI-DC) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'zoho' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                <Video size={19} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Zoho Meeting OAuth 2.0 Credentials</h2>
                <p className="text-xs text-gray-500">
                  Registered Client in Zoho Developer Console for hosting meetings with organization tenant isolation.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                zohoForm.isConfigured
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${zohoForm.isConfigured ? 'bg-emerald-600' : 'bg-amber-600'}`} />
              {zohoForm.isConfigured ? 'Active & Configured' : 'Credentials Incomplete'}
            </span>
          </div>

          <form onSubmit={handleSaveZoho} className="p-6 sm:p-8 space-y-6">
            {/* Data Center Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Zoho Data Center Domain
              </label>
              <select
                value={zohoForm.dataCenter}
                onChange={(e) => setZohoForm({ ...zohoForm, dataCenter: e.target.value })}
                className="block w-full py-2.5 px-3.5 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="com">zoho.com (United States &amp; Global)</option>
                <option value="in">zoho.in (India)</option>
                <option value="eu">zoho.eu (Europe)</option>
                <option value="com.au">zoho.com.au (Australia)</option>
              </select>
              <p className="text-xs text-gray-500">
                Must match the region where your Zoho account was registered.
              </p>
            </div>

            {/* Client ID */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Zoho Client ID <span className="text-red-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Key size={16} />
                </div>
                <input
                  type={showZohoClientId ? 'text' : 'password'}
                  required
                  value={zohoForm.clientId}
                  onChange={(e) => setZohoForm({ ...zohoForm, clientId: e.target.value })}
                  placeholder="e.g., 1000.XXXXX..."
                  className="block w-full pl-10 pr-20 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowZohoClientId(!showZohoClientId)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={showZohoClientId ? 'Hide Client ID' : 'Show Client ID'}
                  >
                    {showZohoClientId ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(zohoForm.clientId, 'zh_clientId')}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy Client ID"
                  >
                    {copiedField === 'zh_clientId' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                From Zoho Developer Console &gt; Server-based Applications.
              </p>
            </div>

            {/* Client Secret */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Zoho Client Secret {!zohoForm.hasSecret && <span className="text-red-500">*</span>}
                </label>
                {zohoForm.hasSecret && (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={13} /> Saved with AES-256-GCM
                  </span>
                )}
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showZohoSecret ? 'text' : 'password'}
                  required={!zohoForm.hasSecret}
                  value={zohoForm.clientSecret}
                  onChange={(e) => setZohoForm({ ...zohoForm, clientSecret: e.target.value })}
                  placeholder={
                    zohoForm.hasSecret
                      ? '•••••••••••••••• (Leave blank to keep existing secret)'
                      : 'Enter Zoho Client Secret (e.g., c9f73...)'
                  }
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                {zohoForm.clientSecret ? (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowZohoSecret(!showZohoSecret)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title={showZohoSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showZohoSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-gray-500">
                Encrypted at rest using AES-256-GCM in <code className="font-mono text-indigo-600">system_settings</code>. Never transmitted back in plain text.
              </p>
            </div>

            {/* Authorized Redirect URI */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Authorized Redirect URI
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Globe size={16} />
                </div>
                <input
                  type="text"
                  required
                  value={zohoForm.redirectUri}
                  onChange={(e) => setZohoForm({ ...zohoForm, redirectUri: e.target.value })}
                  className="block w-full pl-10 pr-12 py-2.5 text-sm font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(zohoForm.redirectUri, 'zh_redirectUri')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {copiedField === 'zh_redirectUri' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Add this exact URL to &quot;Authorized Redirect URIs&quot; in Zoho Developer Console.
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>Save Zoho Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Send,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function WhatsappSettingsTab({ onOpenTestModal }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [form, setForm] = useState({
    app_id: '',
    app_secret: '',
    waba_id: '',
    phone_number_id: '',
    display_phone_number: '',
    business_name: '',
    access_token: '',
    webhook_verify_token: '',
    graph_version: 'v26.0',
    redirect_to: '',
  });

  const [statusInfo, setStatusInfo] = useState(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await campaignsService.getWhatsappConfig();
      const data = res.data || {};
      setStatusInfo(data);
      setForm((prev) => ({
        ...prev,
        app_id: data.appId || '',
        waba_id: data.wabaId || '',
        phone_number_id: data.phoneNumberId || '',
        display_phone_number: data.displayPhoneNumber || '',
        business_name: data.businessName || '',
        graph_version: data.graphVersion || 'v26.0',
        redirect_to: data.redirectTo || '',
        app_secret: '', // Keep blank on load
        access_token: '', // Keep blank on load
      }));
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to load WhatsApp configuration.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleCopyWebhook = () => {
    if (statusInfo?.webhookUrl) {
      navigator.clipboard.writeText(statusInfo.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const payload = { ...form };
      // Omit empty secrets so backend preserves existing encrypted values
      if (!payload.app_secret) delete payload.app_secret;
      if (!payload.access_token) delete payload.access_token;
      if (!payload.webhook_verify_token) delete payload.webhook_verify_token;

      const res = await campaignsService.saveWhatsappConfig(payload);
      const data = res.data || {};
      setStatusInfo(data);
      setForm((prev) => ({
        ...prev,
        app_secret: '',
        access_token: '',
      }));

      if (data.status === 'active') {
        setFeedback({
          type: 'success',
          message: 'WhatsApp Meta Cloud API connection verified & active!',
        });
      } else {
        setFeedback({
          type: 'warning',
          message: `Saved, but Meta validation returned: ${data.lastError || 'Check your credentials.'}`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to save WhatsApp configuration.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">Loading WhatsApp Gateway configuration...</p>
      </div>
    );
  }

  const isConfigured = statusInfo?.status === 'active';

  return (
    <div className="space-y-6">
      {/* Banner / Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Meta WhatsApp Cloud API Gateway</h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                  isConfigured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {isConfigured ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active &amp; Configured
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Setup Required
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Super Admin master Meta credentials. API tokens and App Secrets are encrypted at rest using AES-256-GCM.
            </p>
          </div>
        </div>

        {onOpenTestModal && (
          <button
            type="button"
            onClick={onOpenTestModal}
            disabled={!statusInfo?.hasAccessToken}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> Test WhatsApp Delivery
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : feedback.type === 'warning'
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Meta App ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Meta App ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 1052853118234..."
              value={form.app_id}
              onChange={(e) => setForm({ ...form, app_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">From Meta for Developers &rarr; My Apps header.</p>
          </div>

          {/* Meta App Secret */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Meta App Secret <span className="text-rose-500">*</span>
              </label>
              {statusInfo?.hasAppSecret && (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Saved with AES-256-GCM
                </span>
              )}
            </div>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={statusInfo?.hasAppSecret ? '•••••••••••••••• (Leave blank to keep existing)' : 'Paste App Secret'}
              value={form.app_secret}
              onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">App settings &rarr; Basic &rarr; App Secret.</p>
          </div>

          {/* WhatsApp Business Account ID (WABA ID) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              WhatsApp Business Account ID (WABA ID) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 11029384756..."
              value={form.waba_id}
              onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">Found under WhatsApp &rarr; API Setup or Meta Business Settings.</p>
          </div>

          {/* Phone Number ID */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Meta Phone Number ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 10692837465..."
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">The numeric Phone Number ID assigned by Meta (not raw digits).</p>
          </div>

          {/* Permanent Access Token */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                System User Permanent Access Token <span className="text-rose-500">*</span>
              </label>
              {statusInfo?.hasAccessToken && (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Saved with AES-256-GCM
                </span>
              )}
            </div>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={statusInfo?.hasAccessToken ? '•••••••••••••••• (Leave blank to keep existing)' : 'Paste System User Token (EAA...)'}
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Generated in Meta Business Settings &rarr; Users &rarr; System Users with <code className="text-slate-600">whatsapp_business_messaging</code> permission.
            </p>
          </div>

          {/* Graph API Version */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Graph API Version
            </label>
            <input
              type="text"
              value={form.graph_version}
              onChange={(e) => setForm({ ...form, graph_version: e.target.value })}
              placeholder="v26.0"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>

          {/* Non-Production Safety Redirect Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Safety Redirect Phone (Optional Testing Number)
            </label>
            <input
              type="text"
              placeholder="+919876543210 (All outbound WhatsApp rerouted here)"
              value={form.redirect_to}
              onChange={(e) => setForm({ ...form, redirect_to: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              When specified, all bulk and test broadcasts are redirected to this number, preventing real students from receiving test messages.
            </p>
          </div>
        </div>

        {/* Webhook Callback Section */}
        <div className="pt-6 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" /> Webhook Callback URL
              </span>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
              >
                Meta Webhooks Guide <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-500">
              In your Meta App Dashboard &rarr; WhatsApp &rarr; Configuration &rarr; Webhook, enter this Callback URL and subscribe to the <code className="text-slate-800 font-mono font-semibold">messages</code> event to track real-time delivery and read receipts.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={statusInfo?.webhookUrl || 'https://lms.smjtechnology.online/api/campaigns/whatsapp/webhook'}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" /> {copiedWebhook ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Connection...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save &amp; Verify WhatsApp Connection
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


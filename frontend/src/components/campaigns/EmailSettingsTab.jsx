'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  ShieldCheck,
  Server,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function EmailSettingsTab({ onOpenTestModal }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [form, setForm] = useState({
    host: '',
    port: 465,
    encryption: 'ssl',
    username: '',
    password: '',
    from_name: 'Elevate Learning',
    from_email: '',
    redirect_to: '',
  });

  const [configState, setConfigState] = useState({
    configured: false,
    status: 'draft',
    password_set: false,
    last_validated_at: null,
    last_error: null,
  });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await campaignsService.getEmailConfig();
      const data = res?.data?.data || res?.data || res || {};

      setForm({
        host: data.host || '',
        port: data.port || 465,
        encryption: data.encryption || 'ssl',
        username: data.username || '',
        password: '',
        from_name: data.from_name || 'Elevate Learning',
        from_email: data.from_email || '',
        redirect_to: data.redirect_to || '',
      });

      setConfigState({
        configured: Boolean(data.configured),
        status: data.status || 'draft',
        password_set: Boolean(data.password_set),
        last_validated_at: data.last_validated_at,
        last_error: data.last_error,
      });
    } catch (err) {
      console.error('Failed to load email config:', err);
      setFeedback({ type: 'error', message: 'Failed to load SMTP gateway settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        host: form.host,
        port: parseInt(form.port, 10),
        encryption: form.encryption,
        username: form.username,
        from_name: form.from_name,
        from_email: form.from_email,
        redirect_to: form.redirect_to || undefined,
      };

      if (form.password) {
        payload.password = form.password;
      }

      const res = await campaignsService.saveEmailConfig(payload);
      const data = res?.data?.data || res?.data || res || {};

      setFeedback({
        type: data.status === 'active' ? 'success' : 'warning',
        message:
          data.status === 'active'
            ? 'SMTP gateway settings saved and verified successfully!'
            : `Settings saved, but connection check reported: ${data.last_error || 'Check server logs.'}`,
      });

      fetchConfig();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save settings.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-100 flex items-center justify-center gap-3 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
        <span className="text-sm font-semibold">Loading SMTP gateway settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status & Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                SMTP Email Gateway Configuration
              </h2>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  configState.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : configState.status === 'error'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {configState.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Super Admin platform SMTP setup. Passwords are encrypted at rest with AES-256-GCM.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTestModal}
          disabled={!configState.password_set}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5 text-indigo-600" /> Test SMTP Delivery
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : feedback.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SMTP Host */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" /> SMTP Server Host *
            </label>
            <input
              type="text"
              required
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="e.g. smtp.gmail.com or smtp.sendgrid.net"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Port & Encryption */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Port *</label>
              <input
                type="number"
                required
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder="465 or 587"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Encryption *</label>
              <select
                value={form.encryption}
                onChange={(e) => {
                  const enc = e.target.value;
                  setForm({
                    ...form,
                    encryption: enc,
                    port: enc === 'ssl' ? 465 : 587,
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value="ssl">SSL (Port 465)</option>
                <option value="tls">STARTTLS (Port 587)</option>
                <option value="none">None (Port 25)</option>
              </select>
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">SMTP Username *</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="e.g. apikey or user@yourdomain.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* Password (AES-256-GCM Encrypted) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                SMTP Password {configState.password_set ? '(Configured)' : '*'}
              </span>
              {configState.password_set && (
                <span className="text-[10px] text-emerald-600 font-semibold">
                  Saved with AES-256-GCM
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={configState.password_set ? '•••••••••••••••• (Leave blank to keep)' : 'Enter SMTP password'}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* From Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Sender Display Name *</label>
            <input
              type="text"
              required
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              placeholder="e.g. Elevate Learning"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          {/* From Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Sender Email Address *</label>
            <input
              type="email"
              required
              value={form.from_email}
              onChange={(e) => setForm({ ...form, from_email: e.target.value })}
              placeholder="e.g. notifications@elevatelms.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Development Safety Redirection Inbox */}
        <div className="pt-4 border-t border-slate-100">
          <div className="space-y-1.5 max-w-xl">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Non-Production Safety Redirect Inbox
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              When set, all bulk and transactional emails sent during testing outside production are routed to this inbox, preventing real students from receiving test blasts.
            </p>
            <input
              type="email"
              value={form.redirect_to}
              onChange={(e) => setForm({ ...form, redirect_to: e.target.value })}
              placeholder="e.g. dev-sandbox@yourcompany.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save & Verify SMTP Connection
          </button>
        </div>
      </form>
    </div>
  );
}


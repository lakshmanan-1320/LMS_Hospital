'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Radio,
  Lock,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function SmsSettingsTab({ role = 'super-admin', onOpenTestModal }) {
  const isSuperAdmin = role === 'super-admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [providerKey, setProviderKey] = useState('msg91');
  const [authKey, setAuthKey] = useState('');
  const [senderId, setSenderId] = useState('');
  const [dltEntityId, setDltEntityId] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('91');
  const [showKey, setShowKey] = useState(false);
  const [configStatus, setConfigStatus] = useState('draft');
  const [lastValidatedAt, setLastValidatedAt] = useState(null);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const res = await campaignsService.getSmsConfig();
        const data = res.data;
        if (data) {
          setProviderKey(data.providerKey || 'msg91');
          setSenderId(data.senderId || '');
          setDltEntityId(data.dltEntityId || '');
          setDefaultCountryCode(data.defaultCountryCode || '91');
          setConfigStatus(data.status || 'draft');
          setLastValidatedAt(data.lastValidatedAt || null);
        }
      } catch (err) {
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to load SMS configuration.');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await campaignsService.saveSmsConfig({
        providerKey,
        authKey: authKey.trim() || undefined,
        senderId: senderId.trim(),
        dltEntityId: dltEntityId.trim() || undefined,
        defaultCountryCode: defaultCountryCode.trim(),
      });
      setStatusMessage('SMS integration settings saved and validated successfully.');
      setConfigStatus(res.data?.validated ? 'active' : 'error');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to save configuration.');
      setConfigStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await campaignsService.testSmsConnection(testPhone.trim() || undefined);
      setTestResult({ success: res.data.success, message: res.data.message });
      if (res.data.success) setConfigStatus('active');
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
        Loading SMS provider configuration...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Role advisory banner */}
      {!isSuperAdmin && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              SMS Gateway credentials and DLT authorization are managed at the platform level by <strong>Super Admin</strong>.
              Admins can test connection and dispatch campaigns using approved templates.
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 uppercase">
            Admin View
          </span>
        </div>
      )}

      {/* Status banner */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">SMS Gateway Configuration</h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                configStatus === 'active'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : configStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {configStatus === 'active' ? 'Active & Verified' : configStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect MSG91 Flow API v5 for high-volume promotional and transactional student messaging.
          </p>
          {lastValidatedAt && (
            <p className="text-[11px] text-slate-400 mt-1">
              Last verified: {new Date(lastValidatedAt).toLocaleString()}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenTestModal || (() => setShowTestModal(true))}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
        >
          Test Connection
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            SMS Provider Driver
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => isSuperAdmin && setProviderKey('msg91')}
              className={`p-4 rounded-xl border transition ${
                isSuperAdmin ? 'cursor-pointer' : 'cursor-default'
              } ${
                providerKey === 'msg91'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-slate-900">MSG91 Flow v5 API</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Primary gateway with DLT compliance and bulk campaign flow dispatch.
              </p>
            </div>

            <div
              onClick={() => isSuperAdmin && setProviderKey('mock')}
              className={`p-4 rounded-xl border transition ${
                isSuperAdmin ? 'cursor-pointer' : 'cursor-default'
              } ${
                providerKey === 'mock'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-slate-900">Mock SMS Simulator</span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Local Dev
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Simulate bulk SMS campaigns locally without burning actual SMS credits.
              </p>
            </div>
          </div>
        </div>

        {providerKey === 'msg91' && (
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              MSG91 Auth Key *
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={isSuperAdmin ? "Paste your MSG91 Authkey (e.g. 405781AYp...)" : "•••••••••••••••••••••••• (Encrypted)"}
                value={authKey}
                disabled={!isSuperAdmin}
                onChange={(e) => setAuthKey(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Found in your MSG91 Dashboard under User Profile → Authkey. Credentials are encrypted with AES-256-GCM.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Sender ID (Header) *
            </label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. ELVLMS"
              value={senderId}
              disabled={!isSuperAdmin}
              onChange={(e) => setSenderId(e.target.value.toUpperCase())}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase disabled:bg-slate-50 disabled:text-slate-600"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Exact 6-character registered DLT Sender ID.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              DLT Entity ID
            </label>
            <input
              type="text"
              placeholder="e.g. 14015600000000"
              value={dltEntityId}
              disabled={!isSuperAdmin}
              onChange={(e) => setDltEntityId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Principal Entity ID registered on Jio/Vil/Airtel DLT portal.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Default Country Calling Code
          </label>
          <div className="flex items-center gap-2 max-w-xs">
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200">
              +
            </span>
            <input
              type="text"
              placeholder="91"
              value={defaultCountryCode}
              disabled={!isSuperAdmin}
              onChange={(e) => setDefaultCountryCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Prepend this prefix automatically for local 10-digit mobile numbers (91 for India).
          </p>
        </div>

        {isSuperAdmin && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save & Validate Gateway
            </button>
          </div>
        )}
      </form>

      {/* Test Connection Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-base text-slate-900 mb-1">Test SMS Connection</h3>
            <p className="text-xs text-slate-500 mb-4">
              Validate provider authorization and optionally send a test SMS to verify delivery.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Recipient Mobile (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={testing}
                  onClick={handleRunTest}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Run Test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

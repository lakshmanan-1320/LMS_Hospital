'use client';

import React, { useState } from 'react';
import { Mail, Send, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function TestEmailModal({ isOpen, onClose, onTestSuccess }) {
  const [toEmail, setToEmail] = useState('');
  const [customMessage, setCustomMessage] = useState('Elevate LMS SMTP Gateway is working smoothly!');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleTest = async (e) => {
    e.preventDefault();
    setTesting(true);
    setResult(null);

    try {
      const res = await campaignsService.testEmailGateway({
        to_email: toEmail,
        custom_message: customMessage,
      });

      const data = res?.data?.data || res?.data || res || {};
      setResult({
        type: 'success',
        message: data.message || `Test email dispatched successfully to ${toEmail}!`,
        deliveredTo: data.deliveredTo,
      });

      if (onTestSuccess) onTestSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'SMTP dispatch failed.';
      setResult({ type: 'error', message: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Test Email Gateway</h3>
              <p className="text-[11px] text-slate-500">Dispatch a live verification email to test SMTP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleTest} className="p-6 space-y-4">
          {result && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5 ${
                result.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {result.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p>{result.message}</p>
                {result.deliveredTo && result.deliveredTo !== toEmail && (
                  <p className="text-[10px] text-emerald-700">
                    Redirected by safety setting to: <strong>{result.deliveredTo}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Destination Email *</label>
            <input
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="e.g. admin@yourdomain.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Sample Body Note</label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Optional test note..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={testing || !toEmail}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Test Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


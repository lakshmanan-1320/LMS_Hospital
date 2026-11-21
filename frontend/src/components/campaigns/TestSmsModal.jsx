'use client';

import React, { useState } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function TestSmsModal({ isOpen, onClose, onTestSuccess }) {
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleRunTest = async (e) => {
    e?.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await campaignsService.testSmsConnection(testPhone.trim() || undefined);
      setTestResult({
        success: res.data.success,
        message: res.data.message || 'Gateway connection verified successfully.',
        requestId: res.data.requestId,
      });
      if (res.data.success && onTestSuccess) {
        onTestSuccess(res.data);
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Test SMS Gateway</h3>
              <p className="text-[11px] text-slate-500">Super Admin Gateway Verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRunTest} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Verify provider authorization with MSG91 and optionally dispatch a live test message to your mobile phone.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Recipient Mobile Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. +91 98765 43210"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank to only test API authentication, or enter a number to send a real SMS.
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
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
              <div>
                <p className="font-semibold">{testResult.message}</p>
                {testResult.requestId && (
                  <p className="font-mono text-[10px] text-emerald-700 mt-0.5">
                    Request ID: {testResult.requestId}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testing}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send Test SMS
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


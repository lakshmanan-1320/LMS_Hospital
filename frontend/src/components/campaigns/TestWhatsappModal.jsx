'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function TestWhatsappModal({ isOpen, onClose }) {
  const [phone, setPhone] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await campaignsService.listWhatsappTemplates(true);
        const list = res.data || [];
        setTemplates(list);
        if (list.length > 0) setSelectedTemplate(list[0].name);
      } catch (err) {
        console.error('Failed to load approved WhatsApp templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await campaignsService.testWhatsappGateway({
        to_phone: phone.trim(),
        template_name: selectedTemplate,
      });
      setFeedback({
        type: 'success',
        message: res.data?.message || 'Test message accepted by Meta Cloud API!',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to dispatch test WhatsApp message.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-100">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Test WhatsApp Gateway</h2>
              <p className="text-xs text-slate-500">Send an immediate test template message</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleTest} className="p-6 space-y-4">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Destination Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">Include country code (e.g. +91 for India).</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Approved Meta Template
            </label>
            {loadingTemplates ? (
              <div className="py-2.5 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                No approved templates found in LMS. Click &quot;Sync with Meta&quot; in the Templates tab.
              </p>
            ) : (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              >
                {templates.map((t) => (
                  <option key={t.template_id} value={t.name}>
                    {t.name} ({t.category} · {t.language})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={submitting || !phone.trim() || templates.length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send Test
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Edit,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Tag,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function SmsTemplatesTab({ role = 'super-admin' }) {
  const isSuperAdmin = role === 'super-admin';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [providerTemplateId, setProviderTemplateId] = useState('');
  const [dltTemplateId, setDltTemplateId] = useState('');
  const [category, setCategory] = useState('transactional');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await campaignsService.listTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !body.trim()) {
      setModalError('Template name and message body are required.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      await campaignsService.createTemplate({
        name: name.trim(),
        providerTemplateId: providerTemplateId.trim() || undefined,
        dltTemplateId: dltTemplateId.trim() || undefined,
        category,
        body: body.trim(),
      });
      setShowCreateModal(false);
      setName('');
      setProviderTemplateId('');
      setDltTemplateId('');
      setBody('');
      fetchTemplates();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to save template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (template) => {
    try {
      await campaignsService.updateTemplate(template.template_id, {
        isActive: !template.is_active,
      });
      fetchTemplates();
    } catch (err) {
      alert('Failed to update template status.');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await campaignsService.deleteTemplate(templateId);
      fetchTemplates();
    } catch (err) {
      alert('Failed to delete template.');
    }
  };

  // Extract variables on the fly for creation preview
  const extractedDraftVariables = Array.from(
    new Set([...body.matchAll(/##\s*([A-Za-z0-9_]+)\s*##/g)].map((m) => m[1])),
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" /> DLT & MSG91 SMS Templates
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-registered regulatory message templates with dynamic placeholders for automated variable substitution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTemplates}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" /> Add SMS Template
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-100">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-100">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No SMS Templates Configured</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Campaigns are strictly template-based. Create your first approved DLT template to begin sending bulk SMS.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100"
          >
            Create New Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div
              key={tpl.template_id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between bg-white ${
                tpl.is_active ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-60 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900">{tpl.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase">
                    {tpl.category}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono mb-3">
                  Flow ID: <strong className="text-slate-600">{tpl.provider_template_id}</strong>
                  {tpl.dlt_template_id && (
                    <span className="ml-2">• DLT: <strong className="text-slate-600">{tpl.dlt_template_id}</strong></span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-xs text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">
                  {tpl.body}
                </div>

                {/* Variable chips */}
                {Array.isArray(tpl.variables) && tpl.variables.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Detected Variables:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tpl.variables.map((v) => (
                        <span
                          key={v.key}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-mono flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-indigo-500" />
                          <span>##{v.key}##</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <label className={`flex items-center gap-2 text-xs font-semibold text-slate-600 ${isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                  <input
                    type="checkbox"
                    checked={tpl.is_active}
                    disabled={!isSuperAdmin}
                    onChange={() => isSuperAdmin && handleToggleActive(tpl)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span>{tpl.is_active ? 'Active' : 'Disabled'}</span>
                </label>

                {isSuperAdmin && (
                  <button
                    onClick={() => handleDeleteTemplate(tpl.template_id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE TEMPLATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Create Approved Message Template
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs mb-4">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Template Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Webinar Live Room Reminder"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    MSG91 Flow Template ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 64a8b7c6..."
                    value={providerTemplateId}
                    onChange={(e) => setProviderTemplateId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty to auto-generate</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    DLT Content Template ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14071612345678"
                    value={dltTemplateId}
                    onChange={(e) => setDltTemplateId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">From DLT Operator portal</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Message Body with ##placeholders## *
                </label>
                <textarea
                  rows={4}
                  placeholder="Hello ##name##, your live session on ##webinar_title## starts at ##start_time##. Join here: ##meeting_link## - Elevate LMS"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  required
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Supported tokens: ##name##, ##webinar_title##, ##meeting_link##, ##start_time##</span>
                  <span>{body.length} chars</span>
                </div>
              </div>

              {extractedDraftVariables.length > 0 && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <p className="text-[11px] font-bold text-indigo-900 mb-1.5">Auto-Detected Tokens:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedDraftVariables.map((k) => (
                      <span key={k} className="px-2 py-0.5 rounded bg-white text-indigo-700 text-xs font-mono border border-indigo-200">
                        ##{k}##
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';

export default function WhatsappTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await campaignsService.listWhatsappTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await campaignsService.syncWhatsappTemplates();
      const count = res.data?.synced ?? 0;
      setFeedback({
        type: 'success',
        message: `Successfully synced ${count} template(s) from Meta Cloud API!`,
      });
      fetchTemplates();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to sync templates from Meta.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = templates.filter((t) =>
    `${t.name} ${t.category} ${t.body_text}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" /> Meta Approved Message Templates
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Under Meta policy, business conversations must initiate using templates approved in Meta Business Suite.
          </p>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing with Meta...' : 'Sync with Meta Cloud API'}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
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

      {/* Search Input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates by name or body text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Showing {filtered.length} of {templates.length} templates
        </span>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading templates...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Templates Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            {templates.length === 0
              ? 'No templates cached yet. Click "Sync with Meta Cloud API" above to import your approved templates.'
              : 'No templates match your search term.'}
          </p>
          {templates.length === 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
            >
              Sync Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((t) => {
            const varList = Array.isArray(t.variables) ? t.variables : [];
            const isApproved = t.status === 'APPROVED';

            return (
              <div
                key={t.template_id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                      {t.category}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : t.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : t.status === 'PENDING' ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 tracking-tight mb-1 truncate" title={t.name}>
                    {t.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">Language: {t.language}</p>

                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 mb-4 text-xs font-normal text-slate-700 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {t.body_text}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Variables: <strong className="text-slate-800">{varList.length}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Synced: {new Date(t.synced_at || t.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


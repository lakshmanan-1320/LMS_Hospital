'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Users,
  Eye,
  FileText,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function SmsCampaignsTab({ role = 'admin', onLaunchCreateCampaign }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await campaignsService.listCampaigns();
      setCampaigns(res.data?.campaigns || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleExportCampaignsReport = () => {
    if (!campaigns.length) return;
    const reportData = campaigns.map((c) => ({
      'Campaign Name': c.name,
      'Template Name': c.template_name || 'DLT Template',
      'Target Audience': c.target_type?.replace('_', ' ') || 'Webinar Registrants',
      'Total Recipients': Number(c.total_recipients || 0),
      'Sent Count': Number(c.sent_count || 0),
      'Failed Count': Number(c.failed_count || 0),
      'Delivery Rate':
        Number(c.total_recipients || 0) > 0
          ? `${Math.round((Number(c.sent_count || 0) / Number(c.total_recipients)) * 100)}%`
          : '100%',
      'Status': c.status,
      'Created At': new Date(c.created_at).toLocaleString(),
    }));
    exportToExcel(
      reportData,
      `SMS_Campaigns_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'SMS Campaigns',
    );
  };

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    String(c.template_name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Compute aggregate statistics
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalRecipients = campaigns.reduce((acc, c) => acc + (c.total_recipients || 0), 0);
  const deliveryRate = totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Campaigns</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCampaigns}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">SMS Bulk Dispatches</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Dispatched</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalSent}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Out of {totalRecipients} queued</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivery Rate</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{deliveryRate}%</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">High carrier throughput</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audience Targeting</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1">Webinars &amp; Excel</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Auto-mapped variables &amp; sheets</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Campaign Management Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">SMS Campaign History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All bulk SMS communications sent to webinar registrants and students.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCampaignsReport}
              disabled={!campaigns.length}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
              title="Export all campaigns to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Report</span>
            </button>
            <button
              onClick={fetchCampaigns}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Refresh campaigns"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {role !== 'super-admin' && (
              <>
                <button
                  onClick={() => onLaunchCreateCampaign('custom_list')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Upload Excel Contacts
                </button>
                <button
                  onClick={() => onLaunchCreateCampaign('webinar_registrants')}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> New SMS Campaign
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by campaign name or template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading campaigns...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No SMS Campaigns Dispatched Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Launch a targeted broadcast to webinar attendees or import contacts directly from an Excel spreadsheet.
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-2">
                <button
                  onClick={() => onLaunchCreateCampaign('custom_list')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Excel &amp; Send
                </button>
                <button
                  onClick={() => onLaunchCreateCampaign('webinar_registrants')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> New SMS Campaign
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Campaign Name</th>
                  <th className="py-3 px-6">Template Used</th>
                  <th className="py-3 px-6">Target Audience</th>
                  <th className="py-3 px-6">Total / Sent</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((c) => {
                  const statusColors = {
                    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    processing: 'bg-blue-50 text-blue-700 border-blue-200',
                    failed: 'bg-rose-50 text-rose-700 border-rose-200',
                    draft: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr key={c.campaign_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        {c.name}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-indigo-600 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{c.template_name || 'Standard Template'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        <span className="capitalize">{String(c.target_type || '').replace('_', ' ')}</span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-medium text-slate-700">
                        <strong>{c.sent_count || 0}</strong> / {c.total_recipients || 0}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                            statusColors[c.status] || statusColors.draft
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-400">
                        {c.started_at ? new Date(c.started_at).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Send,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Users,
  CheckCheck,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function WhatsappCampaignsTab({ onLaunchSendBulk }) {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({ total: 0, delivered: 0, read: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        campaignsService.listWhatsappCampaigns(),
        campaignsService.getWhatsappOutboxStats(),
      ]);
      setCampaigns(listRes.data || []);
      setStats(statsRes.data || { total: 0, delivered: 0, read: 0, failed: 0 });
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleExport = () => {
    if (!campaigns.length) return;
    const exportData = campaigns.map((c) => ({
      Campaign_Name: c.name,
      Template: c.template_name || 'N/A',
      Audience: c.target_type,
      Total_Recipients: c.total_recipients,
      Sent: c.sent_count,
      Delivered: c.delivered_count,
      Status: c.status,
      Dispatched_At: c.started_at ? new Date(c.started_at).toLocaleString() : '',
    }));
    exportToExcel(exportData, 'WhatsApp_Campaigns_Report.xlsx', 'Campaigns');
  };

  const filtered = campaigns.filter((c) =>
    `${c.name} ${c.template_name || ''} ${c.target_type}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const deliveryRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 100;
  const readRate = stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Campaigns</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{campaigns.length}</p>
          <span className="text-[11px] text-slate-400">Meta Cloud API Broadcasts</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dispatched Messages</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">{stats.delivered} delivered</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Rate</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{deliveryRate}%</p>
          <span className="text-[11px] text-slate-400">High carrier throughput</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audience Targeting</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">Webinars &amp; Excel</p>
          <span className="text-[11px] text-slate-400">Auto-mapped variables</span>
        </div>
      </div>

      {/* Campaigns History Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">WhatsApp Campaign History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly template-based broadcast campaigns sent via Meta WhatsApp Cloud API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExport}
              disabled={campaigns.length === 0}
              className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Report
            </button>
            <button
              onClick={fetchCampaigns}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              title="Refresh campaigns"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onLaunchSendBulk && (
              <>
                <button
                  onClick={() => onLaunchSendBulk('custom_list')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Excel Contacts
                </button>
                <button
                  onClick={() => onLaunchSendBulk('webinar_registrants')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" /> + New WhatsApp Campaign
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by campaign name or template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading WhatsApp campaigns...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-800">No WhatsApp Campaigns Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Launch your first bulk WhatsApp announcement or webinar alert using approved Meta templates.
            </p>
            {onLaunchSendBulk && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => onLaunchSendBulk('custom_list')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Excel &amp; Send
                </button>
                <button
                  onClick={() => onLaunchSendBulk('webinar_registrants')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
                >
                  <Send className="w-3.5 h-3.5" /> Send First WhatsApp Campaign
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-wider text-[10px] font-bold text-slate-500">
                <tr>
                  <th className="px-6 py-3.5">Campaign</th>
                  <th className="px-6 py-3.5">Template</th>
                  <th className="px-6 py-3.5">Audience</th>
                  <th className="px-6 py-3.5">Recipients</th>
                  <th className="px-6 py-3.5">Sent / Delivered</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((c) => (
                  <tr key={c.campaign_id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {c.template_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize text-slate-600">
                      {c.target_type === 'custom_list' ? 'Excel Import' : c.target_type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{c.total_recipients}</td>
                    <td className="px-6 py-4 text-emerald-700 font-bold">
                      {c.sent_count} / {c.delivered_count}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                          c.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'processing'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-[11px]">
                      {c.started_at
                        ? new Date(c.started_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Draft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


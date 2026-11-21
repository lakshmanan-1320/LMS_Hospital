'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Inbox,
  Sparkles,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function EmailCampaignsTab({ role, onLaunchSendBulk }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmails: 0,
    sentCount: 0,
    failedCount: 0,
    deliveryRate: 100,
  });

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await campaignsService.listEmailCampaigns(50, 0);
      const list = res?.data?.campaigns || res?.data?.data?.campaigns || [];
      setCampaigns(list);

      // Compute aggregated metrics
      let total = 0;
      let sent = 0;
      let failed = 0;

      for (const c of list) {
        total += Number(c.total_recipients || 0);
        sent += Number(c.sent_count || 0);
        failed += Number(c.failed_count || 0);
      }

      const rate = total > 0 ? Math.round((sent / total) * 100) : 100;
      setStats({
        totalEmails: total,
        sentCount: sent,
        failedCount: failed,
        deliveryRate: rate,
      });
    } catch (err) {
      console.error('Failed to load email campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCampaignsReport = () => {
    if (!campaigns.length) return;
    const reportData = campaigns.map((c) => ({
      'Campaign Name': c.name,
      'Template Name': c.template_name || 'Custom Template',
      'Audience Segment': c.target_type?.replace('_', ' ') || 'All',
      'Total Recipients': Number(c.total_recipients || 0),
      'Sent Count': Number(c.sent_count || 0),
      'Failed Count': Number(c.failed_count || 0),
      'Delivery Rate':
        Number(c.total_recipients || 0) > 0
          ? `${Math.round((Number(c.sent_count || 0) / Number(c.total_recipients)) * 100)}%`
          : '100%',
      'Status': c.status,
      'Dispatched By': c.creator_name || 'Admin',
      'Created At': new Date(c.created_at).toLocaleString(),
    }));
    exportToExcel(
      reportData,
      `Email_Campaigns_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Campaigns Report',
    );
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Dispatched
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats.totalEmails.toLocaleString()}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Delivered
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {stats.sentCount.toLocaleString()}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Delivery Success
            </div>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {stats.deliveryRate}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Failed Deliveries
            </div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {stats.failedCount.toLocaleString()}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Campaigns Table Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight">
              Email Broadcast History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly template-based batch email campaigns sent to platform audiences.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLaunchSendBulk('custom_list')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 flex items-center gap-2 transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Upload Excel Contacts
            </button>
            <button
              onClick={() => onLaunchSendBulk('students')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition"
            >
              <Send className="w-4 h-4" /> Send Bulk Email
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Loading campaigns...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Email Campaigns Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Launch your first bulk email announcement using our template designer or import an Excel spreadsheet.
            </p>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => onLaunchSendBulk('custom_list')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Excel &amp; Send
              </button>
              <button
                onClick={() => onLaunchSendBulk('students')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition"
              >
                <Send className="w-3.5 h-3.5" /> Send First Email Campaign
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-6">Campaign Name</th>
                  <th className="py-3.5 px-4">Template</th>
                  <th className="py-3.5 px-4">Audience</th>
                  <th className="py-3.5 px-4">Progress & Delivery</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {campaigns.map((c) => {
                  const total = Number(c.total_recipients || 0);
                  const sent = Number(c.sent_count || 0);
                  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

                  return (
                    <tr key={c.campaign_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {c.name}
                        <div className="text-[11px] text-slate-400 font-normal">
                          By {c.creator_name || 'Admin'}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-700">
                        {c.template_name || 'Custom Template'}
                      </td>
                      <td className="py-4 px-4">
                        <span className="capitalize px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                          {c.target_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                            <span>{sent}/{total} sent</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider ${
                            c.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.status === 'processing'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-400 text-[11px]">
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


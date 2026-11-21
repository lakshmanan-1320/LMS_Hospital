'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  CheckCheck,
  Send,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function WhatsappOutboxLogsTab() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, delivered: 0, read: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        campaignsService.listWhatsappOutboxLogs({ status: statusFilter || undefined }),
        campaignsService.getWhatsappOutboxStats(),
      ]);
      setLogs(logsRes.data || []);
      setStats(statsRes.data || { total: 0, delivered: 0, read: 0, failed: 0 });
    } catch (err) {
      console.error('Failed to load WhatsApp logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleExport = () => {
    if (!logs.length) return;
    const exportData = logs.map((l) => ({
      Phone: l.recipient_phone,
      Recipient: l.recipient_name || 'N/A',
      Status: l.status,
      Template: l.template_name || 'N/A',
      Message: l.rendered_body,
      Meta_Message_ID: l.meta_message_id || '',
      Error: l.error_message || '',
      Sent_At: l.sent_at ? new Date(l.sent_at).toLocaleString() : '',
      Delivered_At: l.delivered_at ? new Date(l.delivered_at).toLocaleString() : '',
      Read_At: l.read_at ? new Date(l.read_at).toLocaleString() : '',
    }));
    exportToExcel(exportData, 'WhatsApp_Delivery_Logs.xlsx', 'Delivery_Logs');
  };

  const filteredLogs = logs.filter((l) =>
    `${l.recipient_phone} ${l.recipient_name || ''} ${l.rendered_body}`
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
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Dispatched</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.total}</p>
          <span className="text-[11px] text-slate-400">Total WhatsApp messages</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivered</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.delivered}</p>
          <span className="text-[11px] text-emerald-600 font-semibold">{deliveryRate}% delivery rate</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Read Receipts</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.read}</p>
          <span className="text-[11px] text-blue-600 font-semibold">{readRate}% opened &amp; read</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Delivery Failures</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{stats.failed}</p>
          <span className="text-[11px] text-slate-400">Undelivered or invalid</span>
        </div>
      </div>

      {/* Action / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search phone, recipient, message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="READ">Read</option>
            <option value="FAILED">Failed</option>
          </select>

          <button
            onClick={fetchLogs}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleExport}
          disabled={logs.length === 0}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export to Excel
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Loading delivery logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs font-semibold">
            No WhatsApp delivery logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 uppercase tracking-wider text-[10px] font-bold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Recipient</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Template</th>
                  <th className="px-5 py-3.5">Message Preview</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map((log) => {
                  const isRead = log.status === 'READ';
                  const isDelivered = log.status === 'DELIVERED';
                  const isSent = log.status === 'SENT';
                  const isFailed = log.status === 'FAILED' || log.status === 'REJECTED';

                  return (
                    <tr key={log.outbox_id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {log.recipient_name || 'N/A'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {log.recipient_phone}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {log.template_name || 'Template'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-500" title={log.rendered_body}>
                        {log.rendered_body}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isRead
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : isDelivered
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isSent
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                          ) : isDelivered ? (
                            <CheckCheck className="w-3.5 h-3.5" />
                          ) : isSent ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5" />
                          )}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {log.sent_at ? new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Pending'}
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


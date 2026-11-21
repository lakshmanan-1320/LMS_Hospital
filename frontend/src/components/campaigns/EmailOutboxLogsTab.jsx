'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Copy,
  Info,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function EmailOutboxLogsTab({ role }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await campaignsService.listEmailOutboxLogs({
        search: search || undefined,
        status: statusFilter || undefined,
        limit: 50,
      });
      const data = res?.data || {};
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load email outbox logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleExportExcel = () => {
    if (!logs.length) return;
    const exportData = logs.map((log) => ({
      'Recipient Name': log.recipient_name || 'Learner',
      'Recipient Email': log.recipient_email,
      'Subject': log.subject || '',
      'Status': log.status,
      'Sent At': log.sent_at ? new Date(log.sent_at).toLocaleString() : '—',
      'SMTP Message ID': log.smtp_message_id || '—',
      'Error Message': log.error_message || '',
    }));
    exportToExcel(
      exportData,
      `Email_Delivery_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Delivery Logs',
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" /> Email Delivery Audit &amp; Outbox
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time delivery verification logs, SMTP message IDs, and carrier dispatch status.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleExportExcel}
            disabled={!logs.length}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-xs"
            title="Export logs to Excel spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export to Excel
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, name or subject..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['', 'SENT', 'FAILED', 'PENDING'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {st === '' ? 'All Statuses' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Loading delivery audit records...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Clock className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Delivery Logs Found</h3>
            <p className="text-xs text-slate-500">
              When email campaigns are dispatched, individual recipient records will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-6">Recipient</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Campaign</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">SMTP Details / Error</th>
                  <th className="py-3.5 px-6 text-right">Sent Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {logs.map((log) => (
                  <tr key={log.outbox_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {log.recipient_name || 'Learner'}
                      <div className="text-[11px] text-slate-400 font-mono font-normal">
                        {log.recipient_email}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800 max-w-xs truncate">
                      {log.subject}
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-medium truncate max-w-[160px]">
                      {log.campaign_name || 'Direct Dispatch'}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider ${
                          log.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-400 max-w-xs truncate">
                      {log.smtp_message_id ? (
                        <span className="text-slate-600" title={log.smtp_message_id}>
                          {log.smtp_message_id}
                        </span>
                      ) : log.error_message ? (
                        <span className="text-rose-600" title={log.error_message}>
                          {log.error_message}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4 px-6 text-right text-slate-400 text-[11px]">
                      {log.sent_at
                        ? new Date(log.sent_at).toLocaleString()
                        : new Date(log.created_at).toLocaleString()}
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


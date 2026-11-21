'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Send,
  Loader2,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import campaignsService from '@/modules/campaigns/services/campaigns.service';
import { exportToExcel } from '@/utils/excel.utils';

export default function SmsOutboxLogsTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [syncMessage, setSyncMessage] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await campaignsService.listOutboxLogs(100);
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSyncStatuses = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await campaignsService.syncStatuses();
      setSyncMessage(`Delivery reports synced. ${res.data?.synced || 0} record(s) updated.`);
      fetchLogs();
    } catch (err) {
      setSyncMessage('Failed to sync statuses with provider.');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      String(log.recipient_name || '').toLowerCase().includes(q) ||
      String(log.recipient_phone || '').includes(q) ||
      String(log.rendered_body || '').toLowerCase().includes(q) ||
      String(log.provider_request_id || '').toLowerCase().includes(q)
    );
  });

  const handleExportExcel = () => {
    if (!logs.length) return;
    const exportData = logs.map((log) => ({
      'Recipient Name': log.recipient_name || 'Learner',
      'Recipient Phone': log.recipient_phone,
      'Rendered SMS Body': log.rendered_body || '',
      'Status': log.status,
      'Sent At': log.sent_at ? new Date(log.sent_at).toLocaleString() : '—',
      'Delivered At': log.delivered_at ? new Date(log.delivered_at).toLocaleString() : '—',
      'Provider Request ID': log.provider_request_id || '—',
      'Error Message': log.error_message || '',
    }));
    exportToExcel(
      exportData,
      `SMS_Delivery_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'SMS Delivery Logs',
    );
  };

  const statusBadges = {
    DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SENT: 'bg-blue-50 text-blue-700 border-blue-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
    REJECTED: 'bg-amber-50 text-amber-700 border-amber-200',
    PENDING: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" /> Real-time Delivery Audit & Outbox
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Per-recipient message logs with real-time MSG91 carrier delivery acknowledgments and error reporting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportExcel}
            disabled={!logs.length}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            title="Export SMS delivery logs to Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={fetchLogs}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSyncStatuses}
            disabled={syncing}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Delivery Reports
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by recipient name, phone, or request ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading delivery logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No delivery records found.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Recipient</th>
                  <th className="py-3 px-6">Campaign</th>
                  <th className="py-3 px-6">Rendered Message</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Carrier Reference</th>
                  <th className="py-3 px-6">Sent Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((log) => (
                  <tr key={log.outbox_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-6">
                      <div className="font-bold text-slate-900">{log.recipient_name || 'Student'}</div>
                      <div className="font-mono text-slate-500 text-[11px]">{log.recipient_phone}</div>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="font-semibold text-slate-700">{log.campaign_name || 'Campaign'}</span>
                    </td>
                    <td className="py-3.5 px-6 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 font-mono text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {log.rendered_body}
                      </p>
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                          statusBadges[log.status] || statusBadges.PENDING
                        }`}
                      >
                        {log.status}
                      </span>
                      {log.error_message && (
                        <p className="text-[10px] text-rose-600 mt-0.5 line-clamp-1">{log.error_message}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[11px] text-slate-400">
                      {log.provider_request_id || 'N/A'}
                    </td>
                    <td className="py-3.5 px-6 text-slate-400 whitespace-nowrap">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'Queued'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


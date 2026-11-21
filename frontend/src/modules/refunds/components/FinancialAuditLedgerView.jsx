'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  FileText,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
} from 'lucide-react';
import { useRefundStore } from '../stores/useRefundStore';

const EVENT_TYPE_CONFIG = {
  ORDER_CREATED: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'Order Created',
  },
  PAYMENT_CAPTURED: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    label: 'Payment Captured',
  },
  PAYMENT_FAILED: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    label: 'Payment Failed',
  },
  REFUND_REQUESTED: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    label: 'Refund Requested',
  },
  REFUND_APPROVED: {
    bg: 'bg-purple-50 text-purple-800 border-purple-200',
    label: 'Refund Approved',
  },
  REFUND_REJECTED: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    label: 'Refund Rejected',
  },
  REFUND_PROCESSED: {
    bg: 'bg-teal-50 text-teal-800 border-teal-200',
    label: 'Refund Processed',
  },
  ENROLLMENT_REVOKED: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    label: 'Enrollment Revoked',
  },
};

export default function FinancialAuditLedgerView() {
  const {
    auditLedger,
    auditTotal,
    isLoading,
    error,
    eventTypeFilter,
    fetchAuditLedger,
    setEventTypeFilter,
  } = useRefundStore();

  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAuditLedger();
  }, [eventTypeFilter, fetchAuditLedger]);

  const formatPrice = (val, currency = 'INR') => {
    if (val === null || val === undefined) return '—';
    const num = Number(val || 0);
    return `${currency === 'INR' ? '₹' : currency} ${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch {
      return String(dateStr);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return auditLedger;
    const q = search.toLowerCase().trim();
    return auditLedger.filter((log) => {
      const desc = (log.description || '').toLowerCase();
      const ord = (log.order_id || log.orderId || '').toLowerCase();
      const ev = (log.event_type || log.eventType || '').toLowerCase();
      return desc.includes(q) || ord.includes(q) || ev.includes(q);
    });
  }, [auditLedger, search]);

  return (
    <div className="space-y-5">
      {/* Search and Event Type Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search financial audit logs by description or order ID..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400 shrink-0" />
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Events</option>
            <option value="PAYMENT_CAPTURED">Payment Captured</option>
            <option value="REFUND_REQUESTED">Refund Requested</option>
            <option value="REFUND_APPROVED">Refund Approved</option>
            <option value="REFUND_REJECTED">Refund Rejected</option>
            <option value="ENROLLMENT_REVOKED">Enrollment Revoked</option>
            <option value="ORDER_CREATED">Order Created</option>
          </select>

          <button
            type="button"
            onClick={() => fetchAuditLedger()}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Ledger"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : ''} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-xs font-medium">Fetching immutable financial audit ledger...</p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-bold">Error loading audit ledger</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <ShieldCheck size={22} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No audit logs found</h3>
          <p className="text-xs text-slate-500">
            {eventTypeFilter !== 'all' || search
              ? 'Try clearing your filter or search query.'
              : 'Financial events are logged automatically as checkouts and refunds occur.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Order / Refund Reference</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLogs.map((log) => {
                  const ev = log.event_type || log.eventType;
                  const st = EVENT_TYPE_CONFIG[ev] || {
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                    label: ev,
                  };
                  const date = log.created_at || log.createdAt;
                  const orderId = log.order_id || log.orderId;
                  const refundId = log.refund_id || log.refundId;
                  const amt = log.amount;

                  return (
                    <tr key={log.log_id || log.logId} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-sans text-xs">
                        {formatDate(date)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${st.bg}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 font-sans text-xs max-w-md">
                        {log.description}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {orderId ? (
                          <span title={orderId}>{orderId.slice(0, 13)}...</span>
                        ) : refundId ? (
                          <span title={refundId}>{refundId.slice(0, 13)}...</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-sans whitespace-nowrap">
                        {formatPrice(amt, log.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


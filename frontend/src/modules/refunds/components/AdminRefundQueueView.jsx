'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';
import { useRefundStore } from '../stores/useRefundStore';
import AdminReviewRefundModal from './AdminReviewRefundModal';

const REFUND_STATUS_CONFIG = {
  pending: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending Review',
  },
  approved: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Approved & Refunded',
  },
  processed: {
    bg: 'bg-teal-50 text-teal-800 border-teal-200',
    dot: 'bg-teal-500',
    label: 'Processed',
  },
  rejected: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Rejected',
  },
  failed: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Failed',
  },
};

export default function AdminRefundQueueView() {
  const {
    allRefunds,
    total,
    isLoading,
    error,
    statusFilter,
    page,
    limit,
    fetchAllRefunds,
    setStatusFilter,
    setPage,
  } = useRefundStore();

  const [selectedRefund, setSelectedRefund] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAllRefunds();
  }, [statusFilter, page, fetchAllRefunds]);

  const handleOpenReview = (refund) => {
    setSelectedRefund(refund);
    setModalOpen(true);
  };

  const formatPrice = (val, currency = 'INR') => {
    const num = Number(val || 0);
    return `${currency === 'INR' ? '₹' : currency} ${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const pending = allRefunds.filter((r) => r.status === 'pending');
    const approved = allRefunds.filter((r) => r.status === 'approved' || r.status === 'processed');
    const rejected = allRefunds.filter((r) => r.status === 'rejected');
    const totalAmount = approved.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return {
      total: allRefunds.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      approvedAmount: totalAmount,
    };
  }, [allRefunds]);

  // Client search filter across current batch
  const filteredRefunds = useMemo(() => {
    if (!search.trim()) return allRefunds;
    const q = search.toLowerCase().trim();
    return allRefunds.filter((r) => {
      const num = (r.refundNumber || r.refund_number || '').toLowerCase();
      const ord = (r.orderNumber || r.order_number || '').toLowerCase();
      const sName = (r.studentName || r.student_name || '').toLowerCase();
      const sEmail = (r.studentEmail || r.student_email || '').toLowerCase();
      return num.includes(q) || ord.includes(q) || sName.includes(q) || sEmail.includes(q);
    });
  }, [allRefunds, search]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Requests</span>
            <RotateCcw size={16} className="text-purple-600" />
          </div>
          <div className="text-2xl font-heading font-bold text-slate-900">{metrics.total}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Submitted by students</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Needs Action</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-heading font-bold text-amber-700">{metrics.pendingCount}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Pending review</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Approved</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-heading font-bold text-emerald-700">{metrics.approvedCount}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {formatPrice(metrics.approvedAmount)} reversed
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rejected</span>
            <XCircle size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-heading font-bold text-rose-700">{metrics.rejectedCount}</div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Declined requests</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by refund #, order #, or student name/email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-teal-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            type="button"
            onClick={fetchAllRefunds}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
          <p className="text-xs font-medium">Fetching refund requests queue...</p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-bold">Error loading refund queue</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : filteredRefunds.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <RotateCcw size={22} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No refund requests found</h3>
          <p className="text-xs text-slate-500">
            {statusFilter !== 'all' || search
              ? 'Try adjusting your search or status filter.'
              : 'There are currently no refund requests submitted by students.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Refund #</th>
                  <th className="py-3.5 px-4">Order #</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((ref) => {
                  const status = ref.status || 'pending';
                  const st = REFUND_STATUS_CONFIG[status] || REFUND_STATUS_CONFIG.failed;
                  const refundNum = ref.refundNumber || ref.refund_number;
                  const orderNum = ref.orderNumber || ref.order_number || '—';
                  const amt = ref.amount;
                  const date = ref.createdAt || ref.created_at;
                  const studentName = ref.studentName || ref.student_name || 'Student';
                  const studentEmail = ref.studentEmail || ref.student_email || '';
                  const reason = ref.reason || '—';

                  return (
                    <tr key={ref.refundId || ref.refund_id || refundNum} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {refundNum}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {orderNum}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{studentName}</p>
                        {studentEmail && (
                          <p className="text-[11px] text-slate-500 font-mono">{studentEmail}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatDate(date)}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-slate-600 truncate" title={reason}>
                        "{reason}"
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatPrice(amt, ref.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(ref)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 transition shadow-xs"
                          >
                            <span>Review</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(ref)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1 || isLoading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>
          <span className="text-slate-500 font-medium">
            Page <strong className="text-slate-900">{page}</strong> of{' '}
            <strong className="text-slate-900">{totalPages}</strong>
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isLoading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Review Modal */}
      <AdminReviewRefundModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedRefund(null);
        }}
        refund={selectedRefund}
        onSuccess={() => fetchAllRefunds()}
      />
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { useRefundStore } from '../stores/useRefundStore';

export default function AdminReviewRefundModal({ isOpen, onClose, refund, onSuccess }) {
  const { reviewRefund, isReviewing } = useRefundStore();
  const [adminNotes, setAdminNotes] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen || !refund) return null;

  const refundId = refund.refundId || refund.refund_id;
  const refundNumber = refund.refundNumber || refund.refund_number;
  const orderNumber = refund.orderNumber || refund.order_number || '—';
  const studentName = refund.studentName || refund.student_name || 'Student';
  const studentEmail = refund.studentEmail || refund.student_email || '';
  const amount = Number(refund.amount || 0);
  const currency = refund.currency || 'INR';
  const reason = refund.reason || 'No reason provided';

  const formatPrice = (val, cur = 'INR') => {
    const num = Number(val || 0);
    return `${cur === 'INR' ? '₹' : cur} ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleDecision = async (decision) => {
    setLocalError('');
    const res = await reviewRefund(refundId, {
      decision,
      admin_notes: adminNotes.trim() || undefined,
    });

    if (res?.success) {
      if (onSuccess) onSuccess(decision);
      onClose();
    } else {
      setLocalError(res?.error || 'Failed to submit review decision.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">Review Refund Request</h3>
              <p className="text-xs text-slate-500 font-mono">{refundNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isReviewing}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Associated Order:</span>
              <span className="font-mono font-bold text-slate-900">{orderNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Student:</span>
              <span className="font-bold text-slate-900">
                {studentName} {studentEmail && <span className="text-slate-400 font-normal font-mono">({studentEmail})</span>}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Refund Amount:</span>
              <span className="text-sm font-bold text-purple-700">{formatPrice(amount, currency)}</span>
            </div>
          </div>

          {/* Student's Reason */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Student's Reason:
            </span>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 italic">
              "{reason}"
            </div>
          </div>

          {/* Warning Banner on Approval consequences */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Approval Workflow: </strong>
              Approving this request triggers an automated refund reversal through Razorpay back to the student's card/UPI and revokes active course enrollments automatically.
            </div>
          </div>

          {/* Error Banner */}
          {localError && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{localError}</span>
            </div>
          )}

          {/* Admin Notes */}
          <div className="space-y-1.5">
            <label htmlFor="admin-notes" className="block text-xs font-bold text-slate-700">
              Admin Review Notes (Optional)
            </label>
            <input
              id="admin-notes"
              type="text"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Approved per 30-day guarantee policy / Rejected due to course completion..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isReviewing}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDecision('reject')}
                disabled={isReviewing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>

              <button
                type="button"
                onClick={() => handleDecision('approve')}
                disabled={isReviewing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
              >
                {isReviewing ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Approve & Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  DollarSign,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useRefundStore } from '../stores/useRefundStore';
import { refundService } from '../services/refund.service';

export default function RequestRefundModal({ isOpen, onClose, order, onSuccess }) {
  const { submitRefundRequest, isSubmitting } = useRefundStore();
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState(null);

  const orderId = order?.order_id || order?.orderId;
  const orderNumber = order?.order_number || order?.orderNumber;
  const amount = Number(order?.total_amount ?? order?.totalAmount ?? 0);
  const currency = order?.currency || 'INR';

  useEffect(() => {
    if (isOpen && orderId) {
      setCheckingEligibility(true);
      setLocalError('');
      refundService
        .checkEligibility(orderId)
        .then((res) => {
          setEligibility(res);
        })
        .catch((err) => {
          setLocalError(err?.message || 'Could not verify refund eligibility.');
        })
        .finally(() => {
          setCheckingEligibility(false);
        });
    } else {
      setEligibility(null);
      setReason('');
      setLocalError('');
      setIsSuccess(false);
    }
  }, [isOpen, orderId]);

  if (!isOpen || !order) return null;

  const formatPrice = (val, cur = 'INR') => {
    const num = Number(val || 0);
    return `${cur === 'INR' ? '₹' : cur} ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!reason.trim() || reason.trim().length < 5) {
      setLocalError('Please provide a reason of at least 5 characters explaining your refund request.');
      return;
    }

    const res = await submitRefundRequest({
      order_id: orderId,
      reason: reason.trim(),
    });

    if (res?.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setReason('');
        if (onSuccess) onSuccess(res.data);
        onClose();
      }, 1500);
    } else {
      setLocalError(res?.error || 'Failed to submit refund request.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">Request Course Refund</h3>
              <p className="text-xs text-slate-500 font-mono">Order {orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Refund Request Submitted!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your request is now pending review by our support team. You can track its status under your Purchase History &gt; Refunds tab.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Dynamic Policy & Anti-Abuse Info Card */}
            {checkingEligibility ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent shrink-0" />
                <span>Verifying course refund policy and curriculum progress...</span>
              </div>
            ) : eligibility && !eligibility.eligible ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Ineligible for Refund</span>
                  {eligibility.reasons && eligibility.reasons.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5 text-rose-800 text-[11px]">
                      {eligibility.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-rose-800">
                      This order does not meet the instructor&apos;s dynamic refund guarantee or anti-abuse consumption criteria.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5 text-xs text-teal-900 flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-teal-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Money-Back Guarantee Active: </span>
                  You are within the course refund window and have consumed less than 50% of the curriculum. Upon approval, funds will be returned to your original payment method and access will be revoked.
                </div>
              </div>
            )}

            {/* Refund Order Summary */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Refund Amount:</span>
                <span className="font-bold text-slate-900 text-sm">{formatPrice(amount, currency)}</span>
              </div>
              {eligibility?.courses && eligibility.courses.length > 0 ? (
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Courses &amp; Curriculum Consumption:
                  </span>
                  {eligibility.courses.map((c) => (
                    <div key={c.courseId} className="flex items-center justify-between text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <BookOpen size={12} className="text-teal-600 shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                        <span className="font-medium text-slate-500">
                          {c.completedLessons}/{c.totalLessons} lessons ({c.progressPercent}%)
                        </span>
                        {c.isDisqualifiedByConsumption ? (
                          <span className="rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[10px] font-bold">
                            &gt;50% Consumed
                          </span>
                        ) : !c.isRefundable ? (
                          <span className="rounded bg-slate-200 text-slate-700 px-1.5 py-0.5 text-[10px] font-bold">
                            Non-refundable
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                            Eligible
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : order.items && order.items.length > 0 ? (
                <div className="pt-2 border-t border-slate-200/60 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Courses Included:
                  </span>
                  {order.items.map((it) => (
                    <div key={it.courseId || it.orderItemId} className="flex items-center gap-1.5 text-slate-700">
                      <BookOpen size={12} className="text-teal-600 shrink-0" />
                      <span className="truncate">{it.title}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Error Banner */}
            {localError && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{localError}</span>
              </div>
            )}

            {/* Reason Textarea */}
            <div className="space-y-1.5">
              <label htmlFor="refund-reason" className="block text-xs font-bold text-slate-700">
                Reason for Refund <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="refund-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={eligibility && !eligibility.eligible}
                placeholder="Please tell us why you are requesting a refund (e.g. course did not meet expectations, technical issues, wrong course purchased)..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400">Minimum 5 characters</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  checkingEligibility ||
                  (eligibility && !eligibility.eligible) ||
                  !reason.trim() ||
                  reason.trim().length < 5
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Submit Refund Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


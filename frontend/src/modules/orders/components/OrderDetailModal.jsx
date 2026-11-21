'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  Receipt,
  FileText,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Tag,
} from 'lucide-react';

const STATUS_CONFIG = {
  completed: {
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Completed · Paid',
  },
  pending: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Pending Payment',
  },
  failed: {
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    label: 'Failed',
  },
  refunded: {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    label: 'Refunded',
  },
  partially_refunded: {
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    label: 'Partially Refunded',
  },
  cancelled: {
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: 'Cancelled',
  },
};

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  isLoading,
  onOpenInvoice,
  role = 'student',
}) {
  if (!isOpen) return null;

  const currency = order?.currency || 'INR';
  const formatPrice = (val) => {
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
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateStr);
    }
  };

  const statusInfo = STATUS_CONFIG[order?.status] || {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    label: order?.status || 'Unknown',
  };

  const isStudent = role === 'student';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-teal-600" />
            <h3 className="font-heading font-bold text-slate-900 text-sm">
              Order Breakdown · <span className="font-mono text-teal-700">{order?.orderNumber || 'Details'}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <p className="text-sm">Loading order information...</p>
          </div>
        ) : !order ? (
          <div className="p-8 text-center text-slate-500">
            <p className="font-semibold text-slate-700">Order not found.</p>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Top Meta Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Order Status
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.bg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </span>
                  {order.invoiceNumber && (
                    <span className="text-xs text-slate-500 font-mono">
                      Invoice: {order.invoiceNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Ordered on {formatDate(order.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenInvoice && onOpenInvoice(order.orderNumber || order.orderId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100 transition shadow-xs"
                >
                  <FileText size={14} />
                  <span>View Tax Invoice</span>
                </button>
              </div>
            </div>

            {/* Courses Line Items */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Purchased Courses ({order.items?.length || 0})
              </h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
                {order.items?.map((item) => (
                  <div
                    key={item.orderItemId || item.courseId}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-slate-900 leading-snug">
                          {item.title}
                        </h5>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ID: <span className="font-mono">{item.courseId?.slice(0, 8)}...</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                      <div>
                        {Number(item.regularPrice) > Number(item.finalPrice) && (
                          <del className="text-[11px] text-slate-400 block">
                            {formatPrice(item.regularPrice)}
                          </del>
                        )}
                        <span className="font-bold text-sm text-slate-900">
                          {Number(item.finalPrice) === 0 ? 'FREE' : formatPrice(item.finalPrice)}
                        </span>
                      </div>

                      {isStudent && (
                        <Link
                          href={`/my-learning/${item.courseId}`}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition shrink-0"
                        >
                          <GraduationCap size={13} />
                          <span>Learn</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Financial Ledger Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Payment Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block mb-2">
                  Payment Verification
                </span>
                <div className="flex justify-between text-slate-600">
                  <span>Gateway:</span>
                  <span className="font-semibold text-slate-800">
                    {order.paymentMethod ? order.paymentMethod.toUpperCase() : 'Razorpay Secure'}
                  </span>
                </div>
                {order.paymentId && (
                  <div className="flex justify-between text-slate-600">
                    <span>Payment ID:</span>
                    <span className="font-mono text-slate-800">{order.paymentId}</span>
                  </div>
                )}
                {order.paymentOrderId && (
                  <div className="flex justify-between text-slate-600">
                    <span>Order Ref ID:</span>
                    <span className="font-mono text-slate-800">{order.paymentOrderId}</span>
                  </div>
                )}
                {order.paidAt && (
                  <div className="flex justify-between text-slate-600">
                    <span>Paid Timestamp:</span>
                    <span>{formatDate(order.paidAt)}</span>
                  </div>
                )}
              </div>

              {/* Price Calculation */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px] block mb-2">
                  Amount Summary
                </span>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                {Number(order.courseDiscount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Course Sale Discounts:</span>
                    <span>-{formatPrice(order.courseDiscount)}</span>
                  </div>
                )}
                {Number(order.couponDiscount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      <Tag size={12} />
                      Coupon {order.couponCode ? `(${order.couponCode})` : ''}:
                    </span>
                    <span>-{formatPrice(order.couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                  <span>Total Paid:</span>
                  <span className="text-teal-700 text-base">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


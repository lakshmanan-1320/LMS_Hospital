'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  BookOpen,
  GraduationCap,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RotateCcw,
  Clock,
  XCircle,
} from 'lucide-react';
import { useOrderStore } from '../stores/useOrderStore';
import { useRefundStore } from '@/modules/refunds/stores/useRefundStore';
import InvoiceModal from './InvoiceModal';
import RequestRefundModal from '@/modules/refunds/components/RequestRefundModal';

const REFUND_STATUS_STYLES = {
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

export default function StudentPurchaseHistoryView() {
  const {
    orders,
    selectedInvoice,
    isLoading: isOrdersLoading,
    isInvoiceLoading,
    error: ordersError,
    fetchOrders,
    fetchInvoice,
    clearSelectedInvoice,
  } = useOrderStore();

  const {
    myRefunds,
    isLoading: isRefundsLoading,
    error: refundsError,
    fetchMyRefunds,
  } = useRefundStore();

  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'refunds'
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState(null);

  useEffect(() => {
    fetchOrders('student');
    fetchMyRefunds();
  }, [fetchOrders, fetchMyRefunds]);

  const handleOpenInvoice = async (identifier) => {
    setInvoiceModalOpen(true);
    await fetchInvoice(identifier);
  };

  const handleOpenRefundModal = (order) => {
    setOrderToRefund(order);
    setRefundModalOpen(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  const formatPrice = (val, currency = 'INR') => {
    const num = Number(val || 0);
    if (num === 0) return 'Free';
    return `${currency === 'INR' ? '₹' : currency} ${num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Set of order IDs that already have an active/submitted refund
  const refundOrderIds = useMemo(() => {
    return new Set(myRefunds.map((r) => r.orderId || r.order_id));
  }, [myRefunds]);

  // Flatten orders into individual purchased course items (Udemy model)
  const purchasedItems = useMemo(() => {
    const list = [];
    orders.forEach((order) => {
      const isRefund = order.status === 'refunded';
      const items = order.items && order.items.length > 0
        ? order.items
        : [
            {
              orderItemId: order.order_id || order.orderId || order.order_number,
              courseId: null,
              title: 'Course Enrollment',
              finalPrice: order.total_amount ?? order.totalAmount ?? 0,
              currency: order.currency || 'INR',
            },
          ];

      // Dynamic Refund Window & Eligibility Check (Udemy model)
      const orderDate = new Date(order.created_at || order.createdAt || Date.now()).getTime();
      const ageDays = (Date.now() - orderDate) / (1000 * 60 * 60 * 24);
      const hasSubmittedRefund = refundOrderIds.has(order.order_id || order.orderId);

      items.forEach((item) => {
        const itemRefundable = item.isRefundable !== false;
        const refundPeriodDays = item.refundPeriodDays !== undefined && item.refundPeriodDays !== null ? Number(item.refundPeriodDays) : 30;
        const windowExpired = ageDays > refundPeriodDays;

        const isEligibleForRefund =
          !isRefund &&
          order.status === 'completed' &&
          Number(order.total_amount ?? order.totalAmount ?? 0) > 0 &&
          itemRefundable &&
          !windowExpired &&
          !hasSubmittedRefund;

        list.push({
          rawOrder: order,
          orderId: order.order_id || order.orderId,
          orderNumber: order.order_number || order.orderNumber,
          invoiceNumber: order.invoice_number || order.invoiceNumber,
          date: order.created_at || order.createdAt || order.paid_at || order.paidAt,
          status: order.status || 'completed',
          paymentMethod:
            order.payment_method ||
            order.paymentMethod ||
            (Number(order.total_amount ?? order.totalAmount) === 0 ? 'Free Access' : 'Razorpay'),
          paymentId: order.payment_id || order.paymentId,
          isRefund,
          isEligibleForRefund,
          nonRefundable: !itemRefundable,
          windowExpired,
          hasSubmittedRefund,
          refundPeriodDays,
          couponCode: order.coupon_code || order.couponCode,
          item,
        });
      });
    });

    return list;
  }, [orders, refundOrderIds]);

  const activePurchases = useMemo(
    () => purchasedItems.filter((i) => !i.isRefund && i.status !== 'cancelled' && i.status !== 'failed'),
    [purchasedItems]
  );

  const isLoading = isOrdersLoading || isRefundsLoading;
  const error = ordersError || refundsError;

  return (
    <div className="w-full space-y-6">
      {/* Header & Tabs */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Purchase history
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              View receipts and tax invoices for all courses you have purchased.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchOrders('student');
              fetchMyRefunds();
            }}
            disabled={isLoading}
            className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab Navigation (Courses vs Refunds) */}
        <div className="flex items-center gap-6 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'courses'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Courses</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                activeTab === 'courses'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activePurchases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refunds')}
            className={`relative pb-3 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === 'refunds'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Refunds</span>
            {myRefunds.length > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  activeTab === 'refunds'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {myRefunds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400 space-y-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Loading your purchase history...</p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-bold">Unable to load purchase history</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : activeTab === 'courses' ? (
        /* COURSES TAB */
        activePurchases.length === 0 ? (
          <div className="py-20 text-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <ShoppingBag size={26} />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-bold text-slate-900 text-base">No purchases yet</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                When you enroll in a course, it will appear here alongside your official tax receipts and printable invoices.
              </p>
            </div>
            <div>
              <Link
                href="/#courses"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 transition shadow-xs"
              >
                <BookOpen size={14} />
                <span>Explore Courses</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5">Date</th>
                    <th className="py-3.5 px-5">Course Title</th>
                    <th className="py-3.5 px-5">Amount Paid</th>
                    <th className="py-3.5 px-5">Payment Type</th>
                    <th className="py-3.5 px-5 text-right">Receipt & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activePurchases.map((entry, idx) => {
                    const {
                      rawOrder,
                      orderNumber,
                      date,
                      paymentMethod,
                      paymentId,
                      item,
                      couponCode,
                      isEligibleForRefund,
                    } = entry;
                    const price = item.finalPrice ?? 0;
                    const title = item.title || 'Course Access';
                    const courseId = item.courseId;

                    return (
                      <tr
                        key={`${orderNumber}-${item.orderItemId || idx}`}
                        className="hover:bg-slate-50/60 transition group"
                      >
                        {/* Date */}
                        <td className="py-4 px-5 text-slate-600 whitespace-nowrap font-medium text-xs">
                          {formatDate(date)}
                        </td>

                        {/* Course Title + Quick Link to Player */}
                        <td className="py-4 px-5 max-w-md">
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 font-bold">
                              <BookOpen size={16} />
                            </div>
                            <div className="min-w-0">
                              {courseId ? (
                                <Link
                                  href={`/my-learning/${courseId}`}
                                  className="font-bold text-slate-900 hover:text-teal-700 transition line-clamp-1 flex items-center gap-1.5 text-xs group-hover:underline"
                                  title={title}
                                >
                                  <span>{title}</span>
                                  <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-teal-600 shrink-0 transition" />
                                </Link>
                              ) : (
                                <span className="font-bold text-slate-900 line-clamp-1 text-xs">
                                  {title}
                                </span>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {courseId && (
                                  <Link
                                    href={`/my-learning/${courseId}`}
                                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-teal-50 hover:text-teal-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition"
                                  >
                                    <GraduationCap size={11} />
                                    <span>Start Course</span>
                                  </Link>
                                )}
                                {couponCode && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-200">
                                    <Sparkles size={10} />
                                    <span>{couponCode}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Amount Paid */}
                        <td className="py-4 px-5 font-bold text-slate-900 whitespace-nowrap text-xs">
                          {formatPrice(price, item.currency)}
                        </td>

                        {/* Payment Type */}
                        <td className="py-4 px-5 text-slate-600 whitespace-nowrap text-xs">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              <CreditCard size={12} className="text-slate-500" />
                              <span>{paymentMethod}</span>
                            </span>
                            {paymentId && (
                              <span
                                className="text-[10px] font-mono text-slate-400 hidden lg:inline"
                                title={`Transaction: ${paymentId}`}
                              >
                                {paymentId.slice(0, 10)}...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions (Receipt & Refund) */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {entry.hasSubmittedRefund ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-2 py-1 text-[10px] font-bold">
                                <RotateCcw size={10} />
                                <span>Refund in review</span>
                              </span>
                            ) : entry.nonRefundable ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 text-[10px] font-semibold"
                                title="This course is marked as non-refundable by the instructor"
                              >
                                Non-refundable
                              </span>
                            ) : isEligibleForRefund ? (
                              <button
                                type="button"
                                onClick={() => handleOpenRefundModal(rawOrder)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition shadow-xs"
                                title={`Request refund within ${entry.refundPeriodDays}-day money-back guarantee`}
                              >
                                <RotateCcw size={12} />
                                <span>Refund</span>
                              </button>
                            ) : entry.windowExpired && Number(rawOrder.total_amount ?? rawOrder.totalAmount) > 0 ? (
                              <span
                                className="text-[11px] text-slate-400 font-medium"
                                title="The refund guarantee window has ended"
                              >
                                Guarantee expired
                              </span>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleOpenInvoice(orderNumber)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 transition shadow-xs"
                              title={`Download tax receipt for ${orderNumber}`}
                            >
                              <FileText size={13} className="text-teal-600" />
                              <span>Invoice</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Notice */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-slate-500 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-teal-600" />
                <span>Showing official invoice records for your account</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <HelpCircle size={13} />
                <span>Need billing assistance? support@elevatelms.com</span>
              </div>
            </div>
          </div>
        )
      ) : (
        /* REFUNDS TAB (Live Phase 5 Data) */
        <div className="space-y-4">
          {myRefunds.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">You haven't requested any refunds</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Every eligible paid course purchased on Elevate includes a 30-day money-back guarantee. If you are not satisfied, you can click "Refund" on any eligible order within 30 days.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-5">Refund #</th>
                      <th className="py-3.5 px-5">Order #</th>
                      <th className="py-3.5 px-5">Date Requested</th>
                      <th className="py-3.5 px-5">Reason</th>
                      <th className="py-3.5 px-5">Amount</th>
                      <th className="py-3.5 px-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myRefunds.map((ref) => {
                      const status = ref.status || 'pending';
                      const st = REFUND_STATUS_STYLES[status] || REFUND_STATUS_STYLES.failed;
                      const refundNum = ref.refundNumber || ref.refund_number;
                      const orderNum = ref.orderNumber || ref.order_number || '—';
                      const amt = ref.amount;
                      const date = ref.createdAt || ref.created_at;
                      const reason = ref.reason || '—';
                      const adminNotes = ref.adminNotes || ref.admin_notes;

                      return (
                        <tr key={ref.refundId || ref.refund_id || refundNum} className="hover:bg-slate-50/60 transition">
                          <td className="py-4 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {refundNum}
                          </td>
                          <td className="py-4 px-5 font-mono text-slate-600 whitespace-nowrap">
                            {orderNum}
                          </td>
                          <td className="py-4 px-5 text-slate-600 whitespace-nowrap">
                            {formatDate(date)}
                          </td>
                          <td className="py-4 px-5 max-w-xs text-slate-700 truncate" title={reason}>
                            "{reason}"
                            {adminNotes && (
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                Note: {adminNotes}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 font-bold text-slate-900 whitespace-nowrap">
                            {formatPrice(amt, ref.currency)}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.bg}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
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
      )}

      {/* Invoice Modal for downloading / printing receipts */}
      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => {
          setInvoiceModalOpen(false);
          clearSelectedInvoice();
        }}
        invoice={selectedInvoice}
        isLoading={isInvoiceLoading}
      />

      {/* Request Refund Modal */}
      <RequestRefundModal
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setOrderToRefund(null);
        }}
        order={orderToRefund}
        onSuccess={() => {
          fetchOrders('student');
          fetchMyRefunds();
        }}
      />
    </div>
  );
}

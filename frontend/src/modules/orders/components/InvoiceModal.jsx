'use client';

import React from 'react';
import {
  X,
  Printer,
  Download,
  CheckCircle2,
  Receipt,
  Building2,
  User,
  Calendar,
  CreditCard,
  Layers3,
} from 'lucide-react';

export default function InvoiceModal({ isOpen, onClose, invoice, isLoading }) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currency = invoice?.pricing?.currency || 'INR';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Modal Controls (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2 text-slate-700">
            <Receipt size={18} className="text-teal-600" />
            <span className="font-heading font-bold text-sm">Tax & Order Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !invoice}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 transition"
              aria-label="Close invoice"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <p className="text-sm">Generating invoice details...</p>
          </div>
        ) : !invoice ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">Invoice could not be loaded.</p>
            <p className="text-xs">Please try again later or contact support.</p>
          </div>
        ) : (
          <div className="p-8 sm:p-10 space-y-8 bg-white text-slate-800 text-sm print:p-6" id="printable-invoice">
            {/* Header: Brand & Invoice Meta */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-8">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white font-bold">
                    <Layers3 size={18} />
                  </span>
                  <span className="font-heading text-xl font-extrabold tracking-tight">
                    elevate<span className="text-teal-600">.</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {invoice.seller?.name || 'Elevate Learning Platform'}
                </p>
                <p className="text-xs text-slate-500">
                  {invoice.seller?.address || 'Bangalore, India'}
                </p>
                {invoice.seller?.gstin && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    GSTIN: <span className="font-mono">{invoice.seller.gstin}</span>
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Support: {invoice.seller?.supportEmail || 'support@elevate.local'}
                </p>
              </div>

              <div className="sm:text-right space-y-1">
                <span className="inline-block rounded-md bg-teal-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-teal-800 border border-teal-200">
                  Tax Invoice / Receipt
                </span>
                <h2 className="text-xl font-mono font-bold text-slate-900 pt-1">
                  {invoice.invoiceNumber || 'INV-PENDING'}
                </h2>
                <p className="text-xs text-slate-500">
                  Order Ref: <span className="font-mono font-semibold text-slate-700">{invoice.orderNumber}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Date: {formatDate(invoice.invoiceDate)}
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 size={12} /> Payment Completed
                  </span>
                </div>
              </div>
            </div>

            {/* Billed To / Student Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/70 rounded-xl p-5 border border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Billed To (Student)
                </span>
                <p className="font-bold text-slate-900 text-sm">{invoice.student?.name || 'Student'}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">{invoice.student?.email}</p>
                {invoice.student?.billingDetails?.city && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[
                      invoice.student.billingDetails.address,
                      invoice.student.billingDetails.city,
                      invoice.student.billingDetails.state,
                      invoice.student.billingDetails.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment Method & Transaction
                </span>
                <p className="text-xs text-slate-700">
                  <b>Method:</b> {invoice.payment?.paymentMethod?.toUpperCase() || 'ONLINE (RAZORPAY)'}
                </p>
                {invoice.payment?.paymentId && (
                  <p className="text-xs text-slate-700 font-mono mt-0.5">
                    <b>Payment ID:</b> {invoice.payment.paymentId}
                  </p>
                )}
                {invoice.payment?.paidAt && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paid On: {formatDate(invoice.payment.paidAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Course Item Description</th>
                    <th className="py-3 px-4 text-right">Regular Price</th>
                    <th className="py-3 px-4 text-right">Discount</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items?.map((item, idx) => {
                    const reg = Number(item.regularPrice || 0);
                    const finalP = Number(item.finalPrice || 0);
                    const diff = reg > finalP ? reg - finalP : 0;
                    return (
                      <tr key={item.courseId || idx} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <span className="text-[10px] text-teal-700 font-mono">Course ID: {item.courseId?.slice(0, 8)}...</span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500">
                          {formatPrice(reg)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                          {diff > 0 ? `-${formatPrice(diff)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {finalP === 0 ? 'FREE' : formatPrice(finalP)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-full max-w-xs space-y-2 border-t border-slate-200 pt-4 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatPrice(invoice.pricing?.subtotal)}</span>
                </div>
                {Number(invoice.pricing?.couponDiscount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>
                      Coupon Discount {invoice.pricing?.couponCode ? `(${invoice.pricing.couponCode})` : ''}:
                    </span>
                    <span>-{formatPrice(invoice.pricing.couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Tax (Educational / Exempt):</span>
                  <span>{formatPrice(invoice.pricing?.taxAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2.5">
                  <span>Total Amount Paid:</span>
                  <span className="text-teal-700 text-base">{formatPrice(invoice.pricing?.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Legal Footer Note */}
            <div className="border-t border-slate-200 pt-6 text-center text-[11px] text-slate-400">
              <p>This is a computer-generated tax invoice and requires no physical signature.</p>
              <p className="mt-1">
                Thank you for learning with Elevate! For questions or refund requests, write to{' '}
                <span className="text-slate-600">{invoice.seller?.supportEmail || 'support@elevate.local'}</span>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


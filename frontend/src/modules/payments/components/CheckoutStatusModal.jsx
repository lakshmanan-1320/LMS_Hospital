'use client';

import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle, X, FlaskConical, GraduationCap, Receipt } from 'lucide-react';
import { usePaymentStore } from '../stores/usePaymentStore';

const BUSY_LABELS = {
  creating: 'Preparing secure checkout...',
  verifying: 'Verifying your payment...',
  completing: 'Enrolling you in your courses...',
};

const formatAmount = (paise, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    (Number(paise) || 0) / 100,
  );

/**
 * Shows checkout progress, the dev-only payment simulator, and the final result.
 * Razorpay's own window is shown on top of the page while step === 'awaiting_payment' (live mode).
 *
 * @param {{ myLearningHref: string, browseHref: string, onRetry: () => void }} props
 */
export default function CheckoutStatusModal({ myLearningHref, browseHref, onRetry }) {
  const {
    step,
    error,
    isMockMode,
    checkoutConfig,
    pendingPayment,
    completedOrder,
    simulatePayment,
    retryCompleteOrder,
    resetCheckout,
  } = usePaymentStore();

  const isBusy = step in BUSY_LABELS;
  const showSimulator = step === 'awaiting_payment' && isMockMode;
  const visible = isBusy || showSimulator || step === 'success' || step === 'failed';
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        {(step === 'success' || step === 'failed' || showSimulator) && (
          <button
            type="button"
            onClick={resetCheckout}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}

        {isBusy && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 size={32} className="animate-spin text-teal-600" />
            <p className="text-sm font-semibold text-slate-800">{BUSY_LABELS[step]}</p>
            <p className="text-xs text-slate-500">Please don&apos;t close or refresh this page.</p>
          </div>
        )}

        {showSimulator && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <FlaskConical size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Test payment</h3>
                <p className="text-xs text-slate-500">Simulator mode (RAZORPAY_MOCK_MODE) · no real money</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <p>
                <b>Amount:</b> {formatAmount(checkoutConfig?.amount, checkoutConfig?.currency)}
              </p>
              <p className="truncate">
                <b>Order:</b> {checkoutConfig?.orderId}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => simulatePayment('SUCCESS')}
                className="rounded-xl bg-teal-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                Pay (success)
              </button>
              <button
                type="button"
                onClick={() => simulatePayment('FAILURE')}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Fail
              </button>
              <button
                type="button"
                onClick={() => simulatePayment('CANCELLED')}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">You&apos;re enrolled!</h3>
              <p className="mt-1 text-sm text-slate-600">
                {completedOrder?.totalAmount > 0 ? 'Payment received. ' : ''}
                {completedOrder?.items?.length || 0} course(s) added to your learning.
              </p>
            </div>
            {completedOrder?.orderNumber && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                <p>
                  <b>Order:</b> {completedOrder.orderNumber}
                </p>
                {completedOrder.invoiceNumber && (
                  <p>
                    <b>Invoice:</b> {completedOrder.invoiceNumber}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Link
                href={myLearningHref}
                onClick={resetCheckout}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white hover:bg-teal-700"
              >
                <GraduationCap size={16} /> Start learning
              </Link>
              <Link
                href="/dashboard/student/orders"
                onClick={resetCheckout}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-100 transition"
              >
                <Receipt size={16} /> View Order & Invoice
              </Link>
              <Link
                href={browseHref}
                onClick={resetCheckout}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 text-center"
              >
                Continue browsing
              </Link>
            </div>
          </div>
        )}

        {step === 'failed' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="mt-0.5 shrink-0 text-rose-600" />
              <div>
                <h3 className="font-bold text-slate-900">
                  {pendingPayment ? 'Enrollment not completed yet' : 'Payment not completed'}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{error}</p>
                {pendingPayment && (
                  <p className="mt-2 text-xs text-slate-500">
                    If money was deducted, it is safe to retry: the same payment can only be used once.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetCheckout}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={pendingPayment ? retryCompleteOrder : onRetry}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {pendingPayment ? 'Retry enrollment' : 'Try again'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

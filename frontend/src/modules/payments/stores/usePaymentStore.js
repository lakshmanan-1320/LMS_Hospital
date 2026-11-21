import { create } from 'zustand';
import { paymentService } from '../services/payment.service';
import { orderService } from '@/modules/orders/services/order.service';
import { loadRazorpay } from '../utils/loadRazorpay';

/**
 * Checkout steps:
 *   idle -> creating -> awaiting_payment -> verifying -> completing -> success
 *                                  \-> failed (payment failed / cancelled / error)
 *
 * Paid access is granted only by the backend, after POST /payments/verify succeeds and
 * POST /orders/checkout confirms the verified payment matches the cart.
 */
const INITIAL_STATE = {
  step: 'idle',
  error: null,
  notice: null, // non-error info, e.g. "Payment cancelled"
  checkoutConfig: null, // response of POST /payments/orders
  isMockMode: false, // backend simulator (dev only): show simulator buttons instead of Razorpay
  pendingPayment: null, // verified-or-not Razorpay response, kept so "Complete enrollment" can be retried
  completedOrder: null,
};

const toBilling = (user) => ({
  studentName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || '',
  studentEmail: user?.email || '',
});

export const usePaymentStore = create((set, get) => ({
  ...INITIAL_STATE,
  billingDetails: null,

  /**
   * Start checkout for the current cart.
   * @param {{ total: number, user: Object }} params
   */
  startCheckout: async ({ total, user }) => {
    if (['creating', 'verifying', 'completing'].includes(get().step)) return;
    const billingDetails = toBilling(user);
    set({ ...INITIAL_STATE, step: 'creating', billingDetails });

    // Fully discounted cart (e.g. 100% coupon): nothing to pay, complete directly.
    if (Number(total) === 0) {
      return get().completeOrder({});
    }

    try {
      const config = await paymentService.createOrder();
      set({ checkoutConfig: config, isMockMode: Boolean(config?.isMockMode) });

      if (config?.isMockMode) {
        // The UI shows the simulator (Success / Failure / Cancel) for this order.
        set({ step: 'awaiting_payment' });
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) {
        throw new Error('Could not load the Razorpay payment window. Check your connection and try again.');
      }

      set({ step: 'awaiting_payment' });

      const razorpay = new window.Razorpay({
        key: config.keyId,
        amount: config.amount,
        currency: config.currency,
        name: config.name,
        description: config.description,
        order_id: config.orderId,
        prefill: {
          name: billingDetails.studentName,
          email: config.prefill?.email || billingDetails.studentEmail,
        },
        notes: config.notes,
        // Razorpay asks for payer contact details (receipt + risk checks). The email is pre-filled from
        // the account but stays editable; the course always goes to the signed-in account regardless.
        theme: { color: '#0d9488' },
        handler: (response) => {
          get().finalizePayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            if (get().step === 'awaiting_payment') {
              set({ step: 'idle', notice: 'Payment cancelled. Your cart is unchanged.' });
            }
          },
        },
      });

      razorpay.on('payment.failed', (resp) => {
        set({
          step: 'failed',
          error: resp?.error?.description || 'Payment failed. No money was taken for this attempt; please try again.',
        });
      });

      razorpay.open();
    } catch (err) {
      set({ step: 'failed', error: err.message || 'Could not start checkout.' });
    }
  },

  /**
   * Development only (backend RAZORPAY_MOCK_MODE=true): simulate the gateway result.
   * @param {'SUCCESS'|'FAILURE'|'CANCELLED'} scenario
   */
  simulatePayment: async (scenario) => {
    const { checkoutConfig } = get();
    if (!checkoutConfig?.orderId) return;
    try {
      set({ step: 'verifying', error: null });
      const result = await paymentService.simulatePayment({
        orderId: checkoutConfig.orderId,
        scenario,
        method: 'upi',
      });

      if (scenario === 'SUCCESS' && result?.success) {
        return get().finalizePayment({
          razorpay_order_id: result.orderId,
          razorpay_payment_id: result.paymentId,
          razorpay_signature: result.signature,
        });
      }
      if (scenario === 'CANCELLED') {
        set({ step: 'idle', notice: 'Payment cancelled. Your cart is unchanged.' });
        return;
      }
      set({ step: 'failed', error: result?.error?.description || 'Payment failed.' });
    } catch (err) {
      set({ step: 'failed', error: err.message || 'Payment simulation failed.' });
    }
  },

  /** Verify the gateway response, then complete the order. */
  finalizePayment: async (paymentResponse) => {
    set({ step: 'verifying', error: null, pendingPayment: paymentResponse });
    try {
      await paymentService.verifyPayment(paymentResponse);
    } catch (err) {
      set({ step: 'failed', error: err.message || 'Payment verification failed.' });
      return;
    }
    return get().completeOrder(paymentResponse);
  },

  /** Create the order + enrollments (backend re-checks the verified payment against the cart). */
  completeOrder: async (paymentResponse) => {
    set({ step: 'completing', error: null });
    try {
      const order = await orderService.checkout({
        ...paymentResponse,
        billing_details: get().billingDetails || undefined,
      });
      set({ step: 'success', completedOrder: order, pendingPayment: null });
      return order;
    } catch (err) {
      set({
        step: 'failed',
        error: err.message || 'Could not complete your enrollment.',
      });
    }
  },

  /**
   * Retry only the enrollment step after a successful payment (e.g. network drop).
   * Safe: verify is idempotent and one payment can create only one order.
   */
  retryCompleteOrder: async () => {
    const { pendingPayment } = get();
    if (!pendingPayment) return;
    return get().finalizePayment(pendingPayment);
  },

  resetCheckout: () => set({ ...INITIAL_STATE, billingDetails: null }),
}));

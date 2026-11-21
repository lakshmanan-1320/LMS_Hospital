import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Controllers return `{ success, message, data }` and the global TransformInterceptor wraps it again;
 * the axios client strips only the outer layer. Strip the inner one too (same as the cart store does).
 */
const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Payments API Service (Razorpay)
 * Uses the centralized Axios instance (HttpOnly cookie auth, `{ success, data }` unwrapping).
 */
export const paymentService = {
  /**
   * Create a Razorpay order for the signed-in user's current cart.
   * @returns {Promise<{ keyId: string, orderId: string, amount: number, currency: string, name: string,
   *   description: string, receipt: string, prefill: { email: string }, notes: Object, isMockMode: boolean }>}
   */
  async createOrder(notes) {
    return unwrap(await apiClient.post(API_ENDPOINTS.PAYMENTS.CREATE_ORDER, notes ? { notes } : {}));
  },

  /**
   * Verify the payment returned by Razorpay Checkout (signature + live Razorpay check on the server).
   * @param {{ razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string }} payload
   * @returns {Promise<{ success: boolean, message: string, transaction: Object }>}
   */
  async verifyPayment(payload) {
    return apiClient.post(API_ENDPOINTS.PAYMENTS.VERIFY, payload);
  },

  /**
   * Development only: simulate a payment outcome when the backend runs with RAZORPAY_MOCK_MODE=true.
   * @param {{ orderId: string, scenario: 'SUCCESS'|'FAILURE'|'CANCELLED', method?: string }} payload
   * @returns {Promise<{ success: boolean, status: string, orderId: string, paymentId?: string, signature?: string,
   *   error?: { code: string, description: string } }>}
   */
  async simulatePayment(payload) {
    return apiClient.post(API_ENDPOINTS.PAYMENTS.MOCK_SIMULATE, payload);
  },

  /** List the signed-in user's payment transactions. */
  async listTransactions({ limit = 20, offset = 0 } = {}) {
    return apiClient.get(API_ENDPOINTS.PAYMENTS.TRANSACTIONS, { params: { limit, offset } });
  },

  /** Get one transaction by Razorpay order id or transaction UUID. */
  async getTransaction(identifier) {
    return unwrap(await apiClient.get(API_ENDPOINTS.PAYMENTS.TRANSACTION_BY_ID(identifier)));
  },
};

import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Controllers return `{ success, message, data }` and the global TransformInterceptor wraps it again;
 * the axios client strips only the outer layer. Strip the inner one too (same as the cart store does).
 */
const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Orders API Service
 * Checkout turns the current cart into an order and enrollments. Paid carts need a verified payment.
 */
export const orderService = {
  /**
   * Complete checkout.
   * Paid cart: pass the verified Razorpay ids. Fully-discounted (₹0) cart: pass only billing details.
   * @param {{ razorpay_order_id?: string, razorpay_payment_id?: string, razorpay_signature?: string,
   *   billing_details?: Object }} payload
   * @returns {Promise<Object>} order detail (orderNumber, invoiceNumber, items, totalAmount, ...)
   */
  async checkout(payload = {}) {
    return unwrap(await apiClient.post(API_ENDPOINTS.ORDERS.CHECKOUT, payload));
  },

  /** List the signed-in user's orders. */
  async listMyOrders(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.ORDERS.MY_ORDERS, { params });
    // In case of double wrap:
    const data = unwrap(res);
    return {
      items: Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(res?.items) ? res.items : [],
      total: typeof res?.total === 'number' ? res.total : (Array.isArray(data) ? data.length : 0),
    };
  },

  /** List all platform orders across students (Admin & Super Admin only). */
  async listAllOrders(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.ORDERS.ADMIN_ALL, { params });
    const data = unwrap(res);
    return {
      items: Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(res?.items) ? res.items : [],
      total: typeof res?.total === 'number' ? res.total : (Array.isArray(data) ? data.length : 0),
    };
  },

  /** Get one order by order id or order number. */
  async getOrder(identifier) {
    return unwrap(await apiClient.get(API_ENDPOINTS.ORDERS.BY_ID(identifier)));
  },

  /** Get the invoice for an order. */
  async getInvoice(identifier) {
    return unwrap(await apiClient.get(API_ENDPOINTS.ORDERS.INVOICE(identifier)));
  },
};

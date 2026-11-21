import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Refunds API Service (Phase 5)
 * Handles student refund requests, admin reviews (approve/reject), and financial audit ledger.
 */
export const refundService = {
  /**
   * Student submits a refund request for an eligible completed order.
   * @param {{ order_id: string, reason: string }} payload
   * @returns {Promise<Object>} Created refund detail
   */
  async requestRefund(payload) {
    const res = await apiClient.post(API_ENDPOINTS.REFUNDS.REQUEST, payload);
    return unwrap(res);
  },

  /**
   * List the signed-in student's refund requests.
   * @param {{ status?: string, page?: number, limit?: number }} params
   */
  async listMyRefunds(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REFUNDS.MY_REFUNDS, { params });
    const data = unwrap(res);
    return {
      items: Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(res?.items)
        ? res.items
        : [],
      total: typeof res?.total === 'number' ? res.total : Array.isArray(data) ? data.length : 0,
    };
  },

  /**
   * Get refund details by refund ID or refund number.
   * @param {string} identifier
   */
  async getRefund(identifier) {
    const res = await apiClient.get(API_ENDPOINTS.REFUNDS.BY_ID(identifier));
    return unwrap(res);
  },

  /**
   * Check dynamic refund eligibility & Udemy anti-abuse status for an order.
   * @param {string} orderId
   */
  async checkEligibility(orderId) {
    const res = await apiClient.get(API_ENDPOINTS.REFUNDS.ELIGIBILITY(orderId));
    return unwrap(res);
  },

  /**
   * List all platform refund requests (Admin & Super Admin only).
   * @param {{ status?: string, page?: number, limit?: number }} params
   */
  async listAllRefunds(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REFUNDS.ADMIN_ALL, { params });
    const data = unwrap(res);
    return {
      items: Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(res?.items)
        ? res.items
        : [],
      total: typeof res?.total === 'number' ? res.total : Array.isArray(data) ? data.length : 0,
    };
  },

  /**
   * Review a refund request (Admin & Super Admin only).
   * Decision 'approve' triggers Razorpay reversal and course access revocation.
   * Decision 'reject' records admin rejection note.
   * @param {string} refundId
   * @param {{ decision: 'approve' | 'reject', admin_notes?: string }} payload
   */
  async reviewRefund(refundId, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.REFUNDS.ADMIN_REVIEW(refundId), payload);
    return unwrap(res);
  },

  /**
   * Query financial audit ledger (Admin & Super Admin only).
   * @param {{ orderId?: string, studentId?: string, eventType?: string, limit?: number, offset?: number }} params
   */
  async listAuditLedger(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REFUNDS.ADMIN_AUDIT_LEDGER, { params });
    const data = unwrap(res);
    return {
      items: Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(res?.items)
        ? res.items
        : [],
      total: typeof res?.total === 'number' ? res.total : Array.isArray(data) ? data.length : 0,
    };
  },
};


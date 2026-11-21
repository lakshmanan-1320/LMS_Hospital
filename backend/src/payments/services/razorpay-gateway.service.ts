import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  RazorpayOrderResult,
  RazorpayPaymentResult,
  PaymentMethod,
} from '../interfaces/payment.interface';

@Injectable()
export class RazorpayGatewayService {
  private readonly logger = new Logger(RazorpayGatewayService.name);

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly isMockMode: boolean;
  private readonly defaultCurrency: string;

  constructor(private readonly config: ConfigService) {
    // Production must never fall back to the development secrets committed in source, and must
    // never run the simulator (it mints valid signatures). Fail fast at startup instead.
    if (process.env.NODE_ENV === 'production') {
      const missing = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'].filter(
        (name) => !process.env[name],
      );
      if (missing.length > 0) {
        throw new Error(`Razorpay is not configured for production. Missing: ${missing.join(', ')}`);
      }
      if (process.env.RAZORPAY_MOCK_MODE === 'true') {
        throw new Error('RAZORPAY_MOCK_MODE=true is not allowed when NODE_ENV=production.');
      }
    }

    this.keyId = this.config.get<string>('razorpay.keyId') || '';
    this.keySecret = this.config.get<string>('razorpay.keySecret') || '';
    this.webhookSecret = this.config.get<string>('razorpay.webhookSecret') || 'lms_wh_secret_test_32chars_key!';
    this.isMockMode = this.config.get<boolean>('razorpay.mockMode') === true;
    this.defaultCurrency = this.config.get<string>('razorpay.currency') || 'INR';

    this.logger.log(
      `RazorpayGatewayService initialized in ${this.isMockMode ? 'MOCK / SIMULATOR' : 'LIVE REAL-TIME TEST'} mode with Key ID: ${this.keyId.substring(0, 12)}...`,
    );
  }

  public getMockMode(): boolean {
    return this.isMockMode;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  private getBasicAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /**
   * Create a Razorpay Order.
   * In Real-Time Mode: calls Razorpay Orders REST API (POST https://api.razorpay.com/v1/orders).
   * In Mock Mode: generates a simulated Razorpay Order.
   */
  async createOrder(params: {
    amountInPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, any>;
  }): Promise<RazorpayOrderResult> {
    const currency = params.currency || this.defaultCurrency;

    if (this.isMockMode) {
      const mockOrderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
      const nowEpoch = Math.floor(Date.now() / 1000);

      const mockOrder: RazorpayOrderResult = {
        id: mockOrderId,
        entity: 'order',
        amount: params.amountInPaise,
        amount_paid: 0,
        amount_due: params.amountInPaise,
        currency,
        receipt: params.receipt,
        status: 'created',
        attempts: 0,
        notes: params.notes || {},
        created_at: nowEpoch,
      };

      this.logger.log(`[MOCK GATEWAY] Created order: ${mockOrder.id} for ₹${(params.amountInPaise / 100).toFixed(2)}`);
      return mockOrder;
    }

    // Real-Time Razorpay API call
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getBasicAuthHeader(),
        },
        body: JSON.stringify({
          amount: params.amountInPaise,
          currency,
          receipt: params.receipt,
          notes: params.notes || {},
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay API Order Creation Failed (${response.status}): ${errorBody}`);
        let message = `Razorpay order creation failed: ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed?.error?.description) {
            message = parsed.error.description;
          }
        } catch (_) {}
        throw new Error(message);
      }

      const orderData = (await response.json()) as RazorpayOrderResult;
      this.logger.log(
        `[REALTIME RAZORPAY] Order successfully created on Razorpay: ${orderData.id} for ₹${(params.amountInPaise / 100).toFixed(2)} (Receipt: ${orderData.receipt})`,
      );
      return orderData;
    } catch (err: any) {
      this.logger.error(`Exception during Razorpay order creation: ${err.message}`);
      throw err;
    }
  }

  /**
   * Fetch an Order directly from Razorpay's live servers.
   * GET https://api.razorpay.com/v1/orders/:id
   */
  async fetchOrder(orderId: string): Promise<RazorpayOrderResult | null> {
    if (this.isMockMode || orderId.startsWith('order_mock_')) {
      return null;
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
        method: 'GET',
        headers: {
          Authorization: this.getBasicAuthHeader(),
        },
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as RazorpayOrderResult;
    } catch (err) {
      this.logger.warn(`Could not fetch order ${orderId} from Razorpay: ${err}`);
      return null;
    }
  }

  /**
   * Fetch Payment Details directly from Razorpay's live servers.
   * GET https://api.razorpay.com/v1/payments/:id
   */
  async fetchPaymentDetails(paymentId: string): Promise<any | null> {
    if (this.isMockMode || paymentId.startsWith('pay_mock_')) {
      return null;
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: this.getBasicAuthHeader(),
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (err) {
      this.logger.warn(`Could not fetch payment ${paymentId} from Razorpay: ${err}`);
      return null;
    }
  }

  /**
   * Issue a refund via Razorpay.
   * Real Mode: POST https://api.razorpay.com/v1/payments/:id/refund
   * Mock Mode: Returns simulated refund object.
   */
  async createRefund(params: {
    paymentId: string;
    amountInPaise: number;
    receipt: string;
    notes?: Record<string, any>;
  }): Promise<{ id: string; status: string; amount: number }> {
    if (this.isMockMode || params.paymentId.startsWith('pay_mock_') || params.paymentId === 'mock') {
      const mockRefundId = `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`;
      this.logger.log(`[MOCK GATEWAY] Refund processed: ${mockRefundId} for payment ${params.paymentId}`);
      return {
        id: mockRefundId,
        status: 'processed',
        amount: params.amountInPaise,
      };
    }

    try {
      const response = await fetch(`https://api.razorpay.com/v1/payments/${params.paymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getBasicAuthHeader(),
        },
        body: JSON.stringify({
          amount: params.amountInPaise,
          receipt: params.receipt,
          notes: params.notes || {},
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Razorpay Refund API Failed (${response.status}): ${errorBody}`);
        let message = `Razorpay refund failed: ${response.statusText}`;
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed?.error?.description) {
            message = parsed.error.description;
          }
        } catch (_) {}
        throw new Error(message);
      }

      const refundData = await response.json();
      this.logger.log(`[REALTIME RAZORPAY] Refund successfully created on Razorpay: ${refundData.id}`);
      return {
        id: refundData.id,
        status: refundData.status || 'processed',
        amount: refundData.amount,
      };
    } catch (err: any) {
      this.logger.error(`Exception during Razorpay refund: ${err.message}`);
      throw err;
    }
  }

  /**
   * Standard Razorpay Payment Signature Verification.
   * Cryptographic verification using HMAC-SHA256:
   * signature === HMAC_SHA256(orderId + "|" + paymentId, keySecret)
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    if (!orderId || !paymentId || !signature) {
      return false;
    }

    try {
      const data = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(data)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      this.logger.warn(`Signature verification failed with exception: ${err}`);
      return false;
    }
  }

  /**
   * Helper to generate a valid cryptographic signature for mock / test checkout.
   */
  generateMockSignature(orderId: string, paymentId: string): string {
    const data = `${orderId}|${paymentId}`;
    return crypto.createHmac('sha256', this.keySecret).update(data).digest('hex');
  }

  /**
   * Verify Razorpay Webhook Signature using HMAC-SHA256 with webhookSecret.
   */
  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    try {
      const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyStr)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      this.logger.warn(`Webhook signature verification exception: ${err}`);
      return false;
    }
  }

  /**
   * Helper to generate a valid cryptographic webhook signature for mock dispatch.
   */
  generateMockWebhookSignature(rawBody: string | Buffer): string {
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    return crypto.createHmac('sha256', this.webhookSecret).update(bodyStr).digest('hex');
  }

  /**
   * Simulate payment outcomes (SUCCESS, FAILURE, CANCELLED) for testing.
   */
  simulatePaymentOutcome(params: {
    orderId: string;
    scenario: 'SUCCESS' | 'FAILURE' | 'CANCELLED';
    amountInPaise: number;
    method?: string;
    studentEmail?: string;
  }): {
    success: boolean;
    payment?: RazorpayPaymentResult;
    signature?: string;
    error?: { code: string; description: string };
  } {
    const paymentMethod = (params.method || 'upi') as PaymentMethod;
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (params.scenario === 'SUCCESS') {
      const mockPaymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
      const signature = this.generateMockSignature(params.orderId, mockPaymentId);

      const payment: RazorpayPaymentResult = {
        id: mockPaymentId,
        entity: 'payment',
        amount: params.amountInPaise,
        currency: this.defaultCurrency,
        status: 'captured',
        order_id: params.orderId,
        method: paymentMethod,
        email: params.studentEmail,
        created_at: nowEpoch,
      };

      return { success: true, payment, signature };
    }

    if (params.scenario === 'FAILURE') {
      const mockPaymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
      const payment: RazorpayPaymentResult = {
        id: mockPaymentId,
        entity: 'payment',
        amount: params.amountInPaise,
        currency: this.defaultCurrency,
        status: 'failed',
        order_id: params.orderId,
        method: paymentMethod,
        email: params.studentEmail,
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment was declined by issuing bank or payment provider.',
        created_at: nowEpoch,
      };

      return {
        success: false,
        payment,
        error: {
          code: payment.error_code || 'BAD_REQUEST_ERROR',
          description: payment.error_description || 'Payment failed',
        },
      };
    }

    // CANCELLED
    return {
      success: false,
      error: {
        code: 'PAYMENT_CANCELLED',
        description: 'Payment flow was cancelled by the user.',
      },
    };
  }
}

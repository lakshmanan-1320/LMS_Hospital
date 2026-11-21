import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { RazorpayGatewayService } from './services/razorpay-gateway.service';
import { CartService } from '../cart/cart.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  PaymentTransactionRecord,
  ClientCheckoutConfig,
} from './interfaces/payment.interface';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';
import { assertCanPurchase } from '../common/policies/purchase.policy';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly razorpayGateway: RazorpayGatewayService,
    private readonly cartService: CartService,
  ) {}


  /**
   * Create a Razorpay Order for the student's active cart.
   * Pulls dynamic live pricing, applied coupons, and validates cart eligibility.
   */
  async createPaymentOrder(
    user: AuthenticatedUser,
    notes?: Record<string, any>,
  ): Promise<ClientCheckoutConfig> {
    assertCanPurchase(user);

    // 1. Fetch live student cart
    const cart = await this.cartService.getCart(user);

    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty. Add courses to initiate checkout.');
    }

    // 2. Reject pure free carts (must use 1-click free enrollment)
    if (cart.summary.isPureFreeCart || cart.summary.total === 0) {
      throw new BadRequestException(
        'Your cart contains only free courses. Please use the 1-click free enrollment option without initiating payment.',
      );
    }

    // 3. Check course availability
    const unavailable = cart.items.filter((item) => !item.isAvailable);
    if (unavailable.length > 0) {
      const titles = unavailable.map((u) => `"${u.title}"`).join(', ');
      throw new BadRequestException(
        `The following courses are no longer available for purchase: ${titles}. Please remove them from your cart to proceed.`,
      );
    }

    // 4. Currency check
    if (cart.summary.currencyMismatch) {
      throw new BadRequestException(
        'Your cart contains courses with differing currencies. Please checkout items with matching currencies.',
      );
    }

    // 5. Calculate amount in paise
    const amountInPaise = Math.round(cart.summary.total * 100);
    const receipt = `lms_rcpt_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const orderNotes = {
      platform: 'Elevate Learning LMS',
      cartId: cart.cartId,
      studentId: user.userId,
      studentEmail: user.email,
      couponCode: cart.summary.appliedCoupon?.code || null,
      couponDiscount: cart.summary.couponDiscount,
      itemCount: cart.items.length,
      ...notes,
    };

    // 6. Invoke Razorpay Gateway (Mock or Real)
    const razorpayOrder = await this.razorpayGateway.createOrder({
      amountInPaise,
      currency: cart.summary.currency,
      receipt,
      notes: orderNotes,
    });

    // 7. Store transaction in database with status 'created'
    await this.paymentsRepo.createTransaction({
      order_id: razorpayOrder.id,
      student_id: user.userId,
      amount: cart.summary.total,
      amount_in_paise: amountInPaise,
      currency: cart.summary.currency,
      receipt,
      metadata: orderNotes,
    });

    return {
      keyId: this.razorpayGateway.getKeyId(),
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: cart.summary.currency,
      name: 'Elevate Learning LMS',
      description: `Course Purchase (${cart.items.length} item${cart.items.length === 1 ? '' : 's'})`,
      receipt,
      prefill: {
        email: user.email,
      },
      notes: orderNotes,
      isMockMode: this.razorpayGateway.getMockMode(),
    };
  }

  /**
   * Verify Razorpay Payment Signature cryptographically using HMAC-SHA256.
   * signature === HMAC_SHA256(order_id + "|" + payment_id, secret)
   */
  async verifyPayment(
    dto: VerifyPaymentDto,
    user: AuthenticatedUser,
  ): Promise<{
    success: boolean;
    message: string;
    transaction: PaymentTransactionRecord;
  }> {
    assertCanPurchase(user);

    const transaction = await this.paymentsRepo.findTransactionByOrderId(dto.razorpay_order_id);
    if (!transaction) {
      throw new NotFoundException(`Payment transaction for order "${dto.razorpay_order_id}" was not found.`);
    }

    // Ensure student ownership
    if (transaction.student_id !== user.userId) {
      throw new ForbiddenException('You are not authorized to verify this payment transaction.');
    }

    // Idempotent return if already captured
    if (transaction.status === 'captured') {
      return {
        success: true,
        message: 'Payment has already been verified and captured.',
        transaction,
      };
    }

    // Cryptographic signature verification
    const isValid = this.razorpayGateway.verifyPaymentSignature(
      dto.razorpay_order_id,
      dto.razorpay_payment_id,
      dto.razorpay_signature,
    );

    if (!isValid) {
      await this.paymentsRepo.updateTransactionStatus(dto.razorpay_order_id, {
        status: 'failed',
        payment_id: dto.razorpay_payment_id,
        signature: dto.razorpay_signature,
        error_code: 'INVALID_SIGNATURE',
        error_description: 'Cryptographic signature verification failed.',
      });

      throw new BadRequestException('Payment verification failed: Invalid cryptographic signature.');
    }

    // Live mode: a valid signature is not enough on its own. Confirm with Razorpay that this
    // payment belongs to this order, succeeded, and is for the exact amount we charged.
    // Fails closed: if Razorpay can't be reached, the payment stays unverified and can be retried.
    let paymentMethod = transaction.payment_method || 'mock';
    if (!this.razorpayGateway.getMockMode()) {
      const live = await this.razorpayGateway.fetchPaymentDetails(dto.razorpay_payment_id);
      if (!live) {
        throw new BadRequestException(
          'We could not confirm this payment with Razorpay yet. Please try again in a moment.',
        );
      }
      const liveOk =
        live.order_id === dto.razorpay_order_id &&
        ['captured', 'authorized'].includes(live.status) &&
        Number(live.amount) === Number(transaction.amount_in_paise) &&
        String(live.currency || '').toUpperCase() === String(transaction.currency || '').toUpperCase();
      if (!liveOk) {
        this.logger.warn(
          `[PAYMENT VERIFY REJECTED] order=${dto.razorpay_order_id} payment=${dto.razorpay_payment_id} ` +
            `liveStatus=${live.status} liveAmount=${live.amount} expected=${transaction.amount_in_paise}`,
        );
        throw new BadRequestException('Payment verification failed: payment status or amount does not match this order.');
      }
      paymentMethod = live.method || paymentMethod;
    }

    // Update transaction to captured
    const updated = await this.paymentsRepo.updateTransactionStatus(dto.razorpay_order_id, {
      status: 'captured',
      payment_id: dto.razorpay_payment_id,
      signature: dto.razorpay_signature,
      payment_method: paymentMethod,
    });

    return {
      success: true,
      message: 'Payment verified and captured successfully!',
      transaction: updated!,
    };
  }

  /**
   * Mock Payment Simulator for testing success, failure, and cancellation flows.
   */
  async simulatePayment(
    dto: SimulatePaymentDto,
    user: AuthenticatedUser,
  ): Promise<{
    success: boolean;
    status: string;
    orderId: string;
    paymentId?: string;
    signature?: string;
    error?: { code: string; description: string };
    transaction: PaymentTransactionRecord;
  }> {
    this.assertSimulatorEnabled();
    const transaction = await this.paymentsRepo.findTransactionByOrderId(dto.orderId);
    if (!transaction) {
      throw new NotFoundException(`Payment transaction for order "${dto.orderId}" was not found.`);
    }

    if (transaction.student_id !== user.userId && !isOperationsAdmin(user)) {
      throw new ForbiddenException('You are not authorized to simulate payment for this transaction.');
    }

    const simResult = this.razorpayGateway.simulatePaymentOutcome({
      orderId: dto.orderId,
      scenario: dto.scenario,
      amountInPaise: transaction.amount_in_paise,
      method: dto.method,
      studentEmail: user.email,
    });

    if (dto.scenario === 'SUCCESS' && simResult.payment) {
      const updated = await this.paymentsRepo.updateTransactionStatus(dto.orderId, {
        status: 'captured',
        payment_id: simResult.payment.id,
        signature: simResult.signature,
        payment_method: dto.method || 'upi',
      });

      return {
        success: true,
        status: 'captured',
        orderId: dto.orderId,
        paymentId: simResult.payment.id,
        signature: simResult.signature,
        transaction: updated!,
      };
    }

    if (dto.scenario === 'FAILURE') {
      const updated = await this.paymentsRepo.updateTransactionStatus(dto.orderId, {
        status: 'failed',
        payment_id: simResult.payment?.id,
        payment_method: dto.method || 'upi',
        error_code: simResult.error?.code || 'PAYMENT_FAILED',
        error_description: simResult.error?.description || 'Payment was declined by payment gateway.',
      });

      return {
        success: false,
        status: 'failed',
        orderId: dto.orderId,
        paymentId: simResult.payment?.id,
        error: simResult.error,
        transaction: updated!,
      };
    }

    // CANCELLED
    const updated = await this.paymentsRepo.updateTransactionStatus(dto.orderId, {
      status: 'cancelled',
      error_code: 'PAYMENT_CANCELLED',
      error_description: 'User dismissed or cancelled payment widget.',
    });

    return {
      success: false,
      status: 'cancelled',
      orderId: dto.orderId,
      error: simResult.error,
      transaction: updated!,
    };
  }

  /**
   * Handle incoming Razorpay webhook events.
   * Verifies x-razorpay-signature header against raw body.
   */
  async handleWebhook(
    rawBody: string | Buffer,
    signature: string,
    payload: any,
  ): Promise<{ status: string; event: string }> {
    const eventName = payload?.event || 'unknown';
    const eventId = payload?.id || null;

    // 1. Verify webhook signature
    const isVerified = this.razorpayGateway.verifyWebhookSignature(rawBody, signature);

    // 2. Log webhook to database
    const webhookLog = await this.paymentsRepo.logWebhook({
      event_id: eventId,
      event_name: eventName,
      payload,
      signature,
      is_verified: isVerified,
    });

    if (!isVerified) {
      this.logger.warn(`Rejected unauthorized Razorpay webhook: invalid signature for event ${eventName}`);
      throw new BadRequestException('Webhook signature verification failed.');
    }

    // 3. Process known events
    try {
      if (eventName === 'payment.captured') {
        const payment = payload?.payload?.payment?.entity;
        const tx = payment?.order_id
          ? await this.paymentsRepo.findTransactionByOrderId(payment.order_id)
          : null;
        if (tx && Number(payment.amount) !== Number(tx.amount_in_paise)) {
          this.logger.warn(
            `[WEBHOOK] Ignored payment.captured for ${payment.order_id}: amount ${payment.amount} != expected ${tx.amount_in_paise}`,
          );
        } else if (tx && tx.status !== 'refunded') {
          await this.paymentsRepo.updateTransactionStatus(payment.order_id, {
            status: 'captured',
            payment_id: payment.id,
            payment_method: payment.method,
          });
        }
      } else if (eventName === 'payment.failed') {
        const payment = payload?.payload?.payment?.entity;
        const tx = payment?.order_id
          ? await this.paymentsRepo.findTransactionByOrderId(payment.order_id)
          : null;
        // Razorpay doesn't guarantee event order: a failed attempt can arrive after the capture.
        if (tx && !['captured', 'refunded'].includes(tx.status)) {
          await this.paymentsRepo.updateTransactionStatus(payment.order_id, {
            status: 'failed',
            payment_id: payment.id,
            payment_method: payment.method,
            error_code: payment.error_code || 'PAYMENT_FAILED',
            error_description: payment.error_description || 'Payment failure received from webhook.',
          });
        }
      }

      await this.paymentsRepo.markWebhookProcessed(webhookLog.webhook_id);
    } catch (err) {
      this.logger.error(`Error processing webhook event ${eventName}:`, err);
    }

    return { status: 'ok', event: eventName };
  }

  /**
   * Helper to simulate a Razorpay webhook dispatch for test suites.
   */
  async simulateWebhookDispatch(
    event: 'payment.captured' | 'payment.failed',
    orderId: string,
    paymentId?: string,
  ): Promise<any> {
    this.assertSimulatorEnabled();
    const tx = await this.paymentsRepo.findTransactionByOrderId(orderId);
    if (!tx) {
      throw new NotFoundException(`Transaction with orderId "${orderId}" not found.`);
    }

    const payId = paymentId || `pay_mock_${Date.now()}`;
    const payload = {
      entity: 'event',
      account_id: 'acc_mock_lms',
      event,
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: payId,
            entity: 'payment',
            amount: tx.amount_in_paise,
            currency: tx.currency,
            status: event === 'payment.captured' ? 'captured' : 'failed',
            order_id: orderId,
            method: 'upi',
            error_code: event === 'payment.failed' ? 'BAD_REQUEST_ERROR' : null,
            error_description: event === 'payment.failed' ? 'Simulated failure webhook' : null,
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawBody = JSON.stringify(payload);
    const signature = this.razorpayGateway.generateMockWebhookSignature(rawBody);

    return this.handleWebhook(rawBody, signature, payload);
  }

  /**
   * List payment transactions for the active student.
   */
  async listTransactions(
    user: AuthenticatedUser,
    params: { limit?: number; offset?: number },
  ) {
    assertCanPurchase(user);
    return this.paymentsRepo.listStudentTransactions(user.userId, params);
  }

  /**
   * Get transaction details by order ID or transaction UUID.
   */
  async getTransaction(
    identifier: string,
    user: AuthenticatedUser,
  ): Promise<PaymentTransactionRecord> {
    let tx = await this.paymentsRepo.findTransactionByOrderId(identifier);
    if (!tx) {
      tx = await this.paymentsRepo.findTransactionById(identifier);
    }
    if (!tx) {
      throw new NotFoundException(`Payment transaction "${identifier}" not found.`);
    }

    const isAdmin = isOperationsAdmin(user);
    if (tx.student_id !== user.userId && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this payment transaction.');
    }

    return tx;
  }

  /**
   * The payment simulator mints valid signatures, so it must never be reachable with real money:
   * only when RAZORPAY_MOCK_MODE=true and never when NODE_ENV=production. 404 hides the route.
   */
  private assertSimulatorEnabled(): void {
    if (!this.razorpayGateway.getMockMode() || process.env.NODE_ENV === 'production') {
      throw new NotFoundException('Not found');
    }
  }
}


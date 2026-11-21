import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { OrdersRepository } from './orders.repository';
import { CartService } from '../cart/cart.service';
import { RazorpayGatewayService } from '../payments/services/razorpay-gateway.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  OrderRecord,
  OrderItemRecord,
  OrderDetailResponse,
  InvoiceData,
} from './interfaces/order.interface';
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { assertCanPurchase } from '../common/policies/purchase.policy';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly cartService: CartService,
    private readonly razorpayGateway: RazorpayGatewayService,
    private readonly paymentsRepo: PaymentsRepository,
  ) {}


  /**
   * Generate human-readable order number: ORD-YYYYMMDD-XXXXXX
   */
  private generateOrderNumber(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `ORD-${dateStr}-${rand}`;
  }

  /**
   * Generate human-readable invoice number: INV-YYYYMMDD-XXXXXX
   */
  private generateInvoiceNumber(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `INV-${dateStr}-${rand}`;
  }

  /**
   * Complete checkout flow:
   * Supports paid checkout (with verified Razorpay payment) and pure free checkout.
   * Transactionally enrolls courses, records coupon redemptions, clears cart, and generates invoice.
   */
  async checkout(
    dto: CheckoutOrderDto,
    user: AuthenticatedUser,
  ): Promise<OrderDetailResponse> {
    assertCanPurchase(user);

    // 1. Fetch active student cart
    const cart = await this.cartService.getCart(user);

    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty. Add courses before checking out.');
    }

    // 2. Availability check
    const unavailable = cart.items.filter((item) => !item.isAvailable);
    if (unavailable.length > 0) {
      const titles = unavailable.map((u) => `"${u.title}"`).join(', ');
      throw new BadRequestException(
        `The following courses are no longer available: ${titles}. Please remove them to proceed.`,
      );
    }

    // 3. Currency check
    if (cart.summary.currencyMismatch) {
      throw new BadRequestException('Your cart contains items with conflicting currencies.');
    }

    // 4. Duplicate enrollment check
    const courseIds = cart.items.map((i) => i.courseId);
    const existingEnrollments = await this.ordersRepo.findActiveEnrollments(user.userId, courseIds);
    if (existingEnrollments.length > 0) {
      throw new ConflictException(
        'You are already actively enrolled in one or more courses in your cart. Please remove them before checkout.',
      );
    }

    const isPaidOrder = cart.summary.total > 0;
    let paymentMethod = 'free';
    let paymentStatus: 'paid' = 'paid';
    let paymentOrderId: string | null = null;
    let paymentId: string | null = null;

    if (isPaidOrder) {
      // 5. Verify payment parameters for paid checkout
      if (!dto.razorpay_order_id || !dto.razorpay_payment_id || !dto.razorpay_signature) {
        throw new BadRequestException(
          'Payment verification details (razorpay_order_id, razorpay_payment_id, razorpay_signature) are required for paid checkout.',
        );
      }

      // 5a. Verify cryptographic signature
      const isSignatureValid = this.razorpayGateway.verifyPaymentSignature(
        dto.razorpay_order_id,
        dto.razorpay_payment_id,
        dto.razorpay_signature,
      );

      if (!isSignatureValid) {
        throw new BadRequestException('Payment verification failed: Invalid cryptographic signature.');
      }

      // 5b. Match payment transaction in database
      const tx = await this.paymentsRepo.findTransactionByOrderId(dto.razorpay_order_id);
      if (!tx) {
        throw new NotFoundException(`Payment transaction "${dto.razorpay_order_id}" not found.`);
      }

      if (tx.student_id !== user.userId) {
        throw new ForbiddenException('This payment transaction belongs to another user.');
      }

      // 5c. Only a VERIFIED, successful payment grants paid access. The transaction becomes
      // 'captured' only via POST /payments/verify (signature + live Razorpay check), the signed
      // Razorpay webhook, or the dev-only simulator. A signature alone is not enough.
      if (tx.status !== 'captured') {
        throw new BadRequestException(
          'Payment has not been verified as successful. Complete payment verification before checkout.',
        );
      }
      if (tx.payment_id && tx.payment_id !== dto.razorpay_payment_id) {
        throw new BadRequestException('Payment details do not match the verified payment for this order.');
      }

      // 5d. The verified payment must cover exactly this cart (stops paying for a cheap cart,
      // then adding more courses before checkout).
      const expectedPaise = Math.round(cart.summary.total * 100);
      if (
        Number(tx.amount_in_paise) !== expectedPaise ||
        String(tx.currency || '').toUpperCase() !== String(cart.summary.currency || '').toUpperCase()
      ) {
        throw new BadRequestException(
          'Your cart changed after payment was started. Please review your cart and pay again.',
        );
      }

      // 5e. One payment, one order.
      const alreadyUsed = await this.ordersRepo.findOrderByPaymentOrderId(dto.razorpay_order_id);
      if (alreadyUsed) {
        throw new ConflictException(
          `This payment has already been used for order ${alreadyUsed.order_number}.`,
        );
      }

      paymentOrderId = dto.razorpay_order_id;
      paymentId = dto.razorpay_payment_id;
      paymentMethod = tx.payment_method || 'upi';
    }

    // 6. Calculate item-level final prices (distributing coupon discount proportionally across paid courses)
    const totalCouponDiscount = cart.summary.couponDiscount || 0;
    const paidItemsSubtotal = cart.summary.paidSubtotal || 0;

    const orderItemsPayload = cart.items.map((item) => {
      let finalPrice = item.effectivePrice;
      if (!item.isFree && totalCouponDiscount > 0 && paidItemsSubtotal > 0) {
        // Proportion of coupon discount allocated to this item
        const proportion = item.effectivePrice / paidItemsSubtotal;
        const itemDiscount = Math.round(totalCouponDiscount * proportion * 100) / 100;
        finalPrice = Math.max(0, item.effectivePrice - itemDiscount);
      } else if (item.isFree) {
        finalPrice = 0;
      }

      return {
        courseId: item.courseId,
        instructorId: item.instructorId,
        title: item.title,
        slug: item.slug,
        regularPrice: item.regularPrice,
        salePrice: item.discountPrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        currency: item.currency,
        isFree: item.isFree,
      };
    });

    const orderNumber = this.generateOrderNumber();
    const invoiceNumber = this.generateInvoiceNumber();

    // 7. Execute Transactional Checkout in Database
    let checkoutResult: Awaited<ReturnType<OrdersRepository['executeCheckoutTransaction']>>;
    try {
      checkoutResult = await this.ordersRepo.executeCheckoutTransaction({
        orderNumber,
        invoiceNumber,
        studentId: user.userId,
        cartId: cart.cartId,
        subtotal: cart.summary.subtotal,
        courseDiscount: Math.max(0, cart.summary.subtotal - cart.summary.paidSubtotal),
        couponId: cart.summary.appliedCoupon?.couponId || null,
        couponCode: cart.summary.appliedCoupon?.code || null,
        couponDiscount: cart.summary.couponDiscount,
        totalDiscount: cart.summary.discountTotal,
        totalAmount: cart.summary.total,
        totalInPaise: Math.round(cart.summary.total * 100),
        currency: cart.summary.currency,
        paymentOrderId,
        paymentId,
        paymentStatus,
        paymentMethod,
        billingDetails: dto.billing_details || {
          studentName: user.email.split('@')[0],
          studentEmail: user.email,
        },
        metadata: {
          itemCount: orderItemsPayload.length,
          source: 'cart_checkout',
        },
        items: orderItemsPayload,
      });
    } catch (err: any) {
      // Concurrent checkout redeeming the same payment (uq_orders_payment_order_id)
      if (err?.code === '23505' && String(err?.constraint || '').includes('payment_order_id')) {
        throw new ConflictException('This payment has already been used for another order.');
      }
      throw err;
    }
    const { order, items } = checkoutResult;

    this.logger.log(
      `[CHECKOUT SUCCESS] Order ${order.order_number} created for student ${user.userId}. Total: ₹${order.total_amount}`,
    );

    return this.buildOrderDetailResponse(order, items);
  }

  /**
   * Helper to format Order and items into clean API response.
   */
  private buildOrderDetailResponse(
    order: OrderRecord,
    items: OrderItemRecord[],
  ): OrderDetailResponse {
    return {
      orderId: order.order_id,
      orderNumber: order.order_number,
      studentId: order.student_id,
      status: order.status,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      courseDiscount: Number(order.course_discount),
      couponCode: order.coupon_code,
      couponDiscount: Number(order.coupon_discount),
      totalDiscount: Number(order.total_discount),
      totalAmount: Number(order.total_amount),
      totalInPaise: order.total_in_paise,
      paymentOrderId: order.payment_order_id,
      paymentId: order.payment_id,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      invoiceNumber: order.invoice_number,
      billingDetails: order.billing_details || {},
      items: items.map((i) => ({
        orderItemId: i.order_item_id,
        courseId: i.course_id,
        instructorId: i.instructor_id,
        title: i.title,
        slug: i.slug,
        regularPrice: Number(i.regular_price),
        salePrice: i.sale_price !== null ? Number(i.sale_price) : null,
        finalPrice: Number(i.final_price),
        currency: i.currency,
        enrollmentId: i.enrollment_id,
        isRefundable: i.is_refundable ?? true,
        refundPeriodDays: i.refund_period_days !== undefined && i.refund_period_days !== null ? Number(i.refund_period_days) : 30,
      })),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }

  /**
   * Get single order details with itemized courses.
   */
  async getOrderDetails(
    orderIdentifier: string,
    user: AuthenticatedUser,
  ): Promise<OrderDetailResponse> {
    let order = await this.ordersRepo.findOrderByNumber(orderIdentifier);
    if (!order) {
      order = await this.ordersRepo.findOrderById(orderIdentifier);
    }
    if (!order) {
      throw new NotFoundException(`Order "${orderIdentifier}" not found.`);
    }

    const isAdmin = isOperationsAdmin(user);
    if (order.student_id !== user.userId && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this order.');
    }

    const items = await this.ordersRepo.findOrderItems(order.order_id);
    return this.buildOrderDetailResponse(order, items);
  }

  /**
   * Get structured Invoice & Receipt data for an order.
   */
  async getInvoice(
    orderIdentifier: string,
    user: AuthenticatedUser,
  ): Promise<InvoiceData> {
    const orderDetail = await this.getOrderDetails(orderIdentifier, user);

    return {
      invoiceNumber: orderDetail.invoiceNumber,
      orderNumber: orderDetail.orderNumber,
      invoiceDate: orderDetail.paidAt || orderDetail.createdAt,
      student: {
        userId: orderDetail.studentId,
        name: orderDetail.billingDetails?.studentName || user.email.split('@')[0],
        email: user.email,
        billingDetails: orderDetail.billingDetails,
      },
      seller: {
        name: 'Elevate Learning Platform Pvt. Ltd.',
        address: 'Bangalore, Karnataka, India - 560001',
        gstin: '29ABCDE1234F1Z5',
        supportEmail: 'support@elevatelms.com',
      },
      items: orderDetail.items.map((item, idx) => ({
        itemNumber: idx + 1,
        title: item.title,
        courseId: item.courseId,
        regularPrice: item.regularPrice,
        discountPrice: item.salePrice,
        finalPrice: item.finalPrice,
        currency: item.currency,
      })),
      pricing: {
        subtotal: orderDetail.subtotal,
        couponDiscount: orderDetail.couponDiscount,
        couponCode: orderDetail.couponCode,
        totalDiscount: orderDetail.totalDiscount,
        taxAmount: 0, // Educational exemption
        totalAmount: orderDetail.totalAmount,
        currency: orderDetail.currency,
      },
      payment: {
        paymentMethod: orderDetail.paymentMethod,
        paymentId: orderDetail.paymentId,
        paymentOrderId: orderDetail.paymentOrderId,
        paidAt: orderDetail.paidAt,
        status: orderDetail.paymentStatus,
      },
    };
  }

  /**
   * List orders for the active student.
   */
  async listStudentOrders(user: AuthenticatedUser, query: QueryOrdersDto) {
    assertCanPurchase(user);
    const res = await this.ordersRepo.listStudentOrders(user.userId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      search: query.search,
    });
    const orderIds = res.items.map((o) => o.order_id);
    const orderItems = await this.ordersRepo.findOrderItemsByOrderIds(orderIds);
    const itemsMap = new Map<string, OrderItemRecord[]>();
    for (const it of orderItems) {
      const arr = itemsMap.get(it.order_id) || [];
      arr.push(it);
      itemsMap.set(it.order_id, arr);
    }
    return {
      items: res.items.map((o) => this.buildOrderDetailResponse(o, itemsMap.get(o.order_id) || [])),
      total: res.total,
    };
  }

  /**
   * List all platform orders (Admin / Super Admin).
   */
  async listAllOrders(query: QueryOrdersDto) {
    const res = await this.ordersRepo.listAllOrders({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      search: query.search,
    });
    const orderIds = res.items.map((o) => o.order_id);
    const orderItems = await this.ordersRepo.findOrderItemsByOrderIds(orderIds);
    const itemsMap = new Map<string, OrderItemRecord[]>();
    for (const it of orderItems) {
      const arr = itemsMap.get(it.order_id) || [];
      arr.push(it);
      itemsMap.set(it.order_id, arr);
    }
    return {
      items: res.items.map((o) => this.buildOrderDetailResponse(o, itemsMap.get(o.order_id) || [])),
      total: res.total,
    };
  }
}

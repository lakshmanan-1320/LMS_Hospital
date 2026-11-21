import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { RefundsRepository } from './refunds.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { RazorpayGatewayService } from '../payments/services/razorpay-gateway.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  RefundRecord,
  RefundDetailResponse,
  FinancialAuditLogRecord,
} from './interfaces/refund.interface';
import { RequestRefundDto } from './dto/request-refund.dto';
import { ReviewRefundDto } from './dto/review-refund.dto';
import { QueryRefundsDto } from './dto/query-refunds.dto';
import { assertCanPurchase } from '../common/policies/purchase.policy';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly refundsRepo: RefundsRepository,
    private readonly ordersRepo: OrdersRepository,
    private readonly razorpayGateway: RazorpayGatewayService,
  ) {}


  /**
   * Validate admin role.
   */
  private validateAdmin(user: AuthenticatedUser): void {
    const isAdmin = isOperationsAdmin(user);
    if (!isAdmin) {
      throw new ForbiddenException('Only platform administrators can review refunds or inspect the audit ledger.');
    }
  }

  /**
   * Generate human-readable refund number: RFND-YYYYMMDD-XXXXXX
   */
  private generateRefundNumber(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `RFND-${dateStr}-${rand}`;
  }

  /**
   * Student submits a refund request for a completed order.
   */
  async requestRefund(
    dto: RequestRefundDto,
    user: AuthenticatedUser,
  ): Promise<RefundDetailResponse> {
    assertCanPurchase(user);

    // 1. Fetch order
    const order = await this.ordersRepo.findOrderById(dto.order_id);
    if (!order) {
      throw new NotFoundException(`Order with ID "${dto.order_id}" was not found.`);
    }

    // 2. Authorization check
    if (order.student_id !== user.userId) {
      throw new ForbiddenException('You can only request refunds for your own orders.');
    }

    // 3. Status checks
    if (order.status !== 'completed' || order.payment_status !== 'paid') {
      throw new BadRequestException('Only completed and fully paid orders are eligible for refunds.');
    }

    if (Number(order.total_amount) === 0) {
      throw new BadRequestException('Free / ₹0 orders cannot be refunded.');
    }

    // 4. Dynamic Refund Eligibility & Anti-Abuse Checks (Udemy-Style)
    const eligibility = await this.refundsRepo.checkOrderRefundEligibility(order.order_id, user.userId);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        eligibility.reasons.join(' ') || 'This order is not eligible for refund according to course policies.',
      );
    }

    // 5. Duplicate check
    const existingActive = await this.refundsRepo.findActiveRefundForOrder(order.order_id);
    if (existingActive) {
      throw new ConflictException(
        `A refund request for this order is already ${existingActive.status} (Refund #: ${existingActive.refund_number}).`,
      );
    }

    // 6. Create refund record
    const refundNumber = this.generateRefundNumber();
    const refund = await this.refundsRepo.createRefundRequest({
      order_id: order.order_id,
      student_id: user.userId,
      refund_number: refundNumber,
      amount: Number(order.total_amount),
      amount_in_paise: order.total_in_paise,
      currency: order.currency,
      reason: dto.reason.trim(),
    });

    // 7. Audit log
    await this.refundsRepo.logAuditEvent({
      order_id: order.order_id,
      refund_id: refund.refund_id,
      student_id: user.userId,
      actor_id: user.userId,
      event_type: 'REFUND_REQUESTED',
      amount: Number(order.total_amount),
      currency: order.currency,
      description: `Student requested refund for Order ${order.order_number}: "${dto.reason.trim()}"`,
    });

    this.logger.log(`[REFUND REQUESTED] Refund ${refund.refund_number} for Order ${order.order_number}`);

    return this.formatRefundResponse(refund, order.order_number);
  }

  /**
   * Admin reviews (approve / reject) a refund request.
   * If approved:
   *   - Invokes Razorpay Refunds API to return funds to student.
   *   - Automatically revokes student course access (enrollment_status = 'cancelled').
   *   - Appends audit ledger entries.
   */
  async reviewRefund(
    refundId: string,
    dto: ReviewRefundDto,
    admin: AuthenticatedUser,
  ): Promise<{
    success: boolean;
    message: string;
    refund: RefundDetailResponse;
    revokedCount?: number;
  }> {
    this.validateAdmin(admin);

    const refund = await this.refundsRepo.findRefundById(refundId);
    if (!refund) {
      throw new NotFoundException(`Refund request "${refundId}" not found.`);
    }

    if (refund.status !== 'pending') {
      throw new BadRequestException(`This refund request has already been reviewed (Status: ${refund.status}).`);
    }

    const order = await this.ordersRepo.findOrderById(refund.order_id);
    if (!order) {
      throw new NotFoundException(`Associated order "${refund.order_id}" not found.`);
    }

    if (dto.decision === 'approve') {
      // 1. Trigger Razorpay Refund (Live or Mock Gateway)
      let gatewayRefundId = `rfnd_manual_${Date.now()}`;
      if (order.payment_id) {
        const rzpRefund = await this.razorpayGateway.createRefund({
          paymentId: order.payment_id,
          amountInPaise: refund.amount_in_paise,
          receipt: refund.refund_number,
          notes: {
            orderNumber: order.order_number,
            reason: refund.reason,
            adminNotes: dto.admin_notes || 'Approved by admin',
          },
        });
        gatewayRefundId = rzpRefund.id;
      }

      // 2. Execute atomic database transaction (refund status, order status, enrollment revocation, audit logs)
      const { refund: processedRefund, revokedCount } =
        await this.refundsRepo.executeRefundApprovalTransaction({
          refundId: refund.refund_id,
          orderId: order.order_id,
          studentId: refund.student_id,
          adminId: admin.userId,
          amount: Number(refund.amount),
          currency: refund.currency,
          gatewayRefundId,
          adminNotes: dto.admin_notes,
        });

      this.logger.log(
        `[REFUND APPROVED] Refund ${processedRefund.refund_number} approved. ${revokedCount} course enrollment(s) revoked.`,
      );

      return {
        success: true,
        message: `Refund approved successfully. Funds reversed via ${gatewayRefundId} and course access revoked.`,
        refund: this.formatRefundResponse(processedRefund, order.order_number),
        revokedCount,
      };
    }

    // Rejection Flow
    const rejectedRefund = await this.refundsRepo.executeRefundRejectionTransaction({
      refundId: refund.refund_id,
      orderId: order.order_id,
      studentId: refund.student_id,
      adminId: admin.userId,
      amount: Number(refund.amount),
      currency: refund.currency,
      adminNotes: dto.admin_notes,
    });

    this.logger.log(`[REFUND REJECTED] Refund ${rejectedRefund.refund_number} rejected by admin.`);

    return {
      success: true,
      message: 'Refund request was rejected.',
      refund: this.formatRefundResponse(rejectedRefund, order.order_number),
    };
  }

  /**
   * Get refund details by UUID or refund number.
   */
  async getRefundById(
    identifier: string,
    user: AuthenticatedUser,
  ): Promise<RefundDetailResponse> {
    let refund = await this.refundsRepo.findRefundByNumber(identifier);
    if (!refund) {
      refund = await this.refundsRepo.findRefundById(identifier);
    }
    if (!refund) {
      throw new NotFoundException(`Refund "${identifier}" not found.`);
    }

    const isAdmin = isOperationsAdmin(user);
    if (refund.student_id !== user.userId && !isAdmin) {
      throw new ForbiddenException('You are not authorized to view this refund.');
    }

    const order = await this.ordersRepo.findOrderById(refund.order_id);
    return this.formatRefundResponse(refund, order?.order_number);
  }

  /**
   * List refunds for the active student.
   */
  async listStudentRefunds(user: AuthenticatedUser, query: QueryRefundsDto) {
    assertCanPurchase(user);
    const res = await this.refundsRepo.listStudentRefunds(user.userId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return {
      items: res.items.map((r) => this.formatRefundResponse(r)),
      total: res.total,
    };
  }

  /**
   * List all platform refunds (Admin / Super Admin).
   */
  async listAllRefunds(query: QueryRefundsDto, user: AuthenticatedUser) {
    this.validateAdmin(user);
    const res = await this.refundsRepo.listAllRefunds({
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return {
      items: res.items.map((r) => this.formatRefundResponse(r)),
      total: res.total,
    };
  }

  /**
   * Query financial audit ledger (Admin / Super Admin).
   */
  async listAuditLogs(
    params: {
      limit?: number;
      offset?: number;
      orderId?: string;
      studentId?: string;
      eventType?: string;
    },
    user: AuthenticatedUser,
  ) {
    this.validateAdmin(user);
    const res = await this.refundsRepo.listAuditLogs(params);
    return {
      items: res.items,
      total: res.total,
    };
  }

  /**
   * Check dynamic refund eligibility for an order (Udemy-style consumption & policy checks).
   */
  async checkOrderEligibility(
    orderId: string,
    user: AuthenticatedUser,
  ): Promise<{
    orderId: string;
    orderNumber: string;
    eligible: boolean;
    reasons: string[];
    hasActiveRefund: boolean;
    activeRefundStatus?: string;
    courses: Array<{
      courseId: string;
      title: string;
      isRefundable: boolean;
      refundPeriodDays: number;
      totalLessons: number;
      completedLessons: number;
      progressPercent: number;
      isDisqualifiedByConsumption: boolean;
      isDisqualifiedByWindow: boolean;
      isDisqualifiedByPolicy: boolean;
    }>;
  }> {
    const order = await this.ordersRepo.findOrderById(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" was not found.`);
    }

    const isAdmin = isOperationsAdmin(user);
    if (order.student_id !== user.userId && !isAdmin) {
      throw new ForbiddenException('You are not authorized to check refund eligibility for this order.');
    }

    const existingActive = await this.refundsRepo.findActiveRefundForOrder(order.order_id);
    const eligibility = await this.refundsRepo.checkOrderRefundEligibility(order.order_id, order.student_id);

    const reasons = [...eligibility.reasons];
    if (existingActive) {
      reasons.unshift(`A refund request is already ${existingActive.status} (Refund #: ${existingActive.refund_number}).`);
    }
    if (order.status !== 'completed' || order.payment_status !== 'paid') {
      reasons.unshift('Only completed and fully paid orders are eligible for refunds.');
    }
    if (Number(order.total_amount) === 0) {
      reasons.unshift('Free orders cannot be refunded.');
    }

    return {
      orderId: order.order_id,
      orderNumber: order.order_number,
      eligible: reasons.length === 0,
      reasons,
      hasActiveRefund: Boolean(existingActive),
      activeRefundStatus: existingActive?.status,
      courses: eligibility.courses,
    };
  }

  /**
   * Helper to format refund database record to API response.
   */
  private formatRefundResponse(
    refund: any,
    orderNumber?: string,
  ): RefundDetailResponse {
    const studentName =
      refund.first_name || refund.last_name
        ? [refund.first_name, refund.last_name].filter(Boolean).join(' ')
        : undefined;

    return {
      refundId: refund.refund_id,
      orderId: refund.order_id,
      orderNumber: orderNumber || refund.order_number || undefined,
      studentId: refund.student_id,
      studentName,
      studentEmail: refund.email || undefined,
      refundNumber: refund.refund_number,
      amount: Number(refund.amount),
      amountInPaise: refund.amount_in_paise,
      currency: refund.currency,
      status: refund.status,
      reason: refund.reason,
      adminNotes: refund.admin_notes,
      gatewayRefundId: refund.gateway_refund_id,
      reviewedBy: refund.reviewed_by,
      reviewedAt: refund.reviewed_at,
      processedAt: refund.processed_at,
      createdAt: refund.created_at,
      updatedAt: refund.updated_at,
    };
  }
}


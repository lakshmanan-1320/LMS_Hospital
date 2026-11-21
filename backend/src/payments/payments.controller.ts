import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PaymentsService } from './payments.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { SimulatePaymentDto } from './dto/simulate-payment.dto';
import { RequireModule, SkipModuleCheck } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.PAYMENTS)
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Create a Razorpay Order for student's active cart.
   * POST /payments/orders
   */
  @RequireModule(MODULE_KEYS.CART_CHECKOUT)
  @Post('orders')
  async createPaymentOrder(
    @Body() dto: CreatePaymentOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const checkoutConfig = await this.paymentsService.createPaymentOrder(user, dto.notes);
    return {
      success: true,
      message: 'Razorpay order created successfully.',
      data: checkoutConfig,
    };
  }

  /**
   * Verify Razorpay Payment Signature cryptographically.
   * POST /payments/verify
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Body() dto: VerifyPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyPayment(dto, user);
  }

  /**
   * Mock payment simulator for development and test scenarios (SUCCESS, FAILURE, CANCELLED).
   * POST /payments/mock/simulate
   */
  @RequireModule(MODULE_KEYS.CART_CHECKOUT)
  @Post('mock/simulate')
  @HttpCode(HttpStatus.OK)
  async simulatePayment(
    @Body() dto: SimulatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.simulatePayment(dto, user);
  }

  /**
   * Live Razorpay Webhook Endpoint.
   * POST /payments/webhook
   */
  @Public()
  @SkipModuleCheck()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: Request,
    @Body() body: any,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header.');
    }

    // Use rawBody buffer if attached by NestJS, or fallback to serialized body
    const rawBody = (req as any).rawBody || JSON.stringify(body);
    return this.paymentsService.handleWebhook(rawBody, signature, body);
  }

  /**
   * Mock Webhook Dispatch Simulator (for automated testing or dev environments).
   * POST /payments/mock/webhook
   */
  @Public()
  @SkipModuleCheck()
  @Post('mock/webhook')
  @HttpCode(HttpStatus.OK)
  async simulateMockWebhook(
    @Body()
    dto: {
      event: 'payment.captured' | 'payment.failed';
      orderId: string;
      paymentId?: string;
    },
  ) {
    if (!dto.event || !dto.orderId) {
      throw new BadRequestException('event and orderId are required.');
    }
    return this.paymentsService.simulateWebhookDispatch(dto.event, dto.orderId, dto.paymentId);
  }

  /**
   * List payment transactions for the active student.
   * GET /payments/transactions
   */
  @Get('transactions')
  async listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const res = await this.paymentsService.listTransactions(user, {
      limit: Number(limit),
      offset: Number(offset),
    });
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * Get single transaction details by order ID or transaction UUID.
   * GET /payments/transactions/:identifier
   */
  @Get('transactions/:identifier')
  async getTransaction(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tx = await this.paymentsService.getTransaction(identifier, user);
    return {
      success: true,
      data: tx,
    };
  }
}


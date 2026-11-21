import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RefundsService } from './refunds.service';
import { RequestRefundDto } from './dto/request-refund.dto';
import { ReviewRefundDto } from './dto/review-refund.dto';
import { QueryRefundsDto } from './dto/query-refunds.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.REFUNDS)
@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  /**
   * Student submits a refund request.
   * POST /refunds/request
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  async requestRefund(
    @Body() dto: RequestRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const refund = await this.refundsService.requestRefund(dto, user);
    return {
      success: true,
      message: 'Refund request submitted successfully and is pending review.',
      data: refund,
    };
  }

  /**
   * Admin reviews (approve / reject) a refund request.
   * PATCH /refunds/:id/review
   */
  @Patch(':id/review')
  @Roles('ADMIN')
  async reviewRefund(
    @Param('id') id: string,
    @Body() dto: ReviewRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refundsService.reviewRefund(id, dto, user);
  }

  /**
   * List student's own refund requests.
   * GET /refunds
   */
  @Get()
  async listStudentRefunds(
    @Query() query: QueryRefundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.refundsService.listStudentRefunds(user, query);
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * List all platform refunds (Admin / Super Admin).
   * GET /refunds/admin/all
   */
  @Get('admin/all')
  @Roles('ADMIN')
  async listAllRefunds(
    @Query() query: QueryRefundsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.refundsService.listAllRefunds(query, user);
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * Inspect financial audit ledger (Admin / Super Admin).
   * GET /refunds/admin/audit-ledger
   */
  @Get('admin/audit-ledger')
  @Roles('ADMIN')
  async listAuditLedger(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('orderId') orderId?: string,
    @Query('studentId') studentId?: string,
    @Query('eventType') eventType?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const res = await this.refundsService.listAuditLogs(
      {
        limit: Number(limit),
        offset: Number(offset),
        orderId,
        studentId,
        eventType,
      },
      user!,
    );
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * Check dynamic refund eligibility for an order (Udemy-style consumption & policy checks).
   * GET /refunds/orders/:orderId/eligibility
   */
  @Get('orders/:orderId/eligibility')
  async checkRefundEligibility(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.refundsService.checkOrderEligibility(orderId, user);
    return {
      success: true,
      data,
    };
  }

  /**
   * Get refund details by UUID or refund number.
   * GET /refunds/:identifier
   */
  @Get(':identifier')
  async getRefundById(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const refund = await this.refundsService.getRefundById(identifier, user);
    return {
      success: true,
      data: refund,
    };
  }
}


import {
  Controller,
  Get,
  Post,
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
import { OrdersService } from './orders.service';
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.ORDERS)
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Complete checkout and enroll courses.
   * POST /orders/checkout
   */
  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() dto: CheckoutOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.ordersService.checkout(dto, user);
    return {
      success: true,
      message: 'Order completed and courses enrolled successfully!',
      data: order,
    };
  }

  /**
   * List orders for the active student.
   * GET /orders
   */
  @Get()
  async listStudentOrders(
    @Query() query: QueryOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.ordersService.listStudentOrders(user, query);
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * List all platform orders (Admin / Super Admin).
   * GET /orders/admin/all
   */
  @Get('admin/all')
  @Roles('ADMIN')
  async listAllOrders(@Query() query: QueryOrdersDto) {
    const res = await this.ordersService.listAllOrders(query);
    return {
      success: true,
      data: res.items,
      total: res.total,
    };
  }

  /**
   * Get invoice for an order.
   * GET /orders/:identifier/invoice
   */
  @Get(':identifier/invoice')
  async getInvoice(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const invoice = await this.ordersService.getInvoice(identifier, user);
    return {
      success: true,
      data: invoice,
    };
  }

  /**
   * Get order details by order ID or order number.
   * GET /orders/:identifier
   */
  @Get(':identifier')
  async getOrderDetails(
    @Param('identifier') identifier: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const order = await this.ordersService.getOrderDetails(identifier, user);
    return {
      success: true,
      data: order,
    };
  }
}


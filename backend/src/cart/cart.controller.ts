import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { ApplyCouponDto } from '../coupons/dto/apply-coupon.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.CART_CHECKOUT)
@Controller('cart')
@UseGuards(JwtAuthGuard) // any signed-in account can buy (see common/policies/purchase.policy.ts)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Get active student's cart summary, items, and live pricing.
   * GET /cart
   */
  @Get()
  async getCart(@CurrentUser() user: AuthenticatedUser) {
    const cart = await this.cartService.getCart(user);
    return {
      success: true,
      data: cart,
    };
  }

  /**
   * Add a course to the student's cart.
   * POST /cart/items
   */
  @Post('items')
  async addToCart(
    @Body() dto: AddToCartDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cart = await this.cartService.addToCart(dto, user);
    return {
      success: true,
      message: 'Course added to cart.',
      data: cart,
    };
  }

  /**
   * Remove a course from the student's cart.
   * DELETE /cart/items/:courseId
   */
  @Delete('items/:courseId')
  async removeFromCart(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cart = await this.cartService.removeFromCart(courseId, user);
    return {
      success: true,
      message: 'Course removed from cart.',
      data: cart,
    };
  }

  /**
   * Clear all items in the student's cart.
   * DELETE /cart
   */
  @Delete()
  async clearCart(@CurrentUser() user: AuthenticatedUser) {
    const cart = await this.cartService.clearCart(user);
    return {
      success: true,
      message: 'Cart cleared.',
      data: cart,
    };
  }

  /**
   * Get all active and eligible coupons for the student's current cart.
   * GET /cart/available-coupons
   */
  @Get('available-coupons')
  async getAvailableCoupons(@CurrentUser() user: AuthenticatedUser) {
    const coupons = await this.cartService.getAvailableCoupons(user);
    return {
      success: true,
      data: coupons,
    };
  }

  /**
   * Apply a coupon code to the student's cart.
   * POST /cart/coupon
   */
  @RequireModule(MODULE_KEYS.COUPONS)
  @Post('coupon')
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const cart = await this.cartService.applyCoupon(dto.code, user);
    return {
      success: true,
      message: `Coupon "${dto.code.toUpperCase()}" applied successfully!`,
      data: cart,
    };
  }

  /**
   * Remove applied coupon from the student's cart.
   * DELETE /cart/coupon
   */
  @RequireModule(MODULE_KEYS.COUPONS)
  @Delete('coupon')
  async removeCoupon(@CurrentUser() user: AuthenticatedUser) {
    const cart = await this.cartService.removeCoupon(user);
    return {
      success: true,
      message: 'Coupon removed from cart.',
      data: cart,
    };
  }

  /**
   * 1-Click free enrollment directly from cart or catalogue.
   * Automatically bypasses payment and removes course from cart if present.
   * POST /cart/enroll-free/:courseId
   */
  @Post('enroll-free/:courseId')
  @HttpCode(HttpStatus.OK)
  async enrollFreeCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cartService.enrollFreeCourse(courseId, user);
  }
}


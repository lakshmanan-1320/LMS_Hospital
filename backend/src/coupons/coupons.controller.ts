import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { SetCourseCouponDto } from './dto/set-course-coupon.dto';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { MODULE_KEYS } from '../modules/platform-modules/platform-modules.constants';

@RequireModule(MODULE_KEYS.COUPONS)
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /**
   * Create a new standalone promotional coupon (Admin only).
   * Instructors attach coupons during course creation/editing.
   * POST /coupons
   */
  @Post()
  @Roles('ADMIN')
  async createCoupon(
    @Body() dto: CreateCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const coupon = await this.couponsService.createCoupon(dto, user);
    return {
      success: true,
      message: 'Coupon created successfully.',
      data: coupon,
    };
  }

  /**
   * List coupons with search, pagination, scope, and status filters.
   * - Admin: sees all platform & course coupons.
   * - Instructor: automatically filtered to their own coupons.
   * GET /coupons
   */
  @Get()
  @Roles('ADMIN', 'INSTRUCTOR')
  async listCoupons(
    @Query('limit') limit = 50,
    @Query('offset') offset?: number,
    @Query('page') page?: number,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('status') status?: string,
    @Query('scope') scope?: string,
    @Query('courseId') courseId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const parsedLimit = Math.max(1, Number(limit) || 50);
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedOffset =
      offset !== undefined ? Math.max(0, Number(offset)) : (parsedPage - 1) * parsedLimit;

    let parsedActive: boolean | undefined = undefined;
    if (isActive === 'true' || status === 'active') {
      parsedActive = true;
    } else if (isActive === 'false' || status === 'inactive') {
      parsedActive = false;
    }

    const res = await this.couponsService.listCoupons(
      {
        limit: parsedLimit,
        offset: parsedOffset,
        search,
        isActive: parsedActive,
        scope,
        courseId,
      },
      user,
    );
    return {
      success: true,
      data: {
        items: res.items,
        total: res.total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.max(1, Math.ceil(res.total / parsedLimit)),
      },
      total: res.total,
      items: res.items,
    };
  }

  /**
   * Get instructor's published paid courses to populate the coupon course dropdown.
   * Fixed route declared before :id.
   * GET /coupons/my-courses
   */
  @Get('my-courses')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getMyCourses(@CurrentUser() user: AuthenticatedUser) {
    const courses = await this.couponsService.getMyCourses(user);
    return {
      success: true,
      data: courses,
    };
  }

  /**
   * Get coupon details by ID.
   * GET /coupons/:id
   */
  @Get(':id')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const coupon = await this.couponsService.getCouponById(id, user);
    return {
      success: true,
      data: coupon,
    };
  }

  /**
   * Update coupon by ID (Admin only).
   * PATCH /coupons/:id
   */
  @Patch(':id')
  @Roles('ADMIN')
  async updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const coupon = await this.couponsService.updateCoupon(id, dto, user);
    return {
      success: true,
      message: 'Coupon updated successfully.',
      data: coupon,
    };
  }

  /**
   * Delete coupon by ID (Admin only).
   * DELETE /coupons/:id
   */
  @Delete(':id')
  @Roles('ADMIN')
  async deleteCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.couponsService.deleteCoupon(id, user);
    return {
      success: true,
      message: 'Coupon deleted successfully.',
    };
  }

  /**
   * Get coupon attached to a specific course (Course Editor & Review).
   * GET /coupons/course/:courseId
   */
  @Get('course/:courseId')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getCourseCoupon(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const coupon = await this.couponsService.getCourseCoupon(courseId, user);
    return {
      success: true,
      data: coupon,
    };
  }

  /**
   * Apply an admin-created coupon OR propose a new course coupon during course creation.
   * POST /coupons/course/:courseId
   */
  @Post('course/:courseId')
  @Roles('ADMIN', 'INSTRUCTOR')
  async setCourseCoupon(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: SetCourseCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const coupon = await this.couponsService.setCourseCoupon(courseId, dto, user);
    return {
      success: true,
      message: 'Course coupon updated successfully.',
      data: coupon,
    };
  }

  /**
   * Remove attached coupon from course.
   * DELETE /coupons/course/:courseId
   */
  @Delete('course/:courseId')
  @Roles('ADMIN', 'INSTRUCTOR')
  async removeCourseCoupon(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.couponsService.removeCourseCoupon(courseId, user);
    return {
      success: true,
      message: 'Course coupon removed successfully.',
    };
  }

  /**
   * Validate a coupon against an eligible cart or course amount before applying.
   * POST /coupons/validate
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @Roles('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.couponsService.validateCoupon(
      dto.code,
      dto.cartAmount,
      user.userId,
    );
    return {
      success: true,
      message: `Coupon "${dto.code.toUpperCase()}" is valid! Discount: ₹${res.discountAmount}`,
      data: {
        code: res.coupon?.code,
        scope: res.coupon?.scope,
        courseId: res.coupon?.course_id,
        courseTitle: res.coupon?.course_title,
        discountType: res.coupon?.discount_type,
        discountValue: Number(res.coupon?.discount_value),
        discountAmount: res.discountAmount,
        minOrderValue: Number(res.coupon?.min_order_value || 0),
        maxDiscountAmount: res.coupon?.max_discount_amount ? Number(res.coupon.max_discount_amount) : null,
      },
    };
  }
}

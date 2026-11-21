import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CouponRecord,
  CouponValidationResult,
} from './interfaces/coupon.interface';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { SetCourseCouponDto } from './dto/set-course-coupon.dto';
import { isOperationsAdmin } from '../common/policies/operations.policy';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(private readonly couponsRepo: CouponsRepository) {}

  private isInstructor(user?: AuthenticatedUser): boolean {
    if (!user || !user.roles) return false;
    const isInstr = user.roles.includes('INSTRUCTOR');
    const isAdmin = isOperationsAdmin(user);
    return isInstr && !isAdmin;
  }

  /**
   * Create a new coupon.
   * - Instructors can ONLY create course-scoped coupons for their own published courses.
   * - Admins can create platform-wide OR course-scoped coupons for any course.
   */
  async createCoupon(dto: CreateCouponDto, user?: AuthenticatedUser): Promise<CouponRecord> {
    const cleanCode = dto.code.trim().toUpperCase();

    // 1. Uniqueness check
    const existing = await this.couponsRepo.findCouponByCode(cleanCode);
    if (existing) {
      throw new ConflictException(`Coupon code "${cleanCode}" already exists.`);
    }

    const instructorOnly = this.isInstructor(user);
    let targetCourseId: string | null = null;
    let targetScope: 'platform' | 'course' = dto.scope || 'platform';

    // 2. Instructor Scope & Course Ownership Validation
    if (instructorOnly) {
      targetScope = 'course';
      if (!dto.course_id) {
        throw new BadRequestException('Instructors must specify a course for the coupon.');
      }
      targetCourseId = dto.course_id;

      const course = await this.couponsRepo.findCourseById(targetCourseId);
      if (!course) {
        throw new NotFoundException('Selected course not found.');
      }
      if (course.instructor_id !== user!.userId) {
        throw new ForbiddenException('You can only create coupons for courses you own.');
      }
      if (course.status !== 'published' || !course.is_active) {
        throw new BadRequestException('Coupons can only be created for published and active courses.');
      }
      if (course.is_free || Number(course.price || 0) === 0) {
        throw new BadRequestException('Cannot create discount coupons for free courses.');
      }
      if (dto.discount_type === 'fixed' && dto.discount_value > Number(course.price)) {
        throw new BadRequestException(`Fixed discount cannot exceed course price (₹${course.price}).`);
      }
    } else if (dto.course_id) {
      // Admin targeting a specific course
      targetScope = 'course';
      targetCourseId = dto.course_id;
      const course = await this.couponsRepo.findCourseById(targetCourseId);
      if (!course) {
        throw new NotFoundException('Selected course not found.');
      }
    }

    // 3. Percentage discount constraints
    if (dto.discount_type === 'percentage') {
      if (dto.discount_value <= 0 || dto.discount_value > 100) {
        throw new BadRequestException('Percentage discount must be between 0.01% and 100%.');
      }
    }

    // 4. Date window validation
    // Default to the app clock, not the database default (CURRENT_TIMESTAMP): the DB clock can run
    // slightly ahead, which made a coupon applied right after creation look "not active yet".
    let validFrom: Date = new Date();
    let validUntil: Date | null = null;

    if (dto.valid_from) {
      validFrom = new Date(dto.valid_from);
      if (isNaN(validFrom.getTime())) {
        throw new BadRequestException('valid_from must be a valid date.');
      }
    }

    if (dto.valid_until) {
      validUntil = new Date(dto.valid_until);
      if (isNaN(validUntil.getTime())) {
        throw new BadRequestException('valid_until must be a valid date.');
      }
      if (validUntil.getTime() <= validFrom.getTime()) {
        throw new BadRequestException('valid_until must be after valid_from.');
      }
    }

    return this.couponsRepo.createCoupon({
      code: cleanCode,
      description: dto.description,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      scope: targetScope,
      course_id: targetCourseId,
      min_order_value: dto.min_order_value ?? 0,
      max_discount_amount: dto.max_discount_amount || null,
      usage_limit: dto.usage_limit || null,
      per_user_limit: dto.per_user_limit ?? 1,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: dto.is_active ?? true,
      created_by: user?.userId || null,
    });
  }

  /**
   * List coupons with optional pagination, search, and active status filters.
   * If caller is an instructor, shows Admin-created coupons & promotions.
   */
  async listCoupons(
    params: {
      limit?: number;
      offset?: number;
      search?: string;
      isActive?: boolean;
      scope?: string;
      courseId?: string;
    },
    user?: AuthenticatedUser,
  ) {
    const instructorOnly = this.isInstructor(user);

    return this.couponsRepo.listCoupons({
      ...params,
      forInstructorId: instructorOnly ? user!.userId : undefined,
    });
  }

  /**
   * Get coupon currently attached or proposed for a specific course.
   */
  async getCourseCoupon(courseId: string, user?: AuthenticatedUser): Promise<CouponRecord | null> {
    const course = await this.couponsRepo.findCourseById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found.');
    }
    if (this.isInstructor(user) && course.instructor_id !== user!.userId) {
      throw new ForbiddenException('You do not have permission to view coupons for this course.');
    }
    return this.couponsRepo.findCourseCoupon(courseId);
  }

  /**
   * Attach an admin-created coupon OR propose a new course coupon during course creation.
   * If course is still a draft/in_review, newly proposed coupon is saved with is_active = false
   * and submitted for platform review along with the course.
   */
  async setCourseCoupon(
    courseId: string,
    dto: SetCourseCouponDto,
    user: AuthenticatedUser,
  ): Promise<CouponRecord> {
    const course = await this.couponsRepo.findCourseById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found.');
    }
    if (this.isInstructor(user) && course.instructor_id !== user.userId) {
      throw new ForbiddenException('You can only attach coupons to courses you own.');
    }
    if (course.is_free || Number(course.price) === 0) {
      throw new BadRequestException('Promotional coupons cannot be added to free courses.');
    }

    // Option A: Apply an existing Admin-created coupon
    if (dto.couponId) {
      const adminCoupon = await this.couponsRepo.findCouponById(dto.couponId);
      if (!adminCoupon) {
        throw new NotFoundException('Selected admin coupon not found.');
      }
      if (!adminCoupon.is_active) {
        throw new BadRequestException(`Coupon "${adminCoupon.code}" is currently inactive.`);
      }

      // If already assigned to this course, return it
      if (adminCoupon.course_id === courseId) {
        return adminCoupon;
      }

      // Remove any previously attached course-specific coupon for this course
      await this.couponsRepo.deleteCourseCoupons(courseId);

      // Link this coupon specifically to the course
      const updated = await this.couponsRepo.updateCoupon(adminCoupon.coupon_id, {
        course_id: courseId,
        scope: 'course',
      });
      return updated || adminCoupon;
    }

    // Option B: Propose a new course coupon during course creation
    const cleanCode = (dto.code || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new BadRequestException('Coupon code is required.');
    }
    if (!dto.discount_value || dto.discount_value <= 0) {
      throw new BadRequestException('Discount value must be greater than zero.');
    }

    const discType = dto.discount_type || 'percentage';
    if (discType === 'percentage' && dto.discount_value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100%.');
    }

    // Check code collision
    const existing = await this.couponsRepo.findCouponByCode(cleanCode);
    if (existing && existing.course_id !== courseId) {
      throw new ConflictException(`Coupon code "${cleanCode}" is already taken.`);
    }

    // Remove old course coupon
    await this.couponsRepo.deleteCourseCoupons(courseId);

    const isCoursePublished = course.status === 'published';
    const isCallerAdmin = !this.isInstructor(user);
    // If course is in draft or review, coupon remains inactive pending admin review
    const isActive = isCoursePublished || isCallerAdmin;

    return this.couponsRepo.createCoupon({
      code: cleanCode,
      description: dto.description || `Instructor promotion for ${course.title}`,
      discount_type: discType,
      discount_value: dto.discount_value,
      scope: 'course',
      course_id: courseId,
      min_order_value: dto.min_order_value || 0,
      max_discount_amount: dto.max_discount_amount || null,
      usage_limit: dto.usage_limit || null,
      per_user_limit: 1,
      valid_from: new Date(),
      valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
      is_active: isActive,
      created_by: user.userId,
    });
  }

  /**
   * Remove any attached coupon from a course.
   */
  async removeCourseCoupon(courseId: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.couponsRepo.findCourseById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found.');
    }
    if (this.isInstructor(user) && course.instructor_id !== user.userId) {
      throw new ForbiddenException('You do not own this course.');
    }
    await this.couponsRepo.deleteCourseCoupons(courseId);
  }

  /**
   * Get coupon details by UUID.
   * Enforces that instructors can only view their own coupons.
   */
  async getCouponById(couponId: string, user?: AuthenticatedUser): Promise<CouponRecord> {
    const coupon = await this.couponsRepo.findCouponById(couponId);
    if (!coupon) {
      throw new NotFoundException('Coupon not found.');
    }

    if (this.isInstructor(user)) {
      if (coupon.created_by !== user!.userId && coupon.instructor_id !== user!.userId) {
        throw new ForbiddenException('You do not have permission to view this coupon.');
      }
    }

    return coupon;
  }

  /**
   * Update coupon by UUID.
   * Instructors can only update their own coupons.
   */
  async updateCoupon(
    couponId: string,
    dto: UpdateCouponDto,
    user?: AuthenticatedUser,
  ): Promise<CouponRecord> {
    const existing = await this.getCouponById(couponId, user);

    if (this.isInstructor(user)) {
      if (existing.created_by !== user!.userId) {
        throw new ForbiddenException('You can only update coupons you created.');
      }
      if (dto.scope === 'platform') {
        throw new ForbiddenException('Instructors cannot convert coupons to platform-wide.');
      }
      if (dto.course_id && dto.course_id !== existing.course_id) {
        const course = await this.couponsRepo.findCourseById(dto.course_id);
        if (!course || course.instructor_id !== user!.userId) {
          throw new ForbiddenException('You can only assign coupons to courses you own.');
        }
      }
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const codeTaken = await this.couponsRepo.findCouponByCode(dto.code.trim());
      if (codeTaken) {
        throw new ConflictException(`Coupon code "${dto.code.trim().toUpperCase()}" is already taken.`);
      }
    }

    const type = dto.discount_type || existing.discount_type;
    const value = dto.discount_value !== undefined ? dto.discount_value : Number(existing.discount_value);

    if (type === 'percentage' && (value <= 0 || value > 100)) {
      throw new BadRequestException('Percentage discount must be between 0.01% and 100%.');
    }

    let validFrom: Date | undefined;
    let validUntil: Date | null | undefined;

    if (dto.valid_from) {
      validFrom = new Date(dto.valid_from);
      if (isNaN(validFrom.getTime())) throw new BadRequestException('valid_from is invalid.');
    }
    if (dto.valid_until !== undefined) {
      if (dto.valid_until === null) {
        validUntil = null;
      } else {
        validUntil = new Date(dto.valid_until);
        if (isNaN(validUntil.getTime())) throw new BadRequestException('valid_until is invalid.');
        const fromTime = validFrom ? validFrom.getTime() : new Date(existing.valid_from).getTime();
        if (validUntil.getTime() <= fromTime) {
          throw new BadRequestException('valid_until must be after valid_from.');
        }
      }
    }

    const updated = await this.couponsRepo.updateCoupon(couponId, {
      code: dto.code ? dto.code.trim().toUpperCase() : undefined,
      description: dto.description,
      discount_type: dto.discount_type,
      discount_value: dto.discount_value,
      scope: dto.scope,
      course_id: dto.course_id,
      min_order_value: dto.min_order_value,
      max_discount_amount: dto.max_discount_amount,
      usage_limit: dto.usage_limit,
      per_user_limit: dto.per_user_limit,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: dto.is_active,
    });

    if (!updated) {
      throw new NotFoundException('Coupon not found.');
    }
    return updated;
  }

  /**
   * Delete coupon.
   * Instructors can only delete their own coupons.
   */
  async deleteCoupon(couponId: string, user?: AuthenticatedUser): Promise<boolean> {
    await this.getCouponById(couponId, user);
    return this.couponsRepo.deleteCoupon(couponId);
  }

  /**
   * Fetch coupon by its code (case-insensitive).
   */
  async getCouponByCode(code: string): Promise<CouponRecord | null> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return null;
    return this.couponsRepo.findCouponByCode(cleanCode);
  }

  /**
   * Fetch published paid courses for coupon creation dropdown.
   * Admins can target any platform published paid course.
   * Instructors can only target their own published paid courses.
   */
  async getMyCourses(user: AuthenticatedUser): Promise<any[]> {
    const isAdmin = isOperationsAdmin(user);
    if (isAdmin) {
      return this.couponsRepo.findAllPublishedCourses();
    }
    return this.couponsRepo.findInstructorPublishedCourses(user.userId);
  }

  /**
   * Validate a coupon against eligible cart amount, targeted course (if any), and student ID.
   * Throws friendly descriptive exceptions when invalid.
   */
  async validateCoupon(
    code: string,
    cartAmount: number,
    studentId?: string,
    targetCoursePrice?: number,
  ): Promise<CouponValidationResult> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new BadRequestException('Please enter a coupon code.');
    }

    const coupon = await this.couponsRepo.findCouponByCode(cleanCode);
    if (!coupon) {
      throw new NotFoundException(`Coupon code "${cleanCode}" is invalid.`);
    }

    // 1. Active status check
    if (!coupon.is_active) {
      throw new BadRequestException(`Coupon "${cleanCode}" is currently inactive.`);
    }

    // 2. Validity date checks
    const now = new Date();
    if (new Date(coupon.valid_from) > now) {
      throw new BadRequestException(`Coupon "${cleanCode}" is not active yet.`);
    }

    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      throw new BadRequestException(`Coupon "${cleanCode}" has expired.`);
    }

    // 3. Global usage limit check
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      throw new BadRequestException(`Coupon "${cleanCode}" has reached its maximum global redemption limit.`);
    }

    // 4. Per-user redemption limit check
    if (studentId) {
      const studentUsages = await this.couponsRepo.countStudentUsages(coupon.coupon_id, studentId);
      if (studentUsages >= coupon.per_user_limit) {
        throw new BadRequestException(
          `You have already redeemed coupon "${cleanCode}" the maximum number of times allowed (${coupon.per_user_limit} time${coupon.per_user_limit === 1 ? '' : 's'}).`,
        );
      }
    }

    // 5. Minimum cart amount check
    const minOrderVal = Number(coupon.min_order_value || 0);
    if (cartAmount < minOrderVal) {
      throw new BadRequestException(
        `Coupon "${cleanCode}" requires a minimum cart amount of ₹${minOrderVal}. Current eligible total is ₹${cartAmount}.`,
      );
    }

    // 6. Calculate discount amount:
    // If course-specific, calculate on targeted course price; otherwise on total cart amount
    const baseAmount = targetCoursePrice !== undefined && targetCoursePrice > 0 ? targetCoursePrice : cartAmount;
    let discountAmount = 0;
    const discountVal = Number(coupon.discount_value);

    if (coupon.discount_type === 'percentage') {
      const rawDiscount = (baseAmount * discountVal) / 100;
      if (coupon.max_discount_amount !== null) {
        const maxCap = Number(coupon.max_discount_amount);
        discountAmount = Math.min(rawDiscount, maxCap);
      } else {
        discountAmount = rawDiscount;
      }
    } else {
      // Fixed amount
      discountAmount = Math.min(discountVal, baseAmount);
    }

    // Round to 2 decimals
    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      coupon,
      discountAmount,
    };
  }
}

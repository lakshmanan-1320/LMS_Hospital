import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CartRepository } from './cart.repository';
import { CouponsService } from '../coupons/coupons.service';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  CartRecord,
  CartItemDetail,
  CartPricingSummary,
  CartResponse,
  AvailableCouponOption,
} from './interfaces/cart.interface';
import { AppliedCouponInfo } from '../coupons/interfaces/coupon.interface';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { assertCanPurchase } from '../common/policies/purchase.policy';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly cartRepo: CartRepository,
    private readonly couponsService: CouponsService,
  ) {}


  /**
   * Get an existing cart or create a new persistent cart for the student.
   */
  private async getOrCreateCart(studentId: string): Promise<CartRecord> {
    const existing = await this.cartRepo.findCartByStudentId(studentId);
    if (existing) return existing;
    return this.cartRepo.createCart(studentId);
  }

  /**
   * Compute live pricing, validate discounts & currencies, and group free vs paid items.
   * Dynamically applies or invalidates attached coupons based on live paid subtotal.
   */
  private async buildCartResponse(cart: CartRecord, rawItems: any[]): Promise<CartResponse> {
    const items: CartItemDetail[] = [];
    const freeItems: CartItemDetail[] = [];
    const paidItems: CartItemDetail[] = [];

    let subtotal = 0;
    let basePayableTotal = 0;
    let paidSubtotal = 0;
    const currencies = new Set<string>();

    for (const row of rawItems) {
      const regularPrice = Math.max(0, Number(row.price || 0));
      const rawDiscount = row.discount_price !== null ? Number(row.discount_price) : null;
      // Discount validity: must be >= 0 and <= regularPrice
      const discountPrice =
        rawDiscount !== null && rawDiscount >= 0 && rawDiscount <= regularPrice
          ? rawDiscount
          : null;

      const isFree = Boolean(row.is_free) || regularPrice === 0;
      const effectivePrice = isFree ? 0 : discountPrice !== null ? discountPrice : regularPrice;
      const priceAtAddition = Number(row.price_at_addition || 0);

      const priceChanged = effectivePrice !== priceAtAddition;
      const priceDifference = effectivePrice - priceAtAddition;

      const currency = String(row.currency || 'INR').trim().toUpperCase();
      currencies.add(currency);

      const isAvailable =
        row.status === 'published' && Boolean(row.is_active) && !row.deleted_at;

      const instructorName = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Instructor';

      const itemDetail: CartItemDetail = {
        cartItemId: row.cart_item_id,
        courseId: row.course_id,
        title: row.title,
        slug: row.slug,
        subtitle: row.subtitle,
        thumbnailUrl: row.thumbnail_url,
        instructorId: row.instructor_id,
        instructorName,
        level: row.level || 'all_levels',
        isFree,
        regularPrice,
        discountPrice,
        effectivePrice,
        priceAtAddition,
        priceChanged,
        priceDifference,
        currency,
        isAvailable,
        addedAt: row.added_at,
      };

      items.push(itemDetail);
      if (isFree) {
        freeItems.push(itemDetail);
      } else {
        paidItems.push(itemDetail);
        paidSubtotal += effectivePrice;
      }

      subtotal += regularPrice;
      basePayableTotal += effectivePrice;
    }

    // Coupon evaluation logic
    let appliedCoupon: AppliedCouponInfo | null = null;
    let couponDiscount = 0;

    if (cart.applied_coupon_id && paidSubtotal > 0) {
      const coupon = await this.cartRepo.findAppliedCoupon(cart.applied_coupon_id);
      if (coupon && coupon.is_active) {
        const now = new Date();
        const isValidDate =
          new Date(coupon.valid_from) <= now &&
          (!coupon.valid_until || new Date(coupon.valid_until) >= now);

        const minOrder = Number(coupon.min_order_value || 0);
        const meetsMinOrder = paidSubtotal >= minOrder;

        // If coupon is course-specific, verify the targeted course is still present in cart
        let targetCourseItem: CartItemDetail | undefined;
        let isCourseConditionMet = true;
        if (coupon.scope === 'course' && coupon.course_id) {
          targetCourseItem = paidItems.find((item) => item.courseId === coupon.course_id);
          if (!targetCourseItem) {
            isCourseConditionMet = false;
          }
        }

        if (isValidDate && meetsMinOrder && isCourseConditionMet) {
          const discVal = Number(coupon.discount_value);
          // Calculate discount against targeted course price for course-scoped coupons, or against paidSubtotal for platform coupons
          const baseCalculationAmount =
            coupon.scope === 'course' && targetCourseItem
              ? targetCourseItem.effectivePrice
              : paidSubtotal;

          if (coupon.discount_type === 'percentage') {
            const raw = (baseCalculationAmount * discVal) / 100;
            couponDiscount =
              coupon.max_discount_amount !== null
                ? Math.min(raw, Number(coupon.max_discount_amount))
                : raw;
          } else {
            couponDiscount = Math.min(discVal, baseCalculationAmount);
          }
          couponDiscount = Math.round(couponDiscount * 100) / 100;

          appliedCoupon = {
            couponId: coupon.coupon_id,
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discount_type,
            discountValue: discVal,
            discountAmount: couponDiscount,
            scope: coupon.scope || 'platform',
            courseId: coupon.course_id || null,
            courseTitle: (coupon as any).course_title || null,
            minOrderValue: minOrder,
            maxDiscountAmount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
          };
        } else {
          // Invalidate and detach coupon if requirements are no longer met
          await this.cartRepo.removeCouponFromCart(cart.cart_id);
          cart.applied_coupon_id = null;
        }
      } else {
        await this.cartRepo.removeCouponFromCart(cart.cart_id);
        cart.applied_coupon_id = null;
      }
    } else if (cart.applied_coupon_id && paidSubtotal === 0) {
      // Free items only or empty cart cannot retain a coupon
      await this.cartRepo.removeCouponFromCart(cart.cart_id);
      cart.applied_coupon_id = null;
    }

    const total = Math.max(0, basePayableTotal - couponDiscount);
    const discountTotal = Math.max(0, subtotal - total);
    const primaryCurrency = currencies.size > 0 ? Array.from(currencies)[0] : 'INR';
    const currencyMismatch = currencies.size > 1;

    // Fetch active coupons applicable for this cart
    const availableCoupons: AvailableCouponOption[] = [];
    if (paidItems.length > 0 && paidSubtotal > 0) {
      const courseIds = paidItems.map((p) => p.courseId);
      const rawCoupons = await this.cartRepo.findAvailableCouponsForCart(courseIds);

      for (const c of rawCoupons) {
        const minOrder = Number(c.min_order_value || 0);
        if (paidSubtotal < minOrder) {
          continue;
        }

        const usageCount = await this.cartRepo.countStudentCouponUsages(c.coupon_id, cart.student_id);
        if (usageCount >= c.per_user_limit) {
          continue;
        }

        const discVal = Number(c.discount_value);
        let estimatedDiscount = 0;

        if (c.scope === 'course' && c.course_id) {
          const matchedItem = paidItems.find((p) => p.courseId === c.course_id);
          if (!matchedItem) {
            continue;
          }
          if (c.discount_type === 'percentage') {
            const raw = (matchedItem.effectivePrice * discVal) / 100;
            estimatedDiscount = c.max_discount_amount ? Math.min(raw, Number(c.max_discount_amount)) : raw;
          } else {
            estimatedDiscount = Math.min(discVal, matchedItem.effectivePrice);
          }
        } else {
          // Platform scope
          if (c.discount_type === 'percentage') {
            const raw = (paidSubtotal * discVal) / 100;
            estimatedDiscount = c.max_discount_amount ? Math.min(raw, Number(c.max_discount_amount)) : raw;
          } else {
            estimatedDiscount = Math.min(discVal, paidSubtotal);
          }
        }

        estimatedDiscount = Math.round(estimatedDiscount * 100) / 100;

        const discountBadge =
          c.discount_type === 'percentage'
            ? `${Number(c.discount_value)}% OFF`
            : `₹${Number(c.discount_value)} OFF`;

        availableCoupons.push({
          couponId: c.coupon_id,
          code: c.code,
          description: c.description || null,
          discountType: c.discount_type,
          discountValue: discVal,
          scope: c.scope,
          courseId: c.course_id || null,
          courseTitle: c.course_title || null,
          minOrderValue: minOrder,
          maxDiscountAmount: c.max_discount_amount ? Number(c.max_discount_amount) : null,
          estimatedDiscount,
          discountBadge,
        });
      }

      availableCoupons.sort((a, b) => b.estimatedDiscount - a.estimatedDiscount);
    }

    const summary: CartPricingSummary = {
      subtotal: Math.round(subtotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      couponDiscount,
      total: Math.round(total * 100) / 100,
      paidSubtotal: Math.round(paidSubtotal * 100) / 100,
      appliedCoupon,
      currency: primaryCurrency,
      itemCount: items.length,
      freeItemsCount: freeItems.length,
      paidItemsCount: paidItems.length,
      hasFreeCourses: freeItems.length > 0,
      hasPaidCourses: paidItems.length > 0,
      isPureFreeCart: items.length > 0 && total === 0,
      currencyMismatch,
      availableCoupons,
    };

    return {
      cartId: cart.cart_id,
      studentId: cart.student_id,
      items,
      freeItems,
      paidItems,
      summary,
      availableCoupons,
      updatedAt: cart.updated_at,
    };
  }

  /**
   * Get all active and eligible coupons that can apply to the student's current cart.
   */
  async getAvailableCoupons(user: AuthenticatedUser): Promise<AvailableCouponOption[]> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);
    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    const cartRes = await this.buildCartResponse(cart, rawItems);
    return cartRes.availableCoupons;
  }

  /**
   * Get the active student's cart with live course pricing and free/paid breakdown.
   */
  async getCart(user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);
    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    return this.buildCartResponse(cart, rawItems);
  }

  /**
   * Add a course to the student's cart.
   * Performs validation: published only, not instructor's own course, not already enrolled, duplicate safe.
   */
  async addToCart(dto: AddToCartDto, user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);

    // 1. Check course existence and published status
    const course = await this.cartRepo.findCourseForCart(dto.courseId);
    if (!course || course.status !== 'published' || !course.is_active) {
      throw new NotFoundException('Course not found or is currently not available for purchase.');
    }

    // 2. Prevent instructor from buying/adding their own course
    if (course.instructor_id === user.userId) {
      throw new BadRequestException('You cannot add your own course to your cart.');
    }

    // 3. Prevent adding if student is already actively enrolled
    const enrollment = await this.cartRepo.findStudentEnrollment(user.userId, dto.courseId);
    if (
      enrollment &&
      (enrollment.enrollment_status === 'active' || enrollment.enrollment_status === 'completed')
    ) {
      throw new ConflictException('You are already actively enrolled in this course.');
    }

    // 4. Prevent duplicate addition in cart
    const existingCartItem = await this.cartRepo.findCartItem(cart.cart_id, dto.courseId);
    if (existingCartItem) {
      throw new ConflictException('This course is already in your cart.');
    }

    // 5. Calculate effective price at addition
    const regular = Math.max(0, Number(course.price || 0));
    const rawDisc = course.discount_price !== null ? Number(course.discount_price) : null;
    const isFree = Boolean(course.is_free) || regular === 0;
    const effective = isFree ? 0 : rawDisc !== null && rawDisc <= regular ? rawDisc : regular;

    // 6. Insert item and update cart timestamp
    await this.cartRepo.addCartItem(cart.cart_id, dto.courseId, effective);
    await this.cartRepo.touchCart(cart.cart_id);

    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    return this.buildCartResponse(cart, rawItems);
  }

  /**
   * Remove a single course from the student's cart.
   */
  async removeFromCart(courseId: string, user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);

    const removed = await this.cartRepo.removeCartItem(cart.cart_id, courseId);
    if (removed) {
      await this.cartRepo.touchCart(cart.cart_id);
    }

    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    return this.buildCartResponse(cart, rawItems);
  }

  /**
   * Clear all items in the student's cart.
   */
  async clearCart(user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);

    await this.cartRepo.clearCart(cart.cart_id);
    await this.cartRepo.removeCouponFromCart(cart.cart_id);
    cart.applied_coupon_id = null;
    await this.cartRepo.touchCart(cart.cart_id);

    return this.buildCartResponse(cart, []);
  }

  /**
   * Apply a coupon code to the student's cart.
   */
  async applyCoupon(code: string, user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);
    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);

    if (rawItems.length === 0) {
      throw new BadRequestException('Your cart is empty. Add courses before applying a coupon.');
    }

    // Calculate eligible paid subtotal
    let paidSubtotal = 0;
    for (const row of rawItems) {
      const reg = Math.max(0, Number(row.price || 0));
      const isFree = Boolean(row.is_free) || reg === 0;
      if (!isFree) {
        const rawDisc = row.discount_price !== null ? Number(row.discount_price) : null;
        const eff = rawDisc !== null && rawDisc >= 0 && rawDisc <= reg ? rawDisc : reg;
        paidSubtotal += eff;
      }
    }

    if (paidSubtotal === 0) {
      throw new BadRequestException('Coupons can only be applied to carts containing paid courses.');
    }

    // Check if coupon exists to determine its scope and target course
    const couponRecord = await this.couponsService.getCouponByCode(code);
    if (!couponRecord) {
      throw new NotFoundException(`Coupon code "${(code || '').trim().toUpperCase()}" is invalid.`);
    }

    let targetCoursePrice: number | undefined;
    if (couponRecord.scope === 'course' && couponRecord.course_id) {
      const targetItem = rawItems.find((r) => r.course_id === couponRecord.course_id);
      if (!targetItem) {
        throw new BadRequestException(
          `Coupon "${couponRecord.code}" is only valid for "${couponRecord.course_title || 'a specific course'}". Please add this course to your cart to use this coupon.`,
        );
      }
      const reg = Math.max(0, Number(targetItem.price || 0));
      const isFree = Boolean(targetItem.is_free) || reg === 0;
      if (isFree) {
        throw new BadRequestException('Coupon cannot be applied to a free course.');
      }
      const rawDisc = targetItem.discount_price !== null ? Number(targetItem.discount_price) : null;
      targetCoursePrice = rawDisc !== null && rawDisc >= 0 && rawDisc <= reg ? rawDisc : reg;
    }

    // Validate coupon against paid subtotal and student usage limits
    const validation = await this.couponsService.validateCoupon(
      code,
      paidSubtotal,
      user.userId,
      targetCoursePrice,
    );
    if (!validation.valid || !validation.coupon) {
      throw new BadRequestException(validation.message || 'Invalid coupon.');
    }

    // Associate coupon with the cart
    await this.cartRepo.applyCouponToCart(cart.cart_id, validation.coupon.coupon_id);
    cart.applied_coupon_id = validation.coupon.coupon_id;

    return this.buildCartResponse(cart, rawItems);
  }

  /**
   * Remove the applied coupon from the student's cart.
   */
  async removeCoupon(user: AuthenticatedUser): Promise<CartResponse> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);

    await this.cartRepo.removeCouponFromCart(cart.cart_id);
    cart.applied_coupon_id = null;

    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    return this.buildCartResponse(cart, rawItems);
  }

  /**
   * Transactional, duplicate-safe 1-click enrollment for free courses.
   * Enrolls student immediately without payment, and removes course from cart if present.
   */
  async enrollFreeCourse(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<{
    success: boolean;
    message: string;
    alreadyEnrolled: boolean;
    enrollment: any;
    cart: CartResponse;
  }> {
    assertCanPurchase(user);
    const cart = await this.getOrCreateCart(user.userId);

    // 1. Verify course is published, active, and free
    const course = await this.cartRepo.findCourseForCart(courseId);
    if (!course || course.status !== 'published' || !course.is_active) {
      throw new NotFoundException('Course not found or is currently not available.');
    }

    if (course.instructor_id === user.userId) {
      throw new BadRequestException('You cannot enroll in your own course.');
    }

    const isFree = Boolean(course.is_free) || Number(course.price || 0) === 0;
    if (!isFree) {
      throw new BadRequestException(
        'This is a paid course. Please proceed through checkout to complete enrollment.',
      );
    }

    // 2. Perform transactional enrollment & cart item removal
    const result = await this.cartRepo.enrollFreeCourseTransactional(
      user.userId,
      courseId,
      cart.cart_id,
    );

    // 3. Return updated cart response
    const rawItems = await this.cartRepo.findCartItems(cart.cart_id);
    const updatedCart = await this.buildCartResponse(cart, rawItems);

    return {
      success: true,
      message: result.alreadyEnrolled
        ? 'You are already enrolled in this free course.'
        : 'Successfully enrolled in the free course without payment!',
      alreadyEnrolled: result.alreadyEnrolled,
      enrollment: result.enrollment,
      cart: updatedCart,
    };
  }
}

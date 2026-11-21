'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Tag,
  Check,
  X,
} from 'lucide-react';
import { useCartStore } from '@/stores/useCartStore';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { usePaymentStore } from '@/stores/usePaymentStore';
import { getDashboardRoute } from '@/constants/roles';
import CheckoutStatusModal from '@/modules/payments/components/CheckoutStatusModal';

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All Levels',
};

/**
 * Shopping cart (Udemy-style): rendered on the public /cart page for every signed-in role.
 * @param {string} browseHref - where "browse courses" buttons go (public catalogue).
 */
export default function CartView({ browseHref = '/#courses' }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, logout } = useAuthStore();
  // Any signed-in role can buy courses (Udemy-style); this page is only reachable when signed in.
  const canPurchase = Boolean(user);

  const {
    cart,
    isLoading,
    isClearing,
    isApplyingCoupon,
    isRemovingCoupon,
    couponError,
    couponSuccess,
    actionLoading,
    error,
    successMessage,
    fetchCart,
    removeFromCart,
    clearCart,
    enrollFreeCourse,
    applyCoupon,
    removeCoupon,
    resetCouponStatus,
    resetError,
    resetSuccess,
  } = useCartStore();

  const {
    step: checkoutStep,
    notice: checkoutNotice,
    startCheckout,
    resetCheckout,
  } = usePaymentStore();
  const checkoutBusy = ['creating', 'awaiting_payment', 'verifying', 'completing'].includes(checkoutStep);

  // After a successful order the cart is emptied on the server: refresh it.
  useEffect(() => {
    if (checkoutStep === 'success') fetchCart();
  }, [checkoutStep, fetchCart]);

  // Don't carry a finished/failed checkout over to the next visit.
  useEffect(() => () => resetCheckout(), [resetCheckout]);
  const [couponInput, setCouponInput] = useState('');
  const [selectedAvailableCoupon, setSelectedAvailableCoupon] = useState('');
  const [couponAutoApplied, setCouponAutoApplied] = useState(false);

  useEffect(() => {
    if (canPurchase) {
      fetchCart();
    }
  }, [canPurchase, fetchCart]);

  // Clean up notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => resetSuccess(), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, resetSuccess]);


  const items = cart?.items || [];
  const freeItems = cart?.freeItems || [];
  const paidItems = cart?.paidItems || [];
  const summary = cart?.summary || {
    subtotal: 0,
    discountTotal: 0,
    total: 0,
    paidSubtotal: 0,
    itemCount: 0,
    freeItemsCount: 0,
    paidItemsCount: 0,
    currency: 'INR',
    hasFreeCourses: false,
    hasPaidCourses: false,
    isPureFreeCart: false,
    availableCoupons: [],
  };

  const availableCoupons = cart?.availableCoupons || cart?.summary?.availableCoupons || [];
  const currency = summary.currency || 'INR';

  const formatPrice = (amount) => {
    return `${currency} ${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  const handleEnrollFree = async (courseId) => {
    const result = await enrollFreeCourse(courseId);
    if (result.success) {
      // Refresh cart to show updated state
      fetchCart();
    }
  };

  const handleRemove = async (courseId) => {
    await removeFromCart(courseId);
  };

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you want to remove all items from your cart?')) {
      await clearCart();
    }
  };

  // Auto-apply coupon from URL if present
  useEffect(() => {
    const codeFromUrl = searchParams?.get('coupon');
    if (codeFromUrl && !couponAutoApplied && canPurchase && !summary?.appliedCoupon && items.length > 0) {
      setCouponInput(codeFromUrl);
      setCouponAutoApplied(true);
      applyCoupon(codeFromUrl);
    }
  }, [searchParams, couponAutoApplied, canPurchase, summary?.appliedCoupon, items.length, applyCoupon]);

  const handleApplyCoupon = async (e) => {
    e?.preventDefault();
    const clean = couponInput.trim();
    if (!clean) return;
    await applyCoupon(clean);
  };

  const handleCheckout = () => {
    resetError();
    startCheckout({ total: Number(summary.total) || 0, user });
  };

  // Udemy-style: purchases always go to the signed-in account. To buy for another email, switch account.
  const handleSwitchAccount = async () => {
    try {
      await logout();
    } finally {
      router.push('/login?redirect=%2Fcart');
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setCouponInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-600">
            Shopping Cart
          </p>
          <h1 className="text-2xl font-bold text-slate-900">My Cart</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review your selected courses and proceed to enrollment.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm">
              {summary.itemCount} {summary.itemCount === 1 ? 'Course' : 'Courses'}
            </span>
            <button
              type="button"
              onClick={handleClearCart}
              disabled={isClearing}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {isClearing ? 'Clearing...' : 'Clear Cart'}
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={resetError}
            className="text-xs font-semibold uppercase tracking-wider hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={resetSuccess}
            className="text-xs font-semibold uppercase tracking-wider hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white p-6" />
        </div>
      ) : items.length === 0 ? (
        /* Empty Cart State */
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ShoppingCart size={36} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Your cart is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Looks like you haven&apos;t added any courses to your cart yet. Explore our
            extensive course catalogue to start learning new skills today.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => router.push(browseHref)}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              <BookOpen size={18} />
              Explore Course Catalogue
            </button>
          </div>
        </div>
      ) : (
        /* Populated Cart State */
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] items-start">
          {/* Left Column: Items Breakdown */}
          <div className="space-y-8">
            {/* Free Courses Group */}
            {freeItems.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                      {freeItems.length}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Free Courses
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    Direct Free Enrollment · 0 Payment
                  </span>
                </div>

                <div className="space-y-3">
                  {freeItems.map((item) => {
                    const isEnrolling = actionLoading[item.courseId] === 'enrolling';
                    const isRemoving = actionLoading[item.courseId] === 'removing';

                    return (
                      <article
                        key={item.cartItemId || item.courseId}
                        className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 transition hover:shadow-md sm:flex-row sm:items-center"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-36">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-emerald-100 text-emerald-700">
                              <BookOpen size={28} />
                            </div>
                          )}
                          <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                            Free
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-700">
                              {LEVEL_LABELS[item.level] || 'All Levels'}
                            </span>
                          </div>
                          <h3
                            onClick={() => router.push(`/courses/${item.slug || item.courseId}`)}
                            className="cursor-pointer truncate text-base font-bold text-slate-900 hover:text-teal-600 transition"
                          >
                            {item.title}
                          </h3>
                          {item.instructorName && (
                            <p className="text-xs text-slate-500">
                              By {item.instructorName}
                            </p>
                          )}
                          <p className="text-xs font-medium text-emerald-700">
                            Free course · Instant enrollment available
                          </p>
                        </div>

                        {/* Price & Actions */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center">
                          <span className="text-lg font-bold text-emerald-600">
                            FREE
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEnrollFree(item.courseId)}
                              disabled={isEnrolling || isRemoving}
                              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isEnrolling ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin" />
                                  Enrolling...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={14} />
                                  Enroll Free
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemove(item.courseId)}
                              disabled={isEnrolling || isRemoving}
                              title="Remove from cart"
                              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Paid Courses Group */}
            {paidItems.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {paidItems.length}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      Paid Courses
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    Lifetime access & certificate included
                  </span>
                </div>

                <div className="space-y-3">
                  {paidItems.map((item) => {
                    const isRemoving = actionLoading[item.courseId] === 'removing';
                    const hasDiscount =
                      item.discountPrice !== null &&
                      Number(item.discountPrice) < Number(item.regularPrice);

                    return (
                      <article
                        key={item.cartItemId || item.courseId}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md sm:flex-row sm:items-center"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-36">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                              <BookOpen size={28} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-teal-600">
                              {LEVEL_LABELS[item.level] || 'All Levels'}
                            </span>
                            {item.priceChanged && (
                              <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                                Price updated
                              </span>
                            )}
                          </div>

                          <h3
                            onClick={() => router.push(`/courses/${item.slug || item.courseId}`)}
                            className="cursor-pointer truncate text-base font-bold text-slate-900 hover:text-teal-600 transition"
                          >
                            {item.title}
                          </h3>

                          {item.instructorName && (
                            <p className="text-xs text-slate-500">
                              By {item.instructorName}
                            </p>
                          )}

                          {item.priceChanged && (
                            <p className="text-xs text-amber-700">
                              Notice: Price adjusted from {formatPrice(item.priceAtAddition)} to {formatPrice(item.effectivePrice)}.
                            </p>
                          )}
                        </div>

                        {/* Price & Actions */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end sm:justify-center">
                          {(() => {
                            const isTargeted =
                              summary.appliedCoupon &&
                              (summary.appliedCoupon.scope === 'course'
                                ? summary.appliedCoupon.courseId === item.courseId
                                : summary.appliedCoupon.scope === 'platform');

                            let couponSavingsForItem = 0;
                            if (isTargeted) {
                              if (summary.appliedCoupon.scope === 'course') {
                                couponSavingsForItem = Number(summary.appliedCoupon.discountAmount || 0);
                              } else if (summary.appliedCoupon.discountType === 'percentage') {
                                const raw = (item.effectivePrice * Number(summary.appliedCoupon.discountValue)) / 100;
                                couponSavingsForItem = Math.round(raw * 100) / 100;
                              }
                            }

                            const discountedPrice = Math.max(0, item.effectivePrice - couponSavingsForItem);

                            return (
                              <div className="text-right">
                                {couponSavingsForItem > 0 ? (
                                  <div>
                                    <div className="text-xl font-black text-emerald-600">
                                      {formatPrice(discountedPrice)}
                                    </div>
                                    <div className="flex items-center gap-1.5 justify-end text-xs mt-0.5">
                                      <del className="text-slate-400 font-medium">
                                        {formatPrice(item.effectivePrice)}
                                      </del>
                                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px]">
                                        {summary.appliedCoupon.code} (-{formatPrice(couponSavingsForItem)})
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-lg font-bold text-slate-900">
                                      {formatPrice(item.effectivePrice)}
                                    </div>
                                    {hasDiscount && (
                                      <div className="flex items-center gap-1.5 justify-end text-xs">
                                        <del className="text-slate-400">
                                          {formatPrice(item.regularPrice)}
                                        </del>
                                        <span className="font-semibold text-emerald-600">
                                          Save {formatPrice(item.regularPrice - item.effectivePrice)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => handleRemove(item.courseId)}
                            disabled={isRemoving}
                            title="Remove from cart"
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            {isRemoving ? (
                              <RefreshCw size={16} className="animate-spin text-red-500" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Summary Card */}
          <aside className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Order Summary
            </h2>

            {/* Price Calculations */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Items</span>
                <span className="font-semibold text-slate-900">
                  {summary.itemCount} {summary.itemCount === 1 ? 'course' : 'courses'}
                </span>
              </div>

              {summary.paidItemsCount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Paid Courses ({summary.paidItemsCount})</span>
                  <span>{formatPrice(summary.subtotal)}</span>
                </div>
              )}

              {summary.freeItemsCount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Free Courses ({summary.freeItemsCount})</span>
                  <span className="font-semibold uppercase">Free</span>
                </div>
              )}

              {(() => {
                const catalogDiscount = Math.max(0, Number(summary.subtotal || 0) - Number(summary.paidSubtotal || 0));
                return (
                  <>
                    {catalogDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Course Sale Discount</span>
                        <span>- {formatPrice(catalogDiscount)}</span>
                      </div>
                    )}
                    {summary.couponDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Coupon Savings ({summary.appliedCoupon?.code || 'Coupon'})</span>
                        <span>- {formatPrice(summary.couponDiscount)}</span>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-base font-bold text-slate-900">Total Payable</span>
                  <p className="text-[11px] text-slate-400">Includes all taxes</p>
                </div>
                <span className="text-2xl font-black text-slate-900">
                  {summary.total === 0 ? 'FREE' : formatPrice(summary.total)}
                </span>
              </div>
            </div>

            {/* Promotional Coupon Section */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Tag size={14} className="text-teal-600" />
                  Promotional Coupon
                </div>
                {availableCoupons.length > 0 && !summary.appliedCoupon && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-200">
                    <Sparkles size={11} className="text-amber-500" />
                    {availableCoupons.length} {availableCoupons.length === 1 ? 'offer available' : 'offers available'}
                  </span>
                )}
              </div>

              {summary.appliedCoupon ? (
                /* Applied State: Clean Emerald Card */
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold tracking-wider text-emerald-900 bg-emerald-200/80 px-2.5 py-1 rounded-md border border-emerald-300">
                        {summary.appliedCoupon.code}
                      </span>
                      <span className="text-xs font-bold text-emerald-800">
                        {summary.appliedCoupon.discountType === 'percentage'
                          ? `${summary.appliedCoupon.discountValue}% OFF`
                          : `₹${summary.appliedCoupon.discountValue} OFF`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      disabled={isRemovingCoupon}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 transition"
                    >
                      {isRemovingCoupon ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                      Remove
                    </button>
                  </div>

                  {summary.appliedCoupon.courseTitle && (
                    <p className="text-[11px] text-emerald-800">
                      🎯 Applied to: <strong>{summary.appliedCoupon.courseTitle}</strong>
                    </p>
                  )}

                  <div className="flex justify-between items-center text-xs text-emerald-950 font-semibold pt-2 border-t border-emerald-200/80">
                    <span>Coupon Savings</span>
                    <span className="text-sm font-bold text-emerald-700">
                      - {formatPrice(summary.appliedCoupon.discountAmount)}
                    </span>
                  </div>

                  {/* Switch offer if other coupons exist */}
                  {availableCoupons.filter((c) => c.code !== summary.appliedCoupon.code).length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center gap-2">
                      <span className="text-[11px] text-emerald-800 font-medium whitespace-nowrap">Switch offer:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            applyCoupon(e.target.value);
                          }
                        }}
                        className="flex-1 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="">-- Choose another offer --</option>
                        {availableCoupons
                          .filter((c) => c.code !== summary.appliedCoupon.code)
                          .map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} ({c.discountBadge})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                /* Unapplied State: Clean Dropdown + Single Unified Input & Apply */
                <div className="space-y-3">
                  {/* Dropdown for Available Coupons */}
                  {availableCoupons.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        Select an available coupon:
                      </label>
                      <select
                        value={selectedAvailableCoupon}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedAvailableCoupon(val);
                          setCouponInput(val);
                          resetCouponStatus();
                        }}
                        className="w-full rounded-xl border border-teal-300 bg-teal-50/40 px-3 py-2 text-xs font-medium text-slate-800 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 transition"
                      >
                        <option value="">-- Choose an available coupon --</option>
                        {availableCoupons.map((c) => (
                          <option key={c.code} value={c.code}>
                            🏷️ {c.code} • {c.discountBadge} {c.scope === 'course' && c.courseTitle ? `(on "${c.courseTitle}")` : '(Platform-wide)'} • Save {formatPrice(c.estimatedDiscount)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Unified Input and Apply Button */}
                  <form onSubmit={handleApplyCoupon} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={availableCoupons.length > 0 ? "Selected or custom coupon code..." : "ENTER COUPON CODE..."}
                        value={couponInput}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setCouponInput(val);
                          setSelectedAvailableCoupon(val);
                          resetCouponStatus();
                        }}
                        className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-mono font-bold uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm min-w-[85px] shrink-0"
                      >
                        {isApplyingCoupon ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Applying...</span>
                          </>
                        ) : (
                          <span>Apply</span>
                        )}
                      </button>
                    </div>

                    {/* Live savings preview if current input matches an available coupon */}
                    {couponInput.trim() && !isApplyingCoupon && (
                      (() => {
                        const match = availableCoupons.find(
                          (c) => c.code.toUpperCase() === couponInput.trim().toUpperCase()
                        );
                        if (match) {
                          return (
                            <div className="flex items-center justify-between text-[11px] text-teal-900 bg-teal-50 px-3 py-2 rounded-xl border border-teal-200">
                              <span className="flex items-center gap-1">
                                <Sparkles size={12} className="text-amber-500" />
                                <strong>{match.code}</strong>: {match.discountBadge}{' '}
                                {match.scope === 'course' && match.courseTitle
                                  ? `on "${match.courseTitle}"`
                                  : 'platform-wide'}
                              </span>
                              <span className="font-bold text-emerald-700 whitespace-nowrap">
                                Save {formatPrice(match.estimatedDiscount)}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()
                    )}

                    {couponError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>{couponError}</span>
                      </div>
                    )}

                    {couponSuccess && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>{couponSuccess}</span>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* Mixed Cart Notice */}
            {summary.hasFreeCourses && summary.hasPaidCourses && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs text-teal-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-teal-600" />
                  Mixed Cart Detected
                </p>
                <p>
                  Free courses do not require payment. You can click <b>Enroll Free</b> on any free course above to get instant access immediately.
                </p>
              </div>
            )}

            {/* Pure Free Cart Banner */}
            {summary.isPureFreeCart && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  All Items are Free!
                </p>
                <p>
                  No payment is required. Click &quot;Enroll Free&quot; on your courses to start learning right away!
                </p>
              </div>
            )}

            {/* Checkout Action Button */}
            <div className="space-y-3 pt-2">
              {summary.paidItemsCount > 0 ? (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkoutBusy || summary.currencyMismatch}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutBusy ? 'Processing...' : summary.total === 0 ? 'Complete Enrollment' : 'Proceed to Checkout'}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(browseHref)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-600 bg-teal-50 px-5 py-3.5 text-sm font-bold text-teal-700 transition hover:bg-teal-100"
                >
                  Continue Browsing Courses
                </button>
              )}

              {user?.email && (
                <p className="text-center text-xs text-slate-500">
                  Buying as <span className="font-semibold text-slate-700">{user.email}</span>
                  {' · '}
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    disabled={checkoutBusy}
                    className="font-semibold text-teal-700 hover:underline disabled:opacity-50"
                  >
                    Not you? Switch account
                  </button>
                </p>
              )}
              {checkoutNotice && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-600">{checkoutNotice}</p>
              )}
            </div>
          </aside>
        </div>
      )}

      <CheckoutStatusModal
        myLearningHref="/my-learning"
        browseHref={browseHref}
        onRetry={handleCheckout}
      />
    </div>
  );
}


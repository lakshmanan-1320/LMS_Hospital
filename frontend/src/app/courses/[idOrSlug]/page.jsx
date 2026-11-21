'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { courseService } from '@/modules/courses/services/course.service';
import { couponService } from '@/modules/coupons/services/coupon.service';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useModuleAccess, usePublicModule } from '@/stores/usePlatformConfigStore';
import { useCartStore } from '@/stores/useCartStore';
import { useMyEnrollmentsStore } from '@/stores/useMyEnrollmentsStore';
import { useCourseLandingStore } from '@/modules/courses/stores/useCourseLandingStore';
import { addRecentlyViewed } from '@/modules/courses/utils/recentlyViewed';
import PublicSiteHeader from '@/components/layout/PublicSiteHeader';
import { getDashboardRoute } from '@/constants/roles';
import CourseHero from '@/modules/courses/components/landing/CourseHero';
import PurchaseCard from '@/modules/courses/components/landing/PurchaseCard';
import PreviewModal from '@/modules/courses/components/landing/PreviewModal';
import WhatYoullLearn from '@/modules/courses/components/landing/WhatYoullLearn';
import CourseIncludes from '@/modules/courses/components/landing/CourseIncludes';
import CourseContent from '@/modules/courses/components/landing/CourseContent';
import CourseDetailsText from '@/modules/courses/components/landing/CourseDetailsText';
import InstructorCard from '@/modules/courses/components/landing/InstructorCard';
import StickyCourseBar from '@/modules/courses/components/landing/StickyCourseBar';
import CourseCarousel from '@/modules/courses/components/CourseCarousel';
import CourseReviewsSection from '@/modules/reviews/components/CourseReviewsSection';

/**
 * Public course landing page (Udemy-style): header band, sticky purchase card, what you'll
 * learn, includes, course content with free previews, requirements, description, instructor,
 * reviews and related courses. Sections follow Module Management (reviews, refunds, sales).
 */
export default function CourseLandingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const idOrSlug = params.idOrSlug;

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  const { landing, related, isLoading, error: loadError, fetchLanding, fetchRelated, reset } = useCourseLandingStore();
  const { actionLoading, addToCart, isInCart, enrollFreeCourse, fetchCart } = useCartStore();

  const markEnrolled = useMyEnrollmentsStore((s) => s.markEnrolled);
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';
  const reviewsOn = usePublicModule('reviews_ratings');

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [ownerByServer, setOwnerByServer] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [actionError, setActionError] = useState('');
  const [validatedCoupon, setValidatedCoupon] = useState(null);
  const [preview, setPreview] = useState({ open: false, id: undefined });
  const [heroOut, setHeroOut] = useState(false);
  const heroRef = useRef(null);
  const lastLoadedSlugRef = useRef(null);
  const checkedEnrollmentRef = useRef(null);
  // Enrollment status is known for the signed-in visitor (gates the post-login enroll/cart action)
  const [statusKnown, setStatusKnown] = useState(false);
  // The ?enroll=1 / ?cart=1 action from before login runs once
  const enrollmentChecked = useRef(false);
  const cartChecked = useRef(false);

  const course = landing?.course;
  // Udemy-style: the course's own instructor can't buy it, but can open and manage it.
  // The enrollment-status API is the source of truth; the instructor match covers the moment before it answers.
  const isOwner = Boolean(
    isAuthenticated && (ownerByServer || (user?.userId && landing?.instructor?.userId === user.userId)),
  );

  useEffect(() => {
    if (!idOrSlug) return undefined;
    if (lastLoadedSlugRef.current === idOrSlug) return undefined;
    lastLoadedSlugRef.current = idOrSlug;
    fetchLanding(idOrSlug);
    fetchRelated(idOrSlug);
    return () => {
      lastLoadedSlugRef.current = null;
      reset();
    };
  }, [idOrSlug, fetchLanding, fetchRelated, reset]);

  useEffect(() => {
    if (course) addRecentlyViewed(course);
  }, [course]);

  // Enrollment status for signed-in visitors (only runs once per course ID)
  useEffect(() => {
    const courseId = course?.courseId;
    if (!courseId || authLoading) return;
    if (!isAuthenticated) {
      setIsEnrolled(false);
      setOwnerByServer(false);
      setStatusKnown(false);
      checkedEnrollmentRef.current = null;
      return;
    }
    if (checkedEnrollmentRef.current === courseId) return;
    checkedEnrollmentRef.current = courseId;
    setStatusKnown(false);
    courseService
      .getEnrollmentStatus(courseId)
      .then((status) => {
        setIsEnrolled(Boolean(status?.isEnrolled ?? status?.enrollment?.isEnrolled));
        setOwnerByServer(Boolean(status?.isOwner));
      })
      .catch(() => setIsEnrolled(false))
      .finally(() => setStatusKnown(true));
  }, [course?.courseId, isAuthenticated, authLoading]);

  // Promotional coupon from the URL (?coupon=CODE)
  useEffect(() => {
    const code = searchParams?.get('coupon');
    if (!code || !course || course.isFree) return undefined;
    let alive = true;
    couponService
      .validateCoupon({ code, cartAmount: Number(course.price || 0), courseId: course.courseId })
      .then((res) => {
        const data = res?.data || res;
        if (!alive || !data?.valid) return;
        const discountAmount = Number(data.discountAmount || 0);
        setValidatedCoupon({
          code: code.trim().toUpperCase(),
          discountAmount,
          discountedPrice: Math.max(0, Number(course.price || 0) - discountAmount),
          discountText:
            data.coupon?.discount_type === 'percentage' ? `${data.coupon.discount_value}% OFF` : `₹${data.coupon?.discount_value} OFF`,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [searchParams, course]);

  // Sticky bar once the header band scrolls away
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(([entry]) => setHeroOut(!entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [course]);

  const loginRedirect = (action) => {
    const coupon = validatedCoupon?.code || searchParams?.get('coupon');
    const back = `/courses/${course.slug || course.courseId}?${action}=1${coupon ? `&coupon=${encodeURIComponent(coupon)}` : ''}`;
    router.push(`/login?redirect=${encodeURIComponent(back)}`);
  };

  const handleEnroll = async () => {
    if (!course?.isFree || enrolling) return;
    if (!isAuthenticated) return loginRedirect('enroll');
    setEnrolling(true);
    setActionError('');
    const res = await enrollFreeCourse(course.courseId);
    setEnrolling(false);
    if (res?.success) {
      setIsEnrolled(true);
      markEnrolled(course.courseId);
    } else setActionError(res?.error || 'Enrollment failed.');
  };

  const handleAddToCart = async ({ thenCheckout = false } = {}) => {
    if (!isAuthenticated) return loginRedirect('cart');
    setActionError('');
    const coupon = validatedCoupon?.code || searchParams?.get('coupon');
    if (!isInCart(course.courseId)) {
      const res = await addToCart(course.courseId);
      if (!res?.success) return setActionError(res?.error || 'Failed to add course to cart.');
    }
    if (thenCheckout || coupon) router.push(coupon ? `/cart?coupon=${encodeURIComponent(coupon)}` : '/cart');
  };

  // Finish enroll / add-to-cart after returning from login
  useEffect(() => {
    // Wait until we know whether the visitor is already enrolled, so we never enroll twice.
    if (authLoading || !isAuthenticated || !course || !statusKnown || typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('enroll') === '1' && !enrollmentChecked.current) {
      enrollmentChecked.current = true;
      if (course.isFree && !isEnrolled && !isOwner) handleEnroll();
      qs.delete('enroll');
    }
    if (qs.get('cart') === '1' && !cartChecked.current) {
      cartChecked.current = true;
      if (!course.isFree && !isEnrolled && !isOwner && !isInCart(course.courseId)) handleAddToCart();
      qs.delete('cart');
    }
    const query = qs.toString();
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, course, isEnrolled, statusKnown, isOwner]);

  if (isLoading || (!landing && !loadError)) {
    return (
      <div className="min-h-screen bg-white">
        <PublicSiteHeader />
        <div className="h-72 animate-pulse bg-slate-900" />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
          <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="h-40 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="min-h-screen bg-white">
        <PublicSiteHeader />
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Course not found</h1>
          <p className="mt-2 text-sm text-slate-500">{loadError || 'This course is not available.'}</p>
          <Link href="/#courses" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Browse courses
          </Link>
        </div>
      </div>
    );
  }

  const previews = landing.curriculum.sections.flatMap((s) => s.lessons).filter((l) => l.previewAvailable);
  const canPreview = Boolean(landing.promoVideo?.url) || previews.length > 0;
  const openPreview = (id) => setPreview({ open: true, id });

  const purchaseProps = {
    course,
    canPreview,
    onPreview: () => openPreview(undefined),
    refundGuarantee: landing.refundGuarantee,
    isEnrolled,
    isOwner,
    manageHref: isOwner ? `${getDashboardRoute(user)}/courses/${course.courseId}` : null,
    inCart: isInCart(course.courseId),
    salesOpen,
    busy: actionLoading?.[course.courseId],
    enrolling,
    validatedCoupon,
    onAddToCart: () => handleAddToCart(),
    onBuyNow: () => handleAddToCart({ thenCheckout: true }),
    onEnroll: handleEnroll,
  };

  const scrollToReviews = () => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicSiteHeader />
      <StickyCourseBar course={course} visible={heroOut} />

      <div className="relative">
        {/* Header band */}
        <div ref={heroRef} className="bg-slate-900">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div className="lg:pr-[380px]">
              <CourseHero course={course} breadcrumb={landing.breadcrumb} instructor={landing.instructor} onRatingsClick={scrollToReviews} />
            </div>
          </div>
        </div>

        {/* Purchase card inline on small screens */}
        <div className="mx-auto max-w-xl px-4 pt-6 lg:hidden">
          <PurchaseCard {...purchaseProps} />
        </div>

        {/* Main content */}
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="space-y-10 lg:pr-[380px]">
            {actionError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p>}
            <WhatYoullLearn outcomes={course.learningOutcomes} />
            <CourseIncludes includes={landing.includes} />
            <CourseContent curriculum={landing.curriculum} onPreview={openPreview} />
            <CourseDetailsText requirements={course.requirements} description={course.description} targetAudience={course.targetAudience} />
            <InstructorCard instructor={landing.instructor} />
            {reviewsOn && (
              <CourseReviewsSection
                courseIdOrSlug={course.slug || course.courseId}
                courseTitle={course.title}
                isEnrolled={isEnrolled}
                isAuthenticated={isAuthenticated}
              />
            )}
          </div>
        </main>

        {/* Sticky purchase card on large screens (overlaps the header band) */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="mx-auto h-full max-w-6xl px-6">
            <div className="relative h-full">
              <div className="pointer-events-auto absolute right-0 top-8 h-[calc(100%-4rem)] w-[340px]">
                <div className="sticky top-28">
                  <PurchaseCard {...purchaseProps} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-slate-100 bg-slate-50/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <CourseCarousel title="More courses like this" courses={related} />
          </div>
        </section>
      )}

      <PreviewModal
        open={preview.open}
        initialId={preview.id}
        onClose={() => setPreview({ open: false, id: undefined })}
        courseTitle={course.title}
        promoVideo={landing.promoVideo}
        previews={previews}
      />
    </div>
  );
}

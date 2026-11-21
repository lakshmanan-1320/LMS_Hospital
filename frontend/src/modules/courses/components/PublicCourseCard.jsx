'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, Loader2, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/app/login/stores/useAuthStore';
import { useCartStore } from '@/stores/useCartStore';
import { useModuleAccess } from '@/stores/usePlatformConfigStore';
import { useMyEnrollmentsStore } from '@/stores/useMyEnrollmentsStore';
import CourseBadge from './CourseBadge';
import { priceInfo, formatMoney, formatCount, courseHref, backendUrl } from '../utils/courseFormat';

/**
 * Public course card (catalog rows, related courses): thumbnail, title, instructor, badge,
 * rating, price and an Add to cart / Go to cart / Enroll action. Purchasing follows
 * Cart & Checkout in Module Management; guests are sent to sign in first.
 */
export default function PublicCourseCard({ course }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);
  const ensureEnrollmentsLoaded = useMyEnrollmentsStore((s) => s.ensureLoaded);
  const markEnrolled = useMyEnrollmentsStore((s) => s.markEnrolled);
  const alreadyEnrolled = useMyEnrollmentsStore((s) => s.loadedForUserId === userId && s.courseIds.has(course.courseId));
  const { isInCart, addToCart, enrollFreeCourse, actionLoading } = useCartStore();
  const salesOpen = useModuleAccess('cart_checkout') !== 'none';
  const [error, setError] = useState('');
  const [justEnrolled, setJustEnrolled] = useState(false);
  const enrolled = isAuthenticated && (justEnrolled || alreadyEnrolled);
  // Udemy-style: instructors can't buy their own course; they open it instead.
  const isOwner = Boolean(isAuthenticated && userId && course.instructorId === userId);

  // Load the signed-in user's enrollments once (shared by every card on the page).
  useEffect(() => {
    if (isAuthenticated && userId) ensureEnrollmentsLoaded(userId);
  }, [isAuthenticated, userId, ensureEnrollmentsLoaded]);

  const href = courseHref(course);
  const price = priceInfo(course);
  const badge = course.badges?.[0];
  const busy = actionLoading?.[course.courseId];
  const inCart = isInCart(course.courseId);

  const requireLogin = (action) => {
    router.push(`/login?redirect=${encodeURIComponent(`${href}?${action}=1`)}`);
  };

  const onAddToCart = async () => {
    setError('');
    if (!isAuthenticated) return requireLogin('cart');
    const res = await addToCart(course.courseId);
    if (!res?.success) setError(res?.error || 'Could not add to cart.');
  };

  const onEnroll = async () => {
    setError('');
    if (!isAuthenticated) return requireLogin('enroll');
    const res = await enrollFreeCourse(course.courseId);
    if (res?.success) {
      setJustEnrolled(true);
      markEnrolled(course.courseId);
    }
    else setError(res?.error || 'Could not enroll.');
  };

  const actionClass =
    'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-violet-600 px-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60';

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 transition hover:shadow-md">
      <Link href={href} className="block overflow-hidden rounded-xl bg-slate-100" aria-label={course.title}>
        <div className="aspect-video w-full">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backendUrl(course.thumbnailUrl)} alt="" className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-100 to-teal-50 text-violet-400">
              <BookOpen size={36} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <Link href={href} className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 hover:text-violet-700">
          {course.title}
        </Link>
        {course.instructorName && <p className="mt-1 truncate text-xs text-slate-500">{course.instructorName}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {badge && <CourseBadge badge={badge} />}
          {course.totalReviewsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
              <Star size={11} className="fill-amber-500 text-amber-500" /> {Number(course.averageRating || 0).toFixed(1)}
            </span>
          )}
        </div>
        {course.totalReviewsCount > 0 && (
          <p className="mt-1.5 w-fit rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500">
            {formatCount(course.totalReviewsCount)} rating{course.totalReviewsCount === 1 ? '' : 's'}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="leading-tight">
            <p className="text-base font-bold text-slate-900">{price.isFree ? 'Free' : formatMoney(price.current, course.currency)}</p>
            {price.original !== null && (
              <p className="text-xs text-slate-400 line-through">{formatMoney(price.original, course.currency)}</p>
            )}
          </div>

          {isOwner && !enrolled ? (
            <Link href={`/my-learning/${course.courseId}`} className={actionClass} title="You created this course">
              Go to course
            </Link>
          ) : enrolled ? (
            <Link href={`/my-learning/${course.courseId}`} className={actionClass}>
              Start learning
            </Link>
          ) : !salesOpen ? (
            <span className="text-xs font-semibold text-slate-400">Enrollment paused</span>
          ) : price.isFree ? (
            <button type="button" onClick={onEnroll} disabled={busy === 'enrolling'} className={actionClass}>
              {busy === 'enrolling' && <Loader2 size={14} className="animate-spin" />} Enroll free
            </button>
          ) : inCart ? (
            <Link href="/cart" className={actionClass}>
              Go to cart
            </Link>
          ) : (
            <button type="button" onClick={onAddToCart} disabled={busy === 'adding'} className={actionClass}>
              {busy === 'adding' && <Loader2 size={14} className="animate-spin" />} Add to cart
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </div>
    </article>
  );
}

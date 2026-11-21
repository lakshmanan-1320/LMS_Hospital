'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play, Share2, ShieldCheck, Tag, Loader2, Check, BookOpen } from 'lucide-react';
import { priceInfo, formatMoney, backendUrl } from '../../utils/courseFormat';

/**
 * Purchase card: preview, price, % off, Add to cart / Buy now / Enroll, guarantee, share.
 * The parent page owns purchase state and actions; this component only renders them.
 */
export default function PurchaseCard({
  course,
  canPreview,
  onPreview,
  refundGuarantee,
  isEnrolled,
  isOwner,
  manageHref,
  inCart,
  salesOpen,
  busy,
  enrolling,
  validatedCoupon,
  onAddToCart,
  onBuyNow,
  onEnroll,
}) {
  const [copied, setCopied] = useState(false);
  const price = priceInfo(course);
  const current = validatedCoupon ? validatedCoupon.discountedPrice : price.current;
  const original = validatedCoupon ? Number(course.price || 0) : price.original;
  const percentOff = original ? Math.round(((original - current) / original) * 100) : 0;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split('?')[0]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: nothing to do
    }
  };

  const primary =
    'flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-violet-600 text-base font-bold text-white transition hover:bg-violet-700 disabled:opacity-60';
  const secondary =
    'flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-900 text-base font-bold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <button
        type="button"
        onClick={canPreview ? onPreview : undefined}
        disabled={!canPreview}
        className="group relative block aspect-video w-full overflow-hidden bg-slate-800"
        aria-label={canPreview ? 'Preview this course' : course.title}
      >
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backendUrl(course.thumbnailUrl)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-200 to-teal-100 text-violet-500">
            <BookOpen size={44} />
          </div>
        )}
        {canPreview && (
          <span className="absolute inset-0 flex flex-col items-center justify-center bg-linear-to-t from-black/70 via-black/20 to-transparent">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition group-hover:scale-105">
              <Play size={28} className="ml-1 fill-slate-900" />
            </span>
            <span className="absolute bottom-4 text-base font-bold text-white">Preview this course</span>
          </span>
        )}
      </button>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-bold text-slate-900">{price.isFree ? 'Free' : formatMoney(current, course.currency)}</span>
          {!price.isFree && original ? (
            <>
              <span className="text-base text-slate-400 line-through">{formatMoney(original, course.currency)}</span>
              {percentOff > 0 && <span className="text-base text-slate-700">{percentOff}% off</span>}
            </>
          ) : null}
        </div>

        {validatedCoupon && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <Tag size={12} /> {validatedCoupon.code} applied · {validatedCoupon.discountText}
          </p>
        )}

        <div className="space-y-2">
          {isOwner && !isEnrolled ? (
            <>
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-center text-xs font-semibold text-violet-800">
                You created this course
              </p>
              <Link href={`/my-learning/${course.courseId}`} className={primary}>
                Go to course
              </Link>
              {manageHref && (
                <Link href={manageHref} className={secondary}>
                  Edit course
                </Link>
              )}
            </>
          ) : isEnrolled ? (
            <Link href={`/my-learning/${course.courseId}`} className={primary}>
              Go to course
            </Link>
          ) : !salesOpen ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-500">
              Enrollment is temporarily paused
            </p>
          ) : price.isFree ? (
            <button type="button" onClick={onEnroll} disabled={enrolling} className={primary}>
              {enrolling && <Loader2 size={18} className="animate-spin" />} Enroll now
            </button>
          ) : inCart ? (
            <>
              <Link href="/cart" className={primary}>
                Go to cart
              </Link>
              <button type="button" onClick={onBuyNow} className={secondary}>
                Buy now
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onAddToCart} disabled={busy === 'adding'} className={primary}>
                {busy === 'adding' && <Loader2 size={18} className="animate-spin" />} Add to cart
              </button>
              <button type="button" onClick={onBuyNow} disabled={busy === 'adding'} className={secondary}>
                Buy now
              </button>
            </>
          )}
        </div>

        {refundGuarantee && !isEnrolled && !isOwner && !price.isFree && (
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-600">
            <ShieldCheck size={14} /> {refundGuarantee.days}-Day Money-Back Guarantee
          </p>
        )}

        <div className="flex justify-center border-t border-slate-100 pt-3">
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 hover:bg-slate-50">
            {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />} {copied ? 'Link copied' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

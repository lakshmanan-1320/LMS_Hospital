'use client';

import React, { useEffect, useState } from 'react';
import { Star, X, Loader2, MessageSquarePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReviewStore } from '../stores/useReviewStore';
import CourseRatingSummary from './CourseRatingSummary';
import ReviewCard from './ReviewCard';
import StudentReviewModal from './StudentReviewModal';

const PREVIEW_COUNT = 4;

/** 52000 -> "52K" (heading style). */
const compactCount = (n) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

const SORTS = [
  { value: 'newest', label: 'Most recent' },
  { value: 'highest_rating', label: 'Highest rated' },
  { value: 'lowest_rating', label: 'Lowest rated' },
  { value: 'oldest', label: 'Oldest' },
];

/**
 * Course page reviews: "★ 4.7 course rating • 52K ratings", the latest reviews in two columns,
 * "Show all reviews" (breakdown filter, sort, pages), and write / edit for enrolled learners.
 */
export default function CourseReviewsSection({ courseIdOrSlug, courseTitle = '', isEnrolled = false, isAuthenticated = false }) {
  const {
    summary,
    reviews,
    pagination,
    myReview,
    ratingFilter,
    sortBy,
    isLoading,
    isSubmitting,
    actionError,
    setRatingFilter,
    setSortBy,
    clearActionError,
    fetchCourseSummary,
    fetchCourseReviews,
    fetchMyReview,
    submitReview,
    updateOwnReview,
    deleteOwnReview,
  } = useReviewStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 1. Public course review summary & reviews list (only re-fetches when courseIdOrSlug changes)
  useEffect(() => {
    if (!courseIdOrSlug) return;
    fetchCourseSummary(courseIdOrSlug);
    setRatingFilter(null);
    setSortBy('newest');
    fetchCourseReviews(courseIdOrSlug, { page: 1, sortBy: 'newest', rating: undefined });
  }, [courseIdOrSlug, fetchCourseSummary, fetchCourseReviews, setRatingFilter, setSortBy]);

  // 2. Student's own review (only re-fetches when enrollment or auth status changes)
  useEffect(() => {
    if (!courseIdOrSlug) return;
    if (isAuthenticated && isEnrolled) {
      fetchMyReview(courseIdOrSlug);
    } else {
      useReviewStore.setState({ myReview: null });
    }
  }, [courseIdOrSlug, isAuthenticated, isEnrolled, fetchMyReview]);

  useEffect(() => {
    if (!allOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeAll();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOpen]);

  const flash = (text) => {
    setSuccessMessage(text);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleModalSubmit = async (payload) => {
    clearActionError();
    const res = myReview ? await updateOwnReview(myReview.reviewId, courseIdOrSlug, payload) : await submitReview(courseIdOrSlug, payload);
    if (res.success) {
      setIsModalOpen(false);
      flash(myReview ? 'Your review has been updated.' : 'Thank you for sharing your review!');
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    clearActionError();
    const res = await deleteOwnReview(myReview.reviewId, courseIdOrSlug);
    if (res.success) {
      setIsModalOpen(false);
      flash('Your review has been removed.');
    }
  };

  const closeAll = () => {
    setAllOpen(false);
    loadFirstPage();
  };

  const filterBy = (star) => {
    setRatingFilter(star);
    fetchCourseReviews(courseIdOrSlug, { page: 1, rating: star ?? undefined });
  };
  const sortReviews = (value) => {
    setSortBy(value);
    fetchCourseReviews(courseIdOrSlug, { page: 1, sortBy: value });
  };

  const total = summary?.totalReviews || 0;
  const average = Number(summary?.averageRating || 0).toFixed(1);
  const preview = reviews.slice(0, PREVIEW_COUNT);
  const canReview = isAuthenticated && isEnrolled;

  const heading = (
    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
      <Star size={22} className="fill-amber-500 text-amber-500" />
      {total > 0 ? (
        <>
          {average} course rating <span className="text-slate-400">•</span> {compactCount(total)} rating{total === 1 ? '' : 's'}
        </>
      ) : (
        'Reviews'
      )}
    </h2>
  );

  return (
    <section id="reviews" className="scroll-mt-40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {heading}
        {canReview && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-900 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50"
          >
            <MessageSquarePlus size={16} /> {myReview ? 'Edit your review' : 'Write a review'}
          </button>
        )}
      </div>

      {successMessage && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{successMessage}</p>
      )}

      {total === 0 && !isLoading ? (
        <p className="mt-4 text-sm text-slate-500">
          No reviews yet.{canReview ? ' Be the first to share what you think.' : ''}
        </p>
      ) : (
        <>
          <div className="mt-2 grid gap-x-10 md:grid-cols-2">
            {preview.map((r) => (
              <ReviewCard
                key={r.reviewId}
                review={r}
                isOwnReview={r.isOwnReview || myReview?.reviewId === r.reviewId}
                onEdit={() => setIsModalOpen(true)}
              />
            ))}
          </div>
          {total > PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setAllOpen(true)}
              className="mt-4 rounded-lg border border-slate-900 px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              Show all reviews
            </button>
          )}
        </>
      )}

      {/* All reviews */}
      {allOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="All reviews">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              {heading}
              <button type="button" onClick={closeAll} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close reviews">
                <X size={22} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto p-6 md:grid-cols-[260px_1fr]">
              <div className="space-y-4 md:sticky md:top-0 md:self-start">
                <CourseRatingSummary summary={summary} activeStarFilter={ratingFilter} onSelectStarFilter={filterBy} />
                <label className="block text-sm font-semibold text-slate-700">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(e) => sortReviews(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                {isLoading && (
                  <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" /> Loading reviews…
                  </p>
                )}
                {!isLoading && reviews.length === 0 && <p className="py-6 text-sm text-slate-500">No reviews match this filter.</p>}
                {!isLoading &&
                  reviews.map((r, i) => (
                    <ReviewCard key={r.reviewId} review={r} divider={i > 0} isOwnReview={r.isOwnReview || myReview?.reviewId === r.reviewId} />
                  ))}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
                    <button
                      type="button"
                      disabled={pagination.page <= 1 || isLoading}
                      onClick={() => fetchCourseReviews(courseIdOrSlug, { page: pagination.page - 1 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <span className="text-slate-600">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages || isLoading}
                      onClick={() => fetchCourseReviews(courseIdOrSlug, { page: pagination.page + 1 })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <StudentReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        existingReview={myReview}
        courseTitle={courseTitle}
        onSubmit={handleModalSubmit}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        error={actionError}
      />
    </section>
  );
}

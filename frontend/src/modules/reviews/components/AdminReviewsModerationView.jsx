'use client';

import React, { useEffect, useState } from 'react';
import {
  Star,
  ShieldAlert,
  EyeOff,
  Eye,
  Trash2,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useReviewStore } from '../stores/useReviewStore';

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function AdminReviewsModerationView() {
  const {
    adminReviews,
    adminPagination,
    adminStatusFilter,
    adminSearch,
    isLoading,
    isModerating,
    actionError,
    setAdminStatusFilter,
    setAdminSearch,
    fetchAdminReviews,
    moderateReview,
    adminDeleteReview,
    clearActionError,
  } = useReviewStore();

  const [modalMode, setModalMode] = useState(null); // 'hide' | 'delete'
  const [targetReview, setTargetReview] = useState(null);
  const [moderationReason, setModerationReason] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchAdminReviews({ page: 1 });
  }, [fetchAdminReviews]);

  const handleStatusFilterChange = (status) => {
    setAdminStatusFilter(status);
    fetchAdminReviews({ page: 1, status });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAdminReviews({ page: 1 });
  };

  const handlePageChange = (page) => {
    fetchAdminReviews({ page });
  };

  const handleOpenHideModal = (review) => {
    clearActionError();
    setTargetReview(review);
    setModerationReason('');
    setModalMode('hide');
  };

  const handleOpenDeleteModal = (review) => {
    clearActionError();
    setTargetReview(review);
    setModalMode('delete');
  };

  const handleCloseModal = () => {
    setModalMode(null);
    setTargetReview(null);
    setModerationReason('');
    clearActionError();
  };

  const handleConfirmHide = async () => {
    if (!targetReview) return;
    const res = await moderateReview(
      targetReview.reviewId,
      'hidden',
      moderationReason.trim() || 'Hidden by administrator.',
    );
    if (res.success) {
      handleCloseModal();
      setToastMessage('Review marked as hidden.');
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleRestoreReview = async (review) => {
    clearActionError();
    const res = await moderateReview(review.reviewId, 'published', 'Restored to published by administrator.');
    if (res.success) {
      setToastMessage('Review restored to published.');
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!targetReview) return;
    const res = await adminDeleteReview(targetReview.reviewId);
    if (res.success) {
      handleCloseModal();
      setToastMessage('Review permanently removed.');
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Review Moderation & Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Govern student ratings and reviews platform-wide, resolve inappropriate content, and enforce compliance.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-xs">
          <span className="block text-xs font-semibold text-slate-500">Total Reviews</span>
          <span className="text-lg font-bold text-slate-900">{adminPagination.total || 0}</span>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Toolbar: Filters and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'All Reviews' },
            { key: 'published', label: 'Published' },
            { key: 'hidden', label: 'Hidden / Moderated' },
            { key: 'flagged', label: 'Flagged' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusFilterChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                adminStatusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Search by student, course, text..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-100 outline-hidden"
          />
        </form>
      </div>

      {/* Reviews Table / Cards */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
          <span className="text-xs">Loading platform reviews...</span>
        </div>
      ) : adminReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <ShieldAlert size={36} className="mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No reviews found</h4>
          <p className="text-xs text-slate-500 mt-1">No reviews match the current filter or search criteria.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {adminReviews.map((review) => {
            const isHidden = review.status === 'hidden';
            const isFlagged = review.status === 'flagged';

            return (
              <div
                key={review.reviewId}
                className={`rounded-2xl border p-5 shadow-xs transition-shadow bg-white ${
                  isHidden
                    ? 'border-red-200 bg-red-50/20'
                    : isFlagged
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Meta Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      {review.courseTitle || 'Course'}
                    </span>
                    <span className="text-xs text-slate-400">&bull;</span>
                    <span className="text-xs text-slate-600">Student: <strong>{review.studentName}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        review.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : review.status === 'hidden'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {review.status}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                </div>

                {/* Rating & Content */}
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={
                          review.rating >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700 ml-1">
                    {review.rating} out of 5
                  </span>
                  {review.isEdited && (
                    <span className="text-[11px] text-slate-400 italic">(edited)</span>
                  )}
                </div>

                {review.reviewText && (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mb-3">
                    {review.reviewText}
                  </p>
                )}

                {/* Moderation reason callout if hidden */}
                {review.moderationReason && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200 mb-3 flex items-start gap-2">
                    <ShieldAlert size={14} className="text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700">Moderation Note: </span>
                      <span>{review.moderationReason}</span>
                    </div>
                  </div>
                )}

                {/* Admin Actions Bar */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {isHidden ? (
                    <button
                      type="button"
                      onClick={() => handleRestoreReview(review)}
                      disabled={isModerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Eye size={13} />
                      Restore Review
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenHideModal(review)}
                      disabled={isModerating}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                    >
                      <EyeOff size={13} />
                      Hide Review
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenDeleteModal(review)}
                    disabled={isModerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {adminPagination && adminPagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing {(adminPagination.page - 1) * adminPagination.limit + 1} -{' '}
            {Math.min(adminPagination.page * adminPagination.limit, adminPagination.total)} of{' '}
            {adminPagination.total} reviews
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={adminPagination.page <= 1}
              onClick={() => handlePageChange(adminPagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              Page {adminPagination.page} of {adminPagination.totalPages}
            </span>
            <button
              type="button"
              disabled={adminPagination.page >= adminPagination.totalPages}
              onClick={() => handlePageChange(adminPagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Moderation Reason Modal (Hide Review) */}
      {modalMode === 'hide' && targetReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <EyeOff size={18} className="text-amber-500" />
              Hide Review from Public
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Hiding this review will immediately exclude it from public course pages and subtract it from the course&apos;s average rating.
            </p>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Moderation Reason *
              </label>
              <textarea
                rows={3}
                value={moderationReason}
                onChange={(e) => setModerationReason(e.target.value)}
                placeholder="e.g. Inappropriate language, spam, or promotional link."
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-hidden resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHide}
                disabled={isModerating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isModerating && <Loader2 size={13} className="animate-spin" />}
                Confirm & Hide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalMode === 'delete' && targetReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-600" />
              Permanently Delete Review?
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to permanently delete this review? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-5">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isModerating}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isModerating && <Loader2 size={13} className="animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

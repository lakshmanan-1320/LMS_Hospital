'use client';

import React, { useEffect, useState } from 'react';
import {
  Star,
  MessageSquare,
  MessageSquarePlus,
  Trash2,
  Edit3,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
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

function getInitials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name[0] || 'U').toUpperCase();
}

export default function InstructorReviewsView() {
  const {
    instructorReviews,
    instructorPagination,
    instructorReplyFilter,
    isLoading,
    isReplying,
    actionError,
    setInstructorReplyFilter,
    fetchInstructorReviews,
    replyToReview,
    deleteInstructorReply,
    clearActionError,
  } = useReviewStore();

  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [successToast, setSuccessToast] = useState('');

  useEffect(() => {
    fetchInstructorReviews({ page: 1 });
  }, [fetchInstructorReviews]);

  const handleFilterChange = (filter) => {
    setInstructorReplyFilter(filter);
    fetchInstructorReviews({ page: 1, replyStatus: filter });
  };

  const handlePageChange = (page) => {
    fetchInstructorReviews({ page });
  };

  const handleOpenReply = (review) => {
    clearActionError();
    setActiveReplyId(review.reviewId);
    if (review.instructorReply) {
      setReplyText(review.instructorReply.replyText);
      setEditingReplyId(review.reviewId);
    } else {
      setReplyText('');
      setEditingReplyId(null);
    }
  };

  const handleCancelReply = () => {
    setActiveReplyId(null);
    setReplyText('');
    setEditingReplyId(null);
    clearActionError();
  };

  const handleSubmitReply = async (reviewId) => {
    if (!replyText.trim()) return;
    const res = await replyToReview(reviewId, replyText.trim());
    if (res.success) {
      handleCancelReply();
      setSuccessToast('Your reply was saved successfully!');
      setTimeout(() => setSuccessToast(''), 4000);
    }
  };

  const handleDeleteReply = async (reviewId) => {
    const res = await deleteInstructorReply(reviewId);
    if (res.success) {
      handleCancelReply();
      setSuccessToast('Your reply has been removed.');
      setTimeout(() => setSuccessToast(''), 4000);
    }
  };

  // Metrics calculation
  const totalCount = instructorPagination.total || 0;
  const unrepliedCount = instructorReviews.filter((r) => !r.instructorReply).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Reviews & Ratings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Read student feedback on your courses and post official instructor responses.
          </p>
        </div>

        {/* Quick Stat Badges */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-xs">
            <span className="block text-xs font-semibold text-slate-500">Total Reviews</span>
            <span className="text-lg font-bold text-slate-900">{totalCount}</span>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-center shadow-xs">
            <span className="block text-xs font-semibold text-amber-700">Needs Response</span>
            <span className="text-lg font-bold text-amber-900">{unrepliedCount}</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successToast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 animate-in fade-in">
          {successToast}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'all', label: 'All Reviews' },
          { key: 'unreplied', label: 'Needs Response' },
          { key: 'replied', label: 'Answered' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleFilterChange(tab.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              instructorReplyFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
          <span className="text-xs">Loading course reviews...</span>
        </div>
      ) : instructorReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <MessageSquare size={36} className="mx-auto text-slate-300 mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No reviews found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {instructorReplyFilter === 'unreplied'
              ? 'Great work! You have responded to all student reviews.'
              : 'As enrolled students complete your course lessons, their ratings and reviews will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {instructorReviews.map((review) => {
            const isReplyingCurrent = activeReplyId === review.reviewId;
            const initials = getInitials(review.studentName);

            return (
              <div
                key={review.reviewId}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Course Banner */}
                <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                      Course
                    </span>
                    <Link
                      href={`/courses/${review.courseSlug || review.courseId}`}
                      target="_blank"
                      className="text-xs font-bold text-slate-900 hover:text-indigo-600 transition-colors inline-flex items-center gap-1"
                    >
                      <span>{review.courseTitle || 'View Course'}</span>
                      <ExternalLink size={12} className="text-slate-400" />
                    </Link>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                </div>

                {/* Review Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      {initials}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">
                        {review.studentName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={13}
                              className={
                                review.rating >= star
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-200'
                              }
                            />
                          ))}
                        </div>
                        {review.isEdited && (
                          <span className="text-[11px] text-slate-400 italic">(edited)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reply Button if not open */}
                  {!isReplyingCurrent && (
                    <button
                      type="button"
                      onClick={() => handleOpenReply(review)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      {review.instructorReply ? (
                        <>
                          <Edit3 size={13} />
                          Edit Response
                        </>
                      ) : (
                        <>
                          <MessageSquarePlus size={13} />
                          Reply
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Review Body */}
                <div className="mt-3 pl-12">
                  {review.reviewText && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {review.reviewText}
                    </p>
                  )}
                </div>

                {/* Existing Reply Callout */}
                {review.instructorReply && !isReplyingCurrent && (
                  <div className="mt-4 ml-12 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">
                          Your Public Response
                        </span>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-500">
                          {formatDate(review.instructorReply.createdAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(review.reviewId)}
                        disabled={isReplying}
                        className="text-xs text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete this response"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {review.instructorReply.replyText}
                    </p>
                  </div>
                )}

                {/* Inline Reply Form */}
                {isReplyingCurrent && (
                  <div className="mt-4 ml-12 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                        {editingReplyId ? 'Edit Your Response' : 'Respond to Student'}
                      </span>
                    </div>

                    {actionError && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                        <AlertCircle size={14} />
                        <span>{actionError}</span>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a professional, encouraging response to this review..."
                      maxLength={3000}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-hidden resize-none"
                    />

                    <div className="flex items-center justify-between">
                      {editingReplyId ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteReply(review.reviewId)}
                          disabled={isReplying}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={13} />
                          Delete Response
                        </button>
                      ) : <span />}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelReply}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(review.reviewId)}
                          disabled={isReplying || !replyText.trim()}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-all"
                        >
                          {isReplying ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          Publish Response
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {instructorPagination && instructorPagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            Showing {(instructorPagination.page - 1) * instructorPagination.limit + 1} -{' '}
            {Math.min(instructorPagination.page * instructorPagination.limit, instructorPagination.total)} of{' '}
            {instructorPagination.total} reviews
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={instructorPagination.page <= 1}
              onClick={() => handlePageChange(instructorPagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              Page {instructorPagination.page} of {instructorPagination.totalPages}
            </span>
            <button
              type="button"
              disabled={instructorPagination.page >= instructorPagination.totalPages}
              onClick={() => handlePageChange(instructorPagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

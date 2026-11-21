'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, AlertCircle, Loader2, Trash2 } from 'lucide-react';

const RATING_LABELS = {
  1: 'Terrible, not what I expected',
  2: 'Poor, pretty disappointed',
  3: 'Average, could be much better',
  4: 'Good, what I expected',
  5: 'Amazing, above and beyond expectations!',
};

export default function StudentReviewModal({
  isOpen,
  onClose,
  existingReview = null,
  courseTitle = 'Course',
  onSubmit,
  onDelete,
  isSubmitting = false,
  error = null,
}) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setReviewText(existingReview.reviewText || '');
    } else {
      setRating(5);
      setReviewText('');
    }
    setShowDeleteConfirm(false);
  }, [existingReview, isOpen]);

  if (!isOpen) return null;

  const activeStar = hoverRating || rating;
  const isEditing = Boolean(existingReview);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) return;
    onSubmit({
      rating,
      reviewText: reviewText.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Modal Title */}
        <h3 className="text-xl font-bold text-slate-900">
          {isEditing ? 'Edit Your Review' : 'How would you rate this course?'}
        </h3>
        <p className="text-xs text-slate-500 mt-1 line-clamp-1">{courseTitle}</p>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Interactive Star Picker */}
        <div className="my-6 flex flex-col items-center justify-center p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = activeStar >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-hidden transition-transform hover:scale-115 active:scale-95"
                >
                  <Star
                    size={36}
                    className={`transition-colors ${
                      isFilled
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <span className="text-xs font-semibold text-amber-800 mt-3 text-center min-h-[18px]">
            {RATING_LABELS[activeStar] || 'Select your star rating'}
          </span>
        </div>

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Your Review (Optional)
            </label>
            <textarea
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Tell others what you enjoyed about the course, the teaching style, or what could be improved..."
              maxLength={5000}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all resize-none"
            />
          </div>

          {/* Delete Confirmation prompt */}
          {showDeleteConfirm && (
            <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 flex items-center justify-between gap-3 text-xs">
              <span className="text-red-800 font-medium">
                Are you sure you want to remove your review?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isSubmitting}
                  className="px-3 py-1 rounded-md bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Review
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || rating < 1}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 active:scale-98 transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isEditing ? 'Save Changes' : 'Submit Review'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

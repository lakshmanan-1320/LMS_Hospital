'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import StarRating from '@/modules/courses/components/StarRating';
import { timeAgo } from '@/modules/courses/utils/courseFormat';

function getInitials(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U'
  );
}

/**
 * Review card (course page style): initials, name, stars, "5 days ago", text with Show more,
 * and the instructor's reply. Own reviews get Edit / Delete.
 */
export default function ReviewCard({ review, isOwnReview = false, onEdit, onDelete, divider = true }) {
  const textRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) setClamped(el.scrollHeight > el.clientHeight + 2);
  }, [review?.reviewText]);

  if (!review) return null;

  return (
    <article className={`py-6 ${divider ? 'border-t border-slate-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {getInitials(review.studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-bold text-slate-900">
              {review.studentName}
              {isOwnReview && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">You</span>}
            </p>
            {isOwnReview && (onEdit || onDelete) && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button type="button" onClick={onEdit} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Edit your review">
                    <Pencil size={14} />
                  </button>
                )}
                {onDelete && (
                  <button type="button" onClick={onDelete} className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete your review">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-slate-500">
            <StarRating value={review.rating} size={12} />
            <span>{timeAgo(review.createdAt)}</span>
            {review.isEdited && <span className="font-normal">(edited)</span>}
          </div>
        </div>
      </div>

      {review.reviewTitle && <p className="mt-3 font-bold text-slate-900">{review.reviewTitle}</p>}
      {review.reviewText && (
        <>
          <p ref={textRef} className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 ${expanded ? '' : 'line-clamp-4'}`}>
            {review.reviewText}
          </p>
          {(clamped || expanded) && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-bold text-slate-900 underline underline-offset-4">
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      )}

      {review.instructorReply && (
        <div className="mt-4 rounded-lg border-l-4 border-violet-200 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-900">
            {review.instructorReply.instructorName} <span className="font-normal text-slate-500">· Instructor response · {timeAgo(review.instructorReply.createdAt)}</span>
          </p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{review.instructorReply.replyText}</p>
        </div>
      )}
    </article>
  );
}

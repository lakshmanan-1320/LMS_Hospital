'use client';

import React from 'react';
import { X } from 'lucide-react';
import StarRating from '@/modules/courses/components/StarRating';

/**
 * Rating breakdown (5 → 1 stars) with clickable bars to filter reviews by star.
 */
export default function CourseRatingSummary({ summary, activeStarFilter = null, onSelectStarFilter }) {
  if (!summary) return null;
  const breakdown = summary.breakdown || {};

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const item = breakdown[star] || { count: 0, percentage: 0 };
        const active = activeStarFilter === star;
        const dimmed = activeStarFilter !== null && !active;
        return (
          <button
            key={star}
            type="button"
            disabled={!onSelectStarFilter || item.count === 0}
            onClick={() => onSelectStarFilter?.(active ? null : star)}
            className={`flex w-full items-center gap-3 rounded px-1 py-0.5 text-left transition disabled:cursor-default ${
              dimmed ? 'opacity-40' : ''
            } ${onSelectStarFilter && item.count > 0 ? 'hover:bg-slate-50' : ''}`}
            aria-pressed={active}
            aria-label={`${star} stars: ${item.percentage}%`}
          >
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full bg-slate-500" style={{ width: `${item.percentage}%` }} />
            </span>
            <StarRating value={star} size={12} />
            <span className={`w-10 text-right text-sm ${active ? 'font-bold text-violet-700' : 'text-violet-700'}`}>{item.percentage}%</span>
            {active && <X size={14} className="text-slate-500" />}
          </button>
        );
      })}
    </div>
  );
}

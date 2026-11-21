'use client';

import { Star, StarHalf } from 'lucide-react';

/**
 * Read-only star rating (supports halves), e.g. ★★★★½ for 4.5.
 */
export default function StarRating({ value = 0, size = 14, className = '' }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rated ${v.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (v >= i) return <Star key={i} size={size} className="fill-amber-500 text-amber-500" />;
        if (v >= i - 0.5) return <StarHalf key={i} size={size} className="fill-amber-500 text-amber-500" />;
        return <Star key={i} size={size} className="text-amber-500/40" />;
      })}
    </span>
  );
}

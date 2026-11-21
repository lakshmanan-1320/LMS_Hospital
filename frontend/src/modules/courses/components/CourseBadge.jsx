'use client';

/** Badge colours by key; labels come from the API (rules are set in Settings → Course badges). */
const STYLES = {
  bestseller: 'bg-teal-100 text-teal-900',
  highest_rated: 'bg-amber-100 text-amber-900',
  new: 'bg-violet-100 text-violet-900',
};

export default function CourseBadge({ badge, className = '' }) {
  if (!badge) return null;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold ${STYLES[badge.key] || 'bg-slate-100 text-slate-800'} ${className}`}>
      {badge.label}
    </span>
  );
}

/**
 * Shared formatting for public course cards and the course landing page.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Absolute URL for backend-served files (e.g. "/uploads/videos/x.mp4"). */
export const backendUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const currencySymbol = (currency = 'INR') => (currency === 'INR' ? '₹' : `${currency} `);

export const formatMoney = (amount, currency = 'INR') =>
  `${currencySymbol(currency)}${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Current price, original price (when discounted) and % off. */
export const priceInfo = (course) => {
  if (!course || course.isFree) return { isFree: true, current: 0, original: null, percentOff: 0 };
  const price = Number(course.price || 0);
  const discount = course.discountPrice !== null && course.discountPrice !== undefined ? Number(course.discountPrice) : null;
  if (discount !== null && discount < price) {
    return { isFree: false, current: discount, original: price, percentOff: Math.round(((price - discount) / price) * 100) };
  }
  return { isFree: false, current: price, original: null, percentOff: 0 };
};

export const formatCount = (n) => Number(n || 0).toLocaleString('en-IN');

/** "21 hours", "45 minutes" style used in "This course includes". */
export const formatHours = (seconds) => {
  const s = Number(seconds) || 0;
  if (s >= 3600) {
    const h = Math.round((s / 3600) * 10) / 10;
    return `${h % 1 === 0 ? h.toFixed(0) : h} hour${h === 1 ? '' : 's'}`;
  }
  const m = Math.max(1, Math.round(s / 60));
  return `${m} minute${m === 1 ? '' : 's'}`;
};

/** "20h 52m total length" style. */
export const formatLength = (seconds) => {
  const totalMinutes = Math.round((Number(seconds) || 0) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

/** "14:30" lecture duration. */
export const formatClock = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

/** "5 days ago", "2 months ago". */
export const timeAgo = (value) => {
  if (!value) return '';
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const units = [
    ['year', 365 * 86400000],
    ['month', 30 * 86400000],
    ['week', 7 * 86400000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
  ];
  for (const [unit, ms] of units) {
    const v = Math.floor(diff / ms);
    if (v >= 1) return `${v} ${unit}${v === 1 ? '' : 's'} ago`;
  }
  return 'just now';
};

/** "Last updated 9/2026". */
export const formatMonthYear = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
};

export const courseHref = (course) => `/courses/${course.slug || course.courseId}`;

/**
 * Recently viewed courses, kept in this browser only (powers "Because you viewed ...").
 * Storage can be unavailable (private mode, blocked site data): every access is guarded.
 */
const KEY = 'elevate.recentlyViewedCourses';
const MAX = 10;

export function getRecentlyViewed() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((c) => c && c.slug && c.title) : [];
  } catch {
    return [];
  }
}

/** @param {{ courseId: string, slug: string, title: string }} course */
export function addRecentlyViewed(course) {
  if (!course?.slug || !course?.title) return;
  try {
    const next = [
      { courseId: course.courseId, slug: course.slug, title: course.title },
      ...getRecentlyViewed().filter((c) => c.slug !== course.slug),
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore: the row just won't appear
  }
}

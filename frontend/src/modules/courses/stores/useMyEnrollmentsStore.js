import { create } from 'zustand';
import { courseService } from '../services/course.service';

const ENROLLED_STATUSES = new Set(['active', 'completed']); // same rule as GET /enrollments/:id/status

/**
 * Course IDs the signed-in user is enrolled in, shared by the public course cards so they
 * show "Start learning" instead of "Enroll free" / "Add to cart" after a refresh.
 * Loaded once per user (GET /enrollments/my); new enrollments are added locally.
 */
export const useMyEnrollmentsStore = create((set, get) => ({
  courseIds: new Set(),
  loadedForUserId: null,
  loadingForUserId: null,

  ensureLoaded: async (userId) => {
    const { loadedForUserId, loadingForUserId } = get();
    if (!userId || loadedForUserId === userId || loadingForUserId === userId) return;
    set({ loadingForUserId: userId });
    try {
      const res = await courseService.getMyEnrollments();
      const items = Array.isArray(res?.items) ? res.items : [];
      const ids = items
        .filter((e) => ENROLLED_STATUSES.has(e.enrollmentStatus || e.enrollment_status))
        .map((e) => e.courseId || e.course_id);
      // Ignore a late answer for a user who has since signed out or switched accounts.
      if (get().loadingForUserId !== userId) return;
      set({ courseIds: new Set(ids), loadedForUserId: userId, loadingForUserId: null });
    } catch {
      if (get().loadingForUserId === userId) set({ loadingForUserId: null });
    }
  },

  markEnrolled: (courseId) => {
    if (!courseId) return;
    set((s) => ({ courseIds: new Set([...s.courseIds, courseId]) }));
  },

  clear: () => set({ courseIds: new Set(), loadedForUserId: null, loadingForUserId: null }),
}));

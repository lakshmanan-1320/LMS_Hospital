import { create } from 'zustand';
import { courseService } from '../services/course.service';

/**
 * Public course landing page state: the landing payload and related courses.
 */
export const useCourseLandingStore = create((set) => ({
  landing: null,
  related: [],
  isLoading: false,
  error: null,

  fetchLanding: async (idOrSlug) => {
    set({ isLoading: true, error: null });
    try {
      const landing = await courseService.getCourseLanding(idOrSlug);
      set({ landing, isLoading: false });
      return landing;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Unable to load this course.';
      set({ landing: null, error: Array.isArray(msg) ? msg.join(', ') : msg, isLoading: false });
      return null;
    }
  },

  fetchRelated: async (idOrSlug) => {
    try {
      const related = await courseService.getRelatedCourses(idOrSlug, 12);
      set({ related });
    } catch {
      set({ related: [] });
    }
  },

  reset: () => set({ landing: null, related: [], error: null }),
}));

export default useCourseLandingStore;

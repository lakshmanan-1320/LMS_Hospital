'use client';

import { X, AlertTriangle } from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';

export default function CourseDeleteModal({ role = 'instructor' }) {
  const { deleteModal, closeDeleteModal, deleteCourse, fetchCourses, fetchStats } = useCourseStore();
  const { isOpen, course, isDeleting, error } = deleteModal;

  if (!isOpen || !course) return null;

  const handleDelete = async () => {
    try {
      const id = course.courseId || course.course_id;
      await deleteCourse(id);
      await Promise.all([fetchCourses(role), fetchStats()]);
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeDeleteModal}
    >
      <div
        className="w-full max-w-md bg-paper border border-line rounded-2xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <button
            type="button"
            onClick={closeDeleteModal}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="font-heading text-lg font-bold text-ink mb-1">
          Delete Draft Course?
        </h3>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Are you sure you want to delete <span className="font-bold text-ink">"{course.title}"</span>?
          This action will soft-delete the course and remove it from your draft catalog.
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isDeleting}
            className="px-4 py-2 border border-line rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}


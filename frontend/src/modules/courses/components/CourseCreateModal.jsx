'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Sparkles, AlertCircle, BookOpen } from 'lucide-react';
import { useCourseStore } from '../stores/useCourseStore';
import { categoryService } from '@/modules/categories/services/category.service';

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

export default function CourseCreateModal({ role = 'instructor' }) {
  const router = useRouter();
  const { isCreateModalOpen, closeCreateModal, createCourse, isSaving, error } = useCourseStore();

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [validationError, setValidationError] = useState('');

  // Load active categories for the selector
  useEffect(() => {
    if (!isCreateModalOpen) return;

    setTitle('');
    setCategoryId('');
    setValidationError('');

    const loadCategories = async () => {
      try {
        const res = await categoryService.getCategories({ isActive: true, limit: 100 });
        const items = res?.items || [];
        setCategories(items);
      } catch (err) {
        console.error('Failed to load categories for course modal:', err);
      }
    };

    loadCategories();
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const previewSlug = slugify(title) || 'course-title-slug';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length < 2) {
      setValidationError('Course title must be at least 2 characters.');
      return;
    }

    try {
      const created = await createCourse({
        title: trimmedTitle,
        categoryId: categoryId || null,
      });

      if (created?.course_id || created?.courseId) {
        const id = created.course_id || created.courseId;
        router.push(`/dashboard/${role}/courses/${created.slug || id}`);
      }
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeCreateModal}
    >
      <div
        className="w-full max-w-lg bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="eyebrow flex items-center gap-1.5 text-[11px] font-bold text-teal uppercase mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-coral" />
              New Curriculum Course
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink">
              Create Draft Course
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-1">
              Start by setting a working title and academic category. You can customize the full syllabus later.
            </p>
          </div>
          <button
            type="button"
            onClick={closeCreateModal}
            className="p-1.5 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Backend & Validation Errors */}
        {(validationError || error) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <span>{validationError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Course Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Master Full-Stack Web Development in 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-muted/60"
            />
            <span className="text-[10px] text-muted block mt-1">
              Minimum 2 characters. You can change this before publishing.
            </span>
          </div>

          {/* Generated Slug Preview */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              URL Slug (Auto-generated)
            </label>
            <div className="px-3.5 py-2 bg-cream/70 border border-line rounded-lg text-xs font-mono text-muted flex items-center gap-1.5 truncate">
              <Sparkles size={13} className="text-teal flex-shrink-0" />
              <span>/courses/</span>
              <span className="font-bold text-ink truncate">{previewSlug}</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 cursor-pointer"
            >
              <option value="">— Select an Academic Category (Optional) —</option>
              {categories.map((c) => {
                const cId = c.categoryId || c.category_id;
                return (
                  <option key={cId} value={cId}>
                    {c.name}
                  </option>
                );
              })}
            </select>
            <span className="text-[10px] text-muted block mt-1">
              Must be assigned to an active category prior to submitting for approval.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isSaving}
              className="px-4 py-2 border border-line rounded-lg text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <BookOpen size={15} />
              <span>{isSaving ? 'Creating...' : 'Create Draft'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


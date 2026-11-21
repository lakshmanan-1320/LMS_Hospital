'use client';

import { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';

export default function CategoryDeleteModal() {
  const {
    deleteModal,
    closeDeleteModal,
    executeDelete,
    executeStatusToggle,
  } = useCategoryStore();

  const { isOpen, category, isSubmitting, errorMessage } = deleteModal;
  const [cascade, setCascade] = useState(false);

  if (!isOpen || !category) return null;

  const id = category.categoryId || category.category_id;
  const hasChildren = category.children && category.children.length > 0;

  const handleDelete = async () => {
    try {
      await executeDelete(id, cascade);
    } catch (err) {
      // Error handled in store
    }
  };

  const handleDeactivateInstead = async () => {
    try {
      await executeStatusToggle(id, false, true);
      closeDeleteModal();
    } catch (err) {
      // Handled in store
    }
  };

  const isCourseConflict = errorMessage && errorMessage.toLowerCase().includes('course');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeDeleteModal}
    >
      <div
        className="w-full max-w-md bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-lg font-bold text-ink">
              Delete Category
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Are you sure you want to delete <strong className="text-ink">&quot;{category.name}&quot;</strong>?
            </p>
          </div>
          <button
            type="button"
            onClick={closeDeleteModal}
            className="p-1 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Backend Conflict Error Display */}
        {errorMessage && (
          <div
            className={`rounded-xl p-3.5 mb-4 text-xs leading-relaxed flex items-start gap-2.5 border ${
              isCourseConflict
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <ShieldAlert size={17} className={`flex-shrink-0 mt-0.5 ${isCourseConflict ? 'text-amber-600' : 'text-red-600'}`} />
            <div>
              <strong className="block font-bold mb-0.5">
                {isCourseConflict ? 'Course Dependency Protection' : 'Deletion Blocked'}
              </strong>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Subcategories Cascade Notice */}
        {hasChildren && !isCourseConflict && (
          <div className="bg-cream/60 border border-line rounded-xl p-3.5 mb-4">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
                className="w-4 h-4 rounded text-teal accent-teal mt-0.5 cursor-pointer"
              />
              <div>
                <span>Delete all nested subcategories as well (Cascade)</span>
                <span className="block text-[11px] font-normal text-muted mt-0.5">
                  This category contains {category.children.length} subcategory/subcategories. Enabling cascade deletes the entire branch.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={isSubmitting}
            className="px-4 py-2 border border-line rounded-lg text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:bg-cream transition-colors"
          >
            Cancel
          </button>

          {isCourseConflict ? (
            <button
              type="button"
              onClick={handleDeactivateInstead}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <CheckCircle2 size={15} /> Deactivate Instead
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Deleting...' : 'Confirm Deletion'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

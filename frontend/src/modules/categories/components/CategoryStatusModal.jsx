'use client';

import { useState } from 'react';
import { ToggleLeft, ToggleRight, X, AlertCircle } from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';

export default function CategoryStatusModal() {
  const {
    statusModal,
    closeStatusModal,
    executeStatusToggle,
  } = useCategoryStore();

  const { isOpen, category, newStatus, isSubmitting, errorMessage } = statusModal;
  const [cascade, setCascade] = useState(true);

  if (!isOpen || !category) return null;

  const id = category.categoryId || category.category_id;
  const hasChildren = category.children && category.children.length > 0;

  const handleToggle = async () => {
    try {
      await executeStatusToggle(id, newStatus, cascade);
    } catch (err) {
      // Error handled in store
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeStatusModal}
    >
      <div
        className="w-full max-w-md bg-paper border border-line rounded-2xl p-6 sm:p-7 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              newStatus ? 'bg-mint text-teal' : 'bg-red-100 text-red-600'
            }`}
          >
            {newStatus ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-lg font-bold text-ink">
              {newStatus ? 'Activate Category' : 'Deactivate Category'}
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Set <strong className="text-ink">&quot;{category.name}&quot;</strong> to{' '}
              <span className={`font-bold ${newStatus ? 'text-green-600' : 'text-red-600'}`}>
                {newStatus ? 'Active' : 'Inactive'}
              </span>
              ?
            </p>
          </div>
          <button
            type="button"
            onClick={closeStatusModal}
            className="p-1 text-muted hover:text-ink rounded-lg hover:bg-cream transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Backend Error Alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="text-xs sm:text-sm text-muted leading-relaxed mb-4">
          {newStatus
            ? 'Activating this category makes it discoverable in the course catalogue and available for course creation.'
            : 'Deactivating this category hides it from the student catalogue. Existing course associations will remain preserved.'}
        </div>

        {/* Cascade Toggle Option */}
        {hasChildren && (
          <div className="bg-cream/60 border border-line rounded-xl p-3.5 mb-4">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-semibold text-ink">
              <input
                type="checkbox"
                checked={cascade}
                onChange={(e) => setCascade(e.target.checked)}
                className="w-4 h-4 rounded text-teal accent-teal mt-0.5 cursor-pointer"
              />
              <div>
                <span>Apply to all nested subcategories (Cascade)</span>
                <span className="block text-[11px] font-normal text-muted mt-0.5">
                  Recursively {newStatus ? 'activates' : 'deactivates'} all {category.children.length} subcategories and their children.
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={closeStatusModal}
            disabled={isSubmitting}
            className="px-4 py-2 border border-line rounded-lg text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:bg-cream transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isSubmitting}
            className={`px-4 py-2 text-white rounded-lg text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${
              newStatus ? 'bg-teal hover:bg-teal-dark' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isSubmitting ? 'Updating...' : newStatus ? 'Activate' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

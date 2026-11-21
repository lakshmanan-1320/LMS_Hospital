'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function CategoryFormModal() {
  const {
    isFormModalOpen,
    editingCategory,
    parentForNewChild,
    flatCategories,
    getNextOrderForParent,
    createCategory,
    updateCategory,
    closeFormModal,
    isSubmitting,
    error,
  } = useCategoryStore();

  const isEdit = Boolean(editingCategory);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustom, setIsSlugCustom] = useState(false);
  const [description, setDescription] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!isFormModalOpen) return;

    if (editingCategory) {
      setName(editingCategory.name || '');
      setSlug(editingCategory.slug || '');
      setIsSlugCustom(true);
      setDescription(editingCategory.description || '');
      setParentCategoryId(editingCategory.parentCategoryId || editingCategory.parent_category_id || '');
      setDisplayOrder(editingCategory.displayOrder ?? editingCategory.display_order ?? 1);
      setIsActive(editingCategory.isActive ?? editingCategory.is_active ?? true);
    } else {
      setName('');
      setSlug('');
      setIsSlugCustom(false);
      setDescription('');
      const initialParent = parentForNewChild
        ? parentForNewChild.categoryId || parentForNewChild.category_id
        : '';
      setParentCategoryId(initialParent);
      setIsActive(true);

      // Instantly compute next display order for this parent level
      const nextOrder = getNextOrderForParent(initialParent);
      setDisplayOrder(nextOrder);
    }
    setValidationError('');
  }, [isFormModalOpen, editingCategory, parentForNewChild, getNextOrderForParent]);

  const handleNameChange = (e) => {
    const newName = e.target.value;
    setName(newName);
    if (!isSlugCustom) {
      setSlug(slugify(newName));
    }
  };

  const handleSlugChange = (e) => {
    setIsSlugCustom(true);
    setSlug(slugify(e.target.value));
  };

  const handleParentCategoryChange = (e) => {
    const newParentId = e.target.value;
    setParentCategoryId(newParentId);
    if (!isEdit) {
      // Instantly calculate next display order for the newly selected parent
      const nextOrder = getNextOrderForParent(newParentId);
      setDisplayOrder(nextOrder);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setValidationError('Category name must be at least 2 characters.');
      return;
    }

    const parsedOrder = parseInt(displayOrder, 10);
    const finalOrder = !isNaN(parsedOrder) && parsedOrder > 0 ? parsedOrder : 1;

    const payload = {
      name: trimmedName,
      slug: slug.trim() ? slug.trim() : undefined,
      description: description.trim() || null,
      parentCategoryId: parentCategoryId ? parentCategoryId : null,
      displayOrder: finalOrder,
      isActive: Boolean(isActive),
    };

    try {
      if (isEdit) {
        const id = editingCategory.categoryId || editingCategory.category_id;
        await updateCategory(id, payload);
      } else {
        await createCategory(payload);
      }
    } catch (err) {
      // Error handled in store
    }
  };

  if (!isFormModalOpen) return null;

  const eligibleParents = flatCategories.filter((c) => {
    if (!isEdit) return true;
    const currentId = editingCategory.categoryId || editingCategory.category_id;
    return (c.categoryId || c.category_id) !== currentId;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fadeIn"
      onClick={closeFormModal}
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
              {isEdit ? 'Update Category' : 'New Category'}
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink">
              {isEdit
                ? `Edit "${editingCategory.name}"`
                : parentForNewChild
                ? `Add Subcategory under "${parentForNewChild.name}"`
                : 'Create New Category'}
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-1">
              {isEdit
                ? 'Modify name, URL slug, parent hierarchy or status.'
                : 'Add a new track, department or nested subcategory.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeFormModal}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Web Development"
              value={name}
              onChange={handleNameChange}
              required
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-muted/60"
            />
          </div>

          {/* Slug */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wider">
                URL Slug
              </label>
              <span className="text-[11px] text-muted">
                {isSlugCustom ? 'Custom slug' : 'Auto-generated'}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="web-development"
                value={slug}
                onChange={handleSlugChange}
                className="w-full pl-3.5 pr-16 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink font-mono outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-muted/60"
              />
              <button
                type="button"
                onClick={() => {
                  setSlug(slugify(name));
                  setIsSlugCustom(false);
                }}
                title="Regenerate from name"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-teal hover:text-teal-dark flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={13} /> Auto
              </button>
            </div>
          </div>

          {/* Parent Category */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Parent Category (Hierarchy)
            </label>
            <select
              value={parentCategoryId}
              onChange={handleParentCategoryChange}
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 cursor-pointer"
            >
              <option value="">— None (Top-Level Root Category) —</option>
              {eligibleParents.map((parent) => {
                const pId = parent.categoryId || parent.category_id;
                return (
                  <option key={pId} value={pId}>
                    {parent.name} (/{parent.slug})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-ink uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <textarea
              placeholder="Brief description of courses in this track or category..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-paper border border-line rounded-lg text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-all placeholder:text-muted/60 resize-y"
            />
          </div>

          {/* Display Order & Active Toggle Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-cream/70 rounded-xl border border-line">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-ink uppercase tracking-wider">
                  Display Order
                </label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = getNextOrderForParent(parentCategoryId);
                      setDisplayOrder(next);
                    }}
                    className="text-[10px] text-teal hover:text-teal-dark font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Reset to recommended sequential order"
                  >
                    <RotateCcw size={10} />
                    <span>Auto-order</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setDisplayOrder((prev) => Math.max(1, (parseInt(prev, 10) || 1) - 1))
                  }
                  className="w-9 h-9 rounded-lg border border-line bg-paper hover:bg-cream text-ink text-base font-bold flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer select-none active:scale-95"
                  title="Decrease order"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={displayOrder}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setDisplayOrder('');
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        setDisplayOrder(num);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (
                      displayOrder === '' ||
                      isNaN(Number(displayOrder)) ||
                      Number(displayOrder) < 1
                    ) {
                      setDisplayOrder(1);
                    }
                  }}
                  className="w-full text-center px-3 py-1.5 bg-paper border border-line rounded-lg text-sm font-bold text-ink outline-none focus:border-teal"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDisplayOrder((prev) => (parseInt(prev, 10) || 0) + 1)
                  }
                  className="w-9 h-9 rounded-lg border border-line bg-paper hover:bg-cream text-ink text-base font-bold flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer select-none active:scale-95"
                  title="Increase order"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-muted block mt-1">
                Sequential ordering. Lower numbers appear first.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-ink uppercase tracking-wider mb-1.5">
                Catalogue Status
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-2 text-xs font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-teal accent-teal cursor-pointer"
                />
                <span>Active in Catalogue</span>
              </label>
              <span className="text-[10px] text-muted block mt-1">
                {isActive ? 'Visible to students & course creators.' : 'Hidden from public view.'}
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={closeFormModal}
              disabled={isSubmitting}
              className="px-4 py-2 border border-line rounded-lg text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:bg-cream transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { Edit2, Trash2, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';

export default function CategoryTableView() {
  const {
    flatCategories,
    total,
    page,
    limit,
    isLoading,
    setPage,
    openEditModal,
    openDeleteModal,
    openStatusModal,
  } = useCategoryStore();

  const totalPages = Math.ceil(total / limit) || 1;
  const startItem = total > 0 ? (page - 1) * limit + 1 : 0;
  const endItem = Math.min(page * limit, total);

  if (isLoading && (!flatCategories || flatCategories.length === 0)) {
    return (
      <div className="w-full bg-paper border border-line rounded-xl p-12 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 text-muted text-sm font-medium">
          <Layers size={18} className="animate-spin text-teal" /> Loading categories...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-paper border border-line rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Table Container */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-cream/60 border-b border-line text-muted font-bold text-[11px] tracking-wider uppercase">
              <th className="py-3.5 px-4 sm:px-6">Name & Slug</th>
              <th className="py-3.5 px-4">Parent Category</th>
              <th className="py-3.5 px-4 text-center">Order</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {flatCategories.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 px-6 text-center text-muted">
                  No categories match the selected filters.
                </td>
              </tr>
            ) : (
              flatCategories.map((item) => {
                const id = item.categoryId || item.category_id;
                const isActive = item.isActive ?? item.is_active ?? true;
                const displayOrder = item.displayOrder ?? item.display_order ?? 0;
                const parentId = item.parentCategoryId || item.parent_category_id;

                return (
                  <tr
                    key={id}
                    className="hover:bg-cream/40 transition-colors"
                  >
                    {/* Name & Slug */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-heading font-bold text-ink text-sm">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        /{item.slug}
                      </div>
                    </td>

                    {/* Parent */}
                    <td className="py-3.5 px-4 text-ink">
                      {parentId ? (
                        <span className="inline-block text-[11px] font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md">
                          Subcategory
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] font-semibold bg-mint text-teal px-2.5 py-1 rounded-md">
                          Root Department
                        </span>
                      )}
                    </td>

                    {/* Order */}
                    <td className="py-3.5 px-4 text-center text-muted font-semibold">
                      {displayOrder}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`status-pill ${isActive ? 'status-good' : 'status-neutral'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                          className="w-7 h-7 rounded-md border border-line bg-paper hover:bg-cream hover:border-teal flex items-center justify-center text-muted hover:text-ink transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openStatusModal(item, !isActive)}
                          title={isActive ? 'Deactivate' : 'Activate'}
                          className={`w-7 h-7 rounded-md border border-line bg-paper hover:bg-cream flex items-center justify-center transition-colors ${
                            isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(item)}
                          title="Delete"
                          className="w-7 h-7 rounded-md border border-line bg-paper hover:bg-red-50 hover:border-red-300 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-line bg-gray-50/70 text-xs text-muted">
        <div>
          Showing <strong className="text-ink">{startItem}</strong> to <strong className="text-ink">{endItem}</strong> of <strong className="text-ink">{total}</strong> categories
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-paper border border-line hover:bg-cream text-ink rounded-md disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="font-semibold text-ink px-1">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-paper border border-line hover:bg-cream text-ink rounded-md disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

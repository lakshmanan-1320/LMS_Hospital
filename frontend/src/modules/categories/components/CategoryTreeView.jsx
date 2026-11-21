'use client';

import { FolderPlus, Layers } from 'lucide-react';
import CategoryTreeNode from './CategoryTreeNode';
import { useCategoryStore } from '../stores/useCategoryStore';

export default function CategoryTreeView() {
  const { tree, isLoading, openCreateModal } = useCategoryStore();

  if (isLoading && (!tree || tree.length === 0)) {
    return (
      <div className="w-full bg-paper border border-line rounded-xl p-12 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 text-muted text-sm font-medium">
          <Layers size={18} className="animate-spin text-teal" /> Loading hierarchical categories...
        </div>
      </div>
    );
  }

  if (!tree || tree.length === 0) {
    return (
      <div className="w-full bg-paper border-2 border-dashed border-line rounded-2xl p-12 sm:p-16 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-mint text-teal flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Layers size={28} />
        </div>
        <h3 className="font-heading text-xl sm:text-2xl font-bold text-ink mb-1.5">
          No Categories Yet
        </h3>
        <p className="text-xs sm:text-sm text-muted max-w-md mx-auto mb-6">
          Create your first root department or track to begin structuring courses and subcategories.
        </p>
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <FolderPlus size={16} /> Create First Category
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-paper border border-line rounded-xl p-4 sm:p-6 shadow-sm">
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 mb-4 border-b border-line">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">
          Hierarchical Tree Explorer ({tree.length} Root Department{tree.length === 1 ? '' : 's'})
        </div>
        <div className="text-[11px] sm:text-xs text-muted">
          Click <span className="font-bold text-teal">+ Sub</span> to nest subcategories at any depth
        </div>
      </div>

      {/* Tree Nodes List */}
      <div className="w-full space-y-2">
        {tree.map((rootNode) => (
          <CategoryTreeNode
            key={rootNode.categoryId || rootNode.category_id}
            node={rootNode}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

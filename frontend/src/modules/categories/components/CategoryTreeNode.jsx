'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Layers,
} from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';

export default function CategoryTreeNode({ node, depth = 0 }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const {
    openCreateModal,
    openEditModal,
    openDeleteModal,
    openStatusModal,
  } = useCategoryStore();

  const hasChildren = node.children && node.children.length > 0;
  const isActive = node.isActive ?? node.is_active ?? true;
  const displayOrder = node.displayOrder ?? node.display_order ?? 0;

  return (
    <div className="w-full relative">
      {/* Node Row */}
      <div
        style={{ marginLeft: `${depth * 1.25}rem` }}
        className={`w-full flex flex-col md:flex-row md:items-center justify-between p-3 sm:p-3.5 mb-2 rounded-xl border border-line transition-all hover:border-teal/50 hover:shadow-sm ${
          depth % 2 === 0 ? 'bg-white' : 'bg-cream/40'
        }`}
      >
        {/* Left Side: Chevron, Icon, Info */}
        <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1 mb-2.5 md:mb-0">
          {/* Chevron */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            disabled={!hasChildren}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            className={`p-1 mt-0.5 sm:mt-0 rounded text-ink transition-opacity ${
              hasChildren ? 'opacity-100 cursor-pointer hover:bg-cream' : 'opacity-0 cursor-default'
            }`}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Folder Icon Badge */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              depth === 0 ? 'bg-mint text-teal' : 'bg-gray-100 text-muted'
            }`}
          >
            {hasChildren ? (
              isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />
            ) : (
              <Layers size={16} />
            )}
          </div>

          {/* Name & Metadata */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-heading font-bold text-xs sm:text-sm text-ink truncate">
                {node.name}
              </span>

              {/* Slug Badge */}
              <span className="text-[10px] font-mono text-muted bg-cream border border-line px-1.5 py-0.5 rounded">
                /{node.slug}
              </span>

              {/* Depth Level Indicator */}
              <span
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                  depth === 0 ? 'bg-teal/10 text-teal' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {depth === 0 ? 'Root Department' : `Level ${depth}`}
              </span>

              {/* Children Count Pill */}
              {hasChildren && (
                <span className="text-[9px] font-semibold text-muted bg-line/60 px-2 py-0.5 rounded-full">
                  {node.children.length} subcategor{node.children.length === 1 ? 'y' : 'ies'}
                </span>
              )}
            </div>

            {/* Description */}
            {node.description && (
              <p className="text-[11px] text-muted mt-1 truncate max-w-xl">
                {node.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Order, Status & Quick Action Buttons */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60">
          <div className="flex items-center gap-2">
            {/* Display Order Pill */}
            <span className="text-[10px] font-semibold text-muted px-2 py-0.5 rounded border border-line bg-paper">
              Order: {displayOrder}
            </span>

            {/* Status Pill */}
            <span className={`status-pill ${isActive ? 'status-good' : 'status-neutral'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Quick Add Subcategory */}
            <button
              type="button"
              onClick={() => openCreateModal(node)}
              title="Add Subcategory under this category"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-paper hover:bg-cream border border-line hover:border-teal text-ink rounded-md text-[11px] font-bold shadow-2xs transition-all"
            >
              <Plus size={12} className="text-teal" /> <span>Sub</span>
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => openEditModal(node)}
              title="Edit Category"
              className="w-7 h-7 rounded-md border border-line bg-paper hover:bg-cream hover:border-teal flex items-center justify-center text-muted hover:text-ink transition-colors"
            >
              <Edit2 size={13} />
            </button>

            {/* Toggle Status */}
            <button
              type="button"
              onClick={() => openStatusModal(node, !isActive)}
              title={isActive ? 'Deactivate Category' : 'Activate Category'}
              className={`w-7 h-7 rounded-md border border-line bg-paper hover:bg-cream flex items-center justify-center transition-colors ${
                isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => openDeleteModal(node)}
              title="Delete Category"
              className="w-7 h-7 rounded-md border border-line bg-paper hover:bg-red-50 hover:border-red-300 flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Recursive Children Rows */}
      {hasChildren && isExpanded && (
        <div className="w-full relative">
          {/* Connector Line Guide */}
          <div
            style={{ left: `${depth * 1.25 + 0.85}rem` }}
            className="absolute top-0 bottom-3 w-px bg-line z-0"
          />
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.categoryId || child.category_id}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

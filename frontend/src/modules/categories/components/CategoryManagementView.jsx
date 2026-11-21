'use client';

import { useEffect } from 'react';
import {
  Layers,
  FolderTree,
  Table as TableIcon,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Folder,
  Layers3,
  Archive,
} from 'lucide-react';
import { useCategoryStore } from '../stores/useCategoryStore';
import CategoryTreeView from './CategoryTreeView';
import CategoryTableView from './CategoryTableView';
import CategoryFormModal from './CategoryFormModal';
import CategoryDeleteModal from './CategoryDeleteModal';
import CategoryStatusModal from './CategoryStatusModal';

export default function CategoryManagementView() {
  const {
    tree,
    flatCategories,
    total,
    viewMode,
    search,
    statusFilter,
    isLoading,
    error,
    successMessage,
    fetchTree,
    fetchCategories,
    refreshAll,
    setViewMode,
    setSearch,
    setStatusFilter,
    openCreateModal,
    clearFeedback,
  } = useCategoryStore();

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        clearFeedback();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearFeedback]);

  const rootCount = tree?.length || 0;
  const subcategoryCount = Math.max(0, (total || 0) - rootCount);
  const inactiveCount = (flatCategories || []).filter(
    (c) => (c.isActive ?? c.is_active) === false
  ).length;

  return (
    <div className="w-full flex-1 px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
      {/* 1. Header Section */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            Category Management
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl">
            Create, organize, and manage academic departments and unlimited hierarchical subcategories.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={() => openCreateModal()}
          className="self-start sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal hover:bg-teal-dark text-white rounded-lg text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all transform active:scale-95"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      {/* 2. Success Feedback Banner */}
      {successMessage && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-3.5 mb-5 flex items-center justify-between text-xs sm:text-sm text-green-800 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
            className="text-xs font-semibold text-green-700 hover:text-green-900 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Error Feedback Banner */}
      {error && !successMessage && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5 flex items-center justify-between text-xs sm:text-sm text-red-800 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
            className="text-xs font-semibold text-red-700 hover:text-red-900 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Quick Metric Cards Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Categories */}
        <div className="bg-paper border border-line rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-muted uppercase">
            <span>Total Categories</span>
            <span className="w-8 h-8 rounded-lg bg-mint text-teal flex items-center justify-center">
              <Layers size={17} />
            </span>
          </div>
          <div className="font-heading text-2xl sm:text-3xl font-extrabold text-ink my-2">
            {total || tree.length}
          </div>
          <div className="text-[11px] text-muted">Across all hierarchy depths</div>
        </div>

        {/* Root Departments */}
        <div className="bg-paper border border-line rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-muted uppercase">
            <span>Root Departments</span>
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <Folder size={17} />
            </span>
          </div>
          <div className="font-heading text-2xl sm:text-3xl font-extrabold text-ink my-2">
            {rootCount}
          </div>
          <div className="text-[11px] text-sky-700">Top-level tracks</div>
        </div>

        {/* Nested Subcategories */}
        <div className="bg-paper border border-line rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-muted uppercase">
            <span>Subcategories</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Layers3 size={17} />
            </span>
          </div>
          <div className="font-heading text-2xl sm:text-3xl font-extrabold text-ink my-2">
            {subcategoryCount}
          </div>
          <div className="text-[11px] text-amber-700">Child & grandchild nodes</div>
        </div>

        {/* Inactive Categories */}
        <div className="bg-paper border border-line rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition-all">
          <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-muted uppercase">
            <span>Inactive / Draft</span>
            <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center">
              <Archive size={17} />
            </span>
          </div>
          <div className="font-heading text-2xl sm:text-3xl font-extrabold text-ink my-2">
            {inactiveCount}
          </div>
          <div className="text-[11px] text-muted">Hidden from catalogue</div>
        </div>
      </div>

      {/* 5. Control Strip (Search, Status Filter, View Mode Toggle, Refresh) */}
      <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3 h-10 w-full sm:w-72 bg-paper border border-line rounded-lg text-ink focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20 transition-all">
            <Search size={16} className="text-muted flex-shrink-0" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-0 outline-none text-xs sm:text-sm placeholder:text-muted/60"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 bg-paper border border-line rounded-lg text-xs sm:text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh categories"
            className="w-10 h-10 bg-paper border border-line rounded-lg flex items-center justify-center text-muted hover:text-ink hover:border-teal transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-teal' : ''} />
          </button>
        </div>

        {/* View Switcher (Tree vs Table) */}
        <div className="flex items-center bg-paper border border-line rounded-lg p-1 self-start md:self-auto shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('tree')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              viewMode === 'tree'
                ? 'bg-teal text-white shadow-sm'
                : 'text-muted hover:text-ink hover:bg-cream'
            }`}
          >
            <FolderTree size={15} /> Tree View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-teal text-white shadow-sm'
                : 'text-muted hover:text-ink hover:bg-cream'
            }`}
          >
            <TableIcon size={15} /> Table View
          </button>
        </div>
      </div>

      {/* 6. Active View Container (100% Full Width) */}
      <div className="w-full flex-1">
        {viewMode === 'tree' ? <CategoryTreeView /> : <CategoryTableView />}
      </div>

      {/* 7. Modals */}
      <CategoryFormModal />
      <CategoryDeleteModal />
      <CategoryStatusModal />
    </div>
  );
}

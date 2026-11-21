import { create } from 'zustand';
import { categoryService } from '../services/category.service';

/**
 * Dedicated Category Management Zustand Store
 * Centralizes hierarchical category tree, flat paginated views,
 * filter states, modal dialogs, and backend mutation actions.
 */
export const useCategoryStore = create((set, get) => ({
  // Data State
  tree: [],
  flatCategories: [],
  total: 0,
  page: 1,
  limit: 10,
  nextDisplayOrder: 1,

  // Filters & View Options
  search: '',
  statusFilter: 'all', // 'all' | 'active' | 'inactive'
  parentFilter: 'all', // 'all' | 'root' | string (UUID)
  viewMode: 'tree',    // 'tree' | 'table'

  // Loading & Alert State
  isLoading: false,
  isSubmitting: false,
  error: null,
  successMessage: null,

  // Form Modal State (Create / Edit)
  isFormModalOpen: false,
  editingCategory: null,
  parentForNewChild: null,

  // Delete Confirmation Modal State
  deleteModal: {
    isOpen: false,
    category: null,
    isSubmitting: false,
    errorMessage: null,
  },

  // Status Confirmation Modal State
  statusModal: {
    isOpen: false,
    category: null,
    newStatus: false,
    isSubmitting: false,
    errorMessage: null,
  },

  /**
   * Fetch hierarchical category tree
   */
  fetchTree: async (activeOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoryService.getCategoryTree(activeOnly);
      // Backend returns { totalRootNodes, nextDisplayOrder, tree } inside envelope data
      const tree = response?.tree || response || [];
      const nextDisplayOrder = response?.nextDisplayOrder ?? 1;
      set({ tree, nextDisplayOrder, isLoading: false, error: null });
      return tree;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to load category tree.',
      });
      return [];
    }
  },

  /**
   * Fetch flat paginated list based on active filters
   */
  fetchCategories: async (paramsOverride = {}) => {
    const { page, limit, search, statusFilter, parentFilter } = get();

    const params = {
      page: paramsOverride.page !== undefined ? paramsOverride.page : page,
      limit: paramsOverride.limit !== undefined ? paramsOverride.limit : limit,
      search: (paramsOverride.search !== undefined ? paramsOverride.search : search) || undefined,
    };

    const currentStatus = paramsOverride.statusFilter !== undefined ? paramsOverride.statusFilter : statusFilter;
    if (currentStatus === 'active') params.isActive = true;
    if (currentStatus === 'inactive') params.isActive = false;

    const currentParent = paramsOverride.parentFilter !== undefined ? paramsOverride.parentFilter : parentFilter;
    if (currentParent === 'root') params.parentCategoryId = 'null';
    else if (currentParent && currentParent !== 'all') params.parentCategoryId = currentParent;

    set({ isLoading: true, error: null });
    try {
      const response = await categoryService.getCategories(params);
      const items = response?.items || [];
      const total = response?.total || 0;
      const nextDisplayOrder = response?.nextDisplayOrder ?? get().nextDisplayOrder;
      set({
        flatCategories: items,
        total,
        nextDisplayOrder,
        page: params.page,
        isLoading: false,
        error: null,
      });
      return items;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to load categories.',
      });
      return [];
    }
  },

  /**
   * Compute next sequential display order for root or given parent
   * Calculated synchronously from loaded category data (instant, no extra network call)
   */
  getNextOrderForParent: (parentId = null) => {
    const { flatCategories, tree } = get();

    // 1. Root level category (parentId is empty or null)
    if (!parentId) {
      // Prefer calculating from tree root nodes
      if (tree && tree.length > 0) {
        const maxRoot = tree.reduce(
          (max, node) => Math.max(max, node.displayOrder ?? node.display_order ?? 0),
          0,
        );
        return maxRoot + 1;
      }
      // Or flatCategories roots
      const roots = flatCategories.filter((c) => !(c.parentCategoryId || c.parent_category_id));
      if (roots.length > 0) {
        const maxRoot = roots.reduce(
          (max, c) => Math.max(max, c.displayOrder ?? c.display_order ?? 0),
          0,
        );
        return maxRoot + 1;
      }
      return 1;
    }

    // 2. Subcategory under parentId: find existing children under parentId
    // Check flatCategories first
    const directChildren = flatCategories.filter(
      (c) => (c.parentCategoryId || c.parent_category_id) === parentId,
    );
    if (directChildren.length > 0) {
      const maxChild = directChildren.reduce(
        (max, c) => Math.max(max, c.displayOrder ?? c.display_order ?? 0),
        0,
      );
      return maxChild + 1;
    }

    // Check tree hierarchy
    const findNodeInTree = (nodes, id) => {
      for (const n of nodes) {
        if ((n.categoryId || n.category_id) === id) return n;
        if (n.children && n.children.length > 0) {
          const found = findNodeInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const parentNode = findNodeInTree(tree, parentId);
    if (parentNode && parentNode.children && parentNode.children.length > 0) {
      const maxChild = parentNode.children.reduce(
        (max, c) => Math.max(max, c.displayOrder ?? c.display_order ?? 0),
        0,
      );
      return maxChild + 1;
    }

    return 1;
  },

  /**
   * Refresh both tree and flat views simultaneously
   */
  refreshAll: async () => {
    await Promise.all([get().fetchTree(), get().fetchCategories()]);
  },

  /**
   * Create a new category or subcategory
   */
  createCategory: async (payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await categoryService.createCategory(payload);
      const category = response?.category || response;

      set({
        isSubmitting: false,
        isFormModalOpen: false,
        editingCategory: null,
        parentForNewChild: null,
        successMessage: `Category "${category.name}" created successfully.`,
      });

      await get().refreshAll();
      return { success: true, category };
    } catch (err) {
      set({
        isSubmitting: false,
        error: err.message || 'Failed to create category.',
      });
      throw err;
    }
  },

  /**
   * Update category details
   */
  updateCategory: async (id, payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const response = await categoryService.updateCategory(id, payload);
      const category = response?.category || response;

      set({
        isSubmitting: false,
        isFormModalOpen: false,
        editingCategory: null,
        parentForNewChild: null,
        successMessage: `Category "${category.name}" updated successfully.`,
      });

      await get().refreshAll();
      return { success: true, category };
    } catch (err) {
      set({
        isSubmitting: false,
        error: err.message || 'Failed to update category.',
      });
      throw err;
    }
  },

  /**
   * Execute status activation / deactivation with optional subtree cascade
   */
  executeStatusToggle: async (id, isActive, cascade = false) => {
    set((state) => ({
      statusModal: { ...state.statusModal, isSubmitting: true, errorMessage: null },
    }));

    try {
      const response = await categoryService.updateStatus(id, { isActive, cascade });
      set({
        statusModal: { isOpen: false, category: null, newStatus: false, isSubmitting: false, errorMessage: null },
        successMessage: response?.message || `Category status successfully updated.`,
      });

      await get().refreshAll();
      return { success: true };
    } catch (err) {
      set((state) => ({
        statusModal: {
          ...state.statusModal,
          isSubmitting: false,
          errorMessage: err.message || 'Failed to update category status.',
        },
      }));
      throw err;
    }
  },

  /**
   * Execute category deletion with course check and cascade option
   */
  executeDelete: async (id, cascade = false) => {
    set((state) => ({
      deleteModal: { ...state.deleteModal, isSubmitting: true, errorMessage: null },
    }));

    try {
      const response = await categoryService.deleteCategory(id, cascade);
      set({
        deleteModal: { isOpen: false, category: null, isSubmitting: false, errorMessage: null },
        successMessage: response?.message || 'Category deleted successfully.',
      });

      await get().refreshAll();
      return { success: true };
    } catch (err) {
      set((state) => ({
        deleteModal: {
          ...state.deleteModal,
          isSubmitting: false,
          errorMessage: err.message || 'Failed to delete category.',
        },
      }));
      throw err;
    }
  },

  // Modal Open / Close Triggers
  openCreateModal: (parentCategory = null) => {
    set({
      isFormModalOpen: true,
      editingCategory: null,
      parentForNewChild: parentCategory,
      error: null,
    });
  },

  openEditModal: (category) => {
    set({
      isFormModalOpen: true,
      editingCategory: category,
      parentForNewChild: null,
      error: null,
    });
  },

  closeFormModal: () => {
    set({
      isFormModalOpen: false,
      editingCategory: null,
      parentForNewChild: null,
      error: null,
    });
  },

  openDeleteModal: (category) => {
    set({
      deleteModal: {
        isOpen: true,
        category,
        isSubmitting: false,
        errorMessage: null,
      },
    });
  },

  closeDeleteModal: () => {
    set({
      deleteModal: {
        isOpen: false,
        category: null,
        isSubmitting: false,
        errorMessage: null,
      },
    });
  },

  openStatusModal: (category, newStatus) => {
    set({
      statusModal: {
        isOpen: true,
        category,
        newStatus,
        isSubmitting: false,
        errorMessage: null,
      },
    });
  },

  closeStatusModal: () => {
    set({
      statusModal: {
        isOpen: false,
        category: null,
        newStatus: false,
        isSubmitting: false,
        errorMessage: null,
      },
    });
  },

  // Filter and view controls
  setViewMode: (viewMode) => set({ viewMode }),
  
  setSearch: (search) => {
    set({ search, page: 1 });
    get().fetchCategories({ search, page: 1 });
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter, page: 1 });
    get().fetchCategories({ statusFilter, page: 1 });
  },

  setParentFilter: (parentFilter) => {
    set({ parentFilter, page: 1 });
    get().fetchCategories({ parentFilter, page: 1 });
  },

  setPage: (page) => {
    set({ page });
    get().fetchCategories({ page });
  },

  clearFeedback: () => set({ error: null, successMessage: null }),
}));


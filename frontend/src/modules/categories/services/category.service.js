import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Dedicated Category Management API Service
 * Handles all HTTP interactions with the backend Category module.
 */
export const categoryService = {
  /**
   * Fetch flat paginated list with optional search, parent, and active filters
   * @param {{ search?: string, parentCategoryId?: string, isActive?: boolean, page?: number, limit?: number }} params
   */
  async getCategories(params = {}) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.BASE, { params });
  },

  /**
   * Fetch full hierarchical category tree.
   * If activeOnly is true, inactive parents and their subtrees are automatically pruned.
   * @param {boolean} activeOnly
   */
  async getCategoryTree(activeOnly = false) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.TREE, {
      params: { activeOnly: activeOnly ? 'true' : 'false' },
    });
  },

  /**
   * Fetch category detail by UUID with breadcrumbs and direct children
   * @param {string} id
   */
  async getCategoryById(id) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.BY_ID(id));
  },

  /**
   * Fetch category detail by SEO slug
   * @param {string} slug
   */
  async getCategoryBySlug(slug) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.BY_SLUG(slug));
  },

  /**
   * Create a new root or subcategory
   * @param {{ name: string, slug?: string, description?: string, parentCategoryId?: string|null, icon?: string, displayOrder?: number, isActive?: boolean }} data
   */
  async createCategory(data) {
    return apiClient.post(API_ENDPOINTS.CATEGORIES.BASE, data);
  },

  /**
   * Update category fields with cycle and duplicate checks
   * @param {string} id
   * @param {{ name?: string, slug?: string, description?: string|null, parentCategoryId?: string|null, icon?: string|null, displayOrder?: number, isActive?: boolean }} data
   */
  async updateCategory(id, data) {
    return apiClient.put(API_ENDPOINTS.CATEGORIES.BY_ID(id), data);
  },

  /**
   * Toggle active/inactive status (with optional subtree cascading)
   * @param {string} id
   * @param {{ isActive: boolean, cascade?: boolean }} payload
   */
  async updateStatus(id, { isActive, cascade = false }) {
    return apiClient.patch(API_ENDPOINTS.CATEGORIES.STATUS(id), { isActive, cascade });
  },

  /**
   * Delete category safely (with course verification & optional cascade)
   * @param {string} id
   * @param {boolean} cascade
   */
  async deleteCategory(id, cascade = false) {
    return apiClient.delete(API_ENDPOINTS.CATEGORIES.BY_ID(id), {
      params: { cascade: cascade ? 'true' : 'false' },
    });
  },
};


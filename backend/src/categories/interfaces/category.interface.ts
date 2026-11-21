export interface CategoryRow {
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_category_id: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  depth?: number;
  path_names?: string[];
  path_slugs?: string[];
}

export interface BreadcrumbItem {
  name: string;
  slug: string;
}

export interface CategoryTreeNode {
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  parentCategoryId: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  depth: number;
  path: BreadcrumbItem[];
  children: CategoryTreeNode[];
}

export interface CategoryDetailResponse {
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  parentCategoryId: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  breadcrumbs: BreadcrumbItem[];
  nextDisplayOrder: number;
  children: Array<{
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    displayOrder: number;
    isActive: boolean;
  }>;
}


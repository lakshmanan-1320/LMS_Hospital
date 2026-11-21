import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryStatusDto } from './dto/update-status.dto';
import { QueryCategoryDto } from './dto/query-category.dto';
import {
  CategoryRow,
  CategoryTreeNode,
  CategoryDetailResponse,
  BreadcrumbItem,
} from './interfaces/category.interface';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Auto-generate a clean URL slug from category name
   */
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate an available unique slug
   */
  private async resolveUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = excludeId
        ? await this.categoriesRepository.findBySlugExclude(slug, excludeId)
        : await this.categoriesRepository.findBySlug(slug);

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Sort children nodes deterministically by displayOrder ASC, then name ASC
   */
  private sortTreeNodes(nodes: CategoryTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        this.sortTreeNodes(node.children);
      }
    }
  }

  /**
   * Create a new category or subcategory
   */
  async createCategory(
    dto: CreateCategoryDto,
    userId?: string,
  ): Promise<CategoryRow> {
    const trimmedName = dto.name.trim();

    // 1. Verify parent category exists if specified
    if (dto.parentCategoryId) {
      const parent = await this.categoriesRepository.findById(dto.parentCategoryId);
      if (!parent) {
        throw new NotFoundException(`Parent category with ID '${dto.parentCategoryId}' does not exist.`);
      }
    }

    // 2. Prevent duplicate sibling names under the same parent
    const existingSibling = await this.categoriesRepository.findByNameAndParent(
      trimmedName,
      dto.parentCategoryId,
    );
    if (existingSibling) {
      throw new ConflictException(
        `A category named '${trimmedName}' already exists under the ${
          dto.parentCategoryId ? 'selected parent category' : 'root level'
        }.`,
      );
    }

    // 3. Resolve slug
    const rawSlug = dto.slug ? this.slugify(dto.slug) : this.slugify(trimmedName);
    const uniqueSlug = await this.resolveUniqueSlug(rawSlug);

    // 4. Resolve display order: if omitted or <= 0, automatically sequence to next available order
    const displayOrder =
      dto.displayOrder !== undefined && dto.displayOrder !== null && dto.displayOrder > 0
        ? dto.displayOrder
        : await this.categoriesRepository.getNextDisplayOrder(dto.parentCategoryId);

    // 5. Insert into database
    return this.categoriesRepository.create({
      name: trimmedName,
      slug: uniqueSlug,
      description: dto.description?.trim() || null,
      parentCategoryId: dto.parentCategoryId || null,
      icon: dto.icon?.trim() || null,
      displayOrder,
      isActive: dto.isActive ?? true,
      createdBy: userId || null,
    });
  }

  /**
   * Get next sequential display order for root or given parent
   */
  async getNextDisplayOrder(parentCategoryId?: string | null): Promise<number> {
    if (parentCategoryId) {
      const parent = await this.categoriesRepository.findById(parentCategoryId);
      if (!parent) {
        throw new NotFoundException(`Parent category with ID '${parentCategoryId}' does not exist.`);
      }
    }
    return this.categoriesRepository.getNextDisplayOrder(parentCategoryId);
  }

  /**
   * Get flat list with pagination, search, and parent filters
   */
  async getCategories(query: QueryCategoryDto) {
    const result = await this.categoriesRepository.findAll(query);
    const parentId =
      query.parentCategoryId && query.parentCategoryId !== 'all'
        ? query.parentCategoryId === 'null' || query.parentCategoryId === 'root'
          ? null
          : query.parentCategoryId
        : null;
    const nextDisplayOrder = await this.categoriesRepository.getNextDisplayOrder(parentId);
    return {
      ...result,
      nextDisplayOrder,
    };
  }

  /**
   * Get full hierarchical category tree.
   * If activeOnly = true, inactive parents and their subtrees are automatically pruned.
   */
  async getCategoryTree(activeOnly: boolean = false): Promise<CategoryTreeNode[]> {
    const flatRows = await this.categoriesRepository.findTree(activeOnly);

    const nodeMap = new Map<string, CategoryTreeNode>();
    const rootNodes: CategoryTreeNode[] = [];

    // First pass: instantiate all tree node objects
    for (const row of flatRows) {
      const breadcrumbs: BreadcrumbItem[] = [];
      if (row.path_names && row.path_slugs) {
        for (let i = 0; i < row.path_names.length; i++) {
          breadcrumbs.push({
            name: row.path_names[i],
            slug: row.path_slugs[i] || '',
          });
        }
      }

      const node: CategoryTreeNode = {
        categoryId: row.category_id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        parentCategoryId: row.parent_category_id,
        icon: row.icon,
        displayOrder: row.display_order,
        isActive: row.is_active,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        depth: row.depth ?? 0,
        path: breadcrumbs,
        children: [],
      };

      nodeMap.set(node.categoryId, node);
    }

    // Second pass: wire parent-child relationships
    for (const row of flatRows) {
      const node = nodeMap.get(row.category_id)!;
      if (row.parent_category_id && nodeMap.has(row.parent_category_id)) {
        const parent = nodeMap.get(row.parent_category_id)!;
        parent.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Third pass: deterministic sorting of children at every tree depth
    this.sortTreeNodes(rootNodes);

    return rootNodes;
  }

  /**
   * Get category detail by primary key UUID
   */
  async getCategoryById(categoryId: string): Promise<CategoryDetailResponse> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID '${categoryId}' not found.`);
    }

    const ancestors = await this.categoriesRepository.getAncestors(categoryId);
    const breadcrumbs: BreadcrumbItem[] = ancestors.map((a) => ({
      name: a.name,
      slug: a.slug,
    }));

    const children = await this.categoriesRepository.getImmediateChildren(categoryId);
    const maxChildOrder = children.reduce((max, c) => Math.max(max, c.display_order), 0);
    const nextDisplayOrder = maxChildOrder + 1;

    return {
      categoryId: category.category_id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentCategoryId: category.parent_category_id,
      icon: category.icon,
      displayOrder: category.display_order,
      isActive: category.is_active,
      createdBy: category.created_by,
      createdAt: new Date(category.created_at).toISOString(),
      updatedAt: new Date(category.updated_at).toISOString(),
      breadcrumbs,
      nextDisplayOrder,
      children: children.map((c) => ({
        categoryId: c.category_id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        icon: c.icon,
        displayOrder: c.display_order,
        isActive: c.is_active,
      })),
    };
  }

  /**
   * Get category detail by SEO slug
   */
  async getCategoryBySlug(slug: string): Promise<CategoryDetailResponse> {
    const category = await this.categoriesRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundException(`Category with slug '${slug}' not found.`);
    }

    return this.getCategoryById(category.category_id);
  }

  /**
   * Update category with cycle prevention and sibling duplicate checks
   */
  async updateCategory(
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryRow> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID '${categoryId}' not found.`);
    }

    // 1. Parent Category Validation & Circular Hierarchy Prevention
    let targetParentId = category.parent_category_id;
    if (dto.parentCategoryId !== undefined) {
      targetParentId = dto.parentCategoryId;

      if (targetParentId) {
        // Prevent self-parenting
        if (targetParentId === categoryId) {
          throw new BadRequestException('A category cannot be its own parent.');
        }

        // Verify parent category exists
        const parent = await this.categoriesRepository.findById(targetParentId);
        if (!parent) {
          throw new NotFoundException(`Parent category with ID '${targetParentId}' does not exist.`);
        }

        // Circular hierarchy check
        const isCycle = await this.categoriesRepository.checkCircularDependency(
          categoryId,
          targetParentId,
        );
        if (isCycle) {
          throw new BadRequestException(
            'Circular hierarchy detected: A category cannot be moved underneath one of its own subcategories.',
          );
        }
      }
    }

    // 2. Sibling Duplicate Check
    const targetName = dto.name !== undefined ? dto.name.trim() : category.name;
    const existingSibling = await this.categoriesRepository.findByNameAndParent(
      targetName,
      targetParentId,
      categoryId,
    );
    if (existingSibling) {
      throw new ConflictException(
        `A category named '${targetName}' already exists under the target parent category.`,
      );
    }

    // 3. Slug Update / Validation
    let updatedSlug: string | undefined = undefined;
    if (dto.slug !== undefined) {
      const rawSlug = this.slugify(dto.slug);
      updatedSlug = await this.resolveUniqueSlug(rawSlug, categoryId);
    } else if (dto.name !== undefined && dto.name.trim() !== category.name) {
      const rawSlug = this.slugify(dto.name);
      updatedSlug = await this.resolveUniqueSlug(rawSlug, categoryId);
    }

    // 4. Perform dynamic update
    const updated = await this.categoriesRepository.update(categoryId, {
      name: dto.name ? dto.name.trim() : undefined,
      slug: updatedSlug,
      description: dto.description !== undefined ? dto.description : undefined,
      parentCategoryId: dto.parentCategoryId !== undefined ? dto.parentCategoryId : undefined,
      icon: dto.icon !== undefined ? dto.icon : undefined,
      displayOrder: dto.displayOrder !== undefined ? dto.displayOrder : undefined,
      isActive: dto.isActive !== undefined ? dto.isActive : undefined,
    });

    if (!updated) {
      throw new NotFoundException(`Failed to update category with ID '${categoryId}'.`);
    }

    return updated;
  }

  /**
   * Activate or deactivate category (with optional cascading to all descendants)
   */
  async updateStatus(
    categoryId: string,
    dto: UpdateCategoryStatusDto,
  ): Promise<{ updatedCount: number; items: CategoryRow[] }> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID '${categoryId}' not found.`);
    }

    if (dto.cascade) {
      const items = await this.categoriesRepository.updateStatusCascade(categoryId, dto.isActive);
      return {
        updatedCount: items.length,
        items,
      };
    } else {
      const updated = await this.categoriesRepository.updateStatusSingle(categoryId, dto.isActive);
      return {
        updatedCount: updated ? 1 : 0,
        items: updated ? [updated] : [],
      };
    }
  }

  /**
   * Delete category safely:
   * 1. Verifies if any courses reference the category or its descendants
   * 2. Verifies if child categories exist (requires cascade=true)
   * 3. Executes deletion atomically inside an SQL transaction
   */
  async deleteCategory(
    categoryId: string,
    cascade: boolean = false,
  ): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const category = await this.categoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException(`Category with ID '${categoryId}' not found.`);
    }

    // 1. Collect all category IDs in the subtree
    const subtreeIds = await this.categoriesRepository.findSubtreeCategoryIds(categoryId);

    // 2. Check if courses reference any category in the subtree
    const assignedCoursesCount = await this.categoriesRepository.countCoursesAssigned(subtreeIds);
    if (assignedCoursesCount > 0) {
      throw new ConflictException(
        `Cannot delete category '${category.name}': ${assignedCoursesCount} course(s) are currently assigned to this category or its subcategories. Reassign or delete dependent courses first, or deactivate the category instead.`,
      );
    }

    // 3. Check for subcategories if cascade is not enabled
    const directChildrenCount = await this.categoriesRepository.countDirectChildren(categoryId);
    if (directChildrenCount > 0 && !cascade) {
      throw new ConflictException(
        `Category '${category.name}' has ${directChildrenCount} subcategory/subcategories. Pass ?cascade=true to delete the category and all its subcategories, or remove/reassign subcategories first.`,
      );
    }

    // 4. Execute atomic deletion inside transaction
    const totalDeleted = await this.databaseService.withTransaction(async (client) => {
      if (cascade && subtreeIds.length > 1) {
        return this.categoriesRepository.deleteSubtree(subtreeIds, client);
      } else {
        const deleted = await this.categoriesRepository.deleteSingle(categoryId, client);
        return deleted ? 1 : 0;
      }
    });

    return {
      success: true,
      deletedCount: totalDeleted,
      message: `Category '${category.name}' ${
        cascade && totalDeleted > 1 ? `and ${totalDeleted - 1} subcategories` : ''
      } successfully deleted.`,
    };
  }
}


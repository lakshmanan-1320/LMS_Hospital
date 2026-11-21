import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CategoryRow } from './interfaces/category.interface';
import { QueryCategoryDto } from './dto/query-category.dto';

@Injectable()
export class CategoriesRepository {
  private readonly logger = new Logger(CategoriesRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Helper to execute queries on a dedicated transaction client or connection pool.
   */
  private async executeQuery<T = any>(
    sql: string,
    params: any[] = [],
    client?: PoolClient,
  ) {
    if (client) {
      return client.query<T>(sql, params);
    }
    return this.databaseService.query<T>(sql, params);
  }

  /**
   * Insert a new category
   */
  async create(
    data: {
      name: string;
      slug: string;
      description?: string | null;
      parentCategoryId?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
      createdBy?: string | null;
    },
    client?: PoolClient,
  ): Promise<CategoryRow> {
    const sql = `
      INSERT INTO categories (
        name,
        slug,
        description,
        parent_category_id,
        icon,
        display_order,
        is_active,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const params = [
      data.name.trim(),
      data.slug.trim(),
      data.description ?? null,
      data.parentCategoryId ?? null,
      data.icon ?? null,
      data.displayOrder ?? 0,
      data.isActive ?? true,
      data.createdBy ?? null,
    ];

    const result = await this.executeQuery<CategoryRow>(sql, params, client);
    return result.rows[0];
  }

  /**
   * Get next sequential display order for root or children under parent
   */
  async getNextDisplayOrder(
    parentCategoryId?: string | null,
    client?: PoolClient,
  ): Promise<number> {
    const sql = `
      SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
      FROM categories
      WHERE parent_category_id IS NOT DISTINCT FROM $1;
    `;
    const result = await this.executeQuery<{ next_order: number | string }>(
      sql,
      [parentCategoryId ?? null],
      client,
    );
    const nextOrder = Number(result.rows[0]?.next_order);
    return isNaN(nextOrder) || nextOrder < 1 ? 1 : nextOrder;
  }

  /**
   * Find category by primary key UUID
   */
  async findById(categoryId: string, client?: PoolClient): Promise<CategoryRow | null> {
    const sql = `SELECT * FROM categories WHERE category_id = $1;`;
    const result = await this.executeQuery<CategoryRow>(sql, [categoryId], client);
    return result.rows[0] || null;
  }

  /**
   * Find category by unique URL slug
   */
  async findBySlug(slug: string, client?: PoolClient): Promise<CategoryRow | null> {
    const sql = `SELECT * FROM categories WHERE slug = $1;`;
    const result = await this.executeQuery<CategoryRow>(sql, [slug.trim().toLowerCase()], client);
    return result.rows[0] || null;
  }

  /**
   * Find sibling category with identical name under same parent (case-insensitive)
   */
  async findByNameAndParent(
    name: string,
    parentCategoryId?: string | null,
    excludeId?: string,
    client?: PoolClient,
  ): Promise<CategoryRow | null> {
    let sql = `
      SELECT * FROM categories
      WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
        AND parent_category_id IS NOT DISTINCT FROM $2
    `;
    const params: any[] = [name, parentCategoryId ?? null];

    if (excludeId) {
      params.push(excludeId);
      sql += ` AND category_id != $${params.length}`;
    }

    sql += ` LIMIT 1;`;
    const result = await this.executeQuery<CategoryRow>(sql, params, client);
    return result.rows[0] || null;
  }

  /**
   * Check if slug is used by any other category
   */
  async findBySlugExclude(
    slug: string,
    excludeId: string,
    client?: PoolClient,
  ): Promise<CategoryRow | null> {
    const sql = `SELECT * FROM categories WHERE slug = $1 AND category_id != $2 LIMIT 1;`;
    const result = await this.executeQuery<CategoryRow>(sql, [slug.trim().toLowerCase(), excludeId], client);
    return result.rows[0] || null;
  }

  /**
   * Flat paginated list with optional search and parent filtering
   */
  async findAll(query: QueryCategoryDto): Promise<{ items: CategoryRow[]; total: number; page: number; limit: number }> {
    const { search, parentCategoryId, isActive, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`);
    }

    if (parentCategoryId !== undefined) {
      if (parentCategoryId === 'null' || parentCategoryId === 'root') {
        conditions.push(`parent_category_id IS NULL`);
      } else {
        params.push(parentCategoryId);
        conditions.push(`parent_category_id = $${params.length}`);
      }
    }

    if (isActive !== undefined) {
      params.push(isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS total FROM categories ${whereClause};`;
    const countResult = await this.executeQuery<{ total: number }>(countSql, params);
    const total = countResult.rows[0]?.total || 0;

    params.push(limit);
    const limitIndex = params.length;
    params.push(offset);
    const offsetIndex = params.length;

    const dataSql = `
      SELECT * FROM categories
      ${whereClause}
      ORDER BY parent_category_id ASC NULLS FIRST, display_order ASC, LOWER(name) ASC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;

    const dataResult = await this.executeQuery<CategoryRow>(dataSql, params);
    return {
      items: dataResult.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Hierarchical recursive tree query using PostgreSQL recursive CTE.
   * If activeOnly = true, inactive parent subtrees are automatically pruned.
   */
  async findTree(activeOnly: boolean = false): Promise<CategoryRow[]> {
    const sql = `
      WITH RECURSIVE category_tree AS (
          -- Anchor member: Root categories
          SELECT 
              c.category_id,
              c.name,
              c.slug,
              c.description,
              c.parent_category_id,
              c.icon,
              c.display_order,
              c.is_active,
              c.created_by,
              c.created_at,
              c.updated_at,
              0 AS depth,
              ARRAY[c.name::text] AS path_names,
              ARRAY[c.slug::text] AS path_slugs
          FROM categories c
          WHERE c.parent_category_id IS NULL
            AND ($1::boolean = FALSE OR c.is_active = TRUE)
          
          UNION ALL
          
          -- Recursive member: Join children only if parent is part of result
          SELECT 
              child.category_id,
              child.name,
              child.slug,
              child.description,
              child.parent_category_id,
              child.icon,
              child.display_order,
              child.is_active,
              child.created_by,
              child.created_at,
              child.updated_at,
              parent.depth + 1,
              parent.path_names || child.name::text,
              parent.path_slugs || child.slug::text
          FROM categories child
          JOIN category_tree parent ON child.parent_category_id = parent.category_id
          WHERE ($1::boolean = FALSE OR child.is_active = TRUE)
      )
      SELECT * FROM category_tree 
      ORDER BY depth ASC, display_order ASC, LOWER(name) ASC;
    `;

    const result = await this.executeQuery<CategoryRow>(sql, [activeOnly]);
    return result.rows;
  }

  /**
   * Get direct immediate children of a category
   */
  async getImmediateChildren(
    categoryId: string,
    activeOnly: boolean = false,
    client?: PoolClient,
  ): Promise<CategoryRow[]> {
    let sql = `
      SELECT * FROM categories
      WHERE parent_category_id = $1
    `;
    const params: any[] = [categoryId];

    if (activeOnly) {
      sql += ` AND is_active = TRUE`;
    }

    sql += ` ORDER BY display_order ASC, LOWER(name) ASC;`;
    const result = await this.executeQuery<CategoryRow>(sql, params, client);
    return result.rows;
  }

  /**
   * Count direct immediate child categories
   */
  async countDirectChildren(categoryId: string, client?: PoolClient): Promise<number> {
    const sql = `SELECT COUNT(*)::int AS count FROM categories WHERE parent_category_id = $1;`;
    const result = await this.executeQuery<{ count: number }>(sql, [categoryId], client);
    return result.rows[0]?.count || 0;
  }

  /**
   * Get ancestor breadcrumb path for a category (from root down to current)
   */
  async getAncestors(categoryId: string, client?: PoolClient): Promise<CategoryRow[]> {
    const sql = `
      WITH RECURSIVE ancestry AS (
          SELECT *, 0 AS level
          FROM categories
          WHERE category_id = $1
          
          UNION ALL
          
          SELECT parent.*, a.level + 1
          FROM categories parent
          JOIN ancestry a ON parent.category_id = a.parent_category_id
      )
      SELECT * FROM ancestry ORDER BY level DESC;
    `;
    const result = await this.executeQuery<CategoryRow>(sql, [categoryId], client);
    return result.rows;
  }

  /**
   * Check if targetCategoryId is an ancestor of proposedParentId (Circular Hierarchy Check)
   */
  async checkCircularDependency(
    targetCategoryId: string,
    proposedParentId: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const sql = `
      WITH RECURSIVE ancestry AS (
          SELECT category_id, parent_category_id
          FROM categories
          WHERE category_id = $1
          
          UNION ALL
          
          SELECT c.category_id, c.parent_category_id
          FROM categories c
          JOIN ancestry a ON c.category_id = a.parent_category_id
      )
      SELECT 1 FROM ancestry WHERE category_id = $2 LIMIT 1;
    `;
    const result = await this.executeQuery(sql, [proposedParentId, targetCategoryId], client);
    return result.rows.length > 0;
  }

  /**
   * Retrieve all descendant IDs within a category subtree (including root)
   */
  async findSubtreeCategoryIds(categoryId: string, client?: PoolClient): Promise<string[]> {
    const sql = `
      WITH RECURSIVE subtree AS (
          SELECT category_id, 0 as depth
          FROM categories
          WHERE category_id = $1
          
          UNION ALL
          
          SELECT c.category_id, s.depth + 1
          FROM categories c
          JOIN subtree s ON c.parent_category_id = s.category_id
      )
      SELECT category_id FROM subtree ORDER BY depth DESC;
    `;
    const result = await this.executeQuery<{ category_id: string }>(sql, [categoryId], client);
    return result.rows.map((r) => r.category_id);
  }

  /**
   * Check if any courses reference any of the provided category IDs
   */
  async countCoursesAssigned(categoryIds: string[], client?: PoolClient): Promise<number> {
    if (!categoryIds || categoryIds.length === 0) {
      return 0;
    }

    // Verify if courses table exists in PostgreSQL schema
    const checkTableSql = `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'courses'
      ) as exists;
    `;
    const tableCheck = await this.executeQuery<{ exists: boolean }>(checkTableSql, [], client);
    if (!tableCheck.rows[0]?.exists) {
      return 0;
    }

    const countSql = `
      SELECT COUNT(*)::int AS count 
      FROM courses 
      WHERE category_id = ANY($1::uuid[]);
    `;
    const result = await this.executeQuery<{ count: number }>(countSql, [categoryIds], client);
    return result.rows[0]?.count || 0;
  }

  /**
   * Update category fields dynamically
   */
  async update(
    categoryId: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      parentCategoryId?: string | null;
      icon?: string | null;
      displayOrder?: number;
      isActive?: boolean;
    },
    client?: PoolClient,
  ): Promise<CategoryRow | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      params.push(data.name.trim());
      updates.push(`name = $${params.length}`);
    }

    if (data.slug !== undefined) {
      params.push(data.slug.trim());
      updates.push(`slug = $${params.length}`);
    }

    if (data.description !== undefined) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }

    if (data.parentCategoryId !== undefined) {
      params.push(data.parentCategoryId);
      updates.push(`parent_category_id = $${params.length}`);
    }

    if (data.icon !== undefined) {
      params.push(data.icon);
      updates.push(`icon = $${params.length}`);
    }

    if (data.displayOrder !== undefined) {
      params.push(data.displayOrder);
      updates.push(`display_order = $${params.length}`);
    }

    if (data.isActive !== undefined) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.findById(categoryId, client);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(categoryId);
    const sql = `
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE category_id = $${params.length}
      RETURNING *;
    `;

    const result = await this.executeQuery<CategoryRow>(sql, params, client);
    return result.rows[0] || null;
  }

  /**
   * Update active status for single category
   */
  async updateStatusSingle(
    categoryId: string,
    isActive: boolean,
    client?: PoolClient,
  ): Promise<CategoryRow | null> {
    const sql = `
      UPDATE categories
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE category_id = $2
      RETURNING *;
    `;
    const result = await this.executeQuery<CategoryRow>(sql, [isActive, categoryId], client);
    return result.rows[0] || null;
  }

  /**
   * Cascading status toggle for category and all its descendants
   */
  async updateStatusCascade(
    categoryId: string,
    isActive: boolean,
    client?: PoolClient,
  ): Promise<CategoryRow[]> {
    const sql = `
      WITH RECURSIVE subtree AS (
          SELECT category_id
          FROM categories
          WHERE category_id = $1
          
          UNION ALL
          
          SELECT c.category_id
          FROM categories c
          JOIN subtree s ON c.parent_category_id = s.category_id
      )
      UPDATE categories
      SET is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE category_id IN (SELECT category_id FROM subtree)
      RETURNING *;
    `;
    const result = await this.executeQuery<CategoryRow>(sql, [categoryId, isActive], client);
    return result.rows;
  }

  /**
   * Delete single category
   */
  async deleteSingle(categoryId: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM categories WHERE category_id = $1;`;
    const result = await this.executeQuery(sql, [categoryId], client);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Delete category IDs bottom-up (leaves first to avoid FK restrict violation)
   */
  async deleteSubtree(categoryIds: string[], client?: PoolClient): Promise<number> {
    if (!categoryIds || categoryIds.length === 0) return 0;

    let totalDeleted = 0;
    // categoryIds are already returned depth DESC from findSubtreeCategoryIds
    for (const id of categoryIds) {
      const sql = `DELETE FROM categories WHERE category_id = $1;`;
      const result = await this.executeQuery(sql, [id], client);
      totalDeleted += result.rowCount ?? 0;
    }
    return totalDeleted;
  }
}


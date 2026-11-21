-- ==========================================================
-- Migration: 003_category_management.sql
-- Description: Dynamic Categories and Hierarchical Subcategories
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES categories(category_id) ON DELETE RESTRICT,
    icon VARCHAR(255),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. INDEXES
-- Note: UNIQUE(slug) already generates an index; idx_categories_slug is omitted to prevent redundancy.
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON categories(display_order);

-- Composite index preventing duplicate names under the same parent node
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name_parent 
ON categories(LOWER(TRIM(name)), COALESCE(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3. ENSURE PERMISSIONS EXIST IN DATABASE
INSERT INTO permissions (code, description) VALUES
    ('categories:manage', 'Manage LMS departments, tracks, and categories'),
    ('categories:view', 'View active categories in the public catalogue')
ON CONFLICT (code) DO NOTHING;

-- Map categories:manage to ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.code = 'categories:manage'
ON CONFLICT DO NOTHING;

-- Map permissions to SUPER_ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN' AND p.code IN ('categories:manage', 'categories:view')
ON CONFLICT DO NOTHING;


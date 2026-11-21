-- ==========================================================
-- Migration: 006_instructor_profiles.sql
-- Description: Instructor Profile Module (Backend)
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

-- 1. Create instructor_profiles table
CREATE TABLE IF NOT EXISTS instructor_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  headline VARCHAR(120),
  bio TEXT,
  avatar_url VARCHAR(500),
  experience_years INTEGER CHECK (experience_years >= 0),
  qualifications JSONB DEFAULT '[]'::jsonb,
  expertise TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  website_url VARCHAR(500),
  linkedin_url VARCHAR(500),
  github_url VARCHAR(500),
  twitter_url VARCHAR(500),
  youtube_url VARCHAR(500),
  facebook_url VARCHAR(500),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Indexes for efficient lookup, directory filtering, and array search
CREATE INDEX IF NOT EXISTS idx_instructor_profiles_user_id ON instructor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_instructor_profiles_is_public ON instructor_profiles(is_public);
CREATE INDEX IF NOT EXISTS idx_instructor_profiles_expertise ON instructor_profiles USING GIN(expertise);
CREATE INDEX IF NOT EXISTS idx_instructor_profiles_skills ON instructor_profiles USING GIN(skills);

-- 3. Dynamic permissions for Instructor Profile module
INSERT INTO permissions (code, description) VALUES
  ('instructors:manage_own', 'View and manage own instructor profile, qualifications, skills, and avatar'),
  ('instructors:manage', 'Admin access to view, update, moderate, and toggle visibility of any instructor profile')
ON CONFLICT (code) DO NOTHING;

-- 4. Map instructors:manage_own to INSTRUCTOR, ADMIN, and SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name IN ('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
  AND p.code = 'instructors:manage_own'
ON CONFLICT DO NOTHING;

-- 5. Map instructors:manage to ADMIN and SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name IN ('ADMIN', 'SUPER_ADMIN')
  AND p.code = 'instructors:manage'
ON CONFLICT DO NOTHING;


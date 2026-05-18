-- Migration: 001_rbac
-- Auth & RBAC schema per SPEC sections 6.1 and 8

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  head_user_id UUID, -- FK added after users table is ready
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table (extended with company_id and uuid)
-- Note: existing users table uses serial id; new flow uses uuid
CREATE TABLE IF NOT EXISTS rbac_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE(company_id, email)
);

-- Company-level roles
CREATE TYPE company_role_level AS ENUM ('super_admin', 'admin', 'employee', 'guest');

CREATE TABLE IF NOT EXISTS company_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role company_role_level NOT NULL DEFAULT 'employee',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Department-level roles
CREATE TYPE department_role_level AS ENUM ('department_head', 'member');

CREATE TABLE IF NOT EXISTS department_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role department_role_level NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, department_id)
);

-- Space/Board-level ACL roles
CREATE TYPE object_role_level AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE IF NOT EXISTS object_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES rbac_users(id) ON DELETE CASCADE,
  object_type VARCHAR(50) NOT NULL, -- 'space', 'board', 'page'
  object_id UUID NOT NULL,
  role object_role_level NOT NULL DEFAULT 'viewer',
  inherited BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, object_type, object_id)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES rbac_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,         -- 'user.register', 'role.change', 'page.create', etc.
  object_type VARCHAR(50),               -- 'user', 'role', 'page', 'board', etc.
  object_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,                        -- extra context (IP, user-agent, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rbac_users_company_id ON rbac_users(company_id);
CREATE INDEX IF NOT EXISTS idx_rbac_users_email ON rbac_users(email);
CREATE INDEX IF NOT EXISTS idx_rbac_users_deleted_at ON rbac_users(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_roles_user_id ON company_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_roles_company_id ON company_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_user_id ON department_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_department_id ON department_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_object_roles_user_id ON object_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_object_roles_object ON object_roles(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_object ON audit_log(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_departments_head_user_id ON departments(head_user_id);

-- Add foreign key for department head (after users table exists)
ALTER TABLE departments ADD CONSTRAINT fk_departments_head_user
  FOREIGN KEY (head_user_id) REFERENCES rbac_users(id) ON DELETE SET NULL;

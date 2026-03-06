-- Migration: Add project_order and client_code columns for 9-digit project codes
-- Format: XXXYYYZZZ where XXX=project_order, YYY=client_code, ZZZ=project_count_per_client

-- Add client_code to companies (sequential code for each client)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS client_code INTEGER;

-- Add project_order to projects (global sequential order)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_order INTEGER;

-- Unique constraint: same name + same company = duplicate
ALTER TABLE projects ADD CONSTRAINT uq_projects_name_company UNIQUE (name, company_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_companies_client_code ON companies(client_code);
CREATE INDEX IF NOT EXISTS idx_projects_project_order ON projects(project_order);

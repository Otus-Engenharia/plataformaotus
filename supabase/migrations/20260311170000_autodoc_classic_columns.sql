-- Add columns needed for Autodoc Classic API support
ALTER TABLE autodoc_project_mappings
  ADD COLUMN IF NOT EXISTS use_classic_api BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS classic_instance_id TEXT;

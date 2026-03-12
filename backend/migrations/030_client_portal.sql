-- Migration 030: Client Portal
-- Adds portal access fields to contacts and creates audit log table

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS has_portal_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supabase_auth_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_supabase_auth_id
  ON contacts(supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS client_portal_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  action TEXT NOT NULL,
  project_code TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

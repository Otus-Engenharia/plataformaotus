-- Migration: Autodoc Incremental Sync
-- Adiciona colunas de tracking per-mapping para sync incremental.
-- Permite skip de projetos sem mudancas (quick count check, time-based skip, fingerprint check).

ALTER TABLE autodoc_project_mappings
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS last_doc_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_doc_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_duration_ms INTEGER;

-- Migração: Criar tabelas de IFC Change Log
-- Domínio: Monitoramento de alterações em pastas IFC do Google Drive
-- Deve ser executado APÓS migrations anteriores
-- Data: 2026-03-02

-- ============================================================================
-- Tabela: ifc_file_snapshots
-- Snapshot atual de cada arquivo nas pastas IFC monitoradas
-- ============================================================================
CREATE TABLE IF NOT EXISTS ifc_file_snapshots (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  md5_checksum TEXT,
  drive_created_time TIMESTAMPTZ,
  drive_modified_time TIMESTAMPTZ,
  parsed_base_name TEXT,
  parsed_phase TEXT,
  parsed_revision TEXT,
  parsed_discipline TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  UNIQUE(project_code, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_ifs_project ON ifc_file_snapshots(project_code);
CREATE INDEX IF NOT EXISTS idx_ifs_folder ON ifc_file_snapshots(drive_folder_id);
CREATE INDEX IF NOT EXISTS idx_ifs_base_name ON ifc_file_snapshots(project_code, parsed_base_name);

ALTER TABLE ifc_file_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ifs_select_auth" ON ifc_file_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "ifs_insert_auth" ON ifc_file_snapshots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ifs_update_auth" ON ifc_file_snapshots FOR UPDATE TO authenticated USING (true);

-- ============================================================================
-- Tabela: ifc_change_logs
-- Registro de cada mudança detectada
-- ============================================================================
CREATE TABLE IF NOT EXISTS ifc_change_logs (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('nova_revisao', 'mudanca_fase', 'novo_arquivo')),
  file_name TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  parsed_base_name TEXT,
  previous_revision TEXT,
  new_revision TEXT,
  previous_phase TEXT,
  new_phase TEXT,
  file_size BIGINT,
  drive_modified_time TIMESTAMPTZ,
  scanned_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icl_project ON ifc_change_logs(project_code);
CREATE INDEX IF NOT EXISTS idx_icl_category ON ifc_change_logs(category);
CREATE INDEX IF NOT EXISTS idx_icl_created ON ifc_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_icl_project_created ON ifc_change_logs(project_code, created_at DESC);

ALTER TABLE ifc_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icl_select_auth" ON ifc_change_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "icl_insert_auth" ON ifc_change_logs FOR INSERT TO authenticated WITH CHECK (true);

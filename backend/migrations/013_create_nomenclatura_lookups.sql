-- Migração: Criar tabela de lookup auxiliar para nomenclatura
-- Domínio: Tabelas de siglas (De-Para) para parâmetros de nomenclatura por projeto
-- Data: 2026-03-04

-- ============================================================================
-- Tabela: nomenclatura_lookup_entries
-- Armazena as siglas válidas para cada parâmetro de nomenclatura por projeto
-- Ex: DISCIPLINA -> Arquitetura=ARQ, Estrutura=EST, etc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS nomenclatura_lookup_entries (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  param_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_code, param_name, abbreviation)
);

CREATE INDEX IF NOT EXISTS idx_nle_project_param
  ON nomenclatura_lookup_entries(project_code, param_name);

ALTER TABLE nomenclatura_lookup_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nle_select_auth" ON nomenclatura_lookup_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "nle_insert_auth" ON nomenclatura_lookup_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "nle_update_auth" ON nomenclatura_lookup_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "nle_delete_auth" ON nomenclatura_lookup_entries FOR DELETE TO authenticated USING (true);

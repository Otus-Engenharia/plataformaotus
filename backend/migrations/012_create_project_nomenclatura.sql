-- Migração: Criar tabela de nomenclatura de arquivos por projeto
-- Domínio: Configuração de padrões de nomes de arquivos (modelos IFC/RVT e pranchas DWG/PDF)
-- Data: 2026-03-03

-- ============================================================================
-- Tabela: project_nomenclatura
-- Armazena o padrão de nomenclatura configurado para cada projeto
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_nomenclatura (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('modelos', 'pranchas')),
  padrao_template TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_code, tipo)
);

CREATE INDEX IF NOT EXISTS idx_pn_project ON project_nomenclatura(project_code);

ALTER TABLE project_nomenclatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pn_select_auth" ON project_nomenclatura FOR SELECT TO authenticated USING (true);
CREATE POLICY "pn_insert_auth" ON project_nomenclatura FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pn_update_auth" ON project_nomenclatura FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pn_delete_auth" ON project_nomenclatura FOR DELETE TO authenticated USING (true);

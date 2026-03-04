-- Migração: Criar tabela de marcos do projeto
-- Domínio: Marcos do Projeto - CRUD com importação do Smartsheet
-- Data: 2026-03-04

-- ============================================================================
-- Tabela: marcos_projeto
-- Armazena marcos (milestones) de cada projeto, com suporte a importação
-- do Smartsheet e cadastro manual.
-- ============================================================================
CREATE TABLE IF NOT EXISTS marcos_projeto (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  prazo_baseline DATE,
  prazo_atual DATE,
  variacao_dias INTEGER DEFAULT 0,
  descricao TEXT,
  source TEXT DEFAULT 'manual',
  smartsheet_task_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_code, nome)
);

CREATE INDEX IF NOT EXISTS idx_marcos_projeto_code
  ON marcos_projeto(project_code);

ALTER TABLE marcos_projeto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marcos_select_auth" ON marcos_projeto FOR SELECT TO authenticated USING (true);
CREATE POLICY "marcos_insert_auth" ON marcos_projeto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marcos_update_auth" ON marcos_projeto FOR UPDATE TO authenticated USING (true);
CREATE POLICY "marcos_delete_auth" ON marcos_projeto FOR DELETE TO authenticated USING (true);

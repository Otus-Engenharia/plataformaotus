-- ============================================
-- Tabela para anotações do Log de Alterações
-- Supabase: overlay editável pelo coordenador
-- Dados brutos ficam no BigQuery (smartsheet_snapshot)
-- ============================================

CREATE TABLE IF NOT EXISTS curva_s_change_annotations (
  id BIGSERIAL PRIMARY KEY,

  -- Escopo
  project_code TEXT NOT NULL,
  from_snapshot_date DATE NOT NULL,
  to_snapshot_date DATE NOT NULL,

  -- Identificação da mudança
  change_type TEXT NOT NULL CHECK (change_type IN (
    'DESVIO_PRAZO', 'TAREFA_CRIADA', 'TAREFA_DELETADA', 'TAREFA_NAO_FEITA'
  )),
  task_name TEXT NOT NULL,
  disciplina TEXT,

  -- Conteúdo da anotação (editável pelo coordenador)
  description TEXT,
  justification TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,

  -- Metadados
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Uma anotação por mudança por par de meses
  UNIQUE(project_code, from_snapshot_date, to_snapshot_date, change_type, task_name)
);

CREATE INDEX IF NOT EXISTS idx_change_annotations_project
  ON curva_s_change_annotations(project_code);

CREATE INDEX IF NOT EXISTS idx_change_annotations_dates
  ON curva_s_change_annotations(project_code, from_snapshot_date, to_snapshot_date);

ALTER TABLE curva_s_change_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON curva_s_change_annotations FOR SELECT USING (true);
CREATE POLICY "insert_all" ON curva_s_change_annotations FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON curva_s_change_annotations FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON curva_s_change_annotations FOR DELETE USING (true);

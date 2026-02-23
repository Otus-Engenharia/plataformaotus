-- ============================================
-- Tabelas para o domínio de Baselines
-- Supabase: metadados  |  BigQuery: snapshots
-- ============================================

-- =====================
-- SUPABASE
-- =====================

CREATE TABLE IF NOT EXISTS baselines (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  revision_number INT NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  created_by_email TEXT,
  snapshot_date DATE NOT NULL,
  task_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  source TEXT NOT NULL DEFAULT 'platform',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_code, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_baselines_project ON baselines(project_code);
CREATE INDEX IF NOT EXISTS idx_baselines_active ON baselines(is_active);

ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_all" ON baselines FOR SELECT USING (true);
CREATE POLICY "insert_all" ON baselines FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON baselines FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON baselines FOR DELETE USING (true);

-- =====================
-- BIGQUERY (executar via bq ou console)
-- =====================
-- CREATE TABLE smartsheet_atrasos.baseline_task_snapshots (
--   baseline_id INT64 NOT NULL,
--   project_code STRING NOT NULL,
--   row_number INT64,
--   nome_tarefa STRING,
--   data_inicio DATE,
--   data_termino DATE,
--   status STRING,
--   disciplina STRING,
--   fase_nome STRING,
--   level INT64,
--   snapshot_date DATE,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
-- );

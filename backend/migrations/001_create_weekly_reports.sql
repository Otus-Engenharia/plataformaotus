-- Migração: Criar tabela weekly_reports
-- Domínio: Relatórios Semanais
-- Data: 2026-02-27

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  week_year INTEGER NOT NULL CHECK (week_year >= 2020),
  week_text TEXT,
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  current_step TEXT CHECK (current_step IN ('fetching_data', 'processing', 'generating_html', 'uploading_drive', 'creating_drafts', NULL)),
  client_report_drive_url TEXT,
  team_report_drive_url TEXT,
  client_draft_url TEXT,
  team_draft_url TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project ON weekly_reports(project_code, week_year, week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_year, week_number);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_status ON weekly_reports(status);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_generated_at ON weekly_reports(generated_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Policy: todos os usuários autenticados podem ler
CREATE POLICY "weekly_reports_select_authenticated"
  ON weekly_reports FOR SELECT
  TO authenticated
  USING (true);

-- Policy: todos os usuários autenticados podem inserir
CREATE POLICY "weekly_reports_insert_authenticated"
  ON weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: todos os usuários autenticados podem atualizar
CREATE POLICY "weekly_reports_update_authenticated"
  ON weekly_reports FOR UPDATE
  TO authenticated
  USING (true);

-- Comentário na tabela
COMMENT ON TABLE weekly_reports IS 'Registros de relatórios semanais gerados pela Plataforma Otus';
COMMENT ON COLUMN weekly_reports.project_code IS 'Código normalizado do projeto (ex: OT-0001)';
COMMENT ON COLUMN weekly_reports.current_step IS 'Etapa atual do pipeline de geração (para polling do frontend)';
COMMENT ON COLUMN weekly_reports.metadata IS 'Dados extras: contagens, duração, disciplinas, etc.';

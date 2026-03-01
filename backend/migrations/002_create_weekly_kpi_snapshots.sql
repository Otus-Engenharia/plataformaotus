-- Tabela de snapshots semanais para KPIs de relatórios
-- Armazena contagens históricas para acompanhar desempenho do time
-- Snapshot criado automaticamente todo sábado 23:59 BRT via cron job

CREATE TABLE IF NOT EXISTS weekly_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_year INTEGER NOT NULL CHECK (week_year >= 2020),
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 53),
  snapshot_date DATE NOT NULL,
  total_active_projects INTEGER NOT NULL DEFAULT 0,
  projects_report_enabled INTEGER NOT NULL DEFAULT 0,
  reports_sent INTEGER NOT NULL DEFAULT 0,
  pct_report_enabled NUMERIC(5,1) DEFAULT 0,
  pct_reports_sent NUMERIC(5,1) DEFAULT 0,
  leader_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para evitar duplicatas (NULL leader_name = geral)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_snapshots_unique
  ON weekly_kpi_snapshots(week_year, week_number, COALESCE(leader_name, '__all__'));

-- Índice para busca por semana
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_week
  ON weekly_kpi_snapshots(week_year, week_number);

-- RLS
ALTER TABLE weekly_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read snapshots"
  ON weekly_kpi_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert snapshots"
  ON weekly_kpi_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update snapshots"
  ON weekly_kpi_snapshots FOR UPDATE
  TO authenticated
  USING (true);

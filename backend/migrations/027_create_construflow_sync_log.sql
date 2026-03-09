-- Tabela de log para sincronizações sob demanda do Construflow
CREATE TABLE construflow_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  construflow_project_id TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  issues_synced INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_sync_log_project
  ON construflow_sync_log (construflow_project_id, started_at DESC);

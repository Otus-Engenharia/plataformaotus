-- Adicionar colunas de progresso granular ao sync_runs
ALTER TABLE autodoc_sync_runs ADD COLUMN IF NOT EXISTS current_project TEXT;
ALTER TABLE autodoc_sync_runs ADD COLUMN IF NOT EXISTS projects_completed INTEGER DEFAULT 0;
ALTER TABLE autodoc_sync_runs ADD COLUMN IF NOT EXISTS total_projects INTEGER DEFAULT 0;

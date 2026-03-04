-- Migração 016: Evolução do sistema de marcos do projeto
-- Adiciona: edição livre pelo cliente, log de auditoria, solicitações de baseline
-- Data: 2026-03-04

-- ============================================================================
-- 1. Estender marcos_projeto com novos campos
-- ============================================================================

-- Data expectativa do cliente (separada do prazo atual do cronograma)
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS cliente_expectativa_data DATE;

-- Vínculo com tarefa do Smartsheet
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS smartsheet_row_id TEXT;
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS smartsheet_task_name TEXT;
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS vinculado_baseline BOOLEAN DEFAULT false;

-- Quem criou (para distinguir cliente vs. líder)
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS created_by_email TEXT;
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Último snapshot do Smartsheet (para detectar mudanças)
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS last_smartsheet_data_termino DATE;
ALTER TABLE marcos_projeto ADD COLUMN IF NOT EXISTS last_smartsheet_status TEXT;

-- ============================================================================
-- 2. Tabela: marco_edit_log (auditoria de edições)
-- Registra toda mudança (cliente, líder, ou Smartsheet) para acompanhamento.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marco_edit_log (
  id BIGSERIAL PRIMARY KEY,
  marco_id BIGINT REFERENCES marcos_projeto(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL,
  action TEXT NOT NULL,          -- 'criar', 'editar', 'excluir', 'smartsheet_change'
  field_changed TEXT,            -- 'nome', 'cliente_expectativa_data', 'descricao', etc.
  old_value TEXT,
  new_value TEXT,
  edited_by_email TEXT NOT NULL, -- email do usuário ou 'sistema' para mudanças do Smartsheet
  edited_by_name TEXT,
  seen_by_leader BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marco_edit_log_project
  ON marco_edit_log(project_code);

CREATE INDEX IF NOT EXISTS idx_marco_edit_log_unseen
  ON marco_edit_log(seen_by_leader) WHERE seen_by_leader = false;

CREATE INDEX IF NOT EXISTS idx_marco_edit_log_marco
  ON marco_edit_log(marco_id);

-- RLS
ALTER TABLE marco_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marco_edit_log_select_auth" ON marco_edit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "marco_edit_log_insert_auth" ON marco_edit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marco_edit_log_update_auth" ON marco_edit_log FOR UPDATE TO authenticated USING (true);

-- ============================================================================
-- 3. Tabela: marco_baseline_requests (solicitações de nova baseline)
-- Solicitação formal do cliente para nova estratégia de datas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS marco_baseline_requests (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),

  -- Snapshot dos marcos no momento da solicitação
  marcos_snapshot JSONB NOT NULL DEFAULT '[]',

  justificativa TEXT,

  -- Solicitante
  requested_by_email TEXT NOT NULL,
  requested_by_name TEXT,

  -- Revisor
  reviewed_by_email TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marco_baseline_requests_status
  ON marco_baseline_requests(status);

CREATE INDEX IF NOT EXISTS idx_marco_baseline_requests_project
  ON marco_baseline_requests(project_code);

-- RLS
ALTER TABLE marco_baseline_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marco_baseline_requests_select_auth" ON marco_baseline_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "marco_baseline_requests_insert_auth" ON marco_baseline_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "marco_baseline_requests_update_auth" ON marco_baseline_requests FOR UPDATE TO authenticated USING (true);

COMMENT ON TABLE marco_edit_log IS
  'Log de auditoria de edições em marcos do projeto. Registra mudanças do cliente, líder e Smartsheet.';

COMMENT ON TABLE marco_baseline_requests IS
  'Solicitações formais de nova baseline (estratégia de datas) por parte do cliente.';

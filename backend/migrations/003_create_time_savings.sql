-- Migração: Criar tabelas de Economia de Horas (Time Savings)
-- Domínio: Rastreamento de tempo economizado pelas automações da Plataforma Otus
-- Data: 2026-03-02

-- ============================================================================
-- Tabela: time_savings_catalog
-- Catálogo de automações com estimativas configuráveis de tempo economizado
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_savings_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL,
  default_minutes NUMERIC(6,1) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsc_area ON time_savings_catalog(area);
CREATE INDEX IF NOT EXISTS idx_tsc_active ON time_savings_catalog(is_active);

ALTER TABLE time_savings_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tsc_select_authenticated"
  ON time_savings_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tsc_update_authenticated"
  ON time_savings_catalog FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "tsc_insert_authenticated"
  ON time_savings_catalog FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE time_savings_catalog IS 'Catálogo de automações rastreadas para economia de horas com estimativas configuráveis';
COMMENT ON COLUMN time_savings_catalog.id IS 'Identificador único da automação (ex: weekly_report_generation)';
COMMENT ON COLUMN time_savings_catalog.default_minutes IS 'Estimativa padrão de minutos economizados por uso desta automação';

-- ============================================================================
-- Tabela: time_savings_events
-- Cada evento individual de uso de automação (quem, quando, quanto economizou)
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_savings_events (
  id BIGSERIAL PRIMARY KEY,
  catalog_id TEXT NOT NULL REFERENCES time_savings_catalog(id),
  user_email TEXT NOT NULL,
  user_name TEXT,
  minutes_saved NUMERIC(6,1) NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  resource_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tse_catalog ON time_savings_events(catalog_id);
CREATE INDEX IF NOT EXISTS idx_tse_user ON time_savings_events(user_email);
CREATE INDEX IF NOT EXISTS idx_tse_created ON time_savings_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tse_catalog_created ON time_savings_events(catalog_id, created_at DESC);

ALTER TABLE time_savings_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tse_select_authenticated"
  ON time_savings_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tse_insert_authenticated"
  ON time_savings_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE time_savings_events IS 'Eventos individuais de economia de tempo por uso de automações da Plataforma Otus';
COMMENT ON COLUMN time_savings_events.minutes_saved IS 'Snapshot da estimativa no momento do evento - garante integridade para auditoria';
COMMENT ON COLUMN time_savings_events.catalog_id IS 'Referência à automação utilizada no catálogo';

-- ============================================================================
-- Seed: Catálogo inicial de automações
-- ============================================================================
INSERT INTO time_savings_catalog (id, name, description, area, default_minutes) VALUES
  ('weekly_report_generation', 'Geração de Relatório Semanal', 'Coleta manual de dados do BigQuery, criação de HTML, upload no Drive, rascunho no Gmail', 'projetos', 30),
  ('cobranca_gmail_draft', 'Cobrança via Gmail', 'Abrir cliente de email, buscar contatos da disciplina, redigir email de cobrança', 'projetos', 15),
  ('cobranca_mark_done', 'Marcar Cobrança Feita', 'Registrar em planilha/sistema separado quais cobranças foram realizadas', 'projetos', 3),
  ('baseline_request_submit', 'Solicitar Baseline', 'Coordenação por email entre coordenador e gerente para solicitar baseline', 'projetos', 20),
  ('baseline_approval', 'Aprovar Baseline', 'Criar linha no Smartsheet manualmente e enviar email de confirmação', 'projetos', 30),
  ('recurring_task_materialization', 'Materializar Tarefas Recorrentes', 'Criar entradas individuais de calendário para reuniões recorrentes', 'lideres', 5),
  ('portfolio_field_update', 'Atualizar Campo do Portfólio', 'Login em múltiplos sistemas para atualizar campos de projeto', 'projetos', 8),
  ('feedback_submission', 'Enviar Feedback', 'Enviar email ou mensagem no chat para reportar problema', 'projetos', 10),
  ('demanda_submission', 'Enviar Demanda', 'Thread de email para solicitar suporte do time de apoio', 'projetos', 12)
ON CONFLICT (id) DO NOTHING;

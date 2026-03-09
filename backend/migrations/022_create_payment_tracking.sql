-- Migration 022: Payment Tracking (Fluxo de Pagamento dos Spots)
-- Cria tabelas para controle de parcelas de pagamento, regras por cliente, auditoria e notificacoes.

-- =============================================================================
-- Tabela: parcelas_pagamento
-- =============================================================================
CREATE TABLE IF NOT EXISTS parcelas_pagamento (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT,
  project_code TEXT NOT NULL,
  company_id TEXT,
  parcela_numero INTEGER,
  descricao TEXT,
  valor DECIMAL(14,2),
  origem TEXT DEFAULT 'Contrato',
  fase TEXT,
  status TEXT NOT NULL DEFAULT 'nao_finalizado'
    CHECK (status IN (
      'nao_finalizado',
      'aguardando_vinculacao',
      'vinculado',
      'aguardando_medicao',
      'medicao_solicitada',
      'aguardando_recebimento',
      'recebido'
    )),
  smartsheet_row_id TEXT,
  smartsheet_task_name TEXT,
  smartsheet_data_termino DATE,
  last_smartsheet_data_termino DATE,
  data_pagamento_calculada DATE,
  data_pagamento_manual DATE,
  parcela_sem_cronograma BOOLEAN DEFAULT FALSE,
  comentario_financeiro TEXT,
  comentario_projetos TEXT,
  gerente_email TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_code, parcela_numero, descricao)
);

CREATE INDEX idx_parcelas_project_code ON parcelas_pagamento(project_code);
CREATE INDEX idx_parcelas_company_id ON parcelas_pagamento(company_id);
CREATE INDEX idx_parcelas_status ON parcelas_pagamento(status);
CREATE INDEX idx_parcelas_data_pagamento ON parcelas_pagamento(data_pagamento_calculada);
CREATE INDEX idx_parcelas_gerente ON parcelas_pagamento(gerente_email);

-- RLS
ALTER TABLE parcelas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcelas_pagamento_all" ON parcelas_pagamento FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- Tabela: regras_pagamento_cliente
-- =============================================================================
CREATE TABLE IF NOT EXISTS regras_pagamento_cliente (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  precisa_medicao BOOLEAN DEFAULT FALSE,
  dias_solicitar_medicao INTEGER DEFAULT 0,
  dias_aprovacao_medicao INTEGER DEFAULT 0,
  dias_antecedencia_faturamento INTEGER DEFAULT 0,
  total_dias INTEGER GENERATED ALWAYS AS (
    COALESCE(dias_solicitar_medicao, 0) +
    COALESCE(dias_aprovacao_medicao, 0) +
    COALESCE(dias_antecedencia_faturamento, 0)
  ) STORED,
  observacao_financeiro TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regras_company_id ON regras_pagamento_cliente(company_id);

-- RLS
ALTER TABLE regras_pagamento_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_pagamento_cliente_all" ON regras_pagamento_cliente FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- Tabela: parcela_change_log (auditoria)
-- =============================================================================
CREATE TABLE IF NOT EXISTS parcela_change_log (
  id BIGSERIAL PRIMARY KEY,
  parcela_id BIGINT REFERENCES parcelas_pagamento(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('criar', 'editar', 'vincular', 'smartsheet_change', 'status_change')),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  edited_by_email TEXT,
  edited_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parcela_log_parcela_id ON parcela_change_log(parcela_id);
CREATE INDEX idx_parcela_log_project_code ON parcela_change_log(project_code);

-- RLS
ALTER TABLE parcela_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parcela_change_log_all" ON parcela_change_log FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- Tabela: notificacoes (generica, reusavel por qualquer dominio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id TEXT,
  link_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_user_unread ON notificacoes(user_email) WHERE read = FALSE;
CREATE INDEX idx_notificacoes_user_email ON notificacoes(user_email);

-- RLS
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificacoes_all" ON notificacoes FOR ALL USING (true) WITH CHECK (true);

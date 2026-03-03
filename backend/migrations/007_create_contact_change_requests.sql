-- Migration 007: Tabela de solicitações de alteração de contato
-- Workflow: Equipe de operação solicita → Equipe de dados aprova/rejeita
-- Tipos: novo_contato, editar_contato, nova_empresa

CREATE TABLE IF NOT EXISTS contact_change_requests (
  id BIGSERIAL PRIMARY KEY,

  -- Tipo da solicitação
  request_type TEXT NOT NULL CHECK (request_type IN ('novo_contato', 'editar_contato', 'nova_empresa')),

  -- Status do workflow
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),

  -- Dados da solicitação (JSONB para flexibilidade por tipo)
  payload JSONB NOT NULL DEFAULT '{}',

  -- Contexto: contato/empresa alvo (para edições)
  target_contact_id UUID,
  target_company_id UUID,

  -- Contexto do projeto (quando criado da tela de equipe)
  project_code TEXT,

  -- Solicitante
  requested_by_id UUID,
  requested_by_email TEXT NOT NULL,
  requested_by_name TEXT,

  -- Revisor (preenchido na aprovação/rejeição)
  reviewed_by_id UUID,
  reviewed_by_email TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Justificativa da rejeição (obrigatória quando rejeitada)
  rejection_reason TEXT,

  -- Resultado: IDs criados/atualizados após aprovação
  result_contact_id UUID,
  result_company_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_contact_change_requests_status
  ON contact_change_requests (status);

CREATE INDEX IF NOT EXISTS idx_contact_change_requests_requester
  ON contact_change_requests (requested_by_email);

CREATE INDEX IF NOT EXISTS idx_contact_change_requests_project
  ON contact_change_requests (project_code);

CREATE INDEX IF NOT EXISTS idx_contact_change_requests_type
  ON contact_change_requests (request_type);

CREATE INDEX IF NOT EXISTS idx_contact_change_requests_created
  ON contact_change_requests (created_at DESC);

COMMENT ON TABLE contact_change_requests IS
  'Solicitações de alteração de contatos/empresas. Workflow: operação solicita, dados aprova/rejeita.';

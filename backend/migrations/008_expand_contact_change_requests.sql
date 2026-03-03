-- Migration 008: Expandir tipos de solicitação
-- Tipo nova_disciplina (solicitar nova disciplina padrão)

ALTER TABLE contact_change_requests
  DROP CONSTRAINT IF EXISTS contact_change_requests_request_type_check;

ALTER TABLE contact_change_requests
  ADD CONSTRAINT contact_change_requests_request_type_check
  CHECK (request_type IN (
    'novo_contato',
    'editar_contato',
    'nova_empresa',
    'nova_disciplina'
  ));

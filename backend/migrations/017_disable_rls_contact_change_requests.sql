-- Migration 017: Desabilitar RLS na tabela contact_change_requests
-- O backend controla autenticação/autorização via middleware (requireAuth, hasFullAccess).
-- RLS habilitado sem policy de SELECT causa: count(*) HEAD retorna correto mas SELECT * retorna vazio.
ALTER TABLE contact_change_requests DISABLE ROW LEVEL SECURITY;

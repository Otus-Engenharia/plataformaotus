-- Migration: Adicionar coluna is_client_owned na tabela discipline_mappings
-- Permite marcar disciplinas como responsabilidade do cliente

ALTER TABLE discipline_mappings
ADD COLUMN IF NOT EXISTS is_client_owned boolean DEFAULT false;

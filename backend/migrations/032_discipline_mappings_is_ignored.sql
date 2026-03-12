-- Migration: Add is_ignored column to discipline_mappings
-- Permite marcar disciplinas como "desconsideradas" para excluir da análise

ALTER TABLE discipline_mappings
ADD COLUMN IF NOT EXISTS is_ignored boolean DEFAULT false;

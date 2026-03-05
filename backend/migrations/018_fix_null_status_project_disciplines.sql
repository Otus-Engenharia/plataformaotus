-- Migration 018: Corrigir registros com status NULL em project_disciplines
-- Registros criados antes do campo status ter default ficaram NULL.
-- Isso faz com que não apareçam na listagem de projetistas.

UPDATE project_disciplines SET status = 'ativo' WHERE status IS NULL;

ALTER TABLE project_disciplines
  ALTER COLUMN status SET DEFAULT 'ativo';

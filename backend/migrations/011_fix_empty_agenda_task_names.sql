-- Fix: corrigir tarefas com nome vazio que quebravam a materialização de recorrência
-- Um parent com nome vazio (ID 12978) causava falha na desserialização via AgendaTask.fromPersistence(),
-- abortando a materialização de TODAS as tarefas recorrentes do usuário silenciosamente.

-- Fix dados existentes
UPDATE agenda_tasks SET name = 'Atividade de agenda' WHERE name IS NULL OR TRIM(name) = '';

-- Constraint para prevenir nomes vazios no futuro
ALTER TABLE agenda_tasks ADD CONSTRAINT agenda_tasks_name_not_empty
  CHECK (TRIM(name) != '' AND name IS NOT NULL);

-- Migração: Adicionar suporte a "demissão" de projetistas
-- Domínio: Equipe de Projeto (project_disciplines)
-- Data: 2026-03-04
--
-- Permite demitir projetista do projeto mantendo histórico visível.
-- Status passa a ter 3 valores: 'ativo', 'desativado', 'demitido'.

ALTER TABLE project_disciplines
  ADD COLUMN IF NOT EXISTS demitido_em TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS demitido_por TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS motivo_demissao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replaced_by BIGINT REFERENCES project_disciplines(id) DEFAULT NULL;

-- Migração: Adicionar 'demitido' ao enum active_status
-- A migração 014 adicionou colunas de demissão mas não alterou o enum,
-- que só tinha {ativo, desativado}. Isso fazia queries com status.eq.demitido
-- retornarem erro silencioso → 0 resultados → projetistas sumiam.

ALTER TYPE active_status ADD VALUE IF NOT EXISTS 'demitido';

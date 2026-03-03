-- Migration 010: Adicionar colunas faltantes em project_comercial_infos
-- Campos usados pelo Formulário de Passagem que não existiam na tabela

ALTER TABLE project_comercial_infos
  ADD COLUMN IF NOT EXISTS visao_empresa text,
  ADD COLUMN IF NOT EXISTS visao_projeto_riscos text,
  ADD COLUMN IF NOT EXISTS principais_dores text,
  ADD COLUMN IF NOT EXISTS valor_cliente text,
  ADD COLUMN IF NOT EXISTS coordenacao_externa boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS info_contrato text,
  ADD COLUMN IF NOT EXISTS info_adicional_confidencial text;

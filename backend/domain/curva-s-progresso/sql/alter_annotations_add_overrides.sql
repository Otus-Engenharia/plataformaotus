-- ============================================
-- Migração: Adicionar colunas de override de prazo
-- Permite ao coordenador corrigir delta_days e data_termino
-- sem alterar dados brutos no BigQuery
-- ============================================

ALTER TABLE curva_s_change_annotations
ADD COLUMN IF NOT EXISTS override_delta_days INTEGER,
ADD COLUMN IF NOT EXISTS override_data_termino DATE;

COMMENT ON COLUMN curva_s_change_annotations.override_delta_days
  IS 'Valor corrigido de delta_days pelo coordenador (substitui o detectado)';

COMMENT ON COLUMN curva_s_change_annotations.override_data_termino
  IS 'Data de término corrigida pelo coordenador (substitui a detectada)';

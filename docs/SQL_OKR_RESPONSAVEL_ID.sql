-- ============================================
-- Migration: Add responsavel_id to OKRs and Initiatives
-- Permite seleção de responsável via dropdown com avatar
-- ============================================

-- ============================================
-- PARTE 1: Tabela okrs
-- ============================================

-- Adicionar coluna responsavel_id referenciando users_otus
ALTER TABLE okrs
ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES users_otus(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_okrs_responsavel_id
ON okrs(responsavel_id);

-- Migrar dados existentes (match por nome)
UPDATE okrs o
SET responsavel_id = u.id
FROM users_otus u
WHERE o.responsavel IS NOT NULL
  AND o.responsavel_id IS NULL
  AND LOWER(TRIM(u.name)) = LOWER(TRIM(o.responsavel));

-- ============================================
-- PARTE 2: Tabela okr_initiatives
-- ============================================

-- Adicionar coluna responsible_id referenciando users_otus
ALTER TABLE okr_initiatives
ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES users_otus(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_okr_initiatives_responsible_id
ON okr_initiatives(responsible_id);

-- Migrar dados existentes (match por nome)
UPDATE okr_initiatives i
SET responsible_id = u.id
FROM users_otus u
WHERE i.responsible IS NOT NULL
  AND i.responsible_id IS NULL
  AND LOWER(TRIM(u.name)) = LOWER(TRIM(i.responsible));

-- ============================================
-- Comentários
-- ============================================
COMMENT ON COLUMN okrs.responsavel_id IS 'FK para users_otus - responsável pelo objetivo';
COMMENT ON COLUMN okr_initiatives.responsible_id IS 'FK para users_otus - responsável pela iniciativa';

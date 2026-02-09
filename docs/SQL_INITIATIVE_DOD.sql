-- ============================================
-- Migration: Create initiative_dod_items table
-- Definition of Done (DoD) para Iniciativas OKR
-- ============================================

-- Criar tabela de itens DoD
CREATE TABLE IF NOT EXISTS initiative_dod_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  initiative_id UUID NOT NULL REFERENCES okr_initiatives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar indices para performance
CREATE INDEX IF NOT EXISTS idx_initiative_dod_items_initiative_id
ON initiative_dod_items(initiative_id);

CREATE INDEX IF NOT EXISTS idx_initiative_dod_items_position
ON initiative_dod_items(initiative_id, position);

-- Habilitar RLS (Row Level Security)
ALTER TABLE initiative_dod_items ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all DoD items
CREATE POLICY "Authenticated users can view DoD items"
ON initiative_dod_items FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can insert DoD items
CREATE POLICY "Authenticated users can create DoD items"
ON initiative_dod_items FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update DoD items
CREATE POLICY "Authenticated users can update DoD items"
ON initiative_dod_items FOR UPDATE
TO authenticated
USING (true);

-- Policy: Authenticated users can delete DoD items
CREATE POLICY "Authenticated users can delete DoD items"
ON initiative_dod_items FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_initiative_dod_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_initiative_dod_items_updated_at
  BEFORE UPDATE ON initiative_dod_items
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_dod_items_updated_at();

-- Comentarios na tabela
COMMENT ON TABLE initiative_dod_items IS 'Itens de Definition of Done (DoD) para iniciativas OKR';
COMMENT ON COLUMN initiative_dod_items.id IS 'Identificador unico do item DoD';
COMMENT ON COLUMN initiative_dod_items.initiative_id IS 'FK para a iniciativa OKR';
COMMENT ON COLUMN initiative_dod_items.title IS 'Titulo/descricao do criterio de conclusao';
COMMENT ON COLUMN initiative_dod_items.completed IS 'Se o criterio foi atendido';
COMMENT ON COLUMN initiative_dod_items.position IS 'Posicao para ordenacao';

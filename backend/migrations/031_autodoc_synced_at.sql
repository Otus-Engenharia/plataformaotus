-- Migration 031: Add synced_at column to autodoc_documents
-- Separa timestamp de sync (synced_at) do timestamp do documento (autodoc_created_at)
-- Permite filtrar por "quando foi importado" vs "quando foi criado no Autodoc"

ALTER TABLE autodoc_documents
ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Preencher synced_at com updated_at para docs existentes (melhor aproximacao)
UPDATE autodoc_documents
SET synced_at = COALESCE(updated_at, autodoc_created_at, now())
WHERE synced_at IS NULL;

-- Tornar NOT NULL com default now() para futuras insercoes
ALTER TABLE autodoc_documents
ALTER COLUMN synced_at SET DEFAULT now();

-- Index para queries por synced_at
CREATE INDEX IF NOT EXISTS idx_autodoc_documents_synced_at
ON autodoc_documents (synced_at DESC);

COMMENT ON COLUMN autodoc_documents.synced_at IS 'Timestamp de quando o documento foi importado/atualizado pela ultima sync';

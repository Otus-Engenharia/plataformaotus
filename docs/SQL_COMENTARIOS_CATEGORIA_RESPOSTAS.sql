-- Migration: Adicionar categoria e respostas aos comentários de OKR
-- Data: 2026-02-06
-- Descrição: Adiciona campo categoria (Dúvida/Sugestão/Comentário) e parent_id para respostas

-- 1. Adicionar campo categoria com valor padrão 'Comentário'
ALTER TABLE okr_comments
ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Comentário';

-- 2. Adicionar campo parent_id para respostas (UUID para corresponder ao tipo do id)
ALTER TABLE okr_comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES okr_comments(id) ON DELETE CASCADE;

-- 3. Criar índice para busca por parent_id (performance)
CREATE INDEX IF NOT EXISTS idx_okr_comments_parent_id ON okr_comments(parent_id);

-- 4. Criar índice para busca por categoria (para filtros futuros)
CREATE INDEX IF NOT EXISTS idx_okr_comments_categoria ON okr_comments(categoria);

-- Verificar estrutura final
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'okr_comments';

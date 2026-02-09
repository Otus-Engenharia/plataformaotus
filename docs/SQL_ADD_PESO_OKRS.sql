-- ============================================================
-- ADICIONAR COLUNAS PESO E SETOR_ID NA TABELA OKRS
-- ============================================================
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- Adicionar coluna peso (default 1 para OKRs existentes)
ALTER TABLE public.okrs
ADD COLUMN IF NOT EXISTS peso NUMERIC(5,2) DEFAULT 1
CHECK (peso > 0);

-- Adicionar coluna setor_id (referência para sectors)
ALTER TABLE public.okrs
ADD COLUMN IF NOT EXISTS setor_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.okrs.peso IS 'Peso do objetivo para cálculo ponderado do progresso do setor';
COMMENT ON COLUMN public.okrs.setor_id IS 'Setor ao qual o objetivo pertence (opcional)';

-- Índice para melhor performance nas consultas por setor
CREATE INDEX IF NOT EXISTS idx_okrs_setor_id ON public.okrs(setor_id);

-- Verificar se foram criados
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'okrs' AND column_name IN ('peso', 'setor_id');

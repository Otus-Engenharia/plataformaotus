-- ============================================================
-- SCRIPT DE EMERGÊNCIA: Criar tabela POSITIONS isoladamente
-- ============================================================
-- Use este script APENAS se você receber o erro:
-- "ERROR: 42P01: relation "public.positions" does not exist"
-- 
-- Execute este script PRIMEIRO, depois execute o script completo
-- ============================================================

-- Verificar se sectors existe (dependência de positions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sectors') THEN
        RAISE EXCEPTION '❌ ERRO: A tabela "sectors" não existe! Execute o script completo TABELAS_INDICADORES_COMPLETO.sql';
    END IF;
END $$;

-- Criar tabela positions se não existir
CREATE TABLE IF NOT EXISTS public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_leadership BOOLEAN NOT NULL DEFAULT false,
    sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS se ainda não estiver habilitado
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'positions'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Verificar se foi criada com sucesso
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'positions') THEN
        RAISE NOTICE '✅ Tabela positions criada/verificada com sucesso!';
    ELSE
        RAISE EXCEPTION '❌ ERRO: Falha ao criar tabela positions';
    END IF;
END $$;

-- Mostrar estrutura da tabela
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'positions'
ORDER BY ordinal_position;

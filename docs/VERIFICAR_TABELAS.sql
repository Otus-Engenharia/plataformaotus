-- ============================================================
-- SCRIPT DE VERIFICAÇÃO - TABELAS DO SISTEMA DE INDICADORES
-- ============================================================
-- Execute este script para verificar quais tabelas existem
-- e identificar problemas de dependência
-- ============================================================

-- Verificar se a tabela 'positions' existe
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'positions')
        THEN '✅ Tabela positions EXISTE'
        ELSE '❌ Tabela positions NÃO EXISTE'
    END AS status_positions;

-- Verificar todas as tabelas esperadas
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('sectors', 'positions', 'profiles', 'user_roles', 'position_indicators', 'indicators', 'check_ins', 'objectives', 'key_results', 'initiatives', 'comments', 'recovery_plans', 'recovery_plan_actions', 'invites')
        THEN '✅'
        ELSE '⚠️'
    END AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('sectors', 'positions', 'profiles', 'user_roles', 'position_indicators', 'indicators', 'check_ins', 'objectives', 'key_results', 'initiatives', 'comments', 'recovery_plans', 'recovery_plan_actions', 'invites')
ORDER BY 
    CASE table_name
        WHEN 'sectors' THEN 1
        WHEN 'positions' THEN 2
        WHEN 'profiles' THEN 3
        WHEN 'user_roles' THEN 4
        WHEN 'position_indicators' THEN 5
        WHEN 'indicators' THEN 6
        WHEN 'check_ins' THEN 7
        WHEN 'objectives' THEN 8
        WHEN 'key_results' THEN 9
        WHEN 'initiatives' THEN 10
        WHEN 'comments' THEN 11
        WHEN 'recovery_plans' THEN 12
        WHEN 'recovery_plan_actions' THEN 13
        WHEN 'invites' THEN 14
    END;

-- Verificar dependências da tabela positions
SELECT 
    'Dependências de positions:' AS info,
    COUNT(*) FILTER (WHERE table_name = 'profiles' AND column_name = 'position_id') AS profiles_referencia,
    COUNT(*) FILTER (WHERE table_name = 'position_indicators' AND column_name = 'position_id') AS position_indicators_referencia
FROM information_schema.columns
WHERE table_schema = 'public'
AND ((table_name = 'profiles' AND column_name = 'position_id')
     OR (table_name = 'position_indicators' AND column_name = 'position_id'));

-- ============================================
-- SCHEDULED QUERY: financeiro.custo_usuario_projeto_mes_sync
-- ============================================
-- Descrição: Pipeline COMPLETO de custos - Steps 1 a 4 combinados.
--            Calcula peso salarial, distribui custos indiretos,
--            aloca por projeto via horas, e gera tabela final.
--
-- IMPORTANTE: M__s na planilha financeira = mês de PAGAMENTO (caixa).
--             Funcionário trabalha em mês N, recebe em mês N+1.
--             Por isso o JOIN usa DATE_ADD(h.mes, INTERVAL 1 MONTH) = c.mes.
--
-- Schedule: every day 07:00 (após financeiro_custos_operacao às 06:30)
-- Destino: dadosindicadores.financeiro.custo_usuario_projeto_mes
-- Região: southamerica-east1
-- ============================================

CREATE OR REPLACE TABLE `dadosindicadores.financeiro.custo_usuario_projeto_mes` AS
WITH
-- ============================================
-- STEP 1: Peso do salário por usuário/mês
-- peso = salario_usuario / soma_total_salarios_mes
-- ============================================
salarios_mes AS (
  SELECT
    Nome_do_fornecedor_cliente AS usuario,
    M__s AS mes,
    ABS(SUM(Valor)) AS salario
  FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_diretos`
  GROUP BY usuario, mes
),
folha_total AS (
  SELECT mes, SUM(salario) AS folha_total_mes
  FROM salarios_mes
  GROUP BY mes
),
salario_peso AS (
  SELECT
    s.usuario, s.mes, s.salario, f.folha_total_mes,
    SAFE_DIVIDE(s.salario, f.folha_total_mes) AS peso_salario
  FROM salarios_mes s
  JOIN folha_total f ON s.mes = f.mes
),
-- ============================================
-- STEP 2: Custo indireto por usuário
-- custo_indireto_usuario = custo_indireto_total × peso_salario
-- ============================================
indiretos_mes AS (
  SELECT M__s AS mes, ABS(SUM(Valor)) AS custo_indireto_total
  FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_indiretos`
  GROUP BY mes
),
custo_usuario AS (
  SELECT
    s.usuario,
    s.mes,
    s.salario AS custo_direto_mes_usuario,
    i.custo_indireto_total * s.peso_salario AS custo_indireto_usuario_mes
  FROM salario_peso s
  LEFT JOIN indiretos_mes i ON s.mes = i.mes
),
-- ============================================
-- STEP 3: Distribuição por projeto via horas
-- custo_projeto = custo_usuario × (horas_projeto / horas_total_usuario)
-- OFFSET: horas de mês N → pagamento de mês N+1
-- ============================================
horas_por_projeto AS (
  SELECT
    COALESCE(rev_alias.nome_planilha, tt.usuario) AS usuario,
    tt.projeto,
    DATE_TRUNC(tt.data_de_apontamento, MONTH) AS mes,
    SUM(SAFE_CAST(REPLACE(tt.duracao, ',', '.') AS FLOAT64)) AS horas_usuario_projeto_mes
  FROM `dadosindicadores.timetracker_transform.timetracker_limpo` tt
  LEFT JOIN `dadosindicadores.financeiro_custos_operacao.usuario_alias` rev_alias
    ON LOWER(TRIM(tt.usuario)) = LOWER(TRIM(rev_alias.nome_correto))
  WHERE SAFE_CAST(REPLACE(tt.duracao, ',', '.') AS FLOAT64) > 0
  GROUP BY usuario, projeto, mes
),
horas_totais_usuario AS (
  SELECT usuario, mes, SUM(horas_usuario_projeto_mes) AS horas_totais_mes_usuario
  FROM horas_por_projeto
  GROUP BY usuario, mes
),
custo_por_projeto AS (
  SELECT
    h.usuario,
    h.projeto,
    h.mes,
    h.horas_usuario_projeto_mes,
    t.horas_totais_mes_usuario,
    SAFE_DIVIDE(h.horas_usuario_projeto_mes, t.horas_totais_mes_usuario) AS peso_projeto_no_mes,
    c.custo_direto_mes_usuario,
    c.custo_indireto_usuario_mes,
    c.custo_direto_mes_usuario * SAFE_DIVIDE(h.horas_usuario_projeto_mes, t.horas_totais_mes_usuario) AS custo_direto_usuario_projeto_mes,
    c.custo_indireto_usuario_mes * SAFE_DIVIDE(h.horas_usuario_projeto_mes, t.horas_totais_mes_usuario) AS custo_indireto_usuario_projeto_mes
  FROM horas_por_projeto h
  JOIN horas_totais_usuario t ON h.usuario = t.usuario AND h.mes = t.mes
  LEFT JOIN custo_usuario c
    ON LOWER(TRIM(h.usuario)) = LOWER(TRIM(c.usuario))
    AND DATE_ADD(h.mes, INTERVAL 1 MONTH) = c.mes  -- OFFSET: horas mês N → pagamento mês N+1
)
-- ============================================
-- STEP 4: Tabela final com alias de nomes e ABS
-- custo_total = ABS(direto) + ABS(indireto) (NÃO ABS(direto + indireto))
-- ============================================
SELECT
  COALESCE(alias.nome_correto, p.usuario) AS usuario,
  p.projeto,
  COALESCE(tt.project_code, '') AS project_code,
  p.mes,
  p.horas_usuario_projeto_mes,
  p.horas_totais_mes_usuario,
  p.peso_projeto_no_mes,
  ABS(p.custo_direto_mes_usuario) AS custo_direto_mes_usuario,
  ABS(p.custo_indireto_usuario_mes) AS custo_indireto_usuario_mes,
  ABS(p.custo_direto_mes_usuario) + ABS(p.custo_indireto_usuario_mes) AS custo_total_usuario_mes,
  ABS(p.custo_direto_usuario_projeto_mes) AS custo_direto_usuario_projeto_mes,
  ABS(p.custo_indireto_usuario_projeto_mes) AS custo_indireto_usuario_projeto_mes,
  ABS(p.custo_direto_usuario_projeto_mes) + ABS(p.custo_indireto_usuario_projeto_mes) AS custo_total_usuario_projeto_mes
FROM custo_por_projeto p
LEFT JOIN `dadosindicadores.financeiro_custos_operacao.usuario_alias` alias
  ON LOWER(TRIM(p.usuario)) = LOWER(TRIM(alias.nome_planilha))
LEFT JOIN (
  SELECT LOWER(TRIM(projeto)) AS projeto_norm, MAX(project_code) AS project_code
  FROM `dadosindicadores.timetracker_transform.timetracker_limpo`
  WHERE project_code IS NOT NULL AND project_code != ''
  GROUP BY projeto_norm
) tt ON LOWER(TRIM(p.projeto)) = tt.projeto_norm;

-- ============================================
-- INSTRUÇÕES PARA ATUALIZAR A SCHEDULED QUERY
-- ============================================
--
-- 1. Acesse: https://console.cloud.google.com/bigquery
-- 2. Projeto: dadosindicadores
-- 3. Menu: "Scheduled queries" (lateral esquerda)
-- 4. Encontre: "financeiro.custo_usuario_projeto_mes_sync"
-- 5. Clique "EDIT" e substitua o SQL pelo conteúdo acima
--    (todo o bloco CREATE OR REPLACE TABLE ... até o ponto-e-vírgula)
-- 6. Verifique: Schedule = every day 07:00, Location = southamerica-east1
-- 7. Clique: "SAVE"
--
-- NOTA: Esta query agora inclui Steps 1-4 completos.
--       As scheduled queries anteriores de Steps 1-3 intermediários
--       (salario_peso_usuario_mes, custo_indireto_usuario_mes,
--        custo_usuario_projeto_mes) NÃO precisam mais existir.
--       Porém, o script recalcular-pipeline-custos.mjs ainda as recria
--       para verificação manual se necessário.
-- ============================================

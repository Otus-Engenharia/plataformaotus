-- ============================================
-- SCHEDULED QUERY: financeiro.receita_liquida_projeto_mes
-- ============================================
-- Descrição: Calcula receita líquida por projeto/mês aplicando impostos
--            e depois a margem de 55% conforme regra do financeiro
--
-- CÁLCULO (2 etapas):
--   1. Receita Líquida = Receita Bruta × fator_imposto
--      - fator = 0.85 (15% imposto) para datas < 2023-08-01
--      - fator = 0.88 (12% imposto) para datas >= 2023-08-01 e <= CURRENT_DATE()
--      - fator = 0.83 (17% imposto) para datas > CURRENT_DATE()
--
--   2. Margem 55% = Receita Líquida × 0.55
--      (é o valor disponível para cobrir custos)
--
-- Schedule: every day 07:30 (após custos às 07:00)
-- Destino: dadosindicadores.financeiro.receita_liquida_projeto_mes
-- Região: southamerica-east1
-- ============================================

CREATE OR REPLACE TABLE `dadosindicadores.financeiro.receita_liquida_projeto_mes` AS
SELECT
  e.codigo_projeto AS project_code,
  e.nome_projeto AS projeto,
  e.M__s AS mes,
  e.Categoria AS categoria,

  -- Receita Bruta (valor original)
  SUM(CAST(e.Valor AS FLOAT64)) AS receita_bruta,

  -- Percentual de imposto aplicado
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.15
    WHEN e.M__s <= CURRENT_DATE() THEN 0.12
    ELSE 0.17
  END AS percentual_imposto,

  -- Fator multiplicador para imposto (1 - imposto)
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END AS fator_imposto,

  -- Receita Líquida = Receita Bruta × fator_imposto (após imposto)
  SUM(CAST(e.Valor AS FLOAT64)) * CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END AS receita_liquida,

  -- Margem 55% = Receita Líquida × 0.55 (valor para cobrir custos)
  SUM(CAST(e.Valor AS FLOAT64)) * CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END * 0.55 AS margem_55,

  -- Classificação do período
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 'Histórico (15%)'
    WHEN e.M__s <= CURRENT_DATE() THEN 'Atual (12%)'
    ELSE 'Projetado (17%)'
  END AS tipo_periodo

FROM `dadosindicadores.financeiro.entradas` e
WHERE e.codigo_projeto IS NOT NULL
  AND e.M__s IS NOT NULL
GROUP BY
  e.codigo_projeto,
  e.nome_projeto,
  e.M__s,
  e.Categoria;

-- ============================================
-- VIEW AGREGADA POR PROJETO (sem categoria)
-- ============================================

CREATE OR REPLACE VIEW `dadosindicadores.financeiro.v_receita_projeto_mes` AS
SELECT
  project_code,
  projeto,
  mes,
  SUM(receita_bruta) AS receita_bruta_total,
  SUM(receita_liquida) AS receita_liquida_total,
  SUM(margem_55) AS margem_55_total,
  -- Média ponderada do fator
  SUM(receita_liquida) / NULLIF(SUM(receita_bruta), 0) AS fator_medio,
  MAX(tipo_periodo) AS tipo_periodo
FROM `dadosindicadores.financeiro.receita_liquida_projeto_mes`
GROUP BY project_code, projeto, mes;

-- ============================================
-- VIEW PARA CURVA S COMPLETA (custos vs receitas)
-- ============================================
-- Curvas no gráfico:
--   1. Receita Bruta Acumulada (verde)
--   2. Margem 55% Acumulada (azul) - para comparar com custo
--   3. Custo Total Acumulado (vermelho)

CREATE OR REPLACE VIEW `dadosindicadores.financeiro.v_curva_s_completa` AS
WITH custos AS (
  SELECT
    project_code,
    projeto,
    mes,
    SUM(custo_total_usuario_projeto_mes) AS custo_total,
    SUM(horas_usuario_projeto_mes) AS horas_total
  FROM `dadosindicadores.financeiro.custo_usuario_projeto_mes`
  WHERE project_code IS NOT NULL AND project_code != ''
  GROUP BY project_code, projeto, mes
),
receitas AS (
  SELECT
    project_code,
    projeto,
    mes,
    SUM(receita_bruta) AS receita_bruta,
    SUM(receita_liquida) AS receita_liquida,
    SUM(margem_55) AS margem_55
  FROM `dadosindicadores.financeiro.receita_liquida_projeto_mes`
  GROUP BY project_code, projeto, mes
)
SELECT
  COALESCE(c.project_code, r.project_code) AS project_code,
  COALESCE(c.projeto, r.projeto) AS projeto,
  COALESCE(c.mes, r.mes) AS mes,
  COALESCE(c.custo_total, 0) AS custo_total,
  COALESCE(c.horas_total, 0) AS horas_total,
  COALESCE(r.receita_bruta, 0) AS receita_bruta,
  COALESCE(r.receita_liquida, 0) AS receita_liquida,
  COALESCE(r.margem_55, 0) AS margem_55,
  -- Margem Operacional = Margem 55% - Custo (pode ser negativa = prejuízo)
  COALESCE(r.margem_55, 0) - COALESCE(c.custo_total, 0) AS margem_operacional,
  -- Percentual de margem sobre margem 55%
  SAFE_DIVIDE(
    COALESCE(r.margem_55, 0) - COALESCE(c.custo_total, 0),
    NULLIF(COALESCE(r.margem_55, 0), 0)
  ) * 100 AS percentual_margem_operacional
FROM custos c
FULL OUTER JOIN receitas r
  ON c.project_code = r.project_code AND c.mes = r.mes;

-- ============================================
-- INSTRUÇÕES PARA CRIAR A SCHEDULED QUERY
-- ============================================
--
-- 1. Acesse: https://console.cloud.google.com/bigquery
-- 2. Projeto: dadosindicadores
-- 3. Menu: "Scheduled queries" (lateral esquerda)
-- 4. Clique: "+ CREATE SCHEDULED QUERY"
-- 5. Configure:
--    - Name: financeiro.receita_liquida_projeto_mes
--    - Schedule: every day 07:30
--    - Location: southamerica-east1
--    - Cole APENAS o primeiro CREATE OR REPLACE TABLE (linhas 18-55)
-- 6. Clique: "SAVE"
--
-- Para as VIEWs, execute manualmente uma vez (não precisam de schedule)
--
-- ============================================

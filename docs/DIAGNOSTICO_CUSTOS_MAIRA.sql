-- ============================================
-- DIAGNÓSTICO: Por que os custos da Maira estão inflados em Julho 2025?
-- Execute cada query separadamente no BigQuery Console
-- ============================================

-- ============================================
-- QUERY 1: Salário da Maira na tabela fonte (custos_operacao_diretos)
-- Verifica se o valor base está correto
-- Lembre: horas de Julho usam salário de AGOSTO (offset +1 mês)
-- ============================================
SELECT
  Nome_do_fornecedor_cliente AS usuario,
  M__s AS mes,
  Valor,
  ABS(Valor) AS valor_abs
FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_diretos`
WHERE LOWER(Nome_do_fornecedor_cliente) LIKE '%maira%'
ORDER BY M__s;

-- ============================================
-- QUERY 2: Resultado do STEP 1 - salarios_mes
-- Verifica se o GROUP BY SUM está correto ou se há duplicatas
-- Se o valor de agosto for > 3700, há entradas duplicadas
-- ============================================
SELECT
  Nome_do_fornecedor_cliente AS usuario,
  M__s AS mes,
  COUNT(*) AS qtd_linhas,
  SUM(Valor) AS soma_valor,
  ABS(SUM(Valor)) AS salario_calculado
FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_diretos`
WHERE LOWER(Nome_do_fornecedor_cliente) LIKE '%maira%'
GROUP BY usuario, mes
ORDER BY mes;

-- ============================================
-- QUERY 3: Alias da Maira - como o nome é mapeado
-- Verifica se o nome do timetracker é mapeado corretamente
-- para o nome da planilha financeira
-- ============================================
SELECT *
FROM `dadosindicadores.financeiro_custos_operacao.usuario_alias`
WHERE LOWER(nome_correto) LIKE '%maira%'
   OR LOWER(nome_planilha) LIKE '%maira%';

-- ============================================
-- QUERY 4: Horas da Maira no timetracker (Julho 2025)
-- Verifica qual nome aparece e total de horas
-- ============================================
SELECT
  tt.usuario AS nome_timetracker,
  COALESCE(rev_alias.nome_planilha, tt.usuario) AS nome_apos_alias,
  tt.projeto,
  DATE_TRUNC(tt.data_de_apontamento, MONTH) AS mes,
  SUM(SAFE_CAST(REPLACE(tt.duracao, ',', '.') AS FLOAT64)) AS horas
FROM `dadosindicadores.timetracker_transform.timetracker_limpo` tt
LEFT JOIN `dadosindicadores.financeiro_custos_operacao.usuario_alias` rev_alias
  ON LOWER(TRIM(tt.usuario)) = LOWER(TRIM(rev_alias.nome_correto))
WHERE LOWER(tt.usuario) LIKE '%maira%'
  AND DATE_TRUNC(tt.data_de_apontamento, MONTH) = '2025-07-01'
GROUP BY nome_timetracker, nome_apos_alias, tt.projeto, mes
ORDER BY horas DESC;

-- ============================================
-- QUERY 5: Total de horas por mês da Maira (todos os nomes)
-- Verifica se horas_totais_mes_usuario está correto
-- ============================================
SELECT
  COALESCE(rev_alias.nome_planilha, tt.usuario) AS usuario,
  DATE_TRUNC(tt.data_de_apontamento, MONTH) AS mes,
  SUM(SAFE_CAST(REPLACE(tt.duracao, ',', '.') AS FLOAT64)) AS horas_totais_mes
FROM `dadosindicadores.timetracker_transform.timetracker_limpo` tt
LEFT JOIN `dadosindicadores.financeiro_custos_operacao.usuario_alias` rev_alias
  ON LOWER(TRIM(tt.usuario)) = LOWER(TRIM(rev_alias.nome_correto))
WHERE LOWER(COALESCE(rev_alias.nome_planilha, tt.usuario)) LIKE '%maira%'
  AND DATE_TRUNC(tt.data_de_apontamento, MONTH) BETWEEN '2025-06-01' AND '2025-08-01'
GROUP BY usuario, mes
ORDER BY mes;

-- ============================================
-- QUERY 6: JOIN final - custo_direto_mes_usuario vs horas
-- Esta é a query CHAVE: mostra os valores intermediários
-- que geram o custo por projeto
-- ============================================
WITH
salarios_mes AS (
  SELECT
    Nome_do_fornecedor_cliente AS usuario,
    M__s AS mes,
    ABS(SUM(Valor)) AS salario
  FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_diretos`
  GROUP BY usuario, mes
),
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
)
SELECT
  h.usuario AS nome_horas,
  s.usuario AS nome_salario,
  h.mes AS mes_horas,
  DATE_ADD(h.mes, INTERVAL 1 MONTH) AS mes_pagamento,
  h.projeto,
  h.horas_usuario_projeto_mes,
  t.horas_totais_mes_usuario,
  SAFE_DIVIDE(h.horas_usuario_projeto_mes, t.horas_totais_mes_usuario) AS peso_projeto,
  s.salario AS salario_mes_pagamento,
  s.salario * SAFE_DIVIDE(h.horas_usuario_projeto_mes, t.horas_totais_mes_usuario) AS custo_direto_calculado
FROM horas_por_projeto h
JOIN horas_totais_usuario t ON h.usuario = t.usuario AND h.mes = t.mes
LEFT JOIN salarios_mes s
  ON LOWER(TRIM(h.usuario)) = LOWER(TRIM(s.usuario))
  AND DATE_ADD(h.mes, INTERVAL 1 MONTH) = s.mes
WHERE LOWER(h.usuario) LIKE '%maira%'
  AND h.mes = '2025-07-01'
ORDER BY h.horas_usuario_projeto_mes DESC;

-- ============================================
-- QUERY 7: Resultado final na tabela gerada
-- Compara com o que o frontend recebe
-- ============================================
SELECT
  usuario,
  projeto,
  project_code,
  mes,
  horas_usuario_projeto_mes,
  horas_totais_mes_usuario,
  peso_projeto_no_mes,
  custo_direto_mes_usuario,
  custo_direto_usuario_projeto_mes,
  custo_total_usuario_projeto_mes
FROM `dadosindicadores.financeiro.custo_usuario_projeto_mes`
WHERE LOWER(usuario) LIKE '%maira%'
  AND mes = '2025-07-01'
ORDER BY custo_direto_usuario_projeto_mes DESC;

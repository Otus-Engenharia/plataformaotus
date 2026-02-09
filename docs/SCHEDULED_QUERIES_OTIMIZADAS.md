# Scheduled Queries Otimizadas - Pipeline Financeiro

## Problemas Identificados

1. **Categorias desatualizadas**: A tabela `entradas` filtrava apenas categorias antigas de "Engenharia", mas os dados novos usam "Clientes - Receita de Serviço"
2. **Falta de automação**: O fluxo `custos_operacao_live` → `custos_operacao_pbi` → `entradas` não estava automatizado
3. **Dados futuros**: Receitas projetadas apareciam na Curva S (corrigido com filtro `CURRENT_DATE()`)

## Fluxo de Dependências (Ordem de Execução)

```
06:00 → [1] custos_operacao_pbi (parse da planilha)
06:30 → [2] custos_operacao_limpo (normalização de nomes/categorias)
06:45 → [3] entradas (filtro de receitas)
07:00 → [4] custo_usuario_projeto_mes (custos finais)
07:30 → [5] receita_liquida_projeto_mes (receitas finais)
08:00 → [6] custos_operacao_pbi (Power BI - hourly)
```

---

## Query 1: custos_operacao_pbi (Parse da Planilha)

**Nome**: `financeiro.custos_operacao_pbi`
**Schedule**: `every day 06:00` (São Paulo)
**Destino**: `dadosindicadores.financeiro.custos_operacao_pbi`

```sql
-- Parse dos dados da planilha Google Sheets (External Table)
-- Converte texto para tipos corretos (data, valor numérico)
CREATE OR REPLACE TABLE dadosindicadores.financeiro.custos_operacao_pbi AS
SELECT
  Nome_do_fornecedor_cliente,
  Categoria,
  SAFE.PARSE_DATE('%d/%m/%Y', M__s) AS M__s,
  SAFE_CAST(
    REPLACE(REPLACE(Valor, '.', ''), ',', '.') AS NUMERIC
  ) AS Valor
FROM `dadosindicadores.financeiro.custos_operacao_live`
WHERE Nome_do_fornecedor_cliente IS NOT NULL
  AND M__s IS NOT NULL;
```

---

## Query 2: entradas (Receitas de Projetos)

**Nome**: `financeiro.entradas`
**Schedule**: `every day 06:45` (São Paulo) - após custos_operacao_pbi
**Destino**: `dadosindicadores.financeiro.entradas`

```sql
-- Extrai receitas de projetos das categorias de faturamento
-- IMPORTANTE: Inclui tanto categorias antigas (Engenharia) quanto novas (Clientes)
CREATE OR REPLACE TABLE `dadosindicadores.financeiro.entradas` AS
SELECT
  Nome_do_fornecedor_cliente,
  -- Nome do projeto (antes do último " -- ")
  TRIM(REGEXP_REPLACE(Nome_do_fornecedor_cliente, r'\s--\s[^-]+$', '')) AS nome_projeto,
  -- Código do projeto (depois do último " -- ")
  TRIM(REGEXP_EXTRACT(Nome_do_fornecedor_cliente, r'[^-]+$')) AS codigo_projeto,
  Categoria,
  M__s,
  Valor
FROM `dadosindicadores.financeiro.custos_operacao_pbi`
WHERE Categoria IN (
  -- Categorias antigas (histórico)
  'Engenharia - Consultoria MRR',
  'Engenharia - Desempenho SPOT',
  'Engenharia - Compatibilização MRR',
  'Engenharia - Coordenação e Compatibilização MRR',
  'Engenharia - Compatibilização SPOT',
  'Engenharia - Coordenação e Compatibilização SPOT',
  -- Categoria atual (a partir de ~ago/2025)
  'Clientes - Receita de Serviço'
)
AND M__s IS NOT NULL
AND Valor IS NOT NULL;
```

---

## Query 3: receita_liquida_projeto_mes (Receitas Finais)

**Nome**: `financeiro.receita_liquida_projeto_mes`
**Schedule**: `every day 07:30` (São Paulo) - após entradas
**Destino**: `dadosindicadores.financeiro.receita_liquida_projeto_mes`

```sql
-- Calcula receita líquida com desconto de impostos
-- Também calcula Margem 55% (valor disponível para custos)
CREATE OR REPLACE TABLE `dadosindicadores.financeiro.receita_liquida_projeto_mes` AS
SELECT
  e.codigo_projeto AS project_code,
  e.nome_projeto AS projeto,
  e.M__s AS mes,
  e.Categoria AS categoria,

  -- Receita Bruta (valor original)
  SUM(CAST(e.Valor AS FLOAT64)) AS receita_bruta,

  -- Percentual de imposto aplicado (varia por período)
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.15  -- Histórico: 15%
    WHEN e.M__s <= CURRENT_DATE() THEN 0.11     -- Atual: 11%
    ELSE 0.17                                    -- Projetado: 17%
  END AS percentual_margem,

  -- Fator multiplicador (1 - imposto)
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END AS fator_receita_liquida,

  -- Receita Líquida = Bruta × Fator
  SUM(CAST(e.Valor AS FLOAT64)) * CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END AS receita_liquida,

  -- Margem 55% = Receita Líquida × 0.55 (valor disponível para custos)
  SUM(CAST(e.Valor AS FLOAT64)) * CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 0.85
    WHEN e.M__s <= CURRENT_DATE() THEN 0.88
    ELSE 0.83
  END * 0.55 AS margem_55,

  -- Classificação do período
  CASE
    WHEN e.M__s < DATE('2023-08-01') THEN 'Histórico (15%)'
    WHEN e.M__s <= CURRENT_DATE() THEN 'Atual (11%)'
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
```

---

## Query 4: Views Agregadas

**Nome**: `financeiro.views_agregadas`
**Schedule**: `every day 07:45` (São Paulo) - após receita_liquida
**Não precisa de tabela destino** (executa DDL)

```sql
-- View 1: Receita por projeto (sem categoria)
CREATE OR REPLACE VIEW `dadosindicadores.financeiro.v_receita_projeto_mes` AS
SELECT
  project_code,
  projeto,
  mes,
  SUM(receita_bruta) AS receita_bruta_total,
  SUM(receita_liquida) AS receita_liquida_total,
  SUM(margem_55) AS margem_55_total,
  SUM(receita_liquida) / NULLIF(SUM(receita_bruta), 0) AS fator_medio,
  MAX(tipo_periodo) AS tipo_periodo
FROM `dadosindicadores.financeiro.receita_liquida_projeto_mes`
GROUP BY project_code, projeto, mes;

-- View 2: Curva S completa (custos + receitas)
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
  -- Margem Operacional = Margem 55% - Custo
  COALESCE(r.margem_55, 0) - COALESCE(c.custo_total, 0) AS margem_operacional,
  -- Percentual de margem
  SAFE_DIVIDE(
    COALESCE(r.margem_55, 0) - COALESCE(c.custo_total, 0),
    NULLIF(COALESCE(r.margem_55, 0), 0)
  ) * 100 AS percentual_margem_operacional
FROM custos c
FULL OUTER JOIN receitas r
  ON c.project_code = r.project_code AND c.mes = r.mes
WHERE COALESCE(c.mes, r.mes) <= CURRENT_DATE();  -- Filtro para não mostrar dados futuros
```

---

## Resumo das Scheduled Queries a Criar/Atualizar

| # | Nome | Schedule | Dependência |
|---|------|----------|-------------|
| 1 | `financeiro.custos_operacao_pbi` | 06:00 daily | custos_operacao_live (External Table) |
| 2 | `financeiro.entradas` | 06:45 daily | custos_operacao_pbi |
| 3 | `financeiro.custo_usuario_projeto_mes_sync` | 07:00 daily | Pipeline de custos |
| 4 | `financeiro.receita_liquida_projeto_mes` | 07:30 daily | entradas |
| 5 | `financeiro.views_agregadas` | 07:45 daily | receita_liquida + custos |

---

## Checklist de Implementação

- [ ] Atualizar scheduled query `financeiro.custos_operacao_pbi` (06:00)
- [ ] Criar scheduled query `financeiro.entradas` (06:45)
- [ ] Verificar scheduled query `financeiro.custo_usuario_projeto_mes_sync` (07:00)
- [ ] Atualizar scheduled query `financeiro.receita_liquida_projeto_mes` (07:30)
- [ ] Criar scheduled query para views (07:45)
- [ ] Testar fluxo completo manualmente
- [ ] Monitorar execuções por 1 semana

---

## Monitoramento

Para verificar se o pipeline está funcionando:

```sql
-- Verificar última atualização de cada tabela
SELECT
  'custos_operacao_pbi' as tabela,
  MAX(M__s) as ultimo_mes,
  COUNT(*) as total
FROM `dadosindicadores.financeiro.custos_operacao_pbi`
UNION ALL
SELECT
  'entradas',
  MAX(M__s),
  COUNT(*)
FROM `dadosindicadores.financeiro.entradas`
UNION ALL
SELECT
  'receita_liquida_projeto_mes',
  MAX(mes),
  COUNT(*)
FROM `dadosindicadores.financeiro.receita_liquida_projeto_mes`
UNION ALL
SELECT
  'custo_usuario_projeto_mes',
  MAX(mes),
  COUNT(*)
FROM `dadosindicadores.financeiro.custo_usuario_projeto_mes`;
```

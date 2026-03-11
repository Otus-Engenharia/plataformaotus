/* ============================================================
   SCHEDULED QUERY: portifolio_plataforma_enriched
   Execução: every 1 hours
   Resource: projects/683871683880/locations/southamerica-east1/transferConfigs/69731cc9-0000-2112-86d7-f4030436d4fc

   OBJETIVO
   - Enriquecer o portfólio com:
     1) Métricas de Contrato/Aditivo (valor, qtd aditivos, durações)
     2) Datas de início/término do cronograma (Smartsheet)
     3) Pausas do projeto (qtd de pausas e total de dias)
     4) Data de término contratual ajustada pelas pausas
     5) Quantidade de ciclos de compatibilização

   REGRAS IMPORTANTES
   - JOIN Contratos x Portfólio:
       project_code pode vir sem zeros à esquerda (ex: 45015002).
       Padronizamos para 9 dígitos via LPAD(..., 9, '0').
   - Valor_contratado:
       String no formato BR ("R$ 40.200,00") -> NUMERIC (40200.00)
   - Duração de contrato/aditivo:
       Extraímos apenas dígitos do campo (meses).
   - Pausas:
       Duracao vem como texto "129d" -> extraímos dígitos -> dias.
       total_dias_pausa = soma das durações.
       qtd_pausas = contagem de registros de pausa por projeto.
   - Ciclos de compatibilização:
       Campo STRING na planilha de contratos. Convertemos para INT64.
       Um projeto pode ter múltiplos contratos; usamos MAX para pegar
       o maior valor de ciclos (tipicamente do contrato de Compatibilização).
   ============================================================ */

CREATE OR REPLACE TABLE `dadosindicadores.portifolio.portifolio_plataforma_enriched` AS
WITH contratos_clean AS (
  SELECT
    LPAD(TRIM(Cod__do_Projeto_), 9, '0') AS Cod__do_Projeto_norm,
    TRIM(N___de_contrato) AS N___de_contrato,
    UPPER(TRIM(Tipo_de_contrato)) AS Tipo_de_contrato,
    TRIM(Produto) AS Produto,

    -- flag de coordenação (case-insensitive)
    REGEXP_CONTAINS(LOWER(TRIM(Produto)), r'coordena') AS is_coordenacao,

    -- "R$ 40.200,00" -> 40200.00
    SAFE_CAST(
      REPLACE(REPLACE(REPLACE(TRIM(Valor_contratado), 'R$', ''), '.', ''), ',', '.')
      AS NUMERIC
    ) AS Valor_contratado_num,

    -- duração em meses: extrai apenas dígitos
    SAFE_CAST(REGEXP_EXTRACT(TRIM(Dura____o_de_contrato__m__s_), r'\d+') AS INT64) AS duracao_meses,

    -- ciclos de compatibilização: string -> int
    SAFE_CAST(TRIM(Ciclos_de_compatibiliza____o_) AS INT64) AS ciclos_compat
  FROM `dadosindicadores.financeiro.contratos_pbi`
  WHERE Cod__do_Projeto_ IS NOT NULL
),

contratos_agg AS (
  SELECT
    Cod__do_Projeto_norm,

    -- valores (mantidos como antes, sem filtro por produto)
    SUM(CASE WHEN Tipo_de_contrato = 'CONTRATO' THEN COALESCE(Valor_contratado_num, 0) ELSE 0 END) AS valor_contrato_total,
    SUM(CASE WHEN Tipo_de_contrato = 'ADITIVO'  THEN COALESCE(Valor_contratado_num, 0) ELSE 0 END) AS valor_aditivo_total,
    SUM(COALESCE(Valor_contratado_num, 0)) AS valor_total_contrato_mais_aditivos,

    -- qtd aditivos (distinct)
    COUNT(DISTINCT CASE WHEN Tipo_de_contrato = 'ADITIVO' THEN N___de_contrato END) AS qtd_aditivos_distintos,

    -- durações (SOMENTE quando Produto contém "Coordenação")
    SUM(CASE WHEN Tipo_de_contrato = 'CONTRATO' AND is_coordenacao THEN COALESCE(duracao_meses, 0) ELSE 0 END) AS duracao_contrato_total_meses,
    SUM(CASE WHEN Tipo_de_contrato = 'ADITIVO'  AND is_coordenacao THEN COALESCE(duracao_meses, 0) ELSE 0 END) AS duracao_aditivo_total_meses,
    SUM(CASE WHEN is_coordenacao THEN COALESCE(duracao_meses, 0) ELSE 0 END) AS duracao_total_meses,

    -- ciclos: MAX entre todos os contratos do projeto
    MAX(ciclos_compat) AS quantidade_ciclos

  FROM contratos_clean
  GROUP BY Cod__do_Projeto_norm
),

inicio_cronograma AS (
  SELECT
    ID_Projeto AS smartsheet_id,
    MIN(DataDeTermino) AS data_inicio_cronograma
  FROM `dadosindicadores.smartsheet.smartsheet_data_projetos_inicio`
  GROUP BY ID_Projeto
),

termino_cronograma AS (
  SELECT
    ID_Projeto AS smartsheet_id,
    MAX(DataDeTermino) AS data_termino_cronograma
  FROM `dadosindicadores.smartsheet.smartsheet_data_projetos_termino`
  GROUP BY ID_Projeto
),

pausas_projeto AS (
  SELECT
    ID_Projeto AS smartsheet_id,
    COUNT(*) AS qtd_pausas,
    SUM(SAFE_CAST(REGEXP_EXTRACT(TRIM(Duracao), r'\d+') AS INT64)) AS total_dias_pausa,
    MIN(DataDeInicio) AS data_inicio_primeira_pausa,
    MAX(DataDeTermino) AS data_fim_ultima_pausa
  FROM `dadosindicadores.smartsheet.smartsheet_data_projetos_pausas`
  GROUP BY ID_Projeto
)

SELECT
  p.*,

  -- chave normalizada (9 dígitos)
  LPAD(TRIM(p.project_code), 9, '0') AS project_code_norm,

  -- contratos
  a.valor_contrato_total,
  a.valor_aditivo_total,
  a.valor_total_contrato_mais_aditivos,
  a.qtd_aditivos_distintos,
  a.duracao_contrato_total_meses,
  a.duracao_aditivo_total_meses,
  a.duracao_total_meses,

  -- ciclos de compatibilização
  a.quantidade_ciclos,

  -- cronograma
  i.data_inicio_cronograma,
  t.data_termino_cronograma,

  -- pausas
  COALESCE(pa.qtd_pausas, 0) AS qtd_pausas,
  COALESCE(pa.total_dias_pausa, 0) AS total_dias_pausa,
  pa.data_inicio_primeira_pausa,
  pa.data_fim_ultima_pausa,

  -- término contratual (início + duração total em meses) -> agora duração já está filtrada por Coordenação
  CASE
    WHEN i.data_inicio_cronograma IS NOT NULL
     AND a.duracao_total_meses IS NOT NULL
    THEN DATE_ADD(i.data_inicio_cronograma, INTERVAL a.duracao_total_meses MONTH)
    ELSE NULL
  END AS data_termino_contrato,

  -- término contratual ajustado pelas pausas
  CASE
    WHEN i.data_inicio_cronograma IS NOT NULL
     AND a.duracao_total_meses IS NOT NULL
    THEN DATE_ADD(
           DATE_ADD(i.data_inicio_cronograma, INTERVAL a.duracao_total_meses MONTH),
           INTERVAL COALESCE(pa.total_dias_pausa, 0) DAY
         )
    ELSE NULL
  END AS data_termino_contrato_com_pausas

FROM `dadosindicadores.portifolio.portifolio_plataforma` p
LEFT JOIN contratos_agg a
  ON LPAD(TRIM(p.project_code), 9, '0') = a.Cod__do_Projeto_norm
LEFT JOIN inicio_cronograma i
  ON p.smartsheet_id = i.smartsheet_id
LEFT JOIN termino_cronograma t
  ON p.smartsheet_id = t.smartsheet_id
LEFT JOIN pausas_projeto pa
  ON p.smartsheet_id = pa.smartsheet_id
;

/* ============================================================
   VISTA auxiliar: projetos sem valor de contrato
   ============================================================ */

CREATE OR REPLACE VIEW `dadosindicadores.portifolio.vw_projetos_sem_valor_contrato` AS
SELECT
  e.project_code,
  e.project_code_norm,
  e.project_name,
  e.client,
  e.status,
  e.team_id,
  e.nome_time,
  e.valor_contrato_total,
  e.valor_aditivo_total,
  e.valor_total_contrato_mais_aditivos,
  e.qtd_aditivos_distintos,
  e.duracao_contrato_total_meses,
  e.duracao_aditivo_total_meses,
  e.duracao_total_meses
FROM `dadosindicadores.portifolio.portifolio_plataforma_enriched` e
WHERE e.valor_total_contrato_mais_aditivos IS NULL
   OR e.valor_total_contrato_mais_aditivos = 0;

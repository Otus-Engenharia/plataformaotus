/**
 * Recalcula a tabela financeiro.custo_usuario_projeto_mes
 * Executa a mesma SQL da scheduled query documentada em docs/SCHEDULED_QUERY_CUSTOS.sql
 *
 * Uso: node backend/scripts/recalcular-pipeline-custos.js
 *
 * ATENÇÃO: Sobrescreve a tabela inteira (CREATE OR REPLACE TABLE).
 *          O pipeline scheduled query roda diariamente às 07:00.
 *          Este script serve para forçar recalculo manual.
 */

import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID,
});

const projectId = process.env.BIGQUERY_PROJECT_ID;
const location = process.env.BIGQUERY_LOCATION || 'southamerica-east1';

async function main() {
  console.log('=== Recalculando pipeline de custos ===');
  console.log(`Projeto: ${projectId}`);
  console.log(`Tabela destino: ${projectId}.financeiro.custo_usuario_projeto_mes`);
  console.log();

  const query = `
CREATE OR REPLACE TABLE \`${projectId}.financeiro.custo_usuario_projeto_mes\` AS
WITH
-- STEP 1: Peso do salario por usuario/mes
salarios_mes AS (
  SELECT
    Nome_do_fornecedor_cliente AS usuario,
    M__s AS mes,
    ABS(SUM(Valor)) AS salario
  FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\`
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
-- STEP 2: Custo indireto por usuario
indiretos_mes AS (
  SELECT M__s AS mes, ABS(SUM(Valor)) AS custo_indireto_total
  FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_indiretos\`
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
-- STEP 3: Distribuicao por projeto via horas (com alias)
horas_por_projeto AS (
  SELECT
    COALESCE(rev_alias.nome_planilha, tt.usuario) AS usuario,
    tt.projeto,
    DATE_TRUNC(tt.data_de_apontamento, MONTH) AS mes,
    SUM(SAFE_CAST(REPLACE(tt.duracao, ',', '.') AS FLOAT64)) AS horas_usuario_projeto_mes
  FROM \`${projectId}.timetracker_transform.timetracker_limpo\` tt
  LEFT JOIN \`${projectId}.financeiro_custos_operacao.usuario_alias\` rev_alias
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
    AND DATE_ADD(h.mes, INTERVAL 1 MONTH) = c.mes
)
-- STEP 4: Tabela final com alias e ABS
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
LEFT JOIN \`${projectId}.financeiro_custos_operacao.usuario_alias\` alias
  ON LOWER(TRIM(p.usuario)) = LOWER(TRIM(alias.nome_planilha))
LEFT JOIN (
  SELECT LOWER(TRIM(projeto)) AS projeto_norm, MAX(project_code) AS project_code
  FROM \`${projectId}.timetracker_transform.timetracker_limpo\`
  WHERE project_code IS NOT NULL AND project_code != ''
  GROUP BY projeto_norm
) tt ON LOWER(TRIM(p.projeto)) = tt.projeto_norm
  `;

  console.log('Executando query (pode levar alguns minutos)...');
  const startTime = Date.now();

  const [job] = await bigquery.createQueryJob({ query, location });
  console.log(`Job ${job.id} criado.`);

  await job.promise();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Pipeline concluido em ${elapsed}s`);

  // Verificar resultado
  const [verifyJob] = await bigquery.createQueryJob({
    query: `
      SELECT
        COUNT(*) as total_rows,
        COUNT(DISTINCT usuario) as usuarios,
        SUM(CASE WHEN custo_direto_usuario_projeto_mes > 0 THEN 1 ELSE 0 END) as rows_com_custo,
        SUM(CASE WHEN horas_usuario_projeto_mes > 0 AND (custo_direto_usuario_projeto_mes IS NULL OR custo_direto_usuario_projeto_mes = 0) THEN 1 ELSE 0 END) as rows_horas_sem_custo,
        FORMAT_DATE('%Y-%m', MAX(mes)) as ultimo_mes
      FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
    `,
    location
  });
  const [verifyRows] = await verifyJob.getQueryResults();
  const v = verifyRows[0];
  console.log(`\nResultado:`);
  console.log(`  Total linhas: ${v.total_rows}`);
  console.log(`  Usuarios: ${v.usuarios}`);
  console.log(`  Linhas com custo: ${v.rows_com_custo}`);
  console.log(`  Linhas horas sem custo: ${v.rows_horas_sem_custo}`);
  console.log(`  Ultimo mes: ${v.ultimo_mes}`);

  // Verificar Gisele especificamente
  const [giseleJob] = await bigquery.createQueryJob({
    query: `
      SELECT usuario, FORMAT_DATE('%Y-%m', mes) as mes,
        SUM(custo_direto_usuario_projeto_mes) as custo_direto,
        SUM(horas_usuario_projeto_mes) as horas
      FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
      WHERE LOWER(usuario) LIKE '%gisele%'
      GROUP BY usuario, mes
      ORDER BY mes DESC
      LIMIT 5
    `,
    location
  });
  const [giseleRows] = await giseleJob.getQueryResults();
  console.log(`\nVerificacao Gisele:`);
  giseleRows.forEach(r => console.log(`  ${r.usuario} | ${r.mes} | ${r.horas}h | R$${r.custo_direto}`));
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});

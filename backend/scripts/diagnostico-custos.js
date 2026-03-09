/**
 * Script de diagnóstico: identifica usuários com horas mas sem custo no BigQuery
 *
 * Verifica:
 * 1. Último mês com dados financeiros disponíveis
 * 2. Usuários com horas > 0 mas custo = 0 na tabela de custos distribuídos
 * 3. Nomes no timetracker sem match na planilha de custos
 *
 * Uso: node backend/scripts/diagnostico-custos.js
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

async function executeQuery(query) {
  const [job] = await bigquery.createQueryJob({ query, location });
  const [rows] = await job.getQueryResults();
  return rows;
}

async function main() {
  console.log('=== Diagnostico de Custos Zerados ===\n');

  // 1. Ultimo mes com dados financeiros (coluna M__s na planilha)
  console.log('--- 1. Ultimo mes com dados financeiros ---');
  const lastMonthRows = await executeQuery(`
    SELECT
      MAX(M__s) AS ultimo_mes,
      MIN(M__s) AS primeiro_mes,
      COUNT(DISTINCT M__s) AS total_meses
    FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\`
  `);
  const lastMonth = lastMonthRows[0];
  console.log(`Primeiro mes: ${lastMonth.primeiro_mes}`);
  console.log(`Ultimo mes:   ${lastMonth.ultimo_mes}`);
  console.log(`Total meses:  ${lastMonth.total_meses}`);
  console.log();

  // 2. Usuarios com horas > 0 mas custo = 0 na tabela distribuida
  console.log('--- 2. Usuarios com horas mas custo zerado (custo_usuario_projeto_mes) ---');
  const zeroCostRows = await executeQuery(`
    SELECT
      usuario,
      CAST(project_code AS STRING) AS project_code,
      FORMAT_DATE('%Y-%m', mes) AS mes_fmt,
      SUM(horas_usuario_projeto_mes) AS horas,
      SUM(custo_direto_usuario_projeto_mes) AS custo_direto,
      SUM(custo_total_usuario_projeto_mes) AS custo_total
    FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
    WHERE horas_usuario_projeto_mes > 0
      AND (custo_direto_usuario_projeto_mes = 0 OR custo_direto_usuario_projeto_mes IS NULL)
      AND mes IS NOT NULL
    GROUP BY usuario, project_code, mes
    ORDER BY mes DESC, usuario
    LIMIT 50
  `);
  console.log(`Encontrados ${zeroCostRows.length} registros (limit 50):`);
  zeroCostRows.forEach(row => {
    console.log(`  ${row.mes_fmt} | ${row.usuario} | projeto ${row.project_code} | ${row.horas}h | custo_direto: ${row.custo_direto}`);
  });
  console.log();

  // 3. Resumo por usuario: quem tem mais horas sem custo
  console.log('--- 3. Resumo: usuarios com mais horas sem custo ---');
  const summaryRows = await executeQuery(`
    SELECT
      usuario,
      COUNT(DISTINCT FORMAT_DATE('%Y-%m', mes)) AS meses_afetados,
      SUM(horas_usuario_projeto_mes) AS total_horas_sem_custo,
      MIN(FORMAT_DATE('%Y-%m', mes)) AS primeiro_mes,
      MAX(FORMAT_DATE('%Y-%m', mes)) AS ultimo_mes
    FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
    WHERE horas_usuario_projeto_mes > 0
      AND (custo_direto_usuario_projeto_mes = 0 OR custo_direto_usuario_projeto_mes IS NULL)
    GROUP BY usuario
    ORDER BY total_horas_sem_custo DESC
    LIMIT 30
  `);
  console.log(`${summaryRows.length} usuarios afetados:`);
  summaryRows.forEach(row => {
    console.log(`  ${row.usuario}: ${row.total_horas_sem_custo}h sem custo (${row.meses_afetados} meses, ${row.primeiro_mes} a ${row.ultimo_mes})`);
  });
  console.log();

  // 4. Nomes na tabela distribuida que nao existem na planilha de custos
  console.log('--- 4. Nomes sem match na planilha (candidatos para usuario_alias) ---');
  const unmatchedRows = await executeQuery(`
    WITH nomes_custo_distribuido AS (
      SELECT DISTINCT LOWER(TRIM(usuario)) AS nome
      FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
      WHERE horas_usuario_projeto_mes > 0
    ),
    nomes_planilha AS (
      SELECT DISTINCT LOWER(TRIM(Nome_do_fornecedor_cliente)) AS nome
      FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\`
    )
    SELECT cd.nome
    FROM nomes_custo_distribuido cd
    LEFT JOIN nomes_planilha pl ON cd.nome = pl.nome
    WHERE pl.nome IS NULL
    ORDER BY cd.nome
  `);
  console.log(`${unmatchedRows.length} nomes sem match:`);
  unmatchedRows.forEach(row => {
    console.log(`  - ${row.nome}`);
  });
  console.log();

  // 5. Buscar variacoes de "Fran" especificamente
  console.log('--- 5. Busca por "Fran" e variacoes ---');
  const franRows = await executeQuery(`
    SELECT DISTINCT 'custo_usuario_projeto_mes' AS fonte, usuario AS nome
    FROM \`${projectId}.financeiro.custo_usuario_projeto_mes\`
    WHERE LOWER(usuario) LIKE '%fran%'
    UNION ALL
    SELECT DISTINCT 'custos_operacao_diretos' AS fonte, Nome_do_fornecedor_cliente AS nome
    FROM \`${projectId}.financeiro_custos_operacao.custos_operacao_diretos\`
    WHERE LOWER(Nome_do_fornecedor_cliente) LIKE '%fran%'
    ORDER BY fonte, nome
  `);
  console.log(`Resultados:`);
  franRows.forEach(row => {
    console.log(`  [${row.fonte}] ${row.nome}`);
  });

  console.log('\n=== Diagnostico concluido ===');
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});

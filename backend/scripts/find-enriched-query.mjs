/**
 * Descobre o SQL que gera a tabela/view `portifolio_plataforma_enriched`.
 *
 * Tenta duas abordagens:
 *   1. INFORMATION_SCHEMA.VIEWS — se for uma VIEW
 *   2. BigQuery Data Transfer API — se for uma scheduled query
 *
 * Execução: node backend/scripts/find-enriched-query.mjs
 *
 * Pré-requisitos:
 * - GOOGLE_APPLICATION_CREDENTIALS configurado (service account)
 * - gcloud auth login (para listar scheduled queries via REST)
 */
import { BigQuery } from '@google-cloud/bigquery';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores';
const DATASET = 'portifolio';
const TABLE_NAME = 'portifolio_plataforma_enriched';
const LOCATION = 'southamerica-east1';
const PARENT = `projects/${PROJECT_ID}/locations/${LOCATION}`;

const bigquery = new BigQuery({ projectId: PROJECT_ID });

// ─── Etapa 1: Verificar se é uma VIEW ────────────────────────────────

async function tryAsView() {
  console.log('=== Etapa 1: Verificando se é uma VIEW ===\n');

  try {
    const sql = `
      SELECT table_type, ddl
      FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name = '${TABLE_NAME}'
    `;
    const [rows] = await bigquery.query({ query: sql, location: LOCATION });

    if (rows.length === 0) {
      console.log(`Tabela/view "${TABLE_NAME}" não encontrada no dataset "${DATASET}".`);
      return null;
    }

    const row = rows[0];
    console.log(`Tipo: ${row.table_type}`);

    if (row.table_type === 'VIEW') {
      console.log('\n--- DDL da VIEW ---\n');
      console.log(row.ddl);
      return { type: 'VIEW', sql: row.ddl };
    }

    // É uma TABLE — DDL mostra o schema mas não a query que a popula
    console.log(`\n"${TABLE_NAME}" é uma TABLE (não VIEW). DDL do schema:\n`);
    console.log(row.ddl);
    return { type: 'TABLE', sql: row.ddl };
  } catch (err) {
    console.error('Erro ao consultar INFORMATION_SCHEMA:', err.message);
    return null;
  }
}

// ─── Etapa 2: Buscar scheduled queries ──────────────────────────────

async function tryAsScheduledQuery() {
  console.log('\n=== Etapa 2: Buscando Scheduled Queries ===\n');

  let accessToken;
  try {
    accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  } catch {
    console.error('Não foi possível obter access token. Execute: gcloud auth login');
    return null;
  }

  const listUrl = `https://bigquerydatatransfer.googleapis.com/v1/${PARENT}/transferConfigs?dataSourceIds=scheduled_query`;

  const resp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    const err = await resp.json();
    console.error('Erro ao listar scheduled queries:', JSON.stringify(err.error || err, null, 2));
    return null;
  }

  const { transferConfigs = [] } = await resp.json();

  // Filtrar por referências a portifolio_plataforma_enriched
  const matches = transferConfigs.filter((c) => {
    const query = (c.params?.query || '').toLowerCase();
    const name = (c.displayName || '').toLowerCase();
    return (
      query.includes('portifolio_plataforma_enriched') ||
      name.includes('portifolio_plataforma_enriched') ||
      name.includes('portfolio_enriched')
    );
  });

  if (matches.length > 0) {
    console.log(`Encontrada(s) ${matches.length} scheduled query(ies):\n`);
    for (const m of matches) {
      console.log(`  Nome: ${m.displayName}`);
      console.log(`  Resource: ${m.name}`);
      console.log(`  Schedule: ${m.schedule}`);
      console.log(`  Destination: ${m.destinationDatasetId}`);
      console.log('\n--- SQL ---\n');
      console.log(m.params?.query || '(sem query)');
      console.log('\n' + '─'.repeat(60) + '\n');
    }
    return { type: 'SCHEDULED_QUERY', configs: matches };
  }

  // Se não encontrou match direto, listar todas que mencionam "portifolio"
  const portifolioQueries = transferConfigs.filter((c) => {
    const query = (c.params?.query || '').toLowerCase();
    const name = (c.displayName || '').toLowerCase();
    return query.includes('portifolio') || name.includes('portifolio') || name.includes('portfolio');
  });

  if (portifolioQueries.length > 0) {
    console.log('Nenhuma match exata, mas queries relacionadas a "portifolio":\n');
    for (const q of portifolioQueries) {
      console.log(`  - ${q.displayName} (${q.name})`);
      console.log(`    Schedule: ${q.schedule}`);
      console.log(`    Destination: ${q.destinationDatasetId}`);
    }
  } else {
    console.log('Nenhuma scheduled query referencia "portifolio".');
  }

  // Listar todas para referência
  console.log(`\nTodas as scheduled queries (${transferConfigs.length}):`);
  for (const c of transferConfigs) {
    console.log(`  - ${c.displayName}`);
  }

  return null;
}

// ─── Etapa 3: Listar colunas atuais ────────────────────────────────

async function listColumns() {
  console.log('\n=== Etapa 3: Colunas atuais de portifolio_plataforma_enriched ===\n');

  try {
    const sql = `
      SELECT column_name, data_type, is_nullable
      FROM \`${PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${TABLE_NAME}'
      ORDER BY ordinal_position
    `;
    const [rows] = await bigquery.query({ query: sql, location: LOCATION });

    if (rows.length === 0) {
      console.log('Nenhuma coluna encontrada.');
      return;
    }

    console.log(`Total: ${rows.length} colunas\n`);
    const hasCiclos = rows.some((r) => r.column_name === 'quantidade_ciclos');
    for (const r of rows) {
      const marker = r.column_name === 'quantidade_ciclos' ? ' ← JÁ EXISTE!' : '';
      console.log(`  ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})${marker}`);
    }

    if (hasCiclos) {
      console.log('\n✓ Coluna "quantidade_ciclos" já existe na tabela!');
    } else {
      console.log('\n✗ Coluna "quantidade_ciclos" NÃO existe ainda.');
    }
  } catch (err) {
    console.error('Erro ao listar colunas:', err.message);
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`Investigando "${PROJECT_ID}.${DATASET}.${TABLE_NAME}"...\n`);

  const viewResult = await tryAsView();

  if (viewResult?.type === 'VIEW') {
    console.log('\n→ É uma VIEW. O SQL acima define a query.');
  } else {
    const sqResult = await tryAsScheduledQuery();
    if (sqResult) {
      console.log('\n→ Encontrada scheduled query que gera a tabela.');
    } else {
      console.log('\n→ Não encontrada como VIEW nem scheduled query.');
      console.log('  Pode ser uma tabela gerenciada manualmente ou por outro pipeline.');
    }
  }

  await listColumns();
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});

/**
 * Atualiza a Scheduled Query do portifolio_plataforma_enriched no BigQuery
 * para incluir a coluna quantidade_ciclos.
 *
 * Execução: node backend/scripts/update-portfolio-enriched-query.mjs
 *
 * Pré-requisitos:
 * - gcloud auth login (para obter access token)
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const parent = 'projects/dadosindicadores/locations/southamerica-east1';

// Ler SQL atualizado do arquivo de referência
const sqlFile = readFileSync(resolve(__dirname, '../../docs/SCHEDULED_QUERY_PORTFOLIO_ENRICHED.sql'), 'utf8');
const sqlLines = sqlFile.split('\n');

// Extrair somente o bloco SQL executável (do CREATE OR REPLACE até o último ";")
const startLine = sqlLines.findIndex((l) => l.startsWith('CREATE OR REPLACE TABLE'));
// Find the last semicolon (the view CREATE ends with one too)
let endLine = sqlLines.length - 1;
for (let i = sqlLines.length - 1; i >= startLine; i--) {
  if (sqlLines[i].trimEnd().endsWith(';')) {
    endLine = i;
    break;
  }
}
const ENRICHED_SQL = sqlLines.slice(startLine, endLine + 1).join('\n').trim();

function getAccessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function main() {
  const accessToken = getAccessToken();

  // Listar scheduled queries via REST API
  console.log('Buscando scheduled queries existentes...\n');
  const listUrl = `https://bigquerydatatransfer.googleapis.com/v1/${parent}/transferConfigs?dataSourceIds=scheduled_query`;

  const listResp = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResp.ok) {
    const err = await listResp.json();
    console.error('Erro ao listar queries:', JSON.stringify(err.error || err, null, 2));
    process.exit(1);
  }

  const { transferConfigs = [] } = await listResp.json();

  // Encontrar a query de portfolio enriched
  const existing = transferConfigs.filter((c) => {
    const query = (c.params?.query || '').toLowerCase();
    const name = (c.displayName || '').toLowerCase();
    return (
      name.includes('portifolio_plataforma_enriched') ||
      query.includes('portifolio_plataforma_enriched')
    );
  });

  if (existing.length === 0) {
    console.error('Nenhuma scheduled query de portfolio enriched encontrada.');
    console.log('\nQueries disponíveis:');
    transferConfigs.forEach((c) => console.log(`  - ${c.displayName} (${c.name})`));
    process.exit(1);
  }

  const target = existing[0];
  console.log(`Encontrada: "${target.displayName}"`);
  console.log(`  Schedule: ${target.schedule}`);
  console.log(`  Resource: ${target.name}\n`);

  const currentSQL = target.params?.query || '';
  const hasCiclos = currentSQL.toLowerCase().includes('quantidade_ciclos');

  if (hasCiclos) {
    console.log('Query já inclui quantidade_ciclos. Nada a fazer.');
    return;
  }

  console.log('Query NÃO inclui quantidade_ciclos. Atualizando...\n');

  // Atualizar via REST API (só o SQL)
  const url = `https://bigquerydatatransfer.googleapis.com/v1/${target.name}?updateMask=params`;

  const body = {
    params: { query: ENRICHED_SQL },
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('Erro ao atualizar:', JSON.stringify(result.error || result, null, 2));
    process.exit(1);
  }

  console.log('Scheduled query atualizada com sucesso!');
  console.log(`  Display Name: ${result.displayName}`);
  console.log(`  Schedule: ${result.schedule}`);

  // Verificar que o SQL atualizado inclui quantidade_ciclos
  const updatedSQL = result.params?.query || '';
  if (updatedSQL.toLowerCase().includes('quantidade_ciclos')) {
    console.log('\nVerificacao: SQL inclui quantidade_ciclos - OK');
  } else {
    console.warn('\nVerificacao: SQL NAO inclui quantidade_ciclos - VERIFICAR MANUALMENTE');
  }
}

main().catch((err) => {
  console.error('ERRO:', err.message);
  process.exit(1);
});

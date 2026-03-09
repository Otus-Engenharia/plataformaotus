/**
 * Atualiza a Scheduled Query de custos no BigQuery para incluir
 * a lógica de usuario_alias (Steps 1-4 completos).
 *
 * Execução: node backend/scripts/update-custos-scheduled-query.mjs
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
const sqlFile = readFileSync(resolve(__dirname, '../../docs/SCHEDULED_QUERY_CUSTOS.sql'), 'utf8');
const sqlLines = sqlFile.split('\n');
const startLine = sqlLines.findIndex(l => l.startsWith('CREATE OR REPLACE TABLE'));
let endLine = sqlLines.length - 1;
for (let i = startLine; i < sqlLines.length; i++) {
  if (sqlLines[i].trimEnd().endsWith(';')) {
    endLine = i;
    break;
  }
}
const CUSTOS_SQL = sqlLines.slice(startLine, endLine + 1).join('\n').replace(/;\s*$/, '').trim();

function getAccessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function main() {
  const accessToken = getAccessToken();

  // Listar scheduled queries via REST API
  console.log('Buscando scheduled queries existentes...\n');
  const listUrl = `https://bigquerydatatransfer.googleapis.com/v1/${parent}/transferConfigs?dataSourceIds=scheduled_query`;

  const listResp = await fetch(listUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!listResp.ok) {
    const err = await listResp.json();
    console.error('Erro ao listar queries:', JSON.stringify(err.error || err, null, 2));
    process.exit(1);
  }

  const { transferConfigs = [] } = await listResp.json();

  // Encontrar a query de custos
  const existing = transferConfigs.filter(c => {
    const query = (c.params?.query || '').toLowerCase();
    const name = (c.displayName || '').toLowerCase();
    return name.includes('custo_usuario_projeto_mes') ||
           query.includes('financeiro.custo_usuario_projeto_mes');
  });

  if (existing.length === 0) {
    console.error('Nenhuma scheduled query de custos encontrada.');
    console.log('\nQueries disponíveis:');
    transferConfigs.forEach(c => console.log(`  - ${c.displayName} (${c.name})`));
    process.exit(1);
  }

  const target = existing[0];
  console.log(`Encontrada: "${target.displayName}"`);
  console.log(`  Schedule: ${target.schedule}`);
  console.log(`  Resource: ${target.name}\n`);

  const currentSQL = target.params?.query || '';
  const hasAlias = currentSQL.toLowerCase().includes('usuario_alias');

  if (hasAlias) {
    console.log('Query ja inclui usuario_alias. Verificando se esta atualizada...');
  } else {
    console.log('Query NAO inclui usuario_alias. Atualizando...\n');
  }

  // Atualizar via REST API (só o SQL)
  const url = `https://bigquerydatatransfer.googleapis.com/v1/${target.name}?updateMask=params`;

  const body = {
    params: { query: CUSTOS_SQL }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('Erro ao atualizar:', JSON.stringify(result.error || result, null, 2));
    process.exit(1);
  }

  console.log('Scheduled query atualizada com sucesso!');
  console.log(`  Display Name: ${result.displayName}`);
  console.log(`  Schedule: ${result.schedule}`);

  // Verificar que o SQL atualizado inclui usuario_alias
  const updatedSQL = result.params?.query || '';
  if (updatedSQL.toLowerCase().includes('usuario_alias')) {
    console.log('\nVerificacao: SQL inclui usuario_alias - OK');
  } else {
    console.warn('\nVerificacao: SQL NAO inclui usuario_alias - VERIFICAR MANUALMENTE');
  }
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});

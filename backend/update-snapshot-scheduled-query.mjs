/**
 * Cria/Atualiza a Scheduled Query que popula smartsheet_snapshot:
 * - Captura snapshot mensal de smartsheet_data_projetos (incluindo Status)
 * - Schedule: primeira segunda-feira do mês às 06:00
 *
 * Execução: node backend/update-snapshot-scheduled-query.mjs
 *
 * Pré-requisitos:
 * - gcloud auth login (para obter access token)
 * - npm install @google-cloud/bigquery-data-transfer
 */
import pkg from '@google-cloud/bigquery-data-transfer';
const { DataTransferServiceClient } = pkg;
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const client = new DataTransferServiceClient();
const parent = 'projects/dadosindicadores/locations/southamerica-east1';
const projectId = 'dadosindicadores';

const SNAPSHOT_SQL = `
INSERT INTO \`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot\`
  (snapshot_date, ID_Projeto, NomeDaPlanilha, NomeDaTarefa,
   DataDeInicio, DataDeTermino, Disciplina, Level, Duracao, Status, rowNumber,
   Categoria_de_atraso, Motivo_de_atraso, ObservacaoOtus)
SELECT
  CURRENT_DATE() AS snapshot_date,
  ID_Projeto,
  NomeDaPlanilha,
  NomeDaTarefa,
  DataDeInicio,
  DataDeTermino,
  Disciplina,
  Level,
  SAFE_CAST(Duracao AS INT64) AS Duracao,
  Status,
  rowNumber,
  Categoria_de_atraso,
  Motivo_de_atraso,
  ObservacaoOtus
FROM \`dadosindicadores.smartsheet.smartsheet_data_projetos\`
`.trim();

async function main() {
  console.log('🔍 Buscando scheduled queries existentes...\n');

  const [configs] = await client.listTransferConfigs({ parent });

  // Verificar se já existe uma query para smartsheet_snapshot
  const existing = configs.filter(c => {
    if (c.dataSourceId !== 'scheduled_query') return false;
    const query = (c.params?.fields?.query?.stringValue || '').toLowerCase();
    const name = (c.displayName || '').toLowerCase();
    return name.includes('snapshot') ||
           query.includes('smartsheet_atrasos.smartsheet_snapshot');
  });

  if (existing.length > 0) {
    console.log(`✅ Encontrada query existente: "${existing[0].displayName}"`);
    console.log(`   Schedule atual: ${existing[0].schedule}`);
    console.log(`   Resource: ${existing[0].name}\n`);

    const currentSQL = existing[0].params?.fields?.query?.stringValue || '';
    const hasStatus = currentSQL.toLowerCase().includes('status');

    if (hasStatus) {
      console.log('✅ Query já inclui Status.');
    } else {
      console.log('⚠️  Query não inclui Status. Atualizando...');
    }

    // Atualizar a query existente
    const accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
    const resourceName = existing[0].name;
    const url = `https://bigquerydatatransfer.googleapis.com/v1/${resourceName}?updateMask=params,schedule,displayName`;

    const body = {
      displayName: 'smartsheet_snapshot_mensal',
      params: { query: SNAPSHOT_SQL },
      schedule: '1st monday of month 06:00'
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
      console.error('❌ Erro ao atualizar:', JSON.stringify(result.error || result, null, 2));
      return;
    }

    console.log('✅ Scheduled query atualizada!');
    console.log(`   Schedule: ${result.schedule}`);
    return;
  }

  // Criar nova scheduled query
  console.log('📝 Nenhuma query existente encontrada. Criando nova scheduled query...\n');
  console.log('SQL:');
  console.log(SNAPSHOT_SQL);
  console.log('');

  const accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  const url = `https://bigquerydatatransfer.googleapis.com/v1/${parent}/transferConfigs`;

  const body = {
    displayName: 'smartsheet_snapshot_mensal',
    dataSourceId: 'scheduled_query',
    params: {
      query: SNAPSHOT_SQL
    },
    schedule: '1st monday of month 06:00',
    destinationDatasetId: 'smartsheet_atrasos'
  };

  console.log('⏳ Criando via REST API...');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Erro ao criar:', response.status, response.statusText);
    console.error('   Detalhes:', JSON.stringify(result.error || result, null, 2));

    // Tentar com serviceAccountName
    if (result.error?.message) {
      console.log('\n🔄 Tentando com serviceAccountName...');
      const url2 = `${url}?serviceAccountName=dadosindicadores@appspot.gserviceaccount.com`;
      const response2 = await fetch(url2, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const result2 = await response2.json();
      if (!response2.ok) {
        console.error('❌ Também falhou:', JSON.stringify(result2.error || result2, null, 2));
      } else {
        console.log('✅ Scheduled query criada com serviceAccount!');
        console.log(`   Name: ${result2.displayName}`);
        console.log(`   Schedule: ${result2.schedule}`);
        console.log(`   Resource: ${result2.name}`);
      }
    }
    return;
  }

  console.log('✅ Scheduled query criada com sucesso!');
  console.log(`   Name: ${result.displayName}`);
  console.log(`   Schedule: ${result.schedule}`);
  console.log(`   Resource: ${result.name}`);
  console.log('\n🎉 Concluído! A query vai rodar na primeira segunda-feira de cada mês às 06:00.');
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});

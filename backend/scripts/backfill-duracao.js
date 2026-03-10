/**
 * Backfill: corrige Duracao NULL nos snapshots históricos.
 * Usa dados atuais do smartsheet_data_projetos para preencher.
 *
 * Execução: node backend/scripts/backfill-duracao.js
 */
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const bigquery = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID });

async function run() {
  // Step 1: Check how many NULLs exist
  console.log('Checking NULL Duracao count...');
  const [countJob] = await bigquery.createQueryJob({
    query: `SELECT COUNT(*) as cnt FROM \`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot\` WHERE Duracao IS NULL`,
    location: 'southamerica-east1',
  });
  const [countRows] = await countJob.getQueryResults();
  console.log('NULL Duracao rows:', countRows[0].cnt);

  if (Number(countRows[0].cnt) === 0) {
    console.log('No NULLs to backfill. Done.');
    return;
  }

  // Step 2: Backfill using deduplicated source
  console.log('Backfilling...');
  const query = `
    UPDATE \`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot\` snap
    SET snap.Duracao = src_dedup.dur
    FROM (
      SELECT ID_Projeto, NomeDaTarefa,
             MAX(SAFE_CAST(Duracao AS FLOAT64)) AS dur
      FROM \`dadosindicadores.smartsheet.smartsheet_data_projetos\`
      WHERE Duracao IS NOT NULL
      GROUP BY ID_Projeto, NomeDaTarefa
    ) src_dedup
    WHERE snap.ID_Projeto = src_dedup.ID_Projeto
      AND snap.NomeDaTarefa = src_dedup.NomeDaTarefa
      AND snap.Duracao IS NULL
  `;

  const [job] = await bigquery.createQueryJob({ query, location: 'southamerica-east1' });
  const [rows] = await job.getQueryResults();
  const affected = job.metadata?.statistics?.query?.numDmlAffectedRows;
  console.log('Backfill done.', affected, 'rows updated');

  // Step 3: Verify remaining NULLs
  const [verifyJob] = await bigquery.createQueryJob({
    query: `SELECT COUNT(*) as cnt FROM \`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot\` WHERE Duracao IS NULL`,
    location: 'southamerica-east1',
  });
  const [verifyRows] = await verifyJob.getQueryResults();
  console.log('Remaining NULL Duracao rows:', verifyRows[0].cnt);
}

run().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

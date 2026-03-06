/**
 * Backfill: Preenche a coluna project_code nos snapshots históricos.
 *
 * 3 passes:
 *   Pass 1 — Match direto por smartsheet_id atual (portfolio)
 *   Pass 2 — Match por nome normalizado
 *   Pass 3 — Relatório de não-mapeados + mapeamentos manuais
 *
 * Mapeamentos manuais: backend/scripts/snapshot-manual-mappings.json
 *   Formato: { "old_smartsheet_id": "project_code", ... }
 *
 * Execução:
 *   node backend/scripts/backfill-snapshot-project-code.mjs
 *   node backend/scripts/backfill-snapshot-project-code.mjs --dry-run
 */
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores',
});

const SNAPSHOT_TABLE = '`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot`';
const PORTFOLIO_TABLE = '`dadosindicadores.portifolio.portifolio_plataforma_enriched`';
const DRY_RUN = process.argv.includes('--dry-run');

async function runQuery(sql) {
  const [rows] = await bigquery.query({ query: sql, location: 'southamerica-east1' });
  return rows;
}

async function countUnmapped() {
  const rows = await runQuery(`
    SELECT COUNT(*) AS cnt
    FROM ${SNAPSHOT_TABLE}
    WHERE project_code IS NULL
  `);
  return rows[0]?.cnt || 0;
}

async function pass1() {
  console.log('\n━━━ Pass 1: Match direto por smartsheet_id ━━━');

  const previewSql = `
    SELECT DISTINCT
      CAST(snap.ID_Projeto AS STRING) AS snapshot_id,
      port.project_code_norm AS project_code,
      snap.NomeDaPlanilha
    FROM ${SNAPSHOT_TABLE} snap
    JOIN ${PORTFOLIO_TABLE} port
      ON CAST(snap.ID_Projeto AS STRING) = CAST(port.smartsheet_id AS STRING)
    WHERE snap.project_code IS NULL
    LIMIT 50
  `;
  const preview = await runQuery(previewSql);
  console.log(`  Matches encontrados: ${preview.length}${preview.length >= 50 ? '+' : ''}`);
  for (const r of preview.slice(0, 10)) {
    console.log(`    ${r.snapshot_id} → ${r.project_code} (${r.NomeDaPlanilha})`);
  }

  if (DRY_RUN) {
    console.log('  [DRY-RUN] Nenhum UPDATE executado.');
    return;
  }

  const updateSql = `
    UPDATE ${SNAPSHOT_TABLE} snap
    SET snap.project_code = port.project_code_norm
    FROM ${PORTFOLIO_TABLE} port
    WHERE snap.project_code IS NULL
      AND CAST(snap.ID_Projeto AS STRING) = CAST(port.smartsheet_id AS STRING)
  `;
  const [job] = await bigquery.createQueryJob({ query: updateSql, location: 'southamerica-east1' });
  const [metadata] = await job.getMetadata();
  const affected = metadata.statistics?.query?.numDmlAffectedRows || '?';
  console.log(`  ✅ Pass 1: ${affected} linhas atualizadas`);
}

async function pass2() {
  console.log('\n━━━ Pass 2: Match por nome normalizado ━━━');

  const previewSql = `
    SELECT DISTINCT
      CAST(snap.ID_Projeto AS STRING) AS snapshot_id,
      snap.NomeDaPlanilha,
      port.project_code_norm AS project_code,
      port.project_name
    FROM ${SNAPSHOT_TABLE} snap
    JOIN ${PORTFOLIO_TABLE} port
      ON LOWER(REGEXP_REPLACE(
           REGEXP_REPLACE(snap.NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
           r'[^a-zA-Z0-9]', ''
         ))
         LIKE CONCAT('%', LOWER(REGEXP_REPLACE(port.project_name, r'[^a-zA-Z0-9]', '')), '%')
    WHERE snap.project_code IS NULL
      AND port.project_code_norm IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(port.project_name, r'[^a-zA-Z0-9]', '')) > 3
    LIMIT 50
  `;
  const preview = await runQuery(previewSql);
  console.log(`  Matches encontrados: ${preview.length}${preview.length >= 50 ? '+' : ''}`);
  for (const r of preview.slice(0, 15)) {
    console.log(`    ${r.snapshot_id} → ${r.project_code}`);
    console.log(`      Planilha: ${r.NomeDaPlanilha}`);
    console.log(`      Portfolio: ${r.project_name}`);
  }

  if (DRY_RUN) {
    console.log('  [DRY-RUN] Nenhum UPDATE executado.');
    return;
  }

  const updateSql = `
    UPDATE ${SNAPSHOT_TABLE} snap
    SET snap.project_code = port.project_code_norm
    FROM ${PORTFOLIO_TABLE} port
    WHERE snap.project_code IS NULL
      AND port.project_code_norm IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(port.project_name, r'[^a-zA-Z0-9]', '')) > 3
      AND LOWER(REGEXP_REPLACE(
           REGEXP_REPLACE(snap.NomeDaPlanilha, r'^\\(.*?\\)\\s*', ''),
           r'[^a-zA-Z0-9]', ''
         ))
         LIKE CONCAT('%', LOWER(REGEXP_REPLACE(port.project_name, r'[^a-zA-Z0-9]', '')), '%')
  `;
  const [job] = await bigquery.createQueryJob({ query: updateSql, location: 'southamerica-east1' });
  const [metadata] = await job.getMetadata();
  const affected = metadata.statistics?.query?.numDmlAffectedRows || '?';
  console.log(`  ✅ Pass 2: ${affected} linhas atualizadas`);
}

async function passManualMappings() {
  const mappingsPath = join(__dirname, 'snapshot-manual-mappings.json');
  if (!existsSync(mappingsPath)) {
    console.log('\n  ℹ️  Arquivo snapshot-manual-mappings.json não encontrado. Pule este passo ou crie-o.');
    return;
  }

  console.log('\n━━━ Pass Manual: Aplicando mapeamentos manuais ━━━');
  const mappings = JSON.parse(readFileSync(mappingsPath, 'utf-8'));
  const entries = Object.entries(mappings);
  console.log(`  ${entries.length} mapeamentos encontrados no JSON.`);

  if (entries.length === 0) return;

  for (const [oldId, projectCode] of entries) {
    const escapedId = String(oldId).replace(/'/g, "''");
    const escapedCode = String(projectCode).replace(/'/g, "''");

    if (DRY_RUN) {
      const countSql = `
        SELECT COUNT(*) AS cnt FROM ${SNAPSHOT_TABLE}
        WHERE project_code IS NULL AND CAST(ID_Projeto AS STRING) = '${escapedId}'
      `;
      const rows = await runQuery(countSql);
      console.log(`    ${oldId} → ${projectCode} (${rows[0]?.cnt || 0} linhas)`);
      continue;
    }

    const updateSql = `
      UPDATE ${SNAPSHOT_TABLE}
      SET project_code = '${escapedCode}'
      WHERE project_code IS NULL
        AND CAST(ID_Projeto AS STRING) = '${escapedId}'
    `;
    const [job] = await bigquery.createQueryJob({ query: updateSql, location: 'southamerica-east1' });
    const [metadata] = await job.getMetadata();
    const affected = metadata.statistics?.query?.numDmlAffectedRows || '0';
    console.log(`    ${oldId} → ${projectCode}: ${affected} linhas`);
  }
}

async function pass3Report() {
  console.log('\n━━━ Pass 3: Relatório de não-mapeados ━━━');

  const reportSql = `
    SELECT DISTINCT
      CAST(ID_Projeto AS STRING) AS ID_Projeto,
      NomeDaPlanilha,
      COUNT(*) AS row_count
    FROM ${SNAPSHOT_TABLE}
    WHERE project_code IS NULL
    GROUP BY ID_Projeto, NomeDaPlanilha
    ORDER BY row_count DESC
  `;
  const rows = await runQuery(reportSql);

  if (rows.length === 0) {
    console.log('  🎉 Todos os snapshots foram mapeados!');
    return;
  }

  console.log(`  ⚠️  ${rows.length} combinações ID_Projeto/Planilha sem project_code:\n`);
  console.log('  ID_Projeto                | Linhas | Planilha');
  console.log('  ─────────────────────────────────────────────────────────────────');
  for (const r of rows) {
    const id = String(r.ID_Projeto).padEnd(26);
    const cnt = String(r.row_count).padStart(6);
    console.log(`  ${id} | ${cnt} | ${r.NomeDaPlanilha}`);
  }

  console.log(`\n  Para mapear manualmente, crie backend/scripts/snapshot-manual-mappings.json:`);
  console.log('  {');
  for (const r of rows.slice(0, 3)) {
    console.log(`    "${r.ID_Projeto}": "PROJECT_CODE_AQUI",`);
  }
  console.log('    ...');
  console.log('  }');
  console.log('  E re-execute este script.');
}

async function main() {
  console.log('🔄 Backfill: project_code nos snapshots históricos');
  if (DRY_RUN) console.log('   Modo: DRY-RUN (nenhum dado será alterado)\n');

  const before = await countUnmapped();
  console.log(`📊 Snapshots sem project_code: ${before}`);

  if (before === 0) {
    console.log('🎉 Nenhum snapshot para mapear!');
    return;
  }

  await pass1();
  await pass2();
  await passManualMappings();

  const after = await countUnmapped();
  console.log(`\n📊 Resultado: ${before - after} mapeados, ${after} restantes`);

  await pass3Report();
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});

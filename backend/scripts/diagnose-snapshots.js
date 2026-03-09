/**
 * Diagnóstico: analisa snapshots para entender por que MAR tem poucos desvios.
 *
 * Execução: node backend/scripts/diagnose-snapshots.js
 */
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const bigquery = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID });
const TABLE = '`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot`';

async function query(sql) {
  const [job] = await bigquery.createQueryJob({ query: sql, location: 'southamerica-east1' });
  const [rows] = await job.getQueryResults();
  return rows;
}

async function run() {
  // Q1: Overview por snapshot_date
  console.log('\n=== Q1: Rows e projetos por snapshot_date ===');
  const q1 = await query(`
    SELECT
      snapshot_date,
      COUNT(*) AS row_count,
      COUNT(DISTINCT ID_Projeto) AS projetos,
      COUNTIF(Level = 5) AS level5,
      COUNTIF(Disciplina IS NULL OR TRIM(Disciplina) = '') AS null_disc,
      COUNTIF(Duracao IS NULL) AS null_dur,
      COUNTIF(NomeDaTarefa IS NULL OR TRIM(NomeDaTarefa) = '') AS null_nome
    FROM ${TABLE}
    GROUP BY 1
    ORDER BY 1
  `);
  for (const r of q1) {
    const d = r.snapshot_date?.value || r.snapshot_date;
    console.log(`  ${d}: ${r.row_count} rows, ${r.projetos} projetos, ${r.level5} L5, null_disc=${r.null_disc}, null_dur=${r.null_dur}, null_nome=${r.null_nome}`);
  }

  // Q2: Para os dois snapshots mais recentes, comparar matching por projeto
  const dates = q1.map(r => String(r.snapshot_date?.value || r.snapshot_date).split('T')[0]).sort();
  if (dates.length < 2) {
    console.log('Menos de 2 snapshots, nada para comparar.');
    return;
  }
  const prevDate = dates[dates.length - 2];
  const currDate = dates[dates.length - 1];
  console.log(`\n=== Q2: Comparando ${prevDate} vs ${currDate} ===`);

  // Q2a: Projetos que existem em cada snapshot (Level 5 only, com Disciplina)
  const q2a = await query(`
    WITH filtered AS (
      SELECT ID_Projeto, snapshot_date
      FROM ${TABLE}
      WHERE Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
        AND NomeDaPlanilha NOT LIKE '%Cópia%'
        AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
        AND NomeDaPlanilha NOT LIKE '%Copy%'
    )
    SELECT
      COUNTIF(snapshot_date = '${prevDate}') AS prev_tasks,
      COUNT(DISTINCT IF(snapshot_date = '${prevDate}', ID_Projeto, NULL)) AS prev_projects,
      COUNTIF(snapshot_date = '${currDate}') AS curr_tasks,
      COUNT(DISTINCT IF(snapshot_date = '${currDate}', ID_Projeto, NULL)) AS curr_projects
    FROM filtered
    WHERE snapshot_date IN ('${prevDate}', '${currDate}')
  `);
  console.log(`  ${prevDate}: ${q2a[0].prev_tasks} tarefas L5, ${q2a[0].prev_projects} projetos`);
  console.log(`  ${currDate}: ${q2a[0].curr_tasks} tarefas L5, ${q2a[0].curr_projects} projetos`);

  // Q2b: Projetos em ambos snapshots vs só num deles
  const q2b = await query(`
    WITH proj_dates AS (
      SELECT ID_Projeto,
        COUNTIF(snapshot_date = '${prevDate}') > 0 AS in_prev,
        COUNTIF(snapshot_date = '${currDate}') > 0 AS in_curr
      FROM ${TABLE}
      WHERE Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
        AND NomeDaPlanilha NOT LIKE '%Cópia%'
        AND NomeDaPlanilha NOT LIKE '%OBSOLETO%'
        AND NomeDaPlanilha NOT LIKE '%Copy%'
      GROUP BY 1
    )
    SELECT
      COUNTIF(in_prev AND in_curr) AS both,
      COUNTIF(in_prev AND NOT in_curr) AS only_prev,
      COUNTIF(NOT in_prev AND in_curr) AS only_curr
    FROM proj_dates
  `);
  console.log(`  Projetos em ambos: ${q2b[0].both}, só ${prevDate}: ${q2b[0].only_prev}, só ${currDate}: ${q2b[0].only_curr}`);

  // Q3: Taxa de matching por NomeDaTarefa||Disciplina para projetos em ambos
  console.log(`\n=== Q3: Matching NomeDaTarefa||Disciplina entre snapshots ===`);
  const q3 = await query(`
    WITH prev AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${prevDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    curr AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${currDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    matched AS (
      SELECT p.ID_Projeto, COUNT(*) AS matched_tasks
      FROM prev p
      INNER JOIN curr c ON p.ID_Projeto = c.ID_Projeto AND p.nome = c.nome AND p.disc = c.disc
      GROUP BY 1
    ),
    prev_counts AS (
      SELECT ID_Projeto, COUNT(*) AS total FROM prev GROUP BY 1
    ),
    curr_counts AS (
      SELECT ID_Projeto, COUNT(*) AS total FROM curr GROUP BY 1
    )
    SELECT
      p.ID_Projeto,
      p.total AS prev_total,
      c.total AS curr_total,
      COALESCE(m.matched_tasks, 0) AS matched,
      p.total - COALESCE(m.matched_tasks, 0) AS unmatched_prev,
      c.total - COALESCE(m.matched_tasks, 0) AS unmatched_curr
    FROM prev_counts p
    INNER JOIN curr_counts c ON p.ID_Projeto = c.ID_Projeto
    LEFT JOIN matched m ON p.ID_Projeto = m.ID_Projeto
    WHERE COALESCE(m.matched_tasks, 0) < LEAST(p.total, c.total) * 0.5
    ORDER BY (p.total + c.total - 2 * COALESCE(m.matched_tasks, 0)) DESC
    LIMIT 20
  `);
  console.log(`  Projetos com >50% de tarefas não-matcheadas (top 20):`);
  for (const r of q3) {
    const matchRate = r.prev_total > 0 ? (r.matched / r.prev_total * 100).toFixed(0) : 0;
    console.log(`    ${r.ID_Projeto}: prev=${r.prev_total} curr=${r.curr_total} matched=${r.matched} (${matchRate}%) unmatched_prev=${r.unmatched_prev} unmatched_curr=${r.unmatched_curr}`);
  }

  // Q4: Match ONLY by NomeDaTarefa (sem Disciplina) — comparar taxa
  console.log(`\n=== Q4: Matching ONLY by NomeDaTarefa (sem Disciplina) ===`);
  const q4 = await query(`
    WITH prev AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${prevDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    curr AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${currDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    matched_nome_disc AS (
      SELECT p.ID_Projeto, COUNT(DISTINCT p.nome || '||' || p.disc) AS matched
      FROM prev p
      INNER JOIN curr c ON p.ID_Projeto = c.ID_Projeto AND p.nome = c.nome AND p.disc = c.disc
      GROUP BY 1
    ),
    matched_nome_only AS (
      SELECT p.ID_Projeto, COUNT(DISTINCT p.nome) AS matched
      FROM prev p
      INNER JOIN curr c ON p.ID_Projeto = c.ID_Projeto AND p.nome = c.nome
      GROUP BY 1
    ),
    totals AS (
      SELECT ID_Projeto, COUNT(DISTINCT nome || '||' || disc) AS total_nd, COUNT(DISTINCT nome) AS total_n
      FROM prev GROUP BY 1
    )
    SELECT
      t.ID_Projeto,
      t.total_nd AS prev_keys,
      COALESCE(md.matched, 0) AS matched_nd,
      COALESCE(mn.matched, 0) AS matched_n,
      ROUND(SAFE_DIVIDE(COALESCE(md.matched, 0), t.total_nd) * 100) AS pct_nd,
      ROUND(SAFE_DIVIDE(COALESCE(mn.matched, 0), t.total_n) * 100) AS pct_n
    FROM totals t
    LEFT JOIN matched_nome_disc md ON t.ID_Projeto = md.ID_Projeto
    LEFT JOIN matched_nome_only mn ON t.ID_Projeto = mn.ID_Projeto
    WHERE COALESCE(md.matched, 0) < t.total_nd * 0.5
    ORDER BY t.total_nd DESC
    LIMIT 20
  `);
  console.log(`  Projetos com baixo matching (nome||disc vs nome-only):`);
  for (const r of q4) {
    console.log(`    ${r.ID_Projeto}: keys=${r.prev_keys} matched_nd=${r.matched_nd}(${r.pct_nd}%) matched_name_only=${r.matched_n}(${r.pct_n}%)`);
  }

  // Q5: Exemplos de disciplinas que mudaram
  console.log(`\n=== Q5: Exemplos de tarefas com mesmo nome mas disciplina diferente ===`);
  const q5 = await query(`
    WITH prev AS (
      SELECT ID_Projeto, NomeDaTarefa, Disciplina
      FROM ${TABLE}
      WHERE snapshot_date = '${prevDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    curr AS (
      SELECT ID_Projeto, NomeDaTarefa, Disciplina
      FROM ${TABLE}
      WHERE snapshot_date = '${currDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    )
    SELECT
      p.ID_Projeto,
      p.NomeDaTarefa,
      p.Disciplina AS prev_disc,
      c.Disciplina AS curr_disc
    FROM prev p
    INNER JOIN curr c
      ON p.ID_Projeto = c.ID_Projeto
      AND LOWER(TRIM(p.NomeDaTarefa)) = LOWER(TRIM(c.NomeDaTarefa))
      AND LOWER(TRIM(p.Disciplina)) != LOWER(TRIM(c.Disciplina))
    LIMIT 30
  `);
  console.log(`  ${q5.length} exemplos encontrados:`);
  for (const r of q5) {
    console.log(`    [${r.ID_Projeto}] "${r.NomeDaTarefa}": ${r.prev_disc} → ${r.curr_disc}`);
  }

  // Q6: Aggregate — quantas tarefas totais matcheiam nome||disc vs nome-only
  console.log(`\n=== Q6: Match rates globais ===`);
  const q6 = await query(`
    WITH prev AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${prevDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    ),
    curr AS (
      SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, LOWER(TRIM(Disciplina)) AS disc
      FROM ${TABLE}
      WHERE snapshot_date = '${currDate}' AND Level = 5
        AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
        AND NomeDaPlanilha NOT LIKE '%(Backup%'
    )
    SELECT
      (SELECT COUNT(*) FROM prev) AS total_prev,
      (SELECT COUNT(*) FROM curr) AS total_curr,
      (SELECT COUNT(*) FROM prev p INNER JOIN curr c ON p.ID_Projeto = c.ID_Projeto AND p.nome = c.nome AND p.disc = c.disc) AS matched_nd,
      (SELECT COUNT(*) FROM prev p INNER JOIN curr c ON p.ID_Projeto = c.ID_Projeto AND p.nome = c.nome) AS matched_name_only
  `);
  const r = q6[0];
  console.log(`  Prev: ${r.total_prev} tarefas, Curr: ${r.total_curr} tarefas`);
  console.log(`  Match nome||disc: ${r.matched_nd} (${(r.matched_nd/r.total_prev*100).toFixed(1)}%)`);
  console.log(`  Match nome-only:  ${r.matched_name_only} (${(r.matched_name_only/r.total_prev*100).toFixed(1)}%)`);

  // Q7: Check for duplicate keys in NomeDaTarefa-only matching within same project
  console.log(`\n=== Q7: Nomes duplicados dentro do mesmo projeto (risco de nome-only match) ===`);
  const q7 = await query(`
    SELECT ID_Projeto, LOWER(TRIM(NomeDaTarefa)) AS nome, COUNT(*) AS cnt, COUNT(DISTINCT Disciplina) AS disc_count
    FROM ${TABLE}
    WHERE snapshot_date = '${currDate}' AND Level = 5
      AND Disciplina IS NOT NULL AND TRIM(Disciplina) != ''
      AND NomeDaPlanilha NOT LIKE '%(Backup%'
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log(`  ${q7.length} nomes duplicados (top 20):`);
  for (const r of q7) {
    console.log(`    [${r.ID_Projeto}] "${r.nome}" × ${r.cnt} (${r.disc_count} disciplinas distintas)`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });

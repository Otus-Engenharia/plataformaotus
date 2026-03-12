/**
 * Script de diagnostico: Entregas Autodoc mostrando apenas OR_JBA
 *
 * Verifica:
 * 1. Sync runs recentes (ultimas 48h)
 * 2. Documentos por projeto nos ultimos 7 dias
 * 3. Mapeamentos ativos
 * 4. Distribuicao de datas dos documentos
 *
 * Uso: cd backend && node scripts/diagnose-autodoc-entregas.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function run() {
  console.log('=== DIAGNOSTICO: Entregas Autodoc ===\n');

  // 1. Sync runs recentes (ultimas 48h)
  console.log('--- 1. Sync Runs (ultimas 48h) ---');
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: runs, error: runsErr } = await supabase
    .from('autodoc_sync_runs')
    .select('id, autodoc_customer_id, status, error, started_at, finished_at, documents_found, new_documents, projects_completed, total_projects')
    .gte('started_at', since48h)
    .order('started_at', { ascending: false });

  if (runsErr) {
    console.error('Erro:', runsErr.message);
  } else if (!runs || runs.length === 0) {
    console.log('NENHUM sync run nas ultimas 48h! Este e provavelmente o problema.');
  } else {
    console.log(`${runs.length} sync run(s) encontrado(s):`);
    for (const r of runs) {
      const duration = r.finished_at && r.started_at
        ? ((new Date(r.finished_at) - new Date(r.started_at)) / 1000).toFixed(0) + 's'
        : 'em andamento';
      console.log(`  [${r.status}] customer=${r.autodoc_customer_id} | docs_found=${r.documents_found || 0} new=${r.new_documents || 0} | projetos=${r.projects_completed || 0}/${r.total_projects || '?'} | duracao=${duration}${r.error ? ` | ERRO: ${r.error}` : ''}`);
    }
  }

  // 2. Documentos por projeto nos ultimos 7 dias
  console.log('\n--- 2. Documentos por projeto (ultimos 7 dias) ---');
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: docs7d, error: docs7dErr } = await supabase
    .from('autodoc_documents')
    .select('project_code, autodoc_created_at')
    .gte('autodoc_created_at', since7d)
    .neq('project_code', '__DISMISSED__');

  if (docs7dErr) {
    console.error('Erro:', docs7dErr.message);
  } else {
    const byProject = {};
    for (const d of (docs7d || [])) {
      if (!byProject[d.project_code]) {
        byProject[d.project_code] = { count: 0, oldest: d.autodoc_created_at, newest: d.autodoc_created_at };
      }
      byProject[d.project_code].count++;
      if (d.autodoc_created_at < byProject[d.project_code].oldest) byProject[d.project_code].oldest = d.autodoc_created_at;
      if (d.autodoc_created_at > byProject[d.project_code].newest) byProject[d.project_code].newest = d.autodoc_created_at;
    }

    const sorted = Object.entries(byProject).sort((a, b) => b[1].count - a[1].count);
    console.log(`${sorted.length} projeto(s) com entregas nos ultimos 7 dias:`);
    for (const [code, info] of sorted) {
      console.log(`  ${code}: ${info.count} docs | oldest=${info.oldest} | newest=${info.newest}`);
    }

    if (sorted.length === 0) {
      console.log('  NENHUM documento nos ultimos 7 dias!');
    }
  }

  // 3. Mapeamentos ativos
  console.log('\n--- 3. Mapeamentos ativos ---');
  const { data: mappings, error: mapErr } = await supabase
    .from('autodoc_project_mappings')
    .select('portfolio_project_code, autodoc_customer_id, autodoc_customer_name, autodoc_project_name, use_classic_api, active')
    .eq('active', true)
    .order('portfolio_project_code');

  if (mapErr) {
    console.error('Erro:', mapErr.message);
  } else {
    console.log(`${(mappings || []).length} mapeamento(s) ativo(s):`);
    for (const m of (mappings || [])) {
      console.log(`  ${m.portfolio_project_code} → ${m.autodoc_customer_name}/${m.autodoc_project_name} (customer=${m.autodoc_customer_id}, classic=${m.use_classic_api})`);
    }
  }

  // 4. Todos os documentos - distribuicao de autodoc_created_at (top 20 datas)
  console.log('\n--- 4. Distribuicao de datas (top 20 timestamps distintos) ---');
  const { data: allDocs, error: allErr } = await supabase
    .from('autodoc_documents')
    .select('autodoc_created_at, project_code')
    .neq('project_code', '__DISMISSED__')
    .order('autodoc_created_at', { ascending: false })
    .limit(5000);

  if (allErr) {
    console.error('Erro:', allErr.message);
  } else {
    // Group by timestamp (truncate to minute)
    const byTimestamp = {};
    for (const d of (allDocs || [])) {
      const ts = d.autodoc_created_at?.substring(0, 16) || 'null'; // YYYY-MM-DDTHH:MM
      if (!byTimestamp[ts]) byTimestamp[ts] = { count: 0, projects: new Set() };
      byTimestamp[ts].count++;
      byTimestamp[ts].projects.add(d.project_code);
    }

    const sorted = Object.entries(byTimestamp)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    for (const [ts, info] of sorted) {
      const projects = [...info.projects].join(', ');
      console.log(`  ${ts} → ${info.count} docs (projetos: ${projects})`);
    }
  }

  // 5. Check: documentos sem created_at real (todos no mesmo minuto = sync timestamp)
  console.log('\n--- 5. Verificacao: docs com timestamp de sync (mesmo minuto) ---');
  if (allDocs) {
    // If many docs share the exact same minute, they likely got the sync timestamp
    const byMinute = {};
    for (const d of allDocs) {
      const min = d.autodoc_created_at?.substring(0, 16) || 'null';
      if (!byMinute[min]) byMinute[min] = 0;
      byMinute[min]++;
    }
    const suspicious = Object.entries(byMinute)
      .filter(([, count]) => count > 5)
      .sort((a, b) => b[1] - a[1]);

    if (suspicious.length > 0) {
      console.log('Timestamps com muitos docs (provavelmente timestamp de sync, nao de entrega):');
      for (const [ts, count] of suspicious) {
        console.log(`  ${ts} → ${count} docs`);
      }
    } else {
      console.log('Nenhum cluster suspeito de timestamps encontrado.');
    }
  }

  console.log('\n=== FIM DO DIAGNOSTICO ===');
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

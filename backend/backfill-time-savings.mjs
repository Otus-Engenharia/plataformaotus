/**
 * Script de backfill: cria eventos de economia de horas para relatórios já gerados.
 * Só considera usuários do setor Operação (igual ao trackTimeSaving em produção).
 *
 * Uso:
 *   node backend/backfill-time-savings.mjs
 *   FROM_DATE=2026-02-01T00:00:00Z node backend/backfill-time-savings.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Segunda-feira da semana atual (semana 10 de 2026 = 23/02)
const FROM_DATE = process.env.FROM_DATE || '2026-02-23T00:00:00Z';

async function main() {
  console.log(`[Backfill] Buscando relatórios completados desde ${FROM_DATE}...\n`);

  // 1. Obter default_minutes do catálogo
  const { data: catalog, error: catalogError } = await supabase
    .from('time_savings_catalog')
    .select('default_minutes')
    .eq('id', 'weekly_report_generation')
    .single();

  if (catalogError) {
    throw new Error(`Catálogo não encontrado: ${catalogError.message}. Verifique se a migration 003 foi aplicada.`);
  }
  const minutesSaved = Number(catalog.default_minutes);
  console.log(`[Backfill] Catálogo OK — ${minutesSaved} min por relatório`);

  // 2. Buscar relatórios completados
  const { data: reports, error: reportsError } = await supabase
    .from('weekly_reports')
    .select('id, project_code, project_name, generated_by, generated_at')
    .eq('status', 'completed')
    .gte('generated_at', FROM_DATE)
    .order('generated_at', { ascending: true });

  if (reportsError) throw new Error(`Erro ao buscar relatórios: ${reportsError.message}`);
  console.log(`[Backfill] ${reports.length} relatórios encontrados`);

  if (reports.length === 0) {
    console.log('[Backfill] Nenhum relatório para processar.');
    return;
  }

  // 3. Filtrar só usuários do setor Operação
  const emails = [...new Set(reports.map(r => r.generated_by))];
  const { data: users } = await supabase
    .from('users_otus')
    .select('email, setor:setor_id(name)')
    .in('email', emails);

  const operacaoEmails = new Set(
    (users || [])
      .filter(u => u.setor?.name === 'Operação')
      .map(u => u.email)
  );

  const operacaoReports = reports.filter(r => operacaoEmails.has(r.generated_by));
  const skipped = reports.length - operacaoReports.length;
  console.log(`[Backfill] ${operacaoReports.length} de Operação (${skipped} ignorados — fora do setor)\n`);

  if (operacaoReports.length === 0) {
    console.log('[Backfill] Nenhum relatório de Operação para processar.');
    return;
  }

  // 4. Verificar quais já têm evento (idempotência)
  const reportIds = operacaoReports.map(r => r.id);
  const { data: existing } = await supabase
    .from('time_savings_events')
    .select('resource_id')
    .eq('catalog_id', 'weekly_report_generation')
    .in('resource_id', reportIds);

  const alreadyDone = new Set((existing || []).map(e => e.resource_id));

  // 5. Filtrar e preparar inserts
  const toInsert = operacaoReports
    .filter(r => !alreadyDone.has(r.id))
    .map(r => ({
      catalog_id: 'weekly_report_generation',
      user_email: r.generated_by,
      user_name: null,
      minutes_saved: minutesSaved,
      resource_type: 'project',
      resource_id: r.id,
      resource_name: r.project_name || r.project_code,
      details: { project_code: r.project_code, backfill: true },
      created_at: r.generated_at,
    }));

  if (toInsert.length === 0) {
    console.log('[Backfill] Nenhum evento novo (todos já existem). Idempotente ✓');
    return;
  }

  // 6. Inserir
  const { error: insertError } = await supabase.from('time_savings_events').insert(toInsert);
  if (insertError) throw new Error(`Erro ao inserir eventos: ${insertError.message}`);

  const totalHoras = (toInsert.length * minutesSaved / 60).toFixed(1);
  console.log(`[Backfill] ✓ ${toInsert.length} eventos inseridos → ${totalHoras}h economizadas`);
  if (alreadyDone.size > 0) console.log(`[Backfill]   ${alreadyDone.size} já existiam (ignorados)`);

  console.log('\n[Backfill] Relatórios processados:');
  for (const r of toInsert) {
    console.log(`  • ${r.resource_name} — ${r.user_email}`);
  }
}

main().catch(err => {
  console.error('\n[Backfill] ERRO:', err.message);
  process.exit(1);
});

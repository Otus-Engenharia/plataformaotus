import { getSupabaseClient } from '../supabase.js';
const supabase = getSupabaseClient();

const aliciaId = 'f22da494-12b7-4c4b-91ca-95e204afd096';

// Checar TODAS as tarefas da Alicia que são recorrentes (parent + filhas)
const { data: allRecurring, count: totalRecurring } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, parent_task_id, start_date, created_at', { count: 'exact' })
  .eq('user_id', aliciaId)
  .neq('recurrence', 'nunca')
  .order('start_date', { ascending: true });

console.log(`=== Todas tarefas recorrentes da Alicia: ${totalRecurring} ===`);
for (const t of allRecurring || []) {
  const type = t.parent_task_id ? 'FILHA' : 'PARENT';
  console.log(`  [${type}] [ID ${t.id}] ${t.name} (${t.recurrence}) start=${t.start_date} created=${t.created_at} parent=${t.parent_task_id || '-'}`);
}

// Checar se há tarefas com nomes que parecem recorrentes mas não são marcadas como tal
const { data: weekTasks } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, start_date, standard_agenda_task')
  .eq('user_id', aliciaId)
  .gte('start_date', '2026-02-23T00:00:00')
  .lte('start_date', '2026-02-27T23:59:59')
  .eq('recurrence', 'nunca')
  .order('start_date', { ascending: true });

console.log(`\n=== Tarefas NÃO-recorrentes da Alicia semana 23-27 fev: ${weekTasks?.length || 0} ===`);
// Agrupar por nome para ver repetições
const nameCount = {};
for (const t of weekTasks || []) {
  nameCount[t.name] = (nameCount[t.name] || 0) + 1;
}
for (const [name, count] of Object.entries(nameCount).sort((a,b) => b[1]-a[1])) {
  console.log(`  "${name}" × ${count}`);
}

// Checar quantas tarefas normais por semana (últimas 4 semanas)
const weeks = [
  { label: '10-14 fev', start: '2026-02-09T00:00:00', end: '2026-02-13T23:59:59' },
  { label: '17-21 fev', start: '2026-02-16T00:00:00', end: '2026-02-20T23:59:59' },
  { label: '23-27 fev', start: '2026-02-23T00:00:00', end: '2026-02-27T23:59:59' },
  { label: '2-6 mar',   start: '2026-03-02T00:00:00', end: '2026-03-06T23:59:59' },
];

console.log('\n=== Contagem de tarefas por semana ===');
for (const w of weeks) {
  const { count: total } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', aliciaId)
    .not('start_date', 'is', null)
    .gte('start_date', w.start)
    .lte('start_date', w.end);

  const { count: recurring } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', aliciaId)
    .neq('recurrence', 'nunca')
    .gte('start_date', w.start)
    .lte('start_date', w.end);

  console.log(`  ${w.label}: ${total} total (${recurring} recorrentes, ${total - recurring} normais)`);
}

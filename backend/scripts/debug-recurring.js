import { getSupabaseClient } from '../supabase.js';
const supabase = getSupabaseClient();

// Parents antigos (criados antes de 23/fev) e suas filhas
const { data: oldParents } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, start_date, user_id, recurrence_until, recurrence_anchor_date')
  .neq('recurrence', 'nunca')
  .is('parent_task_id', null)
  .lt('start_date', '2026-02-23T00:00:00')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('=== PARENTS ANTIGOS (criados antes de 23/fev) ===');
for (const p of oldParents || []) {
  const { count } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('parent_task_id', p.id);

  const { count: thisWeekCount } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('parent_task_id', p.id)
    .gte('start_date', '2026-03-02T00:00:00')
    .lte('start_date', '2026-03-06T23:59:59');

  console.log(`  [ID ${p.id}] ${p.name} (${p.recurrence}) - Total filhas: ${count}, Esta semana: ${thisWeekCount}`);
}

// Filha mais recente criada
const { data: newestChild } = await supabase
  .from('agenda_tasks')
  .select('id, name, start_date, parent_task_id, created_at')
  .not('parent_task_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('');
console.log('=== FILHAS MAIS RECENTES (por created_at) ===');
for (const c of newestChild || []) {
  console.log(`  [ID ${c.id}] ${c.name} - start: ${c.start_date} - created: ${c.created_at} - parent: ${c.parent_task_id}`);
}

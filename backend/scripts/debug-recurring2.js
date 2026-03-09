import { getSupabaseClient } from '../supabase.js';
const supabase = getSupabaseClient();

// Checar quantos parents NÃO têm filhas para semana atual (2-6 março)
const startDate = '2026-03-02T00:00:00';
const endDate = '2026-03-06T23:59:59';

// Buscar TODOS os parents
const { data: allParents } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, start_date, user_id, recurrence_until')
  .neq('recurrence', 'nunca')
  .is('parent_task_id', null);

console.log(`Total parents: ${allParents.length}`);

let parentsWithoutChildren = 0;
let parentsThatShouldHaveChildren = 0;
const problemUsers = new Set();

for (const p of allParents) {
  // Checar se o parent DEVERIA ter filha esta semana
  const parentStart = new Date(p.start_date);
  const rangeEnd = new Date(endDate);
  const recUntil = p.recurrence_until ? new Date(p.recurrence_until) : null;

  // Se o parent é posterior ao range, não deveria ter filhas
  if (parentStart > rangeEnd) continue;

  // Se recurrence_until é anterior ao range, não deveria ter filhas
  if (recUntil && recUntil < new Date(startDate)) continue;

  // Se o parent é semanal e start_date está no range, o próprio parent aparece
  if (parentStart >= new Date(startDate) && parentStart <= rangeEnd) continue;

  // Para este parent, DEVERIA haver filhas no range
  parentsThatShouldHaveChildren++;

  const { count } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('parent_task_id', p.id)
    .gte('start_date', startDate)
    .lte('start_date', endDate);

  if (count === 0) {
    parentsWithoutChildren++;
    problemUsers.add(p.user_id);
    console.log(`  MISSING: [${p.id}] ${p.name} (${p.recurrence}) user=${p.user_id} start=${p.start_date}`);
  }
}

console.log(`\nParents que deveriam ter filhas: ${parentsThatShouldHaveChildren}`);
console.log(`Parents SEM filhas (PROBLEMA): ${parentsWithoutChildren}`);
console.log(`Usuários afetados: ${problemUsers.size}`);

// Checar semana passada (23-27 fev) também
console.log('\n=== SEMANA PASSADA (23-27 fev) ===');
const prevStart = '2026-02-23T00:00:00';
const prevEnd = '2026-02-27T23:59:59';
let missingPrev = 0;

for (const p of allParents) {
  const parentStart = new Date(p.start_date);
  const rangeEnd = new Date(prevEnd);
  const recUntil = p.recurrence_until ? new Date(p.recurrence_until) : null;

  if (parentStart > rangeEnd) continue;
  if (recUntil && recUntil < new Date(prevStart)) continue;
  if (parentStart >= new Date(prevStart) && parentStart <= rangeEnd) continue;

  const { count } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('parent_task_id', p.id)
    .gte('start_date', prevStart)
    .lte('start_date', prevEnd);

  if (count === 0) {
    missingPrev++;
  }
}
console.log(`Parents SEM filhas semana 23-27 fev: ${missingPrev}`);

import { getSupabaseClient } from '../supabase.js';
import { SupabaseAgendaRepository } from '../infrastructure/repositories/SupabaseAgendaRepository.js';
import { MaterializeRecurringTasks } from '../application/use-cases/agenda/MaterializeRecurringTasks.js';

const supabase = getSupabaseClient();

// Encontrar Alicia Paim
const { data: users } = await supabase
  .from('users_otus')
  .select('id, name, email')
  .ilike('name', '%alicia%');

console.log('=== Usuários encontrados ===');
for (const u of users || []) {
  console.log(`  ${u.name} (${u.email}) - ID: ${u.id}`);
}

if (!users?.length) {
  console.log('Nenhum usuário encontrado com nome "alicia"');
  process.exit(1);
}

const aliciaId = users[0].id;
console.log(`\nUsando: ${users[0].name} (${aliciaId})`);

// Checar parents recorrentes da Alicia
const { data: parents } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, start_date, recurrence_until')
  .eq('user_id', aliciaId)
  .neq('recurrence', 'nunca')
  .is('parent_task_id', null);

console.log(`\n=== Parents recorrentes: ${parents?.length || 0} ===`);
for (const p of parents || []) {
  console.log(`  [ID ${p.id}] ${p.name} (${p.recurrence}) start=${p.start_date} until=${p.recurrence_until || 'sem limite'}`);
}

// Semana do screenshot (23-27 fev)
const weekStart = '2026-02-23T00:00:00';
const weekEnd = '2026-02-27T23:59:59';

console.log(`\n=== Materializar semana 23-27 fev ===`);
const repository = new SupabaseAgendaRepository();

try {
  const materialize = new MaterializeRecurringTasks(repository);
  await materialize.execute({ userId: aliciaId, startDate: weekStart, endDate: weekEnd });
  console.log('Materialização OK!');
} catch (err) {
  console.error('ERRO:', err.message);
}

// Verificar filhas criadas para aquela semana
const { data: weekTasks } = await supabase
  .from('agenda_tasks')
  .select('id, name, start_date, due_date, recurrence, parent_task_id')
  .eq('user_id', aliciaId)
  .not('start_date', 'is', null)
  .gte('start_date', weekStart)
  .lte('start_date', weekEnd)
  .order('start_date', { ascending: true });

console.log(`\n=== Tarefas semana 23-27 fev: ${weekTasks?.length || 0} ===`);
for (const t of weekTasks || []) {
  const type = t.parent_task_id ? 'FILHA' : (t.recurrence !== 'nunca' ? 'PARENT' : 'NORMAL');
  const start = new Date(t.start_date);
  const day = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][start.getUTCDay()];
  console.log(`  [${type}] ${day} ${start.getUTCDate()}/${start.getUTCMonth()+1} ${start.getUTCHours()}:${String(start.getUTCMinutes()).padStart(2,'0')} - ${t.name}`);
}

// Também materializar semana atual (2-6 março)
const curStart = '2026-03-02T00:00:00';
const curEnd = '2026-03-06T23:59:59';

console.log(`\n=== Materializar semana atual 2-6 mar ===`);
try {
  const materialize2 = new MaterializeRecurringTasks(repository);
  await materialize2.execute({ userId: aliciaId, startDate: curStart, endDate: curEnd });
  console.log('Materialização OK!');
} catch (err) {
  console.error('ERRO:', err.message);
}

const { data: curTasks } = await supabase
  .from('agenda_tasks')
  .select('id, name, start_date, recurrence, parent_task_id')
  .eq('user_id', aliciaId)
  .not('start_date', 'is', null)
  .gte('start_date', curStart)
  .lte('start_date', curEnd)
  .order('start_date', { ascending: true });

console.log(`\n=== Tarefas semana 2-6 mar: ${curTasks?.length || 0} ===`);
for (const t of curTasks || []) {
  const type = t.parent_task_id ? 'FILHA' : (t.recurrence !== 'nunca' ? 'PARENT' : 'NORMAL');
  const start = new Date(t.start_date);
  const day = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'][start.getUTCDay()];
  console.log(`  [${type}] ${day} ${start.getUTCDate()}/${start.getUTCMonth()+1} ${start.getUTCHours()}:${String(start.getUTCMinutes()).padStart(2,'0')} - ${t.name}`);
}

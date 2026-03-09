// Simular a materialização para um usuário afetado
import { SupabaseAgendaRepository } from '../infrastructure/repositories/SupabaseAgendaRepository.js';
import { MaterializeRecurringTasks } from '../application/use-cases/agenda/MaterializeRecurringTasks.js';

const repository = new SupabaseAgendaRepository();

// Pegar um usuário afetado com muitos parents sem filhas
const userId = 'c428cf64-4103-4fc3-8b88-c89ab0ee76d2';
const startDate = '2026-03-02T00:00:00';
const endDate = '2026-03-06T23:59:59';

console.log(`Simulando materialização para user=${userId}`);
console.log(`Range: ${startDate} a ${endDate}`);
console.log('');

try {
  const materialize = new MaterializeRecurringTasks(repository);
  await materialize.execute({ userId, startDate, endDate });
  console.log('Materialização concluída com sucesso!');
} catch (err) {
  console.error('ERRO na materialização:', err.message);
  console.error('Stack:', err.stack);
}

// Agora verificar se as filhas foram criadas
const { getSupabaseClient } = await import('../supabase.js');
const supabase = getSupabaseClient();

const { data: parents } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, start_date')
  .eq('user_id', userId)
  .neq('recurrence', 'nunca')
  .is('parent_task_id', null);

console.log(`\nParents deste usuário: ${parents.length}`);

for (const p of parents) {
  const { count } = await supabase
    .from('agenda_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('parent_task_id', p.id)
    .gte('start_date', startDate)
    .lte('start_date', endDate);

  const status = count > 0 ? 'OK' : 'MISSING';
  console.log(`  [${status}] [ID ${p.id}] ${p.name} (${p.recurrence}) start=${p.start_date} filhas=${count}`);
}

// Fix: atualizar tarefas com nome vazio/nulo no Supabase
import { getSupabaseClient } from '../supabase.js';
const supabase = getSupabaseClient();

// 1. Fix do parent envenenado específico
console.log('=== Fix parent envenenado ID 12978 ===');
const { data: poison, error: poisonErr } = await supabase
  .from('agenda_tasks')
  .update({ name: 'Atividade sem nome' })
  .eq('id', 12978)
  .select('id, name');

if (poisonErr) {
  console.error('Erro:', poisonErr.message);
} else {
  console.log('Atualizado:', poison);
}

// 2. Fix todas as tarefas com nome nulo
console.log('\n=== Fix tarefas com name IS NULL ===');
const { data: nullNames, error: nullErr } = await supabase
  .from('agenda_tasks')
  .update({ name: 'Atividade de agenda' })
  .is('name', null)
  .select('id, name');

console.log(`Atualizadas: ${nullNames?.length || 0} tarefas com name=null`);
if (nullErr) console.error('Erro:', nullErr.message);

// 3. Fix tarefas com nome vazio string
console.log('\n=== Fix tarefas com name = "" ===');
const { data: emptyNames, error: emptyErr } = await supabase
  .from('agenda_tasks')
  .update({ name: 'Atividade de agenda' })
  .eq('name', '')
  .select('id, name');

console.log(`Atualizadas: ${emptyNames?.length || 0} tarefas com name=""`);
if (emptyErr) console.error('Erro:', emptyErr.message);

// 4. Verificação final
const { count: remaining } = await supabase
  .from('agenda_tasks')
  .select('id', { count: 'exact', head: true })
  .or('name.is.null,name.eq.');

console.log(`\n=== Verificação final ===`);
console.log(`Tarefas com nome vazio/nulo restantes: ${remaining}`);

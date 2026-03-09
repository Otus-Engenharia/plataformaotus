// Checar TODOS os parents com nome vazio/nulo que envenenam a materialização
import { getSupabaseClient } from '../supabase.js';
const supabase = getSupabaseClient();

// Parents com nome vazio, nulo ou só espaços
const { data: allParents } = await supabase
  .from('agenda_tasks')
  .select('id, name, recurrence, user_id, start_date')
  .neq('recurrence', 'nunca')
  .is('parent_task_id', null);

const poisonRecords = [];
for (const p of allParents) {
  if (!p.name || p.name.trim().length === 0) {
    poisonRecords.push(p);
  }
}

console.log(`=== PARENTS COM NOME VAZIO (POISON RECORDS) ===`);
console.log(`Total: ${poisonRecords.length}`);
for (const p of poisonRecords) {
  console.log(`  [ID ${p.id}] name="${p.name}" (${p.recurrence}) user=${p.user_id}`);
}

// Agora testar materialização para CADA usuário afetado
// Pegar um sample dos usuários com MISSING e verificar se a materialização funciona
const affectedUsers = [
  '044687bc-3605-47b7-99d8-e7d54d018dfc',
  '0e98050a-00ad-431b-856e-98be8dc81405',
  '66853dd3-1cea-4806-8734-36d9a9b25550',
  'a1ad88ee-34ab-4d85-b3e5-c12d4d125d5c',
  'a1c194db-4b34-45c0-9713-10aeab61084d',
];

console.log(`\n=== TESTE DE MATERIALIZAÇÃO POR USUÁRIO ===`);
const { AgendaTask } = await import('../domain/agenda/entities/AgendaTask.js');

for (const uid of affectedUsers) {
  const { data: userParents } = await supabase
    .from('agenda_tasks')
    .select('*')
    .eq('user_id', uid)
    .neq('recurrence', 'nunca')
    .is('parent_task_id', null);

  let error = null;
  try {
    userParents.map(row => AgendaTask.fromPersistence(row));
  } catch (e) {
    error = e.message;
  }

  if (error) {
    // Find the bad record
    const badRecords = userParents.filter(p => !p.name || p.name.trim().length === 0);
    console.log(`  USER ${uid}: FALHA - ${error}`);
    console.log(`    Bad records: ${badRecords.map(r => `ID ${r.id} name="${r.name}"`).join(', ')}`);
  } else {
    console.log(`  USER ${uid}: OK (${userParents.length} parents)`);
  }
}

// Também checar se há tarefas não-parent com nome vazio que possam causar problema
const { count: allEmpty } = await supabase
  .from('agenda_tasks')
  .select('id', { count: 'exact', head: true })
  .or('name.is.null,name.eq.');

console.log(`\nTotal tarefas com nome vazio/nulo no sistema: ${allEmpty}`);

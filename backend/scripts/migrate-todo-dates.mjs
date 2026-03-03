/**
 * Migração: Normaliza due_date dos ToDo's para formato date-only (yyyy-MM-dd).
 *
 * Remove componentes de hora/timezone, ex:
 *   "2026-03-03T00:00:00.000Z" → "2026-03-03"
 *   "2026-03-03T03:00:00.000Z" → "2026-03-03"
 *
 * Uso:
 *   node scripts/migrate-todo-dates.mjs            # dry-run (apenas mostra)
 *   node scripts/migrate-todo-dates.mjs --apply     # aplica as mudanças
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const dryRun = !process.argv.includes('--apply');

if (dryRun) {
  console.log('=== DRY RUN (use --apply para executar) ===\n');
}

// Busca todos os tasks com due_date não nulo
const { data: tasks, error } = await supabase
  .from('tasks')
  .select('id, due_date')
  .not('due_date', 'is', null);

if (error) {
  console.error('Erro ao buscar tasks:', error.message);
  process.exit(1);
}

console.log(`Total de tasks com due_date: ${tasks.length}\n`);

let needsMigration = 0;
let alreadyOk = 0;

for (const task of tasks) {
  const raw = String(task.due_date);
  const dateOnly = raw.slice(0, 10);

  // Já está no formato correto (yyyy-MM-dd, 10 chars)
  if (raw === dateOnly) {
    alreadyOk++;
    continue;
  }

  needsMigration++;

  if (dryRun) {
    console.log(`  [id=${task.id}] "${raw}" → "${dateOnly}"`);
  } else {
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ due_date: dateOnly })
      .eq('id', task.id);

    if (updateError) {
      console.error(`  [id=${task.id}] ERRO: ${updateError.message}`);
    } else {
      console.log(`  [id=${task.id}] "${raw}" → "${dateOnly}" ✓`);
    }
  }
}

console.log(`\nResumo:`);
console.log(`  Já no formato correto: ${alreadyOk}`);
console.log(`  ${dryRun ? 'Precisam migrar' : 'Migradas'}: ${needsMigration}`);

if (dryRun && needsMigration > 0) {
  console.log(`\nPara aplicar: node scripts/migrate-todo-dates.mjs --apply`);
}

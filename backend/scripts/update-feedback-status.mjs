/**
 * Atualiza status e/ou parecer de um feedback no Supabase.
 * Uso:
 *   node scripts/update-feedback-status.mjs --id 210 --status em_progresso
 *   node scripts/update-feedback-status.mjs --id 210 --status finalizado --analysis "Texto" --action "Ação tomada"
 *   node scripts/update-feedback-status.mjs --id 210 --category feature --area projetos
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

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

const id = getArg('id');
if (!id) {
  console.error('Uso: node scripts/update-feedback-status.mjs --id <ID> [--status <STATUS>] [--analysis <TEXT>] [--action <TEXT>] [--category <CAT>] [--area <AREA>]');
  process.exit(1);
}

const updates = {};
const status = getArg('status');
const analysis = getArg('analysis');
const action = getArg('action');
const category = getArg('category');
const area = getArg('area');

if (status) updates.status = status;
if (analysis) updates.admin_analysis = analysis;
if (action) updates.admin_action = action;
if (category) updates.category = category;
if (area) updates.area = area;

if (status === 'finalizado' || status === 'recusado') {
  updates.resolved_at = new Date().toISOString();
}

updates.updated_at = new Date().toISOString();

if (Object.keys(updates).length <= 1) {
  console.error('Nenhum campo para atualizar. Use --status, --analysis, --action, --category ou --area.');
  process.exit(1);
}

const { data, error } = await supabase
  .from('feedbacks')
  .update(updates)
  .eq('id', parseInt(id))
  .select()
  .single();

if (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
}

console.log(JSON.stringify({ success: true, feedback: data }, null, 2));

/**
 * Busca feedbacks pendentes do Supabase (sem precisar do server rodando).
 * Uso: node scripts/fetch-pending-feedbacks.mjs [--all]
 *   --all  retorna todos os feedbacks (não apenas pendentes)
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const allMode = process.argv.includes('--all');

// Buscar feedbacks
let query = supabase
  .from('feedbacks')
  .select('*')
  .order('created_at', { ascending: true });

if (!allMode) {
  query = query.eq('status', 'pendente');
}

const { data: feedbacks, error } = await query;

if (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
}

if (!feedbacks.length) {
  console.log(JSON.stringify({ feedbacks: [], count: 0 }));
  process.exit(0);
}

// Buscar nomes dos autores
const authorIds = [...new Set(feedbacks.map(f => f.author_id).filter(Boolean))];
let authors = {};

if (authorIds.length) {
  const { data: users } = await supabase
    .from('users_otus')
    .select('id, name, email')
    .in('id', authorIds);

  if (users) {
    authors = Object.fromEntries(users.map(u => [u.id, u]));
  }
}

// Enriquecer feedbacks com dados do autor
const enriched = feedbacks.map(f => ({
  id: f.id,
  code: `FB-${f.id}`,
  type: f.type,
  status: f.status,
  titulo: f.titulo,
  feedback_text: f.feedback_text,
  page_url: f.page_url,
  area: f.area,
  category: f.category,
  screenshot_url: f.screenshot_url,
  admin_analysis: f.admin_analysis,
  admin_action: f.admin_action,
  author_name: authors[f.author_id]?.name || 'Desconhecido',
  author_email: authors[f.author_id]?.email || '',
  created_at: f.created_at,
}));

console.log(JSON.stringify({ feedbacks: enriched, count: enriched.length }, null, 2));

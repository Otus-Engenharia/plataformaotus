/**
 * Script one-off para atualizar roles de Carla Bedin e Arthur Oliveira
 *
 * Carla Bedin: ceo → director
 * Arthur Oliveira: director → admin
 *
 * Executar: node atualizar-roles-diretoria.mjs
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const updates = [
  { email: 'carla.bedin@otusengenharia.com', from: 'ceo', to: 'director' },
  { email: 'arthur.oliveira@otusengenharia.com', from: 'director', to: 'admin' },
];

for (const { email, from, to } of updates) {
  // Verificar estado atual
  const { data: user, error: fetchError } = await supabase
    .from('users_otus')
    .select('id, name, email, role')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    console.error(`Erro ao buscar ${email}:`, fetchError?.message || 'Não encontrado');
    continue;
  }

  if (user.role !== from) {
    console.warn(`⚠ ${user.name} (${email}) tem role "${user.role}", esperado "${from}". Pulando.`);
    continue;
  }

  // Atualizar role
  const { error: updateError } = await supabase
    .from('users_otus')
    .update({ role: to })
    .eq('id', user.id);

  if (updateError) {
    console.error(`Erro ao atualizar ${user.name}:`, updateError.message);
  } else {
    console.log(`✓ ${user.name}: ${from} → ${to}`);
  }
}

console.log('\nConcluído.');

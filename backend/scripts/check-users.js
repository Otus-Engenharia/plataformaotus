/**
 * Script para verificar usuários existentes
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('🔍 Buscando usuários existentes...\n');

  const { data, error } = await supabase
    .from('users_otus')
    .select('id, name, email')
    .limit(5);

  if (error) {
    console.error('❌ Erro:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  Nenhum usuário encontrado');
    return;
  }

  console.log('Usuários encontrados:');
  data.forEach(u => {
    console.log(`  - ${u.name} (${u.email})`);
    console.log(`    ID: ${u.id}`);
  });
}

checkUsers();

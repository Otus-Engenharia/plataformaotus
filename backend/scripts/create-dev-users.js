/**
 * Script para criar usuários dev no banco de dados
 * Execute com: node scripts/create-dev-users.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const devUsers = [
  { id: '00000000-0000-0000-0000-000000000000', name: 'Dev (Full Access)', email: 'dev-dev@otus.dev' },
  { id: '00000000-0000-0000-0000-000000000001', name: 'Dev Director', email: 'dev-director@otus.dev' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Dev Admin', email: 'dev-admin@otus.dev' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Dev Leader', email: 'dev-leader@otus.dev' },
];

async function createDevUsers() {
  console.log('🔧 Criando usuários dev...\n');

  for (const user of devUsers) {
    const { data, error } = await supabase
      .from('users_otus')
      .upsert(user, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`❌ Erro ao criar ${user.name}:`, error.message);
    } else {
      console.log(`✅ ${user.name} (${user.id})`);
    }
  }

  console.log('\n🎉 Concluído!');
}

createDevUsers();

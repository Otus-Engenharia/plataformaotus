/**
 * Script one-time: Adiciona coluna client_code à tabela companies (se não existir).
 *
 * Uso:
 *   cd backend && node scripts/add-client-code-column.js
 *
 * Pré-requisito: .env configurado com Supabase (SUPABASE_SERVICE_ROLE_KEY).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log('=== Add client_code column to companies ===\n');

  // Use rpc to execute raw SQL via a Supabase Edge Function or pg_net
  // Since we don't have a custom RPC, we'll test if column exists first
  const { data, error } = await supabase
    .from('companies')
    .select('client_code')
    .limit(1);

  if (!error) {
    console.log('Column client_code already exists in companies table.');
    return;
  }

  if (error.message.includes('client_code')) {
    console.log('Column client_code does not exist. Adding via REST...');

    // Supabase doesn't support ALTER TABLE via the client SDK.
    // Use the Management API or SQL Editor.
    // Fallback: use fetch to call the SQL endpoint directly.
    const sqlUrl = `${supabaseUrl}/rest/v1/rpc/`;

    console.log('\n*** MANUAL ACTION REQUIRED ***');
    console.log('Run this SQL in Supabase SQL Editor (https://supabase.com/dashboard):');
    console.log('');
    console.log('  ALTER TABLE companies ADD COLUMN IF NOT EXISTS client_code INTEGER;');
    console.log('');
    console.log('Then re-run seed-project-codes.js to populate the values.');
    process.exit(1);
  }

  console.log('Unexpected error:', error.message);
}

addColumn().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

/**
 * Migração: Adiciona novos campos ao formulário de passagem (FB-209)
 * Tabela: project_comercial_infos
 *
 * Novos campos:
 *   - visao_empresa (text)
 *   - visao_projeto_riscos (text)
 *   - principais_dores (text)
 *   - valor_cliente (text) - JSON array
 *   - coordenacao_externa (boolean)
 *   - info_contrato (text)
 *   - info_adicional_confidencial (text)
 *
 * Uso: node scripts/add-comercial-info-columns.mjs
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

const columns = [
  { name: 'visao_empresa', type: 'text' },
  { name: 'visao_projeto_riscos', type: 'text' },
  { name: 'principais_dores', type: 'text' },
  { name: 'valor_cliente', type: 'text' },
  { name: 'coordenacao_externa', type: 'boolean', default: 'false' },
  { name: 'info_contrato', type: 'text' },
  { name: 'info_adicional_confidencial', type: 'text' },
];

console.log('Adicionando colunas à tabela project_comercial_infos...\n');

for (const col of columns) {
  const defaultClause = col.default ? ` DEFAULT ${col.default}` : '';
  const sql = `ALTER TABLE project_comercial_infos ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${defaultClause};`;

  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    // Se rpc exec_sql não existir, tentar via REST
    console.log(`  [!] ${col.name}: rpc exec_sql não disponível, coluna deve ser adicionada manualmente`);
    console.log(`      SQL: ${sql}`);
  } else {
    console.log(`  [OK] ${col.name} (${col.type})`);
  }
}

console.log('\nMigração concluída.');
console.log('\nCaso as colunas não tenham sido criadas automaticamente, execute no Supabase SQL Editor:');
console.log('');
for (const col of columns) {
  const defaultClause = col.default ? ` DEFAULT ${col.default}` : '';
  console.log(`ALTER TABLE project_comercial_infos ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${defaultClause};`);
}

/**
 * Script one-shot: Cria contact_change_requests para empresas pendentes
 * que foram criadas sem uma solicitação correspondente.
 *
 * Uso: node backend/scripts/create-requests-for-pending-companies.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function main() {
  // 1. Buscar empresas pendentes
  const { data: pendingCompanies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name, company_type')
    .eq('status', 'pendente');

  if (fetchError) {
    console.error('Erro ao buscar empresas pendentes:', fetchError.message);
    process.exit(1);
  }

  if (!pendingCompanies?.length) {
    console.log('Nenhuma empresa pendente encontrada.');
    process.exit(0);
  }

  console.log(`Encontradas ${pendingCompanies.length} empresa(s) pendente(s).`);

  // 2. Buscar requests existentes que já apontam para essas empresas
  const companyIds = pendingCompanies.map(c => c.id);
  const { data: existingRequests, error: reqError } = await supabase
    .from('contact_change_requests')
    .select('target_company_id')
    .in('target_company_id', companyIds);

  if (reqError) {
    console.error('Erro ao buscar requests existentes:', reqError.message);
    process.exit(1);
  }

  const alreadyHasRequest = new Set(
    (existingRequests || []).map(r => r.target_company_id)
  );

  // 3. Criar requests para as que não têm
  let created = 0;
  let skipped = 0;

  for (const company of pendingCompanies) {
    if (alreadyHasRequest.has(company.id)) {
      console.log(`  SKIP: "${company.name}" (id=${company.id}) — já tem request`);
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('contact_change_requests')
      .insert({
        request_type: 'nova_empresa',
        status: 'pendente',
        payload: {
          name: company.name,
          company_type: company.company_type,
        },
        target_company_id: company.id,
        requested_by_email: 'sistema@otusengenharia.com',
        requested_by_name: 'Sistema (migração)',
      });

    if (insertError) {
      console.error(`  ERRO: "${company.name}" — ${insertError.message}`);
    } else {
      console.log(`  OK: "${company.name}" (id=${company.id}) — request criada`);
      created++;
    }
  }

  console.log(`\nResultado: ${created} criada(s), ${skipped} já existiam.`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

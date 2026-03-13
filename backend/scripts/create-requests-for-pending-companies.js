/**
 * Script one-shot: Ativa empresas pendentes no banco.
 *
 * Contexto: o fluxo antigo de createCompany() hardcodeava status='pendente',
 * mas essas empresas foram criadas como resultado de requests aprovadas
 * (ou foram criadas antes do fluxo de aprovação existir).
 * O commit c198c93 corrigiu createCompany para usar status='validado'.
 * Este script ativa as empresas já existentes que ficaram como 'pendente'.
 *
 * Nota: target_company_id/result_company_id em contact_change_requests são UUID,
 * mas companies.id é integer — não há como linkar via FK. Como nenhuma request
 * existente tem esses campos preenchidos, todas as 124 empresas são órfãs.
 * Em vez de criar requests que falhariam por type mismatch, ativamos todas.
 *
 * Uso: node backend/scripts/create-requests-for-pending-companies.js [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (dryRun) console.log('*** DRY RUN — nenhuma alteração será feita ***\n');

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

  console.log(`Encontradas ${pendingCompanies.length} empresa(s) pendente(s).\n`);

  // 2. Ativar todas
  let activated = 0;
  let errors = 0;

  for (const company of pendingCompanies) {
    if (dryRun) {
      console.log(`  [DRY] Ativaria: "${company.name}" (id=${company.id}, tipo=${company.company_type})`);
      activated++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('companies')
      .update({ status: 'validado' })
      .eq('id', company.id);

    if (updateError) {
      console.error(`  ERRO: "${company.name}" (id=${company.id}) — ${updateError.message}`);
      errors++;
    } else {
      console.log(`  ATIVADA: "${company.name}" (id=${company.id})`);
      activated++;
    }
  }

  console.log(`\nResultado: ${activated} ativada(s), ${errors} erro(s).`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

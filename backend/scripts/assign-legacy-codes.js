/**
 * Script one-time: Atribui códigos automáticos de 9 dígitos a projetos legados.
 *
 * Projetos legados = aqueles cujo project_code NÃO é numérico de 9 dígitos
 * (ex: "HCR_AVELLANO", "PROJ_NOME", etc.)
 *
 * Uso:
 *   cd backend && node scripts/assign-legacy-codes.js
 *
 * Pré-requisito:
 *   - .env configurado com Supabase
 *   - Coluna client_code deve existir na tabela companies
 *   - Rodar seed-project-codes.js antes (para popular client_code existentes)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getOrAssignClientCode(companyId) {
  const { data: company, error: fetchError } = await supabase
    .from('companies')
    .select('client_code')
    .eq('id', companyId)
    .single();

  if (fetchError) {
    throw new Error(`Erro ao buscar empresa ${companyId}: ${fetchError.message}`);
  }

  if (company.client_code != null) {
    return company.client_code;
  }

  // Assign next client_code
  const { data: maxRow, error: maxError } = await supabase
    .from('companies')
    .select('client_code')
    .not('client_code', 'is', null)
    .order('client_code', { ascending: false })
    .limit(1)
    .single();

  const nextCode = (maxError || !maxRow) ? 1 : maxRow.client_code + 1;

  const { error: updateError } = await supabase
    .from('companies')
    .update({ client_code: nextCode })
    .eq('id', companyId);

  if (updateError) {
    throw new Error(`Erro ao atribuir client_code: ${updateError.message}`);
  }

  console.log(`  Assigned client_code ${nextCode} to company ${companyId}`);
  return nextCode;
}

async function getMaxProjectOrder() {
  const { data, error } = await supabase
    .from('projects')
    .select('project_order')
    .not('project_order', 'is', null)
    .order('project_order', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 0;
  return data.project_order;
}

async function countProjectsByCompany(companyId) {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  if (error) throw new Error(`Erro ao contar projetos: ${error.message}`);
  return count || 0;
}

async function assignLegacyCodes() {
  console.log('=== Assign Legacy Project Codes ===\n');

  // 1. Buscar todos os projetos
  const { data: allProjects, error: fetchError } = await supabase
    .from('projects')
    .select('id, name, project_code, project_order, company_id')
    .order('id', { ascending: true });

  if (fetchError) {
    throw new Error(`Erro ao buscar projetos: ${fetchError.message}`);
  }

  // 2. Filtrar projetos legados (project_code não é 9 dígitos numéricos)
  const legacyProjects = allProjects.filter(p => {
    const code = String(p.project_code || '');
    return !/^\d{9}$/.test(code);
  });

  console.log(`Total projects: ${allProjects.length}`);
  console.log(`Legacy projects (non-9-digit code): ${legacyProjects.length}\n`);

  if (legacyProjects.length === 0) {
    console.log('No legacy projects to process.');
    return;
  }

  let currentMaxOrder = await getMaxProjectOrder();
  let updated = 0;
  let errors = 0;

  for (const project of legacyProjects) {
    try {
      console.log(`Processing: ${project.name} (id:${project.id}, code:${project.project_code})`);

      if (!project.company_id) {
        console.log(`  SKIP: no company_id`);
        continue;
      }

      // Generate code
      const clientCode = await getOrAssignClientCode(project.company_id);
      const projectCount = await countProjectsByCompany(project.company_id);
      currentMaxOrder++;

      const xxx = currentMaxOrder;
      const yyy = clientCode;
      const zzz = projectCount; // Already includes this project

      const newCode = String(xxx).padStart(3, '0')
        + String(yyy).padStart(3, '0')
        + String(zzz).padStart(3, '0');

      // Update
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          project_code: newCode,
          project_order: xxx,
        })
        .eq('id', project.id);

      if (updateError) {
        console.log(`  ERROR: ${updateError.message}`);
        errors++;
        currentMaxOrder--; // Rollback order increment
      } else {
        console.log(`  OK: ${project.project_code} -> ${newCode} (order:${xxx}, client:${yyy}, seq:${zzz})`);
        updated++;
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      errors++;
      currentMaxOrder--; // Rollback order increment
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Skipped: ${legacyProjects.length - updated - errors}`);
}

assignLegacyCodes().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

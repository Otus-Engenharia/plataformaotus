/**
 * Script E2E: Testa o fluxo completo de entregas Autodoc
 *
 * 1. Descobre projetos Autodoc (identifica conta Otus)
 * 2. Insere mapeamento de teste
 * 3. Roda sync para 1 projeto
 * 4. Verifica dados no Supabase
 *
 * Uso: node --env-file=.env scripts/test-autodoc-e2e.js [--discover-only] [--sync-only] [--verify-only]
 */

import { AutodocHttpClient } from '../infrastructure/services/AutodocHttpClient.js';
import { SupabaseAutodocEntregasRepository } from '../infrastructure/repositories/SupabaseAutodocEntregasRepository.js';
import { SyncCustomerDocuments } from '../application/use-cases/acd/autodoc-entregas/SyncCustomerDocuments.js';
import { SyncAllCustomers } from '../application/use-cases/acd/autodoc-entregas/SyncAllCustomers.js';
import { getSupabaseServiceClient } from '../supabase.js';

const args = process.argv.slice(2);
const DISCOVER_ONLY = args.includes('--discover-only');
const SYNC_ONLY = args.includes('--sync-only');
const VERIFY_ONLY = args.includes('--verify-only');

const client = new AutodocHttpClient();
const repo = new SupabaseAutodocEntregasRepository();
const supabase = getSupabaseServiceClient();

// ============================================================
// Passo 1: Descobrir projetos Autodoc
// ============================================================
async function discoverProjects() {
  console.log('\n=== PASSO 1: Descobrindo projetos Autodoc ===\n');

  const { projects, diagnostics } = await client.discoverAllProjects();
  console.log(`Total de projetos descobertos: ${projects.length}`);
  console.log(`Diagnósticos: ${diagnostics.length} entradas`);

  // Agrupar por customer
  const byCustomer = new Map();
  for (const p of projects) {
    if (!byCustomer.has(p.customerName)) byCustomer.set(p.customerName, []);
    byCustomer.get(p.customerName).push(p);
  }

  console.log(`\nContas encontradas (${byCustomer.size}):\n`);
  for (const [name, projs] of byCustomer) {
    console.log(`  ${name} (${projs.length} projetos)`);
    for (const p of projs.slice(0, 5)) {
      console.log(`    - ${p.projectName} [folder: ${p.projectFolderId}, customer: ${p.customerId}, product: ${p.autodocProduct}]`);
    }
    if (projs.length > 5) console.log(`    ... e mais ${projs.length - 5}`);
  }

  // Procurar conta "Otus" ou projeto com nome parecido
  const otusProjects = projects.filter(p =>
    p.customerName.toLowerCase().includes('otus') ||
    p.projectName.toLowerCase().includes('amalfi') ||
    p.projectName.toLowerCase().includes('capri')
  );

  if (otusProjects.length > 0) {
    console.log('\n--- Projetos Otus/AMALFI encontrados ---');
    for (const p of otusProjects) {
      console.log(`  Customer: ${p.customerName} (${p.customerId})`);
      console.log(`  Project:  ${p.projectName} (folder: ${p.projectFolderId})`);
      console.log(`  Product:  ${p.autodocProduct}`);
      console.log('');
    }
  }

  return projects;
}

// ============================================================
// Passo 2: Inserir mapeamento de teste
// ============================================================
async function insertMapping(projects) {
  console.log('\n=== PASSO 2: Inserindo mapeamento de teste ===\n');

  // Escolher primeiro projeto Otus, ou o primeiro disponivel
  let target = projects.find(p => p.customerName.toLowerCase().includes('otus'));
  if (!target) {
    // Pegar qualquer projeto que tenha poucos docs (menor conta)
    target = projects[0];
    console.log('Conta Otus nao encontrada, usando primeiro projeto disponivel');
  }

  if (!target) {
    console.error('Nenhum projeto encontrado! Abortando.');
    process.exit(1);
  }

  console.log(`Inserindo mapping para: ${target.projectName} (${target.customerName})`);

  // Usar portfolio_project_code = nome do projeto como placeholder
  const portfolioCode = target.projectName.replace(/\s+/g, '_').toUpperCase();

  const { data, error } = await supabase
    .from('autodoc_project_mappings')
    .upsert({
      portfolio_project_code: portfolioCode,
      autodoc_customer_id: target.customerId,
      autodoc_customer_name: target.customerName,
      autodoc_project_folder_id: target.projectFolderId,
      autodoc_project_name: target.projectName,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'autodoc_customer_id,autodoc_project_folder_id' })
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir mapping:', error.message);
    process.exit(1);
  }

  console.log('Mapping inserido com sucesso:');
  console.log(JSON.stringify(data, null, 2));
  return data;
}

// ============================================================
// Passo 3: Rodar sync
// ============================================================
async function runSync() {
  console.log('\n=== PASSO 3: Executando sync ===\n');

  const useCase = new SyncAllCustomers(repo, client);
  const result = await useCase.execute();

  console.log('Resultado do sync:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ============================================================
// Passo 4: Verificar dados
// ============================================================
async function verifyData() {
  console.log('\n=== PASSO 4: Verificando dados ===\n');

  // Verificar mappings
  const { data: mappings, error: mErr } = await supabase
    .from('autodoc_project_mappings')
    .select('*');

  console.log(`Mappings: ${mappings?.length || 0}`);
  if (mappings?.length) {
    for (const m of mappings) {
      console.log(`  ${m.portfolio_project_code} → ${m.autodoc_project_name} (${m.autodoc_customer_name}) [active: ${m.active}]`);
    }
  }

  // Verificar documentos
  const { data: docs, error: dErr } = await supabase
    .from('autodoc_documents')
    .select('*')
    .order('autodoc_created_at', { ascending: false })
    .limit(20);

  console.log(`\nDocumentos: ${docs?.length || 0} (mostrando ate 20)`);
  if (docs?.length) {
    for (const d of docs) {
      console.log(`  [${d.classification}] ${d.document_code || d.document_name} rev:${d.revision} fase:${d.phase_name} disc:${d.discipline_name} (${d.project_code})`);
    }
  }

  // Contagem por classificacao
  const { data: allDocs } = await supabase
    .from('autodoc_documents')
    .select('classification');

  if (allDocs?.length) {
    const counts = {};
    for (const d of allDocs) {
      counts[d.classification] = (counts[d.classification] || 0) + 1;
    }
    console.log('\nContagem por classificacao:');
    for (const [cls, cnt] of Object.entries(counts)) {
      console.log(`  ${cls}: ${cnt}`);
    }
  }

  // Verificar sync runs
  const { data: runs } = await supabase
    .from('autodoc_sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(5);

  console.log(`\nSync runs: ${runs?.length || 0}`);
  if (runs?.length) {
    for (const r of runs) {
      console.log(`  ${r.status} | projects: ${r.projects_scanned} | docs: ${r.documents_found} | new: ${r.new_documents} | ${r.error || 'ok'}`);
    }
  }

  console.log('\n=== Verificacao completa ===');
  return { mappings: mappings?.length || 0, documents: allDocs?.length || 0 };
}

// ============================================================
// Main
// ============================================================
async function main() {
  try {
    if (VERIFY_ONLY) {
      await verifyData();
      return;
    }

    if (SYNC_ONLY) {
      await runSync();
      await verifyData();
      return;
    }

    if (DISCOVER_ONLY) {
      await discoverProjects();
      return;
    }

    // Fluxo completo
    const projects = await discoverProjects();
    await insertMapping(projects);
    await runSync();
    const result = await verifyData();

    if (result.documents > 0) {
      console.log('\n✅ E2E Autodoc Entregas: SUCESSO');
    } else {
      console.log('\n⚠️  E2E Autodoc Entregas: Sync completou mas 0 documentos encontrados');
      console.log('   Isso pode significar que o projeto selecionado nao tem documentos.');
    }
  } catch (err) {
    console.error('\n❌ Erro no teste E2E:', err);
    process.exit(1);
  }
}

main();

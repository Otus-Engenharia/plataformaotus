/**
 * Script one-time para preencher o campo 'area' nos feedbacks legados (area IS NULL).
 * Infere a area a partir do page_url quando possível, senão usa 'projetos' como default.
 *
 * Rodar com: node backfill-feedback-areas.mjs
 * Depois de rodar com sucesso, pode deletar este arquivo.
 */
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Mapeamento de page_url (short key) → area
const PAGE_TO_AREA = {
  'lideres-projeto': 'lideres',
  'cs': 'cs',
  'apoio-projetos': 'apoio',
  'projetos': 'projetos',
  'indicadores': 'indicadores',
  'okrs': 'okrs',
  'gestao-tarefas': 'workspace',
  'configuracoes': 'configuracoes',
  'admin-financeiro': 'admin_financeiro',
  'vendas': 'vendas',
  'vista-cliente': 'vista_cliente',
  // Variações de keys existentes
  'portfolio': 'projetos',
  'curva-s': 'projetos',
  'cronograma': 'projetos',
  'custos': 'projetos',
  'horas': 'projetos',
  'equipe': 'projetos',
  'contatos': 'projetos',
  'agenda': 'projetos',
  'demandas-apoio': 'projetos',
  'feedbacks': 'projetos',
  'baselines': 'projetos',
  'gantt': 'projetos',
  'operacao': 'projetos',
  'ind': 'indicadores',
  'workspace': 'workspace',
  'acessos': 'configuracoes',
  'logs': 'configuracoes',
  'gerenciar-feedbacks': 'configuracoes',
  'indicadores-vendas': 'vendas',
  'formulario-passagem': 'vendas',
  'estudos-custos': 'projetos',
  'controle-passivo': 'projetos',
  'alocacao-times': 'projetos',
  'todos': 'projetos',
  'apontamentos': 'projetos',
};

// Mapeamento de pathname segment → area (para URLs completas)
const PATH_TO_AREA = {
  'apoio-projetos': 'apoio',
  'lideres-projeto': 'lideres',
  'cs-area': 'cs',
  'admin-financeiro': 'admin_financeiro',
  'vendas': 'vendas',
  'vista-cliente': 'vista_cliente',
  'ind': 'indicadores',
  'okrs': 'okrs',
  'workspace': 'workspace',
  'configuracoes': 'configuracoes',
  'acessos': 'configuracoes',
  'logs': 'configuracoes',
};

function inferArea(pageUrl) {
  if (!pageUrl) return 'projetos';

  // Tentar como short key primeiro
  if (PAGE_TO_AREA[pageUrl]) return PAGE_TO_AREA[pageUrl];

  // Tentar parsear como URL completa
  try {
    const url = new URL(pageUrl);
    const path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!path) return 'projetos';

    const firstSegment = path.split('/')[0];

    // Verificar no mapeamento de path
    if (PATH_TO_AREA[firstSegment]) return PATH_TO_AREA[firstSegment];
    if (PAGE_TO_AREA[firstSegment]) return PAGE_TO_AREA[firstSegment];

    return 'projetos';
  } catch {
    // Não é URL válida, tentar como path segment
    const segment = pageUrl.split('/')[0];
    if (PAGE_TO_AREA[segment]) return PAGE_TO_AREA[segment];
    return 'projetos';
  }
}

async function main() {
  console.log('Buscando feedbacks com area IS NULL...');

  const { data: feedbacks, error } = await supabase
    .from('feedbacks')
    .select('id, page_url, area')
    .is('area', null);

  if (error) {
    console.error('Erro ao buscar feedbacks:', error.message);
    process.exit(1);
  }

  console.log(`Encontrados ${feedbacks.length} feedbacks sem area.`);

  if (feedbacks.length === 0) {
    console.log('Nada a fazer!');
    return;
  }

  // Agrupar por area inferida para log
  const summary = {};
  const updates = feedbacks.map(f => {
    const area = inferArea(f.page_url);
    summary[area] = (summary[area] || 0) + 1;
    return { id: f.id, area, page_url: f.page_url };
  });

  console.log('\nDistribuição inferida:');
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([area, count]) => console.log(`  ${area}: ${count}`));

  console.log(`\nAtualizando ${updates.length} feedbacks...`);

  let success = 0;
  let errors = 0;

  for (const { id, area } of updates) {
    const { error: updateError } = await supabase
      .from('feedbacks')
      .update({ area })
      .eq('id', id);

    if (updateError) {
      console.error(`  Erro no feedback #${id}: ${updateError.message}`);
      errors++;
    } else {
      success++;
    }
  }

  console.log(`\nConcluído: ${success} atualizados, ${errors} erros.`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

/**
 * Script one-time: Importa marcos do SmartSheet para TODOS os projetos.
 *
 * Uso:
 *   cd backend && node scripts/import-all-marcos.js
 *
 * Pré-requisito: .env configurado com BigQuery e Supabase.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { queryPortfolio, queryCronograma } from '../bigquery.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TABLE = 'marcos_projeto';

function sanitizeDate(val) {
  if (!val) return null;
  if (typeof val === 'object' && val.value) return val.value;
  const s = String(val).trim();
  if (s.startsWith('{')) {
    try { return JSON.parse(s).value || null; } catch { return null; }
  }
  return s || null;
}

function normalizeStatus(status, variacaoDias) {
  if (!status) return 'pendente';
  const s = String(status).toLowerCase().trim();
  if (s === 'complete' || s === 'completo' || s === 'concluído' || s === 'concluido') return 'feito';
  if (s === 'in progress' || s === 'em andamento' || s === 'em progresso') {
    if (variacaoDias != null && Number(variacaoDias) > 0) return 'atrasado';
    return 'andamento';
  }
  if (s === 'not started' || s === 'não iniciado' || s === 'nao iniciado') return 'pendente';
  return 'pendente';
}

async function main() {
  console.log('🚀 Importação em massa de marcos do SmartSheet\n');

  const portfolio = await queryPortfolio();
  const projects = portfolio.filter(p => p.project_code_norm && (p.smartsheet_id || p.project_name));
  console.log(`📋 ${projects.length} projetos com SmartSheet encontrados no portfólio\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const project of projects) {
    const pc = project.project_code_norm;
    const ssId = project.smartsheet_id || null;
    const pName = project.project_name || pc;

    try {
      const tasks = await queryCronograma(ssId, pName);

      const marcosMap = new Map();
      tasks.forEach(t => {
        const marco = t.CaminhoCriticoMarco;
        if (!marco || !String(marco).trim()) return;
        if (String(marco).trim().toUpperCase().startsWith('INT')) return;

        const nome = String(marco).trim();
        const variancia = t.VarianciaBaselineOtus;
        const dataTermino = t.DataDeTermino;

        const entry = {
          nome,
          status: normalizeStatus(t.Status, variancia),
          prazo_atual: sanitizeDate(dataTermino),
          prazo_baseline: sanitizeDate(t.DataDeFimBaselineOtus),
          variacao_dias: variancia != null ? Number(variancia) : 0,
        };

        if (marcosMap.has(nome)) {
          const existing = marcosMap.get(nome);
          const existingDate = existing.prazo_atual ? new Date(existing.prazo_atual) : null;
          const newDate = dataTermino ? new Date(dataTermino) : null;
          if (newDate && (!existingDate || newDate > existingDate)) {
            marcosMap.set(nome, entry);
          }
        } else {
          marcosMap.set(nome, entry);
        }
      });

      const marcosToImport = Array.from(marcosMap.values());
      if (marcosToImport.length === 0) {
        console.log(`  ⏭️  ${pc} — nenhum marco encontrado`);
        totalSkipped++;
        continue;
      }

      const rows = marcosToImport.map((m, idx) => ({
        project_code: pc,
        nome: m.nome,
        status: m.status,
        prazo_baseline: m.prazo_baseline,
        prazo_atual: m.prazo_atual,
        variacao_dias: m.variacao_dias,
        source: 'smartsheet',
        sort_order: idx,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from(TABLE)
        .upsert(rows, { onConflict: 'project_code,nome' })
        .select();

      if (error) throw error;

      const count = data?.length || 0;
      totalImported += count;
      console.log(`  ✅ ${pc} — ${count} marco(s) importado(s)`);
    } catch (err) {
      totalErrors++;
      console.error(`  ❌ ${pc} — ${err.message}`);
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   Projetos processados: ${projects.length}`);
  console.log(`   Marcos importados:    ${totalImported}`);
  console.log(`   Projetos sem marcos:  ${totalSkipped}`);
  console.log(`   Erros:                ${totalErrors}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});

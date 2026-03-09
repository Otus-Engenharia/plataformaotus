/**
 * Script de importacao de vinculos historicos de parcelas via CSV.
 *
 * Le o CSV "Fluxo de pagamento dos Spots - V2 - Gerentes - Registro de parcelas.csv"
 * e atualiza as parcelas existentes em parcelas_pagamento com os dados de vinculo
 * (smartsheet_row_id, smartsheet_task_name, smartsheet_data_termino, data_pagamento_calculada).
 *
 * Uso: cd backend && node scripts/vincular-parcelas-csv.js
 */

import 'dotenv/config';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { getSupabaseClient } from '../supabase.js';

const CSV_PATH = 'c:/Users/pksch/Downloads/Fluxo de pagamento dos Spots - V2 - Gerentes - Registro de parcelas.csv';

const supabase = getSupabaseClient();

// --- Parse CSV line (handles commas inside quotes) ---
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// --- Converter DD/MM/YYYY -> YYYY-MM-DD ---
function parseDate(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

// --- Normalizar string para match ---
function normalize(s) {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// --- Ler CSV ---
async function readCsv() {
  const lines = [];
  const rl = createInterface({
    input: createReadStream(CSV_PATH, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headers) {
      headers = fields;
      continue;
    }
    const row = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] || '';
    }
    lines.push(row);
  }

  return lines;
}

// --- Buscar mapa de projetos: name -> project_code ---
async function fetchProjectsMap() {
  console.log('Buscando projetos do Supabase...');
  const { data: projects, error } = await supabase
    .from('projects')
    .select('name, project_code')
    .not('project_code', 'is', null);

  if (error) throw new Error(`Erro ao buscar projects: ${error.message}`);

  const map = {};
  for (const p of projects || []) {
    if (p.name) map[p.name] = p.project_code;
    if (p.name) map[normalize(p.name)] = p.project_code;
  }

  console.log(`  ${projects.length} projetos com project_code`);
  return map;
}

// --- Main ---
async function main() {
  console.log('=== Importacao de Vinculos Historicos de Parcelas ===\n');

  const projectsMap = await fetchProjectsMap();
  const rows = await readCsv();
  console.log(`\n${rows.length} linhas no CSV\n`);

  let vinculadas = 0;
  let semProjeto = 0;
  let semParcela = 0;
  let jaVinculada = 0;
  let erros = 0;

  const detailsSemProjeto = [];
  const detailsSemParcela = [];
  const detailsJaVinculada = [];

  for (const row of rows) {
    const nomeProjeto = row['Nome projeto']?.trim();
    const medicaoParcela = row['Medição parcela'] || row['Medicao parcela'] || row['Medição Parcela'] || '';
    const imas = row['imas']?.trim();
    const nomeTarefa = row['Nome tarefa']?.trim();
    const dataTerminoRaw = row['Data de término smartsheet'] || row['Data de termino smartsheet'] || '';
    const dataPagamentoRaw = row['Data de pagamento'] || '';

    if (!nomeProjeto || !medicaoParcela.trim()) continue;

    // 1. Resolver project_code
    const projectCode = projectsMap[nomeProjeto] || projectsMap[normalize(nomeProjeto)];
    if (!projectCode) {
      semProjeto++;
      detailsSemProjeto.push(nomeProjeto);
      continue;
    }

    // 2. Buscar parcela por project_code + descricao
    let { data: parcelas, error: fetchErr } = await supabase
      .from('parcelas_pagamento')
      .select('id, descricao, smartsheet_row_id, status_projetos')
      .eq('project_code', projectCode)
      .eq('descricao', medicaoParcela.trim());

    if (fetchErr) {
      console.error(`  Erro buscando parcela: ${fetchErr.message}`);
      erros++;
      continue;
    }

    // 3. Se nao achou, tentar match normalizado (ilike)
    if (!parcelas || parcelas.length === 0) {
      const { data: allParcelas, error: allErr } = await supabase
        .from('parcelas_pagamento')
        .select('id, descricao, smartsheet_row_id, status_projetos')
        .eq('project_code', projectCode);

      if (!allErr && allParcelas) {
        const normalizedTarget = normalize(medicaoParcela);
        parcelas = allParcelas.filter(p => normalize(p.descricao) === normalizedTarget);
      }
    }

    if (!parcelas || parcelas.length === 0) {
      semParcela++;
      detailsSemParcela.push(`${nomeProjeto} (${projectCode}) → "${medicaoParcela.trim()}"`);
      continue;
    }

    // Pegar a primeira match
    const parcela = parcelas[0];

    // 4. Verificar se ja esta vinculada
    if (parcela.smartsheet_row_id) {
      jaVinculada++;
      detailsJaVinculada.push(`${projectCode} "${parcela.descricao}" (row_id: ${parcela.smartsheet_row_id})`);
      continue;
    }

    // 5. Converter datas
    const dataTermino = parseDate(dataTerminoRaw);
    const dataPagamento = parseDate(dataPagamentoRaw);

    // 6. Atualizar parcela
    const updateData = {
      smartsheet_row_id: imas || null,
      smartsheet_task_name: nomeTarefa || null,
      smartsheet_data_termino: dataTermino,
      last_smartsheet_data_termino: dataTermino,
      data_pagamento_calculada: dataPagamento,
      status_projetos: 'vinculado',
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from('parcelas_pagamento')
      .update(updateData)
      .eq('id', parcela.id);

    if (updateErr) {
      console.error(`  Erro atualizando parcela ${parcela.id}: ${updateErr.message}`);
      erros++;
      continue;
    }

    vinculadas++;
  }

  // --- Relatorio ---
  console.log('\n=== RELATORIO ===');
  console.log(`Parcelas vinculadas com sucesso: ${vinculadas}`);
  console.log(`Ja estavam vinculadas (ignoradas): ${jaVinculada}`);
  console.log(`Sem projeto no Supabase: ${semProjeto}`);
  console.log(`Sem parcela correspondente: ${semParcela}`);
  console.log(`Erros: ${erros}`);

  if (detailsSemProjeto.length > 0) {
    const unique = [...new Set(detailsSemProjeto)].sort();
    console.log(`\n--- Projetos nao encontrados (${unique.length} unicos) ---`);
    unique.forEach(p => console.log(`  - ${p}`));
  }

  if (detailsSemParcela.length > 0) {
    console.log(`\n--- Parcelas nao encontradas (${detailsSemParcela.length}) ---`);
    detailsSemParcela.forEach(d => console.log(`  - ${d}`));
  }

  if (detailsJaVinculada.length > 0) {
    console.log(`\n--- Parcelas ja vinculadas (${detailsJaVinculada.length}) ---`);
    detailsJaVinculada.slice(0, 10).forEach(d => console.log(`  - ${d}`));
    if (detailsJaVinculada.length > 10) {
      console.log(`  ... e mais ${detailsJaVinculada.length - 10}`);
    }
  }
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});

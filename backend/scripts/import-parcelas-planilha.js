/**
 * Script de importacao de parcelas da planilha "Fluxo de pagamento dos Spots - V2.xlsx"
 *
 * Uso: cd backend && node scripts/import-parcelas-planilha.js
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { getSupabaseClient } from '../supabase.js';

const XLSX_PATH = 'c:/Users/pksch/Downloads/Fluxo de pagamento dos Spots - V2.xlsx';
const BATCH_SIZE = 50;

const supabase = getSupabaseClient();

// --- Mapeamento de status ---
function mapStatus(raw) {
  if (!raw) return 'nao_finalizado';
  const s = String(raw).trim().toLowerCase();
  if (s === 'recebido') return 'recebido';
  if (s === 'nao finalizado' || s === 'não finalizado') return 'nao_finalizado';
  if (s.includes('aguardando recebimento')) return 'aguardando_recebimento';
  if (s.includes('aguardando resposta') || s.includes('medicao') || s.includes('medição')) return 'medicao_solicitada';
  return 'nao_finalizado';
}

// --- Converter data Excel serial para ISO date string ---
function excelDateToISO(value) {
  if (value == null) return null;

  // Se e numero (serial Excel)
  if (typeof value === 'number' && value > 10000 && value < 100000) {
    const date = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }

  return null; // Strings especiais -> null
}

// --- Verificar se campo data indica "sem cronograma" ---
function isSemCronograma(dataValue) {
  if (dataValue == null) return false;
  const s = String(dataValue).trim().toUpperCase();
  return s.includes('S/ CRONOGRAMA') || s.includes('SEM CRONOGRAMA');
}

// --- Buscar mapa de projetos do Supabase ---
async function fetchProjectsMap() {
  console.log('Buscando projetos do Supabase...');

  const { data: projects, error } = await supabase
    .from('projects')
    .select('project_code, name, project_manager_id, company_id')
    .not('project_code', 'is', null);

  if (error) throw new Error(`Erro ao buscar projects: ${error.message}`);

  // Buscar users para mapear id -> email
  const { data: users, error: usersErr } = await supabase
    .from('users_otus')
    .select('id, email');

  if (usersErr) throw new Error(`Erro ao buscar users: ${usersErr.message}`);

  const usersMap = {};
  for (const u of users || []) {
    usersMap[u.id] = u.email;
  }

  // Buscar companies para mapear id -> name
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name');

  if (compErr) throw new Error(`Erro ao buscar companies: ${compErr.message}`);

  const companiesMap = {};
  for (const c of companies || []) {
    companiesMap[c.id] = c.name;
  }

  // Montar mapa por project_code E por name (planilha usa name como project_code)
  const map = {};
  for (const p of projects || []) {
    const info = {
      project_code: p.project_code,
      gerente_email: p.project_manager_id ? (usersMap[p.project_manager_id] || null) : null,
      company_id: p.company_id ? String(p.company_id) : null,
      company_name: p.company_id ? (companiesMap[p.company_id] || null) : null,
    };
    if (p.project_code) map[p.project_code] = info;
    if (p.name) map[p.name] = info;
  }

  console.log(`  ${Object.keys(map).length} projetos encontrados no Supabase`);
  return map;
}

// --- Ler planilha ---
function readSpreadsheet() {
  console.log(`Lendo planilha: ${XLSX_PATH}`);
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`  ${rows.length} linhas totais na planilha`);
  return rows;
}

// --- Main ---
async function main() {
  console.log('=== Importacao de Parcelas da Planilha ===\n');

  const projectsMap = await fetchProjectsMap();
  const rows = readSpreadsheet();

  // Filtrar linhas com Projeto preenchido
  const validRows = rows.filter(r => r['Projeto'] && String(r['Projeto']).trim());
  console.log(`\n${validRows.length} linhas com projeto preenchido`);

  // Preparar registros
  const records = [];
  const projectsNotFound = new Set();
  const errors = [];

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    try {
      const projectCode = String(row['Projeto']).trim();
      const projectInfo = projectsMap[projectCode];

      if (!projectInfo) {
        projectsNotFound.add(projectCode);
      }

      // Parcela numero
      const parcelaRaw = row['Parcela'];
      const parcelaNumero = (parcelaRaw != null && !isNaN(Number(parcelaRaw))) ? Number(parcelaRaw) : null;

      // Data de pagamento
      const dataRaw = row['Data de pagamento'];
      const dataPagamentoManual = excelDateToISO(dataRaw);

      // Parcela sem cronograma
      const parcelaSemCronogramaCol = row['Parcela S/ Cronograma'];
      const parcelaSemCronograma = !!parcelaSemCronogramaCol || isSemCronograma(dataRaw);

      // Origem
      let origem = row['Origem'] ? String(row['Origem']).trim() : null;
      if (origem && !['Contrato', 'Aditivo'].includes(origem)) {
        // Tentar normalizar
        if (origem.toLowerCase() === 'contrato') origem = 'Contrato';
        else if (origem.toLowerCase() === 'aditivo') origem = 'Aditivo';
        else origem = null; // default do banco
      }

      // Valor
      const valorRaw = row['Valor'];
      const valor = (valorRaw != null && !isNaN(Number(valorRaw))) ? Number(valorRaw) : null;

      const record = {
        project_code: projectInfo?.project_code || projectCode,
        company_id: projectInfo?.company_id || null,
        parcela_numero: parcelaNumero,
        descricao: (row['Descricao da parcela'] || row['Descrição da parcela'] || row['DESCRICAO'] || row['Descricao'] || row['Descrição']) ? String(row['Descricao da parcela'] || row['Descrição da parcela'] || row['DESCRICAO'] || row['Descricao'] || row['Descrição']).trim() : null,
        valor: valor,
        origem: origem || 'Contrato',
        fase: row['FASE'] ? String(row['FASE']).trim() : null,
        status: mapStatus(row['Status pagamento']),
        data_pagamento_manual: dataPagamentoManual,
        parcela_sem_cronograma: parcelaSemCronograma,
        comentario_financeiro: row['Comentario financeiro'] ? String(row['Comentario financeiro']).trim() : null,
        comentario_projetos: row['Comentario Projetos'] ? String(row['Comentario Projetos']).trim() : null,
        gerente_email: projectInfo?.gerente_email || null,
        created_by: 'importacao_planilha',
      };

      records.push(record);
    } catch (err) {
      errors.push({ row: i + 2, error: err.message });
    }
  }

  console.log(`\n${records.length} registros preparados para importacao`);
  if (projectsNotFound.size > 0) {
    console.log(`\n⚠ ${projectsNotFound.size} projetos NAO encontrados no Supabase:`);
    for (const pc of [...projectsNotFound].sort()) {
      console.log(`  - ${pc}`);
    }
  }

  // Inserir em batches
  console.log(`\nInserindo em batches de ${BATCH_SIZE}...`);
  let inserted = 0;
  let insertErrors = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('parcelas_pagamento')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`  Erro no batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      insertErrors += batch.length;

      // Tentar inserir um por um para identificar a linha problematica
      for (const record of batch) {
        const { data: single, error: singleErr } = await supabase
          .from('parcelas_pagamento')
          .insert(record)
          .select('id');

        if (singleErr) {
          console.error(`    Falha: ${record.project_code} parcela ${record.parcela_numero} "${record.descricao}" - ${singleErr.message}`);
        } else {
          inserted++;
          insertErrors--;
        }
      }
    } else {
      inserted += (data?.length || batch.length);
      process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data?.length || batch.length} inseridos\n`);
    }
  }

  // Resumo
  console.log('\n=== RESUMO ===');
  console.log(`Total linhas validas: ${validRows.length}`);
  console.log(`Registros inseridos: ${inserted}`);
  console.log(`Erros de insercao: ${insertErrors}`);
  console.log(`Projetos nao encontrados no Supabase: ${projectsNotFound.size}`);
  if (errors.length > 0) {
    console.log(`Erros de parse: ${errors.length}`);
    errors.forEach(e => console.log(`  Linha ${e.row}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});

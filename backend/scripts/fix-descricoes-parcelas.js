/**
 * Script one-off para recuperar descricoes das parcelas do XLSX original.
 *
 * Uso: cd backend && node scripts/fix-descricoes-parcelas.js
 *
 * Le o XLSX e atualiza o campo descricao das parcelas existentes
 * no Supabase por (project_code, parcela_numero).
 *
 * A planilha usa nomes de projeto (ex: "PRIDE_IVO LORENZONI") enquanto
 * o Supabase usa codigos numericos (ex: "033014002"). O script busca
 * o mapa de projetos do Supabase para fazer a conversao.
 */

import 'dotenv/config';
import XLSX from 'xlsx';
import { getSupabaseClient } from '../supabase.js';

const XLSX_PATH = 'c:/Users/pksch/Downloads/Fluxo de pagamento dos Spots - V2.xlsx';

const supabase = getSupabaseClient();

async function fetchProjectsMap() {
  console.log('Buscando projetos do Supabase...');

  const { data: projects, error } = await supabase
    .from('projects')
    .select('project_code, name')
    .not('project_code', 'is', null);

  if (error) throw new Error(`Erro ao buscar projects: ${error.message}`);

  const map = {};
  for (const p of projects || []) {
    if (p.name) map[p.name] = p.project_code;
    if (p.project_code) map[p.project_code] = p.project_code;
  }

  console.log(`  ${(projects || []).length} projetos encontrados\n`);
  return map;
}

function readSpreadsheet() {
  console.log(`Lendo planilha: ${XLSX_PATH}`);
  const workbook = XLSX.readFile(XLSX_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`  ${rows.length} linhas na planilha`);
  return rows;
}

function getDescricao(row) {
  return row['Descricao da parcela']
    || row['Descrição da parcela']
    || row['DESCRICAO']
    || row['Descricao']
    || row['Descrição']
    || null;
}

async function main() {
  console.log('=== Fix Descricoes Parcelas ===\n');

  const projectsMap = await fetchProjectsMap();
  const rows = readSpreadsheet();

  // Log column names from first row to debug
  if (rows.length > 0) {
    console.log('\nColunas encontradas na planilha:');
    Object.keys(rows[0]).forEach(k => console.log(`  - "${k}"`));
    console.log('');
  }

  // Filtrar linhas com projeto e descricao
  const updates = [];
  const projectsNotFound = new Set();

  for (const row of rows) {
    const projectName = row['Projeto'] ? String(row['Projeto']).trim() : null;
    const parcelaRaw = row['Parcela'];
    const parcelaNumero = (parcelaRaw != null && !isNaN(Number(parcelaRaw))) ? Number(parcelaRaw) : null;
    const descricao = getDescricao(row);

    if (!projectName || parcelaNumero == null || !descricao) continue;

    const projectCode = projectsMap[projectName];
    if (!projectCode) {
      projectsNotFound.add(projectName);
      continue;
    }

    updates.push({
      project_code: projectCode,
      parcela_numero: parcelaNumero,
      descricao: String(descricao).trim(),
    });
  }

  console.log(`${updates.length} linhas com descricao encontradas na planilha`);

  if (projectsNotFound.size > 0) {
    console.log(`\n⚠ ${projectsNotFound.size} projetos da planilha NAO encontrados no Supabase:`);
    for (const pc of [...projectsNotFound].sort()) {
      console.log(`  - ${pc}`);
    }
    console.log('');
  }

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const u of updates) {
    try {
      const { data, error } = await supabase
        .from('parcelas_pagamento')
        .update({ descricao: u.descricao, updated_at: new Date().toISOString() })
        .eq('project_code', u.project_code)
        .eq('parcela_numero', u.parcela_numero)
        .select('id');

      if (error) {
        console.error(`  Erro: ${u.project_code} #${u.parcela_numero}: ${error.message}`);
        errors++;
      } else if (!data || data.length === 0) {
        notFound++;
      } else {
        updated++;
      }
    } catch (err) {
      console.error(`  Erro inesperado: ${u.project_code} #${u.parcela_numero}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n=== RESUMO ===');
  console.log(`Total com descricao na planilha: ${updates.length}`);
  console.log(`Atualizadas no Supabase: ${updated}`);
  console.log(`Nao encontradas (project_code + parcela_numero): ${notFound}`);
  console.log(`Erros: ${errors}`);
}

main().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});

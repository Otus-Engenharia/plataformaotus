/**
 * One-time script to import data from "Dados Otus - PortAPI.csv"
 * into project_comercial_infos and projects tables.
 *
 * Usage: node backend/scripts/import-portapi-csv.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

// Use service role key to bypass RLS for admin import
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const CSV_PATH = 'c:/Users/pksch/Downloads/Dados Otus - PortAPI.csv';

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseDateDDMMYYYY(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseNumber(str) {
  if (!str) return null;
  // Remove thousands separator (.), keep decimal comma → dot
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInteger(str) {
  if (!str) return null;
  const n = parseInt(str.replace(/\./g, '').replace(',', '.'), 10);
  return isNaN(n) ? null : n;
}

async function main() {
  console.log('Reading CSV...');
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const csvRows = parseCSV(content);
  console.log(`Parsed ${csvRows.length} CSV rows`);

  // Fetch all projects
  console.log('Fetching projects from Supabase...');
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, project_code, name');
  if (projErr) throw new Error(`Failed to fetch projects: ${projErr.message}`);
  console.log(`Found ${projects.length} projects`);

  // Build lookup maps
  const byCode = {};
  const byName = {};
  for (const p of projects) {
    if (p.project_code) byCode[p.project_code.toLowerCase()] = p;
    if (p.name) byName[p.name.toLowerCase()] = p;
  }

  // Fetch existing comercial_infos
  const { data: existingInfos, error: infoErr } = await supabase
    .from('project_comercial_infos')
    .select('id, project_id');
  if (infoErr) throw new Error(`Failed to fetch comercial infos: ${infoErr.message}`);
  const existingByProjectId = new Set(existingInfos.map(i => i.project_id));

  // Track duplicates in CSV by project_code
  const seenCodes = new Set();
  let matched = 0, unmatched = 0, duplicates = 0, upserted = 0, projectsUpdated = 0;

  for (const row of csvRows) {
    const csvCode = row['Código Projeto'] || '';
    const csvName = row['Task Name'] || '';
    const tipoPagamento = (row['Prt - Tipo de pagamento'] || '').toLowerCase().trim();

    if (!tipoPagamento) continue; // skip rows without tipo_pagamento

    // Match to project
    let project = null;
    if (csvCode && byCode[csvCode.toLowerCase()]) {
      project = byCode[csvCode.toLowerCase()];
    } else if (csvName && byName[csvName.toLowerCase()]) {
      project = byName[csvName.toLowerCase()];
    }

    if (!project) {
      unmatched++;
      if (csvCode || csvName) {
        console.log(`  UNMATCHED: code="${csvCode}" name="${csvName}"`);
      }
      continue;
    }

    // Check duplicate
    const key = `${project.id}`;
    if (seenCodes.has(key)) {
      duplicates++;
      continue;
    }
    seenCodes.add(key);
    matched++;

    // Prepare project_comercial_infos data
    const comercialData = {
      project_id: project.id,
      tipo_pagamento: tipoPagamento || null,
      complexidade: row['Complexidade'] || null,
      complexidade_projetista: row['Complexidade de projetista'] || null,
      complexidade_tecnica: row['Complexidade técnica'] || null,
      data_venda: parseDateDDMMYYYY(row['DATA VENDA']),
      fase_entrada: row['FASE QUE ENTRAMOS'] || null,
    };

    // Upsert project_comercial_infos
    if (existingByProjectId.has(project.id)) {
      // Update existing
      const { error } = await supabase
        .from('project_comercial_infos')
        .update(comercialData)
        .eq('project_id', project.id);
      if (error) {
        console.error(`  ERROR updating comercial_infos for project ${project.id}: ${error.message}`);
        continue;
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('project_comercial_infos')
        .insert(comercialData);
      if (error) {
        console.error(`  ERROR inserting comercial_infos for project ${project.id}: ${error.message}`);
        continue;
      }
    }
    upserted++;

    // Update projects fields if currently null/empty
    const projectUpdate = {};
    const areaConstruida = parseNumber(row['ÁREA CONSTRUÍDA']);
    const areaEfetiva = parseNumber(row['Área efetiva']);
    const numUnidades = parseInteger(row['Nº de unidades']);
    const tipologia = row['Tipologia de empreendimento'] || null;
    const padrao = row['Padrão de acabamento'] || null;

    if (areaConstruida != null) projectUpdate.area_construida = areaConstruida;
    if (areaEfetiva != null) projectUpdate.area_efetiva = areaEfetiva;
    if (numUnidades != null) projectUpdate.numero_unidades = numUnidades;
    if (tipologia) projectUpdate.tipologia_empreendimento = tipologia;
    if (padrao) projectUpdate.padrao_acabamento = padrao;

    if (Object.keys(projectUpdate).length > 0) {
      // Only update null fields — fetch current values first
      const { data: current, error: fetchErr } = await supabase
        .from('projects')
        .select('area_construida, area_efetiva, numero_unidades, tipologia_empreendimento, padrao_acabamento')
        .eq('id', project.id)
        .single();

      if (!fetchErr && current) {
        const filtered = {};
        for (const [k, v] of Object.entries(projectUpdate)) {
          if (current[k] == null || current[k] === '') {
            filtered[k] = v;
          }
        }
        if (Object.keys(filtered).length > 0) {
          const { error: updErr } = await supabase
            .from('projects')
            .update(filtered)
            .eq('id', project.id);
          if (updErr) {
            console.error(`  ERROR updating project ${project.id}: ${updErr.message}`);
          } else {
            projectsUpdated++;
          }
        }
      }
    }
  }

  console.log('\n=== IMPORT SUMMARY ===');
  console.log(`CSV rows:              ${csvRows.length}`);
  console.log(`Matched to projects:   ${matched}`);
  console.log(`Unmatched:             ${unmatched}`);
  console.log(`Duplicates skipped:    ${duplicates}`);
  console.log(`Comercial infos upserted: ${upserted}`);
  console.log(`Projects updated:      ${projectsUpdated}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

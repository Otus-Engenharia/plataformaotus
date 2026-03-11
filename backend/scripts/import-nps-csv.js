/**
 * Script de Importação CSV → nps_responses
 *
 * Importa dados de pesquisas de fechamento de fase do Google Forms.
 *
 * Uso: node backend/scripts/import-nps-csv.js <caminho-do-csv>
 *
 * Mapeamento CSV:
 *   Carimbo de data/hora → created_at
 *   Endereço de e-mail → respondent_email
 *   Cliente (empresa) → client_company
 *   Projeto → project_name
 *   Código Projeto → project_code
 *   Pessoa entrevistada → interviewed_person
 *   Nível operacional do entrevistado → decision_level
 *   NPS (0-10) → nps_score
 *   CSAT (0-10) → csat_score
 *   CES (0-10) → ces_score
 *   Qualitativo → feedback_text
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { SupabaseNpsResponseRepository } from '../infrastructure/repositories/SupabaseNpsResponseRepository.js';
import { ImportNpsResponses } from '../application/use-cases/nps/ImportNpsResponses.js';

function parseCSV(content) {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() || '';
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
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseBrazilianDate(dateStr) {
  if (!dateStr) return null;
  // Format: DD/MM/YYYY HH:mm:ss
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second] = match;
  return new Date(year, month - 1, day, hour, minute, second || 0).toISOString();
}

function parseScore(value) {
  if (!value || value.trim() === '') return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function mapDecisionLevel(value) {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower.includes('não') || lower.includes('nao')) return 'nao_decisor';
  if (lower.includes('decisor')) return 'decisor';
  return null;
}

function findColumn(row, ...candidates) {
  for (const c of candidates) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(c.toLowerCase())) return row[key];
    }
  }
  return '';
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: node import-nps-csv.js <caminho-do-csv>');
    process.exit(1);
  }

  const fullPath = path.resolve(csvPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  console.log(`Lendo CSV: ${fullPath}`);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`${rows.length} linhas encontradas no CSV`);

  if (rows.length === 0) {
    console.log('Nenhum dado para importar.');
    process.exit(0);
  }

  // Log headers
  console.log('Colunas:', Object.keys(rows[0]).join(', '));

  const responses = rows.map((row, i) => {
    const email = findColumn(row, 'e-mail', 'email', 'Endereço');
    const createdAt = parseBrazilianDate(findColumn(row, 'Carimbo', 'data/hora', 'timestamp'));

    const mapped = {
      respondent_email: email || 'importado@otus.com',
      respondent_name: email ? email.split('@')[0] : null,
      client_company: findColumn(row, 'Cliente', 'empresa'),
      project_name: findColumn(row, 'Projeto') && !findColumn(row, 'Projeto').match(/^\d/) ? findColumn(row, 'Projeto') : null,
      project_code: findColumn(row, 'Código', 'Codigo') || findColumn(row, 'Projeto'),
      interviewed_person: findColumn(row, 'Pessoa entrevistada', 'entrevistado'),
      decision_level: mapDecisionLevel(findColumn(row, 'Nível', 'operacional')),
      nps_score: parseScore(findColumn(row, 'NPS')),
      csat_score: parseScore(findColumn(row, 'CSAT')),
      ces_score: parseScore(findColumn(row, 'CES')),
      feedback_text: findColumn(row, 'Qualitativo', 'feedback', 'comentário'),
      source: 'google_forms',
      created_at: createdAt,
      updated_at: createdAt,
    };

    // project_code is required
    if (!mapped.project_code || mapped.project_code.trim() === '') {
      console.warn(`  Linha ${i + 2}: sem project_code, pulando`);
      return null;
    }

    return mapped;
  }).filter(Boolean);

  console.log(`\n${responses.length} respostas válidas para importar`);

  // Preview first 3
  responses.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.project_code} | NPS:${r.nps_score} CSAT:${r.csat_score} CES:${r.ces_score} | ${r.client_company} | ${r.interviewed_person}`);
  });

  const repository = new SupabaseNpsResponseRepository();
  const importUseCase = new ImportNpsResponses(repository);

  console.log('\nImportando...');
  const saved = await importUseCase.execute(responses);
  console.log(`${saved.length} respostas importadas com sucesso!`);

  process.exit(0);
}

main().catch(err => {
  console.error('Erro na importação:', err);
  process.exit(1);
});

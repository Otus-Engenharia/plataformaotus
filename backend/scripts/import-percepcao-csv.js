/**
 * Script: import-percepcao-csv.js
 *
 * Importa percepções históricas do CSV exportado do Google Forms.
 * O CSV tem colunas com perguntas longas em PT-BR — este script mapeia para os campos esperados.
 *
 * Uso:
 *   CSV_PATH="C:/Users/.../arquivo.csv" node scripts/import-percepcao-csv.js
 *   node scripts/import-percepcao-csv.js   (usa o caminho padrão)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from backend root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

import { SupabasePesquisaCSRepository } from '../infrastructure/repositories/SupabasePesquisaCSRepository.js';
import { ImportPercepcoes } from '../application/use-cases/pesquisas-cs/ImportPercepcoes.js';

// ── CSV Parser (RFC 4180 compliant — handles quoted fields with commas/newlines) ──

function parseCSVRobust(text) {
  const records = [];
  let i = 0;
  const len = text.length;

  function parseField() {
    if (i >= len) return '';

    if (text[i] === '"') {
      // Quoted field
      i++; // skip opening quote
      let field = '';
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          field += text[i];
          i++;
        }
      }
      return field;
    } else {
      // Unquoted field
      let field = '';
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i];
        i++;
      }
      return field;
    }
  }

  function parseRecord() {
    const fields = [];
    while (i < len) {
      const field = parseField();
      fields.push(field);

      if (i >= len) break;
      if (text[i] === ',') {
        i++; // skip comma
        continue;
      }
      // End of record
      if (text[i] === '\r') i++;
      if (text[i] === '\n') i++;
      break;
    }
    return fields;
  }

  while (i < len) {
    // Skip blank lines
    if (text[i] === '\r' || text[i] === '\n') {
      i++;
      continue;
    }
    records.push(parseRecord());
  }

  return records;
}

// ── Column mapping ──

// CSV columns by index (after proper parsing):
// 0: Carimbo de data/hora
// 1: Mês/Ano
// 2: Endereço de e-mail
// 3: Projeto
// 4: cronograma (pergunta longa)
// 5: qualidade
// 6: comunicação
// 7: custos
// 8: parceria
// 9: confiança
// 10: oportunidade_revenda
// 11: comentários
// 12: ISP (ignorar)
// 13: IP (ignorar)
// 14: IVE (ignorar)

function mapRow(fields) {
  const mesAno = (fields[1] || '').trim(); // "05/2025"
  const parts = mesAno.split('/');
  if (parts.length !== 2) return null;

  const mes = parseInt(parts[0], 10);
  const ano = parseInt(parts[1], 10);
  if (isNaN(mes) || isNaN(ano)) return null;

  const email = (fields[2] || '').trim().toLowerCase();
  const projeto = (fields[3] || '').trim();

  if (!email || !projeto) return null;

  const parseDim = (val) => {
    const trimmed = (val || '').trim();
    if (trimmed === '' || trimmed === '-') return null;
    const n = parseInt(trimmed, 10);
    return (n >= 1 && n <= 3) ? n : null;
  };

  const cronograma = parseDim(fields[4]);
  const qualidade = parseDim(fields[5]);
  const comunicacao = parseDim(fields[6]);
  const custos = parseDim(fields[7]);
  const parceria = parseDim(fields[8]);
  const confianca = parseDim(fields[9]);

  // Required dimensions
  if (qualidade == null || comunicacao == null || custos == null || parceria == null || confianca == null) {
    return null;
  }

  const oportunidadeRaw = (fields[10] || '').trim().toLowerCase();
  const oportunidade_revenda = oportunidadeRaw === 'sim' ? true : null;

  const comentarios = (fields[11] || '').trim() || null;

  // Extract respondente_nome from email prefix
  const respondente_nome = email.split('@')[0].split('.').map(
    w => w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');

  return {
    project_code: projeto,
    mes_referencia: mes,
    ano_referencia: ano,
    respondente_email: email,
    respondente_nome,
    cronograma,
    qualidade,
    comunicacao,
    custos,
    parceria,
    confianca,
    oportunidade_revenda,
    comentarios,
  };
}

// ── Main ──

async function main() {
  const csvPath = process.env.CSV_PATH ||
    'C:\\Users\\pksch\\Downloads\\HS-PERCEPCAO DA EQUIPE (respostas) - HS-PERCEPCAO DA EQUIPE.csv';

  console.log(`Reading CSV: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, 'utf-8');
  const allRows = parseCSVRobust(text);

  console.log(`Parsed ${allRows.length} rows (including header)`);

  // Skip header row (first row)
  const dataRows = allRows.slice(1);

  const records = [];
  const skipped = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const mapped = mapRow(row);
    if (mapped) {
      records.push(mapped);
    } else {
      skipped.push({ line: i + 2, raw: row.slice(0, 4).join(' | ') });
    }
  }

  console.log(`\nMapped: ${records.length} records`);
  console.log(`Skipped: ${skipped.length} rows`);

  if (skipped.length > 0 && skipped.length <= 20) {
    console.log('\nSkipped rows:');
    skipped.forEach(s => console.log(`  Line ${s.line}: ${s.raw}`));
  }

  if (records.length === 0) {
    console.log('No records to import.');
    process.exit(0);
  }

  // Show sample
  console.log('\nSample (first 3):');
  records.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i}] ${r.project_code} ${r.mes_referencia}/${r.ano_referencia} ${r.respondente_email} - Q:${r.qualidade} Com:${r.comunicacao} Cu:${r.custos} P:${r.parceria} Co:${r.confianca} Cr:${r.cronograma ?? 'N/A'}`);
  });

  // Deduplicate by unique key (keep last occurrence = latest response)
  const seen = new Map();
  for (const r of records) {
    const key = `${r.project_code}|${r.mes_referencia}|${r.ano_referencia}|${r.respondente_email}`;
    seen.set(key, r);
  }
  const deduped = [...seen.values()];
  if (deduped.length < records.length) {
    console.log(`Deduped: ${records.length} → ${deduped.length} (removed ${records.length - deduped.length} duplicates)`);
  }

  // Dry run mode
  if (process.argv.includes('--dry-run')) {
    console.log('\n--dry-run: Not importing. Remove flag to import.');
    process.exit(0);
  }

  // Import via use case
  console.log('\nImporting to Supabase...');
  const repo = new SupabasePesquisaCSRepository();
  const useCase = new ImportPercepcoes(repo);

  // Import in batches of 100 to avoid Supabase limits
  const BATCH_SIZE = 100;
  let totalImported = 0;
  let totalErrors = [];

  for (let start = 0; start < deduped.length; start += BATCH_SIZE) {
    const batch = deduped.slice(start, start + BATCH_SIZE);
    const batchNum = Math.floor(start / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(deduped.length / BATCH_SIZE);

    try {
      const result = await useCase.execute(batch);
      totalImported += result.imported;
      if (result.errors.length > 0) {
        totalErrors.push(...result.errors.map(e => ({ ...e, index: e.index + start })));
      }
      console.log(`  Batch ${batchNum}/${totalBatches}: ${result.imported} imported, ${result.errors.length} errors`);
    } catch (err) {
      console.error(`  Batch ${batchNum}/${totalBatches} FAILED: ${err.message}`);
      totalErrors.push({ index: start, error: err.message });
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total errors: ${totalErrors.length}`);

  if (totalErrors.length > 0 && totalErrors.length <= 20) {
    console.log('\nErrors:');
    totalErrors.forEach(e => console.log(`  Row ${e.index}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

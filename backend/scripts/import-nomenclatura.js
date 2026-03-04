/**
 * Script: Import de nomenclatura de arquivos a partir do CSV
 *
 * Lê o CSV com padrões de nomenclatura por projeto e insere na tabela project_nomenclatura.
 * Faz match pelo project_name no portfólio BigQuery.
 *
 * Uso: node backend/scripts/import-nomenclatura.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parâmetros conhecidos que aparecem nos padrões
const KNOWN_PARAMS = [
  'DISCIPLINA', 'FASE', 'TORRE', 'PRANCHA', 'COMPLEMENTO',
  'LOCAL', 'LOCALIZAÇÃO', 'LOCALIZACAO', 'PAV', 'PAVIMENTO',
  'BLOCO', 'SEGMENTO', 'NUM', 'NUMERO', 'NÚMERO',
  'NUMERO DA FOLHA', 'CONTEUDO', 'CONTEÚDO', 'DESCRIÇÃO',
  'DESCRICAO', 'ARQUIVO', 'POSIÇÃO', 'POSICAO',
  'POSIÇÃOFOLHA', 'POSICAOFOLHA', 'FOLHA',
];

// Mapeamento para nomes canônicos
const PARAM_ALIASES = {
  'LOCALIZAÇÃO': 'LOCAL',
  'LOCALIZACAO': 'LOCAL',
  'PAVIMENTO': 'PAV',
  'NUMERO': 'NUM',
  'NÚMERO': 'NUM',
  'NUMERO DA FOLHA': 'PRANCHA',
  'CONTEÚDO': 'COMPLEMENTO',
  'CONTEUDO': 'COMPLEMENTO',
  'DESCRIÇÃO': 'COMPLEMENTO',
  'DESCRICAO': 'COMPLEMENTO',
  'ARQUIVO': 'COMPLEMENTO',
  'POSIÇÃO': 'TORRE',
  'POSICAO': 'TORRE',
  'POSIÇÃOFOLHA': 'PRANCHA',
  'POSICAOFOLHA': 'PRANCHA',
  'FOLHA': 'PRANCHA',
};

// Padrões que indicam revisão
const REVISION_PATTERNS = [
  /^R[0-9X]{2,}$/i,
  /^REV[0-9X]+$/i,
];

/**
 * Detecta o separador dominante em um padrão
 */
function detectSeparator(pattern) {
  const counts = { '-': 0, '_': 0, '.': 0 };
  for (const char of pattern) {
    if (counts[char] !== undefined) counts[char]++;
  }
  // Ordenar por frequência
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? sorted[0][0] : '-';
}

/**
 * Parseia um padrão template em array de segmentos
 */
function parsePattern(pattern) {
  if (!pattern || !pattern.trim()) return null;

  const trimmed = pattern.trim();

  // Detectar separador dominante
  const mainSep = detectSeparator(trimmed);

  // Para padrões com separadores mistos (ex: separador principal + "-RXX" no final),
  // tratamos a revisão separadamente
  let patternBody = trimmed;
  let revisionPart = null;

  // Verificar se termina com revisão (R00, RXX, REVXX, etc.)
  const revMatch = trimmed.match(/[-_.]?(R[0-9X]{2,}|REV[0-9X]+)$/i);
  if (revMatch) {
    revisionPart = revMatch[0];
    patternBody = trimmed.slice(0, -revisionPart.length);
  }

  // Split pelo separador principal
  const parts = patternBody.split(new RegExp(`[${escapeRegex(mainSep)}]`)).filter(Boolean);

  // Também considerar outros separadores
  const allSeps = ['-', '_', '.'].filter(s => trimmed.includes(s));

  // Se há múltiplos separadores, re-split
  let finalParts;
  if (allSeps.length > 1) {
    const sepRegex = new RegExp(`[${allSeps.map(escapeRegex).join('')}]`);
    finalParts = patternBody.split(sepRegex).filter(Boolean);
  } else {
    finalParts = parts;
  }

  const segments = [];

  // Reconstruir com separadores reais
  let pos = 0;
  for (let i = 0; i < finalParts.length; i++) {
    const part = finalParts[i];
    const partUpper = part.toUpperCase().trim();

    // Determinar separador
    let separator = '';
    if (i > 0) {
      // Encontrar o separador real no texto original entre as partes
      const prevEnd = trimmed.indexOf(finalParts[i - 1], pos - finalParts[i - 1].length - 2) + finalParts[i - 1].length;
      const currStart = trimmed.indexOf(part, prevEnd);
      if (currStart > prevEnd) {
        separator = trimmed.slice(prevEnd, currStart);
        // Limitar a um caractere separador
        if (separator.length > 1) separator = separator[0];
      } else {
        separator = mainSep;
      }
    }

    // Verificar se é revisão
    if (REVISION_PATTERNS.some(p => p.test(partUpper))) {
      segments.push({ type: 'revision', separator });
      continue;
    }

    // Verificar se é parâmetro conhecido
    const isParam = KNOWN_PARAMS.some(p => partUpper === p);
    if (isParam) {
      const canonical = PARAM_ALIASES[partUpper] || partUpper;
      segments.push({ type: 'param', name: canonical, separator });
    } else {
      // Verificar se contém parâmetro (ex: LOCALXXX, BXXXX)
      const containsParam = KNOWN_PARAMS.find(p => partUpper.includes(p) && partUpper !== p);
      if (containsParam) {
        const canonical = PARAM_ALIASES[containsParam] || containsParam;
        segments.push({ type: 'param', name: canonical, separator });
      } else {
        // É texto fixo (código do projeto, prefixo, etc.)
        segments.push({ type: 'fixed', value: part, separator });
      }
    }

    pos = trimmed.indexOf(part, pos) + part.length;
  }

  // Adicionar revisão se encontrada no final
  if (revisionPart) {
    const revSep = revisionPart[0];
    const isSeparator = ['-', '_', '.'].includes(revSep);
    segments.push({
      type: 'revision',
      separator: isSeparator ? revSep : mainSep,
    });
  }

  // Garantir que o primeiro segmento não tem separator
  if (segments.length > 0) {
    segments[0] = { ...segments[0], separator: '' };
  }

  return segments;
}

/**
 * Gera template string a partir dos segmentos
 */
function buildTemplate(segments) {
  return segments.map((seg, i) => {
    const sep = i === 0 ? '' : (seg.separator || '-');
    if (seg.type === 'fixed') return sep + seg.value;
    if (seg.type === 'revision') return sep + 'RXX';
    return sep + seg.name;
  }).join('');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lê e parseia o CSV
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  // Pular header
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const project = parts[0]?.trim();
    const modelos = parts[1]?.trim() || '';
    const pranchas = parts[2]?.trim() || '';

    if (project && (modelos || pranchas)) {
      rows.push({ project, modelos, pranchas });
    }
  }

  return rows;
}

/**
 * Busca project_code pelo project_name no portfólio
 */
async function findProjectCode(projectName) {
  // Tentar match exato pelo nome
  const { data, error } = await supabase
    .from('projects')
    .select('project_code, name')
    .or(`name.ilike.%${projectName}%,project_code.ilike.%${projectName}%`)
    .limit(5);

  if (error || !data || data.length === 0) return null;

  // Preferir match exato
  const exact = data.find(p =>
    p.name?.toUpperCase() === projectName.toUpperCase() ||
    p.project_code?.toUpperCase() === projectName.toUpperCase()
  );

  return exact?.project_code || data[0]?.project_code || null;
}

/**
 * Execução principal
 */
async function main() {
  console.log('=== Import de Nomenclatura ===\n');

  const csvPath = path.join(__dirname, '..', '..', 'nomenclatura - Página1.csv');

  if (!fs.existsSync(csvPath)) {
    console.error('CSV não encontrado:', csvPath);
    process.exit(1);
  }

  const rows = readCSV(csvPath);
  console.log(`${rows.length} projetos com padrão no CSV\n`);

  let imported = 0;
  let skipped = 0;
  let notFound = 0;
  const errors = [];

  for (const row of rows) {
    // Parsear padrões
    const modelosSegments = row.modelos ? parsePattern(row.modelos) : null;
    const pranchasSegments = row.pranchas ? parsePattern(row.pranchas) : null;

    if (!modelosSegments && !pranchasSegments) {
      skipped++;
      continue;
    }

    // Buscar project_code
    const projectCode = await findProjectCode(row.project);

    if (!projectCode) {
      // Usar o nome do projeto como fallback de project_code
      console.log(`  [?] ${row.project} — project_code não encontrado, usando nome como código`);
      notFound++;
    }

    const code = projectCode || row.project;
    const upserts = [];

    if (modelosSegments) {
      upserts.push({
        project_code: code,
        tipo: 'modelos',
        padrao_template: buildTemplate(modelosSegments),
        segments: modelosSegments,
        updated_at: new Date().toISOString(),
      });
    }

    if (pranchasSegments) {
      upserts.push({
        project_code: code,
        tipo: 'pranchas',
        padrao_template: buildTemplate(pranchasSegments),
        segments: pranchasSegments,
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await supabase
      .from('project_nomenclatura')
      .upsert(upserts, { onConflict: 'project_code,tipo' });

    if (error) {
      errors.push({ project: row.project, error: error.message });
      console.log(`  [!] ${row.project} — ERRO: ${error.message}`);
    } else {
      imported++;
      const tipos = upserts.map(u => u.tipo).join('+');
      console.log(`  [OK] ${row.project} → ${code} (${tipos})`);
    }
  }

  console.log('\n=== Resultado ===');
  console.log(`Importados: ${imported}`);
  console.log(`Ignorados (sem padrão): ${skipped}`);
  console.log(`Sem project_code (usado nome): ${notFound}`);
  console.log(`Erros: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErros:');
    errors.forEach(e => console.log(`  - ${e.project}: ${e.error}`));
  }
}

main().catch(console.error);

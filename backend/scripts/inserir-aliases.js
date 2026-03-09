/**
 * Insere aliases faltantes na tabela financeiro_custos_operacao.usuario_alias
 *
 * Aliases mapeiam: nome_planilha (planilha financeira) -> nome_correto (timetracker)
 *
 * Uso: node backend/scripts/inserir-aliases.js
 */

import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const bigquery = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID });
const projectId = process.env.BIGQUERY_PROJECT_ID;
const location = process.env.BIGQUERY_LOCATION || 'southamerica-east1';
const q = (sql) => bigquery.createQueryJob({ query: sql, location }).then(([j]) => j.getQueryResults()).then(([r]) => r);

const novosAliases = [
  { nome_planilha: 'Franciel da Silva', nome_correto: 'Franciel' },
  { nome_planilha: 'Isabela Bezerra', nome_correto: 'Isabela Bezerra | Otus Engenharia' },
  { nome_planilha: 'LORENA MUNIZ DE SOUSA', nome_correto: 'Lorena Souza' },
  // Juliana: trailing space no timetracker, sem trailing space na planilha
  { nome_planilha: 'Juliana Araujo Rosa Krambeck', nome_correto: 'Juliana Araujo Rosa Krambeck ' },
];

async function main() {
  console.log('=== Inserindo aliases faltantes ===\n');

  // Verificar aliases existentes
  const existing = await q(`SELECT nome_planilha, nome_correto FROM \`${projectId}.financeiro_custos_operacao.usuario_alias\``);
  const existingSet = new Set(existing.map(r => r.nome_planilha.toLowerCase()));

  for (const alias of novosAliases) {
    if (existingSet.has(alias.nome_planilha.toLowerCase())) {
      console.log(`SKIP (ja existe): ${alias.nome_planilha} -> ${alias.nome_correto}`);
      continue;
    }

    await q(`
      INSERT INTO \`${projectId}.financeiro_custos_operacao.usuario_alias\` (nome_planilha, nome_correto)
      VALUES ('${alias.nome_planilha}', '${alias.nome_correto}')
    `);
    console.log(`INSERIDO: ${alias.nome_planilha} -> ${alias.nome_correto}`);
  }

  // Listar todos aliases
  console.log('\n--- Aliases atuais ---');
  const all = await q(`SELECT nome_planilha, nome_correto FROM \`${projectId}.financeiro_custos_operacao.usuario_alias\` ORDER BY nome_planilha`);
  all.forEach(r => console.log(`  ${r.nome_planilha} -> ${r.nome_correto}`));
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});

/**
 * Migração: Adiciona coluna `project_code` à tabela smartsheet_snapshot.
 *
 * A coluna project_code é o identificador estável do projeto que não muda
 * quando uma planilha SmartSheet é revisada (novo ID_Projeto).
 *
 * Execução: node backend/scripts/add-project-code-to-snapshot.mjs
 */
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const bigquery = new BigQuery({
  projectId: process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores',
});

async function main() {
  const table = '`dadosindicadores.smartsheet_atrasos.smartsheet_snapshot`';

  console.log('🔧 Adicionando coluna project_code à tabela smartsheet_snapshot...\n');

  const sql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS project_code STRING`;

  try {
    await bigquery.query({ query: sql });
    console.log('✅ Coluna project_code adicionada com sucesso (ou já existia).');
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Coluna project_code já existe.');
    } else {
      console.error('❌ Erro ao adicionar coluna:', error.message);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});

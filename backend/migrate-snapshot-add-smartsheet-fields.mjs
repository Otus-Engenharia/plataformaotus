/**
 * Migração: Adicionar colunas Smartsheet à tabela smartsheet_snapshot
 *
 * Adiciona Categoria_de_atraso, Motivo_de_atraso e ObservacaoOtus
 * para que os snapshots mensais capturem essas informações.
 *
 * Execução: node backend/migrate-snapshot-add-smartsheet-fields.mjs
 */
import { BigQuery } from '@google-cloud/bigquery';
import dotenv from 'dotenv';
dotenv.config();

const bigquery = new BigQuery();
const table = 'dadosindicadores.smartsheet_atrasos.smartsheet_snapshot';

async function main() {
  // 1. Verificar schema atual
  console.log('🔍 Verificando schema atual da tabela smartsheet_snapshot...\n');

  const [schema] = await bigquery.query({
    query: `
      SELECT column_name, data_type
      FROM \`dadosindicadores.smartsheet_atrasos.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'smartsheet_snapshot'
      ORDER BY ordinal_position
    `
  });

  console.log('Colunas atuais:');
  schema.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

  const newColumns = ['Categoria_de_atraso', 'Motivo_de_atraso', 'ObservacaoOtus'];
  const existing = schema.map(r => r.column_name);
  const missing = newColumns.filter(c => !existing.includes(c));

  if (missing.length === 0) {
    console.log('\n✅ Todas as colunas já existem.');
  } else {
    // 2. Adicionar colunas faltantes
    for (const col of missing) {
      console.log(`\n⏳ Adicionando coluna ${col}...`);
      await bigquery.query({
        query: `ALTER TABLE \`${table}\` ADD COLUMN IF NOT EXISTS ${col} STRING`
      });
      console.log(`✅ Coluna ${col} adicionada.`);
    }
  }

  // 3. Verificar estado
  const [counts] = await bigquery.query({
    query: `
      SELECT
        COUNT(*) as total,
        COUNTIF(Categoria_de_atraso IS NOT NULL AND Categoria_de_atraso != '') as com_categoria,
        COUNTIF(Motivo_de_atraso IS NOT NULL AND Motivo_de_atraso != '') as com_motivo,
        COUNTIF(ObservacaoOtus IS NOT NULL AND ObservacaoOtus != '') as com_observacao
      FROM \`${table}\`
    `
  });
  console.log('\n📊 Estado atual:');
  console.log(`   Total: ${counts[0].total}`);
  console.log(`   Categoria_de_atraso preenchido: ${counts[0].com_categoria}`);
  console.log(`   Motivo_de_atraso preenchido: ${counts[0].com_motivo}`);
  console.log(`   ObservacaoOtus preenchido: ${counts[0].com_observacao}`);

  // 4. Backfill: preencher com dados atuais via JOIN
  const needsBackfill = Number(counts[0].com_categoria) === 0 && Number(counts[0].com_motivo) === 0;

  if (needsBackfill) {
    console.log('\n⏳ Backfill: preenchendo com dados atuais do smartsheet_data_projetos...');
    console.log('   (Nota: usa dados atuais, não históricos - aproximação aceitável)');

    await bigquery.query({
      query: `
        UPDATE \`${table}\` snap
        SET
          snap.Categoria_de_atraso = COALESCE(snap.Categoria_de_atraso, src.Categoria_de_atraso),
          snap.Motivo_de_atraso = COALESCE(snap.Motivo_de_atraso, src.Motivo_de_atraso),
          snap.ObservacaoOtus = COALESCE(snap.ObservacaoOtus, src.ObservacaoOtus)
        FROM (
          SELECT ID_Projeto, NomeDaTarefa, Categoria_de_atraso, Motivo_de_atraso, ObservacaoOtus,
            ROW_NUMBER() OVER (
              PARTITION BY ID_Projeto, NomeDaTarefa
              ORDER BY CAST(rowNumber AS INT64)
            ) AS rn
          FROM \`dadosindicadores.smartsheet.smartsheet_data_projetos\`
        ) src
        WHERE snap.ID_Projeto = src.ID_Projeto
          AND snap.NomeDaTarefa = src.NomeDaTarefa
          AND src.rn = 1
          AND (snap.Categoria_de_atraso IS NULL OR snap.Motivo_de_atraso IS NULL OR snap.ObservacaoOtus IS NULL)
      `
    });

    // Verificar resultado
    const [afterCounts] = await bigquery.query({
      query: `
        SELECT
          COUNT(*) as total,
          COUNTIF(Categoria_de_atraso IS NOT NULL AND Categoria_de_atraso != '') as com_categoria,
          COUNTIF(Motivo_de_atraso IS NOT NULL AND Motivo_de_atraso != '') as com_motivo,
          COUNTIF(ObservacaoOtus IS NOT NULL AND ObservacaoOtus != '') as com_observacao
        FROM \`${table}\`
      `
    });
    console.log('\n📊 Após backfill:');
    console.log(`   Categoria_de_atraso preenchido: ${afterCounts[0].com_categoria}`);
    console.log(`   Motivo_de_atraso preenchido: ${afterCounts[0].com_motivo}`);
    console.log(`   ObservacaoOtus preenchido: ${afterCounts[0].com_observacao}`);
  } else {
    console.log('\n✅ Dados já existem, backfill não necessário.');
  }

  console.log('\n🎉 Migração concluída!');
  console.log('   Próximo passo: executar update-snapshot-scheduled-query.mjs para atualizar a query mensal.');
}

main().catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});

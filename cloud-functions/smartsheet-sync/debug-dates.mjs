/**
 * Debug de colunas de data do SmartSheet
 * Verifica como as datas estão sendo retornadas pela API
 */

import smartsheet from 'smartsheet';

// Token do SmartSheet
const TOKEN = process.env.SMARTSHEET_ACCESS_TOKEN || '6CXGlXkt7CO6qDgn94i0zibhlapuLET0vjNfL';

async function debugDates() {
  console.log('🔍 Debugando colunas de data do SmartSheet...\n');

  const client = smartsheet.createClient({
    accessToken: TOKEN,
    logLevel: 'error',
  });

  try {
    // Listar planilhas
    console.log('1️⃣ Listando planilhas...');
    const sheets = await client.sheets.listSheets({ includeAll: true });
    console.log(`   Encontradas ${sheets.data.length} planilhas\n`);

    // Filtrar por "Pjt" (planilhas de projeto)
    const projectSheets = sheets.data.filter(s =>
      s.name.includes('Pjt') &&
      !s.name.includes('Backup') &&
      !s.name.includes('Cópia')
    );
    console.log(`   Planilhas de projeto: ${projectSheets.length}\n`);

    // Pegar a primeira planilha de projeto para análise
    if (projectSheets.length === 0) {
      console.log('❌ Nenhuma planilha de projeto encontrada');
      return;
    }

    const sampleSheet = projectSheets.find(s => s.name.includes('ABC - Rua 289')) || projectSheets[0];
    console.log(`2️⃣ Analisando planilha: ${sampleSheet.name} (ID: ${sampleSheet.id})\n`);

    // Buscar dados completos da planilha
    const sheet = await client.sheets.getSheet({
      id: sampleSheet.id,
      level: 2,
    });

    // Analisar colunas
    console.log('3️⃣ Colunas da planilha:');
    const dateColumns = [];
    sheet.columns.forEach(col => {
      const isDateColumn = col.type === 'DATE' ||
        col.title.toLowerCase().includes('data') ||
        col.title.toLowerCase().includes('início') ||
        col.title.toLowerCase().includes('término') ||
        col.title.toLowerCase().includes('fim');

      const marker = isDateColumn ? '📅' : '  ';
      console.log(`   ${marker} "${col.title}" (ID: ${col.id}, Tipo: ${col.type || 'N/A'})`);

      if (isDateColumn) {
        dateColumns.push({ id: col.id, title: col.title, type: col.type });
      }
    });

    console.log(`\n4️⃣ Colunas identificadas como data: ${dateColumns.length}`);
    dateColumns.forEach(col => {
      console.log(`   - "${col.title}" (Tipo: ${col.type || 'N/A'})`);
    });

    // Analisar valores de data nas primeiras linhas
    console.log('\n5️⃣ Amostra de valores de data (primeiras 10 linhas):');

    const sampleRows = sheet.rows.slice(0, 10);
    for (const row of sampleRows) {
      console.log(`\n   Linha ${row.rowNumber}: ${getCellValue(row, 'Nome da Tarefa', sheet.columns) || 'N/A'}`);

      for (const dateCol of dateColumns) {
        const cell = row.cells.find(c => c.columnId === dateCol.id);
        if (cell) {
          console.log(`      "${dateCol.title}": valor="${cell.value}", displayValue="${cell.displayValue}", tipo=${typeof cell.value}`);
        }
      }
    }

    // Verificar mapeamento esperado
    console.log('\n6️⃣ Verificando mapeamento esperado:');
    const expectedColumns = [
      'Data de Início',
      'Data de Término',
      'Data de Início Baseline Otus',
      'Data de Fim Baseline Otus',
      'Data de Início Reprogramado Otus',
      'Data de Fim Reprogramado Otus',
    ];

    for (const expected of expectedColumns) {
      const found = sheet.columns.find(c => c.title === expected);
      if (found) {
        console.log(`   ✅ "${expected}" → encontrada (Tipo: ${found.type || 'N/A'})`);
      } else {
        // Tentar variações
        const similar = sheet.columns.find(c =>
          c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === expected.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (similar) {
          console.log(`   ⚠️ "${expected}" → NÃO encontrada, mas similar: "${similar.title}"`);
        } else {
          console.log(`   ❌ "${expected}" → NÃO encontrada`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.statusCode === 401) {
      console.error('\n⚠️ Token inválido ou expirado.');
    }
    process.exit(1);
  }
}

function getCellValue(row, columnTitle, columns) {
  const col = columns.find(c => c.title === columnTitle);
  if (!col) return null;
  const cell = row.cells.find(c => c.columnId === col.id);
  return cell?.value || cell?.displayValue || null;
}

debugDates();

/**
 * Teste de sincronização SmartSheet → BigQuery
 * Verifica se as correções do COLUMN_MAPPING funcionam
 */

import smartsheet from 'smartsheet';

// Token do SmartSheet
const TOKEN = process.env.SMARTSHEET_ACCESS_TOKEN || '6CXGlXkt7CO6qDgn94i0zibhlapuLET0vjNfL';

// Mapeamento corrigido (mesmo do index.js)
const COLUMN_MAPPING = {
  'ID_Projeto': { smartsheetColumn: 'ID_Projeto', type: 'STRING' },
  'NomeDaPlanilha': { smartsheetColumn: 'Nome da Planilha', type: 'STRING' },
  'NomeDaTarefa': { smartsheetColumn: 'Nome da Tarefa', type: 'STRING' },
  'DataDeInicio': { smartsheetColumn: 'Data Inicio', type: 'DATE' },
  'DataDeTermino': { smartsheetColumn: 'Data Término', type: 'DATE' },
  'CaminhoCriticoMarco': { smartsheetColumn: 'Caminho crítico - Marco', type: 'STRING' },
  'Disciplina': { smartsheetColumn: 'Disciplina', type: 'STRING' },
  'Level': { smartsheetColumn: 'Level', type: 'INT64' },
  'Status': { smartsheetColumn: 'Status', type: 'STRING' },
  'KPI': { smartsheetColumn: 'KPI', type: 'STRING' },
  'Categoria_de_atraso': { smartsheetColumn: 'Categoria de atraso', type: 'STRING' },
  'Motivo_de_atraso': { smartsheetColumn: 'Motivo de atraso', type: 'STRING' },
  'DataAtualizacao': { smartsheetColumn: null, type: 'TIMESTAMP', autoGenerate: true },
  'rowId': { smartsheetColumn: 'rowId', type: 'INT64' },
  'rowNumber': { smartsheetColumn: 'rowNumber', type: 'INT64' },
  'Duracao': { smartsheetColumn: 'Duração', type: 'STRING' },
  'DataDeInicioBaselineOtus': { smartsheetColumn: 'Data de Inicio - Baseline Otus', type: 'DATE' },
  'DataDeFimBaselineOtus': { smartsheetColumn: 'Data de Fim - Baseline Otus', type: 'DATE' },
  'VarianciaBaselineOtus': { smartsheetColumn: 'Variância - Baseline Otus', type: 'STRING' },
  'ObservacaoOtus': { smartsheetColumn: 'Observação Otus', type: 'STRING' },
  'LiberaPagamento': { smartsheetColumn: 'Libera Pagamento', type: 'STRING' },
  'MedicaoPagamento': { smartsheetColumn: 'Medição Pagamento', type: 'STRING' },
};

async function testSync() {
  console.log('🧪 Testando sincronização com mapeamento corrigido...\n');

  const client = smartsheet.createClient({
    accessToken: TOKEN,
    logLevel: 'error',
  });

  try {
    // Buscar planilha ABC - Rua 289
    const sheets = await client.sheets.listSheets({ includeAll: true });
    const targetSheet = sheets.data.find(s =>
      s.name.includes('ABC - Rua 289') &&
      !s.name.includes('Backup')
    );

    if (!targetSheet) {
      console.log('❌ Planilha ABC - Rua 289 não encontrada');
      return;
    }

    console.log(`📋 Processando: ${targetSheet.name} (ID: ${targetSheet.id})\n`);

    // Buscar dados
    const sheet = await client.sheets.getSheet({
      id: targetSheet.id,
      level: 2,
    });

    // Criar mapa de colunas
    const columnMap = {};
    sheet.columns.forEach(col => {
      columnMap[col.title] = col.id;
      columnMap[col.id] = col.title;
    });

    // Processar primeiras 5 linhas como teste
    console.log('📊 Processando linhas com mapeamento corrigido:\n');

    const testRows = sheet.rows.slice(0, 5).map(row => {
      const rowData = {
        rowId: row.id,
        rowNumber: row.rowNumber,
        NomeDaPlanilha: targetSheet.name,
        DataAtualizacao: new Date().toISOString(),
      };

      row.cells.forEach(cell => {
        const columnTitle = columnMap[cell.columnId];

        for (const [bigqueryField, mapping] of Object.entries(COLUMN_MAPPING)) {
          if (mapping.smartsheetColumn === columnTitle) {
            let value = cell.value;

            // Conversão de tipos
            if (mapping.type === 'INT64' && value) {
              value = parseInt(value) || null;
            } else if (mapping.type === 'DATE' && value) {
              if (typeof value === 'string') {
                const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
                value = dateMatch ? dateMatch[1] : null;
              }
            }

            rowData[bigqueryField] = value;
            break;
          }
        }
      });

      return rowData;
    });

    // Mostrar resultados
    testRows.forEach((row, i) => {
      console.log(`--- Linha ${i + 1}: ${row.NomeDaTarefa || 'N/A'} ---`);
      console.log(`   DataDeInicio: ${row.DataDeInicio || 'NULL'}`);
      console.log(`   DataDeTermino: ${row.DataDeTermino || 'NULL'}`);
      console.log(`   Disciplina: ${row.Disciplina || 'NULL'}`);
      console.log(`   Status: ${row.Status || 'NULL'}`);
      console.log(`   KPI: ${row.KPI || 'NULL'}`);
      console.log('');
    });

    // Verificar se as datas estão sendo capturadas
    const withDates = testRows.filter(r => r.DataDeInicio || r.DataDeTermino);
    console.log(`\n✅ Resultado: ${withDates.length}/${testRows.length} linhas com datas capturadas`);

    if (withDates.length === 0) {
      console.log('❌ PROBLEMA: Nenhuma data foi capturada!');
    } else {
      console.log('✅ SUCESSO: Datas estão sendo capturadas corretamente!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testSync();

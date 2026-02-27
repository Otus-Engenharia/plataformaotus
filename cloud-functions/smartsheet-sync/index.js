/**
 * Cloud Function: SmartSheet → BigQuery Sync
 *
 * Sincroniza dados de planilhas do SmartSheet para o BigQuery.
 * Executa via Cloud Scheduler a cada 1 hora.
 *
 * @author Otus Engenharia
 * @version 2.0.0
 */

import { BigQuery } from '@google-cloud/bigquery';
import smartsheet from 'smartsheet';

// Configurações
const CONFIG = {
  bigquery: {
    projectId: process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores',
    dataset: process.env.BIGQUERY_DATASET || 'smartsheet',
    table: process.env.BIGQUERY_TABLE || 'smartsheet_data_projetos',
    location: process.env.BIGQUERY_LOCATION || 'southamerica-east1',
  },
  smartsheet: {
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN,
    sheetIds: process.env.SMARTSHEET_SHEET_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [],
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    threadId: process.env.DISCORD_THREAD_ID || '',
  },
  syncMode: process.env.SYNC_MODE || 'full',
  batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
};

// Clientes (lazy initialization)
let bigqueryClient = null;
let smartsheetClient = null;

/**
 * Inicializa os clientes
 */
function initClients() {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: CONFIG.bigquery.projectId,
    });
  }

  if (!smartsheetClient && CONFIG.smartsheet.accessToken) {
    smartsheetClient = smartsheet.createClient({
      accessToken: CONFIG.smartsheet.accessToken,
      logLevel: 'info',
    });
  }
}

/**
 * Envia notificação para o Discord (thread específico)
 */
async function sendDiscordNotification(message, isError = false) {
  if (!CONFIG.discord.webhookUrl) {
    console.log('⚠️ Discord webhook não configurado, pulando notificação');
    return;
  }

  const emoji = isError ? '🚨' : '✅';
  const color = isError ? 0xff0000 : 0x00ff00;

  const payload = {
    embeds: [{
      title: `${emoji} SmartSheet Sync - ${isError ? 'ERRO' : 'Sucesso'}`,
      description: message,
      color: color,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Plataforma Otus - Cloud Function',
      },
    }],
  };

  // Adiciona thread_id como query param se configurado
  let url = CONFIG.discord.webhookUrl;
  if (CONFIG.discord.threadId) {
    url += `?thread_id=${CONFIG.discord.threadId}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('❌ Erro ao enviar notificação Discord:', response.status);
    }
  } catch (err) {
    console.error('❌ Erro ao enviar notificação Discord:', err.message);
  }
}

/**
 * Executa uma função com retry e exponential backoff
 */
async function withRetry(fn, operationName, maxRetries = CONFIG.maxRetries) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Rate limit do SmartSheet
      if (error.statusCode === 429 || error.message?.includes('rate limit')) {
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`⚠️ Rate limit atingido, aguardando ${waitTime}ms (tentativa ${attempt}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }

      // Erros de rede/timeout
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Erro de rede em ${operationName}, aguardando ${waitTime}ms (tentativa ${attempt}/${maxRetries})`);
        await sleep(waitTime);
        continue;
      }

      // Outros erros - falha imediata
      throw error;
    }
  }

  throw new Error(`${operationName} falhou após ${maxRetries} tentativas: ${lastError.message}`);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log estruturado para Cloud Logging
 */
function log(level, message, data = {}) {
  const entry = {
    severity: level.toUpperCase(),
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };
  console.log(JSON.stringify(entry));
}

/**
 * Mapeia as colunas do SmartSheet para o schema do BigQuery
 *
 * IMPORTANTE: Os nomes das colunas devem corresponder EXATAMENTE aos nomes no SmartSheet.
 * Use o script debug-dates.mjs para verificar os nomes corretos.
 *
 * Atualizado em 2026-02-06 após diagnóstico de colunas de data vazias.
 */
const COLUMN_MAPPING = {
  'ID_Projeto': { smartsheetColumn: 'ID_Projeto', type: 'STRING' },
  'NomeDaPlanilha': { smartsheetColumn: 'Nome da Planilha', type: 'STRING' },
  'NomeDaTarefa': { smartsheetColumn: 'Nome da Tarefa', type: 'STRING' },
  // Corrigido: SmartSheet usa "Data Inicio" (sem "de" e sem acento)
  'DataDeInicio': { smartsheetColumn: 'Data Inicio', type: 'DATE' },
  // Corrigido: SmartSheet usa "Data Término" (sem "de")
  'DataDeTermino': { smartsheetColumn: 'Data Término', type: 'DATE' },
  // Corrigido: SmartSheet usa hífen e "crítico" minúsculo
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
  // Corrigido: SmartSheet usa hífen e "Inicio" sem acento
  'DataDeInicioBaselineOtus': { smartsheetColumn: 'Data de Inicio - Baseline Otus', type: 'DATE' },
  'DataDeFimBaselineOtus': { smartsheetColumn: 'Data de Fim - Baseline Otus', type: 'DATE' },
  // Corrigido: SmartSheet usa hífen
  'VarianciaBaselineOtus': { smartsheetColumn: 'Variância - Baseline Otus', type: 'STRING' },
  'ObservacaoOtus': { smartsheetColumn: 'Observação Otus', type: 'STRING' },
  'LiberaPagamento': { smartsheetColumn: 'Libera Pagamento', type: 'STRING' },
  'MedicaoPagamento': { smartsheetColumn: 'Medição Pagamento', type: 'STRING' },
  // Colunas de Reprogramado não existem na planilha atual - mantendo para compatibilidade futura
  'DataDeInicioReprogramadoOtus': { smartsheetColumn: 'Data de Início Reprogramado Otus', type: 'DATE' },
  'DataDeFimReprogramadoOtus': { smartsheetColumn: 'Data de Fim Reprogramado Otus', type: 'DATE' },
  'VarianciaReprogramadoOtus': { smartsheetColumn: 'Variância Reprogramado Otus', type: 'INT64' },
};

/**
 * Busca os smartsheet_id registrados no portfólio (BigQuery)
 * e retorna a lista de sheets para sincronizar
 */
async function getSheetsFromPortfolio() {
  log('info', 'Buscando smartsheet_ids do portfólio no BigQuery...');

  const [rows] = await bigqueryClient.query({
    query: `
      SELECT DISTINCT smartsheet_id, project_name
      FROM \`${CONFIG.bigquery.projectId}.portifolio.portifolio_plataforma\`
      WHERE smartsheet_id IS NOT NULL AND smartsheet_id != ''
    `,
  });

  log('info', `Encontrados ${rows.length} projetos com smartsheet_id no portfólio`);

  const sheets = [];
  const failedSheets = [];
  for (const row of rows) {
    try {
      const sheet = await withRetry(async () => {
        return await smartsheetClient.sheets.getSheet({
          id: Number(row.smartsheet_id),
          pageSize: 0, // só metadata, sem linhas (mais rápido)
        });
      }, `getSheetMeta(${row.project_name})`);
      sheets.push({ id: Number(row.smartsheet_id), name: sheet.name });
    } catch (err) {
      failedSheets.push({ project: row.project_name, id: row.smartsheet_id, error: err.message });
      log('warn', `Planilha ${row.smartsheet_id} (${row.project_name}) não encontrada no Smartsheet`, {
        error: err.message,
        smartsheet_id: row.smartsheet_id,
      });
    }
    await sleep(100); // rate limiting
  }

  log('info', `${sheets.length}/${rows.length} planilhas encontradas no Smartsheet`);
  if (failedSheets.length > 0) {
    log('warn', `${failedSheets.length} planilhas falharam na validação`, {
      failed: failedSheets.map(f => `${f.project} (${f.id}): ${f.error}`).join('; '),
    });
  }
  return sheets;
}

/**
 * Busca dados de uma planilha específica
 */
async function getSheetData(sheetId, sheetName) {
  log('info', `Buscando planilha: ${sheetName}`, { sheetId, sheetName });

  return await withRetry(async () => {
    const sheet = await smartsheetClient.sheets.getSheet({
      id: sheetId,
      level: 2,
    });

    // Criar mapa de colunas
    const columnMap = {};
    sheet.columns.forEach(col => {
      columnMap[col.title] = col.id;
      columnMap[col.id] = col.title;
    });

    // Processar linhas
    const rows = sheet.rows.map(row => {
      const rowData = {
        rowId: row.id,
        rowNumber: row.rowNumber,
        NomeDaPlanilha: sheetName,
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
              // SmartSheet retorna datas como "2024-07-23T08:00:00" ou "2024-07-23"
              // BigQuery espera "YYYY-MM-DD" para colunas DATE
              if (typeof value === 'string') {
                // Extrai apenas a parte da data (YYYY-MM-DD)
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

    log('info', `Planilha processada: ${sheetName}`, { rows: rows.length });
    return rows;
  }, `getSheetData(${sheetName})`);
}

/**
 * Insere dados no BigQuery em batches
 */
async function insertToBigQuery(rows) {
  if (rows.length === 0) {
    log('warn', 'Nenhuma linha para inserir');
    return 0;
  }

  log('info', `Inserindo ${rows.length} linhas no BigQuery...`, { totalRows: rows.length });

  const table = bigqueryClient
    .dataset(CONFIG.bigquery.dataset)
    .table(CONFIG.bigquery.table);

  const batches = [];
  for (let i = 0; i < rows.length; i += CONFIG.batchSize) {
    batches.push(rows.slice(i, i + CONFIG.batchSize));
  }

  let totalInserted = 0;
  let totalFailed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      await withRetry(async () => {
        await table.insert(batch, {
          skipInvalidRows: true,
          ignoreUnknownValues: true,
        });
      }, `insertBatch(${i + 1}/${batches.length})`);

      totalInserted += batch.length;
      log('info', `Batch ${i + 1}/${batches.length} inserido`, { batchSize: batch.length });
    } catch (error) {
      if (error.name === 'PartialFailureError') {
        const failedCount = error.errors?.length || 0;
        totalFailed += failedCount;
        totalInserted += batch.length - failedCount;
        log('warn', `Batch ${i + 1} parcialmente falhou`, { failed: failedCount });
      } else {
        throw error;
      }
    }
  }

  log('info', `Inserção concluída`, { inserted: totalInserted, failed: totalFailed });
  return totalInserted;
}

/**
 * Limpa a tabela (modo full)
 */
async function truncateTable() {
  log('info', 'Limpando tabela...');

  const query = `TRUNCATE TABLE \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.${CONFIG.bigquery.table}\``;

  try {
    await bigqueryClient.query({
      query,
      location: CONFIG.bigquery.location,
    });
    log('info', 'Tabela limpa');
  } catch (error) {
    if (error.code === 404) {
      log('info', 'Tabela não existe, será criada');
    } else {
      throw error;
    }
  }
}

/**
 * Garante que a tabela existe
 */
async function ensureTableExists() {
  const schema = Object.entries(COLUMN_MAPPING).map(([name, config]) => ({
    name,
    type: config.type,
    mode: 'NULLABLE',
  }));

  const table = bigqueryClient
    .dataset(CONFIG.bigquery.dataset)
    .table(CONFIG.bigquery.table);

  const [exists] = await table.exists();

  if (!exists) {
    log('info', 'Criando tabela...');
    await table.create({ schema });
    log('info', 'Tabela criada');
  }
}

/**
 * Função principal - Entry point para Cloud Functions
 */
export async function syncSmartsheetToBigQuery(req, res) {
  const startTime = Date.now();
  const runId = Math.random().toString(36).substring(7);

  log('info', '🚀 Iniciando sincronização SmartSheet → BigQuery', {
    runId,
    mode: CONFIG.syncMode,
  });

  try {
    initClients();

    if (!CONFIG.smartsheet.accessToken) {
      throw new Error('SMARTSHEET_ACCESS_TOKEN não configurado');
    }

    await ensureTableExists();

    // Buscar planilhas registradas no portfólio
    const sheets = await getSheetsFromPortfolio();

    if (sheets.length === 0) {
      throw new Error('Nenhuma planilha encontrada para sincronizar');
    }

    // Coletar dados
    const allRows = [];
    let processedSheets = 0;
    let failedSheets = 0;

    for (const sheet of sheets) {
      try {
        const rows = await getSheetData(sheet.id, sheet.name);
        const projectId = String(sheet.id);

        rows.forEach(row => {
          row.ID_Projeto = row.ID_Projeto || projectId;
        });

        allRows.push(...rows);
        processedSheets++;
      } catch (err) {
        log('error', `Erro ao processar planilha ${sheet.name}`, { error: err.message });
        failedSheets++;
      }

      // Rate limiting
      await sleep(250);
    }

    log('info', `Coleta concluída`, {
      totalRows: allRows.length,
      processedSheets,
      failedSheets,
    });

    // Proteção contra truncate com poucos dados
    if (CONFIG.syncMode === 'full') {
      try {
        const [countResult] = await bigqueryClient.query({
          query: `SELECT COUNT(DISTINCT ID_Projeto) as cnt FROM \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.${CONFIG.bigquery.table}\``,
        });
        const currentProjects = Number(countResult[0]?.cnt || 0);
        const uniqueNewProjects = new Set(allRows.map(r => r.ID_Projeto)).size;

        if (currentProjects > 10 && uniqueNewProjects < currentProjects * 0.5) {
          const msg = `Proteção ativada: sync traria ${uniqueNewProjects} projetos mas tabela atual tem ${currentProjects}. Possível perda de acesso ao Smartsheet. Abortando truncate.`;
          log('error', msg);
          await sendDiscordNotification(msg, true);
          if (res) res.status(500).json({ success: false, error: msg });
          return { success: false, error: msg };
        }

        log('info', `Verificação de proteção OK: ${uniqueNewProjects} novos vs ${currentProjects} atuais`);
      } catch (checkErr) {
        log('warn', 'Não foi possível verificar contagem atual, continuando...', { error: checkErr.message });
      }

      await truncateTable();
    }

    const inserted = await insertToBigQuery(allRows);

    // Resultado
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = {
      success: true,
      runId,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      stats: {
        sheetsProcessed: processedSheets,
        sheetsFailed: failedSheets,
        rowsCollected: allRows.length,
        rowsInserted: inserted,
      },
    };

    log('info', '✅ Sincronização concluída!', result);

    // Notificar sucesso no Discord (opcional - só em caso de muitas falhas)
    if (failedSheets > 0) {
      await sendDiscordNotification(
        `**Sincronização concluída com avisos**\n` +
        `• Planilhas: ${processedSheets} OK, ${failedSheets} falharam\n` +
        `• Linhas inseridas: ${inserted.toLocaleString()}\n` +
        `• Duração: ${duration}s`,
        false
      );
    }

    if (res) res.status(200).json(result);
    return result;

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    log('error', '❌ Erro na sincronização', {
      runId,
      error: error.message,
      stack: error.stack,
      duration: `${duration}s`,
    });

    // Notificar erro no Discord
    await sendDiscordNotification(
      `**Erro na sincronização SmartSheet → BigQuery**\n\n` +
      `\`\`\`\n${error.message}\n\`\`\`\n\n` +
      `Duração: ${duration}s\n` +
      `Run ID: ${runId}`,
      true
    );

    const errorResult = {
      success: false,
      runId,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
    };

    if (res) res.status(500).json(errorResult);
    return errorResult;
  }
}

// Permite execução local para testes
const isMainModule = process.argv[1]?.includes('index.js');
if (isMainModule) {
  console.log('🧪 Executando localmente...');
  syncSmartsheetToBigQuery(null, {
    status: (code) => ({
      json: (data) => console.log(`\nResponse [${code}]:`, JSON.stringify(data, null, 2)),
    }),
  });
}

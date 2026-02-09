/**
 * Cloud Function: Construflow → BigQuery Sync
 *
 * Sincroniza dados do Construflow para o BigQuery.
 * Substitui o n8n que estava com problemas de timeout.
 *
 * Estratégia:
 * - GraphQL para issues e comentários (filtrado por projeto, evita timeout)
 * - REST para lookups (projects, phases, categories, etc)
 * - Paralelismo para comentários (10 issues simultâneas)
 *
 * @author Otus Engenharia
 * @version 1.0.0
 */

import { BigQuery } from '@google-cloud/bigquery';
import {
  fetchProjects,
  fetchProjectIssues,
  fetchCommentsInParallel,
} from './graphql-client.js';
import {
  fetchAllLookups,
  fetchRelationships,
} from './rest-client.js';

// Configuração
const CONFIG = {
  bigquery: {
    projectId: process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores',
    dataset: process.env.BIGQUERY_DATASET || 'construflow_data',
    location: process.env.BIGQUERY_LOCATION || 'southamerica-east1',
  },
  construflow: {
    // GraphQL
    username: process.env.CONSTRUFLOW_USERNAME,
    password: process.env.CONSTRUFLOW_PASSWORD,
    apiKey: process.env.CONSTRUFLOW_GRAPHQL_API_KEY,
    apiSecret: process.env.CONSTRUFLOW_GRAPHQL_API_SECRET,
    // REST
    restApiKey: process.env.CONSTRUFLOW_API_KEY,
    restApiSecret: process.env.CONSTRUFLOW_API_SECRET,
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    threadId: process.env.DISCORD_THREAD_ID || '',
  },
  // Paralelismo para comentários (aumentado para 25)
  commentsBatchSize: parseInt(process.env.COMMENTS_BATCH_SIZE) || 25,
  // Sincronizar comentários? (desativado por padrão - rodar só 1x/dia)
  syncComments: process.env.SYNC_COMMENTS === 'true',
};

// Cliente BigQuery
let bigqueryClient = null;

function getBigQueryClient() {
  if (!bigqueryClient) {
    bigqueryClient = new BigQuery({
      projectId: CONFIG.bigquery.projectId,
    });
  }
  return bigqueryClient;
}

/**
 * Envia notificação para o Discord
 */
async function sendDiscordNotification(message, isError = false) {
  if (!CONFIG.discord.webhookUrl) return;

  const emoji = isError ? '🚨' : '✅';
  const color = isError ? 0xff0000 : 0x00ff00;

  const payload = {
    embeds: [{
      title: `${emoji} Construflow Sync - ${isError ? 'ERRO' : 'Sucesso'}`,
      description: message,
      color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Plataforma Otus - Cloud Function' },
    }],
  };

  let url = CONFIG.discord.webhookUrl;
  if (CONFIG.discord.threadId) {
    url += `?thread_id=${CONFIG.discord.threadId}`;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('❌ Erro ao enviar notificação Discord:', err.message);
  }
}

/**
 * Insere dados no BigQuery (truncate + insert)
 */
async function insertToBigQuery(tableName, rows, schema = null) {
  if (!rows || rows.length === 0) {
    console.log(`⚠️ ${tableName}: nenhum dado para inserir`);
    return 0;
  }

  const bq = getBigQueryClient();
  const dataset = bq.dataset(CONFIG.bigquery.dataset);
  const table = dataset.table(tableName);

  console.log(`📥 Inserindo ${rows.length} linhas em ${tableName}...`);

  // Truncar tabela existente
  try {
    const [exists] = await table.exists();
    if (exists) {
      await bq.query({
        query: `TRUNCATE TABLE \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.${tableName}\``,
        location: CONFIG.bigquery.location,
      });
      console.log(`   Tabela ${tableName} truncada`);
    }
  } catch (err) {
    console.warn(`⚠️ Erro ao truncar ${tableName}: ${err.message}`);
  }

  // Inserir em batches
  const batchSize = 1000;
  let totalInserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    try {
      await table.insert(batch, {
        skipInvalidRows: true,
        ignoreUnknownValues: true,
      });
      totalInserted += batch.length;
    } catch (error) {
      if (error.name === 'PartialFailureError') {
        const failedCount = error.errors?.length || 0;
        totalInserted += batch.length - failedCount;
        console.warn(`   ⚠️ ${failedCount} linhas falharam no batch`);
      } else {
        throw error;
      }
    }
  }

  console.log(`   ✅ ${totalInserted} linhas inseridas em ${tableName}`);
  return totalInserted;
}

/**
 * Processa issues de todos os projetos
 */
async function syncIssues(graphqlConfig) {
  console.log('\n📊 FASE 1: Sincronizando Issues via GraphQL...');

  // Buscar lista de projetos
  const projects = await fetchProjects(graphqlConfig);

  if (projects.length === 0) {
    console.warn('⚠️ Nenhum projeto encontrado');
    return { issues: 0, issuesDisciplines: 0 };
  }

  const allIssues = [];
  const allIssuesDisciplines = [];

  // Buscar issues de cada projeto
  for (const project of projects) {
    try {
      const issues = await fetchProjectIssues(project.id, graphqlConfig);

      for (const issue of issues) {
        // Issue principal
        allIssues.push({
          id: issue.id,
          guid: issue.guid,
          code: issue.code,
          title: issue.title,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          projectId: project.id,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
          deadline: issue.deadline,
          createdByUserId: issue.createdByUserId,
          statusUpdatedByUserId: issue.statusUpdatedByUserId,
          statusUpdatedAt: issue.statusUpdatedAt,
          creationPhase: issue.creationPhase,
          resolutionPhase: issue.resolutionPhase,
          visibility: issue.visibility,
          editedAt: issue.editedAt,
        });

        // Relacionamento issue-disciplina
        if (issue.disciplines) {
          for (const disc of issue.disciplines) {
            allIssuesDisciplines.push({
              issueId: issue.id,
              disciplineId: disc.discipline?.id,
              disciplineName: disc.discipline?.name,
              status: disc.status,
              projectId: project.id,
            });
          }
        }
      }

      // Rate limiting entre projetos
      await sleep(200);
    } catch (err) {
      console.error(`❌ Erro ao buscar issues do projeto ${project.id}: ${err.message}`);
    }
  }

  // Inserir no BigQuery
  const issuesInserted = await insertToBigQuery('issues', allIssues);
  const disciplinesInserted = await insertToBigQuery('issues_disciplines', allIssuesDisciplines);

  return {
    issues: issuesInserted,
    issuesDisciplines: disciplinesInserted,
    projects: projects.length,
  };
}

/**
 * Sincroniza comentários e histórico (com paralelismo)
 */
async function syncCommentsAndHistory(graphqlConfig, shouldSync = true) {
  if (!shouldSync) {
    console.log('\n⏭️ Sincronização de comentários desativada (use ?sync_comments=true para ativar)');
    return { comments: 0, history: 0 };
  }

  console.log('\n📝 FASE 2: Sincronizando Comentários + Histórico (paralelo)...');

  const bq = getBigQueryClient();

  // Buscar lista de issues do BigQuery (já sincronizadas)
  const [rows] = await bq.query({
    query: `
      SELECT DISTINCT id, projectId
      FROM \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.issues\`
      WHERE status = 'active'
    `,
    location: CONFIG.bigquery.location,
  });

  if (rows.length === 0) {
    console.warn('⚠️ Nenhuma issue ativa encontrada');
    return { comments: 0, history: 0 };
  }

  console.log(`   ${rows.length} issues ativas para processar`);

  // Agrupar por projeto
  const issuesByProject = {};
  for (const row of rows) {
    if (!issuesByProject[row.projectId]) {
      issuesByProject[row.projectId] = [];
    }
    issuesByProject[row.projectId].push(row.id);
  }

  const allComments = [];
  const allHistory = [];

  // Processar cada projeto com paralelismo interno
  for (const [projectId, issueIds] of Object.entries(issuesByProject)) {
    console.log(`   Projeto ${projectId}: ${issueIds.length} issues...`);

    try {
      const results = await fetchCommentsInParallel(
        projectId,
        issueIds,
        graphqlConfig,
        CONFIG.commentsBatchSize
      );

      for (const result of results) {
        // Comentários
        for (const comment of result.comments || []) {
          allComments.push({
            id: comment.id,
            issueId: result.issueId,
            projectId: result.projectId,
            message: comment.message,
            visibility: comment.visibility,
            createdAt: comment.createdAt,
            createdByUserId: comment.createdByUser?.id,
            createdByUserName: comment.createdByUser?.name,
            createdByUserEmail: comment.createdByUser?.email,
          });
        }

        // Histórico
        for (const hist of result.history || []) {
          allHistory.push({
            _id: hist._id,
            issueId: result.issueId,
            projectId: result.projectId,
            userId: hist.user?.id,
            userName: hist.user?.name,
            entityType: hist.entityType,
            fields: JSON.stringify(hist.fields),
            dataTime: hist.dataTime,
          });
        }
      }
    } catch (err) {
      console.error(`❌ Erro ao buscar comentários do projeto ${projectId}: ${err.message}`);
    }
  }

  // Inserir no BigQuery
  const commentsInserted = await insertToBigQuery('issue_comments_and_historic', [
    ...allComments.map(c => ({ ...c, type: 'comment' })),
    ...allHistory.map(h => ({ ...h, type: 'history' })),
  ]);

  return {
    comments: allComments.length,
    history: allHistory.length,
    total: commentsInserted,
  };
}

/**
 * Sincroniza lookups via REST API
 */
async function syncLookups(restConfig) {
  console.log('\n📚 FASE 3: Sincronizando Lookups via REST...');

  const lookups = await fetchAllLookups(restConfig);
  const stats = {};

  for (const [name, data] of Object.entries(lookups)) {
    stats[name] = await insertToBigQuery(name, data);
  }

  return stats;
}

/**
 * Sincroniza relacionamentos via REST API
 */
async function syncRelationships(restConfig) {
  console.log('\n🔗 FASE 4: Sincronizando Relacionamentos via REST...');

  const relationships = await fetchRelationships(restConfig);
  const stats = {};

  for (const [name, data] of Object.entries(relationships)) {
    const tableName = name.replace('-', '_'); // issues-locals → issues_locals
    stats[tableName] = await insertToBigQuery(tableName, data);
  }

  return stats;
}

/**
 * Função principal - Entry point para Cloud Functions
 */
export async function syncConstruflowToBigQuery(req, res) {
  const startTime = Date.now();
  const runId = Math.random().toString(36).substring(7);

  // Permitir override via query param ou body
  const syncCommentsOverride = req?.query?.sync_comments || req?.body?.sync_comments;
  const shouldSyncComments = syncCommentsOverride === 'true' ||
    (syncCommentsOverride === undefined && CONFIG.syncComments);

  console.log('🚀 Iniciando sincronização Construflow → BigQuery');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Sync Comments: ${shouldSyncComments ? 'SIM' : 'NÃO'}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);

  const stats = {
    issues: 0,
    issuesDisciplines: 0,
    comments: 0,
    history: 0,
    lookups: {},
    relationships: {},
  };

  try {
    // Validar configuração
    if (!CONFIG.construflow.username || !CONFIG.construflow.password) {
      throw new Error('Credenciais GraphQL não configuradas');
    }

    if (!CONFIG.construflow.restApiKey || !CONFIG.construflow.restApiSecret) {
      throw new Error('Credenciais REST não configuradas');
    }

    const graphqlConfig = {
      username: CONFIG.construflow.username,
      password: CONFIG.construflow.password,
      apiKey: CONFIG.construflow.apiKey,
    };

    const restConfig = {
      apiKey: CONFIG.construflow.restApiKey,
      apiSecret: CONFIG.construflow.restApiSecret,
    };

    // FASE 1: Issues via GraphQL
    const issuesStats = await syncIssues(graphqlConfig);
    stats.issues = issuesStats.issues;
    stats.issuesDisciplines = issuesStats.issuesDisciplines;

    // FASE 2: Comentários via GraphQL (paralelo)
    const commentsStats = await syncCommentsAndHistory(graphqlConfig, shouldSyncComments);
    stats.comments = commentsStats.comments;
    stats.history = commentsStats.history;

    // FASE 3: Lookups via REST
    stats.lookups = await syncLookups(restConfig);

    // FASE 4: Relacionamentos via REST
    stats.relationships = await syncRelationships(restConfig);

    // Resultado
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const result = {
      success: true,
      runId,
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      stats,
    };

    console.log('\n✅ Sincronização concluída!');
    console.log(`   Duração: ${duration}s`);
    console.log(`   Issues: ${stats.issues}`);
    console.log(`   Comentários: ${stats.comments}`);

    // Notificar sucesso
    await sendDiscordNotification(
      `**Sincronização concluída**\n` +
      `• Issues: ${stats.issues}\n` +
      `• Comentários: ${stats.comments}\n` +
      `• Duração: ${duration}s`,
      false
    );

    if (res) res.status(200).json(result);
    return result;

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.error('\n❌ Erro na sincronização:', error.message);
    console.error(error.stack);

    // Notificar erro
    await sendDiscordNotification(
      `**Erro na sincronização**\n\n` +
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

// Helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Permite execução local
const isMainModule = process.argv[1]?.includes('index.js');
if (isMainModule) {
  console.log('🧪 Executando localmente...');
  syncConstruflowToBigQuery(null, {
    status: (code) => ({
      json: (data) => console.log(`\nResponse [${code}]:`, JSON.stringify(data, null, 2)),
    }),
  });
}

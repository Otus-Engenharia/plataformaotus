/**
 * Cloud Run Job: Construflow Comments → BigQuery Sync
 *
 * Sincroniza comentários e histórico de issues do Construflow para o BigQuery.
 * Roda como Cloud Run Job (sem limite de timeout de 1h).
 *
 * @author Otus Engenharia
 * @version 1.0.0
 */

import { BigQuery } from '@google-cloud/bigquery';

// Configuração via variáveis de ambiente
const CONFIG = {
  bigquery: {
    projectId: process.env.BIGQUERY_PROJECT_ID || 'dadosindicadores',
    dataset: process.env.BIGQUERY_DATASET || 'construflow_data',
    location: process.env.BIGQUERY_LOCATION || 'southamerica-east1',
  },
  construflow: {
    username: process.env.CONSTRUFLOW_USERNAME,
    password: process.env.CONSTRUFLOW_PASSWORD,
    apiKey: process.env.CONSTRUFLOW_GRAPHQL_API_KEY,
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    threadId: process.env.DISCORD_THREAD_ID || '',
  },
  // Paralelismo para comentários
  batchSize: parseInt(process.env.COMMENTS_BATCH_SIZE) || 25,
};

const GRAPHQL_URL = 'https://api.construflow.com.br/graphql';

// Cache de tokens
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

// Cliente BigQuery
const bigquery = new BigQuery({ projectId: CONFIG.bigquery.projectId });

/**
 * Envia notificação para o Discord
 */
async function sendDiscordNotification(message, isError = false) {
  if (!CONFIG.discord.webhookUrl) return;

  const emoji = isError ? '🚨' : '✅';
  const color = isError ? 0xff0000 : 0x00ff00;

  const payload = {
    embeds: [{
      title: `${emoji} Construflow Comments Sync - ${isError ? 'ERRO' : 'Sucesso'}`,
      description: message,
      color,
      timestamp: new Date().toISOString(),
      footer: { text: 'Plataforma Otus - Cloud Run Job' },
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
 * Login no GraphQL
 */
async function login() {
  console.log('🔐 Fazendo login no Construflow GraphQL...');

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation SignIn($username: String!, $password: String!) {
          signIn(username: $username, password: $password) {
            accessToken
            refreshToken
          }
        }
      `,
      variables: {
        username: CONFIG.construflow.username,
        password: CONFIG.construflow.password,
      },
    }),
  });

  const data = await response.json();

  if (data.errors || !data.data?.signIn?.accessToken) {
    throw new Error(`Login falhou: ${JSON.stringify(data.errors || 'tokens não retornados')}`);
  }

  tokenCache = {
    accessToken: data.data.signIn.accessToken,
    refreshToken: data.data.signIn.refreshToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  console.log('✅ Login realizado com sucesso');
  return tokenCache.accessToken;
}

/**
 * Refresh token
 */
async function refreshAccessToken() {
  console.log('🔄 Renovando token...');

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenCache.refreshToken}`,
    },
    body: JSON.stringify({
      query: `
        mutation RefreshToken {
          refreshToken {
            accessToken
            refreshToken
          }
        }
      `,
    }),
  });

  const data = await response.json();

  if (data.errors || !data.data?.refreshToken?.accessToken) {
    console.warn('⚠️ Refresh token expirado, fazendo novo login...');
    tokenCache = { accessToken: null, refreshToken: null, expiresAt: null };
    return await login();
  }

  tokenCache = {
    accessToken: data.data.refreshToken.accessToken,
    refreshToken: data.data.refreshToken.refreshToken,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  console.log('✅ Token renovado');
  return tokenCache.accessToken;
}

/**
 * Obtém token válido
 */
async function getValidToken() {
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  if (tokenCache.refreshToken) {
    return await refreshAccessToken();
  }

  return await login();
}

/**
 * Executa query GraphQL
 */
async function executeQuery(query, variables) {
  const token = await getValidToken();

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-API-Key': CONFIG.construflow.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  // Token expirou durante a requisição
  if (data.errors?.some(e =>
    e.message?.toLowerCase().includes('token') ||
    e.message?.toLowerCase().includes('unauthorized') ||
    e.message?.toLowerCase().includes('expired')
  )) {
    console.warn('⚠️ Token expirou, renovando...');
    tokenCache = { accessToken: null, refreshToken: null, expiresAt: null };
    const newToken = await getValidToken();

    const retryResponse = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newToken}`,
        'X-API-Key': CONFIG.construflow.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    return await retryResponse.json();
  }

  return data;
}

/**
 * Busca comentários e histórico de uma issue
 */
async function fetchIssueCommentsAndHistory(projectId, issueId) {
  const query = `
    query GetIssueDetails($projectId: Int!, $issueId: Int!) {
      issue(projectId: $projectId, issueId: $issueId) {
        id
        code
        comments {
          id
          message
          visibility
          createdAt
          createdByUser {
            id
            name
            email
          }
        }
        history {
          _id
          user {
            id
            name
          }
          entityType
          fields
          dataTime
        }
      }
    }
  `;

  const result = await executeQuery(query, {
    projectId: parseInt(projectId),
    issueId: parseInt(issueId),
  });

  if (result.errors) {
    console.warn(`⚠️ Erro ao buscar issue ${issueId}: ${JSON.stringify(result.errors)}`);
    return { comments: [], history: [] };
  }

  return {
    issueId,
    projectId,
    comments: result.data?.issue?.comments || [],
    history: result.data?.issue?.history || [],
  };
}

/**
 * Processa batch de issues em paralelo
 */
async function processBatch(projectId, issueIds) {
  const results = await Promise.all(
    issueIds.map(issueId => fetchIssueCommentsAndHistory(projectId, issueId))
  );
  return results;
}

/**
 * Chunk array
 */
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main: Sincroniza comentários e histórico
 */
async function main() {
  const startTime = Date.now();
  const runId = Math.random().toString(36).substring(7);

  console.log('🚀 Iniciando sincronização de comentários Construflow → BigQuery');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Batch Size: ${CONFIG.batchSize}`);

  try {
    // Validar configuração
    if (!CONFIG.construflow.username || !CONFIG.construflow.password) {
      throw new Error('Credenciais GraphQL não configuradas');
    }

    // Login
    await login();

    // Buscar lista de issues ativas do BigQuery
    console.log('\n📊 Buscando lista de issues ativas do BigQuery...');
    const [rows] = await bigquery.query({
      query: `
        SELECT DISTINCT id, projectId
        FROM \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.issues\`
        WHERE status = 'active'
      `,
      location: CONFIG.bigquery.location,
    });

    if (rows.length === 0) {
      console.warn('⚠️ Nenhuma issue ativa encontrada');
      return;
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

    console.log(`   ${Object.keys(issuesByProject).length} projetos`);

    // Processar cada projeto
    const allComments = [];
    const allHistory = [];
    let totalProcessed = 0;

    for (const [projectId, issueIds] of Object.entries(issuesByProject)) {
      console.log(`\n📝 Projeto ${projectId}: ${issueIds.length} issues...`);

      const batches = chunk(issueIds, CONFIG.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`   Batch ${i + 1}/${batches.length} (${batch.length} issues)...`);

        try {
          const results = await processBatch(projectId, batch);

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

          totalProcessed += batch.length;

          // Progress log a cada 500 issues
          if (totalProcessed % 500 === 0) {
            console.log(`   ⏱️ Progresso: ${totalProcessed}/${rows.length} issues (${allComments.length} comentários, ${allHistory.length} históricos)`);
          }

        } catch (err) {
          console.error(`   ❌ Erro no batch: ${err.message}`);
        }

        // Rate limiting entre batches
        if (i < batches.length - 1) {
          await sleep(500);
        }
      }

      // Rate limiting entre projetos
      await sleep(200);
    }

    console.log(`\n✅ Processamento concluído: ${totalProcessed} issues`);
    console.log(`   Comentários: ${allComments.length}`);
    console.log(`   Históricos: ${allHistory.length}`);

    // Inserir no BigQuery
    console.log('\n📥 Inserindo dados no BigQuery...');

    const table = bigquery
      .dataset(CONFIG.bigquery.dataset)
      .table('issue_comments_and_historic');

    // Truncar tabela
    try {
      const [exists] = await table.exists();
      if (exists) {
        await bigquery.query({
          query: `TRUNCATE TABLE \`${CONFIG.bigquery.projectId}.${CONFIG.bigquery.dataset}.issue_comments_and_historic\``,
          location: CONFIG.bigquery.location,
        });
        console.log('   Tabela truncada');
      }
    } catch (err) {
      console.warn(`   ⚠️ Erro ao truncar: ${err.message}`);
    }

    // Combinar dados
    const allData = [
      ...allComments.map(c => ({ ...c, type: 'comment' })),
      ...allHistory.map(h => ({ ...h, type: 'history' })),
    ];

    // Inserir em batches
    const batchSize = 1000;
    let totalInserted = 0;

    for (let i = 0; i < allData.length; i += batchSize) {
      const batch = allData.slice(i, i + batchSize);

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

    console.log(`   ✅ ${totalInserted} linhas inseridas`);

    // Resultado
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log('\n✅ Sincronização de comentários concluída!');
    console.log(`   Duração: ${duration} minutos`);
    console.log(`   Comentários: ${allComments.length}`);
    console.log(`   Históricos: ${allHistory.length}`);

    // Notificar sucesso
    await sendDiscordNotification(
      `**Sincronização de comentários concluída**\n` +
      `• Comentários: ${allComments.length}\n` +
      `• Históricos: ${allHistory.length}\n` +
      `• Issues processadas: ${totalProcessed}\n` +
      `• Duração: ${duration} minutos`,
      false
    );

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.error('\n❌ Erro na sincronização:', error.message);
    console.error(error.stack);

    // Notificar erro
    await sendDiscordNotification(
      `**Erro na sincronização de comentários**\n\n` +
      `\`\`\`\n${error.message}\n\`\`\`\n\n` +
      `Duração: ${duration} minutos\n` +
      `Run ID: ${runId}`,
      true
    );

    process.exit(1);
  }
}

// Executar
main();

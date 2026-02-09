/**
 * Cliente GraphQL para API do Construflow
 *
 * Implementa autenticação com tokens flutuantes (access + refresh)
 * e queries otimizadas por projeto.
 */

// Cache de tokens
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
};

const GRAPHQL_URL = 'https://api.construflow.com.br/graphql';

/**
 * Executa login e obtém tokens
 */
async function login(username, password) {
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
      variables: { username, password },
    }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Login falhou: ${JSON.stringify(data.errors)}`);
  }

  if (!data.data?.signIn?.accessToken) {
    throw new Error('Login falhou: tokens não retornados');
  }

  tokenCache = {
    accessToken: data.data.signIn.accessToken,
    refreshToken: data.data.signIn.refreshToken,
    expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutos (margem de segurança)
  };

  console.log('✅ Login realizado com sucesso');
  return tokenCache.accessToken;
}

/**
 * Renova o token usando refresh token
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
    // Refresh falhou, precisa fazer login novamente
    console.warn('⚠️ Refresh token expirado, será necessário novo login');
    tokenCache = { accessToken: null, refreshToken: null, expiresAt: null };
    return null;
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
 * Obtém token válido (login, refresh ou cache)
 */
async function getValidToken(config) {
  // Token em cache e válido
  if (tokenCache.accessToken && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  // Tentar refresh
  if (tokenCache.refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) return newToken;
  }

  // Fazer login
  return await login(config.username, config.password);
}

/**
 * Executa uma query GraphQL com autenticação
 */
async function executeQuery(query, variables, config, retries = 3) {
  const token = await getValidToken(config);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-API-Key': config.apiKey,
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
        const newToken = await getValidToken(config);

        // Refazer requisição
        const retryResponse = await fetch(GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newToken}`,
            'X-API-Key': config.apiKey,
          },
          body: JSON.stringify({ query, variables }),
        });

        return await retryResponse.json();
      }

      return data;
    } catch (error) {
      if (attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Tentativa ${attempt}/${retries} falhou, aguardando ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Busca issues de um projeto com paginação
 */
async function fetchProjectIssues(projectId, config) {
  console.log(`📊 Buscando issues do projeto ${projectId} via GraphQL...`);

  const query = `
    query GetProjectIssues($projectId: Int!, $first: Int, $after: String) {
      project(projectId: $projectId) {
        id
        name
        issues(first: $first, after: $after, filter: { standard: "all" }) {
          issues {
            id
            guid
            code
            title
            description
            status
            priority
            createdAt
            updatedAt
            deadline
            createdByUserId
            statusUpdatedByUserId
            statusUpdatedAt
            creationPhase
            resolutionPhase
            visibility
            editedAt
            disciplines {
              discipline {
                id
                name
              }
              status
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const allIssues = [];
  let hasNextPage = true;
  let afterCursor = null;
  let pageCount = 0;

  while (hasNextPage) {
    pageCount++;
    console.log(`   Página ${pageCount}...`);

    const result = await executeQuery(query, {
      projectId: parseInt(projectId),
      first: 100,
      after: afterCursor,
    }, config);

    if (result.errors) {
      console.error(`❌ Erro na query: ${JSON.stringify(result.errors)}`);
      break;
    }

    const issues = result.data?.project?.issues?.issues || [];
    allIssues.push(...issues.map(issue => ({
      ...issue,
      projectId: projectId,
    })));

    hasNextPage = result.data?.project?.issues?.pageInfo?.hasNextPage || false;
    afterCursor = result.data?.project?.issues?.pageInfo?.endCursor;

    // Rate limiting
    await sleep(100);
  }

  console.log(`   ✅ ${allIssues.length} issues encontradas`);
  return allIssues;
}

/**
 * Busca comentários e histórico de uma issue
 */
async function fetchIssueCommentsAndHistory(projectId, issueId, config) {
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
  }, config);

  if (result.errors) {
    console.warn(`⚠️ Erro ao buscar comentários da issue ${issueId}: ${JSON.stringify(result.errors)}`);
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
 * Busca comentários de múltiplas issues em paralelo
 */
async function fetchCommentsInParallel(projectId, issueIds, config, batchSize = 10) {
  console.log(`📝 Buscando comentários de ${issueIds.length} issues em paralelo (batch=${batchSize})...`);

  const allResults = [];
  const batches = chunk(issueIds, batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`   Batch ${i + 1}/${batches.length} (${batch.length} issues)...`);

    const results = await Promise.all(
      batch.map(issueId => fetchIssueCommentsAndHistory(projectId, issueId, config))
    );

    allResults.push(...results);

    // Rate limiting entre batches
    if (i < batches.length - 1) {
      await sleep(500);
    }
  }

  console.log(`   ✅ ${allResults.length} issues processadas`);
  return allResults;
}

/**
 * Busca lista de projetos via REST API
 * (GraphQL não tem query para listar todos os projetos)
 */
async function fetchProjects(config) {
  console.log('📋 Buscando lista de projetos via REST API...');

  const REST_BASE_URL = 'https://api.construflow.com.br/data-lake';

  const url = new URL(`${REST_BASE_URL}/projects`);
  url.searchParams.set('templateVersion', '9.0.0');
  url.searchParams.set('connectorVersion', '3.0.0');
  url.searchParams.set('page[size]', '1000');
  url.searchParams.set('page[after]', '0');
  url.searchParams.set('page[include_header]', 'true');

  const credentials = btoa(`${config.restApiKey || '42db7253b0d7a787be1aad461edf8df7'}:${config.restApiSecret || '96095ce389032b6422629336678735de2a1143fdb3ef3da530d4e2d98f541d92'}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar projetos: HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawData = data.data || [];

  if (rawData.length < 2) {
    console.log('   ⚠️ Nenhum projeto encontrado');
    return [];
  }

  // Formato: primeira row é header (objetos onde key=value), depois dados reais
  // Ex: {"id":"id","name":"name"}, {"id":123,"name":"Projeto X"}
  const projects = rawData.slice(1); // Pular header row

  console.log(`   ✅ ${projects.length} projetos encontrados`);
  return projects;
}

// Helper para base64 encoding
function btoa(str) {
  return Buffer.from(str).toString('base64');
}

// Helpers
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Exports
export {
  login,
  getValidToken,
  executeQuery,
  fetchProjects,
  fetchProjectIssues,
  fetchIssueCommentsAndHistory,
  fetchCommentsInParallel,
};

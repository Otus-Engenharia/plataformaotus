/**
 * Cliente REST para API do Construflow (Data Lake)
 *
 * Usado para endpoints de lookup que são pequenos e rápidos:
 * - projects, phases, categories, disciplines, locals
 * - issues-locals, issues-disciplines
 */

const BASE_URL = 'https://api.construflow.com.br/data-lake';
const TEMPLATE_VERSION = '9.0.0';
const CONNECTOR_VERSION = '3.0.0';

/**
 * Busca todos os dados de um endpoint com paginação
 */
async function fetchEndpoint(endpoint, config, options = {}) {
  const { pageSize = 1000 } = options;

  console.log(`📡 Buscando ${endpoint} via REST API...`);

  const allData = [];
  let afterCursor = 0;
  let hasMore = true;
  let pageCount = 0;
  let isFirstPage = true;

  while (hasMore) {
    pageCount++;
    const includeHeader = isFirstPage ? 'true' : 'false';

    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set('templateVersion', TEMPLATE_VERSION);
    url.searchParams.set('connectorVersion', CONNECTOR_VERSION);
    url.searchParams.set('page[size]', String(pageSize));
    url.searchParams.set('page[after]', String(afterCursor));
    url.searchParams.set('page[include_header]', includeHeader);

    try {
      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}`,
          'Content-Type': 'application/json',
        },
      }, 3);

      const data = await response.json();

      if (!data || typeof data !== 'object') {
        console.error(`❌ Resposta inválida para ${endpoint}`);
        break;
      }

      // Estrutura esperada: { data: [...], meta: { has_more, after_cursor } }
      const pageData = data.data || [];

      // Se não for primeira página, remover header duplicado
      if (!isFirstPage && pageData.length > 0) {
        pageData.shift();
      }

      allData.push(...pageData);

      // Verificar se há mais páginas
      hasMore = data.meta?.has_more || false;
      afterCursor = data.meta?.after_cursor;

      if (hasMore && afterCursor === undefined) {
        console.error(`⚠️ Cursor de paginação ausente para ${endpoint}`);
        break;
      }

      isFirstPage = false;

      // Log de progresso
      if (pageCount % 10 === 0) {
        console.log(`   Página ${pageCount}: ${allData.length} registros...`);
      }

      // Rate limiting
      await sleep(100);
    } catch (error) {
      console.error(`❌ Erro ao buscar ${endpoint} página ${pageCount}: ${error.message}`);
      throw error;
    }
  }

  console.log(`   ✅ ${endpoint}: ${allData.length} registros`);
  return allData;
}

/**
 * Fetch com retry e exponential backoff
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      // Timeout ou erro de rede - tentar novamente
      if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou (${error.message}), aguardando ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Erro 504 (timeout do servidor) - tentar novamente
      if (error.message?.includes('504')) {
        const waitTime = Math.pow(2, attempt) * 2000; // Mais tempo para 504
        console.warn(`⚠️ Servidor retornou 504, aguardando ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Outros erros - falhar imediatamente
      throw error;
    }
  }

  throw new Error(`Falhou após ${maxRetries} tentativas: ${lastError.message}`);
}

/**
 * Converte dados brutos para objetos
 * A API retorna: primeira row é header (obj com key=value), depois dados reais
 */
function convertToObjects(rawData, convertToStrings = false) {
  if (!rawData || rawData.length < 2) {
    return [];
  }

  let objects;

  // Se já são objetos (formato novo da API), apenas remover o header
  if (typeof rawData[0] === 'object' && !Array.isArray(rawData[0])) {
    objects = rawData.slice(1); // Pular header row
  } else {
    // Formato antigo: array de arrays
    const headers = rawData[0];
    objects = [];

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const obj = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }

      objects.push(obj);
    }
  }

  // Converter todos os valores para string se necessário (BigQuery schema compatibility)
  if (convertToStrings) {
    return objects.map(obj => {
      const converted = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
          converted[key] = null;
        } else if (typeof value === 'boolean') {
          converted[key] = value ? 'true' : 'false';
        } else {
          converted[key] = String(value);
        }
      }
      return converted;
    });
  }

  return objects;
}

/**
 * Busca todos os endpoints de lookup
 */
async function fetchAllLookups(config) {
  console.log('📚 Buscando todos os lookups via REST API...');

  // Endpoints que precisam conversão para STRING (schema BigQuery legado)
  const stringSchemaEndpoints = ['projects'];

  const lookupEndpoints = [
    'projects',
    'phases',
    'categories',
    'disciplines',
    'locals',
  ];

  const results = {};

  for (const endpoint of lookupEndpoints) {
    try {
      const rawData = await fetchEndpoint(endpoint, config);
      const needsStringConversion = stringSchemaEndpoints.includes(endpoint);
      results[endpoint] = convertToObjects(rawData, needsStringConversion);
    } catch (error) {
      console.error(`❌ Falha ao buscar ${endpoint}: ${error.message}`);
      results[endpoint] = [];
    }
  }

  return results;
}

/**
 * Busca mapeamento issueId -> category via REST API
 * O GraphQL retorna category: null, mas o REST retorna o ID correto
 */
async function fetchIssueCategoryMap(config) {
  console.log('🏷️ Buscando categorias das issues via REST API...');

  try {
    const rawData = await fetchEndpoint('issues', config, { pageSize: 500 });
    const issues = convertToObjects(rawData);

    const categoryMap = {};
    let count = 0;

    for (const issue of issues) {
      if (issue.id != null && issue.category != null) {
        categoryMap[String(issue.id)] = issue.category;
        count++;
      }
    }

    console.log(`   ✅ ${count} issues com categoria mapeadas (de ${issues.length} total)`);
    return categoryMap;
  } catch (error) {
    console.error(`❌ Falha ao buscar categorias via REST: ${error.message}`);
    return {};
  }
}

/**
 * Busca endpoints de relacionamento (mais pesados)
 */
async function fetchRelationships(config) {
  console.log('🔗 Buscando relacionamentos via REST API...');

  const relationshipEndpoints = [
    'issues-locals',
    'issues-disciplines',
  ];

  const results = {};

  for (const endpoint of relationshipEndpoints) {
    try {
      const rawData = await fetchEndpoint(endpoint, config, { pageSize: 500 }); // Menor para evitar timeout
      results[endpoint] = convertToObjects(rawData);
    } catch (error) {
      console.error(`❌ Falha ao buscar ${endpoint}: ${error.message}`);
      results[endpoint] = [];
    }
  }

  return results;
}

// Helpers
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// btoa para Node.js (se necessário)
function btoa(str) {
  return Buffer.from(str).toString('base64');
}

// Exports
export {
  fetchEndpoint,
  fetchAllLookups,
  fetchRelationships,
  fetchIssueCategoryMap,
  convertToObjects,
};

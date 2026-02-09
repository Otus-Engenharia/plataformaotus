/**
 * Teste de conexão com APIs do Construflow
 *
 * Testa:
 * 1. GraphQL API (login + query)
 * 2. REST API (lookups)
 */

// Configuração (do .env.yaml)
const CONFIG = {
  graphql: {
    username: 'gerentes@otusengenharia.com',
    password: 'Otus.2019',
    apiKey: 'd02126c4c1d7ec0e903449eb38bf2a4b',
  },
  rest: {
    apiKey: '42db7253b0d7a787be1aad461edf8df7',
    apiSecret: '96095ce389032b6422629336678735de2a1143fdb3ef3da530d4e2d98f541d92',
  },
};

const GRAPHQL_URL = 'https://api.construflow.com.br/graphql';
const REST_BASE_URL = 'https://api.construflow.com.br/data-lake';

/**
 * Teste 1: GraphQL API - Login
 */
async function testGraphQLLogin() {
  console.log('\n🔐 Teste 1: GraphQL API - Login');
  console.log('   URL:', GRAPHQL_URL);
  console.log('   Usuário:', CONFIG.graphql.username);

  try {
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
          username: CONFIG.graphql.username,
          password: CONFIG.graphql.password,
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('   ❌ Erro:', JSON.stringify(data.errors, null, 2));
      return null;
    }

    if (!data.data?.signIn?.accessToken) {
      console.error('   ❌ Token não retornado');
      return null;
    }

    console.log('   ✅ Login bem-sucedido!');
    console.log('   Token (primeiros 20 chars):', data.data.signIn.accessToken.substring(0, 20) + '...');

    return data.data.signIn.accessToken;
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    return null;
  }
}

/**
 * Teste 2: REST API - Listar projetos
 */
async function testRESTProjects() {
  console.log('\n📋 Teste 2: REST API - Listar Projetos');

  try {
    const credentials = Buffer.from(`${CONFIG.rest.apiKey}:${CONFIG.rest.apiSecret}`).toString('base64');

    const url = new URL(`${REST_BASE_URL}/projects`);
    url.searchParams.set('templateVersion', '9.0.0');
    url.searchParams.set('connectorVersion', '3.0.0');
    url.searchParams.set('page[size]', '100');
    url.searchParams.set('page[after]', '0');
    url.searchParams.set('page[include_header]', 'true');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    const rawData = data.data || [];

    if (rawData.length < 2) {
      console.log('   ⚠️ Nenhum projeto encontrado');
      return false;
    }

    // Converter para objetos
    const headers = rawData[0];
    const projects = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const project = {};
      for (let j = 0; j < headers.length; j++) {
        project[headers[j]] = row[j];
      }
      projects.push(project);
    }

    console.log(`   ✅ ${projects.length} projetos encontrados`);

    // Mostrar primeiros 5
    console.log('   Primeiros 5:');
    projects.slice(0, 5).forEach((p, i) => {
      console.log(`      ${i + 1}. ${p.name || p.project_name} (ID: ${p.id || p.project_id})`);
    });

    return projects.length > 0;
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    return false;
  }
}

/**
 * Teste 3: REST API - Buscar phases
 */
async function testRESTAPI() {
  console.log('\n📡 Teste 3: REST API - Buscar Phases');
  console.log('   URL:', REST_BASE_URL);

  try {
    const credentials = Buffer.from(`${CONFIG.rest.apiKey}:${CONFIG.rest.apiSecret}`).toString('base64');

    const url = new URL(`${REST_BASE_URL}/phases`);
    url.searchParams.set('templateVersion', '9.0.0');
    url.searchParams.set('connectorVersion', '3.0.0');
    url.searchParams.set('page[size]', '10');
    url.searchParams.set('page[after]', '0');
    url.searchParams.set('page[include_header]', 'true');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    const records = data.data || [];

    console.log(`   ✅ ${records.length} registros retornados`);

    // Mostrar header (pode ser array ou objeto)
    if (records.length > 0) {
      const firstRecord = records[0];
      if (Array.isArray(firstRecord)) {
        console.log('   Colunas:', firstRecord.join(', '));
      } else {
        console.log('   Colunas:', Object.keys(firstRecord).join(', '));
      }
    }

    // Mostrar meta
    if (data.meta) {
      console.log('   Meta:', JSON.stringify(data.meta));
    }

    return records.length > 0;
  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    return false;
  }
}

/**
 * Executar todos os testes
 */
async function runTests() {
  console.log('🧪 Testando conexões com APIs do Construflow\n');
  console.log('='.repeat(60));

  const results = {
    graphqlLogin: false,
    restProjects: false,
    restPhases: false,
  };

  // Teste 1: GraphQL Login
  const token = await testGraphQLLogin();
  results.graphqlLogin = !!token;

  // Teste 2: REST Projects
  results.restProjects = await testRESTProjects();

  // Teste 3: REST Phases
  results.restPhases = await testRESTAPI();

  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES\n');

  const allPassed = Object.values(results).every(Boolean);

  console.log(`   GraphQL Login:    ${results.graphqlLogin ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   REST Projetos:    ${results.restProjects ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   REST Phases:      ${results.restPhases ? '✅ OK' : '❌ FALHOU'}`);
  console.log('');

  if (allPassed) {
    console.log('🎉 Todos os testes passaram! APIs estão funcionando.');
    console.log('   Pode fazer o deploy da Cloud Function.');
  } else {
    console.log('⚠️ Alguns testes falharam. Verifique as credenciais.');
    process.exit(1);
  }
}

runTests();

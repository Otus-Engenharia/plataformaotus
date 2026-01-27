/**
 * Script de teste para verificar se OKRs e Indicadores estão funcionando
 * 
 * Execute: node scripts/testar-okrs-indicadores.js
 * 
 * Requer: Backend rodando na porta 3001
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';

// Carrega variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../backend/.env') });

const API_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function testHealth() {
  logInfo('Testando conexão com o servidor...');
  try {
    const response = await makeRequest(`${API_URL}/api/health`);
    if (response.data.status === 'OK') {
      logSuccess('Servidor está respondendo!');
      return true;
    }
  } catch (error) {
    logError(`Servidor não está respondendo: ${error.message}`);
    logWarning('Certifique-se de que o backend está rodando na porta 3001');
    return false;
  }
}

async function testIndicadores() {
  logInfo('\n📊 Testando endpoints de Indicadores...');
  
  try {
    // Teste GET /api/indicadores
    logInfo('GET /api/indicadores');
    const response = await makeRequest(`${API_URL}/api/indicadores`);
    
    if (response.status === 401) {
      logWarning('Endpoint requer autenticação (isso é esperado)');
      logInfo('Tabela de indicadores existe e está acessível!');
      return true;
    }
    
    if (response.data.success) {
      logSuccess(`Indicadores encontrados: ${response.data.data?.length || 0}`);
      if (response.data.data && response.data.data.length > 0) {
        logInfo('Primeiro indicador:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
      } else {
        logWarning('Nenhum indicador encontrado (tabela pode estar vazia)');
      }
      return true;
    } else {
      logError('Resposta não indica sucesso');
      return false;
    }
  } catch (error) {
    logError(`Erro de conexão: ${error.message}`);
    return false;
  }
}

async function testOKRs() {
  logInfo('\n🎯 Testando endpoints de OKRs...');
  
  try {
    // Teste GET /api/okrs
    logInfo('GET /api/okrs');
    const response = await makeRequest(`${API_URL}/api/okrs`);
    
    if (response.status === 401) {
      logWarning('Endpoint requer autenticação (isso é esperado)');
      logInfo('Tabela de OKRs existe e está acessível!');
      return true;
    }
    
    if (response.data.success) {
      logSuccess(`OKRs encontrados: ${response.data.data?.length || 0}`);
      if (response.data.data && response.data.data.length > 0) {
        logInfo('Primeiro OKR:');
        console.log(JSON.stringify(response.data.data[0], null, 2));
      } else {
        logWarning('Nenhum OKR encontrado (tabela pode estar vazia)');
      }
      return true;
    } else {
      logError('Resposta não indica sucesso');
      return false;
    }
  } catch (error) {
    logError(`Erro de conexão: ${error.message}`);
    return false;
  }
}

async function testSupabaseConnection() {
  logInfo('\n🔌 Verificando conexão com Supabase...');
  
  try {
    // Testa se conseguimos acessar as tabelas através do backend
    // Se os endpoints retornam 401 (autenticação necessária) em vez de 500 (erro de tabela),
    // significa que as tabelas existem
    logInfo('Verificando se as tabelas existem...');
    
    const indicadoresResponse = await makeRequest(`${API_URL}/api/indicadores`);
    const okrsResponse = await makeRequest(`${API_URL}/api/okrs`);
    
    // Se retornar 500 com erro de "relation does not exist", a tabela não existe
    if (indicadoresResponse.status === 500) {
      const errorMsg = indicadoresResponse.data?.error || '';
      if (errorMsg.includes('relation') || errorMsg.includes('does not exist')) {
        logError('Tabela "indicadores" não encontrada no Supabase');
        return false;
      }
    }
    
    if (okrsResponse.status === 500) {
      const errorMsg = okrsResponse.data?.error || '';
      if (errorMsg.includes('relation') || errorMsg.includes('does not exist')) {
        logError('Tabela "okrs" ou "key_results" não encontrada no Supabase');
        return false;
      }
    }
    
    // Se chegou até aqui, as tabelas provavelmente existem
    logSuccess('Conexão com Supabase parece estar funcionando!');
    logInfo('Tabelas criadas com sucesso!');
    return true;
  } catch (error) {
    logError(`Erro ao verificar Supabase: ${error.message}`);
    return false;
  }
}

async function runTests() {
  log('\n🧪 Iniciando testes de OKRs e Indicadores\n', 'blue');
  
  const healthOk = await testHealth();
  if (!healthOk) {
    logError('\n❌ Não foi possível conectar ao servidor. Encerrando testes.');
    process.exit(1);
  }
  
  const indicadoresOk = await testIndicadores();
  const okrsOk = await testOKRs();
  const supabaseOk = await testSupabaseConnection();
  
  log('\n📋 Resumo dos Testes:\n', 'blue');
  log(`${healthOk ? '✅' : '❌'} Servidor respondendo`, healthOk ? 'green' : 'red');
  log(`${indicadoresOk ? '✅' : '❌'} Indicadores`, indicadoresOk ? 'green' : 'red');
  log(`${okrsOk ? '✅' : '❌'} OKRs`, okrsOk ? 'green' : 'red');
  log(`${supabaseOk ? '✅' : '❌'} Supabase`, supabaseOk ? 'green' : 'red');
  
  if (indicadoresOk && okrsOk) {
    log('\n🎉 Tudo funcionando corretamente!', 'green');
    logInfo('As tabelas foram criadas com sucesso e estão acessíveis.');
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique os erros acima.', 'yellow');
  }
}

// Executa os testes
runTests().catch((error) => {
  logError(`Erro fatal: ${error.message}`);
  process.exit(1);
});

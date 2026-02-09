/**
 * Teste de conexão com SmartSheet
 */

import smartsheet from 'smartsheet';

// Token do SmartSheet (sem "Bearer ")
const TOKEN = '6CXGlXkt7CO6qDgn94i0zibhlapuLET0vjNfL';

async function testConnection() {
  console.log('🔍 Testando conexão com SmartSheet...\n');

  const client = smartsheet.createClient({
    accessToken: TOKEN,
    logLevel: 'info',
  });

  try {
    // Teste 1: Obter informações do usuário
    console.log('1️⃣ Verificando autenticação...');
    const user = await client.users.getCurrentUser();
    console.log(`   ✅ Autenticado como: ${user.email}`);
    console.log(`   Nome: ${user.firstName} ${user.lastName}\n`);

    // Teste 2: Listar planilhas
    console.log('2️⃣ Listando planilhas...');
    const sheets = await client.sheets.listSheets({ includeAll: true });
    console.log(`   ✅ Encontradas ${sheets.data.length} planilhas\n`);

    // Mostrar primeiras 10 planilhas
    console.log('📋 Primeiras 10 planilhas:');
    sheets.data.slice(0, 10).forEach((sheet, i) => {
      console.log(`   ${i + 1}. ${sheet.name} (ID: ${sheet.id})`);
    });

    console.log('\n✅ Conexão com SmartSheet funcionando corretamente!');

  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);

    if (error.statusCode === 401) {
      console.error('\n⚠️ Token inválido ou expirado.');
      console.error('Gere um novo token em: https://app.smartsheet.com/b/home → Conta → API');
    }

    process.exit(1);
  }
}

testConnection();

# 📚 Guia Passo a Passo - Configuração do Projeto

Este guia vai te ajudar a configurar e executar o projeto do zero.

## 📋 Pré-requisitos

Antes de começar, você precisa ter instalado:
- **Node.js** (versão 16 ou superior) - [Download aqui](https://nodejs.org/)
- **npm** (vem com o Node.js)
- **Conta Google Cloud** com acesso ao BigQuery
- **Arquivo JSON de credenciais** do Service Account do Google Cloud

---

## 🚀 Passo 1: Instalar Dependências do Backend

Abra um terminal na pasta do projeto e execute:

```bash
cd backend
npm install
```

Isso vai instalar:
- Express (servidor web)
- @google-cloud/bigquery (cliente BigQuery)
- cors (permitir requisições do frontend)
- dotenv (gerenciar variáveis de ambiente)

**O que acontece aqui?**
O npm lê o arquivo `package.json` e baixa todas as bibliotecas necessárias na pasta `node_modules/`.

---

## 🎨 Passo 2: Instalar Dependências do Frontend

Abra outro terminal (ou feche o anterior) e execute:

```bash
cd frontend
npm install
```

Isso vai instalar:
- React (biblioteca para criar interfaces)
- Vite (ferramenta de build rápida)
- Chart.js (gráficos)
- Axios (fazer requisições HTTP)

---

## 🔐 Passo 3: Configurar Credenciais do BigQuery

### 3.1. Obter o arquivo JSON de credenciais

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **IAM & Admin** > **Service Accounts**
3. Crie uma nova Service Account ou use uma existente
4. Crie uma **chave JSON** e baixe o arquivo

### 3.2. Colocar o arquivo no projeto

1. Copie o arquivo JSON baixado para a pasta `backend/`
2. Renomeie para `service-account-key.json`

**⚠️ IMPORTANTE:** Este arquivo contém credenciais sensíveis. Nunca faça commit dele no Git!

---

## ⚙️ Passo 4: Configurar Variáveis de Ambiente

### 4.1. Criar arquivo .env

Na pasta `backend/`, crie um arquivo chamado `.env` (sem extensão).

### 4.2. Preencher com suas informações

Abra o arquivo `.env` e preencha:

```env
# Caminho para o arquivo JSON de credenciais
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# ID do seu projeto no Google Cloud
# Encontre em: Google Cloud Console > Dashboard
BIGQUERY_PROJECT_ID=seu-project-id-aqui

# Nome do dataset no BigQuery
# Exemplo: meu_dataset
BIGQUERY_DATASET=seu-dataset-aqui

# Porta do servidor (opcional)
PORT=3001
```

**Como encontrar o Project ID:**
- No Google Cloud Console, o Project ID aparece no topo da página
- Ou vá em **IAM & Admin** > **Settings**

**Como encontrar o Dataset:**
- No BigQuery Console, veja a lista de datasets no painel esquerdo
- O nome do dataset é o que você criou ou que já existe

---

## 📝 Passo 5: Ajustar as Queries SQL

### 5.1. Abrir o arquivo bigquery.js

Abra o arquivo `backend/bigquery.js` no editor.

### 5.2. Ajustar a query do Portfólio

Encontre a função `queryPortfolio()` e ajuste a query SQL conforme sua tabela:

```javascript
export async function queryPortfolio() {
  const query = `
    SELECT 
      projeto_id,           -- Ajuste os nomes das colunas
      nome_projeto,         -- conforme sua tabela real
      status,
      data_inicio,
      data_fim,
      orcamento,
      custo_atual,
      progresso_percentual
    FROM \`${projectId}.${datasetId}.nome_da_sua_tabela\`
    ORDER BY data_inicio DESC
    LIMIT 100
  `;
  return await executeQuery(query);
}
```

**Dicas:**
- Substitua `nome_da_sua_tabela` pelo nome real da sua tabela
- Ajuste os nomes das colunas conforme sua estrutura
- Teste a query primeiro no BigQuery Console

### 5.3. Ajustar a query da Curva S

Encontre a função `queryCurvaS()` e ajuste:

```javascript
export async function queryCurvaS() {
  const query = `
    SELECT 
      data_referencia,      -- Ajuste conforme sua tabela
      projeto_id,
      nome_projeto,
      progresso_planejado,
      progresso_real,
      custo_planejado,
      custo_real
    FROM \`${projectId}.${datasetId}.nome_da_tabela_curva_s\`
    ORDER BY data_referencia ASC
  `;
  return await executeQuery(query);
}
```

---

## 🏃 Passo 6: Executar o Backend

No terminal, na pasta `backend/`, execute:

```bash
npm start
```

Você deve ver:
```
🚀 Servidor rodando na porta 3001
📍 Health check: http://localhost:3001/api/health
📊 Portfolio API: http://localhost:3001/api/portfolio
📈 Curva S API: http://localhost:3001/api/curva-s
```

**Teste se está funcionando:**
Abra o navegador em: http://localhost:3001/api/health

Deve aparecer: `{"status":"OK","message":"Servidor funcionando!"}`

---

## 🎨 Passo 7: Executar o Frontend

Abra um **novo terminal** (mantenha o backend rodando) e execute:

```bash
cd frontend
npm run dev
```

Você deve ver:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network:  use --host to expose
```

---

## 🌐 Passo 8: Acessar a Aplicação

Abra o navegador em: **http://localhost:5173**

Você deve ver:
- Barra de navegação no topo
- Botões para "Portfólio" e "Curva S"
- A página do Portfólio carregando

---

## 🔍 Passo 9: Verificar se os Dados Estão Carregando

### 9.1. Testar a API do Portfólio

No navegador, acesse: http://localhost:3001/api/portfolio

**Se funcionar:** Você verá um JSON com os dados.

**Se der erro:** 
- Verifique se o arquivo `.env` está correto
- Verifique se o arquivo `service-account-key.json` existe
- Verifique se a query SQL está correta
- Veja os logs no terminal do backend

### 9.2. Testar a API da Curva S

Acesse: http://localhost:3001/api/curva-s

---

## 🐛 Solução de Problemas Comuns

### Erro: "Cannot find module"
**Solução:** Execute `npm install` novamente na pasta correspondente.

### Erro: "Permission denied" ou "Authentication error"
**Solução:** 
- Verifique se o arquivo JSON de credenciais está correto
- Verifique se a Service Account tem permissão no BigQuery
- No Google Cloud Console, vá em **IAM & Admin** > **Service Accounts** e verifique as permissões

### Erro: "Table not found"
**Solução:**
- Verifique o nome da tabela na query SQL
- Verifique se o dataset está correto no `.env`
- Teste a query diretamente no BigQuery Console

### Erro: "CORS policy"
**Solução:** O backend já está configurado com CORS. Se ainda der erro, verifique se o backend está rodando na porta 3001.

### Frontend não carrega dados
**Solução:**
- Verifique se o backend está rodando
- Abra o Console do navegador (F12) e veja os erros
- Verifique se a URL da API está correta no código

---

## 📚 Próximos Passos

Agora que o projeto está funcionando, você pode:

1. **Personalizar as queries** conforme seus dados reais
2. **Ajustar os gráficos** para mostrar mais informações
3. **Adicionar filtros** e funcionalidades extras
4. **Melhorar o design** dos componentes

---

## 💡 Dicas Importantes

1. **Nunca faça commit** do arquivo `service-account-key.json` no Git
2. **Nunca faça commit** do arquivo `.env` no Git
3. **Teste as queries** primeiro no BigQuery Console antes de colocar no código
4. **Mantenha o backend rodando** enquanto desenvolve o frontend
5. **Use o Console do navegador** (F12) para debugar erros

---

## 🎓 Entendendo a Estrutura

```
relatorio/
├── backend/              # Servidor Node.js
│   ├── server.js         # Cria as rotas da API
│   ├── bigquery.js      # Conecta e busca dados do BigQuery
│   └── package.json     # Lista de dependências
│
├── frontend/             # Aplicação React
│   ├── src/
│   │   ├── App.jsx      # Componente principal com rotas
│   │   ├── components/  # Componentes de visualização
│   │   └── styles/     # Arquivos CSS
│   └── package.json    # Lista de dependências
│
└── README.md            # Documentação geral
```

**Fluxo de dados:**
1. Frontend faz requisição → `http://localhost:3001/api/portfolio`
2. Backend recebe → `server.js` chama `queryPortfolio()`
3. BigQuery executa → `bigquery.js` envia query SQL
4. Dados retornam → Backend envia JSON para Frontend
5. Frontend exibe → React renderiza gráficos e tabelas

---

**Pronto! Agora você tem um sistema completo funcionando! 🎉**

Se tiver dúvidas, verifique os comentários no código - eles explicam o que cada parte faz.

# Guia de Configuração de Autenticação

Este guia explica como configurar o sistema de autenticação Google OAuth para a aplicação de Indicadores do Setor de Projeto.

## 📋 Pré-requisitos

1. Conta Google Workspace da Otus Engenharia
2. Acesso ao Google Cloud Console
3. Permissões para criar credenciais OAuth

## 🔧 Passo 1: Criar Credenciais OAuth no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione o projeto (ou crie um novo)
3. Vá em **APIs & Services** → **Credentials**
4. Clique em **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Se for a primeira vez, configure a **OAuth consent screen**:
   - Escolha **Internal** (para usuários da organização)
   - Preencha as informações básicas
   - Adicione os escopos: `profile` e `email`
6. Crie o OAuth Client ID:
   - **Application type**: Web application
   - **Name**: Indicadores Otus (ou outro nome)
   - **Authorized JavaScript origins**: 
     - `http://localhost:3001` (desenvolvimento)
     - `https://seu-dominio.com` (produção)
   - **Authorized redirect URIs**:
     - `http://localhost:3001/api/auth/google/callback` (desenvolvimento)
     - `https://seu-dominio.com/api/auth/google/callback` (produção)
7. Copie o **Client ID** e **Client Secret**

## 🔧 Passo 2: Configurar Variáveis de Ambiente

Edite o arquivo `backend/.env` e adicione:

```env
# Configurações de Autenticação Google OAuth
GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret-aqui
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# URL do frontend (para redirecionamentos)
FRONTEND_URL=http://localhost:5173

# Secret para sessões (use uma string aleatória e segura)
SESSION_SECRET=otus-engenharia-secret-key-change-in-production
```

**⚠️ IMPORTANTE**: Em produção, use um `SESSION_SECRET` forte e aleatório!

## 🔧 Passo 3: Configurar Usuários e Roles

Edite o arquivo `backend/auth-config.js` e adicione os emails dos usuários:

```javascript
export const USER_ROLES = {
  // Diretora - acesso total
  'diretora@otusengenharia.com': 'director',
  
  // Líderes - acesso apenas aos seus projetos
  'lider1@otusengenharia.com': 'leader',
  'lider2@otusengenharia.com': 'leader',
  // Adicione mais líderes conforme necessário
};
```

**Nota Importante**: A coluna `lider` no BigQuery contém **nomes** (ex: "Estevão Goulart"), não emails. O sistema usa um mapeamento em `auth-config.js` para converter o email do usuário no nome correspondente na coluna do BigQuery.

O mapeamento atual é:
- `estevao.goulart@otusengenharia.com` → `Estevão Goulart`
- `anna.bastos@otusengenharia.com` → `Anna Bastos`
- `alicia.paim@otusengenharia.com` → `Alicia Paim`

Certifique-se de que os nomes na coluna `lider` do BigQuery correspondem exatamente aos nomes mapeados em `EMAIL_TO_LEADER_NAME`.

## 🔧 Passo 4: Verificar Coluna `lider` no BigQuery

O sistema filtra projetos por líder usando a coluna `lider` da tabela. **IMPORTANTE**: A coluna `lider` contém **nomes**, não emails.

Verifique se:

1. A coluna `lider` existe na tabela `portifolio_plataforma_enriched`
2. Os valores na coluna `lider` são nomes (ex: "Estevão Goulart", "Anna Bastos", "Alicia Paim")
3. Os nomes correspondem exatamente ao mapeamento em `EMAIL_TO_LEADER_NAME` no arquivo `auth-config.js`
4. A comparação é case-insensitive (maiúsculas/minúsculas não importam)

## 🚀 Passo 5: Testar a Autenticação

1. Inicie o backend:
   ```bash
   cd backend
   npm start
   ```

2. Inicie o frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Acesse `http://localhost:5173`
4. Você será redirecionado para a página de login
5. Clique em "Entrar com Google"
6. Faça login com uma conta Google configurada no `auth-config.js`
7. Após o login, você será redirecionado para o portfólio

## 🔒 Como Funciona

### Diretora
- Acessa **todos** os projetos do portfólio
- Não há filtro aplicado na query do BigQuery

### Líder
- Acessa **apenas** os projetos onde é líder
- O sistema converte o email do usuário no nome correspondente usando `EMAIL_TO_LEADER_NAME`
- A query do BigQuery filtra por: `WHERE LOWER(lider) = LOWER('Nome do Líder')`

## 🛠️ Troubleshooting

### Erro: "Acesso negado"
- Verifique se o email está configurado em `auth-config.js`
- Certifique-se de que está usando o email correto do Google Account

### Líder não vê seus projetos
- Verifique se o nome na coluna `lider` do BigQuery corresponde ao mapeamento em `EMAIL_TO_LEADER_NAME`
- Verifique se o mapeamento está correto em `auth-config.js` (email → nome)
- A comparação é case-insensitive, mas os nomes devem corresponder exatamente (exceto maiúsculas/minúsculas)
- Exemplo: Se o BigQuery tem "Estevão Goulart", o mapeamento deve ser `'estevao.goulart@otusengenharia.com': 'Estevão Goulart'`

### Erro de CORS
- Verifique se `FRONTEND_URL` no `.env` está correto
- Certifique-se de que `credentials: true` está configurado no CORS

### Sessão expira muito rápido
- Ajuste `maxAge` em `server.js` (padrão: 24 horas)

## 📝 Notas Importantes

1. **Segurança**: Em produção, sempre use HTTPS
2. **Sessões**: O `SESSION_SECRET` deve ser único e seguro
3. **Emails**: Os emails devem ser exatos (case-insensitive)
4. **BigQuery**: A coluna `lider` contém **nomes**, não emails. Use o mapeamento `EMAIL_TO_LEADER_NAME` para fazer a correspondência
5. **Mapeamento**: Se adicionar novos líderes, atualize tanto `USER_ROLES` quanto `EMAIL_TO_LEADER_NAME` em `auth-config.js`

## 🔄 Adicionar Novo Usuário

1. Adicione o email em `backend/auth-config.js` com o role apropriado
2. Reinicie o servidor backend
3. O usuário poderá fazer login imediatamente

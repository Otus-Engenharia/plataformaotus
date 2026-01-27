# 🏗️ Plataforma Otus - Indicadores e Gestão de Projetos

Plataforma web para visualização e gestão de indicadores de projetos da Otus Engenharia, integrada com Google BigQuery e Supabase.

## 📋 Sobre o Projeto

A Plataforma Otus é uma aplicação full-stack que permite:

- 📊 **Visualização de Portfólio**: Acompanhamento de projetos com dados do BigQuery
- 📈 **Curva S**: Análise de progresso e custos dos projetos
- 👥 **Indicadores de Liderança**: Métricas por líder de projeto
- 💰 **Estudo de Custos**: Análise financeira detalhada
- ⏱️ **Apontamento de Horas**: Controle de horas trabalhadas
- 📅 **Cronograma**: Visualização e gestão de cronogramas
- 🎯 **CS (Customer Success)**: Indicadores do setor de sucesso do cliente
- 🤖 **Oracle Chat**: Assistente inteligente para consultas

## 🚀 Tecnologias

### Backend
- **Node.js** + **Express**
- **Google BigQuery** - Consultas de dados
- **Supabase** - Dados em tempo real
- **Passport.js** - Autenticação Google OAuth
- **Express Session** - Gerenciamento de sessões

### Frontend
- **React** + **Vite**
- **React Router** - Navegação
- **Chart.js** - Gráficos e visualizações
- **Axios** - Requisições HTTP

## 📁 Estrutura do Projeto

```
plataformaotus/
├── backend/              # Servidor Node.js/Express
│   ├── server.js         # Servidor principal e rotas
│   ├── bigquery.js       # Integração com BigQuery
│   ├── supabase.js       # Integração com Supabase
│   ├── auth.js           # Configuração de autenticação
│   ├── auth-config.js    # Configuração de usuários e roles
│   └── package.json      # Dependências do backend
│
├── frontend/             # Aplicação React
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── contexts/     # Contextos (Auth, Oracle)
│   │   └── styles/       # Arquivos CSS
│   └── package.json      # Dependências do frontend
│
└── docs/                 # Documentação
    ├── GUIA_PASSO_A_PASSO.md
    ├── GUIA_AUTENTICACAO.md
    ├── GUIA_COMPARTILHAR_APLICACAO.md
    └── CONFIGURACAO_PORTFOLIO.md
```

## ⚙️ Configuração Inicial

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn
- Conta Google Cloud com acesso ao BigQuery
- Credenciais do Service Account do Google Cloud
- Conta Supabase (opcional, para dados em tempo real)

### Instalação

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/otusengenharia/plataformaotus.git
   cd plataformaotus
   ```

2. **Instale as dependências do backend:**
   ```bash
   cd backend
   npm install
   ```

3. **Instale as dependências do frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Configure as variáveis de ambiente:**
   - Copie `backend/env.example` para `backend/.env`
   - Preencha com suas credenciais (veja [Guia Passo a Passo](./docs/GUIA_PASSO_A_PASSO.md))

5. **Configure as credenciais do Google Cloud:**
   - Baixe o arquivo JSON do Service Account
   - Coloque em `backend/service-account-key.json`

## 🏃 Executando o Projeto

### Desenvolvimento

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

A aplicação estará disponível em:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## 📚 Documentação

- **[Guia Passo a Passo](./docs/GUIA_PASSO_A_PASSO.md)** - Configuração completa do zero
- **[Guia de Autenticação](./docs/GUIA_AUTENTICACAO.md)** - Configuração do Google OAuth
- **[Guia de Compartilhamento](./docs/GUIA_COMPARTILHAR_APLICACAO.md)** - Como compartilhar a aplicação
- **[Configuração do Portfólio](./docs/CONFIGURACAO_PORTFOLIO.md)** - Ajustes específicos do portfólio

## 🔐 Autenticação

A aplicação usa Google OAuth 2.0 para autenticação. Os usuários são categorizados em:

- **Director**: Acesso total a todos os projetos
- **Leader**: Acesso apenas aos projetos onde é líder

Veja [Guia de Autenticação](./docs/GUIA_AUTENTICACAO.md) para configuração detalhada.

## 📊 Funcionalidades Principais

### Portfólio
Visualização completa do portfólio de projetos com filtros por líder, status e período.

### Curva S
Análise de progresso planejado vs. real, com visualizações gráficas.

### Indicadores de Liderança
Métricas específicas por líder de projeto.

### Estudo de Custos
Análise financeira detalhada dos projetos.

### Cronograma
Visualização e gestão de cronogramas de projetos.

### CS (Customer Success)
Indicadores do setor de sucesso do cliente, incluindo NPS.

## 🛠️ Desenvolvimento

### Estrutura de Rotas (Backend)

- `GET /api/health` - Health check
- `GET /api/portfolio` - Dados do portfólio
- `GET /api/curva-s` - Dados da curva S
- `GET /api/cronograma` - Dados do cronograma
- `GET /api/cs` - Dados do Customer Success
- `GET /api/auth/google` - Iniciar autenticação Google
- `GET /api/auth/google/callback` - Callback OAuth

### Componentes Principais (Frontend)

- `PortfolioView` - Visualização do portfólio
- `CurvaSView` - Visualização da curva S
- `IndicadoresLiderancaView` - Indicadores por líder
- `CronogramaView` - Visualização de cronogramas
- `CSView` - Indicadores de Customer Success
- `OracleChat` - Chat assistente

## 📝 Licença

Este projeto é propriedade da Otus Engenharia.

## 👥 Contribuidores

Desenvolvido para a Otus Engenharia.

---

**Versão:** R0 - Inicio da Plataforma com código

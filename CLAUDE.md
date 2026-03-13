
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plataforma Otus - A full-stack web application for project management and indicators visualization for Otus Engenharia. Built with React/Vite frontend and Node.js/Express backend, integrating with Google BigQuery for analytics data and Supabase for real-time data.

## Development Commands

### Backend (port 3001)
```bash
cd backend
npm install          # Install dependencies
npm start            # Start server (node server.js)
npm run dev          # Start with watch mode (node --watch server.js)
```

### Frontend (port 5173)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Docker (production)
```bash
docker-compose -f docker-compose.yaml up --build
```

## Branching Strategy (GitFlow Simplificado)

### Modelo de Branches

| Branch | Propósito | Permanente | Deploy |
|--------|-----------|------------|--------|
| `main` | Produção. VPS puxa deste branch. | Sim | Produção (VPS) |
| `develop` | Integração. Features aceitas. | Sim | — |
| `feature/*` | Novas funcionalidades | Não | — |
| `hotfix/*` | Correções urgentes de produção | Não | — |

### Regras

1. **NUNCA commitar direto em `main` ou `develop`**. Sempre usar feature/hotfix branches.
2. **Feature branches**: criam de `develop`, mergem em `develop` via PR ou merge local.
3. **Hotfix branches**: criam de `main`, mergem em `main` E `develop`.
4. **Deploy**: merge `develop` → `main`, depois deploy da `main`.
5. **Nomes**: `feature/descricao-kebab-case`, `hotfix/descricao-kebab-case`.

### Comandos Comuns

```bash
# Criar feature
git checkout develop && git pull origin develop
git checkout -b feature/minha-feature

# Criar hotfix
git checkout main && git pull origin main
git checkout -b hotfix/corrigir-bug

# Finalizar feature (push + PR para develop)
git push -u origin feature/minha-feature

# Deploy (merge develop → main)
git checkout main && git merge --no-ff develop
git push origin main
```

### Workflow do Claude Code (IA)

Ao desenvolver com Claude Code:
1. Claude DEVE criar feature branch antes de qualquer alteração
2. Claude DEVE fazer push e sugerir PR para `develop`
3. Claude NÃO PODE commitar direto em `main` ou `develop`
4. Use o skill `otus-deploy` para o fluxo completo

## Workflow Guidelines

### Abordagem de Trabalho

1. **Plan First**: Para tasks não-triviais (3+ passos ou decisões arquiteturais), entrar em plan mode antes de implementar. Escrever specs claras reduz retrabalho.
2. **Subagents para Contexto Limpo**: Delegar pesquisa, exploração e análise paralela a subagents. Uma tarefa por subagent para execução focada. Manter a janela de contexto principal limpa.
3. **Se Algo Deu Errado, PARE**: Se a implementação divergir do esperado, parar imediatamente e re-planejar. Não insistir numa abordagem quebrada.

### Verificação Obrigatória

**NUNCA considerar uma task completa sem provar que funciona:**

1. Backend alterado → verificar que `npm start` roda sem erros no `backend/`
2. Frontend alterado → verificar que `npm run build` compila sem erros no `frontend/`
3. Endpoints alterados → testar com curl, browser, ou demonstrar output
4. Mudanças visuais → capturar screenshot ou descrever o resultado
5. Perguntar-se: "Um desenvolvedor sênior aprovaria este código?"

### Resolução Autônoma de Bugs

Ao receber um bug report ou encontrar um erro:
1. **Investigar primeiro** — ler logs, stack traces e código relacionado antes de perguntar ao usuário
2. **Buscar root cause** — não aplicar fixes superficiais ou temporários
3. **Resolver de forma autônoma** — o usuário não precisa explicar como debugar
4. **Só perguntar quando genuinamente bloqueado** ou quando há decisão de negócio envolvida

### Aprendizado Contínuo

Quando o usuário corrigir um erro do Claude:
1. Registrar o padrão no **auto-memory** (`MEMORY.md`) para não repetir
2. Identificar se há outros locais no código com o mesmo problema
3. Aplicar a correção em todos os locais afetados, não apenas no reportado

## Princípios de Desenvolvimento

1. **Simplicidade**: Fazer a mudança mais simples que resolve o problema. Sem over-engineering.
2. **Impacto Mínimo**: Alterar apenas o necessário. Não refatorar código adjacente. Não introduzir bugs.
3. **Root Cause**: Corrigir a causa raiz, não os sintomas. Sem fixes temporários. Padrão de desenvolvedor sênior.
4. **Elegância Proporcional**: Para mudanças não-triviais, pausar e considerar se há abordagem mais limpa. Para fixes simples e óbvios, ir direto ao ponto.

## Architecture

### Domain Driven Design (DDD)

**IMPORTANTE:** Este projeto adota DDD para novos desenvolvimentos. Consulte os documentos de referência:
- `docs/DOMINIOS_DDD.md` - Mapeamento completo dos domínios e arquitetura
- `docs/LINGUAGEM_UBIQUA_GLOSSARIO.md` - Glossário de termos do negócio

#### Estrutura DDD (Backend)

Ao criar novas funcionalidades, siga esta estrutura:

```
backend/
├── domain/{dominio}/
│   ├── entities/           # Aggregate Roots e Entidades
│   │   └── {Entidade}.js   # Classe rica com comportamentos
│   ├── value-objects/      # Value Objects imutáveis
│   │   └── {ValueObject}.js
│   └── {Dominio}Repository.js  # Interface do repositório (contrato)
├── application/use-cases/{dominio}/
│   ├── Create{Entidade}.js    # Use case de criação
│   ├── Get{Entidade}.js       # Use case de busca
│   ├── List{Entidades}.js     # Use case de listagem
│   └── Update{Entidade}.js    # Use case de atualização
├── infrastructure/repositories/
│   └── Supabase{Dominio}Repository.js  # Implementação Supabase
└── routes/
    └── {dominio}.js           # Rotas REST
```

#### Princípios a Seguir

1. **Entidades Ricas**: Não criar entidades anêmicas. Comportamentos devem estar na entidade.
2. **Value Objects Imutáveis**: Criar com validação no construtor, sem setters.
3. **Use Cases Isolados**: Um use case por operação de negócio.
4. **Repository Pattern**: Interface abstrata no domínio, implementação na infraestrutura.
5. **Linguagem Ubíqua**: Usar os termos definidos no glossário.

#### Domínio de Referência: Feedbacks ✅

O domínio de Feedbacks serve como modelo de referência para a estrutura DDD:
- `backend/domain/feedbacks/` - Entidade, Value Objects, Interface
- `backend/application/use-cases/feedbacks/` - 9 Use Cases
- `backend/infrastructure/repositories/SupabaseFeedbackRepository.js`
- `backend/routes/feedbacks.js`

> **Nota:** 19 de ~24 domínios já seguem DDD. A migração Strangler Fig está ~80% completa.

### Backend (`backend/`)
- **server.js**: Express server with all API routes, authentication middleware, session management, rate limiting, and serves static frontend in production
- **bigquery.js**: Google BigQuery client - contains all SQL queries for portfolio, curves, schedules, costs, hours data
- **supabase.js**: Supabase client - handles real-time data, user feedback, logs, OKRs, indicators (legado - novos domínios usar DDD)
- **auth.js**: Passport.js configuration for Google OAuth 2.0
- **auth-config.js**: User roles mapping (director/admin/leader) and email-to-leader-name mappings for data filtering

### Frontend (`frontend/src/`)
- **App.jsx**: Main router with navigation sidebar, route definitions, and layout
- **contexts/AuthContext.jsx**: Authentication state management (Google OAuth + role-based permissions)
- **contexts/OracleContext.jsx**: Oracle chat assistant com sessões persistentes
- **contexts/PortfolioContext.jsx**: Estado e cache do portfolio
- **contexts/VistaClienteProvider**: Portal do cliente (vista externa)
- **contexts/ClientAuthProvider**: Autenticação do portal do cliente (separada do OAuth interno)
- **components/**: View components (PortfolioView, CurvaSView, CronogramaView, CSView, etc.)

### Data Flow
1. Frontend calls `/api/*` endpoints
2. Backend authenticates via Passport session
3. For leaders, data is filtered by their name in the `lider` column
4. BigQuery returns analytics data; Supabase returns real-time/operational data

### Authentication & Authorization
- Google OAuth 2.0 with role hierarchy: `dev > ceo > director > admin > leader > user`
- Role source: tabela `users_otus` no Supabase (fallback: `auth-config.js` para devs hardcoded)
- Dev mode com impersonation no frontend (`DEV_MODE=true`)
- Permissões granulares: `canAccessView`, `canAccessArea`, `canManageDemandas`, `canManageEstudosCustos`, `canAccessFormularioPassagem`, `canManagePagamentos`
- Leader names must match exactly with BigQuery `lider` column values

## Design System / Brand Guidelines

### Fonte
- **Família**: `'Inter', Verdana, Geneva, Tahoma, sans-serif` (definida em `index.css`)
- Título master (h1): **32px bold** — usar apenas uma vez por página
- Títulos (h2, h3): **22px bold**
- Textos (body): **10px regular**

### Paleta de Cores — Fundo Claro (padrão)

| Uso | Cor | Hex |
|-----|-----|-----|
| Acento principal (elementos do dash, hover, scrollbar) | Amarelo | `#ffdd00` |
| Acento secundário | Amarelo escuro | `#d3af00` |
| Texto primário (maior contraste) | Preto | `#1a1a1a` |
| Texto secundário | Cinza escuro | `#444444` |
| Texto muted | Cinza médio | `#737373` |
| Fundo principal | Branco | `#ffffff` |
| Fundo degradê | Branco → cinza | `#ffffff → #ededed` |

> **Amarelos (#ffdd00, #d3af00) são para elementos visuais do dash, NUNCA para textos em fundo claro.**

### Paleta de Cores — Fundo Escuro

| Uso | Cor | Hex |
|-----|-----|-----|
| Texto amarelo claro | Amarelo suave | `#ffe98f` |
| Texto amarelo principal | Amarelo Otus | `#ffdd00` |
| Texto amarelo muted | Amarelo escuro | `#a38800` |
| Texto primário (maior contraste) | Branco | `#ffffff` |
| Texto secundário | Cinza claro | `#d8d8d8` |
| Texto muted | Cinza médio | `#b3b3b3` |
| Fundo principal | Preto | `#1a1a1a` |
| Fundo degradê | Preto → cinza | `#1a1a1a → #444444` |

### Cores de Status (semânticas)

| Status | Hex | Uso |
|--------|-----|-----|
| Sucesso | `#15803d` | Positivo, aprovado, no prazo |
| Alerta | `#d97706` | Atenção, pendente |
| Perigo | `#dc2626` | Erro, atrasado, crítico |
| Info | `#0369a1` | Informativo, neutro |

### Regras para Novos Componentes

1. Usar as cores da paleta acima — não inventar cinzas ou amarelos novos
2. Amarelos são para **elementos visuais** (bordas, ícones, badges), não para texto em fundo claro
3. Para texto em fundo escuro, usar os amarelos da paleta escura (#ffe98f, #ffdd00)
4. Preferir CSS custom properties (`var(--color-*)`) quando disponíveis em `index.css`

## Environment Variables

Backend requires `.env` file with:
- `GOOGLE_APPLICATION_CREDENTIALS` / `BIGQUERY_PROJECT_ID` / `BIGQUERY_DATASET` - BigQuery connection
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` - Supabase connection
- `SESSION_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Auth config
- `FRONTEND_URL` - For CORS (default: https://app.otusengenharia.com)

## Key API Routes

### Rotas Legacy (BigQuery analytics — definidas em `server.js`)

- `GET /api/health` - Health check
- `GET /api/auth/google` / `GET /api/auth/google/callback` - Google OAuth
- `GET /api/portfolio` (+ `/summary`, `/edit-options`, `/project-codes`, `/a-iniciar-count`)
- `GET /api/curva-s` (+ `/colaboradores`, `/custos-por-cargo`, `/reconciliacao-custos`)
- `GET /api/projetos/cronograma` - Cronograma de projetos
- `GET /api/cs/nps`, `GET /api/cs/fechamentos-fase` - Customer Success (BigQuery)
- `GET /api/apoio-projetos/portfolio` - Portfolio de apoio

### Rotas DDD (19 domínios via `routes/index.js` → `setupDDDRoutes`)

`/api/feedbacks`, `/api/demandas`, `/api/estudos-custos`, `/api/projetos`, `/api/agenda/tasks`, `/api/curva-s-progresso`, `/api/baselines`, `/api/relatos`, `/api/baseline-requests`, `/api/todos`, `/api/user-preferences`, `/api/oracle`, `/api/weekly-reports`, `/api/time-savings`, `/api/ifc-changelog`, `/api/autodoc-entregas`, `/api/contact-requests`, `/api/nomenclatura`, `/api/marcos-projeto`, `/api/pagamentos`, `/api/notificacoes`, `/api/nps`, `/api/cs/percepcao-equipe`, `/api/cs/classificacoes`, `/api/client`, `/api/admin/client-portal`

## Estratégia de Migração DDD

O projeto está em processo de migração gradual para DDD usando o padrão **Strangler Fig**:

1. **Código Legado**: `backend/supabase.js` e `backend/bigquery.js` contêm código antigo
2. **Novos Domínios**: Sempre implementar seguindo a estrutura DDD
3. **Coexistência**: Código legado e DDD coexistem - não refatorar tudo de uma vez

### Domínios e Status DDD

| Domínio | Status | Use Cases | Notas |
|---------|--------|-----------|-------|
| **Feedbacks** | ✅ DDD | 9 | Modelo de referência |
| **Projetos** | ✅ DDD | 7 | Formulário de passagem |
| **Customer Success** | ✅ DDD | 8 | Classificações + snapshots |
| **Agenda** | ✅ DDD | 11 | Tarefas agendadas |
| **Demandas** | ✅ DDD | 9 | |
| **Estudos Custos** | ✅ DDD | 9 | |
| **Baselines** | ✅ DDD | 7 | |
| **Baseline Requests** | ✅ DDD | 5 | Solicitações de baseline |
| **Curva S Progresso** | ✅ DDD | 11 | Híbrido c/ BigQuery |
| **Pagamentos** | ✅ DDD | 16 | |
| **NPS** | ✅ DDD | 4 | Feedbacks NPS do cliente |
| **Pesquisas CS** | ✅ DDD | 6 | Percepção de equipe |
| **Relatos** | ✅ DDD | 13 | Diário de projeto |
| **Todos** | ✅ DDD | 8 | |
| **Time Savings** | ✅ DDD | 6 | Economia de horas |
| **Weekly Reports** | ✅ DDD | 7 | |
| **User Preferences** | ✅ DDD | 8 | |
| **ACD (Autodoc/IFC)** | ✅ DDD | 14 | Entregas + changelog |
| **Contact Requests** | ✅ DDD | 6 | |
| OKRs | Legado | — | Em `supabase.js` |
| Indicadores | Legado | — | Em `supabase.js` |
| Workspace | Legado | — | Em `supabase.js` |
| Equipes/Stakeholders | Legado | — | Em `auth-config.js` |
| Cronograma | Legado | — | BigQuery-driven |

### Ao Desenvolver Novas Funcionalidades

1. **Novo domínio?** → Criar estrutura DDD completa (DDD é o padrão dominante)
2. **Extensão de domínio existente com DDD?** → Seguir padrão existente
3. **Extensão de domínio legado?** → Avaliar se vale migrar ou manter legado
4. **Bug fix em código legado?** → Corrigir no local, não migrar

## Language

The codebase, comments, and documentation are in Portuguese (Brazilian). Variable names and code structure follow English conventions.

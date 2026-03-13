# Plano de Implementação DDD - Plataforma Otus

## Contexto

- **Arquitetura atual:** Data-driven (queries diretas ao BigQuery/Supabase)
- **Abordagem de migração:** Strangler Fig (gradual)
- **24 Bounded Contexts identificados (19 migrados para DDD)**

---

## Fase 1: Preparação

### 1.1 Correções de Banco de Dados

| Prioridade | Tabela | Correção |
|------------|--------|----------|
| 1 | `feedbacks` | Alterar id UUID → BIGINT, remover code, adicionar feedback_id |
| 2 | `indicadores` | Remover dados duplicados, manter FK para position_indicators |

### 1.2 Estrutura de Pastas

```
backend/
├── domain/
│   ├── gestao-projetos/
│   ├── cronograma/
│   ├── equipes-stakeholders/
│   ├── indicadores/
│   ├── okrs/
│   ├── workspace/
│   ├── feedbacks/
│   └── customer-success/
├── infrastructure/
│   ├── repositories/
│   └── services/
└── application/
    └── use-cases/
```

---

## Fase 2: Ordem de Implementação dos Domínios

| # | Domínio | Justificativa | Dependências | Status |
|---|---------|---------------|--------------|--------|
| 1 | Feedbacks | Mais simples, isolado | Correção BD | ✅ Implementado (9 use-cases) |
| 2 | Projetos | Core domain | — | ✅ Implementado (7 use-cases) |
| 3 | Customer Success | Classificações + snapshots | — | ✅ Implementado (8 use-cases) |
| 4 | Agenda | Tarefas agendadas | — | ✅ Implementado (11 use-cases) |
| 5 | Demandas | Solicitações | — | ✅ Implementado (9 use-cases) |
| 6 | Estudos Custos | Custos de projetos | — | ✅ Implementado (9 use-cases) |
| 7 | Baselines | Controle de baselines | — | ✅ Implementado (7 use-cases) |
| 8 | Baseline Requests | Solicitações | — | ✅ Implementado (5 use-cases) |
| 9 | Curva S Progresso | Híbrido BigQuery | — | ✅ Implementado (11 use-cases) |
| 10 | Pagamentos | Gestão de pagamentos | — | ✅ Implementado (16 use-cases) |
| 11 | NPS | Feedbacks NPS | — | ✅ Implementado (4 use-cases) |
| 12 | Pesquisas CS | Percepção de equipe | — | ✅ Implementado (6 use-cases) |
| 13 | Relatos | Diário de projeto | — | ✅ Implementado (13 use-cases) |
| 14 | Todos | Tarefas pessoais | — | ✅ Implementado (8 use-cases) |
| 15 | Time Savings | Economia de horas | — | ✅ Implementado (6 use-cases) |
| 16 | Weekly Reports | Relatórios semanais | — | ✅ Implementado (7 use-cases) |
| 17 | User Preferences | Preferências | — | ✅ Implementado (8 use-cases) |
| 18 | ACD (Autodoc/IFC) | Entregas + changelog | — | ✅ Implementado (14 use-cases) |
| 19 | Contact Requests | Solicitações de contato | — | ✅ Implementado (6 use-cases) |
| — | Workspace | Isolado, bem estruturado | Nenhuma | Pendente (legado) |
| — | OKRs | Independente, estrutura clara | Nenhuma | Pendente (legado) |
| — | Indicadores Individuais | Métricas de desempenho | Correção BD | Pendente (legado) |
| — | Equipes e Stakeholders | Base para outros domínios | Nenhuma | Pendente (legado) |
| — | Controle de Cronograma | Planejamento temporal | Gestão de Projetos | Pendente (legado/BigQuery) |

---

## Fase 3: Checklist por Domínio

Para cada domínio, seguir este checklist:

- [ ] Criar pasta do domínio em `backend/domain/`
- [ ] Definir entidades com regras de negócio
- [ ] Criar Value Objects (Status, Tipos, etc.)
- [ ] Definir interface do repositório no domínio
- [ ] Implementar repositório na infraestrutura
- [ ] Criar use cases na camada de aplicação
- [ ] Refatorar rotas para usar use cases
- [ ] Manter compatibilidade com frontend
- [ ] Testar funcionalidades

---

## Fase 4: Validação

- [ ] Testes unitários por domínio
- [ ] Testes de integração
- [ ] Validação com usuários
- [ ] Documentação atualizada

---

## Implementações Concluídas

### Domínio: Feedbacks ✅

**Estrutura implementada:**
```
backend/
├── domain/
│   └── feedbacks/
│       ├── entities/
│       │   ├── Feedback.js         # Entidade principal (Aggregate Root)
│       │   └── index.js
│       ├── value-objects/
│       │   ├── FeedbackStatus.js   # Value Object de status
│       │   ├── FeedbackType.js     # Value Object de tipo
│       │   └── index.js
│       ├── FeedbackRepository.js   # Interface do repositório
│       └── index.js
├── infrastructure/
│   └── repositories/
│       ├── SupabaseFeedbackRepository.js  # Implementação Supabase
│       └── index.js
├── application/
│   └── use-cases/
│       └── feedbacks/
│           ├── ListFeedbacks.js
│           ├── GetFeedback.js
│           ├── CreateFeedback.js
│           ├── UpdateFeedbackStatus.js
│           ├── UpdateFeedback.js
│           ├── GetFeedbackStats.js
│           └── index.js
└── routes/
    ├── feedbacks.js                # Rotas usando use cases
    └── index.js                    # Setup das rotas DDD
```

**Checklist concluído:**
- [x] Criar pasta do domínio em `backend/domain/`
- [x] Definir entidades com regras de negócio
- [x] Criar Value Objects (Status, Type)
- [x] Definir interface do repositório no domínio
- [x] Implementar repositório na infraestrutura
- [x] Criar use cases na camada de aplicação
- [x] Refatorar rotas para usar use cases
- [x] Manter compatibilidade com frontend
- [ ] Testar funcionalidades

---

## Próximos Passos

**Domínios legado restantes (5):** OKRs, Indicadores, Workspace, Equipes/Stakeholders, Cronograma.

Migração sob demanda — avaliar custo/benefício antes de migrar.

---

## Documentos Relacionados

- [Linguagem Ubíqua - Glossário](LINGUAGEM_UBIQUA_GLOSSARIO.md)
- [Mapeamento de Domínios](DOMINIOS_DDD.md)
- [Correções de Banco de Dados](CORRECOES_BANCO_DE_DADOS.md)

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-02-04 | Plano criado com abordagem Strangler Fig |
| 2026-02-04 | Domínio Feedbacks implementado com DDD completo |
| 2026-03-13 | Atualizado: 19 domínios migrados (~80% completo), 5 legado restantes |

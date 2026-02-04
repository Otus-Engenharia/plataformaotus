# Plano de Implementação DDD - Plataforma Otus

## Contexto

- **Arquitetura atual:** Data-driven (queries diretas ao BigQuery/Supabase)
- **Abordagem de migração:** Strangler Fig (gradual)
- **8 Bounded Contexts identificados**

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
| 1 | Feedbacks | Mais simples, isolado | Correção BD | ✅ Implementado |
| 2 | Workspace | Isolado, bem estruturado | Nenhuma | Pendente |
| 3 | OKRs | Independente, estrutura clara | Nenhuma | Pendente |
| 4 | Indicadores Individuais | Métricas de desempenho | Correção BD | Pendente |
| 5 | Equipes e Stakeholders | Base para outros domínios | Nenhuma | Pendente |
| 6 | Gestão de Projetos | Core domain | Equipes | Pendente |
| 7 | Controle de Cronograma | Planejamento temporal | Gestão de Projetos | Pendente |
| 8 | Customer Success | Integração BigQuery | Gestão de Projetos | Pendente |

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

## Próximo Passo

**Domínio: Workspace**

1. Criar estrutura de pastas
2. Implementar entidades (Project, Task)
3. Criar Value Objects (TaskStatus, Priority)
4. Criar repositório
5. Refatorar rotas existentes

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

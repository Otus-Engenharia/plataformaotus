# Domínios - Domain Driven Design

Mapeamento dos domínios da Plataforma Otus seguindo a metodologia de Domain Driven Design (DDD).

---

## Visão Geral

| Domínio | Descrição | Status |
|---------|-----------|--------|
| Gestão de Projetos | Ciclo de vida dos projetos de engenharia | Parcial |
| Controle de Cronograma | Planejamento e controle temporal | Parcial |
| Equipes e Stakeholders | Empresas e pessoas envolvidas | Implementado |
| Indicadores Individuais | Métricas de desempenho por cargo | Implementado |
| OKRs | Objetivos e Resultados-Chave | Implementado |
| Workspace | Tarefas e projetos internos | Implementado |
| Feedbacks | Registro de feedbacks internos | Implementado |
| Customer Success | Satisfação e relacionamento com clientes | Parcial |

---

## Domínio: Gestão de Projetos

Núcleo central do sistema que gerencia o ciclo de vida dos projetos de engenharia coordenados pela Otus.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Projeto | `projects` | ✅ Implementado |
| Fases de Projeto | `projects.status` | ✅ Implementado |
| Apontamentos | BigQuery `construflow_data.issues` | ✅ Implementado |
| Diário de Projeto | - | ❌ Não implementado |
| Gestão de Contratos | - | ❌ Não implementado |

---

## Domínio: Controle de Cronograma

Planejamento e controle temporal das atividades multidisciplinares de um projeto.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Cronograma | Smartsheet + BigQuery | ✅ Implementado |
| Baseline | - | ⚠️ Placeholder |
| Baseline de Controle Estratégico | - | ❌ Não implementado |
| Baseline Reprogramado | - | ❌ Não implementado |
| Controle de Registros de Baseline | - | ❌ Não implementado |
| Desvio de Cronograma | - | ⚠️ Parcial |
| Gestão de Desvios | - | ❌ Não implementado |
| Peso das Disciplinas | - | ❌ Não implementado |

---

## Domínio: Equipes e Stakeholders

Composição e gestão dos agentes (empresas e pessoas) envolvidos nos projetos.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Empresas | `companies` | ✅ Implementado |
| Cliente | `companies.company_type = 'client'` | ✅ Implementado |
| Fornecedor | `companies.company_type = 'supplier'` | ✅ Implementado |
| Interno | `companies.company_type = 'internal'` | ✅ Implementado |
| Pessoas (Contatos) | `contacts` | ✅ Implementado |
| Disciplinas | `standard_disciplines` | ✅ Implementado |
| Equipes de Projeto | `project_disciplines` | ✅ Implementado |

---

## Domínio: Indicadores Individuais

Sistema de métricas de desempenho individual vinculadas a cargos, com metas mensais e acompanhamento periódico.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Setor | `sectors` | ✅ Implementado |
| Cargo | `positions` | ✅ Implementado |
| Indicador | `position_indicators` | ✅ Implementado |
| Meta | `position_indicators.monthly_targets` | ✅ Implementado |
| Check-in de Indicador | `indicadores_check_ins` | ✅ Implementado |
| Score | Calculado | ✅ Implementado |
| Plano de Recuperação | `recovery_plans` | ✅ Implementado |

---

## Domínio: OKRs

Metodologia de gestão de metas organizacionais através de Objetivos e Resultados-Chave.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| OKR | `okrs` | ✅ Implementado |
| Objetivo | `okrs.title` | ✅ Implementado |
| Key Result | `key_results` | ✅ Implementado |
| Ciclo/Período | `okrs.quarter`, `okrs.year` | ✅ Implementado |
| Check-in de OKR | `okr_check_ins` | ✅ Implementado |
| Nível de Confiança | `okr_check_ins.confidence_level` | ✅ Implementado |

---

## Domínio: Workspace

Área de gestão de tarefas e projetos internos da Otus, não relacionados diretamente aos projetos de clientes.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Projeto Interno | `workspace_projects` | ✅ Implementado |
| Tarefa | `workspace_tasks` | ✅ Implementado |
| Status da Tarefa | `workspace_tasks.status` | ✅ Implementado |
| Prioridade | `workspace_tasks.priority` | ✅ Implementado |
| Responsável | `workspace_tasks.assignee_id` | ✅ Implementado |
| Subtarefa | `workspace_tasks.parent_task_id` | ✅ Implementado |
| Tags | `workspace_tasks.tags` | ✅ Implementado |

---

## Domínio: Feedbacks

Sistema de registro e acompanhamento de feedbacks sobre processos, entregas e colaboradores.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| Feedback | `feedbacks` | ✅ Implementado |
| Categoria de Feedback | `feedbacks.category` | ✅ Implementado |
| Status do Feedback | `feedbacks.status` | ✅ Implementado |

---

## Domínio: Customer Success

Acompanhamento de satisfação, relacionamento e sucesso dos clientes da Otus.

### Entidades

| Entidade | Tabela | Status |
|----------|--------|--------|
| NPS | BigQuery `CS_NPS_pbi` | ✅ Implementado |
| Cliente Ativo | BigQuery `port_clientes` | ✅ Implementado |
| Coordenador | BigQuery `portfolio.lider` | ✅ Implementado |
| Último Time | BigQuery `port_clientes.Ultimo_Time` | ✅ Implementado |

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-02-04 | Documento criado com mapeamento dos 8 domínios |

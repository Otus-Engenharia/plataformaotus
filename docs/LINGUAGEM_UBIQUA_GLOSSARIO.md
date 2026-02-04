# Linguagem Ubíqua - Glossário

Este documento define a terminologia padrão utilizada na Plataforma Otus, organizada por Bounded Context (contexto delimitado) conforme os princípios de Domain Driven Design.

---

## Sumário

1. [BC: Gestão de Projetos](#bc-gestão-de-projetos)
2. [BC: Controle de Cronograma](#bc-controle-de-cronograma)
3. [BC: Equipes e Stakeholders](#bc-equipes-e-stakeholders)
4. [BC: Indicadores Individuais](#bc-indicadores-individuais)
5. [BC: OKRs](#bc-okrs)
6. [BC: Workspace](#bc-workspace)
7. [BC: Feedbacks](#bc-feedbacks)
8. [BC: Customer Success](#bc-customer-success)

---

## BC: Gestão de Projetos

Núcleo central do sistema que gerencia o ciclo de vida dos projetos de engenharia coordenados pela Otus.

### Projeto

É a entidade central que representa o agrupamento integrado de todas as disciplinas técnicas (arquitetura, estrutura, instalações, etc.) necessárias para a materialização de um ativo físico. O Projeto funciona como um ecossistema que consolida as informações multidisciplinares para viabilizar a construção e a gestão do ciclo de vida do ativo.

**Tabela:** `projects`

### Fases de Projeto

São as etapas sequenciais e evolutivas que organizam o desenvolvimento técnico do Projeto. Cada fase representa um nível de maturidade e detalhamento das informações, servindo como base para a distribuição de Pesos das Disciplinas e para a organização das entregas no Cronograma.

**Campo:** `projects.status`

**Valores possíveis:**
- **Ativos:** Projetos em andamento
- **Pausados:** Pausado, Pausado pelo cliente, Em pausa
- **Finalizados:** Concluído, Entregue, Finalizado, Encerrado, Cancelado

### Apontamentos

No escopo atual da Otus, é o registro formal de uma inconsistência, dúvida técnica ou necessidade de troca de informação identificada durante o ciclo de vida do Projeto. O Apontamento serve como um canal de comunicação estruturado para garantir que decisões técnicas sejam tomadas, erros sejam corrigidos e que haja rastreabilidade sobre o que foi discutido entre as equipes multidisciplinares.

**Fonte:** BigQuery (`construflow_data.issues`)

### Diário de Projeto

É o registro cronológico e histórico de fatos relevantes, decisões estratégicas e ocorrências operacionais que impactam o ecossistema do Projeto, mas que não se configuram como uma tarefa de cronograma ou um erro técnico (apontamento). Ele funciona como a memória viva do empreendimento, garantindo que o contexto por trás das grandes mudanças seja preservado.

**Status:** ❌ Não implementado

### Gestão de Contratos dos Projetos

É a atividade de monitoramento e controle dos acordos firmados entre os projetistas e o cliente, bem como entre a Otus e o cliente. Ela consiste em traduzir os documentos jurídicos em parâmetros operacionais de escopo, prazos de entrega e condições de pagamento, garantindo que as obrigações de cada parte sejam cumpridas conforme as fases do projeto.

**Status:** ❌ Não implementado

---

## BC: Controle de Cronograma

Planejamento e controle temporal das atividades multidisciplinares de um projeto.

### Cronograma

É o instrumento de planejamento e controle temporal que centraliza o sequenciamento de todas as atividades multidisciplinares de um Projeto. Ele serve como a "fonte da verdade" para prazos, integrando o fluxo de trabalho de todas as equipes envolvidas e permitindo o monitoramento do progresso real em relação ao planejado.

**Fonte:** Smartsheet (externo) + BigQuery

### Baseline

É o registro estático (fotografia) do estado do Cronograma em um momento específico no tempo. Sua finalidade é servir como ponto de referência para medir o desempenho, comparar o progresso real com o planejado e analisar a evolução das datas ao longo do ciclo de vida do Projeto.

**Status:** ⚠️ Placeholder implementado

#### Baseline de Controle Estratégico

Representa o acordo formal de prazos firmado com o cliente (Datas Marco). É a referência de sucesso do projeto do ponto de vista do investidor/cliente. Pode ser alterada mediante às mudanças de estratégia de negócio ou problemas críticos de entrega que invalidem o plano mestre original.

**Status:** ❌ Não implementado

#### Baseline Reprogramado

Registros mensais automáticos ou periódicos de todo o cronograma. Sua função é permitir a análise retrospectiva do fluxo de trabalho e o comportamento das entregas dentro de um ciclo específico (mês).

**Status:** ❌ Não implementado

### Controle de Registros de Baseline

É o processo formal e auditável de revisão da Baseline de Controle Estratégico. Dado que esta baseline representa o marco de sucesso acordado com o cliente, sua alteração é tratada como um evento de exceção, exigindo um rito de solicitação e fundamentação para garantir a integridade do histórico do projeto. Esse tipo de ação é de responsabilidade única e exclusiva do líder de projeto em comum acordo com o Cliente, exigindo formalização por e-mail.

**Status:** ❌ Não implementado

### Desvio de Cronograma

É a oscilação, positiva ou negativa, observada na duração ou nas datas (início/fim) de uma tarefa em relação ao que foi planejado. O desvio quantifica a variância entre a execução real e as referências estabelecidas nas Baselines.

**Status:** ⚠️ Cálculo de atrasos existe, conceito não formalizado

### Gestão de Desvios de Cronograma

É o processo de revisão e moderação dos atrasos calculados pelo sistema. Permite que a coordenação da Otus intervenha sobre um Desvio de Cronograma detectado, podendo justificá-lo ou desconsiderá-lo caso o registro automático não reflita a realidade dos acordos vigentes ou a situação atual do projeto.

**Status:** ❌ Não implementado

### Peso das Disciplinas

É a atribuição de valor relativo (percentual ou ponderado) a cada disciplina e suas respectivas tarefas dentro das diferentes fases do projeto. Esse índice quantifica o impacto de cada entrega no progresso total do projeto, permitindo a geração de uma curva de evolução do cronograma, similar ao cronograma físico-financeiro de uma obra.

**Status:** ❌ Não implementado

---

## BC: Equipes e Stakeholders

Composição e gestão dos agentes (empresas e pessoas) envolvidos nos projetos.

### Empresas

Todas as empresas envolvidas no serviço da Otus de coordenação de projetos, divididas nas seguintes categorias:

**Tabela:** `companies`

#### Cliente

Contratante da Otus, dono do projeto.

**Campo:** `companies.company_type = 'client'`

#### Fornecedor

Empresas que realizam entregas de projetos ou relatórios.

**Campo:** `companies.company_type = 'supplier'`

#### Interno

Otus propriamente dita.

**Campo:** `companies.company_type = 'internal'`

### Pessoas (Contatos)

Pessoas envolvidas nas empresas. Possuem segmentação de nível hierárquico, como estratégico, tático e operacional. São os responsáveis pelas entregas de cada empresa.

**Tabela:** `contacts`
**Campo de cargo:** `contacts.position`

### Disciplinas

É a classificação técnica padronizada de uma especialidade de engenharia ou arquitetura dentro da base da Otus. As disciplinas funcionam como o molde (template) para a organização do trabalho, servindo de base para a atribuição de responsabilidades, estruturação do cronograma e o cadastro das equipes de projeto.

**Tabela:** `standard_disciplines`

### Equipes de Projeto

É a composição de todos os agentes (empresas, profissionais e stakeholders) designados para atuar em um Projeto específico. A Equipe de Projeto define o arranjo de responsabilidades, vinculando cada Disciplina à sua respectiva empresa executora, além de integrar as figuras de coordenação e decisão estratégica.

**Tabela:** `project_disciplines`

---

## BC: Indicadores Individuais

Sistema de métricas de desempenho individual vinculadas a cargos, com metas mensais e acompanhamento periódico.

### Setor

É a divisão organizacional da Otus que agrupa colaboradores por área de atuação. Cada setor possui seus próprios indicadores, OKRs e projetos de workspace.

**Tabela:** `sectors`

**Exemplos:** Líderes de Projeto, Customer Success, Apoio a Projetos, Diretoria

### Cargo

É a função exercida por uma pessoa dentro de um setor da Otus. Cada cargo possui um conjunto de indicadores de desempenho vinculados que definem as expectativas e metas para quem ocupa aquela posição.

**Tabela:** `positions`

**Atributos importantes:**
- `name`: Nome do cargo
- `is_leadership`: Indica se é cargo de liderança
- `sector_id`: Setor ao qual pertence

### Indicador

É uma métrica de desempenho individual que mensura um aspecto específico do trabalho de uma pessoa. Cada indicador possui nome, descrição, tipo de métrica, peso relativo e metas mensais definidas. Os indicadores são derivados de templates (`position_indicators`) vinculados a cargos, com informações adicionais de valores de medição, metas e usuários.

**Tabela:** `position_indicators`

**Atributos importantes:**
- `name`: Nome do indicador
- `metric_type`: Tipo de métrica (percentage, number, currency, etc.)
- `weight`: Peso relativo no cálculo do score geral
- `target_direction`: Direção da meta (higher_is_better, lower_is_better)
- `default_target`: Meta padrão do indicador
- `monthly_targets`: Metas mensais (objeto JSON)

### Meta

É o valor alvo que um indicador deve atingir em um determinado mês. As metas podem variar mensalmente, permitindo sazonalidade e ajustes conforme a realidade do negócio. As metas são armazenadas como um campo JSON dentro da tabela de indicadores.

**Campo:** `position_indicators.monthly_targets` (objeto JSON)

**Estrutura do campo:**
- Chaves: meses no formato "YYYY-MM" ou números 1-12
- Valores: meta numérica para aquele mês

**Campo auxiliar:** `position_indicators.default_target` (meta padrão quando não há meta específica para o mês)

### Check-in de Indicador

É o registro periódico do valor atual de um indicador, realizado pelo colaborador ou seu gestor. O check-in captura o progresso em direção à meta e permite o acompanhamento contínuo do desempenho.

**Tabela:** `indicadores_check_ins`

**Atributos importantes:**
- `indicator_id`: Indicador relacionado
- `user_id`: Usuário que realizou o check-in
- `value`: Valor registrado
- `reference_month` / `reference_year`: Período de referência
- `notes`: Observações opcionais

### Score

É a pontuação calculada que representa o desempenho de um indicador ou de uma pessoa em relação às metas estabelecidas. O score é expresso em percentual (0-100+) e considera o peso de cada indicador no cálculo geral.

**Cálculo:** `(valor_atual / meta) * 100 * peso`

**Classificação:**
- **Verde (≥90%):** Desempenho excelente
- **Amarelo (70-89%):** Desempenho adequado, atenção necessária
- **Vermelho (<70%):** Desempenho crítico, ação necessária

### Plano de Recuperação

É o registro de ações corretivas definidas quando um indicador está em situação crítica (score abaixo do esperado). O plano documenta as causas identificadas e as medidas a serem tomadas para recuperar o desempenho.

**Tabela:** `recovery_plans`

**Atributos importantes:**
- `indicator_id`: Indicador relacionado
- `user_id`: Usuário responsável
- `root_cause`: Causa raiz identificada
- `action_plan`: Plano de ação
- `status`: Estado do plano (pending, in_progress, completed)

---

## BC: OKRs

Metodologia de gestão de metas organizacionais através de Objetivos e Resultados-Chave.

### OKR (Objectives and Key Results)

É a metodologia de definição de metas que combina um Objetivo qualitativo e inspirador com Resultados-Chave mensuráveis que indicam o progresso. Os OKRs são definidos por período (trimestre) e podem ser criados em nível de setor ou empresa.

**Tabela:** `okrs`

### Objetivo

É a meta qualitativa e inspiradora que define o que se deseja alcançar. O objetivo deve ser ambicioso, claro e motivador, respondendo à pergunta "Para onde queremos ir?".

**Campo:** `okrs.title`

**Características:**
- Qualitativo (não numérico)
- Inspirador e ambicioso
- Claro e compreensível
- Limitado no tempo (trimestre)

### Key Result (Resultado-Chave)

É uma métrica quantitativa que indica o progresso em direção ao Objetivo. Cada OKR pode ter múltiplos Key Results, e a média do progresso deles determina o progresso geral do objetivo.

**Tabela:** `key_results`

**Atributos importantes:**
- `title`: Descrição do resultado esperado
- `initial_value`: Valor inicial (baseline)
- `target_value`: Valor alvo a ser atingido
- `current_value`: Valor atual
- `unit`: Unidade de medida
- `weight`: Peso relativo (se aplicável)

### Ciclo/Período

É o intervalo de tempo durante o qual um OKR está vigente. Na Otus, os ciclos são trimestrais, alinhados com o planejamento estratégico.

**Campos:** `okrs.quarter` (Q1, Q2, Q3, Q4), `okrs.year`

### Check-in de OKR

É o registro periódico de progresso do OKR, geralmente realizado em reuniões semanais ou quinzenais. O check-in atualiza o valor atual dos Key Results e documenta os aprendizados e impedimentos.

**Tabela:** `okr_check_ins`

**Atributos importantes:**
- `okr_id`: OKR relacionado
- `key_result_id`: Key Result específico (opcional)
- `progress_percentage`: Percentual de progresso
- `comments`: Comentários e observações
- `confidence_level`: Nível de confiança na entrega

### Nível de Confiança

É a avaliação subjetiva da probabilidade de atingir o OKR até o final do ciclo. Geralmente representado por cores ou números.

**Campo:** `okr_check_ins.confidence_level`

**Valores:**
- **Alto (Verde):** Alta probabilidade de atingir
- **Médio (Amarelo):** Risco moderado, atenção necessária
- **Baixo (Vermelho):** Risco alto, ação urgente necessária

---

## BC: Workspace

Área de gestão de tarefas e projetos internos da Otus, não relacionados diretamente aos projetos de clientes.

### Projeto Interno

É uma iniciativa ou conjunto de trabalhos internos de um setor da Otus, com escopo, prazo e responsáveis definidos. Diferente dos Projetos de clientes, os projetos internos focam em melhorias, processos e entregas internas.

**Tabela:** `workspace_projects`

**Atributos importantes:**
- `name`: Nome do projeto
- `sector_id`: Setor responsável
- `status`: Estado (ativo, pausado, arquivado)
- `start_date` / `due_date`: Período de execução

### Tarefa

É a unidade de trabalho dentro de um Projeto Interno. Cada tarefa representa uma atividade específica que precisa ser executada, com responsável, prazo e prioridade definidos.

**Tabela:** `workspace_tasks`

**Atributos importantes:**
- `title`: Título da tarefa
- `description`: Descrição detalhada
- `project_id`: Projeto ao qual pertence
- `assignee_id`: Responsável pela execução
- `status`: Estado atual
- `priority`: Nível de prioridade
- `due_date`: Data limite

### Status da Tarefa

É o estado atual de uma tarefa no fluxo de trabalho. O status indica em que etapa a tarefa se encontra.

**Campo:** `workspace_tasks.status`

**Valores:**
- **Pendente:** Tarefa criada, aguardando início
- **Em andamento:** Tarefa em execução
- **Em revisão:** Aguardando validação
- **Concluída:** Tarefa finalizada
- **Cancelada:** Tarefa cancelada

### Prioridade

É o nível de urgência e importância de uma tarefa, usado para ordenar e priorizar o trabalho.

**Campo:** `workspace_tasks.priority`

**Valores:**
- **Urgente:** Ação imediata necessária
- **Alta:** Prioridade elevada
- **Média:** Prioridade normal
- **Baixa:** Pode aguardar

### Responsável (Assignee)

É a pessoa designada para executar uma tarefa específica. O responsável é notificado sobre atualizações e é cobrado pelo cumprimento do prazo.

**Campo:** `workspace_tasks.assignee_id`

### Subtarefa

É uma tarefa menor, derivada de uma tarefa principal. Permite quebrar trabalhos complexos em partes menores e gerenciáveis.

**Campo:** `workspace_tasks.parent_task_id`

### Tags

São marcadores textuais livres que permitem categorizar e filtrar tarefas por temas transversais.

**Campo:** `workspace_tasks.tags` (array)

---

## BC: Feedbacks

Sistema de registro e acompanhamento de feedbacks sobre processos, plataforma, bugs e sugestões. **Primeiro domínio implementado com arquitetura DDD completa.**

### Feedback (Aggregate Root)

É o registro formal de uma observação, bug, erro ou sugestão sobre processos ou a plataforma. O feedback serve como instrumento de melhoria contínua e comunicação estruturada entre usuários e administradores.

**Tabela:** `feedbacks`

**Atributos importantes:**
- `titulo`: Título resumido do feedback
- `feedback_text`: Descrição detalhada do feedback
- `type`: Tipo do feedback (Value Object)
- `status`: Estado no fluxo de tratamento (Value Object)
- `author_id`: UUID do autor do feedback
- `page_url`: URL da página onde o feedback foi criado
- `screenshot_url`: Screenshot anexada (base64)
- `admin_analysis`: Análise do administrador
- `admin_action`: Ação a ser tomada
- `resolved_by_id`: UUID de quem resolveu
- `resolved_at`: Data/hora da resolução
- `category`: Categoria técnica (classificação do dev)

### Tipo de Feedback (Value Object: FeedbackType)

É a classificação do feedback por natureza, indicando se é um problema técnico ou sugestão de melhoria.

**Campo:** `feedbacks.type`

**Valores válidos:**
- **bug** 🐛: Funcionalidade que faz algo errado
- **erro** ❌: Funcionalidade que não funciona ou trava
- **feedback_processo** ⚙️: Sugestão sobre processos da empresa
- **feedback_plataforma** 💻: Sugestão sobre a plataforma/sistema
- **outro** 📝: Dúvidas ou outros assuntos

**Propriedades derivadas:**
- `isTechnical`: true para `bug` e `erro`
- `isBug`: true apenas para `bug`

### Status do Feedback (Value Object: FeedbackStatus)

É o estado atual do feedback no fluxo de tratamento, desde a criação até a resolução.

**Campo:** `feedbacks.status`

**Valores válidos:**
- **pendente**: Feedback recém-criado, aguardando análise
- **em_analise**: Sendo avaliado pela equipe
- **backlog_desenvolvimento**: Aguardando implementação técnica
- **backlog_treinamento**: Requer treinamento/documentação
- **analise_funcionalidade**: Em análise de viabilidade
- **finalizado**: Tratamento concluído com sucesso
- **recusado**: Feedback recusado (não será implementado)

**Propriedades derivadas:**
- `isClosed`: true para `finalizado` e `recusado`
- `isOpen`: inverso de `isClosed`
- `isPending`: true apenas para `pendente`

### Regras de Negócio

1. **Transição de Status:** Feedbacks finalizados ou recusados não podem ser reabertos
2. **Resolução:** Ao finalizar/recusar, é obrigatório informar `resolved_by_id`
3. **Validação:** Texto do feedback e autor são obrigatórios
4. **Código:** Formato `FB-{id}` para identificação única

---

## BC: Customer Success

Acompanhamento de satisfação, relacionamento e sucesso dos clientes da Otus.

### NPS (Net Promoter Score)

É a métrica que mede a satisfação e lealdade dos clientes através de uma pergunta simples: "Em uma escala de 0 a 10, qual a probabilidade de você recomendar a Otus?". O NPS é calculado subtraindo o percentual de detratores do percentual de promotores.

**Fonte:** BigQuery (`CS_NPS_pbi`)

**Classificação:**
- **Promotores (9-10):** Clientes satisfeitos e leais
- **Neutros (7-8):** Clientes satisfeitos mas não entusiasmados
- **Detratores (0-6):** Clientes insatisfeitos

**Cálculo:** `NPS = % Promotores - % Detratores`

### Cliente Ativo

É um cliente que possui pelo menos um projeto em andamento (não finalizado) com a Otus. A contagem de clientes ativos é uma métrica importante de saúde do negócio.

**Fonte:** BigQuery (`port_clientes`)

### Coordenador

É o líder de projeto da Otus responsável pelo relacionamento e sucesso de um cliente específico. O coordenador é o ponto focal de comunicação entre a Otus e o cliente.

**Campo:** `portfolio.lider` (BigQuery)

### Último Time

É a classificação do cliente conforme seu último registro de contato ou interação, usado para identificar clientes que precisam de atenção.

**Campo:** `port_clientes.Ultimo_Time`

---

## Apêndice: Mapeamento Código ↔ Glossário

| Termo no Código | Termo no Glossário | Tabela/Campo |
|-----------------|-------------------|--------------|
| `projects` | Projeto | Supabase |
| `projects.status` | Fases de Projeto | Supabase |
| `companies` | Empresas | Supabase |
| `company_type = 'client'` | Cliente | Supabase |
| `company_type = 'supplier'` | Fornecedor | Supabase |
| `company_type = 'internal'` | Interno | Supabase |
| `contacts` | Pessoas (Contatos) | Supabase |
| `standard_disciplines` | Disciplinas | Supabase |
| `project_disciplines` | Equipes de Projeto | Supabase |
| `sectors` | Setor | Supabase |
| `positions` | Cargo | Supabase |
| `position_indicators` | Indicador | Supabase |
| `position_indicators.monthly_targets` | Meta | Supabase (campo JSON) |
| `indicadores_check_ins` | Check-in de Indicador | Supabase |
| `recovery_plans` | Plano de Recuperação | Supabase |
| `okrs` | OKR | Supabase |
| `okrs.title` | Objetivo | Supabase |
| `key_results` | Key Result | Supabase |
| `okr_check_ins` | Check-in de OKR | Supabase |
| `workspace_projects` | Projeto Interno | Supabase |
| `workspace_tasks` | Tarefa | Supabase |
| `feedbacks` | Feedback | Supabase |
| `feedbacks.type` | Tipo de Feedback | Value Object: FeedbackType |
| `feedbacks.status` | Status do Feedback | Value Object: FeedbackStatus |
| `feedbacks.titulo` | Título do Feedback | Supabase |
| `feedbacks.feedback_text` | Descrição do Feedback | Supabase |
| `feedbacks.author_id` | Autor do Feedback | Supabase (FK → users_otus) |
| `feedbacks.resolved_by_id` | Resolvido por | Supabase (FK → users_otus) |
| `construflow_data.issues` | Apontamentos | BigQuery |
| `CS_NPS_pbi` | NPS | BigQuery |
| `port_clientes` | Cliente Ativo | BigQuery |
| `lider` | Coordenador | BigQuery |

---

## Histórico de Revisões

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-02-04 | 1.0 | Versão inicial com todos os Bounded Contexts |
| 2026-02-04 | 1.1 | Atualização BC Feedbacks com implementação DDD (Value Objects, Status, Types) |


# 📋 Plano de Implementação: Sistema de Indicadores (Baseado no Lovable)

## 🎯 **Objetivo**

Implementar um sistema completo de indicadores individuais baseado no projeto Lovable (`github.com/Otus-Engenharia/indicadores`), com todas as funcionalidades avançadas.

---

## 📊 **Estrutura de Dados Necessária no Supabase**

### **Tabelas Principais:**

#### **1. `positions` (Cargos)**
```sql
- id (UUID)
- name (TEXT) - Nome do cargo
- description (TEXT)
- is_leadership (BOOLEAN) - Se é cargo de liderança
- sector_id (UUID) - Referência ao setor
- created_at, updated_at
```

#### **2. `position_indicators` (Templates de Indicadores por Cargo)**
```sql
- id (UUID)
- position_id (UUID) - Cargo ao qual pertence
- title (TEXT) - Título do indicador
- description (TEXT)
- metric_type (ENUM: 'number', 'percentage', 'boolean', 'currency')
- consolidation_type (ENUM: 'sum', 'average', 'last_value', 'manual')
- default_initial (NUMERIC) - Valor inicial padrão
- default_target (NUMERIC) - Meta padrão
- default_threshold_80 (NUMERIC) - Threshold de 80%
- default_threshold_120 (NUMERIC) - Threshold de 120%
- default_weight (INTEGER) - Peso padrão (0-100)
- is_inverse (BOOLEAN) - Se valores menores são melhores
- monthly_targets (JSONB) - Metas mensais { "1": 10, "2": 15, ... }
- created_at, updated_at
```

#### **3. `indicators` (Indicadores Individuais)**
```sql
- id (UUID)
- person_id (UUID) - Usuário dono do indicador
- source_template_id (UUID) - Referência ao template (position_indicators)
- title (TEXT)
- description (TEXT)
- metric_type (ENUM)
- consolidation_type (ENUM)
- cycle (ENUM: 'q1', 'q2', 'q3', 'q4', 'annual')
- year (INTEGER)
- initial_value (NUMERIC)
- target_value (NUMERIC)
- current_value (NUMERIC) - Para consolidação manual
- threshold_80 (NUMERIC)
- threshold_120 (NUMERIC)
- weight (INTEGER)
- is_inverse (BOOLEAN)
- monthly_targets (JSONB) - Metas mensais específicas
- created_at, updated_at
```

#### **4. `check_ins` (Check-ins Mensais)**
```sql
- id (UUID)
- indicator_id (UUID) - Referência ao indicador
- month (INTEGER) - 1-12
- year (INTEGER)
- value (NUMERIC) - Valor registrado
- notes (TEXT)
- created_by (UUID)
- created_at, updated_at
- UNIQUE(indicator_id, month, year)
```

#### **5. `sectors` (Setores)**
```sql
- id (UUID)
- name (TEXT)
- description (TEXT)
- created_at, updated_at
```

#### **6. `profiles` (Perfis de Usuários)**
```sql
- id (UUID) - Referência a auth.users
- full_name (TEXT)
- avatar_url (TEXT)
- sector_id (UUID)
- position_id (UUID) - Cargo do usuário
- created_at, updated_at
```

---

## 🎨 **Funcionalidades a Implementar**

### **1. Dashboard Principal (`/indicadores` ou `/`)**

#### **Cards de Resumo:**
- ✅ **Score Geral:** Score ponderado de todos os indicadores (0-120%)
- ✅ **Cargo:** Nome do cargo e setor do usuário
- ✅ **Em Risco:** Quantidade de indicadores abaixo da meta (vermelho/amarelo)
- ✅ **Atingidos:** Quantidade de indicadores na meta ou acima (verde/azul)

#### **Filtros:**
- ✅ **Ciclo:** Q1, Q2, Q3, Q4, Anual
- ✅ **Ano:** 2024, 2025, 2026, etc.

#### **Cards de Indicadores:**
- ✅ Título e descrição
- ✅ Valor atual vs Meta
- ✅ Barra de progresso com cores (traffic light)
- ✅ Badge de score (0-120%)
- ✅ Ícone de tendência (↑ ↓ →)
- ✅ Peso do indicador
- ✅ Link para detalhes

#### **Alertas:**
- ✅ Indicadores faltantes do template do cargo
- ✅ Indicadores que precisam sincronizar (metas atualizadas)

---

### **2. Sistema de Scoring (Traffic Light)**

#### **Cores:**
- 🔴 **Vermelho (0%):** Abaixo do threshold_80
- 🟡 **Amarelo (80-99%):** Entre threshold_80 e target
- 🟢 **Verde (100-119%):** Entre target e threshold_120
- 🔵 **Azul (120%):** Acima do threshold_120 (capped)

#### **Cálculo:**
```typescript
// Normal (maior é melhor)
if (value < threshold_80) return 0;
if (value >= threshold_120) return 120;
if (value >= target) {
  // Entre target e threshold_120: 100-120%
  return 100 + ((value - target) / (threshold_120 - target)) * 20;
}
// Entre threshold_80 e target: 80-100%
return 80 + ((value - threshold_80) / (target - threshold_80)) * 20;

// Inverse (menor é melhor) - lógica invertida
```

#### **Score Ponderado:**
```typescript
score_geral = Σ(score_indicator * weight) / Σ(weight)
```

---

### **3. Tipos de Métricas**

- **`number`:** Número simples (ex: 100 unidades)
- **`percentage`:** Percentual (ex: 85%)
- **`boolean`:** Sim/Não (ex: 1 = Sim, 0 = Não)
- **`currency`:** Moeda (ex: R$ 50.000,00)

---

### **4. Tipos de Consolidação**

- **`last_value`:** Usa o último check-in (padrão)
- **`sum`:** Soma todos os check-ins (ex: receita mensal → receita trimestral)
- **`average`:** Média dos check-ins (ex: NPS mensal → NPS trimestral)
- **`manual`:** Usuário atualiza `current_value` manualmente

---

### **5. Check-ins Mensais**

- ✅ Registrar valor mensal
- ✅ Adicionar notas
- ✅ Visualizar histórico
- ✅ Gráfico de evolução
- ✅ Comparar com meta mensal

---

### **6. Múltiplas Vistas**

#### **Menu Principal:**
- ✅ **Meus Indicadores** (`/`) - Dashboard pessoal
- ✅ **Minha Equipe** (`/team`) - Indicadores da equipe
- ✅ **Visão Geral** (`/overview`) - Visão consolidada
- ✅ **Histórico** (`/history`) - Histórico de check-ins

#### **Administração (apenas Admin):**
- ✅ **Cargos** (`/admin/positions`) - Gerenciar cargos
- ✅ **Setores** (`/admin/sectors`) - Gerenciar setores
- ✅ **Usuários** (`/admin/users`) - Gerenciar usuários

---

### **7. Templates de Indicadores por Cargo**

- ✅ Criar templates de indicadores para cada cargo
- ✅ Quando usuário tem um cargo, pode criar indicadores baseados nos templates
- ✅ Metas mensais podem ser sincronizadas do template
- ✅ Alertar quando template foi atualizado

---

### **8. Indicadores Inversos**

- ✅ Alguns indicadores são "inversos" (menor é melhor)
- ✅ Exemplo: Turnover, Tempo médio de resposta
- ✅ Cálculo de score é invertido

---

### **9. Planos de Recuperação**

- ✅ Criar planos quando indicador está em risco
- ✅ Ações do plano de recuperação
- ✅ Acompanhamento de status

---

## 🔧 **Implementação Técnica**

### **Backend (Node.js/Express):**

#### **Endpoints Necessários:**

```javascript
// Indicadores
GET    /api/indicators                    // Listar indicadores do usuário
GET    /api/indicators/:id                // Detalhes de um indicador
POST   /api/indicators                    // Criar indicador
PUT    /api/indicators/:id                // Atualizar indicador
DELETE /api/indicators/:id                // Deletar indicador

// Check-ins
GET    /api/indicators/:id/check-ins      // Listar check-ins
POST   /api/indicators/:id/check-ins      // Criar check-in
PUT    /api/check-ins/:id                 // Atualizar check-in
DELETE /api/check-ins/:id                 // Deletar check-in

// Templates (Position Indicators)
GET    /api/position-indicators          // Listar templates do cargo
POST   /api/position-indicators          // Criar template (admin)
PUT    /api/position-indicators/:id      // Atualizar template (admin)
DELETE /api/position-indicators/:id     // Deletar template (admin)

// Cargos
GET    /api/positions                    // Listar cargos
POST   /api/positions                    // Criar cargo (admin)
PUT    /api/positions/:id                // Atualizar cargo (admin)
DELETE /api/positions/:id                // Deletar cargo (admin)

// Setores
GET    /api/sectors                      // Listar setores
POST   /api/sectors                      // Criar setor (admin)
PUT    /api/sectors/:id                  // Atualizar setor (admin)
DELETE /api/sectors/:id                  // Deletar setor (admin)

// Dashboard
GET    /api/dashboard/stats               // Estatísticas do dashboard
GET    /api/dashboard/team               // Indicadores da equipe
GET    /api/dashboard/overview           // Visão geral consolidada
```

---

### **Frontend (React):**

#### **Componentes Principais:**

```
src/components/indicators/
├── Dashboard.tsx              // Dashboard principal
├── IndicatorCard.tsx          // Card de indicador
├── IndicatorDetail.tsx        // Detalhes do indicador
├── CheckInCard.tsx            // Card de check-in
├── MonthlyCheckInDialog.tsx   // Dialog de criar/editar check-in
├── ScoreProgressBar.tsx       // Barra de progresso com score
├── TrafficLightBadge.tsx      // Badge de traffic light
└── PersonCard.tsx             // Card de pessoa (para equipe)

src/components/admin/
├── PositionsPage.tsx          // Gerenciar cargos
├── SectorsPage.tsx            // Gerenciar setores
├── UsersPage.tsx              // Gerenciar usuários
└── PositionIndicatorDialog.tsx // Criar/editar template
```

---

### **Funções Utilitárias:**

```typescript
// lib/indicator-utils.ts
- calculateIndicatorScore()      // Calcula score 0-120
- getTrafficLightColor()         // Retorna cor (red/yellow/green/blue)
- calculatePersonScore()         // Score ponderado
- calculateIndicatorConsolidatedValue() // Consolida check-ins
- formatIndicatorValue()         // Formata valor por tipo
- getCycleMonthRange()           // Retorna meses do ciclo
```

---

## 📝 **Próximos Passos**

### **Fase 1: Estrutura Base**
1. ✅ Criar migrations SQL no Supabase
2. ✅ Criar funções utilitárias de cálculo
3. ✅ Criar endpoints básicos do backend

### **Fase 2: Dashboard**
1. ✅ Implementar Dashboard principal
2. ✅ Cards de resumo
3. ✅ Cards de indicadores
4. ✅ Filtros

### **Fase 3: Funcionalidades Avançadas**
1. ✅ Check-ins mensais
2. ✅ Templates por cargo
3. ✅ Sincronização de metas
4. ✅ Planos de recuperação

### **Fase 4: Vistas Adicionais**
1. ✅ Minha Equipe
2. ✅ Visão Geral
3. ✅ Histórico

### **Fase 5: Administração**
1. ✅ Gerenciar Cargos
2. ✅ Gerenciar Setores
3. ✅ Gerenciar Usuários

---

## 🎯 **Prioridades**

### **Alta Prioridade:**
1. ✅ Estrutura de dados completa
2. ✅ Dashboard com cards de resumo
3. ✅ Sistema de scoring (traffic light)
4. ✅ Check-ins mensais

### **Média Prioridade:**
1. ✅ Templates por cargo
2. ✅ Múltiplas vistas
3. ✅ Indicadores inversos

### **Baixa Prioridade:**
1. ✅ Planos de recuperação
2. ✅ Comentários
3. ✅ Histórico detalhado

---

**Última atualização:** 2026-01-27

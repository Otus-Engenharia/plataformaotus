# 🎯 Guia: Configurar OKRs e Indicadores no Supabase

## 📋 **Pré-requisitos**
- Acesso ao Supabase Dashboard
- Projeto Supabase ativo

---

## 🚀 **Passo a Passo**

### **1. Acessar o SQL Editor no Supabase**

1. Entre no [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **"SQL Editor"**
4. Clique em **"New query"**

---

### **2. Executar o Script SQL**

1. Abra o arquivo `docs/TABELAS_OKRS_INDICADORES.sql`
2. Copie **TODO** o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **"Run"** (ou pressione `Ctrl+Enter`)

**O script irá criar:**
- ✅ 4 tabelas: `okrs`, `key_results`, `indicadores`, `indicadores_historico`
- ✅ Índices para performance
- ✅ Triggers para atualizar progresso automaticamente
- ✅ Funções de cálculo de tendência
- ✅ Políticas de segurança (RLS)
- ✅ Dados de exemplo

---

### **3. Verificar se as Tabelas foram Criadas**

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver as seguintes tabelas:
   - `okrs`
   - `key_results`
   - `indicadores`
   - `indicadores_historico`

---

### **4. Verificar Dados de Exemplo**

1. Clique na tabela **`okrs`**
2. Você deve ver 3 OKRs de exemplo:
   - Aumentar satisfação do cliente
   - Melhorar eficiência operacional
   - Expandir portfólio de clientes

3. Clique na tabela **`indicadores`**
4. Você deve ver 6 indicadores de exemplo

---

## 📊 **Estrutura das Tabelas**

### **Tabela: `okrs`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT | ID único |
| titulo | TEXT | Título do OKR |
| descricao | TEXT | Descrição detalhada |
| nivel | TEXT | `empresa`, `time` ou `individual` |
| responsavel | TEXT | Nome do responsável |
| quarter | TEXT | Trimestre (ex: Q1-2025) |
| progresso | NUMERIC | Progresso em % (0-100) |
| status | TEXT | `ativo`, `concluido`, `cancelado`, `pausado` |
| data_inicio | DATE | Data de início |
| data_fim | DATE | Data de término |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |
| created_by | TEXT | Usuário que criou |

---

### **Tabela: `key_results`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT | ID único |
| okr_id | BIGINT | ID do OKR pai |
| descricao | TEXT | Descrição do resultado |
| progresso | NUMERIC | Progresso em % (0-100) |
| meta | NUMERIC | Valor meta |
| atual | NUMERIC | Valor atual |
| unidade | TEXT | Unidade (%, dias, pontos, etc.) |
| responsavel | TEXT | Nome do responsável |
| data_inicio | DATE | Data de início |
| data_fim | DATE | Data de término |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

---

### **Tabela: `indicadores`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT | ID único |
| nome | TEXT | Nome do indicador |
| descricao | TEXT | Descrição detalhada |
| valor | NUMERIC | Valor atual |
| meta | NUMERIC | Valor meta |
| unidade | TEXT | Unidade (%, dias, pontos, etc.) |
| categoria | TEXT | `projetos`, `financeiro`, `operacional`, `pessoas`, `comercial` |
| tendencia | TEXT | `up`, `down`, `stable` |
| periodo | TEXT | `mensal`, `trimestral`, `anual` |
| data_referencia | DATE | Data de referência |
| responsavel | TEXT | Nome do responsável |
| formula | TEXT | Fórmula de cálculo (opcional) |
| ativo | BOOLEAN | Indicador ativo? |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

---

### **Tabela: `indicadores_historico`**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGINT | ID único |
| indicador_id | BIGINT | ID do indicador |
| valor | NUMERIC | Valor registrado |
| meta | NUMERIC | Meta na data |
| data | DATE | Data do registro |
| observacao | TEXT | Observações |
| created_at | TIMESTAMP | Data de criação |

---

## 🔄 **Funcionalidades Automáticas**

### **1. Atualização Automática de Progresso do OKR**
Quando você atualiza o progresso de um **Key Result**, o progresso do **OKR pai** é automaticamente recalculado (média dos Key Results).

### **2. Timestamp Automático**
O campo `updated_at` é automaticamente atualizado sempre que um registro é modificado.

### **3. Cálculo de Tendência**
Use a função `calcular_tendencia_indicador(p_indicador_id)` para calcular automaticamente se um indicador está subindo, descendo ou estável.

---

## 🔐 **Segurança (RLS)**

As políticas de segurança estão configuradas para:
- ✅ **Todos usuários autenticados** podem **ler** (SELECT)
- ✅ **Todos usuários autenticados** podem **criar, editar e deletar** (INSERT, UPDATE, DELETE)

**Para restringir por cargo/permissão**, edite as políticas no Supabase:
1. Vá em **"Authentication" > "Policies"**
2. Edite as políticas de cada tabela
3. Adicione condições baseadas no `user_metadata` ou outra lógica

---

## 🧪 **Testando as Tabelas**

### **Exemplo 1: Listar todos os OKRs**
```sql
SELECT * FROM public.okrs;
```

### **Exemplo 2: Listar Key Results de um OKR específico**
```sql
SELECT * FROM public.key_results WHERE okr_id = 1;
```

### **Exemplo 3: Listar Indicadores por categoria**
```sql
SELECT * FROM public.indicadores WHERE categoria = 'projetos';
```

### **Exemplo 4: Ver histórico de um indicador**
```sql
SELECT * FROM public.indicadores_historico 
WHERE indicador_id = 1 
ORDER BY data DESC;
```

### **Exemplo 5: Calcular tendência de um indicador**
```sql
SELECT calcular_tendencia_indicador(1);
```

---

## 📝 **Próximos Passos**

Depois de criar as tabelas no Supabase, você precisa:

1. ✅ **Criar endpoints no backend** (`backend/server.js`)
   - `GET /api/okrs` - Listar OKRs
   - `POST /api/okrs` - Criar OKR
   - `PUT /api/okrs/:id` - Atualizar OKR
   - `DELETE /api/okrs/:id` - Deletar OKR
   - Similar para `key_results` e `indicadores`

2. ✅ **Conectar o frontend** (os componentes já existem em `frontend/src/components/`)
   - `OKRsView.jsx` já está preparado
   - `IndicadoresView.jsx` já está preparado

3. ✅ **Testar a aplicação**

---

## 🆘 **Problemas Comuns**

### **Erro: "permission denied for table okrs"**
**Solução:** Verifique se as políticas RLS foram criadas corretamente.

### **Erro: "relation okrs does not exist"**
**Solução:** Execute o script SQL novamente.

### **Dados de exemplo não aparecem**
**Solução:** Verifique se o script foi executado completamente (até o final).

---

## 📚 **Documentação Adicional**

- [Supabase SQL Editor](https://supabase.com/docs/guides/database/sql-editor)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)

---

**🎯 Pronto! Agora você tem a estrutura completa de OKRs e Indicadores no Supabase!**

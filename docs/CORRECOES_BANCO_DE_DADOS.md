# Correções de Banco de Dados

Este documento lista todas as alterações estruturais pendentes nas tabelas do Supabase.

---

## Tabela: feedbacks

### Resumo das Correções

| # | Correção | Situação Atual | Correção Proposta |
|---|----------|----------------|-------------------|
| 1 | Alterar tipo do `id` | UUID | BIGINT auto-increment (usando valor do code) |
| 2 | Remover coluna `code` | Existe (FB-001, FB-002...) | Remover (frontend exibirá FB-{id}) |
| 3 | Adicionar `feedback_id` | Não existe | FK para feedbacks.id (auto-referência) |

---

### Passo 1: Verificação de Dados

**IMPORTANTE:** Fazer backup da tabela antes de executar!

```sql
-- 1.1 Verificar se todos os codes seguem o padrão FB-XXX
SELECT id, code
FROM feedbacks
WHERE code NOT LIKE 'FB-%' OR code IS NULL;

-- 1.2 Verificar se há códigos duplicados
SELECT code, COUNT(*) as qtd
FROM feedbacks
GROUP BY code
HAVING COUNT(*) > 1;

-- 1.3 Verificar se os números extraídos são únicos
SELECT
  CAST(REPLACE(code, 'FB-', '') AS INTEGER) as num_extraido,
  COUNT(*) as qtd
FROM feedbacks
GROUP BY num_extraido
HAVING COUNT(*) > 1;

-- 1.4 Ver o maior número atual (para configurar sequence)
SELECT MAX(CAST(REPLACE(code, 'FB-', '') AS INTEGER)) as maior_id
FROM feedbacks;
```

**Resultados esperados:**
- Query 1.1: Nenhum resultado (todos seguem padrão)
- Query 1.2: Nenhum resultado (sem duplicados)
- Query 1.3: Nenhum resultado (números únicos)
- Query 1.4: Retorna o maior ID atual

---

### Passo 2: Migração

**Somente execute se o Passo 1 não retornou problemas!**

```sql
-- 2.1 Adicionar nova coluna
ALTER TABLE feedbacks ADD COLUMN new_id BIGINT;

-- 2.2 Popular nova coluna com números extraídos do code
UPDATE feedbacks
SET new_id = CAST(REPLACE(code, 'FB-', '') AS BIGINT);

-- 2.3 Verificar se todos foram populados
SELECT COUNT(*) FROM feedbacks WHERE new_id IS NULL;

-- 2.4 Remover constraint de PK antiga
ALTER TABLE feedbacks DROP CONSTRAINT feedbacks_pkey;

-- 2.5 Remover coluna id antiga (UUID)
ALTER TABLE feedbacks DROP COLUMN id;

-- 2.6 Renomear new_id para id
ALTER TABLE feedbacks RENAME COLUMN new_id TO id;

-- 2.7 Adicionar constraint de PK
ALTER TABLE feedbacks ADD PRIMARY KEY (id);

-- 2.8 Criar sequence para auto-increment (substituir [MAIOR_ID + 1] pelo valor real)
CREATE SEQUENCE feedbacks_id_seq START WITH [MAIOR_ID + 1];
ALTER TABLE feedbacks ALTER COLUMN id SET DEFAULT nextval('feedbacks_id_seq');

-- 2.9 Remover coluna code
ALTER TABLE feedbacks DROP COLUMN code;
```

---

### Passo 3: Adicionar feedback_id (auto-referência)

```sql
-- 3.1 Adicionar coluna para menções entre feedbacks
ALTER TABLE feedbacks
ADD COLUMN feedback_id BIGINT REFERENCES feedbacks(id) ON DELETE SET NULL;

-- 3.2 Criar índice para performance
CREATE INDEX idx_feedbacks_feedback_id ON feedbacks(feedback_id);
```

---

### Passo 4: Verificação Final

```sql
-- Verificar estrutura final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'feedbacks'
ORDER BY ordinal_position;
```

**Estrutura esperada:**
- `id` (bigint, NOT NULL, PK, auto-increment)
- `feedback_id` (bigint, nullable, FK)
- demais colunas...

---

### Checklist de Status

- [ ] Passo 1 executado e validado
- [ ] Passo 2 executado
- [ ] Passo 3 executado
- [ ] Passo 4 verificado
- [ ] Código backend atualizado
- [ ] Código frontend atualizado

---

### Arquivos a Atualizar Após Migração

**Backend:**
- `backend/supabase.js`: Remover lógica de geração de code em `createFeedback()`

**Frontend:**
- `frontend/src/components/feedbacks/MentionInput.jsx`: Usar `FB-${id}`
- `frontend/src/components/feedbacks/FeedbackCard.jsx`: Usar `FB-${id}`
- `frontend/src/components/feedbacks/FeedbackDetailDialog.jsx`: Usar `FB-${id}`
- `frontend/src/pages/feedbacks/FeedbackKanbanView.jsx`: Atualizar busca por menções

---

## Tabela: indicadores

| # | Correção | Situação Atual | Correção Proposta |
|---|----------|----------------|-------------------|
| 1 | Remover dados repetidos | Informações duplicadas de `position_indicators` | Manter apenas FK `position_indicator_id` |

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-02-04 | Documento criado com correções da tabela feedbacks |
| 2026-02-04 | Adicionada correção da tabela indicadores |
| 2026-02-04 | Adicionado plano detalhado de migração para feedbacks |

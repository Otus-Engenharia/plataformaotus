# Relatório de Problemas no Pipeline de Custos

**Data:** 04/02/2026
**Período analisado:** Novembro 2025
**Status:** AÇÃO NECESSÁRIA

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Usuários com salário | 39 |
| Usuários com horas | 40 |
| Total folha de pagamento | R$ 206.910 |
| Total custos alocados | R$ 291.724 |
| **Custos NÃO alocados** | **R$ 51.190** |

---

## 1. Usuários com Salário SEM Horas Registradas

Estes usuários recebem salário mas não têm horas registradas no Timetracker, resultando em **custos não alocados a projetos**.

| Usuário | Salário Mensal | Horas | Status |
|---------|---------------|-------|--------|
| Estevão Goulart | R$ 10.500 | 0 | Nome diferente no Timetracker |
| Anna Bastos | R$ 7.600 | 0 | Nome diferente no Timetracker |
| Alicia Paim | R$ 7.150 | 0 | Nome diferente no Timetracker |
| André Reis | R$ 6.300 | 0 | Nome diferente no Timetracker |
| Douglas Santos | R$ 6.000 | 0 | Nome diferente no Timetracker |
| Débora Caon | R$ 4.800 | 0 | Nome diferente no Timetracker |
| Gusthavo Braga | R$ 4.440 | 0 | Nome diferente no Timetracker |
| Gisele Brugnera | R$ 4.400 | 0 | Possível erro de cadastro |

**Total não alocado: R$ 51.190/mês**

---

## 2. Problemas de Nomenclatura (JOIN Falhou)

O sistema faz JOIN pelo nome do usuário. Quando os nomes são diferentes entre a planilha de custos e o Timetracker, o custo não é alocado.

### Mapeamento Identificado:

| Nome na Planilha (Custos) | Nome no Timetracker | Problema |
|---------------------------|---------------------|----------|
| `Anna Bastos` | `Anna Luiza Bastos` | Nome incompleto |
| `Alicia Paim` | `Alicia Emanoele Paim` | Nome incompleto |
| `André Reis` | `Andre Reis` | Acento |
| `Douglas Santos` | `Douglas R. dos Santos` | Abreviação diferente |
| `Débora Caon` | `Debora Caon` | Acento |
| `Gusthavo Braga` | `Luiz Gusthavo Braga` | Primeiro nome diferente |
| `Gisele Brugnera` | `Gisele Carraro` | Sobrenome diferente |
| `Estevão Goulart` | `Estevao Goulart` | Acento |

### Usuários SEM match no Timetracker (nunca trabalharam):
- Melissa Xavier
- Polyana Ramos Araújo
- Rafael Bortnik Leivas

---

## 3. Usuários com Horas SEM Salário

Estes usuários têm horas registradas mas não aparecem na planilha de custos (provavelmente problema de nome).

| Usuário no Timetracker | Horas (Nov/25) | Provável Match |
|------------------------|----------------|----------------|
| Gisele Carraro | 141,5h | Gisele Brugnera? |
| Douglas R. dos Santos | 118,5h | Douglas Santos |
| Debora Caon | 117h | Débora Caon |
| Mayara Guimaraes | 104h | Novo? Verificar |
| Alicia Emanoele Paim | 103,5h | Alicia Paim |
| Anna Luiza Bastos | 89,5h | Anna Bastos |
| Andre Reis | 82,5h | André Reis |
| Luiz Gusthavo Braga | 34,5h | Gusthavo Braga |
| Felipe Simoni | 1,5h | Novo? Verificar |

---

## 4. Ações Recomendadas

### Ação Imediata (Financeiro)

1. **Padronizar nomes na planilha de custos** para corresponder exatamente aos nomes no Timetracker

2. **Correções sugeridas:**

| Alterar de | Para |
|------------|------|
| Anna Bastos | Anna Luiza Bastos |
| Alicia Paim | Alicia Emanoele Paim |
| André Reis | Andre Reis |
| Douglas Santos | Douglas R. dos Santos |
| Débora Caon | Debora Caon |
| Gusthavo Braga | Luiz Gusthavo Braga |
| Gisele Brugnera | Gisele Carraro |
| Estevão Goulart | Estevao Goulart |

### Ação Técnica (TI)

1. **Criar tabela de mapeamento** `usuario_alias` para fazer match mesmo com nomes diferentes
2. **Implementar validação** que alerta quando um usuário tem salário mas 0 horas
3. **Atualizar dados** de Dezembro 2025 em diante

### Ação de Processo

1. **Definir fonte única** para nomes de usuários (ex: sempre usar o nome do Timetracker)
2. **Criar checklist mensal** para verificar inconsistências antes de rodar o pipeline

---

## 5. Impacto Financeiro

### Cenário Atual (Nov/2025)
- **R$ 51.190/mês** de custos não alocados a projetos
- Representa **~25% da folha** sem rastreabilidade por projeto
- Projetos podem parecer mais lucrativos do que realmente são

### Após Correção
- 100% dos custos serão alocados aos projetos
- Visão real de rentabilidade por projeto
- Melhor tomada de decisão

---

## 6. Dados Desatualizados

### Período sem dados de custo:
- Dezembro 2025
- Janeiro 2026
- Fevereiro 2026

**Causa:** Planilha de custos não foi atualizada pelo Financeiro.

**Impacto:** Curva S mostra apenas horas, sem custos, para projetos neste período.

---

## Anexo: Query de Validação

Para verificar problemas de nomenclatura, executar no BigQuery:

```sql
-- Usuários com salário sem horas
WITH salarios AS (
  SELECT DISTINCT Nome_do_fornecedor_cliente as usuario, Valor
  FROM `dadosindicadores.financeiro_custos_operacao.custos_operacao_diretos`
  WHERE M__s = '2025-11-01' AND Valor IS NOT NULL
),
horas AS (
  SELECT DISTINCT usuario, SUM(horas_usuario_projeto_mes) as total_horas
  FROM `dadosindicadores.financeiro_custos_operacao.custo_usuario_projeto_mes`
  WHERE mes = '2025-11-01'
  GROUP BY usuario
)
SELECT
  s.usuario as usuario_planilha,
  s.Valor as salario,
  h.total_horas
FROM salarios s
LEFT JOIN horas h ON LOWER(TRIM(s.usuario)) = LOWER(TRIM(h.usuario))
WHERE h.total_horas IS NULL OR h.total_horas = 0
ORDER BY s.Valor;
```

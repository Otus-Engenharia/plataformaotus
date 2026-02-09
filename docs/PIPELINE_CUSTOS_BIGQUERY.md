# Pipeline de Cálculo de Custos por Projeto

## Documento para Diretoria

**Versão:** 1.0
**Data:** 04/02/2026
**Autor:** Análise Técnica - Plataforma Otus

---

## 1. Visão Geral

Este documento descreve o processo de cálculo de custos por projeto implementado no BigQuery, que permite alocar os custos de pessoal (diretos e indiretos) para cada projeto com base nas horas trabalhadas.

### Objetivo
Calcular o **custo real** de cada projeto considerando:
- Custos diretos (salários/prestadores de serviço)
- Custos indiretos (softwares, terceiros, benefícios, etc.)
- Distribuição proporcional às horas trabalhadas

---

## 2. Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FONTES DE DADOS                                │
├──────────────────────────────┬──────────────────────────────────────┤
│  CUSTOS DIRETOS              │  CUSTOS INDIRETOS                    │
│  (Planilha Financeiro)       │  (Planilha Financeiro)               │
│  - Salários                  │  - Softwares                         │
│  - Prestadores de Serviço    │  - Terceiros                         │
│  - Bolsas de Estágio         │  - Benefícios                        │
│                              │  - Viagens                           │
│                              │  - Treinamentos                      │
└──────────────────────────────┴──────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    PROCESSAMENTO NO BIGQUERY                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. SALÁRIO PESO USUÁRIO MÊS                                        │
│     ┌─────────────────────────────────────────────────────────────┐ │
│     │ peso_salario = salario_usuario / folha_total_mes            │ │
│     │                                                             │ │
│     │ Exemplo (Nov/2025):                                         │ │
│     │ - Ian Reis: R$ 13.066 / R$ 164.080 = 7,96%                 │ │
│     │ - Ana Carla: R$ 10.500 / R$ 164.080 = 6,40%                │ │
│     └─────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  2. CUSTO INDIRETO USUÁRIO MÊS                                      │
│     ┌─────────────────────────────────────────────────────────────┐ │
│     │ custo_indireto_usuario = custo_indireto_total × peso_salario│ │
│     │                                                             │ │
│     │ Exemplo (Nov/2025):                                         │ │
│     │ Custo indireto total: R$ 127.643                            │ │
│     │ - Ian Reis: R$ 127.643 × 7,96% = R$ 10.160                 │ │
│     │ - Ana Carla: R$ 127.643 × 6,40% = R$ 8.169                 │ │
│     └─────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  3. HORAS POR PROJETO (Timetracker)                                 │
│     ┌─────────────────────────────────────────────────────────────┐ │
│     │ peso_projeto = horas_no_projeto / horas_totais_usuario      │ │
│     │                                                             │ │
│     │ Exemplo:                                                    │ │
│     │ Franco Canani trabalhou 120h no mês:                        │ │
│     │ - Projeto LUMMA: 0,17h → peso = 0,14%                       │ │
│     │ - Projeto EBM: 40h → peso = 33,33%                          │ │
│     └─────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  4. CUSTO POR PROJETO                                               │
│     ┌─────────────────────────────────────────────────────────────┐ │
│     │ custo_direto_projeto = custo_direto_usuario × peso_projeto  │ │
│     │ custo_indireto_projeto = custo_indireto_usuario × peso_proj │ │
│     │ CUSTO_TOTAL = custo_direto + custo_indireto                 │ │
│     │                                                             │ │
│     │ Exemplo (Franco no LUMMA):                                  │ │
│     │ - Custo direto: R$ 7.000 × 0,14% = R$ 9,72                 │ │
│     │ - Custo indireto: R$ 5.445 × 0,14% = R$ 7,56               │ │
│     │ - TOTAL: R$ 17,28                                          │ │
│     └─────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      RESULTADO FINAL                                 │
│  Tabela: financeiro.custo_usuario_projeto_mes                       │
│                                                                      │
│  Campos disponíveis para cada registro:                             │
│  - usuario                                                          │
│  - projeto                                                          │
│  - mes                                                              │
│  - horas_usuario_projeto_mes                                        │
│  - peso_projeto_no_mes                                              │
│  - custo_direto_usuario_projeto_mes                                 │
│  - custo_indireto_usuario_projeto_mes                               │
│  - custo_total_usuario_projeto_mes                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fórmulas Utilizadas

### 3.1 Peso do Salário no Mês
```
peso_salario = salario_usuario / soma_total_salarios_mes
```

**Justificativa:** Quem ganha mais, "carrega" proporcionalmente mais custos indiretos.

### 3.2 Custo Indireto por Usuário
```
custo_indireto_usuario = custo_indireto_total_mes × peso_salario
```

**Justificativa:** Custos indiretos (softwares, infraestrutura, etc.) são rateados proporcionalmente aos salários.

### 3.3 Peso do Projeto
```
peso_projeto = horas_trabalhadas_no_projeto / horas_totais_do_usuario_no_mes
```

**Justificativa:** O custo do usuário é alocado aos projetos de acordo com o tempo dedicado a cada um.

### 3.4 Custo Final por Projeto
```
custo_direto_projeto = custo_direto_usuario × peso_projeto
custo_indireto_projeto = custo_indireto_usuario × peso_projeto
custo_total_projeto = custo_direto_projeto + custo_indireto_projeto
```

---

## 4. Fontes de Dados

| Fonte | Descrição | Atualização |
|-------|-----------|-------------|
| Planilha de Custos (Financeiro) | Salários e custos operacionais | Mensal |
| Timetracker | Horas trabalhadas por projeto | Contínuo |

### Tabelas no BigQuery

| Dataset | Tabela | Função |
|---------|--------|--------|
| `financeiro_custos_operacao` | `custos_operacao_diretos` | Salários por pessoa/mês |
| `financeiro_custos_operacao` | `custos_operacao_indiretos` | Custos indiretos por categoria/mês |
| `financeiro_custos_operacao` | `salario_peso_usuario_mes` | Peso do salário de cada usuário |
| `financeiro_custos_operacao` | `custo_indireto_usuario_mes` | Custo indireto por usuário |
| `financeiro_custos_operacao` | `custo_usuario_projeto_mes` | **Resultado final** |
| `timetracker_transform` | `timetracker_limpo` | Horas por projeto/usuário |

---

## 5. Exemplo Prático

### Novembro 2025

**Dados de entrada:**
- Folha total: R$ 164.080
- Custos indiretos total: R$ 127.643
- 39 usuários com salário
- 40 usuários com horas registradas

**Usuário exemplo: Franco Canani**
- Salário: R$ 7.000
- Peso salário: 7.000 / 164.080 = 4,27%
- Custo indireto alocado: 127.643 × 4,27% = R$ 5.445
- Custo total usuário/mês: R$ 7.000 + R$ 5.445 = **R$ 12.445**

**Projeto exemplo: LUMMA_CORPORATE2**
- Horas de Franco no projeto: 0,17h
- Horas totais de Franco no mês: 120h
- Peso do projeto: 0,17 / 120 = 0,14%
- Custo direto alocado: R$ 7.000 × 0,14% = **R$ 9,72**
- Custo indireto alocado: R$ 5.445 × 0,14% = **R$ 7,56**
- **Custo total do Franco no LUMMA: R$ 17,28**

---

## 6. Categorias de Custos

### 6.1 Custos Diretos
Todas as categorias da tabela `custos_operacao_diretos` são consideradas custos diretos:
| Categoria | Descrição |
|-----------|-----------|
| Pessoas Operações | Salários CLT |
| Prestador de serviço - Engenheiro/Arquiteto | Salários PJ da equipe técnica |
| Bolsa Estágio | Estagiários |
| Férias | Pagamentos de férias |

### 6.2 Custos Indiretos
| Categoria | Total Acumulado |
|-----------|----------------|
| Custo indireto (geral) | R$ 747.122 |
| Softwares Geral Operações | R$ 139.531 |
| Terceiros Operações | R$ 92.240 |
| Custos Gerais Operações | R$ 77.252 |
| Distribuição de Lucros | R$ 61.722 |
| Ferramentas | R$ 37.968 |
| Viagens Operações | R$ 36.449 |
| Treinamentos e Consultorias | R$ 15.887 |

---

## 7. Limitações e Pontos de Atenção

### 7.1 Dados Atualizados até Novembro 2025
Os dados de custo param em novembro 2025. Dezembro 2025 em diante não possuem custos calculados porque a planilha de custos não foi atualizada.

### 7.2 Dependência de Nomenclatura
O sistema depende de que os nomes na planilha de custos (Financeiro) sejam **idênticos** aos nomes no Timetracker. Diferenças causam perda de dados.

### 7.3 Usuários Sem Horas
Usuários que recebem salário mas não registram horas no Timetracker têm seus custos **não alocados** a nenhum projeto.

---

## 8. Schedule de Atualização

| Query | Frequência | Horário |
|-------|------------|---------|
| `timetracker_transform` | Diária | 06:00 |
| `financeiro_custos_operacao` | Diária | 06:00 |
| `financeiro.custo_usuario_projeto_mes_sync` | Diária | 07:00 |

---

## 9. Uso na Plataforma

Os dados de custo são utilizados em:
- **Curva S**: Mostra custo acumulado vs receita por projeto
- **Relatórios de Horas**: Pode mostrar custo associado às horas

### Endpoint da API
```
GET /api/curva-s?projectCode={codigo}
```

---

## 10. Próximos Passos Recomendados

1. **Atualizar planilha de custos** (Dez/2025 em diante)
2. **Padronizar nomes** entre planilha de custos e Timetracker
3. **Criar alerta** para usuários com salário sem horas
4. **Implementar tratamento** de custos não alocados (overhead)

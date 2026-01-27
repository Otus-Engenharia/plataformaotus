# Tabelas de OKRs e Indicadores - Supabase

Este documento descreve a estrutura das tabelas para OKRs e Indicadores no Supabase.

> **📝 Para criar as tabelas:** Execute o script SQL em `SQL_CRIAR_TABELAS_OKRS_INDICADORES.sql` no Supabase SQL Editor.

## Tabela: okrs

Armazena os Objetivos e Resultados Chave (OKRs).

### SQL para criar a tabela

```sql
-- Cria a tabela de OKRs
CREATE TABLE IF NOT EXISTS okrs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('empresa', 'time', 'individual')),
  responsavel VARCHAR(255) NOT NULL,
  quarter VARCHAR(20) NOT NULL,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Cria índices
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_nivel ON okrs(nivel);
CREATE INDEX IF NOT EXISTS idx_okrs_responsavel ON okrs(responsavel);

-- Comentários
COMMENT ON TABLE okrs IS 'Armazena Objetivos e Resultados Chave (OKRs)';
COMMENT ON COLUMN okrs.titulo IS 'Título do objetivo';
COMMENT ON COLUMN okrs.nivel IS 'Nível do OKR: empresa, time ou individual';
COMMENT ON COLUMN okrs.responsavel IS 'Responsável pelo OKR';
COMMENT ON COLUMN okrs.quarter IS 'Trimestre (ex: Q1-2025)';
```

## Tabela: key_results

Armazena os Resultados Chave (Key Results) vinculados aos OKRs.

### SQL para criar a tabela

```sql
-- Cria a tabela de Key Results
CREATE TABLE IF NOT EXISTS key_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  meta NUMERIC(10, 2) NOT NULL,
  atual NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Cria índices
CREATE INDEX IF NOT EXISTS idx_key_results_okr_id ON key_results(okr_id);

-- Comentários
COMMENT ON TABLE key_results IS 'Armazena Resultados Chave (Key Results) dos OKRs';
COMMENT ON COLUMN key_results.okr_id IS 'ID do OKR ao qual este Key Result pertence';
COMMENT ON COLUMN key_results.descricao IS 'Descrição do resultado chave';
COMMENT ON COLUMN key_results.meta IS 'Meta a ser atingida';
COMMENT ON COLUMN key_results.atual IS 'Valor atual do resultado chave';
```

## Tabela: indicadores

Armazena os indicadores e métricas de desempenho.

### SQL para criar a tabela

```sql
-- Cria a tabela de Indicadores
CREATE TABLE IF NOT EXISTS indicadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  valor NUMERIC(10, 2) NOT NULL,
  meta NUMERIC(10, 2) NOT NULL,
  unidade VARCHAR(50) NOT NULL,
  categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('projetos', 'financeiro', 'operacional')),
  periodo VARCHAR(50) NOT NULL DEFAULT 'mensal' CHECK (periodo IN ('mensal', 'trimestral', 'anual')),
  tendencia VARCHAR(20) DEFAULT 'stable' CHECK (tendencia IN ('up', 'down', 'stable')),
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Cria índices
CREATE INDEX IF NOT EXISTS idx_indicadores_categoria ON indicadores(categoria);
CREATE INDEX IF NOT EXISTS idx_indicadores_periodo ON indicadores(periodo);

-- Comentários
COMMENT ON TABLE indicadores IS 'Armazena indicadores e métricas de desempenho';
COMMENT ON COLUMN indicadores.nome IS 'Nome do indicador';
COMMENT ON COLUMN indicadores.valor IS 'Valor atual do indicador';
COMMENT ON COLUMN indicadores.meta IS 'Meta a ser atingida';
COMMENT ON COLUMN indicadores.unidade IS 'Unidade de medida (%, pontos, dias, etc)';
COMMENT ON COLUMN indicadores.categoria IS 'Categoria do indicador';
COMMENT ON COLUMN indicadores.periodo IS 'Período de medição';
COMMENT ON COLUMN indicadores.tendencia IS 'Tendência: up (crescendo), down (diminuindo), stable (estável)';
```

## Exemplos de Uso

### Inserir um OKR

```sql
INSERT INTO okrs (titulo, nivel, responsavel, quarter, created_by)
VALUES (
  'Aumentar satisfação do cliente',
  'empresa',
  'Diretoria',
  'Q1-2025',
  'admin@otusengenharia.com'
)
RETURNING id;
```

### Inserir Key Results para um OKR

```sql
INSERT INTO key_results (okr_id, descricao, meta, atual)
VALUES
  ('<okr_id>', 'Atingir NPS de 80+', 80, 72),
  ('<okr_id>', 'Reduzir tempo de resposta em 30%', 30, 18),
  ('<okr_id>', 'Aumentar taxa de retenção para 95%', 95, 71);
```

### Inserir um Indicador

```sql
INSERT INTO indicadores (nome, valor, meta, unidade, categoria, periodo, tendencia, created_by)
VALUES (
  'Taxa de Conclusão de Projetos',
  85,
  90,
  '%',
  'projetos',
  'mensal',
  'up',
  'admin@otusengenharia.com'
);
```

### Buscar OKRs com Key Results

```sql
SELECT 
  o.*,
  json_agg(
    json_build_object(
      'id', kr.id,
      'descricao', kr.descricao,
      'meta', kr.meta,
      'atual', kr.atual
    )
  ) as key_results
FROM okrs o
LEFT JOIN key_results kr ON kr.okr_id = o.id
WHERE o.quarter = 'Q1-2025'
GROUP BY o.id;
```

## Notas Importantes

1. **Cascade Delete**: Quando um OKR é deletado, todos os seus Key Results são automaticamente deletados (ON DELETE CASCADE).

2. **Constraints**: As tabelas usam CHECK constraints para garantir valores válidos nos campos enum.

3. **Progresso do OKR**: O progresso é calculado automaticamente no backend baseado na média dos progressos dos Key Results.

4. **Índices**: Os índices melhoram a performance das consultas por quarter, nivel, categoria e periodo.

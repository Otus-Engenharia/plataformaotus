-- ============================================
-- Script SQL para criar tabelas de OKRs e Indicadores
-- Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- TABELA: okrs
-- ============================================
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

-- Índices para okrs
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_nivel ON okrs(nivel);
CREATE INDEX IF NOT EXISTS idx_okrs_responsavel ON okrs(responsavel);
CREATE INDEX IF NOT EXISTS idx_okrs_created_at ON okrs(created_at);

-- Comentários
COMMENT ON TABLE okrs IS 'Armazena Objetivos e Resultados Chave (OKRs)';
COMMENT ON COLUMN okrs.titulo IS 'Título do objetivo';
COMMENT ON COLUMN okrs.nivel IS 'Nível do OKR: empresa, time ou individual';
COMMENT ON COLUMN okrs.responsavel IS 'Responsável pelo OKR';
COMMENT ON COLUMN okrs.quarter IS 'Trimestre (ex: Q1-2025)';
COMMENT ON COLUMN okrs.created_by IS 'Email do usuário que criou o OKR';

-- ============================================
-- TABELA: key_results
-- ============================================
CREATE TABLE IF NOT EXISTS key_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  okr_id UUID NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  meta NUMERIC(10, 2) NOT NULL,
  atual NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Índices para key_results
CREATE INDEX IF NOT EXISTS idx_key_results_okr_id ON key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_key_results_created_at ON key_results(created_at);

-- Comentários
COMMENT ON TABLE key_results IS 'Armazena Resultados Chave (Key Results) dos OKRs';
COMMENT ON COLUMN key_results.okr_id IS 'ID do OKR ao qual este Key Result pertence';
COMMENT ON COLUMN key_results.descricao IS 'Descrição do resultado chave';
COMMENT ON COLUMN key_results.meta IS 'Meta a ser atingida';
COMMENT ON COLUMN key_results.atual IS 'Valor atual do resultado chave';

-- ============================================
-- TABELA: indicadores
-- ============================================
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

-- Índices para indicadores
CREATE INDEX IF NOT EXISTS idx_indicadores_categoria ON indicadores(categoria);
CREATE INDEX IF NOT EXISTS idx_indicadores_periodo ON indicadores(periodo);
CREATE INDEX IF NOT EXISTS idx_indicadores_created_at ON indicadores(created_at);

-- Comentários
COMMENT ON TABLE indicadores IS 'Armazena indicadores e métricas de desempenho';
COMMENT ON COLUMN indicadores.nome IS 'Nome do indicador';
COMMENT ON COLUMN indicadores.valor IS 'Valor atual do indicador';
COMMENT ON COLUMN indicadores.meta IS 'Meta a ser atingida';
COMMENT ON COLUMN indicadores.unidade IS 'Unidade de medida (%, pontos, dias, etc)';
COMMENT ON COLUMN indicadores.categoria IS 'Categoria do indicador: projetos, financeiro ou operacional';
COMMENT ON COLUMN indicadores.periodo IS 'Período de medição: mensal, trimestral ou anual';
COMMENT ON COLUMN indicadores.tendencia IS 'Tendência: up (crescendo), down (diminuindo), stable (estável)';
COMMENT ON COLUMN indicadores.created_by IS 'Email do usuário que criou o indicador';

-- ============================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- Descomente as linhas abaixo para inserir dados de exemplo
-- ============================================

/*
-- Inserir OKR de exemplo
INSERT INTO okrs (titulo, nivel, responsavel, quarter, created_by)
VALUES (
  'Aumentar satisfação do cliente',
  'empresa',
  'Diretoria',
  'Q1-2025',
  'admin@otusengenharia.com'
)
RETURNING id;

-- Inserir Key Results de exemplo (substitua <okr_id> pelo ID retornado acima)
INSERT INTO key_results (okr_id, descricao, meta, atual)
VALUES
  ('<okr_id>', 'Atingir NPS de 80+', 80, 72),
  ('<okr_id>', 'Reduzir tempo de resposta em 30%', 30, 18),
  ('<okr_id>', 'Aumentar taxa de retenção para 95%', 95, 71);

-- Inserir Indicadores de exemplo
INSERT INTO indicadores (nome, valor, meta, unidade, categoria, periodo, tendencia, created_by)
VALUES
  ('Taxa de Conclusão de Projetos', 85, 90, '%', 'projetos', 'mensal', 'up', 'admin@otusengenharia.com'),
  ('Satisfação do Cliente (NPS)', 72, 80, 'pontos', 'operacional', 'mensal', 'up', 'admin@otusengenharia.com'),
  ('Margem de Lucro', 18.5, 20, '%', 'financeiro', 'mensal', 'stable', 'admin@otusengenharia.com'),
  ('Tempo Médio de Entrega', 45, 40, 'dias', 'operacional', 'mensal', 'down', 'admin@otusengenharia.com');
*/

-- ============================================
-- VERIFICAÇÃO
-- Execute estas queries para verificar se as tabelas foram criadas corretamente
-- ============================================

-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('okrs', 'key_results', 'indicadores')
ORDER BY table_name;

-- Verificar estrutura da tabela okrs
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'okrs'
ORDER BY ordinal_position;

-- Verificar estrutura da tabela key_results
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'key_results'
ORDER BY ordinal_position;

-- Verificar estrutura da tabela indicadores
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'indicadores'
ORDER BY ordinal_position;

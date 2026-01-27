-- ============================================================
-- PLATAFORMA OTUS - TABELAS DE OKRs E INDICADORES
-- ============================================================
-- Criado em: 2026-01-27
-- Descrição: Estrutura completa para gestão de OKRs e Indicadores
-- ============================================================

-- ============================================================
-- LIMPEZA: Remove tabelas, funções e triggers existentes (se houver)
-- ============================================================
-- ATENÇÃO: Isso irá deletar TODOS os dados das tabelas!
-- Execute apenas se não houver dados importantes.

-- Remove triggers primeiro (dependem das tabelas)
DROP TRIGGER IF EXISTS trigger_update_okr_progress ON public.key_results;
DROP TRIGGER IF EXISTS set_updated_at_okrs ON public.okrs;
DROP TRIGGER IF EXISTS set_updated_at_key_results ON public.key_results;
DROP TRIGGER IF EXISTS set_updated_at_indicadores ON public.indicadores;

-- Remove tabelas (CASCADE remove dependências automaticamente)
DROP TABLE IF EXISTS public.indicadores_historico CASCADE;
DROP TABLE IF EXISTS public.key_results CASCADE;
DROP TABLE IF EXISTS public.okrs CASCADE;
DROP TABLE IF EXISTS public.indicadores CASCADE;

-- Remove funções
DROP FUNCTION IF EXISTS update_okr_progress() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS calcular_tendencia_indicador(BIGINT) CASCADE;

-- ============================================================
-- TABELA: okrs
-- Descrição: Objetivos e Resultados Chave (OKRs)
-- ============================================================
CREATE TABLE public.okrs (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  nivel TEXT NOT NULL CHECK (nivel IN ('empresa', 'time', 'individual')),
  responsavel TEXT NOT NULL,
  quarter TEXT NOT NULL, -- Ex: Q1-2025, Q2-2025
  progresso NUMERIC(5,2) DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'concluido', 'cancelado', 'pausado')),
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_okrs_quarter ON public.okrs(quarter);
CREATE INDEX IF NOT EXISTS idx_okrs_nivel ON public.okrs(nivel);
CREATE INDEX IF NOT EXISTS idx_okrs_status ON public.okrs(status);
CREATE INDEX IF NOT EXISTS idx_okrs_responsavel ON public.okrs(responsavel);

-- Comentários
COMMENT ON TABLE public.okrs IS 'Objetivos e Resultados Chave (OKRs) da empresa';
COMMENT ON COLUMN public.okrs.nivel IS 'Nível do OKR: empresa, time ou individual';
COMMENT ON COLUMN public.okrs.quarter IS 'Trimestre do OKR (ex: Q1-2025)';
COMMENT ON COLUMN public.okrs.progresso IS 'Percentual de progresso do OKR (0-100)';

-- ============================================================
-- TABELA: key_results
-- Descrição: Resultados Chave (KRs) vinculados aos OKRs
-- ============================================================
CREATE TABLE public.key_results (
  id BIGSERIAL PRIMARY KEY,
  okr_id BIGINT NOT NULL REFERENCES public.okrs(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  progresso NUMERIC(5,2) DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  meta NUMERIC(10,2) NOT NULL,
  atual NUMERIC(10,2) DEFAULT 0,
  unidade TEXT, -- Ex: %, dias, pontos, reais
  responsavel TEXT,
  data_inicio DATE,
  data_fim DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_key_results_okr_id ON public.key_results(okr_id);

-- Comentários
COMMENT ON TABLE public.key_results IS 'Resultados Chave (KRs) vinculados aos OKRs';
COMMENT ON COLUMN public.key_results.progresso IS 'Percentual de progresso do KR (0-100)';
COMMENT ON COLUMN public.key_results.meta IS 'Valor meta a ser atingido';
COMMENT ON COLUMN public.key_results.atual IS 'Valor atual alcançado';

-- ============================================================
-- TABELA: indicadores
-- Descrição: Indicadores de desempenho (KPIs)
-- ============================================================
CREATE TABLE public.indicadores (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  meta NUMERIC(10,2) NOT NULL,
  unidade TEXT NOT NULL, -- Ex: %, dias, pontos, reais
  categoria TEXT NOT NULL CHECK (categoria IN ('projetos', 'financeiro', 'operacional', 'pessoas', 'comercial')),
  tendencia TEXT CHECK (tendencia IN ('up', 'down', 'stable')),
  periodo TEXT NOT NULL, -- Ex: mensal, trimestral, anual
  data_referencia DATE DEFAULT CURRENT_DATE,
  responsavel TEXT,
  formula TEXT, -- Fórmula de cálculo (opcional)
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_indicadores_categoria ON public.indicadores(categoria);
CREATE INDEX IF NOT EXISTS idx_indicadores_periodo ON public.indicadores(periodo);
CREATE INDEX IF NOT EXISTS idx_indicadores_ativo ON public.indicadores(ativo);
CREATE INDEX IF NOT EXISTS idx_indicadores_data_referencia ON public.indicadores(data_referencia);

-- Comentários
COMMENT ON TABLE public.indicadores IS 'Indicadores de desempenho (KPIs) da empresa';
COMMENT ON COLUMN public.indicadores.categoria IS 'Categoria: projetos, financeiro, operacional, pessoas, comercial';
COMMENT ON COLUMN public.indicadores.tendencia IS 'Tendência: up (subindo), down (descendo), stable (estável)';
COMMENT ON COLUMN public.indicadores.periodo IS 'Período de medição: mensal, trimestral, anual';

-- ============================================================
-- TABELA: indicadores_historico
-- Descrição: Histórico de valores dos indicadores ao longo do tempo
-- ============================================================
CREATE TABLE public.indicadores_historico (
  id BIGSERIAL PRIMARY KEY,
  indicador_id BIGINT NOT NULL REFERENCES public.indicadores(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  meta NUMERIC(10,2),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_indicadores_historico_indicador_id ON public.indicadores_historico(indicador_id);
CREATE INDEX IF NOT EXISTS idx_indicadores_historico_data ON public.indicadores_historico(data);

-- Comentários
COMMENT ON TABLE public.indicadores_historico IS 'Histórico de valores dos indicadores para análise de tendências';

-- ============================================================
-- FUNÇÃO: Atualizar progresso do OKR baseado nos Key Results
-- ============================================================
CREATE OR REPLACE FUNCTION update_okr_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.okrs
  SET progresso = (
    SELECT COALESCE(AVG(progresso), 0)
    FROM public.key_results
    WHERE okr_id = NEW.okr_id
  ),
  updated_at = NOW()
  WHERE id = NEW.okr_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar progresso do OKR quando um Key Result é modificado
DROP TRIGGER IF EXISTS trigger_update_okr_progress ON public.key_results;
CREATE TRIGGER trigger_update_okr_progress
AFTER INSERT OR UPDATE OR DELETE ON public.key_results
FOR EACH ROW
EXECUTE FUNCTION update_okr_progress();

-- ============================================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS set_updated_at_okrs ON public.okrs;
CREATE TRIGGER set_updated_at_okrs
BEFORE UPDATE ON public.okrs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_key_results ON public.key_results;
CREATE TRIGGER set_updated_at_key_results
BEFORE UPDATE ON public.key_results
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_indicadores ON public.indicadores;
CREATE TRIGGER set_updated_at_indicadores
BEFORE UPDATE ON public.indicadores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNÇÃO: Calcular tendência do indicador
-- ============================================================
CREATE OR REPLACE FUNCTION calcular_tendencia_indicador(p_indicador_id BIGINT)
RETURNS TEXT AS $$
DECLARE
  v_valor_atual NUMERIC;
  v_valor_anterior NUMERIC;
  v_tendencia TEXT;
BEGIN
  -- Pega o valor atual
  SELECT valor INTO v_valor_atual
  FROM public.indicadores
  WHERE id = p_indicador_id;
  
  -- Pega o último valor do histórico (valor anterior)
  SELECT valor INTO v_valor_anterior
  FROM public.indicadores_historico
  WHERE indicador_id = p_indicador_id
  ORDER BY data DESC
  LIMIT 1;
  
  -- Se não tem histórico, retorna stable
  IF v_valor_anterior IS NULL THEN
    RETURN 'stable';
  END IF;
  
  -- Calcula tendência
  IF v_valor_atual > v_valor_anterior THEN
    v_tendencia := 'up';
  ELSIF v_valor_atual < v_valor_anterior THEN
    v_tendencia := 'down';
  ELSE
    v_tendencia := 'stable';
  END IF;
  
  -- Atualiza o indicador
  UPDATE public.indicadores
  SET tendencia = v_tendencia
  WHERE id = p_indicador_id;
  
  RETURN v_tendencia;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.okrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_historico ENABLE ROW LEVEL SECURITY;

-- Política: Todos usuários autenticados podem ler
CREATE POLICY "Permitir leitura para usuários autenticados - okrs"
ON public.okrs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir leitura para usuários autenticados - key_results"
ON public.key_results FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir leitura para usuários autenticados - indicadores"
ON public.indicadores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir leitura para usuários autenticados - indicadores_historico"
ON public.indicadores_historico FOR SELECT
TO authenticated
USING (true);

-- Política: Todos usuários autenticados podem inserir/atualizar/deletar
-- (Pode ser refinado depois para restringir por cargo/permissão)
CREATE POLICY "Permitir INSERT para usuários autenticados - okrs"
ON public.okrs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE para usuários autenticados - okrs"
ON public.okrs FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Permitir DELETE para usuários autenticados - okrs"
ON public.okrs FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Permitir INSERT para usuários autenticados - key_results"
ON public.key_results FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE para usuários autenticados - key_results"
ON public.key_results FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Permitir DELETE para usuários autenticados - key_results"
ON public.key_results FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Permitir INSERT para usuários autenticados - indicadores"
ON public.indicadores FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE para usuários autenticados - indicadores"
ON public.indicadores FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Permitir DELETE para usuários autenticados - indicadores"
ON public.indicadores FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Permitir INSERT para usuários autenticados - indicadores_historico"
ON public.indicadores_historico FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================
-- DADOS DE EXEMPLO (OPCIONAL - pode remover depois)
-- ============================================================

-- OKRs de exemplo
INSERT INTO public.okrs (titulo, descricao, nivel, responsavel, quarter, progresso, status, data_inicio, data_fim, created_by) VALUES
('Aumentar satisfação do cliente', 'Melhorar a experiência do cliente em todos os pontos de contato', 'empresa', 'Diretoria', 'Q1-2025', 75, 'ativo', '2025-01-01', '2025-03-31', 'sistema'),
('Melhorar eficiência operacional', 'Otimizar processos internos para reduzir custos', 'time', 'Time de Projetos', 'Q1-2025', 65, 'ativo', '2025-01-01', '2025-03-31', 'sistema'),
('Expandir portfólio de clientes', 'Aumentar base de clientes ativos', 'empresa', 'Comercial', 'Q1-2025', 55, 'ativo', '2025-01-01', '2025-03-31', 'sistema')
ON CONFLICT DO NOTHING;

-- Key Results de exemplo
INSERT INTO public.key_results (okr_id, descricao, progresso, meta, atual, unidade, responsavel, data_inicio, data_fim) VALUES
(1, 'Atingir NPS de 80+', 90, 80, 72, 'pontos', 'CS', '2025-01-01', '2025-03-31'),
(1, 'Reduzir tempo de resposta em 30%', 60, 30, 18, '%', 'CS', '2025-01-01', '2025-03-31'),
(1, 'Aumentar taxa de retenção para 95%', 75, 95, 71, '%', 'CS', '2025-01-01', '2025-03-31'),
(2, 'Reduzir tempo médio de entrega em 20%', 80, 20, 16, '%', 'Projetos', '2025-01-01', '2025-03-31'),
(2, 'Aumentar taxa de conclusão para 90%', 50, 90, 45, '%', 'Projetos', '2025-01-01', '2025-03-31'),
(3, 'Fechar 10 novos contratos', 60, 10, 6, 'unidades', 'Comercial', '2025-01-01', '2025-03-31'),
(3, 'Aumentar receita recorrente em 25%', 50, 25, 12.5, '%', 'Comercial', '2025-01-01', '2025-03-31')
ON CONFLICT DO NOTHING;

-- Indicadores de exemplo
INSERT INTO public.indicadores (nome, descricao, valor, meta, unidade, categoria, tendencia, periodo, responsavel, ativo) VALUES
('Taxa de Conclusão de Projetos', 'Percentual de projetos concluídos no prazo', 85, 90, '%', 'projetos', 'up', 'mensal', 'Projetos', true),
('Satisfação do Cliente (NPS)', 'Net Promoter Score dos clientes', 72, 80, 'pontos', 'operacional', 'up', 'mensal', 'CS', true),
('Margem de Lucro', 'Margem de lucro líquido', 18.5, 20, '%', 'financeiro', 'stable', 'mensal', 'Financeiro', true),
('Tempo Médio de Entrega', 'Tempo médio de entrega de projetos em dias', 45, 40, 'dias', 'operacional', 'down', 'mensal', 'Projetos', true),
('Taxa de Retenção de Clientes', 'Percentual de clientes que renovam contratos', 88, 95, '%', 'comercial', 'up', 'mensal', 'Comercial', true),
('Horas Produtivas', 'Percentual de horas alocadas em projetos', 75, 80, '%', 'pessoas', 'stable', 'mensal', 'RH', true)
ON CONFLICT DO NOTHING;

-- Histórico de indicadores de exemplo (últimos 3 meses)
INSERT INTO public.indicadores_historico (indicador_id, valor, meta, data) VALUES
(1, 82, 90, '2024-11-01'),
(1, 83, 90, '2024-12-01'),
(1, 85, 90, '2025-01-01'),
(2, 68, 80, '2024-11-01'),
(2, 70, 80, '2024-12-01'),
(2, 72, 80, '2025-01-01'),
(3, 17.8, 20, '2024-11-01'),
(3, 18.2, 20, '2024-12-01'),
(3, 18.5, 20, '2025-01-01')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================

-- Tabelas para o dominio de Estudos de Custos (Solicitacao para CS)
-- Executar no Supabase SQL Editor

-- Tabela principal de solicitacoes de estudo de custos
CREATE TABLE IF NOT EXISTS estudos_custos (
  id BIGSERIAL PRIMARY KEY,
  projeto TEXT NOT NULL,
  nome_time TEXT,
  status_fase TEXT,
  construflow_id TEXT,
  link_construflow TEXT,
  link_estudo_custos TEXT,
  data_prevista_apresentacao DATE,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'em_progresso', 'aguardando_info', 'finalizado', 'recusado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  author_id TEXT NOT NULL,
  assigned_to TEXT,
  resolved_by_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de comentarios das solicitacoes
CREATE TABLE IF NOT EXISTS estudo_custo_comentarios (
  id BIGSERIAL PRIMARY KEY,
  estudo_custo_id BIGINT NOT NULL REFERENCES estudos_custos(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'comentario' CHECK (tipo IN ('comentario', 'status_change', 'atribuicao')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_estudos_custos_status ON estudos_custos(status);
CREATE INDEX IF NOT EXISTS idx_estudos_custos_author ON estudos_custos(author_id);
CREATE INDEX IF NOT EXISTS idx_estudos_custos_assigned ON estudos_custos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_estudos_custos_created ON estudos_custos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estudos_custos_projeto ON estudos_custos(projeto);
CREATE INDEX IF NOT EXISTS idx_estudo_custo_comentarios_estudo ON estudo_custo_comentarios(estudo_custo_id);
CREATE INDEX IF NOT EXISTS idx_estudo_custo_comentarios_created ON estudo_custo_comentarios(created_at ASC);

-- RLS (Row Level Security)
ALTER TABLE estudos_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudo_custo_comentarios ENABLE ROW LEVEL SECURITY;

-- Politicas para estudos_custos
CREATE POLICY "estudos_custos_select_all" ON estudos_custos FOR SELECT USING (true);
CREATE POLICY "estudos_custos_insert_authenticated" ON estudos_custos FOR INSERT WITH CHECK (true);
CREATE POLICY "estudos_custos_update_all" ON estudos_custos FOR UPDATE USING (true);
CREATE POLICY "estudos_custos_delete_all" ON estudos_custos FOR DELETE USING (true);

-- Politicas para comentarios
CREATE POLICY "estudo_custo_comentarios_select_all" ON estudo_custo_comentarios FOR SELECT USING (true);
CREATE POLICY "estudo_custo_comentarios_insert_authenticated" ON estudo_custo_comentarios FOR INSERT WITH CHECK (true);
CREATE POLICY "estudo_custo_comentarios_delete_all" ON estudo_custo_comentarios FOR DELETE USING (true);

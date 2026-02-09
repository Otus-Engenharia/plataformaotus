-- Tabelas para o domínio de Demandas (Apoio de Projetos)
-- Executar no Supabase SQL Editor

-- Tabela principal de demandas
CREATE TABLE IF NOT EXISTS demandas (
  id BIGSERIAL PRIMARY KEY,
  categoria TEXT NOT NULL CHECK (categoria IN ('ajuste_pastas', 'modelo_federado', 'modelagem')),
  tipo_servico TEXT CHECK (tipo_servico IN ('modelagem_compatibilizacao', 'pranchas_alvenaria', 'pranchas_furacao', 'unir_markups', 'quantitativo', 'outro')),
  tipo_servico_outro TEXT,
  coordenador_projeto TEXT NOT NULL,
  cliente_projeto TEXT NOT NULL,
  acesso_cronograma BOOLEAN DEFAULT false,
  link_cronograma TEXT,
  acesso_drive BOOLEAN DEFAULT false,
  link_drive TEXT,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'em_progresso', 'aguardando_info', 'finalizado', 'recusado')),
  prioridade TEXT DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  author_id TEXT NOT NULL,
  assigned_to TEXT,
  resolved_by_id TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de comentários das demandas
CREATE TABLE IF NOT EXISTS demanda_comentarios (
  id BIGSERIAL PRIMARY KEY,
  demanda_id BIGINT NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'comentario' CHECK (tipo IN ('comentario', 'status_change', 'atribuicao')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_demandas_status ON demandas(status);
CREATE INDEX IF NOT EXISTS idx_demandas_author ON demandas(author_id);
CREATE INDEX IF NOT EXISTS idx_demandas_assigned ON demandas(assigned_to);
CREATE INDEX IF NOT EXISTS idx_demandas_created ON demandas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demandas_categoria ON demandas(categoria);
CREATE INDEX IF NOT EXISTS idx_demanda_comentarios_demanda ON demanda_comentarios(demanda_id);
CREATE INDEX IF NOT EXISTS idx_demanda_comentarios_created ON demanda_comentarios(created_at ASC);

-- RLS (Row Level Security)
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE demanda_comentarios ENABLE ROW LEVEL SECURITY;

-- Políticas para demandas
CREATE POLICY "demandas_select_all" ON demandas FOR SELECT USING (true);
CREATE POLICY "demandas_insert_authenticated" ON demandas FOR INSERT WITH CHECK (true);
CREATE POLICY "demandas_update_all" ON demandas FOR UPDATE USING (true);
CREATE POLICY "demandas_delete_all" ON demandas FOR DELETE USING (true);

-- Políticas para comentários
CREATE POLICY "comentarios_select_all" ON demanda_comentarios FOR SELECT USING (true);
CREATE POLICY "comentarios_insert_authenticated" ON demanda_comentarios FOR INSERT WITH CHECK (true);
CREATE POLICY "comentarios_delete_all" ON demanda_comentarios FOR DELETE USING (true);

-- ============================================
-- Domínio: Relatos (Diário de Projeto)
-- ============================================

-- Tabela de tipos de relato (admin-configurável)
CREATE TABLE IF NOT EXISTS relato_tipos (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  icon VARCHAR(50) DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de prioridades de relato (admin-configurável)
CREATE TABLE IF NOT EXISTS relato_prioridades (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela principal de relatos
CREATE TABLE IF NOT EXISTS relatos (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(100) NOT NULL,
  tipo_slug VARCHAR(50) NOT NULL REFERENCES relato_tipos(slug),
  prioridade_slug VARCHAR(50) NOT NULL REFERENCES relato_prioridades(slug),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NOT NULL,
  author_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) DEFAULT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_by_id VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_relatos_project_code ON relatos(project_code);
CREATE INDEX IF NOT EXISTS idx_relatos_tipo_slug ON relatos(tipo_slug);
CREATE INDEX IF NOT EXISTS idx_relatos_prioridade_slug ON relatos(prioridade_slug);
CREATE INDEX IF NOT EXISTS idx_relatos_created_at ON relatos(created_at DESC);

-- RLS
ALTER TABLE relatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE relato_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE relato_prioridades ENABLE ROW LEVEL SECURITY;

-- Políticas: leitura para todos, escrita via service role (app layer faz auth)
CREATE POLICY "relatos_select" ON relatos FOR SELECT USING (true);
CREATE POLICY "relatos_insert" ON relatos FOR INSERT WITH CHECK (true);
CREATE POLICY "relatos_update" ON relatos FOR UPDATE USING (true);
CREATE POLICY "relatos_delete" ON relatos FOR DELETE USING (true);

CREATE POLICY "relato_tipos_select" ON relato_tipos FOR SELECT USING (true);
CREATE POLICY "relato_tipos_insert" ON relato_tipos FOR INSERT WITH CHECK (true);
CREATE POLICY "relato_tipos_update" ON relato_tipos FOR UPDATE USING (true);

CREATE POLICY "relato_prioridades_select" ON relato_prioridades FOR SELECT USING (true);
CREATE POLICY "relato_prioridades_insert" ON relato_prioridades FOR INSERT WITH CHECK (true);
CREATE POLICY "relato_prioridades_update" ON relato_prioridades FOR UPDATE USING (true);

-- Seed: Tipos iniciais
INSERT INTO relato_tipos (slug, label, color, icon, sort_order) VALUES
  ('risco', 'Risco', '#EF4444', 'alert-triangle', 1),
  ('decisao', 'Decisão', '#22C55E', 'check-circle', 2),
  ('bloqueio', 'Bloqueio', '#EC4899', 'x-circle', 3),
  ('informativo', 'Informativo', '#3B82F6', 'info', 4)
ON CONFLICT (slug) DO NOTHING;

-- Seed: Prioridades iniciais
INSERT INTO relato_prioridades (slug, label, color, sort_order) VALUES
  ('alta', 'Alta', '#EF4444', 1),
  ('media', 'Média', '#F59E0B', 2),
  ('baixa', 'Baixa', '#6B7280', 3)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Tabelas para Sistema de Pesos da Curva S de Progresso Fisico
-- ============================================================

-- 1. Pesos padrao de fases (soma = 100%)
CREATE TABLE IF NOT EXISTS curva_s_default_phase_weights (
  id BIGSERIAL PRIMARY KEY,
  phase_name TEXT NOT NULL UNIQUE,
  weight_percent NUMERIC(5,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Fatores padrao de disciplinas
CREATE TABLE IF NOT EXISTS curva_s_default_discipline_weights (
  id BIGSERIAL PRIMARY KEY,
  discipline_name TEXT NOT NULL UNIQUE,
  standard_discipline_id BIGINT REFERENCES standard_disciplines(id),
  weight_factor NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Fatores padrao de etapas (atividades)
CREATE TABLE IF NOT EXISTS curva_s_default_activity_weights (
  id BIGSERIAL PRIMARY KEY,
  activity_type TEXT NOT NULL UNIQUE,
  weight_factor NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Overrides por projeto (JSONB)
CREATE TABLE IF NOT EXISTS curva_s_project_weight_overrides (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL UNIQUE,
  phase_weights JSONB,
  discipline_weights JSONB,
  activity_weights JSONB,
  is_customized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curva_s_overrides_project
  ON curva_s_project_weight_overrides(project_code);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE curva_s_default_phase_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE curva_s_default_discipline_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE curva_s_default_activity_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE curva_s_project_weight_overrides ENABLE ROW LEVEL SECURITY;

-- Policies para curva_s_default_phase_weights
CREATE POLICY "select_all" ON curva_s_default_phase_weights FOR SELECT USING (true);
CREATE POLICY "insert_all" ON curva_s_default_phase_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON curva_s_default_phase_weights FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON curva_s_default_phase_weights FOR DELETE USING (true);

-- Policies para curva_s_default_discipline_weights
CREATE POLICY "select_all" ON curva_s_default_discipline_weights FOR SELECT USING (true);
CREATE POLICY "insert_all" ON curva_s_default_discipline_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON curva_s_default_discipline_weights FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON curva_s_default_discipline_weights FOR DELETE USING (true);

-- Policies para curva_s_default_activity_weights
CREATE POLICY "select_all" ON curva_s_default_activity_weights FOR SELECT USING (true);
CREATE POLICY "insert_all" ON curva_s_default_activity_weights FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON curva_s_default_activity_weights FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON curva_s_default_activity_weights FOR DELETE USING (true);

-- Policies para curva_s_project_weight_overrides
CREATE POLICY "select_all" ON curva_s_project_weight_overrides FOR SELECT USING (true);
CREATE POLICY "insert_all" ON curva_s_project_weight_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON curva_s_project_weight_overrides FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON curva_s_project_weight_overrides FOR DELETE USING (true);

-- ============================================================
-- Seed Data
-- ============================================================

-- Fases padrao
INSERT INTO curva_s_default_phase_weights (phase_name, weight_percent, sort_order) VALUES
  ('Estudo Preliminar', 20.00, 1),
  ('Anteprojeto', 20.00, 2),
  ('Pré-executivo', 25.00, 3),
  ('Executivo', 25.00, 4),
  ('Aprovação e Comercial e Material de Venda', 10.00, 5)
ON CONFLICT (phase_name) DO NOTHING;

-- Disciplinas padrao
INSERT INTO curva_s_default_discipline_weights (discipline_name, weight_factor) VALUES
  ('Arquitetura', 4.00),
  ('Coordenação', 4.00),
  ('Estrutura de concreto', 4.00),
  ('Climatização', 3.00),
  ('Preventivo contra incêndio (bombeiros)', 3.00),
  ('Elétrico, dados e SPDA', 3.00),
  ('Hidrossanitário', 3.00),
  ('Fachada - conceito', 3.00),
  ('Paisagismo', 2.00),
  ('Interiores áreas comuns', 2.00),
  ('Contenções', 1.00),
  ('Fundações', 1.00),
  ('Impermeabilização', 1.00),
  ('Irrigação', 1.00),
  ('Luminotécnico', 1.00),
  ('Sonorização', 1.00),
  ('Sondagem', 1.00),
  ('Estudo Geofísico', 1.00)
ON CONFLICT (discipline_name) DO NOTHING;

-- Etapas (atividades) padrao
INSERT INTO curva_s_default_activity_weights (activity_type, weight_factor) VALUES
  ('Lançamento', 2.00),
  ('Ajuste', 1.00)
ON CONFLICT (activity_type) DO NOTHING;

-- Tabela para o quadro compartilhado (Excalidraw)
-- Usa uma única row com id='shared' para o quadro da equipe

CREATE TABLE IF NOT EXISTS whiteboard (
  id TEXT PRIMARY KEY DEFAULT 'shared',
  elements JSONB DEFAULT '[]'::jsonb,
  app_state JSONB DEFAULT '{}'::jsonb,
  files JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Inserir row inicial do quadro compartilhado
INSERT INTO whiteboard (id) VALUES ('shared')
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE whiteboard ENABLE ROW LEVEL SECURITY;

-- Permitir leitura e escrita para usuários autenticados
CREATE POLICY "whiteboard_select" ON whiteboard FOR SELECT TO authenticated USING (true);
CREATE POLICY "whiteboard_update" ON whiteboard FOR UPDATE TO authenticated USING (true);
CREATE POLICY "whiteboard_insert" ON whiteboard FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir acesso via service_role (backend)
CREATE POLICY "whiteboard_service" ON whiteboard FOR ALL TO service_role USING (true);

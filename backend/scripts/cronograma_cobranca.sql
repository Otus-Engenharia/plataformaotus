-- Tabela para controle de "Cobrança feita" no cronograma.
-- Execute no Supabase (SQL Editor) para criar a tabela ANTES de usar o checkbox de cobrança.
-- A aplicação usa esta tabela para persistir quais tarefas já tiveram cobrança feita pelo time.

CREATE TABLE IF NOT EXISTS cronograma_cobranca (
  smartsheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  cobranca_feita BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  PRIMARY KEY (smartsheet_id, row_id)
);

-- Índice para buscas por projeto
CREATE INDEX IF NOT EXISTS idx_cronograma_cobranca_smartsheet
  ON cronograma_cobranca (smartsheet_id);

-- RLS (opcional): descomente e ajuste se usar Row Level Security
-- ALTER TABLE cronograma_cobranca ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role" ON cronograma_cobranca
--   FOR ALL USING (true) WITH CHECK (true);

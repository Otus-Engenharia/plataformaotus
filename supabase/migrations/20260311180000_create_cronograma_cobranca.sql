CREATE TABLE IF NOT EXISTS cronograma_cobranca (
  smartsheet_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  cobranca_feita BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT,
  PRIMARY KEY (smartsheet_id, row_id)
);

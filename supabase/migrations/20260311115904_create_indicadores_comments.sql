CREATE TABLE indicadores_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador_id BIGINT NOT NULL REFERENCES indicadores(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_indicadores_comments_indicador_id ON indicadores_comments(indicador_id);

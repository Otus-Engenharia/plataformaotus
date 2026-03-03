-- Migration 006: Tabela de heartbeats para rastrear tempo de uso da plataforma
-- Cada registro representa "usuário estava ativo" em determinado momento
-- Tempo de tela = COUNT(heartbeats) × 5 minutos por período

CREATE TABLE IF NOT EXISTS user_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE INDEX IF NOT EXISTS idx_user_heartbeats_email_date
  ON user_heartbeats (user_email, date);

CREATE INDEX IF NOT EXISTS idx_user_heartbeats_date
  ON user_heartbeats (date);

COMMENT ON TABLE user_heartbeats IS
  'Registros de atividade do usuário na plataforma. Cada heartbeat = 5 min de uso ativo.';

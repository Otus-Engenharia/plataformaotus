CREATE TABLE IF NOT EXISTS nps_responses (
  id BIGSERIAL PRIMARY KEY,
  project_code TEXT NOT NULL,
  respondent_email TEXT NOT NULL,
  respondent_name TEXT,
  nps_score INTEGER NOT NULL CHECK (nps_score >= 1 AND nps_score <= 10),
  feedback_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'plataforma' CHECK (source IN ('plataforma', 'google_forms', 'externo')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nps_responses_project ON nps_responses (project_code);
CREATE INDEX idx_nps_responses_source ON nps_responses (source);
CREATE INDEX idx_nps_responses_created ON nps_responses (created_at DESC);

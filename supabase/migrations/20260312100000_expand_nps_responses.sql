-- Expandir tabela nps_responses para suportar pesquisas completas de fechamento de fase
-- Adiciona CSAT, CES, dados do entrevistado e empresa cliente

ALTER TABLE nps_responses
  ALTER COLUMN nps_score DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS csat_score INTEGER CHECK (csat_score >= 0 AND csat_score <= 10),
  ADD COLUMN IF NOT EXISTS ces_score INTEGER CHECK (ces_score >= 0 AND ces_score <= 10),
  ADD COLUMN IF NOT EXISTS client_company TEXT,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS interviewed_person TEXT,
  ADD COLUMN IF NOT EXISTS decision_level TEXT CHECK (decision_level IN ('decisor', 'nao_decisor')),
  DROP CONSTRAINT IF EXISTS nps_responses_nps_score_check;

-- Recriar constraint NPS permitindo 0-10 e NULL
ALTER TABLE nps_responses
  ADD CONSTRAINT nps_responses_nps_score_check CHECK (nps_score >= 0 AND nps_score <= 10);

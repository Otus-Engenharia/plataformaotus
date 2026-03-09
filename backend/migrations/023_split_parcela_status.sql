-- Migration 023: Split status into status_projetos and status_financeiro
-- Separates project tracking (vinculacao) from financial pipeline

-- 1. Add new columns
ALTER TABLE parcelas_pagamento
  ADD COLUMN status_projetos TEXT NOT NULL DEFAULT 'nao_vinculado',
  ADD COLUMN status_financeiro TEXT NOT NULL DEFAULT 'pendente';

-- 2. Add CHECK constraints
ALTER TABLE parcelas_pagamento
  ADD CONSTRAINT chk_status_projetos CHECK (status_projetos IN ('nao_vinculado', 'vinculado')),
  ADD CONSTRAINT chk_status_financeiro CHECK (status_financeiro IN (
    'pendente', 'aguardando_medicao', 'medicao_solicitada',
    'aguardando_faturamento', 'faturado', 'aguardando_recebimento', 'recebido'
  ));

-- 3. Migrate data from old status column
UPDATE parcelas_pagamento SET
  status_projetos = CASE
    WHEN status IN ('aguardando_vinculacao', 'nao_finalizado') THEN 'nao_vinculado'
    ELSE 'vinculado'
  END,
  status_financeiro = CASE
    WHEN status IN ('aguardando_vinculacao', 'nao_finalizado', 'vinculado') THEN 'pendente'
    WHEN status = 'aguardando_medicao' THEN 'aguardando_medicao'
    WHEN status = 'medicao_solicitada' THEN 'medicao_solicitada'
    WHEN status = 'aguardando_recebimento' THEN 'aguardando_recebimento'
    WHEN status = 'recebido' THEN 'recebido'
    ELSE 'pendente'
  END;

-- 4. Drop old column and index
DROP INDEX IF EXISTS idx_parcelas_status;
ALTER TABLE parcelas_pagamento DROP COLUMN status;

-- 5. Create indexes on new columns
CREATE INDEX idx_parcelas_status_projetos ON parcelas_pagamento (status_projetos);
CREATE INDEX idx_parcelas_status_financeiro ON parcelas_pagamento (status_financeiro);

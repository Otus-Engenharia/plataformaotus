-- Corrigir raw_size para BIGINT (valores > 2^31 causam overflow)
ALTER TABLE autodoc_documents ALTER COLUMN raw_size TYPE BIGINT;

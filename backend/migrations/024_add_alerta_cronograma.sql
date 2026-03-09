-- Adiciona coluna de alerta de cronograma nas parcelas
-- Valores possiveis: NULL (sem alerta), 'tarefa_deletada', 'data_alterada'
ALTER TABLE parcelas_pagamento ADD COLUMN alerta_cronograma TEXT DEFAULT NULL;

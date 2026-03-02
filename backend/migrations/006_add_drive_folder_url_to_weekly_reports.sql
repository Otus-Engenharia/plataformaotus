-- Migração: Adicionar coluna drive_folder_url à tabela weekly_reports
-- Data: 2026-03-02
-- Motivo: Commit 1cda608 adicionou suporte à URL da pasta Drive no relatório semanal
--         mas não criou a migration correspondente no banco de dados

ALTER TABLE weekly_reports
ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- Migration: Adicionar status 'replaced' ao CHECK constraint de weekly_reports
-- Contexto: O código (ReportStatus.js) já usa 'replaced' ao regenerar relatórios com force=true,
-- mas o constraint original só permitia ('in_progress', 'completed', 'failed').

ALTER TABLE weekly_reports DROP CONSTRAINT weekly_reports_status_check;

ALTER TABLE weekly_reports ADD CONSTRAINT weekly_reports_status_check
  CHECK (status IN ('in_progress', 'completed', 'failed', 'replaced'));

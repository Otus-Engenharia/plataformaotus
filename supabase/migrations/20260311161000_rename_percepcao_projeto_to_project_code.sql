-- Renomeia projeto_codigo → project_code em cs_percepcao_equipe
-- Alinha com projects.project_code (mesma convenção usada em cs_portfolio_snapshots)

ALTER TABLE cs_percepcao_equipe RENAME COLUMN projeto_codigo TO project_code;

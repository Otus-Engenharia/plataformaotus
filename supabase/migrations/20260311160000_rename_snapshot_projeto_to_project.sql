-- Renomeia colunas de cs_portfolio_snapshots para alinhar com projects.project_code
-- Elimina duplicidade de nomenclatura (projeto_codigo vs project_code)

ALTER TABLE cs_portfolio_snapshots RENAME COLUMN projeto_codigo TO project_code;
ALTER TABLE cs_portfolio_snapshots RENAME COLUMN projeto_nome TO project_name;

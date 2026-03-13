ALTER TABLE project_features
ADD COLUMN IF NOT EXISTS portal_cliente_status TEXT DEFAULT NULL;

COMMENT ON COLUMN project_features.portal_cliente_status IS 'ativo/desativado — controle de visibilidade no portal do cliente';

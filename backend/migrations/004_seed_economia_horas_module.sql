-- Migração: Inserir módulo "Economia de Horas" na tabela modules (sistema unificado)
-- Deve ser executado APÓS a migration 003_create_time_savings.sql
-- Data: 2026-03-02

-- Inserir módulo no sistema unificado de permissões
-- min_access_level: 2 = director para cima (director + dev)
INSERT INTO modules (id, name, description, icon_name, path, color, visible, show_on_home, min_access_level, sort_order, area)
VALUES (
  'economia-horas',
  'Economia de Horas',
  'Métricas de horas economizadas pelas automações da Plataforma',
  'economia',
  '/economia-horas',
  '#10B981',
  true,
  true,
  2,
  90,
  'economia_horas'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  path = EXCLUDED.path,
  color = EXCLUDED.color,
  visible = EXCLUDED.visible,
  show_on_home = EXCLUDED.show_on_home,
  min_access_level = EXCLUDED.min_access_level,
  sort_order = EXCLUDED.sort_order,
  area = EXCLUDED.area;

-- NOTA: Após rodar esta migration, configurar overrides de setor no painel de Permissões:
-- 1. Ir em Configurações > Permissões
-- 2. Na área "economia_horas", habilitar para setores Tecnologia e Diretoria
-- (O min_access_level=2 já garante que só director+ vê, mas o setor precisa estar habilitado)

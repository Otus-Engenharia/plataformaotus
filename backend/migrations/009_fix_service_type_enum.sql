-- Migration 009: Corrigir enum service_type (remover acentos)
-- Valores antigos: 'coordenação', 'compatibilização'
-- Valores novos:   'coordenacao', 'compatibilizacao'

ALTER TYPE service_type RENAME VALUE 'coordenação' TO 'coordenacao';
ALTER TYPE service_type RENAME VALUE 'compatibilização' TO 'compatibilizacao';

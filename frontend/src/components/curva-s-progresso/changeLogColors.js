/**
 * Configuração visual dos tipos de alteração no changelog.
 */

const CHANGE_TYPE_CONFIG = {
  DESVIO_PRAZO: {
    label: 'Desvio de Prazo',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  TAREFA_CRIADA: {
    label: 'Tarefa Adicionada',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  TAREFA_DELETADA: {
    label: 'Tarefa Removida',
    color: '#F97316',
    bgColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  TAREFA_NAO_FEITA: {
    label: 'Não Feita',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
};

function getChangeTypeConfig(type) {
  return CHANGE_TYPE_CONFIG[type] || {
    label: type,
    color: '#6B7280',
    bgColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  };
}

export { CHANGE_TYPE_CONFIG, getChangeTypeConfig };

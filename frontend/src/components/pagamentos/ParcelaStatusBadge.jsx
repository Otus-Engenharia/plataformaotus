import React from 'react';

const STATUS_PROJETOS_CONFIG = {
  nao_vinculado: { label: 'Nao Vinculado', color: '#ff9800', bg: 'rgba(255,152,0,0.12)' },
  vinculado: { label: 'Vinculado', color: '#2196f3', bg: 'rgba(33,150,243,0.12)' },
};

const STATUS_FINANCEIRO_CONFIG = {
  pendente: { label: 'Pendente', color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' },
  aguardando_medicao: { label: 'Aguardando Medicao', color: '#ff5722', bg: 'rgba(255,87,34,0.12)' },
  medicao_solicitada: { label: 'Medicao Solicitada', color: '#9c27b0', bg: 'rgba(156,39,176,0.12)' },
  aguardando_faturamento: { label: 'Aguardando Faturamento', color: '#ff9800', bg: 'rgba(255,152,0,0.12)' },
  faturado: { label: 'Faturado', color: '#2196f3', bg: 'rgba(33,150,243,0.12)' },
  aguardando_recebimento: { label: 'Aguardando Recebimento', color: '#ffc107', bg: 'rgba(255,193,7,0.12)' },
  recebido: { label: 'Pago', color: '#4caf50', bg: 'rgba(76,175,80,0.12)' },
};

const SEM_VINCULACAO_CONFIG = { label: 'Sem Vinculacao', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };

const DEFAULT_CONFIG = { label: '?', color: '#9e9e9e', bg: 'rgba(158,158,158,0.12)' };

export { STATUS_PROJETOS_CONFIG, STATUS_FINANCEIRO_CONFIG };

export default function ParcelaStatusBadge({ status, type = 'financeiro', parcelaSemCronograma }) {
  let config;

  if (parcelaSemCronograma && type === 'projetos' && status !== 'vinculado') {
    config = SEM_VINCULACAO_CONFIG;
  } else if (type === 'projetos') {
    config = STATUS_PROJETOS_CONFIG[status] || { ...DEFAULT_CONFIG, label: status };
  } else {
    config = STATUS_FINANCEIRO_CONFIG[status] || { ...DEFAULT_CONFIG, label: status };
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
      color: config.color,
      background: config.bg,
      whiteSpace: 'nowrap',
    }}>
      {config.label}
    </span>
  );
}

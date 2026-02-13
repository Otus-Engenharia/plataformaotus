import React from 'react';
import { parseAcoes } from '../../../utils/indicator-utils';

const STATUS_CONFIG = {
  pendente: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'Pendente' },
  em_andamento: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', label: 'Em andamento' },
  concluido: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Concluido' },
  cancelado: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Cancelado' },
};

/**
 * Componente compacto inline para exibir recovery plan dentro de um card
 */
export default function RecoveryPlanInline({ plan }) {
  if (!plan) return null;

  const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.pendente;
  const actions = parseAcoes(plan.acoes);
  const completed = actions.filter(a => a.concluida).length;
  const total = actions.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="recovery-inline" style={{ '--rp-color': config.color, '--rp-bg': config.bg }}>
      <div className="recovery-inline__header">
        <span className="recovery-inline__dot" />
        <span className="recovery-inline__status">{config.label}</span>
        {total > 0 && (
          <span className="recovery-inline__count">{completed}/{total} acoes</span>
        )}
      </div>
      {total > 0 && (
        <div className="recovery-inline__progress-track">
          <div
            className="recovery-inline__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

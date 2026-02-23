/**
 * Componente: KPI Cards do Progresso
 * Exibe métricas principais: progresso %, IDP, desvio, prazo base, prazo atual, variação
 */

import React from 'react';

function getIdpColor(idp) {
  if (idp == null) return '#666';
  if (idp >= 1.0) return '#16a34a';
  if (idp >= 0.8) return '#d97706';
  return '#b91c1c';
}

function getIdpLabel(idp) {
  if (idp == null) return 'N/A';
  if (idp >= 1.0) return 'No prazo';
  if (idp >= 0.8) return 'Atenção';
  return 'Atrasado';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ProgressKpiCards({ progress, prazos, loading }) {
  if (loading) {
    return (
      <div className="progress-kpi-strip">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="kpi-chip loading"><span>...</span></div>
        ))}
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="progress-kpi-strip">
        <div className="kpi-chip empty"><span>Sem dados</span></div>
      </div>
    );
  }

  const progressPercent = progress.total_progress || 0;
  const plannedProgress = progress.planned_progress || 0;

  // Preferir IDP/desvio baseados no último baseline, com fallback
  const idp = progress.idp_baseline != null ? progress.idp_baseline : progress.idp;
  const desvio = progress.desvio_baseline != null ? progress.desvio_baseline : progress.desvio;
  const hasBaselineMetrics = progress.idp_baseline != null;

  const prazoBaseline = prazos?.prazo_baseline;
  const prazoBaselineLabel = prazos?.prazo_baseline_label || 'Baseline';
  const prazoAtual = prazos?.prazo_atual;
  const variacaoDias = prazos?.variacao_dias;

  const variacaoColor = variacaoDias != null
    ? (variacaoDias > 0 ? '#b91c1c' : variacaoDias < 0 ? '#16a34a' : '#1a1a1a')
    : '#666';

  const prazoAtualColor = variacaoDias != null && variacaoDias > 0
    ? '#d97706'
    : '#1a1a1a';

  return (
    <div className="progress-kpi-strip">
      <div className="kpi-chip highlight">
        <span className="kpi-chip-label">Progresso</span>
        <span className="kpi-chip-value">{progressPercent.toFixed(2)}%</span>
        <span className="kpi-chip-detail">Plan. {plannedProgress.toFixed(1)}%</span>
      </div>
      <div className="kpi-chip">
        <span className="kpi-chip-label">IDP</span>
        <span className="kpi-chip-value" style={{ color: getIdpColor(idp) }}>
          {idp != null ? idp.toFixed(2) : '-'}
        </span>
        <span className="kpi-chip-detail">{getIdpLabel(idp)}</span>
      </div>
      <div className="kpi-chip">
        <span className="kpi-chip-label">Desvio</span>
        <span className="kpi-chip-value" style={{ color: desvio != null && desvio < 0 ? '#b91c1c' : desvio > 0 ? '#16a34a' : '#1a1a1a' }}>
          {desvio != null ? `${desvio > 0 ? '+' : ''}${desvio.toFixed(2)}%` : '-'}
        </span>
        <span className="kpi-chip-detail">{hasBaselineMetrics ? 'vs. último baseline' : 'vs. planejado'}</span>
      </div>
      <div className="kpi-chip">
        <span className="kpi-chip-label">Prazo Base</span>
        <span className="kpi-chip-value">{formatDate(prazoBaseline)}</span>
        <span className="kpi-chip-detail" title={prazoBaselineLabel}>{prazoBaselineLabel}</span>
      </div>
      <div className="kpi-chip">
        <span className="kpi-chip-label">Prazo Atual</span>
        <span className="kpi-chip-value" style={{ color: prazoAtualColor }}>
          {formatDate(prazoAtual)}
        </span>
        <span className="kpi-chip-detail">Cronograma vigente</span>
      </div>
      <div className="kpi-chip">
        <span className="kpi-chip-label">Variação</span>
        <span className="kpi-chip-value" style={{ color: variacaoColor }}>
          {variacaoDias != null ? `${variacaoDias > 0 ? '+' : ''}${variacaoDias}d` : '-'}
        </span>
        <span className="kpi-chip-detail">
          {variacaoDias != null
            ? (variacaoDias > 0 ? 'Atrasado' : variacaoDias < 0 ? 'Adiantado' : 'No prazo')
            : 'Sem baseline'}
        </span>
      </div>
    </div>
  );
}

export default ProgressKpiCards;

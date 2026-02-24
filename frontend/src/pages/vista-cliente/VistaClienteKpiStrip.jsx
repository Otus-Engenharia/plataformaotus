/**
 * Componente: KPI Strip da Vista do Cliente
 *
 * 6 cards: IDP, Progresso, Duração, Fase atual, Apontamentos abertos, Definições a tomar
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

function VistaClienteKpiStrip({ progress, project, apontamentosCount, loading }) {
  if (loading) {
    return (
      <div className="vc-kpi-strip">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="vc-kpi-card loading"><span className="vc-kpi-value">...</span></div>
        ))}
      </div>
    );
  }

  const idp = progress?.idp_baseline != null ? progress.idp_baseline : progress?.idp;
  const progressPercent = progress?.total_progress || 0;
  const plannedProgress = progress?.planned_progress || 0;
  const progressColor = plannedProgress > 0 && progressPercent < plannedProgress * 0.9 ? '#b91c1c' : '#1a1a1a';

  const duracao = project?.duracao_total_meses;
  const meta = project?.meta_duracao_meses;
  const duracaoExcedeu = meta && duracao && Number(duracao) > Number(meta);

  const faseAtual = project?.fase_atual || project?.status || '-';

  const totalApontamentos = apontamentosCount?.total || 0;
  const definicoes = apontamentosCount?.definicoes || 0;

  return (
    <div className="vc-kpi-strip">
      <div className="vc-kpi-card">
        <span className="vc-kpi-label">IDP</span>
        <span className="vc-kpi-value" style={{ color: getIdpColor(idp) }}>
          {idp != null ? idp.toFixed(2) : '-'}
        </span>
        <span className="vc-kpi-detail">{getIdpLabel(idp)}</span>
      </div>

      <div className="vc-kpi-card highlight">
        <span className="vc-kpi-label">Progresso projeto</span>
        <span className="vc-kpi-value" style={{ color: progressColor }}>
          {progressPercent.toFixed(2)}%
        </span>
        <span className="vc-kpi-detail">Meta: {plannedProgress.toFixed(1)}%</span>
      </div>

      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Duração do projeto (meses)</span>
        <span className="vc-kpi-value" style={{ color: duracaoExcedeu ? '#b91c1c' : '#1a1a1a' }}>
          {duracao != null ? `${duracao}${duracaoExcedeu ? '!' : ''}` : '-'}
        </span>
        <span className="vc-kpi-detail">{meta ? `Meta: ${meta}` : ''}</span>
      </div>

      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Fase atual</span>
        <span className="vc-kpi-value" style={{ fontSize: '14px' }}>
          {faseAtual}
        </span>
        <span className="vc-kpi-detail">&nbsp;</span>
      </div>

      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Apontamentos abertos</span>
        <span className="vc-kpi-value">{totalApontamentos}</span>
        <span className="vc-kpi-detail">&nbsp;</span>
      </div>

      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Definições a tomar</span>
        <span className="vc-kpi-value">{definicoes}</span>
        <span className="vc-kpi-detail">&nbsp;</span>
      </div>
    </div>
  );
}

export default VistaClienteKpiStrip;

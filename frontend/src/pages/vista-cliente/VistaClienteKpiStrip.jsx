/**
 * Componente: KPI Strip da Vista do Cliente
 *
 * 5 cards: Status do Projeto, Progresso, Duração, Fase atual, Pendências
 * Foco em interpretação visual (não só números crus).
 */

import React from 'react';

function getIdpLevel(idp) {
  if (idp == null) return { color: '#78716c', label: 'N/A', level: 'warning' };
  if (idp >= 1.0) return { color: '#15803d', label: 'No prazo', level: 'good' };
  if (idp >= 0.8) return { color: '#d97706', label: 'Atenção', level: 'warning' };
  return { color: '#dc2626', label: 'Atrasado', level: 'danger' };
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function VistaClienteKpiStrip({ progress, project, apontamentosCount, prazos, loading }) {
  if (loading) {
    return (
      <div className="vc-kpi-strip">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="vc-kpi-card loading">
            <span className="vc-kpi-label">&nbsp;</span>
            <span className="vc-kpi-value">...</span>
          </div>
        ))}
      </div>
    );
  }

  const idp = progress?.idp_baseline != null ? progress.idp_baseline : progress?.idp;
  const idpInfo = getIdpLevel(idp);
  const progressPercent = progress?.total_progress || 0;
  const plannedProgress = progress?.planned_progress || 0;

  const duracao = project?.duracao_total_meses;
  const meta = project?.meta_duracao_meses;
  const duracaoExcedeu = meta && duracao && Number(duracao) > Number(meta);

  const faseAtual = project?.fase_atual || project?.status || '-';
  const totalPendencias = apontamentosCount?.total || 0;

  return (
    <div className="vc-kpi-strip">
      {/* Card 1: Status do Projeto */}
      <div className={`vc-kpi-card status-${idpInfo.level}`}>
        <span className="vc-kpi-label">Status do projeto</span>
        <span className="vc-kpi-value" style={{ color: idpInfo.color }}>
          {idpInfo.label}
        </span>
        <span className="vc-kpi-detail">
          {idp != null ? `IDP ${idp.toFixed(2)}` : ''}
        </span>
      </div>

      {/* Card 2: Progresso com barra */}
      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Progresso</span>
        <span
          className="vc-kpi-value"
          style={{
            color: plannedProgress > 0 && progressPercent < plannedProgress * 0.9
              ? '#dc2626' : '#1c1917'
          }}
        >
          {progressPercent.toFixed(1)}%
        </span>
        <span className="vc-kpi-detail">
          {plannedProgress > 0 ? `Meta: ${plannedProgress.toFixed(0)}%` : ''}
        </span>
        <div className="vc-kpi-progress-bar">
          <div
            className="vc-kpi-progress-fill"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
          {plannedProgress > 0 && (
            <div
              className="vc-kpi-progress-marker"
              style={{ left: `${Math.min(plannedProgress, 100)}%` }}
            />
          )}
        </div>
      </div>

      {/* Card 3: Duração */}
      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Duração (meses)</span>
        <span
          className="vc-kpi-value"
          style={{ color: duracaoExcedeu ? '#dc2626' : '#1c1917' }}
        >
          {duracao != null ? duracao : '-'}
        </span>
        <span className="vc-kpi-detail">
          {meta ? `Meta: ${meta}` : ''}
        </span>
      </div>

      {/* Card 4: Fase Atual */}
      <div className="vc-kpi-card">
        <span className="vc-kpi-label">Fase atual</span>
        <span className="vc-kpi-value">
          <span className="vc-kpi-fase-pill">{faseAtual}</span>
        </span>
        <span className="vc-kpi-detail">&nbsp;</span>
      </div>

      {/* Card 5: Pendências */}
      <div className={`vc-kpi-card ${totalPendencias > 0 ? 'has-pendencias' : ''}`}>
        <span className="vc-kpi-label">Pendências</span>
        <span className="vc-kpi-value">
          {totalPendencias}
        </span>
        <span className="vc-kpi-detail">apontamentos abertos</span>
      </div>

      {/* Card 6: Prazo Baseline */}
      {prazos?.prazo_baseline && (
        <div className="vc-kpi-card">
          <span className="vc-kpi-label">Prazo Baseline</span>
          <span className="vc-kpi-value">{formatDate(prazos.prazo_baseline)}</span>
          <span className="vc-kpi-detail">&nbsp;</span>
        </div>
      )}

      {/* Card 7: Prazo Atual */}
      {prazos?.prazo_atual && (() => {
        const variacaoDias = prazos.variacao_dias;
        return (
          <div className={`vc-kpi-card ${variacaoDias > 0 ? 'has-pendencias' : ''}`}>
            <span className="vc-kpi-label">Prazo Atual</span>
            <span className="vc-kpi-value" style={{ color: variacaoDias > 0 ? '#dc2626' : '#1c1917' }}>
              {formatDate(prazos.prazo_atual)}
            </span>
            <span className="vc-kpi-detail">
              {variacaoDias != null && variacaoDias !== 0
                ? `${variacaoDias > 0 ? '+' : ''}${variacaoDias}d`
                : ''}
            </span>
          </div>
        );
      })()}
    </div>
  );
}

export default VistaClienteKpiStrip;

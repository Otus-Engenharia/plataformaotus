/**
 * Componente: KPI Cards do Progresso
 * Exibe métricas principais: progresso %, IDP, tarefas, desvio
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

function ProgressKpiCards({ progress, loading }) {
  if (loading) {
    return (
      <div className="progress-kpi-cards">
        <div className="kpi-card loading"><span>Calculando...</span></div>
        <div className="kpi-card loading"><span>Calculando...</span></div>
        <div className="kpi-card loading"><span>Calculando...</span></div>
        <div className="kpi-card loading"><span>Calculando...</span></div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="progress-kpi-cards">
        <div className="kpi-card empty"><span>Sem dados</span></div>
      </div>
    );
  }

  const progressPercent = progress.total_progress || 0;
  const plannedProgress = progress.planned_progress || 0;
  const idp = progress.idp;
  const desvio = progress.desvio;
  const completedTasks = progress.completed_tasks || 0;
  const activeTasks = progress.active_tasks || 0;
  const excludedTasks = progress.excluded_tasks || 0;
  const totalTasks = progress.total_tasks || 0;

  return (
    <div className="progress-kpi-cards">
      <div className="kpi-card highlight">
        <div className="kpi-label">Progresso Real</div>
        <div className="kpi-value">{progressPercent.toFixed(2)}%</div>
        <div className="kpi-detail">Planejado: {plannedProgress.toFixed(2)}%</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">IDP</div>
        <div className="kpi-value" style={{ color: getIdpColor(idp) }}>
          {idp != null ? idp.toFixed(2) : '-'}
        </div>
        <div className="kpi-detail">{getIdpLabel(idp)}</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Desvio</div>
        <div className="kpi-value" style={{ color: desvio != null && desvio < 0 ? '#b91c1c' : desvio > 0 ? '#16a34a' : '#1a1a1a' }}>
          {desvio != null ? `${desvio > 0 ? '+' : ''}${desvio.toFixed(2)}%` : '-'}
        </div>
        <div className="kpi-detail">{completedTasks} de {activeTasks} tarefas</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Tarefas</div>
        <div className="kpi-value">{activeTasks}</div>
        <div className="kpi-detail">{excludedTasks > 0 ? `${excludedTasks} sem etapa` : `de ${totalTasks} total`}</div>
      </div>
    </div>
  );
}

export default ProgressKpiCards;

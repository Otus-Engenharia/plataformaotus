/**
 * Componente: KPI Cards do Progresso
 * Exibe métricas principais: progresso %, tarefas, IDP
 */

import React from 'react';

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
  const completedTasks = progress.completed_tasks || 0;
  const activeTasks = progress.active_tasks || 0;
  const excludedTasks = progress.excluded_tasks || 0;
  const totalTasks = progress.total_tasks || 0;

  return (
    <div className="progress-kpi-cards">
      <div className="kpi-card highlight">
        <div className="kpi-label">Progresso</div>
        <div className="kpi-value">{progressPercent.toFixed(2)}%</div>
        <div className="kpi-detail">{completedTasks} de {activeTasks} tarefas concluídas</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Tarefas com Peso</div>
        <div className="kpi-value">{activeTasks}</div>
        <div className="kpi-detail">de {totalTasks} total</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Concluídas</div>
        <div className="kpi-value">{completedTasks}</div>
        <div className="kpi-detail">{activeTasks > 0 ? ((completedTasks / activeTasks) * 100).toFixed(1) : 0}% das ativas</div>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Sem Etapa</div>
        <div className="kpi-value">{excludedTasks}</div>
        <div className="kpi-detail">peso = 0 (excluídas)</div>
      </div>
    </div>
  );
}

export default ProgressKpiCards;

/**
 * Componente: Painel de Detalhes da Baseline
 * Mostra informações detalhadas de uma baseline selecionada.
 */

import React from 'react';

function BaselineDetailPanel({ baseline, onClose }) {
  if (!baseline) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="baseline-detail-panel">
      <div className="baseline-detail-header">
        <h4>
          <span className="revision-badge">{baseline.revision_label}</span>
          {baseline.name}
        </h4>
        <button className="baseline-detail-close" onClick={onClose}>&#10005;</button>
      </div>

      <div className="baseline-detail-grid">
        <div className="baseline-detail-item">
          <span className="detail-label">Data do Snapshot</span>
          <span className="detail-value">{formatShortDate(baseline.snapshot_date)}</span>
        </div>
        <div className="baseline-detail-item">
          <span className="detail-label">Tarefas Capturadas</span>
          <span className="detail-value">{baseline.task_count || 0} tarefas Level 5</span>
        </div>
        <div className="baseline-detail-item">
          <span className="detail-label">Fonte</span>
          <span className="detail-value">
            {baseline.source === 'smartsheet' ? 'Importado do SmartSheet' : 'Criado na Plataforma'}
          </span>
        </div>
        <div className="baseline-detail-item">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <span className={`status-dot ${baseline.is_active ? 'active' : 'inactive'}`} />
            {baseline.is_active ? 'Ativa' : 'Inativa'}
          </span>
        </div>
        {baseline.created_by_email && (
          <div className="baseline-detail-item">
            <span className="detail-label">Criado por</span>
            <span className="detail-value">{baseline.created_by_email}</span>
          </div>
        )}
        <div className="baseline-detail-item">
          <span className="detail-label">Criado em</span>
          <span className="detail-value">{formatDate(baseline.created_at)}</span>
        </div>
      </div>

      {baseline.description && (
        <div className="baseline-detail-description">
          <span className="detail-label">Motivo / Descrição</span>
          <p>{baseline.description}</p>
        </div>
      )}
    </div>
  );
}

export default BaselineDetailPanel;

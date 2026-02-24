/**
 * Componente: Modal de Criacao de Baseline
 * Permite definir nome e motivo/descricao ao criar uma nova baseline.
 * Exibe indicadores de prazo de contrato do projeto para contexto.
 */

import React, { useState } from 'react';
import { calculateMonthDifference, formatValue } from '../../utils/portfolio-utils';

function CreateBaselineModal({ projectName, project, nextRevision, onConfirm, onCancel, loading }) {
  const defaultName = nextRevision === 0
    ? 'Baseline Original'
    : `R${String(nextRevision).padStart(2, '0')}`;

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getDifferenceColor = (months) => {
    if (months == null || isNaN(months)) return '#666';
    if (months <= 0) return '#2e7d32';
    if (months <= 2) return '#f57f17';
    return '#c62828';
  };

  const diff = project
    ? calculateMonthDifference(
        project.data_termino_cronograma,
        project.data_termino_contrato_com_pausas || project.data_termino_contrato
      )
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    setError(null);
    try {
      await onConfirm({ name: name.trim(), description: description.trim() || null });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="baselines-modal-overlay" onClick={onCancel}>
      <div className="baselines-modal baselines-modal-wide" onClick={e => e.stopPropagation()}>
        <div className="baselines-modal-header">
          <h3>Nova Baseline</h3>
          <button className="baselines-modal-close" onClick={onCancel}>&#10005;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="baselines-modal-body">
            <p className="baselines-modal-info">
              Um snapshot das tarefas atuais de <strong>{projectName}</strong> será criado.
            </p>

            {/* Indicadores de prazo de contrato */}
            {project && (project.data_termino_contrato || project.data_termino_cronograma) && (
              <div className="create-baseline-indicators">
                <div className="review-section-title">Prazos do Contrato</div>
                <div className="review-dates-grid">
                  <div className="review-date-item">
                    <span className="review-label">Inicio Cronograma</span>
                    <span className="review-date-value">{formatValue(project.data_inicio_cronograma, 'date')}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Termino Cronograma</span>
                    <span className="review-date-value">{formatValue(project.data_termino_cronograma, 'date')}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Termino Contrato</span>
                    <span className="review-date-value">{formatValue(project.data_termino_contrato, 'date')}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">c/ Pausas</span>
                    <span className="review-date-value">{formatValue(project.data_termino_contrato_com_pausas, 'date')}</span>
                  </div>
                  <div className="review-date-item review-date-highlight">
                    <span className="review-label">Diferenca Cron. vs Contrato</span>
                    <span className="review-date-value" style={{ color: getDifferenceColor(diff), fontWeight: 700 }}>
                      {diff != null ? `${diff > 0 ? '+' : ''}${diff} meses` : '-'}
                    </span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Duracao Total</span>
                    <span className="review-date-value">{project.duracao_total_meses ?? '-'} meses</span>
                  </div>
                </div>
              </div>
            )}

            {/* Informacoes do projeto */}
            {project && (
              <div className="create-baseline-indicators">
                <div className="review-section-title">Informacoes do Projeto</div>
                <div className="review-dates-grid">
                  <div className="review-date-item">
                    <span className="review-label">Cliente</span>
                    <span className="review-date-value">{project.client || '-'}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Status</span>
                    <span className="review-date-value">{project.status || '-'}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Lider</span>
                    <span className="review-date-value">{project.lider || '-'}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Time</span>
                    <span className="review-date-value">{project.nome_time || '-'}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Valor Contrato</span>
                    <span className="review-date-value">{formatCurrency(project.valor_contrato_total)}</span>
                  </div>
                  <div className="review-date-item">
                    <span className="review-label">Valor Aditivos</span>
                    <span className="review-date-value">{formatCurrency(project.valor_aditivo_total)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="baselines-form-group">
              <label htmlFor="baseline-name">Nome da Baseline</label>
              <input
                id="baseline-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: R01 - Reprogramação Março"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="baselines-form-group">
              <label htmlFor="baseline-desc">Motivo / Descrição</label>
              <textarea
                id="baseline-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o motivo desta baseline (opcional)..."
                rows={3}
                maxLength={500}
              />
            </div>

            {error && <div className="baselines-modal-error">{error}</div>}
          </div>

          <div className="baselines-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-confirm" disabled={loading}>
              {loading ? 'Criando snapshot...' : 'Criar Baseline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateBaselineModal;

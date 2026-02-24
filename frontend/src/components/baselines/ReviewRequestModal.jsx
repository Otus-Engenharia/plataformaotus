/**
 * Componente: Modal de Analise de Solicitacao de Baseline
 *
 * Exibe dados completos do projeto (prazos, financeiro, status)
 * para que o lider possa tomar decisao informada de aprovar ou rejeitar.
 */

import React, { useState } from 'react';
import { calculateMonthDifference, formatValue } from '../../utils/portfolio-utils';

function ReviewRequestModal({ request, project, onApprove, onReject, onClose, loading }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

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

  const handleApprove = () => {
    setError(null);
    onApprove(request);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setError('Justificativa e obrigatoria para rejeicao');
      return;
    }
    setError(null);
    onReject(request.id, rejectReason.trim());
  };

  return (
    <div className="baselines-modal-overlay" onClick={onClose}>
      <div className="review-request-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="baselines-modal-header">
          <h3>Analise de Solicitacao</h3>
          <button className="baselines-modal-close" onClick={onClose}>&#10005;</button>
        </div>

        <div className="review-modal-body">
          {/* Secao: Solicitacao */}
          <div className="review-section">
            <div className="review-section-title">Solicitacao</div>
            <div className="review-field">
              <span className="review-label">Titulo</span>
              <span className="review-value"><strong>{request.title}</strong></span>
            </div>
            <div className="review-field">
              <span className="review-label">Projeto</span>
              <span className="review-value">{request.project_name || request.project_code}</span>
            </div>
            <div className="review-field">
              <span className="review-label">Solicitado por</span>
              <span className="review-value">{request.requested_by_name || request.requested_by_email}</span>
            </div>
            <div className="review-field-row">
              <div className="review-field">
                <span className="review-label">Data</span>
                <span className="review-value">{formatDate(request.created_at)}</span>
              </div>
              <div className="review-field">
                <span className="review-label">Prazo resposta</span>
                <span className="review-value" style={{ color: request.is_overdue ? '#c62828' : undefined, fontWeight: request.is_overdue ? 600 : undefined }}>
                  {formatDate(request.response_deadline)}
                  {request.is_overdue && ' (vencido)'}
                </span>
              </div>
            </div>
            {request.description && (
              <div className="review-field">
                <span className="review-label">Descricao</span>
                <span className="review-value review-description">{request.description}</span>
              </div>
            )}
          </div>

          {/* Secao: Prazos do Contrato */}
          {project && (
            <div className="review-section">
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

          {/* Secao: Informacoes do Projeto */}
          {project && (
            <div className="review-section">
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

          {!project && (
            <div className="review-section">
              <div className="review-no-project">
                Dados do projeto nao encontrados no portfolio.
              </div>
            </div>
          )}

          {/* Area de rejeicao */}
          {rejecting && (
            <div className="review-section">
              <div className="review-section-title" style={{ color: '#c62828' }}>Justificativa de Recusa</div>
              <textarea
                className="review-reject-textarea"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Descreva o motivo da recusa..."
                rows={3}
                autoFocus
              />
            </div>
          )}

          {error && <div className="baselines-modal-error">{error}</div>}
        </div>

        {/* Footer */}
        <div className="review-modal-footer">
          {rejecting ? (
            <>
              <button
                className="btn-modal-cancel"
                onClick={() => { setRejecting(false); setRejectReason(''); setError(null); }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="review-btn-reject"
                onClick={handleReject}
                disabled={loading}
              >
                {loading ? 'Enviando...' : 'Confirmar Recusa'}
              </button>
            </>
          ) : (
            <>
              <button
                className="review-btn-reject"
                onClick={() => setRejecting(true)}
                disabled={loading}
              >
                Rejeitar
              </button>
              <button
                className="review-btn-approve"
                onClick={handleApprove}
                disabled={loading}
              >
                {loading ? 'Aprovando...' : 'Aprovar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReviewRequestModal;

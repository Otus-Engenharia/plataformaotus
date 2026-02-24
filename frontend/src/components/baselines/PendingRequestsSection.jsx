/**
 * Componente: Seção de Solicitações Pendentes de Baseline
 * Exibe solicitações para aprovação/rejeição por gerentes (leaders).
 * Inclui informações de prazo de contrato para apoiar decisão.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { calculateMonthDifference } from '../../utils/portfolio-utils';

function PendingRequestsSection({ portfolio, onApproved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // id da request em ação
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/baseline-requests/pending`, { withCredentials: true });
      if (res.data.success) {
        setRequests(res.data.data || []);
      }
    } catch (err) {
      if (err.response?.status !== 403) {
        console.error('Erro ao buscar solicitacoes pendentes:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const getProjectInfo = (projectCode) => {
    return portfolio?.find(p =>
      (p.project_code_norm || p.project_code) === projectCode
    );
  };

  const handleApprove = async (request) => {
    if (!confirm(`Aprovar solicitacao de baseline "${request.title}" para ${request.project_name || request.project_code}?`)) return;

    setActionLoading(request.id);
    setError(null);
    try {
      const project = getProjectInfo(request.project_code);
      const res = await axios.post(`${API_URL}/api/baseline-requests/${request.id}/approve`, {
        smartsheet_id: project?.smartsheet_id,
        project_name: project?.project_name || request.project_name,
      }, { withCredentials: true });

      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.id !== request.id));
        if (res.data.data.gmail_warning) {
          alert(`Baseline criada com sucesso!\nAviso: ${res.data.data.gmail_warning}`);
        }
        if (onApproved) onApproved();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao aprovar solicitacao');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId) => {
    if (!rejectReason.trim()) {
      setError('Justificativa e obrigatoria para rejeicao');
      return;
    }

    setActionLoading(requestId);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/baseline-requests/${requestId}/reject`, {
        reason: rejectReason.trim(),
      }, { withCredentials: true });

      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        setRejectingId(null);
        setRejectReason('');
        if (res.data.data.gmail_warning) {
          alert(`Solicitacao rejeitada.\nAviso: ${res.data.data.gmail_warning}`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao rejeitar solicitacao');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const getDifferenceColor = (months) => {
    if (months == null || isNaN(months)) return '#666';
    if (months <= 0) return '#2e7d32';
    if (months <= 2) return '#f57f17';
    return '#c62828';
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        background: '#fff8e1',
        border: '1px solid #ffe082',
        borderRadius: '8px',
        padding: '1rem',
      }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#f57f17' }}>
          Solicitacoes Pendentes ({requests.length})
        </h3>

        {error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.75rem', fontSize: '0.813rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {requests.map(req => {
            const project = getProjectInfo(req.project_code);
            const diff = project
              ? calculateMonthDifference(project.data_termino_cronograma, project.data_termino_contrato_com_pausas || project.data_termino_contrato)
              : null;

            return (
              <div key={req.id} style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                padding: '1rem',
                borderLeft: req.is_overdue ? '4px solid #c62828' : '4px solid #f57f17',
              }}>
                {/* Cabeçalho */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.938rem' }}>{req.title}</strong>
                    <div style={{ fontSize: '0.813rem', color: '#666', marginTop: '0.25rem' }}>
                      {req.project_name || req.project_code} &middot; Solicitado por: {req.requested_by_name || req.requested_by_email}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: req.is_overdue ? '#c62828' : '#666', fontWeight: req.is_overdue ? 600 : 400 }}>
                    Prazo: {formatDate(req.response_deadline)}
                    {req.is_overdue && ' (vencido)'}
                  </div>
                </div>

                {/* Descrição */}
                {req.description && (
                  <p style={{ fontSize: '0.813rem', color: '#444', margin: '0.5rem 0', whiteSpace: 'pre-wrap' }}>
                    {req.description}
                  </p>
                )}

                {/* Informações de prazo de contrato */}
                {project && (
                  <div style={{
                    background: '#fafafa',
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    padding: '0.5rem 0.75rem',
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#555',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.375rem', color: '#333' }}>Prazos do Contrato</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.25rem 1rem' }}>
                      <span>Inicio Cron: <strong>{formatDate(project.data_inicio_cronograma)}</strong></span>
                      <span>Termino Cron: <strong>{formatDate(project.data_termino_cronograma)}</strong></span>
                      <span>Termino Contrato: <strong>{formatDate(project.data_termino_contrato)}</strong></span>
                      <span>c/ Pausas: <strong>{formatDate(project.data_termino_contrato_com_pausas)}</strong></span>
                      <span>
                        Diferenca:{' '}
                        <strong style={{ color: getDifferenceColor(diff) }}>
                          {diff != null ? `${diff} meses` : '-'}
                        </strong>
                      </span>
                      <span>Dur. Total: <strong>{project.duracao_total_meses ?? '-'} meses</strong></span>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                  {rejectingId === req.id ? (
                    <div style={{ display: 'flex', flex: 1, gap: '0.5rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                          Justificativa da recusa
                        </label>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Descreva o motivo da recusa..."
                          rows={2}
                          style={{ width: '100%', fontSize: '0.813rem', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.813rem', background: '#c62828', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {actionLoading === req.id ? 'Enviando...' : 'Confirmar Recusa'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(''); setError(null); }}
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.813rem', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoading === req.id}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.813rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {actionLoading === req.id ? 'Aprovando...' : 'Aprovar'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(req.id); setError(null); }}
                        disabled={actionLoading === req.id}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.813rem', background: '#c62828', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PendingRequestsSection;

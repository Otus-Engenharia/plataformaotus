/**
 * Componente: Secao de Solicitacoes Pendentes de Baseline
 * Exibe cards resumidos das solicitacoes. Ao clicar "Analisar",
 * abre o ReviewRequestModal com dados completos para decisao.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import ReviewRequestModal from './ReviewRequestModal';

function PendingRequestsSection({ portfolio, onApproved }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null); // request being reviewed in modal

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const handleApprove = async (request) => {
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
        setReviewRequest(null);
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

  const handleReject = async (requestId, reason) => {
    setActionLoading(requestId);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/api/baseline-requests/${requestId}/reject`, {
        reason,
      }, { withCredentials: true });

      if (res.data.success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        setReviewRequest(null);
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {requests.map(req => (
            <div key={req.id} style={{
              background: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              borderLeft: req.is_overdue ? '4px solid #c62828' : '4px solid #f57f17',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '0.875rem' }}>{req.title}</strong>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.15rem' }}>
                  {req.project_name || req.project_code} &middot; {req.requested_by_name || req.requested_by_email}
                </div>
              </div>
              <div style={{ fontSize: '0.7rem', color: req.is_overdue ? '#c62828' : '#999', whiteSpace: 'nowrap' }}>
                Prazo: {formatDate(req.response_deadline)}
                {req.is_overdue && ' (vencido)'}
              </div>
              <button
                onClick={() => setReviewRequest(req)}
                style={{
                  padding: '0.4rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: '#f57f17',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Analisar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de analise */}
      {reviewRequest && (
        <ReviewRequestModal
          request={reviewRequest}
          project={getProjectInfo(reviewRequest.project_code)}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setReviewRequest(null)}
          loading={actionLoading === reviewRequest.id}
        />
      )}
    </div>
  );
}

export default PendingRequestsSection;

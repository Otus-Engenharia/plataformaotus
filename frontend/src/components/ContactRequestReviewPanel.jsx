/**
 * Componente: Painel de Revisão de Solicitações de Contato
 *
 * Exibe solicitações pendentes e resolvidas para a equipe de dados
 * aprovar ou rejeitar alterações de contatos/empresas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/ContactRequests.css';

const TYPE_LABELS = {
  novo_contato: 'Novo Contato',
  editar_contato: 'Editar Contato',
  nova_empresa: 'Nova Empresa',
  nova_disciplina: 'Nova Disciplina',
};

function ContactRequestReviewPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');
  const [filterType, setFilterType] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab === 'pendentes'
        ? { status: 'pendente' }
        : {};
      if (filterType) params.request_type = filterType;

      const url = activeTab === 'pendentes'
        ? `${API_URL}/api/contact-requests/pending`
        : `${API_URL}/api/contact-requests`;

      const response = await axios.get(url, {
        params: activeTab !== 'pendentes' ? params : undefined,
        withCredentials: true,
      });
      setRequests(response.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterType]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id) => {
    if (!window.confirm('Confirma a aprovação desta solicitação? A alteração será aplicada imediatamente.')) return;
    setProcessing(id);
    try {
      await axios.post(`${API_URL}/api/contact-requests/${id}/approve`, {}, { withCredentials: true });
      fetchRequests();
    } catch (err) {
      console.error('Erro ao aprovar:', err);
      alert(err.response?.data?.error || 'Erro ao aprovar solicitação.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim()) {
      alert('Justificativa é obrigatória para rejeição.');
      return;
    }
    setProcessing(id);
    try {
      await axios.post(`${API_URL}/api/contact-requests/${id}/reject`, {
        reason: rejectReason,
      }, { withCredentials: true });
      setRejectingId(null);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      console.error('Erro ao rejeitar:', err);
      alert(err.response?.data?.error || 'Erro ao rejeitar solicitação.');
    } finally {
      setProcessing(null);
    }
  };

  const renderPayload = (req) => {
    const payload = req.payload || {};

    if (req.request_type === 'novo_contato') {
      return (
        <div className="cr-payload">
          <div className="cr-payload-row"><span className="cr-label">Nome:</span> {payload.name}</div>
          {payload.email && <div className="cr-payload-row"><span className="cr-label">Email:</span> {payload.email}</div>}
          {payload.phone && <div className="cr-payload-row"><span className="cr-label">Telefone:</span> {payload.phone}</div>}
          {payload.position && <div className="cr-payload-row"><span className="cr-label">Cargo:</span> {payload.position}</div>}
          {payload.company_name && <div className="cr-payload-row"><span className="cr-label">Empresa:</span> {payload.company_name}</div>}
        </div>
      );
    }

    if (req.request_type === 'editar_contato') {
      const oldVals = payload.old_values || {};
      const newVals = payload.new_values || {};
      const changed = payload.changed_fields || [];

      return (
        <div className="cr-payload cr-payload-diff">
          {['name', 'email', 'phone', 'position'].map(field => {
            const isChanged = changed.includes(field);
            if (!isChanged && !oldVals[field] && !newVals[field]) return null;
            const labels = { name: 'Nome', email: 'Email', phone: 'Telefone', position: 'Cargo' };
            return (
              <div key={field} className={`cr-diff-row ${isChanged ? 'cr-diff-row--changed' : ''}`}>
                <span className="cr-label">{labels[field]}:</span>
                {isChanged ? (
                  <>
                    <span className="cr-diff-old">{oldVals[field] || '(vazio)'}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                    <span className="cr-diff-new">{newVals[field] || '(vazio)'}</span>
                  </>
                ) : (
                  <span>{oldVals[field] || newVals[field] || '-'}</span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (req.request_type === 'nova_empresa') {
      return (
        <div className="cr-payload">
          <div className="cr-payload-row"><span className="cr-label">Nome:</span> {payload.name}</div>
          {payload.company_type && <div className="cr-payload-row"><span className="cr-label">Tipo:</span> {payload.company_type}</div>}
          {payload.discipline_names && payload.discipline_names.length > 0 && (
            <div className="cr-payload-row">
              <span className="cr-label">Disciplinas:</span>
              <span className="cr-discipline-chips">
                {payload.discipline_names.map((name, i) => (
                  <span key={i} className="cr-discipline-chip">{name}</span>
                ))}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (req.request_type === 'nova_disciplina') {
      return (
        <div className="cr-payload">
          <div className="cr-payload-row"><span className="cr-label">Nome:</span> {payload.name}</div>
        </div>
      );
    }

    return null;
  };

  const filteredRequests = activeTab === 'resolvidas'
    ? requests.filter(r => r.status !== 'pendente')
    : requests;

  return (
    <div className="cr-panel">
      {/* Tabs: Pendentes | Resolvidas */}
      <div className="cr-tabs">
        <button
          className={`cr-tab ${activeTab === 'pendentes' ? 'cr-tab--active' : ''}`}
          onClick={() => setActiveTab('pendentes')}
        >
          Pendentes
          {activeTab !== 'pendentes' && requests.length > 0 && (
            <span className="cr-tab-count">{requests.filter(r => r.status === 'pendente').length}</span>
          )}
        </button>
        <button
          className={`cr-tab ${activeTab === 'resolvidas' ? 'cr-tab--active' : ''}`}
          onClick={() => setActiveTab('resolvidas')}
        >
          Resolvidas
        </button>
      </div>

      {/* Filtro por tipo */}
      <div className="cr-filter-row">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="novo_contato">Novo Contato</option>
          <option value="editar_contato">Editar Contato</option>
          <option value="nova_empresa">Nova Empresa</option>
          <option value="nova_disciplina">Nova Disciplina</option>
        </select>
      </div>

      {/* Lista de solicitações */}
      {loading ? (
        <div className="cr-loading">Carregando solicitações...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="cr-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{activeTab === 'pendentes' ? 'Nenhuma solicitação pendente.' : 'Nenhuma solicitação resolvida.'}</span>
        </div>
      ) : (
        <div className="cr-list">
          {filteredRequests.map(req => (
            <div key={req.id} className={`cr-card cr-card--${req.status}`}>
              <div className="cr-card-header">
                <div className="cr-card-header-left">
                  <span className={`cr-type-badge cr-type-badge--${req.request_type}`}>
                    {TYPE_LABELS[req.request_type] || req.request_type}
                  </span>
                  <span className={`cr-status-badge cr-status-badge--${req.status}`}>
                    {req.status === 'pendente' ? 'Pendente' : req.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
                  </span>
                </div>
                <span className="cr-card-date">
                  {new Date(req.created_at).toLocaleDateString('pt-BR')} {new Date(req.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="cr-card-meta">
                <span className="cr-requester">
                  Solicitante: <strong>{req.requested_by_name || req.requested_by_email}</strong>
                </span>
                {req.project_code && (
                  <span className="cr-project">Projeto: {req.project_code}</span>
                )}
              </div>

              {renderPayload(req)}

              {/* Status de revisão (para resolvidas) */}
              {req.status !== 'pendente' && (
                <div className="cr-review-info">
                  <span>Revisado por: {req.reviewed_by_name || req.reviewed_by_email}</span>
                  {req.reviewed_at && (
                    <span> em {new Date(req.reviewed_at).toLocaleDateString('pt-BR')}</span>
                  )}
                  {req.rejection_reason && (
                    <div className="cr-rejection-reason">Motivo: {req.rejection_reason}</div>
                  )}
                </div>
              )}

              {/* Ações (apenas para pendentes) */}
              {req.status === 'pendente' && (
                <div className="cr-card-actions">
                  {rejectingId === req.id ? (
                    <div className="cr-reject-form">
                      <textarea
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Justificativa da rejeição (obrigatório)..."
                        rows={2}
                        autoFocus
                      />
                      <div className="cr-reject-form-actions">
                        <button
                          className="cr-btn cr-btn--cancel"
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                        >
                          Cancelar
                        </button>
                        <button
                          className="cr-btn cr-btn--reject"
                          onClick={() => handleReject(req.id)}
                          disabled={processing === req.id}
                        >
                          {processing === req.id ? 'Rejeitando...' : 'Confirmar Rejeição'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        className="cr-btn cr-btn--approve"
                        onClick={() => handleApprove(req.id)}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? 'Aprovando...' : 'Aprovar'}
                      </button>
                      <button
                        className="cr-btn cr-btn--reject-start"
                        onClick={() => setRejectingId(req.id)}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContactRequestReviewPanel;

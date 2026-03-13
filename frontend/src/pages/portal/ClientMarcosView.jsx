/**
 * Portal do Cliente - Marcos
 *
 * Gerenciamento de marcos (milestones) por projeto na perspectiva do cliente.
 * - CRUD simplificado (nome, descricao, data expectativa)
 * - Exibe dados enriquecidos do Smartsheet quando vinculado
 * - Solicitacao de nova baseline com snapshot dos marcos
 * - Historico de solicitacoes de baseline
 * - Timeline visual (MarcosProjetoSection)
 *
 * Usa endpoint /api/client/projects/:code/marcos.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import MarcosProjetoSection from '../vista-cliente/MarcosProjetoSection';
import '../../styles/VistaClienteView.css';
import '../vista-cliente/VistaClienteMarcosView.css';

function formatDateInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTimeBR(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function getStatusLabel(status) {
  const map = {
    pendente: 'Pendente',
    andamento: 'Em Andamento',
    atrasado: 'Atrasado',
    feito: 'Feito',
    'Complete': 'Feito',
    'In Progress': 'Em Andamento',
    'Not Started': 'Pendente',
    'Late': 'Atrasado',
  };
  return map[status] || status || '-';
}

function getStatusClass(status) {
  if (!status) return 'pendente';
  const low = status.toLowerCase();
  if (low === 'feito' || low === 'complete' || low === 'concluido' || low === 'concluído') return 'feito';
  if (low === 'andamento' || low === 'in progress' || low === 'em andamento') return 'andamento';
  if (low === 'atrasado' || low === 'late') return 'atrasado';
  return 'pendente';
}

function ClientMarcosView() {
  const { projectCode } = useParams();
  const { currentProject } = useOutletContext();
  const { getClientToken } = useClientAuth();

  const [marcos, setMarcos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state (create/edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [inlineDateEditId, setInlineDateEditId] = useState(null);
  const [form, setForm] = useState({
    nome: '', descricao: '', cliente_expectativa_data: '',
  });

  // Baseline request modal
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [baselineJustificativa, setBaselineJustificativa] = useState('');
  const [baselineSubmitting, setBaselineSubmitting] = useState(false);
  const [baselinePending, setBaselinePending] = useState(false);

  // Baseline requests history
  const [baselineRequests, setBaselineRequests] = useState([]);
  const [baselineRequestsLoading, setBaselineRequestsLoading] = useState(false);

  const clientAxios = useCallback(() => ({
    headers: { Authorization: `Bearer ${getClientToken()}` },
  }), [getClientToken]);

  // --- Fetch marcos ---
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos`,
        clientAxios()
      );
      setMarcos(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCode, clientAxios]);

  // --- Fetch baseline requests ---
  const fetchBaselineRequests = useCallback(async () => {
    if (!projectCode) { setBaselineRequests([]); return; }
    setBaselineRequestsLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos/baseline-requests`,
        clientAxios()
      );
      const data = res.data?.data || [];
      setBaselineRequests(data);
      setBaselinePending(data.some(r => r.status === 'pendente'));
    } catch (err) {
      console.error('Erro ao buscar solicitacoes de baseline:', err);
      setBaselineRequests([]);
      setBaselinePending(false);
    } finally {
      setBaselineRequestsLoading(false);
    }
  }, [projectCode, clientAxios]);

  useEffect(() => { fetchMarcos(); }, [fetchMarcos]);
  useEffect(() => { fetchBaselineRequests(); }, [fetchBaselineRequests]);

  // --- Create / Update ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      cliente_expectativa_data: form.cliente_expectativa_data || null,
    };

    try {
      if (editingId) {
        await axios.put(
          `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos/${editingId}`,
          payload,
          clientAxios()
        );
      } else {
        await axios.post(
          `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos`,
          payload,
          clientAxios()
        );
      }
      resetForm();
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao salvar marco:', err);
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    }
  };

  // --- Delete ---
  const handleDelete = async (id, nome) => {
    if (!confirm(`Remover marco "${nome}"?`)) return;
    try {
      await axios.delete(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos/${id}`,
        clientAxios()
      );
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao remover marco:', err);
      alert('Erro ao remover: ' + (err.response?.data?.error || err.message));
    }
  };

  // --- Edit ---
  const handleEdit = (marco) => {
    setEditingId(marco.id);
    setForm({
      nome: marco.nome || '',
      descricao: marco.descricao || '',
      cliente_expectativa_data: formatDateInput(marco.cliente_expectativa_data),
    });
    setShowForm(true);
  };

  // --- Inline date save ---
  const handleInlineDateSave = async (marcoId, newDateValue) => {
    setInlineDateEditId(null);
    const marco = marcos.find(m => m.id === marcoId);
    const oldValue = formatDateInput(marco?.cliente_expectativa_data);
    if (newDateValue === oldValue) return;

    // Optimistic update
    setMarcos(prev => prev.map(m =>
      m.id === marcoId ? { ...m, cliente_expectativa_data: newDateValue || null } : m
    ));

    try {
      await axios.put(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos/${marcoId}/date`,
        { cliente_expectativa_data: newDateValue || null },
        clientAxios()
      );
    } catch (err) {
      console.error('Erro ao salvar data:', err);
      alert('Erro ao salvar data: ' + (err.response?.data?.error || err.message));
      await fetchMarcos();
    }
  };

  // --- Baseline Request ---
  const handleBaselineRequest = async () => {
    if (!baselineJustificativa.trim()) return;
    setBaselineSubmitting(true);
    try {
      const marcos_snapshot = marcos.map(m => ({
        marco_id: m.id,
        nome: m.nome,
        cliente_expectativa_data: m.cliente_expectativa_data || null,
        descricao: m.descricao || null,
      }));

      await axios.post(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos/baseline-request`,
        { justificativa: baselineJustificativa.trim(), marcos_snapshot },
        clientAxios()
      );

      setShowBaselineModal(false);
      setBaselineJustificativa('');
      setBaselinePending(true);
      await fetchBaselineRequests();
    } catch (err) {
      console.error('Erro ao solicitar baseline:', err);
      alert('Erro ao solicitar nova baseline: ' + (err.response?.data?.error || err.message));
    } finally {
      setBaselineSubmitting(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ nome: '', descricao: '', cliente_expectativa_data: '' });
  };

  const getBaselineStatusBadge = (status) => {
    switch (status) {
      case 'pendente': return { label: 'Pendente', className: 'pendente' };
      case 'aprovada': return { label: 'Aprovada', className: 'aprovada' };
      case 'rejeitada': return { label: 'Rejeitada', className: 'rejeitada' };
      default: return { label: status, className: 'pendente' };
    }
  };

  // Map for timeline component
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const timelineMarcos = marcos.map(m => {
    const updatedAt = m.updated_at ? new Date(m.updated_at) : null;
    const cronogramaDate = m.smartsheet_data_termino || m.prazo_atual || null;
    const expectativaCliente = m.cliente_expectativa_data || null;
    let desvio = null;
    if (cronogramaDate && expectativaCliente) {
      const dCrono = new Date(cronogramaDate);
      const dExpect = new Date(expectativaCliente);
      if (!isNaN(dCrono) && !isNaN(dExpect)) {
        desvio = Math.round((dCrono - dExpect) / (1000 * 60 * 60 * 24));
      }
    }
    return {
      nome: m.nome,
      status: m.smartsheet_status || m.status || null,
      prazoAtual: cronogramaDate,
      prazoBase: m.prazo_baseline || null,
      variacaoDias: desvio,
      alteradoRecente: updatedAt && updatedAt > oneMonthAgo,
    };
  });

  if (loading) {
    return (
      <div className="cp-view-loading">
        <div className="cp-view-spinner" />
        Carregando marcos...
      </div>
    );
  }

  return (
    <div className="vista-cliente-container">
      {/* Actions bar */}
      <div className="vcm-actions">
        <button
          className="vcm-btn vcm-btn-primary"
          onClick={() => { resetForm(); setShowForm(true); }}
        >
          + Novo Marco
        </button>
        <button
          className="vcm-btn vcm-btn-baseline"
          onClick={() => setShowBaselineModal(true)}
          disabled={marcos.length === 0}
          title={marcos.length === 0 ? 'Cadastre marcos antes de solicitar baseline' : 'Solicitar revisao da baseline de marcos'}
        >
          Solicitar Nova Baseline
          {baselinePending && (
            <span className="vcm-baseline-pending-badge">Pendente</span>
          )}
        </button>
      </div>

      {/* Form (create/edit) */}
      {showForm && (
        <div className="vcm-form-card">
          <h3>{editingId ? 'Editar Marco' : 'Novo Marco'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="vcm-form-grid">
              <div className="vcm-field">
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Protocolo Prefeitura"
                  required
                />
              </div>
              <div className="vcm-field">
                <label>Data de Expectativa</label>
                <input
                  type="date"
                  value={form.cliente_expectativa_data}
                  onChange={e => setForm({ ...form, cliente_expectativa_data: e.target.value })}
                />
              </div>
              <div className="vcm-field vcm-field-full">
                <label>Descricao</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descricao do marco (opcional)"
                  rows={2}
                />
              </div>
            </div>
            <div className="vcm-form-actions">
              <button type="submit" className="vcm-btn vcm-btn-primary">
                {editingId ? 'Salvar' : 'Criar'}
              </button>
              <button type="button" className="vcm-btn vcm-btn-ghost" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Timeline (reused component) */}
      {marcos.length > 0 && (
        <MarcosProjetoSection marcos={timelineMarcos} loading={false} />
      )}

      {/* Marcos table */}
      <div className="vcm-list-card">
        {marcos.length === 0 ? (
          <div className="vcm-empty">
            Nenhum marco cadastrado para este projeto.
            <br />
            <span className="vcm-empty-hint">
              Crie marcos manualmente usando o botao "+ Novo Marco" acima.
            </span>
          </div>
        ) : (
          <div className="vcm-table-wrapper">
            <table className="vcm-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descricao</th>
                  <th>Expectativa Cliente</th>
                  <th>Status Cronograma</th>
                  <th>Data Cronograma</th>
                  <th>Variacao</th>
                  <th className="vcm-th-actions">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {marcos.map((m, idx) => {
                  const isLinked = !!(m.smartsheet_status || m.smartsheet_data_termino);
                  const statusClass = isLinked ? getStatusClass(m.smartsheet_status) : null;
                  const cronogramaDate = m.smartsheet_data_termino || m.prazo_atual;
                  const tm = timelineMarcos[idx];

                  return (
                    <tr key={m.id}>
                      <td className="vcm-td-nome">
                        <span className="vcm-nome">{m.nome}</span>
                      </td>
                      <td className="vcm-td-descricao">
                        {m.descricao ? (
                          <span className="vcm-descricao-text">{m.descricao}</span>
                        ) : (
                          <span className="vcm-text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {inlineDateEditId === m.id ? (
                          <input
                            type="date"
                            className="vcm-inline-date-input"
                            defaultValue={formatDateInput(m.cliente_expectativa_data)}
                            autoFocus
                            onBlur={e => handleInlineDateSave(m.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') e.target.blur();
                              if (e.key === 'Escape') setInlineDateEditId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="vcm-td-date-editable"
                            onClick={() => setInlineDateEditId(m.id)}
                          >
                            {m.cliente_expectativa_data
                              ? formatDateDisplay(m.cliente_expectativa_data)
                              : <span className="vcm-date-placeholder">Definir data</span>
                            }
                          </span>
                        )}
                      </td>
                      <td>
                        {isLinked ? (
                          <span className={`vcm-status-badge ${statusClass}`}>
                            {getStatusLabel(m.smartsheet_status)}
                          </span>
                        ) : (
                          <span className="vcm-awaiting-link">Aguardando vinculo</span>
                        )}
                      </td>
                      <td>
                        {isLinked
                          ? formatDateDisplay(m.smartsheet_data_termino)
                          : <span className="vcm-text-muted">-</span>
                        }
                      </td>
                      <td>
                        {isLinked && tm.variacaoDias != null && tm.variacaoDias !== 0 ? (
                          <span className={`vcm-variacao ${tm.variacaoDias > 0 ? 'atrasado' : 'adiantado'}`}>
                            {tm.variacaoDias > 0 ? '+' : ''}{tm.variacaoDias}d
                          </span>
                        ) : (
                          <span className="vcm-text-muted">-</span>
                        )}
                      </td>
                      <td className="vcm-td-actions">
                        <button
                          className="vcm-action-btn edit"
                          onClick={() => handleEdit(m)}
                          title="Editar"
                        >
                          &#9998;
                        </button>
                        <button
                          className="vcm-action-btn delete"
                          onClick={() => handleDelete(m.id, m.nome)}
                          title="Remover"
                        >
                          &#10005;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Baseline Request Modal */}
      {showBaselineModal && (
        <div className="vcm-modal-overlay" onClick={() => setShowBaselineModal(false)}>
          <div className="vcm-modal-card" onClick={e => e.stopPropagation()}>
            <div className="vcm-modal-header">
              <h3>Solicitar Nova Baseline</h3>
              <button
                className="vcm-modal-close"
                onClick={() => setShowBaselineModal(false)}
                title="Fechar"
              >
                &#10005;
              </button>
            </div>

            <div className="vcm-modal-body">
              <p className="vcm-modal-description">
                Ao solicitar uma nova baseline, o lider do projeto sera notificado para
                revisar os marcos e suas datas. Um snapshot dos marcos atuais sera enviado
                junto com sua justificativa.
              </p>

              {/* Marco summary */}
              <div className="vcm-baseline-summary">
                <h4>Marcos atuais ({marcos.length})</h4>
                <div className="vcm-baseline-summary-list">
                  {marcos.map(m => (
                    <div key={m.id} className="vcm-baseline-summary-item">
                      <span className="vcm-baseline-summary-name">{m.nome}</span>
                      <span className="vcm-baseline-summary-date">
                        {formatDateDisplay(m.cliente_expectativa_data)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Justificativa */}
              <div className="vcm-field">
                <label>Justificativa *</label>
                <textarea
                  value={baselineJustificativa}
                  onChange={e => setBaselineJustificativa(e.target.value)}
                  placeholder="Explique o motivo da solicitacao de nova baseline..."
                  rows={4}
                  required
                />
              </div>
            </div>

            <div className="vcm-modal-footer">
              <button
                className="vcm-btn vcm-btn-baseline"
                onClick={handleBaselineRequest}
                disabled={baselineSubmitting || !baselineJustificativa.trim()}
              >
                {baselineSubmitting ? 'Enviando...' : 'Enviar Solicitacao'}
              </button>
              <button
                className="vcm-btn vcm-btn-ghost"
                onClick={() => setShowBaselineModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Baseline Requests History */}
      <div className="vcm-baseline-history">
        <div className="vcm-baseline-history-header">
          <h3>Historico de Solicitacoes de Baseline</h3>
        </div>

        {baselineRequestsLoading ? (
          <div className="vcm-loading vcm-loading-sm">
            <div className="vcm-loading-spinner" />
            Carregando historico...
          </div>
        ) : baselineRequests.length === 0 ? (
          <div className="vcm-empty vcm-empty-sm">
            Nenhuma solicitacao de baseline registrada.
          </div>
        ) : (
          <div className="vcm-baseline-requests-list">
            {baselineRequests.map((req) => {
              const badge = getBaselineStatusBadge(req.status);
              return (
                <div key={req.id} className="vcm-baseline-request-item">
                  <div className="vcm-baseline-request-top">
                    <span className="vcm-baseline-request-date">
                      {formatDateTimeBR(req.created_at)}
                    </span>
                    <span className={`vcm-baseline-status-badge ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="vcm-baseline-request-justificativa">
                    {req.justificativa}
                  </div>
                  {req.status === 'rejeitada' && req.rejection_reason && (
                    <div className="vcm-baseline-rejection">
                      <span className="vcm-baseline-rejection-label">Motivo da rejeicao:</span>
                      {req.rejection_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientMarcosView;

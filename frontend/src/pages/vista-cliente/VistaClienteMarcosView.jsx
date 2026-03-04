/**
 * Vista do Cliente - Marcos do Projeto
 *
 * Gerenciamento de marcos (milestones) por projeto na perspectiva do cliente.
 * - CRUD simplificado (nome, descricao, data expectativa)
 * - Exibe dados enriquecidos do Smartsheet quando vinculado
 * - Solicitacao de nova baseline com snapshot dos marcos
 * - Historico de solicitacoes de baseline
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useVistaCliente } from '../../contexts/VistaClienteContext';
import '../../styles/VistaClienteView.css';
import './VistaClienteMarcosView.css';

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

function VistaClienteMarcosView() {
  const {
    selectedProjectId, setSelectedProjectId,
    showOnlyActive, setShowOnlyActive,
    selectedProject, projectCode, smartsheetId, projectName,
    sortedProjects,
  } = useVistaCliente();

  const [marcos, setMarcos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state (create/edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
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

  // --- Fetch marcos (enriched, with fallback) ---
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) { setMarcos([]); return; }
    setLoading(true);
    try {
      // Try enriched endpoint first
      const params = new URLSearchParams();
      params.set('projectCode', projectCode);
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);

      const res = await axios.get(
        `${API_URL}/api/marcos-projeto/enriched?${params}`,
        { withCredentials: true }
      );
      setMarcos(res.data?.data || []);
    } catch (enrichedErr) {
      console.warn('Enriched endpoint failed, falling back:', enrichedErr.message);
      try {
        const res = await axios.get(
          `${API_URL}/api/marcos-projeto?projectCode=${encodeURIComponent(projectCode)}`,
          { withCredentials: true }
        );
        setMarcos(res.data?.data || []);
      } catch (fallbackErr) {
        console.error('Erro ao buscar marcos:', fallbackErr);
        setMarcos([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  // --- Fetch baseline requests ---
  const fetchBaselineRequests = useCallback(async () => {
    if (!projectCode) { setBaselineRequests([]); return; }
    setBaselineRequestsLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/marcos-projeto/baseline-requests?projectCode=${encodeURIComponent(projectCode)}`,
        { withCredentials: true }
      );
      const data = res.data?.data || [];
      setBaselineRequests(data);
      // Check if there is a pending baseline request
      setBaselinePending(data.some(r => r.status === 'pendente'));
    } catch (err) {
      console.error('Erro ao buscar solicitacoes de baseline:', err);
      setBaselineRequests([]);
      setBaselinePending(false);
    } finally {
      setBaselineRequestsLoading(false);
    }
  }, [projectCode]);

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
          `${API_URL}/api/marcos-projeto/${editingId}`,
          payload,
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${API_URL}/api/marcos-projeto`,
          { ...payload, project_code: projectCode },
          { withCredentials: true }
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
      await axios.delete(`${API_URL}/api/marcos-projeto/${id}`, { withCredentials: true });
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
        `${API_URL}/api/marcos-projeto/baseline-request`,
        {
          project_code: projectCode,
          justificativa: baselineJustificativa.trim(),
          marcos_snapshot,
        },
        { withCredentials: true }
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

  // --- Baseline request status badge ---
  const getBaselineStatusBadge = (status) => {
    switch (status) {
      case 'pendente': return { label: 'Pendente', className: 'pendente' };
      case 'aprovada': return { label: 'Aprovada', className: 'aprovada' };
      case 'rejeitada': return { label: 'Rejeitada', className: 'rejeitada' };
      default: return { label: status, className: 'pendente' };
    }
  };

  return (
    <div className="vista-cliente-container">
      {/* Header */}
      <div className="vc-header">
        <div className="vc-header-title-row">
          <h1 className="vc-project-title">Marcos do Projeto</h1>
        </div>
        <div className="vc-header-controls">
          <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="vc-project-select"
          >
            <option value="">Selecione um projeto</option>
            {sortedProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
          <label className="vc-active-toggle">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
            />
            Somente Ativos
          </label>
        </div>
      </div>

      {/* Actions bar */}
      {projectCode && (
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
      )}

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

      {/* Marcos table */}
      <div className="vcm-list-card">
        {loading ? (
          <div className="vcm-loading">
            <div className="vcm-loading-spinner" />
            Carregando marcos...
          </div>
        ) : !projectCode ? (
          <div className="vcm-empty">Selecione um projeto para gerenciar marcos.</div>
        ) : marcos.length === 0 ? (
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
                {marcos.map((m) => {
                  const isLinked = !!(m.smartsheet_status || m.smartsheet_data_termino);
                  const statusClass = isLinked ? getStatusClass(m.smartsheet_status) : null;
                  const variacao = m.variacao_dias;

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
                      <td>{formatDateDisplay(m.cliente_expectativa_data)}</td>
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
                        {isLinked && variacao != null && variacao !== 0 ? (
                          <span className={`vcm-variacao ${variacao > 0 ? 'atrasado' : 'adiantado'}`}>
                            {variacao > 0 ? '+' : ''}{variacao}d
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
      {projectCode && (
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
      )}
    </div>
  );
}

export default VistaClienteMarcosView;

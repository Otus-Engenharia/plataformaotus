/**
 * Vista do Cliente - Marcos do Projeto (CRUD)
 *
 * Gerenciamento completo de marcos (milestones) por projeto.
 * Suporta importação do Smartsheet e cadastro manual.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useVistaCliente } from '../../contexts/VistaClienteContext';
import '../../styles/VistaClienteView.css';
import './VistaClienteMarcosView.css';

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', className: 'pendente' },
  { value: 'andamento', label: 'Em Andamento', className: 'andamento' },
  { value: 'atrasado', label: 'Atrasado', className: 'atrasado' },
  { value: 'feito', label: 'Feito', className: 'feito' },
];

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

function VistaClienteMarcosView() {
  const {
    selectedProjectId, setSelectedProjectId,
    showOnlyActive, setShowOnlyActive,
    selectedProject, projectCode, smartsheetId, projectName,
    sortedProjects,
  } = useVistaCliente();

  const [marcos, setMarcos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nome: '', status: 'pendente', prazo_baseline: '', prazo_atual: '', descricao: '',
  });

  // Fetch marcos
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) { setMarcos([]); return; }
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/marcos-projeto?projectCode=${encodeURIComponent(projectCode)}`,
        { withCredentials: true }
      );
      setMarcos(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
      setMarcos([]);
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => { fetchMarcos(); }, [fetchMarcos]);

  // Import from Smartsheet
  const handleImport = async () => {
    if (!projectCode || (!smartsheetId && !projectName)) return;
    setImporting(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/marcos-projeto/import`,
        { projectCode, smartsheetId, projectName },
        { withCredentials: true }
      );
      if (res.data.success) {
        await fetchMarcos();
        alert(`${res.data.imported} marco(s) importado(s) do Smartsheet.`);
      }
    } catch (err) {
      console.error('Erro ao importar marcos:', err);
      alert('Erro ao importar marcos: ' + (err.response?.data?.error || err.message));
    } finally {
      setImporting(false);
    }
  };

  // Create / Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;

    try {
      if (editingId) {
        await axios.put(
          `${API_URL}/api/marcos-projeto/${editingId}`,
          { ...form, nome: form.nome.trim() },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${API_URL}/api/marcos-projeto`,
          { ...form, project_code: projectCode, nome: form.nome.trim() },
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

  // Delete
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

  // Edit
  const handleEdit = (marco) => {
    setEditingId(marco.id);
    setForm({
      nome: marco.nome || '',
      status: marco.status || 'pendente',
      prazo_baseline: formatDateInput(marco.prazo_baseline),
      prazo_atual: formatDateInput(marco.prazo_atual),
      descricao: marco.descricao || '',
    });
    setShowForm(true);
  };

  // Move up/down
  const handleMove = async (index, direction) => {
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= marcos.length) return;

    const items = [
      { id: marcos[index].id, sort_order: marcos[swapIdx].sort_order },
      { id: marcos[swapIdx].id, sort_order: marcos[index].sort_order },
    ];

    try {
      await axios.put(`${API_URL}/api/marcos-projeto/reorder`, { items }, { withCredentials: true });
      await fetchMarcos();
    } catch (err) {
      console.error('Erro ao reordenar:', err);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ nome: '', status: 'pendente', prazo_baseline: '', prazo_atual: '', descricao: '' });
  };

  return (
    <div className="vista-cliente-container">
      {/* Header - same pattern as InicioView */}
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
          <button className="vcm-btn vcm-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + Novo Marco
          </button>
          <button
            className="vcm-btn vcm-btn-secondary"
            onClick={handleImport}
            disabled={importing || (!smartsheetId && !projectName)}
            title={!smartsheetId && !projectName ? 'Projeto sem Smartsheet vinculado' : 'Importar marcos do Smartsheet'}
          >
            {importing ? 'Importando...' : 'Importar do Smartsheet'}
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
                <label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="vcm-field">
                <label>Prazo Baseline</label>
                <input
                  type="date"
                  value={form.prazo_baseline}
                  onChange={e => setForm({ ...form, prazo_baseline: e.target.value })}
                />
              </div>
              <div className="vcm-field">
                <label>Prazo Atual</label>
                <input
                  type="date"
                  value={form.prazo_atual}
                  onChange={e => setForm({ ...form, prazo_atual: e.target.value })}
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

      {/* Marcos list */}
      <div className="vcm-list-card">
        {loading ? (
          <div className="vcm-empty">Carregando marcos...</div>
        ) : !projectCode ? (
          <div className="vcm-empty">Selecione um projeto para gerenciar marcos.</div>
        ) : marcos.length === 0 ? (
          <div className="vcm-empty">
            Nenhum marco cadastrado para este projeto.
            <br />
            <span className="vcm-empty-hint">
              Use "Importar do Smartsheet" para trazer os marcos existentes ou crie manualmente.
            </span>
          </div>
        ) : (
          <table className="vcm-table">
            <thead>
              <tr>
                <th className="vcm-th-order">#</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Prazo Baseline</th>
                <th>Prazo Atual</th>
                <th>Variacao</th>
                <th>Origem</th>
                <th className="vcm-th-actions">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {marcos.map((m, idx) => {
                const statusOpt = STATUS_OPTIONS.find(s => s.value === m.status) || STATUS_OPTIONS[0];
                const variacao = m.variacao_dias;
                return (
                  <tr key={m.id}>
                    <td className="vcm-td-order">
                      <div className="vcm-order-btns">
                        <button
                          className="vcm-order-btn"
                          onClick={() => handleMove(idx, -1)}
                          disabled={idx === 0}
                          title="Mover para cima"
                        >&#9650;</button>
                        <button
                          className="vcm-order-btn"
                          onClick={() => handleMove(idx, 1)}
                          disabled={idx === marcos.length - 1}
                          title="Mover para baixo"
                        >&#9660;</button>
                      </div>
                    </td>
                    <td className="vcm-td-nome">
                      <span className="vcm-nome">{m.nome}</span>
                      {m.descricao && (
                        <span className="vcm-descricao">{m.descricao}</span>
                      )}
                    </td>
                    <td>
                      <span className={`vcm-status-badge ${statusOpt.className}`}>
                        {statusOpt.label}
                      </span>
                    </td>
                    <td>{formatDateDisplay(m.prazo_baseline)}</td>
                    <td>{formatDateDisplay(m.prazo_atual)}</td>
                    <td>
                      {variacao != null && variacao !== 0 ? (
                        <span className={`vcm-variacao ${variacao > 0 ? 'atrasado' : 'adiantado'}`}>
                          {variacao > 0 ? '+' : ''}{variacao}d
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`vcm-source-badge ${m.source === 'smartsheet' ? 'smartsheet' : 'manual'}`}>
                        {m.source === 'smartsheet' ? 'Smartsheet' : 'Manual'}
                      </span>
                    </td>
                    <td className="vcm-td-actions">
                      <button className="vcm-action-btn edit" onClick={() => handleEdit(m)} title="Editar">
                        &#9998;
                      </button>
                      <button className="vcm-action-btn delete" onClick={() => handleDelete(m.id, m.nome)} title="Remover">
                        &#10005;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default VistaClienteMarcosView;

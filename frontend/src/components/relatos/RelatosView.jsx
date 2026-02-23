/**
 * Componente: Vista de Relatos (Diário de Projeto)
 *
 * Container principal da aba "Relatos" em ProjetosView.
 * Exibe lista de relatos do projeto com filtros por tipo e prioridade.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import RelatoCard from './RelatoCard';
import RelatoForm from './RelatoForm';
import '../../styles/RelatosView.css';

function RelatosView({ selectedProjectId, portfolio }) {
  const { user } = useAuth();
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');

  // Formulário
  const [showForm, setShowForm] = useState(false);
  const [editingRelato, setEditingRelato] = useState(null);

  // Card expandido
  const [expandedId, setExpandedId] = useState(null);

  // Derivar project_code do portfolio
  const selectedProject = portfolio?.find(p =>
    String(p.project_code_norm || p.project_code) === String(selectedProjectId)
  );
  const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code || selectedProjectId;

  // Buscar tipos e prioridades no mount
  useEffect(() => {
    fetchTipos();
    fetchPrioridades();
  }, []);

  // Buscar relatos quando projeto ou filtros mudam
  useEffect(() => {
    if (projectCode) {
      fetchRelatos();
    } else {
      setRelatos([]);
    }
  }, [projectCode, filtroTipo, filtroPrioridade]);

  const fetchTipos = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/relatos/tipos`, { withCredentials: true });
      if (res.data.success) setTipos(res.data.data);
    } catch (err) {
      console.error('Erro ao buscar tipos:', err);
    }
  };

  const fetchPrioridades = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/relatos/prioridades`, { withCredentials: true });
      if (res.data.success) setPrioridades(res.data.data);
    } catch (err) {
      console.error('Erro ao buscar prioridades:', err);
    }
  };

  const fetchRelatos = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.append('tipo', filtroTipo);
      if (filtroPrioridade) params.append('prioridade', filtroPrioridade);

      const url = `${API_URL}/api/relatos/project/${encodeURIComponent(projectCode)}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await axios.get(url, { withCredentials: true });

      if (res.data.success) {
        setRelatos(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar relatos:', err);
      setError('Erro ao carregar relatos');
    } finally {
      setLoading(false);
    }
  }, [projectCode, filtroTipo, filtroPrioridade]);

  const handleCreate = async (data) => {
    try {
      const res = await axios.post(`${API_URL}/api/relatos`, {
        project_code: projectCode,
        ...data,
      }, { withCredentials: true });

      if (res.data.success) {
        setShowForm(false);
        setEditingRelato(null);
        await fetchRelatos();
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao criar relato';
      throw new Error(msg);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await axios.put(`${API_URL}/api/relatos/${id}`, data, { withCredentials: true });

      if (res.data.success) {
        setShowForm(false);
        setEditingRelato(null);
        await fetchRelatos();
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao atualizar relato';
      throw new Error(msg);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja remover este relato?')) return;
    try {
      await axios.delete(`${API_URL}/api/relatos/${id}`, { withCredentials: true });
      await fetchRelatos();
    } catch (err) {
      console.error('Erro ao remover relato:', err);
      alert('Erro ao remover relato');
    }
  };

  const handleSave = async (data) => {
    if (editingRelato) {
      await handleUpdate(editingRelato.id, data);
    } else {
      await handleCreate(data);
    }
  };

  const canEdit = (relato) => {
    if (!user) return false;
    const role = user.role || user.papel;
    if (role === 'admin' || role === 'director') return true;
    return relato.author_id === user.id;
  };

  // Contadores para o footer
  const statsByPrioridade = {};
  for (const p of prioridades) {
    statsByPrioridade[p.slug] = relatos.filter(r => r.prioridade_slug === p.slug).length;
  }

  if (!projectCode) {
    return (
      <div className="relatos-container">
        <div className="relatos-empty">Selecione um projeto para ver os relatos.</div>
      </div>
    );
  }

  return (
    <div className="relatos-container">
      {/* Header com filtros */}
      <div className="relatos-header">
        <div className="relatos-header-left">
          <h3 className="relatos-title">Relatos</h3>
          <div className="relatos-filters">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="relatos-filter-select"
            >
              <option value="">Todos os tipos</option>
              {tipos.map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>

            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className="relatos-filter-select"
            >
              <option value="">Todas prioridades</option>
              {prioridades.map(p => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de relatos */}
      {error && <div className="relatos-error">{error}</div>}

      {loading ? (
        <div className="relatos-loading">Carregando relatos...</div>
      ) : (
        <div className="relatos-list">
          {relatos.map(relato => (
            <RelatoCard
              key={relato.id}
              relato={relato}
              isExpanded={expandedId === relato.id}
              onToggleExpand={() => setExpandedId(expandedId === relato.id ? null : relato.id)}
              onEdit={() => { setEditingRelato(relato); setShowForm(true); }}
              onDelete={() => handleDelete(relato.id)}
              canEdit={canEdit(relato)}
            />
          ))}
          {relatos.length === 0 && !loading && (
            <div className="relatos-empty">Nenhum relato encontrado para este projeto.</div>
          )}
        </div>
      )}

      {/* Footer com estatísticas */}
      <div className="relatos-footer">
        <div className="relatos-stats">
          <span className="relatos-stat-total">Total: {relatos.length} relatos</span>
          {prioridades.map(p => {
            const count = statsByPrioridade[p.slug] || 0;
            if (count === 0) return null;
            return (
              <span key={p.slug} className="relatos-stat-item" style={{ color: p.color }}>
                {p.label}: {count}
              </span>
            );
          })}
        </div>
        <button
          className="relatos-add-btn"
          onClick={() => { setEditingRelato(null); setShowForm(true); }}
        >
          + Adicionar relato
        </button>
      </div>

      {/* Modal do formulário */}
      {showForm && (
        <RelatoForm
          tipos={tipos}
          prioridades={prioridades}
          relato={editingRelato}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingRelato(null); }}
        />
      )}
    </div>
  );
}

export default RelatosView;

/**
 * Componente: Vista de Relatos (Diário de Projeto)
 *
 * Container principal da aba "Relatos" em ProjetosView.
 * Exibe lista de relatos do projeto com filtros chip por tipo, prioridade e status.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import RelatoCard from './RelatoCard';
import RelatoForm from './RelatoForm';
import { RelatoIcon } from './RelatoIcons';
import '../../styles/RelatosView.css';

function RelatosView({ selectedProjectId, portfolio }) {
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

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
  const construflowId = selectedProject?.construflow_id || null;

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

  const clearFilters = () => {
    setFiltroTipo('');
    setFiltroPrioridade('');
    setFiltroStatus('');
  };

  const hasFilters = filtroTipo || filtroPrioridade || filtroStatus;

  // Stats
  const stats = useMemo(() => {
    const total = relatos.length;
    const ativos = relatos.filter(r => !r.is_resolved).length;
    const resolvidos = total - ativos;
    return { total, ativos, resolvidos };
  }, [relatos]);

  // Chip counts
  const tipoChipCounts = useMemo(() => {
    const counts = {};
    tipos.forEach(t => { counts[t.slug] = 0; });
    relatos.forEach(r => {
      if (counts[r.tipo_slug] !== undefined) counts[r.tipo_slug]++;
    });
    return counts;
  }, [relatos, tipos]);

  const prioridadeChipCounts = useMemo(() => {
    const counts = {};
    prioridades.forEach(p => { counts[p.slug] = 0; });
    relatos.forEach(r => {
      if (counts[r.prioridade_slug] !== undefined) counts[r.prioridade_slug]++;
    });
    return counts;
  }, [relatos, prioridades]);

  // Filter by status (client-side)
  const filteredRelatos = useMemo(() => {
    if (!filtroStatus) return relatos;
    if (filtroStatus === 'ativos') return relatos.filter(r => !r.is_resolved);
    if (filtroStatus === 'resolvidos') return relatos.filter(r => r.is_resolved);
    return relatos;
  }, [relatos, filtroStatus]);

  if (!projectCode) {
    return (
      <div className="relatos-container">
        <div className="relatos-empty">
          <RelatoIcon name="clipboard" size={36} color="#d1d5db" />
          <p>Selecione um projeto para ver os relatos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relatos-container">
      {/* Header com stats inline + filtros chip */}
      <div className="relatos-header">
        <div className="relatos-header-top">
          <h3 className="relatos-title">Relatos</h3>
          <div className="relatos-stat-strip">
            <span className="relatos-stat-pill">
              <strong>{stats.total}</strong> total
            </span>
            <span className="relatos-stat-pill relatos-stat-pill--active">
              <strong>{stats.ativos}</strong> ativos
            </span>
            <span className="relatos-stat-pill relatos-stat-pill--resolved">
              <strong>{stats.resolvidos}</strong> resolvidos
            </span>
          </div>
        </div>

        <div className="relatos-filter-rows">
          {/* Tipo chips */}
          <div className="relatos-filter-group">
            <span className="relatos-filter-label">Tipo</span>
            <div className="relatos-chips">
              <button
                className={`relatos-chip ${filtroTipo === '' ? 'active' : ''}`}
                onClick={() => setFiltroTipo('')}
              >
                Todos
              </button>
              {tipos.map(t => (
                <button
                  key={t.slug}
                  className={`relatos-chip ${filtroTipo === t.slug ? 'active' : ''}`}
                  onClick={() => setFiltroTipo(filtroTipo === t.slug ? '' : t.slug)}
                  style={filtroTipo === t.slug ? { background: t.color, borderColor: t.color, color: '#fff' } : {}}
                >
                  <span className="relatos-chip-dot" style={{ backgroundColor: t.color }} />
                  {t.label}
                  {tipoChipCounts[t.slug] > 0 && (
                    <span className="relatos-chip-count">{tipoChipCounts[t.slug]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridade chips */}
          <div className="relatos-filter-group">
            <span className="relatos-filter-label">Prioridade</span>
            <div className="relatos-chips">
              <button
                className={`relatos-chip ${filtroPrioridade === '' ? 'active' : ''}`}
                onClick={() => setFiltroPrioridade('')}
              >
                Todas
              </button>
              {prioridades.map(p => (
                <button
                  key={p.slug}
                  className={`relatos-chip ${filtroPrioridade === p.slug ? 'active' : ''}`}
                  onClick={() => setFiltroPrioridade(filtroPrioridade === p.slug ? '' : p.slug)}
                  style={filtroPrioridade === p.slug ? { background: p.color, borderColor: p.color, color: '#fff' } : {}}
                >
                  {p.label}
                  {prioridadeChipCounts[p.slug] > 0 && (
                    <span className="relatos-chip-count">{prioridadeChipCounts[p.slug]}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status chips */}
          <div className="relatos-filter-group">
            <span className="relatos-filter-label">Status</span>
            <div className="relatos-chips">
              <button
                className={`relatos-chip ${filtroStatus === '' ? 'active' : ''}`}
                onClick={() => setFiltroStatus('')}
              >
                Todos
              </button>
              <button
                className={`relatos-chip ${filtroStatus === 'ativos' ? 'active' : ''}`}
                onClick={() => setFiltroStatus(filtroStatus === 'ativos' ? '' : 'ativos')}
              >
                Ativos
              </button>
              <button
                className={`relatos-chip ${filtroStatus === 'resolvidos' ? 'active' : ''}`}
                onClick={() => setFiltroStatus(filtroStatus === 'resolvidos' ? '' : 'resolvidos')}
              >
                Resolvidos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de relatos */}
      {error && <div className="relatos-error">{error}</div>}

      {loading ? (
        <div className="relatos-loading">Carregando relatos...</div>
      ) : filteredRelatos.length === 0 ? (
        <div className="relatos-empty">
          <RelatoIcon name="clipboard" size={36} color="#d1d5db" />
          <p>
            {hasFilters
              ? 'Nenhum relato encontrado com os filtros selecionados.'
              : 'Nenhum relato encontrado para este projeto.'}
          </p>
          {hasFilters && (
            <button className="relatos-clear-filters" onClick={clearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="relatos-list">
          {filteredRelatos.map(relato => (
            <RelatoCard
              key={relato.id}
              relato={relato}
              variant="internal"
              isExpanded={expandedId === relato.id}
              onToggleExpand={() => setExpandedId(expandedId === relato.id ? null : relato.id)}
              onEdit={() => { setEditingRelato(relato); setShowForm(true); }}
              onDelete={() => handleDelete(relato.id)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="relatos-footer">
        <span className="relatos-footer-text">
          {filteredRelatos.length < relatos.length
            ? `Mostrando ${filteredRelatos.length} de ${relatos.length} relatos`
            : `${relatos.length} relatos`
          }
        </span>
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
          construflowId={construflowId}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingRelato(null); }}
        />
      )}
    </div>
  );
}

export default RelatosView;

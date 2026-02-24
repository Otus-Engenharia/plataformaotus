/**
 * Componente: Seção compacta de Relatos para Vista do Cliente
 *
 * Reutiliza RelatoCard e RelatoForm existentes.
 * Versão compacta com filtros, lista e footer com contagens.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import RelatoCard from '../../components/relatos/RelatoCard';
import RelatoForm from '../../components/relatos/RelatoForm';

function RelatosSection({ projectCode }) {
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingRelato, setEditingRelato] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchTipos();
    fetchPrioridades();
  }, []);

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
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroPrioridade) params.set('prioridade', filtroPrioridade);

      const res = await axios.get(
        `${API_URL}/api/relatos/project/${encodeURIComponent(projectCode)}?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) setRelatos(res.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar relatos:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCode, filtroTipo, filtroPrioridade]);

  const handleSaveRelato = async (relatoData) => {
    try {
      if (editingRelato) {
        await axios.put(`${API_URL}/api/relatos/${editingRelato.id}`, relatoData, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/relatos`, { ...relatoData, project_code: projectCode }, { withCredentials: true });
      }
      setShowForm(false);
      setEditingRelato(null);
      fetchRelatos();
    } catch (err) {
      console.error('Erro ao salvar relato:', err);
    }
  };

  const handleDeleteRelato = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este relato?')) return;
    try {
      await axios.delete(`${API_URL}/api/relatos/${id}`, { withCredentials: true });
      fetchRelatos();
    } catch (err) {
      console.error('Erro ao deletar relato:', err);
    }
  };

  // Contagens por prioridade
  const statsByPrioridade = prioridades.reduce((acc, p) => {
    acc[p.slug] = { label: p.label, color: p.color, count: 0 };
    return acc;
  }, {});
  relatos.forEach(r => {
    if (statsByPrioridade[r.prioridade_slug]) {
      statsByPrioridade[r.prioridade_slug].count++;
    }
  });

  return (
    <div className="vc-relatos-section">
      <div className="vc-relatos-header">
        <div className="vc-relatos-header-left">
          <h4>Relatos</h4>
          <div className="vc-relatos-filters">
            <select
              className="vc-relatos-filter-select"
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {tipos.map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
            <select
              className="vc-relatos-filter-select"
              value={filtroPrioridade}
              onChange={e => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Todas prioridades</option>
              {prioridades.map(p => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="vc-relatos-loading">Carregando...</div>
      ) : relatos.length === 0 ? (
        <div className="vc-relatos-empty">Nenhum relato encontrado.</div>
      ) : (
        <div className="vc-relatos-list">
          {relatos.map(relato => (
            <RelatoCard
              key={relato.id}
              relato={relato}
              isExpanded={expandedId === relato.id}
              onToggleExpand={() => setExpandedId(expandedId === relato.id ? null : relato.id)}
              onEdit={() => { setEditingRelato(relato); setShowForm(true); }}
              onDelete={() => handleDeleteRelato(relato.id)}
            />
          ))}
        </div>
      )}

      <div className="vc-relatos-footer">
        <div className="vc-relatos-stats">
          <span>Total: {relatos.length} relatos</span>
          {Object.values(statsByPrioridade)
            .filter(s => s.count > 0)
            .map(s => (
              <span key={s.label} className="vc-relatos-stat-item" style={{ color: s.color }}>
                {s.label}: {s.count}
              </span>
            ))
          }
        </div>
        <button className="vc-relatos-add-btn" onClick={() => { setEditingRelato(null); setShowForm(true); }}>
          + Adicionar relato
        </button>
      </div>

      {showForm && (
        <RelatoForm
          relato={editingRelato}
          tipos={tipos}
          prioridades={prioridades}
          onSave={handleSaveRelato}
          onCancel={() => { setShowForm(false); setEditingRelato(null); }}
        />
      )}
    </div>
  );
}

export default RelatosSection;

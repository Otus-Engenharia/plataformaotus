/**
 * Componente: Seção de Relatos para Vista do Cliente
 *
 * Full-width com filtros chip. Somente leitura (sem editar/deletar/adicionar).
 * Reutiliza RelatoCard existente (ações de edição escondidas via CSS).
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import RelatoCard from '../../components/relatos/RelatoCard';

function RelatosSection({ projectCode }) {
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');

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

  // Noop handlers - botões ficam escondidos via CSS mas precisam de funções válidas
  const noop = () => {};

  return (
    <div className="vc-relatos-section">
      <div className="vc-relatos-header">
        <div className="vc-relatos-header-left">
          <h4>Relatos</h4>
          <div className="vc-relatos-chips">
            <button
              className={`vc-relatos-chip ${filtroTipo === '' ? 'active' : ''}`}
              onClick={() => setFiltroTipo('')}
            >
              Todos
            </button>
            {tipos.map(t => (
              <button
                key={t.slug}
                className={`vc-relatos-chip ${filtroTipo === t.slug ? 'active' : ''}`}
                onClick={() => setFiltroTipo(t.slug)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="vc-relatos-chips">
          <button
            className={`vc-relatos-chip ${filtroPrioridade === '' ? 'active' : ''}`}
            onClick={() => setFiltroPrioridade('')}
          >
            Todas
          </button>
          {prioridades.map(p => (
            <button
              key={p.slug}
              className={`vc-relatos-chip ${filtroPrioridade === p.slug ? 'active' : ''}`}
              onClick={() => setFiltroPrioridade(p.slug)}
              style={filtroPrioridade === p.slug ? { background: p.color, borderColor: p.color, color: '#fff' } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="vc-relatos-loading">Carregando...</div>
      ) : relatos.length === 0 ? (
        <div className="vc-relatos-empty">Nenhum relato encontrado.</div>
      ) : (
        <div className="vc-relatos-grid">
          {relatos.map(relato => (
            <RelatoCard
              key={relato.id}
              relato={relato}
              isExpanded={expandedId === relato.id}
              onToggleExpand={() => setExpandedId(expandedId === relato.id ? null : relato.id)}
              onEdit={noop}
              onDelete={noop}
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
      </div>
    </div>
  );
}

export default RelatosSection;

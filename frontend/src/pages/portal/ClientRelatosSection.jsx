/**
 * Componente: Secao de Relatos para Portal do Cliente
 *
 * Adaptacao de RelatosSection.jsx para usar Bearer auth e endpoints /api/client/*.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import RelatosKanbanBoard from '../../components/relatos/RelatosKanbanBoard';
import { RelatoIcon } from '../../components/relatos/RelatoIcons';

function ClientRelatosSection({ projectCode }) {
  const { getClientToken } = useClientAuth();
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');

  const [expandedId, setExpandedId] = useState(null);

  const clientAxios = useCallback(() => {
    const token = getClientToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [getClientToken]);

  useEffect(() => {
    const fetchTipos = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/client/relatos/tipos`, clientAxios());
        if (res.data.success) setTipos(res.data.data);
      } catch (err) {
        console.error('Erro ao buscar tipos:', err);
      }
    };
    const fetchPrioridades = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/client/relatos/prioridades`, clientAxios());
        if (res.data.success) setPrioridades(res.data.data);
      } catch (err) {
        console.error('Erro ao buscar prioridades:', err);
      }
    };
    fetchTipos();
    fetchPrioridades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRelatos = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/relatos`,
        clientAxios()
      );
      if (res.data.success) setRelatos(res.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar relatos:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCode, clientAxios]);

  useEffect(() => {
    if (projectCode) {
      fetchRelatos();
    } else {
      setRelatos([]);
    }
  }, [projectCode, fetchRelatos]);

  const stats = useMemo(() => ({ total: relatos.length }), [relatos]);

  const filteredRelatos = useMemo(() => {
    let result = relatos;

    if (filtroPeriodo === 'esta-semana') {
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      result = result.filter(r => new Date(r.created_at) >= weekStart);
    } else if (filtroPeriodo === 'este-mes') {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      result = result.filter(r => new Date(r.created_at) >= monthStart);
    }

    if (filtroPrioridade) result = result.filter(r => r.prioridade_slug === filtroPrioridade);

    return result;
  }, [relatos, filtroPrioridade, filtroPeriodo]);

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

  return (
    <div className="vc-relatos-section">
      <div className="vc-relatos-stat-strip">
        <div className="vc-relatos-stat-card">
          <span className="vc-relatos-stat-value">{stats.total}</span>
          <span className="vc-relatos-stat-label">Total</span>
        </div>
      </div>

      <div className="vc-relatos-header">
        <div className="vc-relatos-filter-group">
          <span className="vc-relatos-filter-label">Tipo</span>
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
                onClick={() => setFiltroTipo(filtroTipo === t.slug ? '' : t.slug)}
                style={filtroTipo === t.slug ? { background: t.color, borderColor: t.color, color: '#fff' } : {}}
              >
                <span className="vc-relatos-chip-dot" style={{ backgroundColor: t.color }} />
                {t.label}
                {tipoChipCounts[t.slug] > 0 && (
                  <span className="vc-relatos-chip-count">{tipoChipCounts[t.slug]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="vc-relatos-filter-group">
          <span className="vc-relatos-filter-label">Prioridade</span>
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
                onClick={() => setFiltroPrioridade(filtroPrioridade === p.slug ? '' : p.slug)}
                style={filtroPrioridade === p.slug ? { background: p.color, borderColor: p.color, color: '#fff' } : {}}
              >
                {p.label}
                {prioridadeChipCounts[p.slug] > 0 && (
                  <span className="vc-relatos-chip-count">{prioridadeChipCounts[p.slug]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="vc-relatos-filter-group">
          <span className="vc-relatos-filter-label">Período</span>
          <div className="vc-relatos-chips">
            <button
              className={`vc-relatos-chip ${filtroPeriodo === '' ? 'active' : ''}`}
              onClick={() => setFiltroPeriodo('')}
            >
              Sempre
            </button>
            <button
              className={`vc-relatos-chip ${filtroPeriodo === 'este-mes' ? 'active' : ''}`}
              onClick={() => setFiltroPeriodo(filtroPeriodo === 'este-mes' ? '' : 'este-mes')}
            >
              Este mês
            </button>
            <button
              className={`vc-relatos-chip ${filtroPeriodo === 'esta-semana' ? 'active' : ''}`}
              onClick={() => setFiltroPeriodo(filtroPeriodo === 'esta-semana' ? '' : 'esta-semana')}
            >
              Esta semana
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="vc-relatos-loading">
          <div className="vc-relatos-loading-spinner" />
          Carregando relatos...
        </div>
      ) : filteredRelatos.length === 0 && (filtroTipo || filtroPrioridade || filtroPeriodo) ? (
        <div className="vc-relatos-empty">
          <RelatoIcon name="clipboard" size={40} color="#d1d5db" />
          <p>Nenhum relato encontrado</p>
          <button
            className="vc-relatos-clear-filters"
            onClick={() => { setFiltroTipo(''); setFiltroPrioridade(''); setFiltroPeriodo(''); }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <RelatosKanbanBoard
          relatos={filteredRelatos}
          tipos={tipos}
          filtroTipo={filtroTipo}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          variant="client"
        />
      )}

      {filteredRelatos.length > 0 && (
        <div className="vc-relatos-footer">
          <span className="vc-relatos-footer-text">
            Mostrando {filteredRelatos.length} de {relatos.length} relatos
          </span>
        </div>
      )}
    </div>
  );
}

export default ClientRelatosSection;

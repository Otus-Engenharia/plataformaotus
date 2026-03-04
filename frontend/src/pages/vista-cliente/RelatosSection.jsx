/**
 * Componente: Secao de Relatos para Vista do Cliente
 *
 * Redesign profissional com stat strip, filtros chip com contagem,
 * e cards polidos. Somente leitura (sem editar/deletar/adicionar).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import RelatoCard from '../../components/relatos/RelatoCard';
import { RelatoIcon } from '../../components/relatos/RelatoIcons';

function RelatosSection({ projectCode }) {
  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(''); // '', 'ativos', 'resolvidos'

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

  // Computed stats
  const stats = useMemo(() => {
    const total = relatos.length;
    const ativos = relatos.filter(r => !r.is_resolved).length;
    const resolvidos = relatos.filter(r => r.is_resolved).length;

    const byTipo = {};
    tipos.forEach(t => { byTipo[t.slug] = { label: t.label, color: t.color, count: 0 }; });
    relatos.forEach(r => {
      if (byTipo[r.tipo_slug]) byTipo[r.tipo_slug].count++;
    });

    const byPrioridade = {};
    prioridades.forEach(p => { byPrioridade[p.slug] = { label: p.label, color: p.color, count: 0 }; });
    relatos.forEach(r => {
      if (byPrioridade[r.prioridade_slug]) byPrioridade[r.prioridade_slug].count++;
    });

    return { total, ativos, resolvidos, byTipo, byPrioridade };
  }, [relatos, tipos, prioridades]);

  // Filter by status (client-side)
  const filteredRelatos = useMemo(() => {
    if (!filtroStatus) return relatos;
    if (filtroStatus === 'ativos') return relatos.filter(r => !r.is_resolved);
    if (filtroStatus === 'resolvidos') return relatos.filter(r => r.is_resolved);
    return relatos;
  }, [relatos, filtroStatus]);

  // Count per tipo chip (from filtered results)
  const tipoChipCounts = useMemo(() => {
    const counts = {};
    tipos.forEach(t => { counts[t.slug] = 0; });
    // Use all relatos for counts (not filtered)
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
      {/* Stat strip */}
      <div className="vc-relatos-stat-strip">
        <div className="vc-relatos-stat-card">
          <span className="vc-relatos-stat-value">{stats.total}</span>
          <span className="vc-relatos-stat-label">Total</span>
        </div>
        <div className="vc-relatos-stat-card">
          <span className="vc-relatos-stat-value vc-relatos-stat-value--active">{stats.ativos}</span>
          <span className="vc-relatos-stat-label">Ativos</span>
        </div>
        <div className="vc-relatos-stat-card">
          <span className="vc-relatos-stat-value vc-relatos-stat-value--resolved">{stats.resolvidos}</span>
          <span className="vc-relatos-stat-label">Resolvidos</span>
        </div>
        <div className="vc-relatos-stat-divider" />
        {Object.entries(stats.byTipo)
          .filter(([, v]) => v.count > 0)
          .map(([slug, v]) => (
            <div key={slug} className="vc-relatos-stat-card vc-relatos-stat-card--tipo">
              <span className="vc-relatos-stat-value" style={{ color: v.color }}>{v.count}</span>
              <span className="vc-relatos-stat-label">
                <span className="vc-relatos-stat-dot" style={{ backgroundColor: v.color }} />
                {v.label}
              </span>
            </div>
          ))
        }
      </div>

      {/* Filters */}
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
          <span className="vc-relatos-filter-label">Status</span>
          <div className="vc-relatos-chips">
            <button
              className={`vc-relatos-chip ${filtroStatus === '' ? 'active' : ''}`}
              onClick={() => setFiltroStatus('')}
            >
              Todos
            </button>
            <button
              className={`vc-relatos-chip ${filtroStatus === 'ativos' ? 'active' : ''}`}
              onClick={() => setFiltroStatus(filtroStatus === 'ativos' ? '' : 'ativos')}
            >
              Ativos
            </button>
            <button
              className={`vc-relatos-chip ${filtroStatus === 'resolvidos' ? 'active' : ''}`}
              onClick={() => setFiltroStatus(filtroStatus === 'resolvidos' ? '' : 'resolvidos')}
            >
              Resolvidos
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="vc-relatos-loading">
          <div className="vc-relatos-loading-spinner" />
          Carregando relatos...
        </div>
      ) : filteredRelatos.length === 0 ? (
        <div className="vc-relatos-empty">
          <RelatoIcon name="clipboard" size={40} color="#d1d5db" />
          <p>Nenhum relato encontrado</p>
          {(filtroTipo || filtroPrioridade || filtroStatus) && (
            <button
              className="vc-relatos-clear-filters"
              onClick={() => { setFiltroTipo(''); setFiltroPrioridade(''); setFiltroStatus(''); }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="vc-relatos-grid">
          {filteredRelatos.map(relato => (
            <RelatoCard
              key={relato.id}
              relato={relato}
              variant="client"
              isExpanded={expandedId === relato.id}
              onToggleExpand={() => setExpandedId(expandedId === relato.id ? null : relato.id)}
            />
          ))}
        </div>
      )}

      {/* Footer summary */}
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

export default RelatosSection;

/**
 * Portal do Cliente - Relatos
 *
 * Versao portal do RelatosSection, usando Bearer token auth.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import RelatosKanbanBoard from '../../components/relatos/RelatosKanbanBoard';
import { RelatoIcon } from '../../components/relatos/RelatoIcons';
import '../../styles/VistaClienteView.css';

function ClientRelatosView() {
  const { projectCode } = useParams();
  const { getClientToken } = useClientAuth();

  const [relatos, setRelatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const clientAxios = useCallback(() => ({
    headers: { Authorization: `Bearer ${getClientToken()}` },
  }), [getClientToken]);

  // Fetch tipos and prioridades from client endpoint
  useEffect(() => {
    async function loadMeta() {
      try {
        const config = clientAxios();
        const [tiposRes, prioridadesRes] = await Promise.all([
          axios.get(`${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/relatos?_meta=tipos`, config).catch(() => null),
          axios.get(`${API_URL}/api/relatos/tipos`, { withCredentials: true }).catch(() => null),
        ]);
        // Try to get tipos/prioridades - fall back to empty
        // The relatos endpoint returns them with the data, or we use the public endpoints
      } catch (err) {
        // ignore
      }
    }
    // Fetch tipos and prioridades from internal endpoints (they're read-only lookups)
    async function fetchLookups() {
      try {
        const config = clientAxios();
        // These are lookup tables - try fetching via client relatos endpoint
        const relatosRes = await axios.get(
          `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/relatos`,
          config
        );
        if (relatosRes.data.success) {
          const data = relatosRes.data.data || [];
          setRelatos(data);

          // Extract unique tipos and prioridades from data
          const tipoMap = new Map();
          const prioridadeMap = new Map();
          data.forEach(r => {
            if (r.tipo_slug && r.tipo_label) {
              tipoMap.set(r.tipo_slug, { slug: r.tipo_slug, label: r.tipo_label, color: r.tipo_color || '#737373' });
            }
            if (r.prioridade_slug && r.prioridade_label) {
              prioridadeMap.set(r.prioridade_slug, { slug: r.prioridade_slug, label: r.prioridade_label, color: r.prioridade_color || '#737373' });
            }
          });
          setTipos([...tipoMap.values()]);
          setPrioridades([...prioridadeMap.values()]);
        }
      } catch (err) {
        console.error('Erro ao buscar relatos:', err);
      } finally {
        setLoading(false);
      }
    }

    if (projectCode) {
      setLoading(true);
      fetchLookups();
    }
  }, [projectCode, clientAxios]);

  // Filtering
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
    <div className="vista-cliente-container">
      <div className="vc-relatos-section">
        {/* Stat strip */}
        <div className="vc-relatos-stat-strip">
          <div className="vc-relatos-stat-card">
            <span className="vc-relatos-stat-value">{relatos.length}</span>
            <span className="vc-relatos-stat-label">Total</span>
          </div>
        </div>

        {/* Filters */}
        <div className="vc-relatos-header">
          {tipos.length > 0 && (
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
          )}

          {prioridades.length > 0 && (
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
          )}

          <div className="vc-relatos-filter-group">
            <span className="vc-relatos-filter-label">Periodo</span>
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
                Este mes
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

        {/* Content */}
        {loading ? (
          <div className="cp-view-loading">
            <div className="cp-view-spinner" />
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
        ) : relatos.length === 0 ? (
          <div className="cp-view-empty">
            <span className="cp-view-empty-icon">&#128203;</span>
            Nenhum relato registrado para este projeto.
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

        {/* Footer */}
        {filteredRelatos.length > 0 && (
          <div className="vc-relatos-footer">
            <span className="vc-relatos-footer-text">
              Mostrando {filteredRelatos.length} de {relatos.length} relatos
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientRelatosView;

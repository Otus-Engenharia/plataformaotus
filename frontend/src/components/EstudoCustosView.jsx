/**
 * Vista Estudo de Custos
 * Dados: dadosindicadores.apoio_projetos.estudo_custos_pbi
 * Coordenador: portfólio (lider) por Projeto = project_name.
 * Acesso: todos os usuários autenticados
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/EstudoCustosView.css';

/** "R$ 1.234.567,89" → número. */
function parseValorBR(s) {
  if (s == null || String(s).trim() === '') return NaN;
  const t = String(s).replace(/R\$\s*/gi, '').replace(/\./g, '').trim().replace(',', '.');
  return parseFloat(t);
}

/** "0,27%" ou "3,79%" → número. */
function parsePctBR(s) {
  if (s == null || String(s).trim() === '') return NaN;
  const t = String(s).replace(/%/g, '').trim().replace(',', '.');
  return parseFloat(t);
}

function formatValorBR(n) {
  if (Number.isNaN(n) || n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatPctBR(n) {
  if (Number.isNaN(n) || n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + '%';
}

function EstudoCustosView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [applied, setApplied] = useState({ coordenador: '', projeto: '', data: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/estudo-custos`, { withCredentials: true });
      if (res.data?.success) {
        setData(res.data.data || []);
        setLastUpdated(new Date().toISOString());
      } else {
        setError(res.data?.error || 'Erro ao carregar estudo de custos');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar estudo de custos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (d) => {
    if (!d) return '—';
    return String(d).trim() || '—';
  };

  const rawRows = Array.isArray(data) ? data : [];
  const filterOptions = useMemo(() => {
    const coords = [...new Set(rawRows.map((r) => (r.coordenador && String(r.coordenador).trim()) || null).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const projs = [...new Set(rawRows.map((r) => (r.Projeto && String(r.Projeto).trim()) || null).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const datas = [...new Set(rawRows.map((r) => (r.Data && String(r.Data).trim()) || null).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { coordenadores: coords, projetos: projs, datas };
  }, [data]);

  const filteredRows = useMemo(() => {
    let out = rawRows;
    if (applied.coordenador) {
      out = out.filter((r) => (r.coordenador && String(r.coordenador).trim()) === applied.coordenador);
    }
    if (applied.projeto) {
      out = out.filter((r) => (r.Projeto && String(r.Projeto).trim()) === applied.projeto);
    }
    if (applied.data) {
      out = out.filter((r) => (r.Data && String(r.Data).trim()) === applied.data);
    }
    return out;
  }, [data, applied]);

  const indicadores = useMemo(() => {
    const rows = filteredRows;
    let totalValor = 0;
    let totalCusto = 0;
    const pcts = [];
    for (const r of rows) {
      const v = parseValorBR(r.valor_estudo_custo);
      const c = parseValorBR(r.custo_estimado_obra);
      const p = parsePctBR(r.economia_oba);
      if (!Number.isNaN(v)) totalValor += v;
      if (!Number.isNaN(c)) totalCusto += c;
      if (!Number.isNaN(p)) pcts.push(p);
    }
    const economiaMedia = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
    return {
      totalValorEstudoCusto: totalValor,
      totalCustoEstimadoObra: totalCusto,
      economiaMedia,
      numProjetos: rows.length,
    };
  }, [filteredRows]);

  if (loading && !data) {
    return (
      <div className="ec-container">
        <div className="ec-skeleton">
          <div className="ec-skeleton-header" />
          <div className="ec-skeleton-filters" />
          <div className="ec-skeleton-cards">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ec-skeleton-card" />
            ))}
          </div>
          <div className="ec-skeleton-table" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="ec-container">
        <div className="ec-error">
          <p>{error}</p>
          <button type="button" className="ec-retry" onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const rows = filteredRows;
  const { totalValorEstudoCusto, totalCustoEstimadoObra, economiaMedia, numProjetos } = indicadores;
  const hasFilters = applied.coordenador || applied.projeto || applied.data;

  return (
    <div className="ec-container">
      <header className="ec-header">
        <div className="ec-header-text">
          <h1 className="ec-title">Estudo de Custos</h1>
          <p className="ec-subtitle">Valor do estudo, custo estimado da obra e economia</p>
        </div>
        <div className="ec-header-actions">
          {lastUpdated && (
            <span className="ec-last-update" aria-live="polite">
              Atualizado: {new Date(lastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button type="button" className="ec-refresh" onClick={fetchData} disabled={loading} aria-label="Atualizar">
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      {rawRows.length > 0 && (
        <section className="ec-filters" aria-label="Filtros do estudo de custos">
          <label className="ec-filter">
            <span className="ec-filter-label">Coordenador</span>
            <select
              value={applied.coordenador}
              onChange={(e) => setApplied((a) => ({ ...a, coordenador: e.target.value }))}
              className="ec-select"
              aria-label="Filtrar por coordenador"
            >
              <option value="">Todos</option>
              {filterOptions.coordenadores.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="ec-filter">
            <span className="ec-filter-label">Projeto</span>
            <select
              value={applied.projeto}
              onChange={(e) => setApplied((a) => ({ ...a, projeto: e.target.value }))}
              className="ec-select"
              aria-label="Filtrar por projeto"
            >
              <option value="">Todos</option>
              {filterOptions.projetos.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="ec-filter">
            <span className="ec-filter-label">Data / Período</span>
            <select
              value={applied.data}
              onChange={(e) => setApplied((a) => ({ ...a, data: e.target.value }))}
              className="ec-select"
              aria-label="Filtrar por data"
            >
              <option value="">Todos</option>
              {filterOptions.datas.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              className="ec-filter-clear"
              onClick={() => setApplied({ coordenador: '', projeto: '', data: '' })}
              aria-label="Limpar filtros"
            >
              Limpar filtros
            </button>
          )}
        </section>
      )}

      {rawRows.length > 0 && (
        <section className="ec-indicators" aria-label="Indicadores do estudo de custos">
          <div className="ec-indicators-grid">
            <div className="ec-indicator-card">
              <span className="ec-indicator-value">{formatValorBR(totalValorEstudoCusto)}</span>
              <span className="ec-indicator-label">Total valor estudo custo</span>
            </div>
            <div className="ec-indicator-card">
              <span className="ec-indicator-value">{formatValorBR(totalCustoEstimadoObra)}</span>
              <span className="ec-indicator-label">Total custo estimado obra</span>
            </div>
            <div className="ec-indicator-card">
              <span className="ec-indicator-value">{formatPctBR(economiaMedia)}</span>
              <span className="ec-indicator-label">Economia média</span>
            </div>
            <div className="ec-indicator-card">
              <span className="ec-indicator-value">{numProjetos}</span>
              <span className="ec-indicator-label">Projetos</span>
            </div>
          </div>
        </section>
      )}

      <section className="ec-table-card" aria-label="Tabela de estudo de custos">
        <div className="ec-table-scroll">
          <table className="ec-table">
            <thead>
              <tr>
                <th scope="col">Projeto</th>
                <th scope="col">Coordenador</th>
                <th scope="col">Código</th>
                <th scope="col">Data</th>
                <th scope="col">Valor estudo custo</th>
                <th scope="col">Custo estimado obra</th>
                <th scope="col">Economia</th>
                <th scope="col">Planilha</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="ec-table-empty">
                    {rawRows.length === 0
                      ? 'Nenhum registro de estudo de custos encontrado.'
                      : 'Nenhum registro para os filtros selecionados. Tente alterar ou limpar os filtros.'}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.Projeto ?? ''}-${row.codigo_projeto ?? ''}-${i}`} className={i % 2 === 1 ? 'ec-table-zebra' : ''}>
                    <td>{row.Projeto ?? '—'}</td>
                    <td>{row.coordenador ?? '—'}</td>
                    <td className="ec-table-num">{row.codigo_projeto ?? '—'}</td>
                    <td>{formatDate(row.Data)}</td>
                    <td className="ec-table-num">{row.valor_estudo_custo ?? '—'}</td>
                    <td className="ec-table-num">{row.custo_estimado_obra ?? '—'}</td>
                    <td className="ec-table-num">{row.economia_oba ?? '—'}</td>
                    <td>
                      {row.Planilha ? (
                        <a href={row.Planilha} target="_blank" rel="noopener noreferrer" className="ec-link">
                          Abrir
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default EstudoCustosView;

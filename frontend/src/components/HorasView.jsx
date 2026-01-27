/**
 * Vista Horas (timetracker)
 * Duas abas: (1) Análise – gráficos nas últimas semanas; (2) Por projeto – horas agrupadas com filtro.
 * Dados: dadosindicadores.timetracker.timetracker_merged, portfólio por projeto.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { API_URL } from '../api';
import '../styles/HorasView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const ULTIMAS_SEMANAS_OPTS = [1, 2, 4];
const TOP_ATIVIDADES_LIMIT = 20;

function formatDateBR(val) {
  if (val == null || val === '') return '—';
  const s = typeof val === 'object' && val?.value != null ? String(val.value) : String(val);
  const trimmed = s.trim();
  if (!trimmed) return '—';
  try {
    const d = /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? new Date(trimmed) : new Date(trimmed);
    if (Number.isNaN(d.getTime())) return trimmed;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return trimmed;
  }
}

function HorasView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [periodo, setPeriodo] = useState({ dataInicio: null, dataFim: null });
  const [tab, setTab] = useState('analise');
  const [ultimasSemanas, setUltimasSemanas] = useState(2);
  const [timeFilter, setTimeFilter] = useState('');
  const [projetoDetalhe, setProjetoDetalhe] = useState('');
  const [projetoFilter, setProjetoFilter] = useState('');
  const [timesList, setTimesList] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [horasRes, timesRes] = await Promise.all([
        axios.get(`${API_URL}/api/horas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/times`, { withCredentials: true }).catch(() => ({ data: { success: false } })),
      ]);
      if (horasRes.data?.success) {
        setData({
          porTime: horasRes.data.porTime || [],
          porProjeto: horasRes.data.porProjeto || [],
        });
        setLastUpdated(new Date().toISOString());
        setPeriodo({ dataInicio: horasRes.data.dataInicio, dataFim: horasRes.data.dataFim });
      } else {
        setError(horasRes.data?.error || 'Erro ao carregar horas');
      }
      if (timesRes.data?.success && Array.isArray(timesRes.data.data)) {
        setTimesList(timesRes.data.data);
      } else {
        setTimesList([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar horas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const porTime = Array.isArray(data?.porTime) ? data.porTime : [];
  const porProjeto = Array.isArray(data?.porProjeto) ? data.porProjeto : [];

  const timeOptions = useMemo(() => {
    if (timesList.length > 0) {
      return timesList.map((t) => ({ value: t.value, label: t.label ?? t.value }));
    }
    return porTime.map((g) => ({ value: g.time, label: g.time })).filter((t) => t.value);
  }, [timesList, porTime]);

  const apontamentosFlat = useMemo(() => {
    const out = [];
    const groups = timeFilter ? porTime.filter((g) => String(g.time || '') === timeFilter) : porTime;
    for (const g of groups) {
      for (const a of g.apontamentos || []) out.push(a);
    }
    return out;
  }, [porTime, timeFilter]);

  const projectOptions = useMemo(() => {
    const list = porProjeto
      .map((p) => (p.projeto != null ? String(p.projeto).trim() : ''))
      .filter((s) => s.length > 0);
    return [...new Set(list)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [porProjeto]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ultimasSemanas * 7);
    return d.toISOString().slice(0, 10);
  }, [ultimasSemanas]);

  const analiseRows = useMemo(() => {
    return apontamentosFlat.filter((a) => (a.data_de_apontamento || '') >= cutoff);
  }, [apontamentosFlat, cutoff]);

  const porData = useMemo(() => {
    const m = new Map();
    for (const a of analiseRows) {
      const raw = a.data_de_apontamento;
      const d =
        typeof raw === 'string'
          ? raw
          : raw != null && typeof raw === 'object' && raw.value != null
            ? String(raw.value)
            : '—';
      const h = a.horas ?? 0;
      m.set(d, (m.get(d) || 0) + h);
    }
    return Array.from(m.entries())
      .sort((x, y) => String(x[0]).localeCompare(String(y[0]), 'pt-BR'))
      .map(([date, horas]) => ({ date, horas }));
  }, [analiseRows]);

  const porUsuario = useMemo(() => {
    const m = new Map();
    for (const a of analiseRows) {
      const u = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '—');
      const h = a.horas ?? 0;
      m.set(u, (m.get(u) || 0) + h);
    }
    return Array.from(m.entries())
      .sort((x, y) => (y[1] || 0) - (x[1] || 0))
      .map(([usuario, horas]) => ({ usuario, horas }));
  }, [analiseRows]);

  const porProjetoAnalise = useMemo(() => {
    const m = new Map();
    for (const a of analiseRows) {
      const p = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—');
      const h = a.horas ?? 0;
      m.set(p, (m.get(p) || 0) + h);
    }
    return Array.from(m.entries())
      .sort((x, y) => (y[1] || 0) - (x[1] || 0))
      .map(([projeto, horas]) => ({ projeto, horas }));
  }, [analiseRows]);

  const topAtividades = useMemo(() => {
    const m = new Map();
    for (const a of analiseRows) {
      const t = typeof a.task_name === 'string' ? a.task_name : (a.task_name != null ? String(a.task_name) : '—');
      const h = a.horas ?? 0;
      m.set(t, (m.get(t) || 0) + h);
    }
    return Array.from(m.entries())
      .map(([atividade, horas]) => ({ atividade, horas: horas || 0 }))
      .sort((x, y) => y.horas - x.horas)
      .slice(0, TOP_ATIVIDADES_LIMIT);
  }, [analiseRows]);

  const projectOptionsAnalise = useMemo(() => {
    const list = porProjetoAnalise.map((x) => x.projeto).filter((s) => s && s !== '—');
    return [...new Set(list)].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
  }, [porProjetoAnalise]);

  const detalheProjetoRows = useMemo(() => {
    if (!projetoDetalhe) return [];
    return analiseRows.filter((a) => {
      const p = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '');
      return p === projetoDetalhe;
    });
  }, [analiseRows, projetoDetalhe]);

  const detalheProjetoAtividades = useMemo(() => {
    const m = new Map();
    for (const a of detalheProjetoRows) {
      const t = typeof a.task_name === 'string' ? a.task_name : (a.task_name != null ? String(a.task_name) : '—');
      const h = a.horas ?? 0;
      m.set(t, (m.get(t) || 0) + h);
    }
    return Array.from(m.entries())
      .map(([atividade, horas]) => ({ atividade, horas }))
      .sort((x, y) => (y.horas || 0) - (x.horas || 0));
  }, [detalheProjetoRows]);

  const chartPorData = useMemo(() => {
    if (!porData.length) return null;
    return {
      labels: porData.map((x) => formatDateBR(x.date)),
      datasets: [
        {
          label: 'Horas',
          data: porData.map((x) => Math.round(x.horas * 100) / 100),
          backgroundColor: 'rgba(14, 165, 233, 0.7)',
          borderColor: 'rgba(14, 165, 233, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [porData]);

  const chartPorUsuario = useMemo(() => {
    if (!porUsuario.length) return null;
    return {
      labels: porUsuario.map((x) => x.usuario),
      datasets: [
        {
          label: 'Horas',
          data: porUsuario.map((x) => Math.round(x.horas * 100) / 100),
          backgroundColor: 'rgba(255, 204, 0, 0.7)',
          borderColor: 'rgba(255, 204, 0, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [porUsuario]);

  const chartPorProjeto = useMemo(() => {
    if (!porProjetoAnalise.length) return null;
    return {
      labels: porProjetoAnalise.map((x) => x.projeto),
      datasets: [
        {
          label: 'Horas',
          data: porProjetoAnalise.map((x) => Math.round(x.horas * 100) / 100),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [porProjetoAnalise]);

  const chartTopAtividades = useMemo(() => {
    if (!topAtividades.length) return null;
    return {
      labels: topAtividades.map((x) => x.atividade),
      datasets: [
        {
          label: 'Horas',
          data: topAtividades.map((x) => Math.round(x.horas * 100) / 100),
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [topAtividades]);

  const chartDetalheAtividades = useMemo(() => {
    if (!detalheProjetoAtividades.length || !projetoDetalhe) return null;
    return {
      labels: detalheProjetoAtividades.map((x) => x.atividade),
      datasets: [
        {
          label: 'Horas',
          data: detalheProjetoAtividades.map((x) => Math.round(x.horas * 100) / 100),
          backgroundColor: 'rgba(14, 165, 233, 0.7)',
          borderColor: 'rgba(14, 165, 233, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [detalheProjetoAtividades, projetoDetalhe]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw} h` } },
      },
      scales: {
        x: { title: { display: true, text: 'Data' } },
        y: { beginAtZero: true, title: { display: true, text: 'Horas' } },
      },
    }),
    []
  );

  const chartOptionsHorizontal = useMemo(
    () => ({
      ...chartOptions,
      indexAxis: 'y',
      scales: {
        ...chartOptions.scales,
        x: { beginAtZero: true, title: { display: true, text: 'Horas' } },
        y: { ...chartOptions.scales.y, title: { display: false } },
      },
    }),
    [chartOptions]
  );

  const filteredPorProjeto = useMemo(() => {
    if (!projetoFilter) return porProjeto;
    return porProjeto.filter((p) => (p.projeto || '') === projetoFilter);
  }, [porProjeto, projetoFilter]);

  const totalAnalise = analiseRows.reduce((s, a) => s + (a.horas ?? 0), 0);
  const totalGeral = porProjeto.reduce((s, g) => s + (g.totalHoras ?? 0), 0);

  if (loading && !data) {
    return (
      <div className="hv-container">
        <div className="hv-skeleton">
          <div className="hv-skeleton-header" />
          <div className="hv-skeleton-tabs" />
          <div className="hv-skeleton-section" />
          <div className="hv-skeleton-section" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="hv-container">
        <div className="hv-error">
          <p>{error}</p>
          <button type="button" className="hv-retry" onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hv-container">
      <header className="hv-header">
        <div className="hv-header-text">
          <h1 className="hv-title">Horas</h1>
          <p className="hv-subtitle">Apontamentos de horas por time (timetracker)</p>
        </div>
        <div className="hv-header-actions">
          {periodo.dataInicio && periodo.dataFim && (
            <span className="hv-periodo" aria-live="polite">
              Período: {formatDateBR(periodo.dataInicio)} a {formatDateBR(periodo.dataFim)}
            </span>
          )}
          {lastUpdated && (
            <span className="hv-last-update" aria-live="polite">
              Atualizado: {new Date(lastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button type="button" className="hv-refresh" onClick={fetchData} disabled={loading} aria-label="Atualizar">
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      <nav className="hv-tabs" role="tablist" aria-label="Abas da vista Horas">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'analise'}
          aria-controls="hv-panel-analise"
          id="hv-tab-analise"
          className={`hv-tab ${tab === 'analise' ? 'hv-tab-active' : ''}`}
          onClick={() => setTab('analise')}
        >
          Análise (últimas semanas)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'projeto'}
          aria-controls="hv-panel-projeto"
          id="hv-tab-projeto"
          className={`hv-tab ${tab === 'projeto' ? 'hv-tab-active' : ''}`}
          onClick={() => setTab('projeto')}
        >
          Por projeto
        </button>
      </nav>

      {tab === 'analise' && (
        <section id="hv-panel-analise" role="tabpanel" aria-labelledby="hv-tab-analise" className="hv-panel">
          <div className="hv-filters">
            <label className="hv-filter">
              <span className="hv-filter-label">Time</span>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="hv-select"
                aria-label="Filtrar por time"
              >
                <option value="">Todos</option>
                {timeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="hv-filter">
              <span className="hv-filter-label">Últimas</span>
              <select
                value={ultimasSemanas}
                onChange={(e) => setUltimasSemanas(Number(e.target.value))}
                className="hv-select"
                aria-label="Últimas N semanas"
              >
                {ULTIMAS_SEMANAS_OPTS.map((n) => (
                  <option key={n} value={n}>{n} semana{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </label>
          </div>
          {totalAnalise > 0 && (
            <div className="hv-total-card hv-total-analise">
              <span className="hv-total-value">{totalAnalise.toFixed(1)}</span>
              <span className="hv-total-label">
                Total de horas nas últimas {ultimasSemanas} semana{ultimasSemanas > 1 ? 's' : ''}
                {timeFilter ? ` • Time: ${timeFilter}` : ''}
              </span>
            </div>
          )}
          <div className="hv-charts">
            {chartPorData && (
              <div className="hv-chart-card">
                <h3 className="hv-chart-title">Horas por dia</h3>
                <div className="hv-chart-wrap">
                  <Bar data={chartPorData} options={chartOptions} />
                </div>
              </div>
            )}
            {chartPorUsuario && (
              <div className="hv-chart-card">
                <h3 className="hv-chart-title">Horas por usuário</h3>
                <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: `${Math.max(200, porUsuario.length * 28)}px` }}>
                  <Bar data={chartPorUsuario} options={chartOptionsHorizontal} />
                </div>
              </div>
            )}
            {chartPorProjeto && (
              <div className="hv-chart-card hv-chart-full">
                <h3 className="hv-chart-title">Horas por projeto</h3>
                <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: `${Math.max(200, porProjetoAnalise.length * 28)}px` }}>
                  <Bar data={chartPorProjeto} options={chartOptionsHorizontal} />
                </div>
              </div>
            )}
          </div>
          {chartTopAtividades && (
            <div className="hv-section hv-section-atividades">
              <h3 className="hv-section-title">Atividades que mais consumiram tempo (últimas {ultimasSemanas} semana{ultimasSemanas > 1 ? 's' : ''})</h3>
              <div className="hv-top-atividades">
                <div className="hv-chart-card hv-chart-half">
                  <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: `${Math.max(220, topAtividades.length * 24)}px` }}>
                    <Bar data={chartTopAtividades} options={chartOptionsHorizontal} />
                  </div>
                </div>
                <div className="hv-chart-card hv-chart-half hv-table-atividades">
                  <div className="hv-time-table-scroll">
                    <table className="hv-table" aria-label="Top atividades por horas">
                      <thead>
                        <tr>
                          <th scope="col">Atividade</th>
                          <th scope="col">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topAtividades.map((x, i) => (
                          <tr key={x.atividade} className={i % 2 === 1 ? 'hv-table-zebra' : ''}>
                            <td>{x.atividade}</td>
                            <td className="hv-table-num">{Math.round(x.horas * 100) / 100} h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="hv-section hv-section-detalhe">
            <h3 className="hv-section-title">Detalhe por projeto</h3>
            <p className="hv-section-desc">Selecione um projeto para ver apontamentos e distribuição por atividade.</p>
            <label className="hv-filter">
              <span className="hv-filter-label">Projeto</span>
              <select
                value={projetoDetalhe}
                onChange={(e) => setProjetoDetalhe(e.target.value)}
                className="hv-select"
                aria-label="Selecionar projeto para detalhar"
              >
                <option value="">Selecione um projeto</option>
                {projectOptionsAnalise.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            {projetoDetalhe && (
              <div className="hv-detalhe-projeto">
                {chartDetalheAtividades && (
                  <div className="hv-chart-card">
                    <h4 className="hv-chart-subtitle">Atividades no projeto {projetoDetalhe}</h4>
                    <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: `${Math.max(180, detalheProjetoAtividades.length * 24)}px` }}>
                      <Bar data={chartDetalheAtividades} options={chartOptionsHorizontal} />
                    </div>
                  </div>
                )}
                <div className="hv-time-card">
                  <div className="hv-time-header">
                    <h4 className="hv-time-title">Apontamentos</h4>
                    <span className="hv-time-total">
                      {detalheProjetoRows.reduce((s, a) => s + (a.horas ?? 0), 0).toFixed(1)} h
                    </span>
                  </div>
                  <div className="hv-time-table-scroll">
                    <table className="hv-table" aria-label={`Apontamentos do projeto ${projetoDetalhe}`}>
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Usuário</th>
                          <th scope="col">Atividade</th>
                          <th scope="col">Fase</th>
                          <th scope="col">Duração</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalheProjetoRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="hv-table-empty">
                              Nenhum apontamento no período para este projeto.
                            </td>
                          </tr>
                        ) : (
                          detalheProjetoRows.map((a, i) => (
                            <tr key={`${a.usuario}-${a.data_de_apontamento}-${i}`} className={i % 2 === 1 ? 'hv-table-zebra' : ''}>
                              <td>{formatDateBR(a.data_de_apontamento)}</td>
                              <td>{a.usuario ?? '—'}</td>
                              <td>{a.task_name ?? '—'}</td>
                              <td>{a.fase ?? '—'}</td>
                              <td className="hv-table-num">{a.duracao ?? '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
          {analiseRows.length === 0 && (
            <div className="hv-empty">
              <p>Nenhum apontamento nas últimas {ultimasSemanas} semana{ultimasSemanas > 1 ? 's' : ''}{timeFilter ? ` para o time ${timeFilter}` : ''}.</p>
            </div>
          )}
        </section>
      )}

      {tab === 'projeto' && (
        <section id="hv-panel-projeto" role="tabpanel" aria-labelledby="hv-tab-projeto" className="hv-panel">
          <div className="hv-filters">
            <label className="hv-filter">
              <span className="hv-filter-label">Projeto</span>
              <select
                value={projetoFilter}
                onChange={(e) => setProjetoFilter(e.target.value)}
                className="hv-select"
                aria-label="Filtrar por projeto"
              >
                <option value="">Todos</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          {totalGeral > 0 && (
            <div className="hv-total-card">
              <span className="hv-total-value">{totalGeral.toFixed(1)}</span>
              <span className="hv-total-label">Total de horas (todos os projetos)</span>
            </div>
          )}
          <div className="hv-times" aria-label="Horas por projeto">
            {filteredPorProjeto.length === 0 ? (
              <div className="hv-empty">
                <p>Nenhum apontamento para os filtros do seu perfil.</p>
                <p className="hv-empty-hint">Use o filtro &quot;Projeto&quot; para analisar cada projeto.</p>
              </div>
            ) : (
              filteredPorProjeto.map((group) => (
                <div key={group.projeto} className="hv-time-card">
                  <div className="hv-time-header">
                    <h2 className="hv-time-title">{group.projeto}</h2>
                    <span className="hv-time-total">{group.totalHoras?.toFixed(1) ?? '0'} h</span>
                  </div>
                  <div className="hv-time-table-scroll">
                    <table className="hv-table" aria-label={`Apontamentos do projeto ${group.projeto}`}>
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Usuário</th>
                          <th scope="col">Tarefa</th>
                          <th scope="col">Fase</th>
                          <th scope="col">Duração</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.apontamentos || []).map((a, i) => (
                          <tr key={`${a.projeto}-${a.usuario}-${a.data_de_apontamento}-${i}`} className={i % 2 === 1 ? 'hv-table-zebra' : ''}>
                            <td>{formatDateBR(a.data_de_apontamento)}</td>
                            <td>{a.usuario ?? '—'}</td>
                            <td>{a.task_name ?? '—'}</td>
                            <td>{a.fase ?? '—'}</td>
                            <td className="hv-table-num">{a.duracao ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default HorasView;

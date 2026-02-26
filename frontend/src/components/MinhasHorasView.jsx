/**
 * Vista "Minhas Horas" – horas do usuário logado (timetracker)
 * Mostra: total de horas, horas por dia, horas por projeto, atividades que mais consumiram tempo.
 * Filtro de período estilo slicer (padrão: 2 semanas).
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { API_URL } from '../api';
import '../styles/MinhasHorasView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const TOP_ATIVIDADES_LIMIT = 20;

const PERIODO_OPTIONS = [
  { value: 7, label: '1 semana' },
  { value: 14, label: '2 semanas' },
  { value: 30, label: '1 mês' },
  { value: 90, label: '3 meses' },
];

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

function MinhasHorasView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apontamentos, setApontamentos] = useState([]);
  const [usuario, setUsuario] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [periodoDias, setPeriodoDias] = useState(14);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/horas/minhas`, { withCredentials: true });
      if (res.data?.success) {
        setApontamentos(res.data.apontamentos || []);
        setUsuario(res.data.usuario || '');
        setLastUpdated(new Date().toISOString());
      } else {
        setError(res.data?.error || 'Erro ao carregar horas');
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

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodoDias);
    return d.toISOString().slice(0, 10);
  }, [periodoDias]);

  const filteredRows = useMemo(() => {
    return apontamentos.filter((a) => (a.data_de_apontamento || '') >= cutoff);
  }, [apontamentos, cutoff]);

  const totalHoras = useMemo(() => {
    return filteredRows.reduce((s, a) => s + (a.horas ?? 0), 0);
  }, [filteredRows]);

  // Horas por dia
  const porData = useMemo(() => {
    const m = new Map();
    for (const a of filteredRows) {
      const d = a.data_de_apontamento || '—';
      m.set(d, (m.get(d) || 0) + (a.horas ?? 0));
    }
    return Array.from(m.entries())
      .sort((x, y) => String(x[0]).localeCompare(String(y[0])))
      .map(([date, horas]) => ({ date, horas }));
  }, [filteredRows]);

  // Horas por projeto
  const porProjeto = useMemo(() => {
    const m = new Map();
    for (const a of filteredRows) {
      const p = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—');
      m.set(p, (m.get(p) || 0) + (a.horas ?? 0));
    }
    return Array.from(m.entries())
      .sort((x, y) => (y[1] || 0) - (x[1] || 0))
      .map(([projeto, horas]) => ({ projeto, horas }));
  }, [filteredRows]);

  // Top atividades
  const topAtividades = useMemo(() => {
    const m = new Map();
    for (const a of filteredRows) {
      const t = typeof a.task_name === 'string' ? a.task_name : (a.task_name != null ? String(a.task_name) : '—');
      m.set(t, (m.get(t) || 0) + (a.horas ?? 0));
    }
    return Array.from(m.entries())
      .map(([atividade, horas]) => ({ atividade, horas: horas || 0 }))
      .sort((x, y) => y.horas - x.horas)
      .slice(0, TOP_ATIVIDADES_LIMIT);
  }, [filteredRows]);

  // Chart data
  const chartPorData = useMemo(() => {
    if (!porData.length) return null;
    return {
      labels: porData.map((x) => formatDateBR(x.date)),
      datasets: [{
        label: 'Horas',
        data: porData.map((x) => Math.round(x.horas * 100) / 100),
        backgroundColor: 'rgba(14, 165, 233, 0.7)',
        borderColor: 'rgba(14, 165, 233, 1)',
        borderWidth: 1,
      }],
    };
  }, [porData]);

  const chartPorProjeto = useMemo(() => {
    if (!porProjeto.length) return null;
    return {
      labels: porProjeto.map((x) => x.projeto),
      datasets: [{
        label: 'Horas',
        data: porProjeto.map((x) => Math.round(x.horas * 100) / 100),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      }],
    };
  }, [porProjeto]);

  const chartTopAtividades = useMemo(() => {
    if (!topAtividades.length) return null;
    return {
      labels: topAtividades.map((x) => x.atividade),
      datasets: [{
        label: 'Horas',
        data: topAtividades.map((x) => Math.round(x.horas * 100) / 100),
        backgroundColor: 'rgba(139, 92, 246, 0.7)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      }],
    };
  }, [topAtividades]);

  const chartOptions = useMemo(() => ({
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
  }), []);

  const chartOptionsHorizontal = useMemo(() => ({
    ...chartOptions,
    indexAxis: 'y',
    scales: {
      ...chartOptions.scales,
      x: { beginAtZero: true, title: { display: true, text: 'Horas' } },
      y: { ...chartOptions.scales.y, title: { display: false } },
    },
  }), [chartOptions]);

  if (loading && !apontamentos.length) {
    return (
      <div className="mh-container">
        <div className="mh-skeleton">
          <div className="mh-skeleton-header" />
          <div className="mh-skeleton-slicer" />
          <div className="mh-skeleton-section" />
          <div className="mh-skeleton-section" />
        </div>
      </div>
    );
  }

  if (error && !apontamentos.length) {
    return (
      <div className="mh-container">
        <div className="mh-error">
          <p>{error}</p>
          <button type="button" className="mh-retry" onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const periodoLabel = PERIODO_OPTIONS.find((o) => o.value === periodoDias)?.label || '';

  return (
    <div className="mh-container">
      <header className="mh-header">
        <div className="mh-header-text">
          <h1 className="mh-title">Minhas Horas</h1>
          <p className="mh-subtitle">Apontamentos de {usuario || 'usuário'}</p>
        </div>
        <div className="mh-header-actions">
          {lastUpdated && (
            <span className="mh-last-update">
              Atualizado: {new Date(lastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button type="button" className="mh-refresh" onClick={fetchData} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      </header>

      <div className="mh-slicer" role="group" aria-label="Período de análise">
        {PERIODO_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`mh-slicer-btn ${periodoDias === opt.value ? 'mh-slicer-btn-active' : ''}`}
            onClick={() => setPeriodoDias(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredRows.length === 0 ? (
        <div className="mh-empty">
          <p>Nenhum apontamento encontrado {periodoLabel ? `nas últimas ${periodoLabel}` : 'no período selecionado'}.</p>
        </div>
      ) : (
        <>
          <div className="mh-total-card">
            <span className="mh-total-value">{totalHoras.toFixed(1)}</span>
            <span className="mh-total-label">
              Total de horas {periodoLabel ? `(${periodoLabel})` : ''}
            </span>
          </div>

          <div className="mh-charts">
            {chartPorData && (
              <div className="mh-chart-card">
                <h3 className="mh-chart-title">Horas por dia</h3>
                <div className="mh-chart-wrap">
                  <Bar data={chartPorData} options={chartOptions} />
                </div>
              </div>
            )}
            {chartPorProjeto && (
              <div className="mh-chart-card">
                <h3 className="mh-chart-title">Horas por projeto</h3>
                <div className="mh-chart-wrap mh-chart-horizontal" style={{ minHeight: `${Math.max(200, porProjeto.length * 28)}px` }}>
                  <Bar data={chartPorProjeto} options={chartOptionsHorizontal} />
                </div>
              </div>
            )}
          </div>

          {chartTopAtividades && (
            <div className="mh-section">
              <h3 className="mh-section-title">Atividades que mais consumiram tempo</h3>
              <div className="mh-top-atividades">
                <div className="mh-chart-card mh-chart-half">
                  <div className="mh-chart-wrap mh-chart-horizontal" style={{ minHeight: `${Math.max(220, topAtividades.length * 24)}px` }}>
                    <Bar data={chartTopAtividades} options={chartOptionsHorizontal} />
                  </div>
                </div>
                <div className="mh-chart-card mh-chart-half mh-table-atividades">
                  <div className="mh-table-scroll">
                    <table className="mh-table" aria-label="Top atividades por horas">
                      <thead>
                        <tr>
                          <th scope="col">Atividade</th>
                          <th scope="col">Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topAtividades.map((x, i) => (
                          <tr key={x.atividade} className={i % 2 === 1 ? 'mh-table-zebra' : ''}>
                            <td>{x.atividade}</td>
                            <td className="mh-table-num">{Math.round(x.horas * 100) / 100} h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MinhasHorasView;

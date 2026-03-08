/**
 * Vista Horas (timetracker)
 * Duas abas: (1) Colaboradores – horas mês a mês por pessoa (padrão); (2) Por projeto – horas agrupadas com filtro.
 * Dados: dadosindicadores.timetracker.timetracker_merged, portfólio por projeto.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { API_URL } from '../api';
import '../styles/HorasView.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MESES_OPTS = [1, 2, 3, 6, 9, 12];
const COLLABORATOR_COLORS = [
  { bg: 'rgba(14, 165, 233, 0.75)', border: '#0ea5e9' },
  { bg: 'rgba(249, 115, 22, 0.75)', border: '#f97316' },
  { bg: 'rgba(139, 92, 246, 0.75)', border: '#8b5cf6' },
  { bg: 'rgba(34, 197, 94, 0.75)', border: '#22c55e' },
  { bg: 'rgba(236, 72, 153, 0.75)', border: '#ec4899' },
  { bg: 'rgba(234, 179, 8, 0.75)', border: '#eab308' },
  { bg: 'rgba(20, 184, 166, 0.75)', border: '#14b8a6' },
  { bg: 'rgba(99, 102, 241, 0.75)', border: '#6366f1' },
];
const PROJECT_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.75)', border: '#3b82f6' },
  { bg: 'rgba(239, 68, 68, 0.75)', border: '#ef4444' },
  { bg: 'rgba(16, 185, 129, 0.75)', border: '#10b981' },
  { bg: 'rgba(245, 158, 11, 0.75)', border: '#f59e0b' },
  { bg: 'rgba(139, 92, 246, 0.75)', border: '#8b5cf6' },
  { bg: 'rgba(236, 72, 153, 0.75)', border: '#ec4899' },
  { bg: 'rgba(6, 182, 212, 0.75)', border: '#06b6d4' },
  { bg: 'rgba(251, 146, 60, 0.75)', border: '#fb923c' },
  { bg: 'rgba(34, 197, 94, 0.75)', border: '#22c55e' },
  { bg: 'rgba(168, 85, 247, 0.75)', border: '#a855f7' },
  { bg: 'rgba(244, 63, 94, 0.75)', border: '#f43f5e' },
  { bg: 'rgba(20, 184, 166, 0.75)', border: '#14b8a6' },
  { bg: 'rgba(234, 179, 8, 0.75)', border: '#eab308' },
  { bg: 'rgba(99, 102, 241, 0.75)', border: '#6366f1' },
  { bg: 'rgba(217, 70, 239, 0.75)', border: '#d946ef' },
];
const MAX_COLLABORATORS_WARN = 8;
const TOP_VISIBLE_DEFAULT = 10;

function formatDateBR(val) {
  if (val == null || val === '') return '—';
  const s = typeof val === 'object' && val?.value != null ? String(val.value) : String(val);
  const trimmed = s.trim();
  if (!trimmed) return '—';
  try {
    const d = /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? new Date(trimmed) : new Date(trimmed);
    if (Number.isNaN(d.getTime())) return trimmed;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return trimmed;
  }
}

function getCurrentYM() {
  return new Date().toISOString().slice(0, 7);
}

function calcPresetInicio(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 7);
}

function calcLastMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const target = new Date(d.valueOf());
  target.setDate(target.getDate() - ((d.getDay() + 6) % 7) + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  const weekNum = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekDateRange(dateStr) {
  const d = new Date(dateStr);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(monday)} - ${fmt(sunday)}`;
}

function HorasView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [periodo, setPeriodo] = useState({ dataInicio: null, dataFim: null });
  const [tab, setTab] = useState('colaboradores');
  const [timeFilter, setTimeFilter] = useState('');
  const [projetoFilter, setProjetoFilter] = useState('');
  const [timesList, setTimesList] = useState([]);
  const [selectedUsuarios, setSelectedUsuarios] = useState([]);
  const [presetAtivo, setPresetAtivo] = useState(6);
  const [periodoColab, setPeriodoColab] = useState({ inicio: calcPresetInicio(6), fim: getCurrentYM() });
  const [showUsuarioDropdown, setShowUsuarioDropdown] = useState(false);
  const [showAllProjetos, setShowAllProjetos] = useState(false);
  const [showAllAtividades, setShowAllAtividades] = useState(false);
  const [granularidade, setGranularidade] = useState('mensal');
  const usuarioDropdownRef = useRef(null);
  const usuarioTriggerRef = useRef(null);

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

  const chartOptionsHorizontal = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        title: { display: false },
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw} h` } },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Horas' } },
        y: { title: { display: false } },
      },
    }),
    []
  );

  const filteredPorProjeto = useMemo(() => {
    if (!projetoFilter) return porProjeto;
    return porProjeto.filter((p) => (p.projeto || '') === projetoFilter);
  }, [porProjeto, projetoFilter]);

  // --- Colaboradores tab ---
  const colaboradoresDisponiveis = useMemo(() => {
    const seen = new Map();
    for (const a of apontamentosFlat) {
      const u = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : null);
      if (u && !seen.has(u)) seen.set(u, u);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [apontamentosFlat]);

  const colaboradorRows = useMemo(() => {
    if (!selectedUsuarios.length) return [];
    const set = new Set(selectedUsuarios);
    return apontamentosFlat.filter((a) => {
      const u = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '');
      if (!set.has(u)) return false;
      const raw = a.data_de_apontamento;
      const d = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' && raw.value != null ? String(raw.value) : '');
      const ym = d.slice(0, 7);
      return ym >= periodoColab.inicio && ym <= periodoColab.fim;
    });
  }, [apontamentosFlat, selectedUsuarios, periodoColab]);

  const mesesLabels = useMemo(() => {
    const set = new Set();
    for (const a of colaboradorRows) {
      const raw = a.data_de_apontamento;
      const d = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' && raw.value != null ? String(raw.value) : '');
      const ym = d.slice(0, 7);
      if (ym) set.add(ym);
    }
    return Array.from(set).sort();
  }, [colaboradorRows]);

  const formatYM = (ym) => {
    try {
      const d = new Date(ym + '-01');
      return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    } catch { return ym; }
  };

  const chartColabMensal = useMemo(() => {
    if (!mesesLabels.length || !selectedUsuarios.length) return null;
    const projetos = [...new Set(colaboradorRows.map((a) => typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—')))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const datasets = [];
    projetos.forEach((p, pIdx) => {
      const color = PROJECT_COLORS[pIdx % PROJECT_COLORS.length];
      selectedUsuarios.forEach((u, uIdx) => {
        const horasPorMes = mesesLabels.map((ym) => {
          let total = 0;
          for (const a of colaboradorRows) {
            const au = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '');
            const ap = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—');
            if (au !== u || ap !== p) continue;
            const raw = a.data_de_apontamento;
            const d = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' && raw.value != null ? String(raw.value) : '');
            if (d.slice(0, 7) === ym) total += (a.horas ?? 0);
          }
          return Math.round(total * 100) / 100;
        });
        datasets.push({
          label: uIdx === 0 ? p : '',
          _projectName: p,
          data: horasPorMes,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          stack: u,
        });
      });
    });
    return { labels: mesesLabels.map(formatYM), datasets };
  }, [mesesLabels, selectedUsuarios, colaboradorRows]);

  const semanasLabels = useMemo(() => {
    const map = new Map();
    for (const a of colaboradorRows) {
      const raw = a.data_de_apontamento;
      const d = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' && raw.value != null ? String(raw.value) : '');
      if (d.length >= 10) {
        const key = getWeekKey(d);
        if (!map.has(key)) map.set(key, getWeekDateRange(d));
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, label]) => ({ key, label }));
  }, [colaboradorRows]);

  const chartColabSemanal = useMemo(() => {
    if (!semanasLabels.length || !selectedUsuarios.length) return null;
    const projetos = [...new Set(colaboradorRows.map((a) => typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—')))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const datasets = [];
    projetos.forEach((p, pIdx) => {
      const color = PROJECT_COLORS[pIdx % PROJECT_COLORS.length];
      selectedUsuarios.forEach((u, uIdx) => {
        const horasPorSemana = semanasLabels.map(({ key }) => {
          let total = 0;
          for (const a of colaboradorRows) {
            const au = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '');
            const ap = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—');
            if (au !== u || ap !== p) continue;
            const raw = a.data_de_apontamento;
            const d = typeof raw === 'string' ? raw : (raw != null && typeof raw === 'object' && raw.value != null ? String(raw.value) : '');
            if (d.length >= 10 && getWeekKey(d) === key) total += (a.horas ?? 0);
          }
          return Math.round(total * 100) / 100;
        });
        datasets.push({
          label: uIdx === 0 ? p : '',
          _projectName: p,
          data: horasPorSemana,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          stack: u,
        });
      });
    });
    return { labels: semanasLabels.map((s) => s.label), datasets };
  }, [semanasLabels, selectedUsuarios, colaboradorRows]);

  const chartColabPorProjeto = useMemo(() => {
    if (!selectedUsuarios.length || !colaboradorRows.length) return null;
    const projMap = new Map();
    for (const a of colaboradorRows) {
      const p = typeof a.projeto === 'string' ? a.projeto : (a.projeto != null ? String(a.projeto) : '—');
      const u = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '');
      if (!projMap.has(p)) projMap.set(p, new Map());
      const um = projMap.get(p);
      um.set(u, (um.get(u) || 0) + (a.horas ?? 0));
    }
    const projetos = Array.from(projMap.entries())
      .map(([p, um]) => ({ p, total: Array.from(um.values()).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
      .map((x) => x.p);
    const datasets = selectedUsuarios.map((u, idx) => {
      const c = COLLABORATOR_COLORS[idx % COLLABORATOR_COLORS.length];
      return {
        label: u,
        data: projetos.map((p) => Math.round((projMap.get(p)?.get(u) || 0) * 100) / 100),
        backgroundColor: c.bg, borderColor: c.border, borderWidth: 1,
      };
    });
    return { labels: projetos, datasets };
  }, [selectedUsuarios, colaboradorRows]);

  const chartColabPorAtividade = useMemo(() => {
    if (!selectedUsuarios.length || !colaboradorRows.length) return null;
    const taskMap = new Map();
    for (const a of colaboradorRows) {
      const t = typeof a.task_name === 'string' ? a.task_name : (a.task_name != null ? String(a.task_name) : '—');
      const u = typeof a.usuario === 'string' ? a.usuario : (a.usuario != null ? String(a.usuario) : '');
      if (!taskMap.has(t)) taskMap.set(t, new Map());
      const um = taskMap.get(t);
      um.set(u, (um.get(u) || 0) + (a.horas ?? 0));
    }
    const atividades = Array.from(taskMap.entries())
      .map(([t, um]) => ({ t, total: Array.from(um.values()).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
      .map((x) => x.t);
    const datasets = selectedUsuarios.map((u, idx) => {
      const c = COLLABORATOR_COLORS[idx % COLLABORATOR_COLORS.length];
      return {
        label: u,
        data: atividades.map((t) => Math.round((taskMap.get(t)?.get(u) || 0) * 100) / 100),
        backgroundColor: c.bg, borderColor: c.border, borderWidth: 1,
      };
    });
    return { labels: atividades, datasets };
  }, [selectedUsuarios, colaboradorRows]);

  // Truncated chart data for top N
  const chartColabPorProjetoVisible = useMemo(() => {
    if (!chartColabPorProjeto) return null;
    if (showAllProjetos) return chartColabPorProjeto;
    const limit = TOP_VISIBLE_DEFAULT;
    if (chartColabPorProjeto.labels.length <= limit) return chartColabPorProjeto;
    return {
      labels: chartColabPorProjeto.labels.slice(0, limit),
      datasets: chartColabPorProjeto.datasets.map((ds) => ({ ...ds, data: ds.data.slice(0, limit) })),
    };
  }, [chartColabPorProjeto, showAllProjetos]);

  const chartColabPorAtividadeVisible = useMemo(() => {
    if (!chartColabPorAtividade) return null;
    if (showAllAtividades) return chartColabPorAtividade;
    const limit = TOP_VISIBLE_DEFAULT;
    if (chartColabPorAtividade.labels.length <= limit) return chartColabPorAtividade;
    return {
      labels: chartColabPorAtividade.labels.slice(0, limit),
      datasets: chartColabPorAtividade.datasets.map((ds) => ({ ...ds, data: ds.data.slice(0, limit) })),
    };
  }, [chartColabPorAtividade, showAllAtividades]);

  const totalColaboradores = colaboradorRows.reduce((s, a) => s + (a.horas ?? 0), 0);

  // Reset selected users when time filter changes
  useEffect(() => {
    setSelectedUsuarios((prev) => {
      const valid = new Set(colaboradoresDisponiveis);
      const filtered = prev.filter((u) => valid.has(u));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [colaboradoresDisponiveis]);

  // Click outside to close usuario dropdown
  useEffect(() => {
    if (!showUsuarioDropdown) return;
    const handler = (e) => {
      if (
        usuarioDropdownRef.current && !usuarioDropdownRef.current.contains(e.target) &&
        usuarioTriggerRef.current && !usuarioTriggerRef.current.contains(e.target)
      ) {
        setShowUsuarioDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUsuarioDropdown]);

  const colabChartOptionsGrouped = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: 'top',
        labels: {
          boxWidth: 12, padding: 12, font: { size: 12 },
          filter: (item) => item.text !== '',
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => {
            const stack = items[0]?.dataset?.stack;
            return stack ? `${items[0].label} — ${stack}` : items[0].label;
          },
          label: (ctx) => {
            const proj = ctx.dataset._projectName || ctx.dataset.label;
            return `${proj}: ${ctx.raw} h`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, title: { display: true, text: granularidade === 'semanal' ? 'Semanas' : 'Meses' } },
      y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Horas' } },
    },
  }), [granularidade]);

  const colabChartOptionsHorizontal = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} h` } },
    },
    scales: {
      x: { beginAtZero: true, title: { display: true, text: 'Horas' } },
      y: { title: { display: false } },
    },
  }), []);

  const toggleUsuario = (u) => {
    setSelectedUsuarios((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  };

  const handlePresetClick = (months) => {
    setPresetAtivo(months);
    setPeriodoColab({ inicio: calcPresetInicio(months), fim: getCurrentYM() });
  };

  const handleLastMonthClick = () => {
    const ym = calcLastMonth();
    setPresetAtivo('lastMonth');
    setPeriodoColab({ inicio: ym, fim: ym });
  };

  const handlePeriodoChange = (field, value) => {
    setPresetAtivo(null);
    setPeriodoColab((prev) => ({ ...prev, [field]: value }));
  };

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
          aria-selected={tab === 'colaboradores'}
          aria-controls="hv-panel-colaboradores"
          id="hv-tab-colaboradores"
          className={`hv-tab ${tab === 'colaboradores' ? 'hv-tab-active' : ''}`}
          onClick={() => setTab('colaboradores')}
        >
          Colaboradores
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

      {tab === 'colaboradores' && (
        <section id="hv-panel-colaboradores" role="tabpanel" aria-labelledby="hv-tab-colaboradores" className="hv-panel">
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
            <div className="hv-filter">
              <span className="hv-filter-label">Período</span>
              <div className="hv-period-row">
                <div className="hv-period-chips">
                  <button
                    type="button"
                    className={`hv-period-chip ${presetAtivo === 'lastMonth' ? 'hv-period-chip-active' : ''}`}
                    onClick={handleLastMonthClick}
                  >
                    Mês passado
                  </button>
                  {MESES_OPTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`hv-period-chip ${presetAtivo === n ? 'hv-period-chip-active' : ''}`}
                      onClick={() => handlePresetClick(n)}
                    >
                      {n}m
                    </button>
                  ))}
                </div>
                <div className="hv-period-inputs">
                  <input
                    type="month"
                    className="hv-input-month"
                    value={periodoColab.inicio}
                    onChange={(e) => handlePeriodoChange('inicio', e.target.value)}
                    aria-label="Data início"
                  />
                  <span className="hv-period-sep">a</span>
                  <input
                    type="month"
                    className="hv-input-month"
                    value={periodoColab.fim}
                    onChange={(e) => handlePeriodoChange('fim', e.target.value)}
                    aria-label="Data fim"
                  />
                </div>
              </div>
            </div>
            <div className="hv-filter">
              <span className="hv-filter-label">Colaboradores</span>
              <div className="hv-filter-multiselect" ref={usuarioDropdownRef}>
                <button
                  type="button"
                  ref={usuarioTriggerRef}
                  className="hv-multiselect-trigger"
                  onClick={() => setShowUsuarioDropdown((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={showUsuarioDropdown}
                >
                  {selectedUsuarios.length === 0
                    ? 'Selecionar...'
                    : selectedUsuarios.length === 1
                      ? selectedUsuarios[0]
                      : `${selectedUsuarios.length} selecionados`}
                  <svg className="hv-multiselect-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showUsuarioDropdown && (
                  <div className="hv-multiselect-dropdown" role="listbox" aria-label="Selecionar colaboradores">
                    <div className="hv-multiselect-actions">
                      <button type="button" onClick={() => {
                        const max = colaboradoresDisponiveis.slice(0, MAX_COLLABORATORS_WARN);
                        setSelectedUsuarios(max);
                      }}>Todos</button>
                      <button type="button" onClick={() => setSelectedUsuarios([])}>Limpar</button>
                    </div>
                    <div className="hv-multiselect-list">
                      {colaboradoresDisponiveis.map((u) => (
                        <label key={u} className="hv-multiselect-item">
                          <input
                            type="checkbox"
                            checked={selectedUsuarios.includes(u)}
                            onChange={() => toggleUsuario(u)}
                          />
                          <span className="hv-multiselect-name">{u}</span>
                        </label>
                      ))}
                      {colaboradoresDisponiveis.length === 0 && (
                        <p className="hv-multiselect-empty">Nenhum colaborador disponível</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedUsuarios.length > MAX_COLLABORATORS_WARN && (
            <div className="hv-colab-warn">
              Muitas pessoas selecionadas ({selectedUsuarios.length}). Os gráficos ficam mais legíveis com até {MAX_COLLABORATORS_WARN}.
            </div>
          )}

          {selectedUsuarios.length > 0 && totalColaboradores > 0 && (
            <div className="hv-total-card hv-total-card-compact hv-total-colab">
              <span className="hv-total-value">{totalColaboradores.toFixed(1)}</span>
              <span className="hv-total-label">
                horas no período
                {timeFilter ? ` • Time: ${timeFilter}` : ''}
                {` • ${selectedUsuarios.length} colaborador${selectedUsuarios.length > 1 ? 'es' : ''}`}
              </span>
            </div>
          )}

          {selectedUsuarios.length === 0 && (
            <div className="hv-empty">
              <p>Selecione um ou mais colaboradores para visualizar a distribuição de horas.</p>
              <p className="hv-empty-hint">Use o filtro de time para ver apenas pessoas de um time específico.</p>
            </div>
          )}

          {(chartColabMensal || chartColabSemanal) && (
            <div className="hv-chart-card hv-colab-chart-card">
              <div className="hv-chart-header-row">
                <h3 className="hv-chart-title">
                  {granularidade === 'semanal' ? 'Tendência semanal' : 'Tendência mensal'}
                </h3>
                <div className="hv-granularidade-toggle">
                  <button
                    type="button"
                    className={`hv-gran-btn ${granularidade === 'mensal' ? 'hv-gran-btn-active' : ''}`}
                    onClick={() => setGranularidade('mensal')}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    className={`hv-gran-btn ${granularidade === 'semanal' ? 'hv-gran-btn-active' : ''}`}
                    onClick={() => setGranularidade('semanal')}
                  >
                    Semanal
                  </button>
                </div>
              </div>
              <div className="hv-chart-wrap" style={{ height: 220 }}>
                {granularidade === 'semanal' && chartColabSemanal
                  ? <Bar data={chartColabSemanal} options={colabChartOptionsGrouped} />
                  : chartColabMensal && <Bar data={chartColabMensal} options={colabChartOptionsGrouped} />
                }
              </div>
            </div>
          )}

          <div className="hv-colab-grid">
            {chartColabPorProjetoVisible && (
              <div className="hv-chart-card hv-colab-chart-card">
                <h3 className="hv-chart-title">Horas por projeto</h3>
                <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: Math.max(180, (chartColabPorProjetoVisible.labels?.length || 0) * 28 * Math.max(1, selectedUsuarios.length * 0.6)) }}>
                  <Bar data={chartColabPorProjetoVisible} options={colabChartOptionsHorizontal} />
                </div>
                {chartColabPorProjeto && chartColabPorProjeto.labels.length > TOP_VISIBLE_DEFAULT && (
                  <button
                    type="button"
                    className="hv-show-all-btn"
                    onClick={() => setShowAllProjetos((v) => !v)}
                  >
                    {showAllProjetos ? 'Mostrar top 10' : `Ver todos (${chartColabPorProjeto.labels.length})`}
                  </button>
                )}
              </div>
            )}

            {chartColabPorAtividadeVisible && (
              <div className="hv-chart-card hv-colab-chart-card">
                <h3 className="hv-chart-title">Horas por tipo de atividade</h3>
                <div className="hv-chart-wrap hv-chart-horizontal" style={{ minHeight: Math.max(180, (chartColabPorAtividadeVisible.labels?.length || 0) * 28 * Math.max(1, selectedUsuarios.length * 0.6)) }}>
                  <Bar data={chartColabPorAtividadeVisible} options={colabChartOptionsHorizontal} />
                </div>
                {chartColabPorAtividade && chartColabPorAtividade.labels.length > TOP_VISIBLE_DEFAULT && (
                  <button
                    type="button"
                    className="hv-show-all-btn"
                    onClick={() => setShowAllAtividades((v) => !v)}
                  >
                    {showAllAtividades ? 'Mostrar top 10' : `Ver todos (${chartColabPorAtividade.labels.length})`}
                  </button>
                )}
              </div>
            )}
          </div>
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
            <div className="hv-total-card hv-total-card-compact">
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

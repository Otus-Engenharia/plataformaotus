/**
 * Componente: Dashboard de Economia de Horas
 *
 * Mostra KPIs, gráficos e auditoria de horas economizadas pela Plataforma Otus.
 * Usado pela diretoria para validar ROI das automações.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { timeSavingsApi } from '../../api/timeSavings';
import './TimeSavingsDashboardView.css';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler
);

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Todo o Período' },
  { value: 'month', label: 'Este Mês' },
  { value: 'week', label: 'Esta Semana' },
];

function TimeSavingsDashboardView() {
  const { isPrivileged } = useAuth();
  const [period, setPeriod] = useState('all');
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  // Buscar sumário
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await timeSavingsApi.getSummary(period);
      if (res.data?.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar sumário:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Buscar eventos de auditoria
  const fetchEvents = useCallback(async (page = 1) => {
    setEventsLoading(true);
    try {
      const res = await timeSavingsApi.getEvents({ page, limit: 20 });
      if (res.data?.success) {
        setEvents(res.data.data);
        setEventsTotal(res.data.total);
        setEventsPage(page);
      }
    } catch (err) {
      console.error('Erro ao buscar eventos:', err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // Buscar catálogo
  const fetchCatalog = useCallback(async () => {
    try {
      const res = await timeSavingsApi.getCatalog(true);
      if (res.data?.success) {
        setCatalog(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar catálogo:', err);
    }
  }, []);

  useEffect(() => {
    if (showAudit && events.length === 0) fetchEvents();
  }, [showAudit, events.length, fetchEvents]);

  useEffect(() => {
    if (showCatalog && catalog.length === 0) fetchCatalog();
  }, [showCatalog, catalog.length, fetchCatalog]);

  // Gráfico: Economia por Automação (barras horizontais)
  const automationChartData = useMemo(() => {
    if (!summary?.byAutomation?.length) return null;

    const items = summary.byAutomation.slice(0, 10);
    return {
      labels: items.map(a => a.name),
      datasets: [{
        label: 'Horas Economizadas',
        data: items.map(a => a.totalHours),
        backgroundColor: '#10B981',
        borderRadius: 4,
      }],
    };
  }, [summary]);

  // Gráfico: Tendência Mensal
  const trendChartData = useMemo(() => {
    if (!summary?.monthlyTrend?.length) return null;

    return {
      labels: summary.monthlyTrend.map(m => {
        const [year, month] = m.month.split('-');
        return format(new Date(year, month - 1), 'MMM/yy', { locale: ptBR });
      }),
      datasets: [{
        label: 'Horas Economizadas',
        data: summary.monthlyTrend.map(m => m.hours),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };
  }, [summary]);

  // Handler para atualizar catálogo
  const handleCatalogUpdate = async (id, field, value) => {
    try {
      const body = {};
      if (field === 'default_minutes') body.default_minutes = Number(value);
      if (field === 'is_active') body.is_active = value;

      await timeSavingsApi.updateCatalog(id, body);
      await fetchCatalog();
    } catch (err) {
      console.error('Erro ao atualizar catálogo:', err);
    }
  };

  if (loading && !summary) {
    return (
      <div className="ts-dashboard">
        <div className="ts-loading">Carregando dados de economia...</div>
      </div>
    );
  }

  const totals = summary?.totals || { totalEvents: 0, totalMinutes: 0, totalHours: 0, uniqueUsers: 0 };

  return (
    <div className="ts-dashboard">
      {/* Header */}
      <div className="ts-header">
        <div className="ts-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ts-header-icon">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <h1>Economia de Horas</h1>
            <p>Tempo economizado pelas automações da Plataforma Otus</p>
          </div>
        </div>
        <div className="ts-period-filter">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ts-period-btn ${period === opt.value ? 'active' : ''}`}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ts-kpi-row">
        <div className="ts-kpi-card ts-kpi-highlight">
          <div className="ts-kpi-value">{totals.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h</div>
          <div className="ts-kpi-label">Horas Economizadas</div>
          <div className="ts-kpi-sub">{totals.totalEvents.toLocaleString('pt-BR')} ações automatizadas</div>
        </div>
        <div className="ts-kpi-card">
          <div className="ts-kpi-value">{Math.round(totals.totalMinutes / 60 / 8).toLocaleString('pt-BR')}</div>
          <div className="ts-kpi-label">Dias de Trabalho</div>
          <div className="ts-kpi-sub">equivalente (8h/dia)</div>
        </div>
        <div className="ts-kpi-card">
          <div className="ts-kpi-value">{totals.uniqueUsers}</div>
          <div className="ts-kpi-label">Usuários Beneficiados</div>
          <div className="ts-kpi-sub">que economizaram tempo</div>
        </div>
        <div className="ts-kpi-card">
          <div className="ts-kpi-value">
            {totals.totalEvents > 0
              ? (totals.totalMinutes / totals.totalEvents).toFixed(0)
              : 0} min
          </div>
          <div className="ts-kpi-label">Média por Ação</div>
          <div className="ts-kpi-sub">economia média por uso</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="ts-charts-row">
        {/* Economia por Automação */}
        <div className="ts-chart-card">
          <h3>Economia por Automação</h3>
          {automationChartData ? (
            <Bar
              data={automationChartData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.raw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h economizadas`,
                    },
                  },
                },
                scales: {
                  x: {
                    title: { display: true, text: 'Horas' },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                  },
                  y: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false },
                  },
                },
              }}
            />
          ) : (
            <div className="ts-no-data">Sem dados para o período selecionado</div>
          )}
        </div>

        {/* Tendência Mensal */}
        <div className="ts-chart-card">
          <h3>Tendência Mensal</h3>
          {trendChartData ? (
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `${ctx.raw.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`,
                    },
                  },
                },
                scales: {
                  y: {
                    title: { display: true, text: 'Horas' },
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                  },
                  x: { grid: { display: false } },
                },
              }}
            />
          ) : (
            <div className="ts-no-data">Sem dados de tendência</div>
          )}
        </div>
      </div>

      {/* Top Usuários */}
      {summary?.byUser?.length > 0 && (
        <div className="ts-section">
          <h3>Top Usuários por Economia</h3>
          <div className="ts-table-wrapper">
            <table className="ts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Ações</th>
                  <th>Horas Economizadas</th>
                </tr>
              </thead>
              <tbody>
                {summary.byUser.slice(0, 15).map((user, i) => (
                  <tr key={user.userEmail}>
                    <td className="ts-rank">{i + 1}</td>
                    <td>{user.userName || '-'}</td>
                    <td className="ts-email">{user.userEmail}</td>
                    <td>{user.eventCount}</td>
                    <td className="ts-hours">{user.totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auditoria (expansível) */}
      {isPrivileged && (
        <div className="ts-section">
          <button className="ts-expand-btn" onClick={() => setShowAudit(!showAudit)}>
            <span>{showAudit ? '▼' : '▶'}</span>
            Log de Auditoria ({eventsTotal} eventos)
          </button>
          {showAudit && (
            <div className="ts-audit">
              {eventsLoading ? (
                <div className="ts-loading-small">Carregando...</div>
              ) : (
                <>
                  <div className="ts-table-wrapper">
                    <table className="ts-table ts-audit-table">
                      <thead>
                        <tr>
                          <th>Data/Hora</th>
                          <th>Usuário</th>
                          <th>Automação</th>
                          <th>Recurso</th>
                          <th>Min. Economizados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(evt => (
                          <tr key={evt.id}>
                            <td className="ts-date">
                              {format(parseISO(evt.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                            </td>
                            <td>{evt.user_name || evt.user_email}</td>
                            <td>{evt.catalog_label || evt.catalog_id}</td>
                            <td className="ts-resource">
                              {evt.resource_name || evt.resource_id || '-'}
                            </td>
                            <td className="ts-minutes">{evt.minutes_saved} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {eventsTotal > 20 && (
                    <div className="ts-pagination">
                      <button
                        disabled={eventsPage <= 1}
                        onClick={() => fetchEvents(eventsPage - 1)}
                      >
                        Anterior
                      </button>
                      <span>Página {eventsPage} de {Math.ceil(eventsTotal / 20)}</span>
                      <button
                        disabled={eventsPage >= Math.ceil(eventsTotal / 20)}
                        onClick={() => fetchEvents(eventsPage + 1)}
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Catálogo Admin (expansível) */}
      {isPrivileged && (
        <div className="ts-section">
          <button className="ts-expand-btn" onClick={() => setShowCatalog(!showCatalog)}>
            <span>{showCatalog ? '▼' : '▶'}</span>
            Configurar Estimativas (Admin)
          </button>
          {showCatalog && (
            <div className="ts-catalog">
              <p className="ts-catalog-info">
                Ajuste as estimativas de minutos economizados por automação.
                Alterações afetam apenas novos eventos (dados históricos mantêm valores originais).
              </p>
              <div className="ts-table-wrapper">
                <table className="ts-table">
                  <thead>
                    <tr>
                      <th>Automação</th>
                      <th>Descrição</th>
                      <th>Área</th>
                      <th>Minutos</th>
                      <th>Ativo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map(item => (
                      <tr key={item.id} className={!item.is_active ? 'ts-inactive' : ''}>
                        <td>{item.name}</td>
                        <td className="ts-desc">{item.description}</td>
                        <td>{item.area}</td>
                        <td>
                          <input
                            type="number"
                            className="ts-minutes-input"
                            defaultValue={item.default_minutes}
                            min="1"
                            step="1"
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val > 0 && val !== item.default_minutes) {
                                handleCatalogUpdate(item.id, 'default_minutes', val);
                              }
                            }}
                          />
                        </td>
                        <td>
                          <label className="ts-toggle">
                            <input
                              type="checkbox"
                              checked={item.is_active}
                              onChange={(e) => handleCatalogUpdate(item.id, 'is_active', e.target.checked)}
                            />
                            <span className="ts-toggle-slider"></span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimeSavingsDashboardView;

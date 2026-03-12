/**
 * ClientPortalAnalyticsView - Dashboard de uso do Portal do Cliente
 *
 * Exibe métricas de acesso, gráfico de logins por dia, páginas mais acessadas,
 * usuários mais ativos e log de ações recentes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/ClientPortalAnalyticsView.css';

const ACTION_LABELS = {
  login: 'Login',
  password_change: 'Troca de Senha',
  portal_enabled: 'Portal Ativado',
  portal_disabled: 'Portal Desativado',
  view_projects: 'Lista de Projetos',
  view_progress: 'Progresso',
  view_timeseries: 'Série Temporal',
  view_changelog: 'Changelog',
  view_marcos: 'Marcos',
  view_relatos: 'Relatos',
  view_apontamentos: 'Apontamentos',
};

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function ClientPortalAnalyticsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleActions, setVisibleActions] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/admin/client-portal/analytics?days=${days}`, { withCredentials: true });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError(res.data.error || 'Erro desconhecido');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setVisibleActions(50);
  }, [data]);

  if (loading) return <div className="cpa-loading">Carregando analytics...</div>;
  if (error) return <div className="cpa-error">{error}</div>;
  if (!data) return null;

  const { summary, loginsByDay, topPages, topUsers, recentActions } = data;
  const maxDayCount = Math.max(1, ...loginsByDay.map(d => d.count));
  const totalPageViews = summary.totalPageViews || 1;

  return (
    <div className="cpa-container">
      {/* Period selector */}
      <div className="cpa-toolbar">
        <label>Período:</label>
        {[7, 30, 90].map(d => (
          <button
            key={d}
            className={`cpa-period-btn ${days === d ? 'active' : ''}`}
            onClick={() => setDays(d)}
          >
            {d} dias
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="cpa-summary-grid">
        <div className="cpa-summary-card">
          <div className="cpa-summary-card-label">Total de Logins</div>
          <div className="cpa-summary-card-value">{summary.totalLogins}</div>
        </div>
        <div className="cpa-summary-card">
          <div className="cpa-summary-card-label">Usuários Únicos</div>
          <div className="cpa-summary-card-value">{summary.uniqueUsers}</div>
        </div>
        <div className="cpa-summary-card">
          <div className="cpa-summary-card-label">Page Views</div>
          <div className="cpa-summary-card-value">{summary.totalPageViews}</div>
        </div>
        <div className="cpa-summary-card">
          <div className="cpa-summary-card-label">Ativos Hoje</div>
          <div className="cpa-summary-card-value">{summary.activeToday}</div>
        </div>
      </div>

      {/* Logins chart */}
      <div className="cpa-section">
        <div className="cpa-section-title">Logins por Dia</div>
        {loginsByDay.length === 0 ? (
          <div className="cpa-chart-empty">Nenhum login no período</div>
        ) : (
          <div className="cpa-chart">
            {loginsByDay.map((d) => (
              <div key={d.date} className="cpa-chart-bar-wrapper">
                <div
                  className="cpa-chart-bar"
                  style={{ height: `${(d.count / maxDayCount) * 100}%` }}
                >
                  <span className="cpa-chart-bar-tooltip">{formatDate(d.date)}: {d.count}</span>
                </div>
                <span className="cpa-chart-bar-label">{formatDate(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two columns: Top Pages + Top Users */}
      <div className="cpa-two-cols">
        <div className="cpa-section">
          <div className="cpa-section-title">Páginas Mais Acessadas</div>
          <table className="cpa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ação</th>
                <th>Acessos</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((p, i) => {
                const pct = ((p.count / totalPageViews) * 100).toFixed(1);
                return (
                  <tr key={p.action}>
                    <td className="cpa-rank">{i + 1}</td>
                    <td>{ACTION_LABELS[p.action] || p.action}</td>
                    <td>{p.count}</td>
                    <td>
                      {pct}%
                      <span className="cpa-pct-bar" style={{ width: `${Math.min(pct, 100)}px` }} />
                    </td>
                  </tr>
                );
              })}
              {topPages.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#737373' }}>Nenhuma page view</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="cpa-section">
          <div className="cpa-section-title">Usuários Mais Ativos</div>
          <table className="cpa-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>Empresa</th>
                <th>Logins</th>
                <th>Último Acesso</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, i) => (
                <tr key={u.contactId}>
                  <td className="cpa-rank">{i + 1}</td>
                  <td>{u.name}</td>
                  <td>{u.company}</td>
                  <td>{u.loginCount}</td>
                  <td>{formatDateTime(u.lastAccess)}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#737373' }}>Nenhum usuário no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent actions log */}
      <div className="cpa-section">
        <div className="cpa-section-title">Log de Ações Recentes</div>
        <table className="cpa-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Projeto</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {recentActions.slice(0, visibleActions).map((a) => (
              <tr key={a.id}>
                <td>{formatDateTime(a.createdAt)}</td>
                <td>{a.contactName}</td>
                <td><span className={`cpa-action-badge ${a.action}`}>{ACTION_LABELS[a.action] || a.action}</span></td>
                <td>{a.projectCode || '-'}</td>
                <td style={{ fontSize: '0.75rem', color: '#737373' }}>{a.ipAddress || '-'}</td>
              </tr>
            ))}
            {recentActions.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#737373' }}>Nenhuma ação registrada</td></tr>
            )}
          </tbody>
        </table>
        {visibleActions < recentActions.length && (
          <button className="cpa-load-more" onClick={() => setVisibleActions(v => v + 50)}>
            Carregar mais ({recentActions.length - visibleActions} restantes)
          </button>
        )}
      </div>
    </div>
  );
}

export default ClientPortalAnalyticsView;

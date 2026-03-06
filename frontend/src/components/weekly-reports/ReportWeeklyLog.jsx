/**
 * ReportWeeklyLog - Matriz de auditoria projeto x semana
 *
 * Mostra quais projetos enviaram relatório em cada semana.
 * Tri-state: enviado (check verde), não enviado (X vermelho), bot inativo (traço cinza).
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function ReportWeeklyLog() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/weekly-reports/log?weeks=8`,
        { withCredentials: true }
      );

      if (response.data && response.data.success) {
        setData(response.data.data);
      } else {
        setError('Resposta inesperada do servidor.');
      }
    } catch (err) {
      console.error('Erro ao carregar log semanal:', err);
      setError(
        err.response?.data?.error ||
        'Erro ao carregar log semanal.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="wr-kpi-section">
        <div className="wrd-loading">
          <div className="wrd-loading-spinner" />
          <p>Carregando log semanal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wr-kpi-section">
        <div className="wrd-error">
          <div className="wrd-error-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button className="wrd-retry-btn" onClick={fetchData}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!data || !data.projects || data.projects.length === 0) {
    return null;
  }

  const { weeks, projects } = data;

  // Contagem: denominador = projetos com bot ativo, numerador = enviados
  const botActiveProjects = projects.filter(p => p.bot_active);
  const summaryByWeek = {};
  for (const col of weeks) {
    let sent = 0;
    for (const proj of botActiveProjects) {
      if (proj.weeks[col.weekKey] === 'sent') sent++;
    }
    summaryByWeek[col.weekKey] = sent;
  }
  const totalActive = botActiveProjects.length;

  return (
    <div className="wr-kpi-section">
      <div className="wr-kpi-header">
        <h4>Log Semanal</h4>
        <button className="wrd-refresh-btn" onClick={fetchData}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Atualizar
        </button>
      </div>

      <div className="wr-log-table-wrapper">
        <table className="wr-status-table wr-log-table">
          <thead>
            <tr>
              <th className="wr-log-project-col">Projeto</th>
              {weeks.map((col) => (
                <th
                  key={col.weekKey}
                  className={`wr-log-cell${col.isCurrent ? ' wr-log-current-col' : ''}`}
                >
                  {col.weekText}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((proj) => (
              <tr key={proj.project_code}>
                <td className="wr-log-project-col">
                  <div className="wr-status-project-name">{proj.project_name}</div>
                  <div className="wr-status-project-code">{proj.project_code}</div>
                </td>
                {weeks.map((col) => {
                  const status = proj.weeks[col.weekKey];
                  return (
                    <td
                      key={col.weekKey}
                      className={`wr-log-cell${col.isCurrent ? ' wr-log-current-col' : ''}`}
                    >
                      {status === 'sent' ? (
                        <span className="wr-log-check" title="Enviado">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      ) : status === 'not_sent' ? (
                        <span className="wr-log-miss" title="Nao enviado">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </span>
                      ) : status === 'inactive' ? (
                        <span className="wr-log-inactive" title="Bot inativo">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="wr-log-summary-row">
              <td className="wr-log-project-col">
                <strong>Total</strong>
              </td>
              {weeks.map((col) => (
                <td key={col.weekKey} className={`wr-log-cell${col.isCurrent ? ' wr-log-current-col' : ''}`}>
                  <span className={`wr-kpi-pill ${summaryByWeek[col.weekKey] === totalActive ? 'wr-kpi-pill-green' : summaryByWeek[col.weekKey] > 0 ? 'wr-kpi-pill-yellow' : 'wr-kpi-pill-red'}`}>
                    {summaryByWeek[col.weekKey]}/{totalActive}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="wr-log-legend">
        <span className="wr-log-legend-item">
          <span className="wr-log-check">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Enviado
        </span>
        <span className="wr-log-legend-item">
          <span className="wr-log-miss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
          Nao enviado
        </span>
        <span className="wr-log-legend-item">
          <span className="wr-log-inactive">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          Bot inativo
        </span>
        <span className="wr-log-legend-item">
          <span className="wr-log-not-registered">&nbsp;</span>
          Nao cadastrado
        </span>
      </div>
    </div>
  );
}

export default ReportWeeklyLog;

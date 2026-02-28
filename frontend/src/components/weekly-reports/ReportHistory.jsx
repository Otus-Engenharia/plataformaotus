/**
 * ReportHistory - Lista compacta dos ultimos relatorios semanais
 *
 * Mostra ate 4 relatorios com semana, status, tempo relativo e links
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

/**
 * Formata uma data como tempo relativo em portugues
 * Ex: "ha 3 dias", "ha 2 horas", "agora"
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';

  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return diffDays === 1 ? 'ha 1 dia' : `ha ${diffDays} dias`;
  }
  if (diffHours > 0) {
    return diffHours === 1 ? 'ha 1 hora' : `ha ${diffHours} horas`;
  }
  if (diffMin > 0) {
    return diffMin === 1 ? 'ha 1 minuto' : `ha ${diffMin} minutos`;
  }
  return 'agora';
}

/**
 * Formata a semana a partir da data de referencia
 * Ex: "Semana 24/02"
 */
function formatWeekLabel(weekStartStr) {
  if (!weekStartStr) return 'Relatorio';

  try {
    const date = new Date(weekStartStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `Semana ${day}/${month}`;
  } catch {
    return 'Relatorio';
  }
}

// Status icon components
function CompletedIcon() {
  return (
    <div className="wr-history-status-icon wr-history-status-completed">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function FailedIcon() {
  return (
    <div className="wr-history-status-icon wr-history-status-failed">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  );
}

function ProcessingIcon() {
  return (
    <div className="wr-history-status-icon wr-history-status-processing">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'wr-dot-pulse 1.5s infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

// External link icon (shared by Drive / Gmail links)
function ExternalLinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ReportHistory({ projectCode }) {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!projectCode) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/weekly-reports/history/${projectCode}?limit=4`,
        { withCredentials: true }
      );
      setReports(response.data.reports || []);
    } catch (err) {
      console.error('Erro ao buscar historico de relatorios:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading && !reports) {
    return (
      <div className="wr-history-list">
        <div className="wr-history-loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'wr-dot-pulse 1.5s infinite' }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>Carregando historico...</span>
        </div>
      </div>
    );
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="wr-history-list">
        <div className="wr-history-empty">
          Nenhum relatorio gerado ainda
        </div>
      </div>
    );
  }

  return (
    <div className="wr-history-list">
      {reports.map((report) => {
        const statusIcon =
          report.status === 'completed' ? <CompletedIcon /> :
          report.status === 'failed' ? <FailedIcon /> :
          <ProcessingIcon />;

        return (
          <div key={report.id} className="wr-history-item">
            {statusIcon}

            <div className="wr-history-info">
              <span className="wr-history-week">
                {formatWeekLabel(report.week_start)}
              </span>
              <span className="wr-history-time">
                {formatRelativeTime(report.created_at)}
              </span>
            </div>

            <div className="wr-history-links">
              {report.drive_url && (
                <a
                  href={report.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wr-history-link"
                  title="Abrir no Drive"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Drive
                </a>
              )}
              {report.draft_url && (
                <a
                  href={report.draft_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wr-history-link"
                  title="Ver rascunho no Gmail"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ReportHistory;

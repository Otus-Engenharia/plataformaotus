/**
 * ReportPipeline - Pipeline visual de geração de relatório semanal
 *
 * Layout vertical com:
 * - Robô animado CSS (cabeça com olhos piscando + engrenagem girando)
 * - Steps verticais com ícones de progresso e tempo decorrido
 * - Painel de logs em tempo real (auto-scroll)
 * - Barra de progresso horizontal
 *
 * Polling a cada 2s para buscar status + logs do backend.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import RobotAnimation from '../RobotAnimation';

const PIPELINE_STEPS = [
  { key: 'fetching_data',   label: 'Buscando dados' },
  { key: 'processing',      label: 'Processando' },
  { key: 'generating_html', label: 'Gerando relatórios' },
  { key: 'uploading_drive', label: 'Salvando no Drive' },
  { key: 'creating_drafts', label: 'Criando rascunhos' },
];

const POLL_INTERVAL = 2000;

/**
 * Formata timestamp ISO para HH:MM:SS
 */
function formatLogTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function ReportPipeline({ reportId, onComplete }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const pollingRef = useRef(null);
  const timerRef = useRef(null);
  const logPanelRef = useRef(null);

  // Timer de elapsed
  useEffect(() => {
    if (!reportId) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [reportId, startTime]);

  // Polling de status
  useEffect(() => {
    if (!reportId) return;

    const pollStatus = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/weekly-reports/status/${reportId}`,
          { withCredentials: true }
        );
        const report = response.data?.data || response.data;
        setStatus(report);

        if (report.status === 'completed' || report.status === 'failed') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (onComplete) onComplete(report);
        }
      } catch (err) {
        console.error('Erro ao buscar status do relatório:', err);
        setError(err.response?.data?.error || 'Erro ao buscar status');
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    pollStatus();
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reportId, onComplete]);

  // Auto-scroll do painel de logs
  useEffect(() => {
    if (logPanelRef.current) {
      logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
    }
  }, [status?.metadata?.logs]);

  const currentStep = status?.current_step || '';
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  const isDone = isCompleted || isFailed;
  const logs = status?.metadata?.logs || [];

  // Progresso (0-100)
  const progress = useMemo(() => {
    if (isCompleted) return 100;
    const idx = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
    if (idx === -1) return 0;
    return Math.round(((idx + 0.5) / PIPELINE_STEPS.length) * 100);
  }, [currentStep, isCompleted]);

  // Estado do robô
  const robotState = isCompleted ? 'success' : isFailed ? 'error' : 'working';

  // Estado de cada step
  const getStepState = (stepIndex) => {
    if (isCompleted) return 'done';
    if (isFailed) {
      const failedIdx = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
      if (stepIndex < failedIdx) return 'done';
      if (stepIndex === failedIdx) return 'failed';
      return 'pending';
    }
    const activeIdx = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
    if (activeIdx === -1) return stepIndex === 0 ? 'active' : 'pending';
    if (stepIndex < activeIdx) return 'done';
    if (stepIndex === activeIdx) return 'active';
    return 'pending';
  };

  // Texto de status do robô
  const statusText = isCompleted
    ? 'Relatório gerado com sucesso!'
    : isFailed
      ? 'Erro ao gerar relatório'
      : 'Trabalhando no relatório...';

  // Elapsed formatado
  const elapsedText = useMemo(() => {
    const secs = Math.floor((isDone && status?.metadata?.duration ? status.metadata.duration : elapsed) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
  }, [elapsed, isDone, status?.metadata?.duration]);

  if (!reportId) return null;

  return (
    <div className={`wr-pipeline wr-pipeline-${robotState}`}>
      {/* Barra de progresso horizontal */}
      <div className="wr-pipeline-progress-bar">
        <div
          className="wr-pipeline-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header: Robô + Texto de status */}
      <div className="wr-pipeline-header">
        <RobotAnimation state={robotState} />
        <div className="wr-pipeline-header-text">
          <span className="wr-pipeline-status-text">{statusText}</span>
          <span className="wr-pipeline-elapsed">{elapsedText}</span>
        </div>
      </div>

      {/* Steps verticais */}
      <div className="wr-pipeline-steps-vertical">
        {PIPELINE_STEPS.map((step, index) => {
          const state = getStepState(index);
          return (
            <div key={step.key} className={`wr-pipeline-vstep wr-pipeline-vstep-${state}`}>
              <div className="wr-pipeline-vstep-indicator">
                {state === 'done' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {state === 'active' && (
                  <svg className="wr-pipeline-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {state === 'failed' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {state === 'pending' && (
                  <div className="wr-pipeline-vstep-dot" />
                )}
              </div>
              {index < PIPELINE_STEPS.length - 1 && (
                <div className={`wr-pipeline-vstep-line wr-pipeline-vstep-line-${state}`} />
              )}
              <span className="wr-pipeline-vstep-label">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Painel de logs */}
      {logs.length > 0 && (
        <div className="wr-pipeline-log-panel">
          <div className="wr-pipeline-log-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Log de atividade</span>
          </div>
          <div className="wr-pipeline-log-body" ref={logPanelRef}>
            {logs.map((log, i) => (
              <div key={i} className="wr-pipeline-log-entry">
                <span className="wr-pipeline-log-time">{formatLogTime(log.time)}</span>
                <span className="wr-pipeline-log-msg">{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links de resultado (sucesso) */}
      {isCompleted && (
        <div className="wr-pipeline-result wr-pipeline-success">
          <div className="wr-pipeline-result-links">
            {(status?.client_report_drive_url || status?.team_report_drive_url) && (
              <a
                href={status.client_report_drive_url || status.team_report_drive_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Abrir no Drive
              </a>
            )}
            {(status?.client_draft_url || status?.team_draft_url) && (
              <a
                href={status.client_draft_url || status.team_draft_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Ver rascunho
              </a>
            )}
          </div>
        </div>
      )}

      {/* Mensagem de erro */}
      {isFailed && (
        <div className="wr-pipeline-result wr-pipeline-failure">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{status?.error_message || 'Erro desconhecido'}</span>
        </div>
      )}

      {/* Erro de polling */}
      {error && !isFailed && (
        <div className="wr-pipeline-result wr-pipeline-failure">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default ReportPipeline;

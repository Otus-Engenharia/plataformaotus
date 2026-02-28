/**
 * ReportPipeline - Stepper horizontal de progresso do relatorio semanal
 *
 * Mostra 5 etapas com polling de status:
 * 1. Buscando dados  2. Processando  3. Gerando relatorios
 * 4. Salvando no Drive  5. Criando rascunhos
 *
 * Estados: done (verde), active (laranja pulsando), pending (cinza)
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

const PIPELINE_STEPS = [
  { key: 'fetching', label: 'Buscando dados' },
  { key: 'processing', label: 'Processando' },
  { key: 'generating', label: 'Gerando relatorios' },
  { key: 'saving_drive', label: 'Salvando no Drive' },
  { key: 'creating_drafts', label: 'Criando rascunhos' },
];

const POLL_INTERVAL = 2000;

function ReportPipeline({ reportId, onComplete }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    if (!reportId) return;

    const pollStatus = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/weekly-reports/status/${reportId}`,
          { withCredentials: true }
        );
        const data = response.data;
        setStatus(data);

        // Stop polling on terminal states
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (onComplete) {
            onComplete(data);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar status do relatorio:', err);
        setError(err.response?.data?.error || 'Erro ao buscar status');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Initial fetch
    pollStatus();

    // Start polling
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [reportId, onComplete]);

  if (!reportId) return null;

  const currentStep = status?.current_step || '';
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';

  // Determine each step's state
  const getStepState = (stepIndex) => {
    if (isCompleted) return 'done';
    if (isFailed) {
      const failedStepIndex = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
      if (stepIndex < failedStepIndex) return 'done';
      if (stepIndex === failedStepIndex) return 'active'; // show where it failed
      return 'pending';
    }

    const activeStepIndex = PIPELINE_STEPS.findIndex(s => s.key === currentStep);
    if (activeStepIndex === -1) return stepIndex === 0 ? 'active' : 'pending';
    if (stepIndex < activeStepIndex) return 'done';
    if (stepIndex === activeStepIndex) return 'active';
    return 'pending';
  };

  // Connector state: done if the step AFTER the connector is done or active
  const getConnectorState = (afterStepIndex) => {
    const afterState = getStepState(afterStepIndex);
    return afterState === 'done' ? 'done' : '';
  };

  // SVG icons
  const CheckIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const CircleIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );

  const SpinnerIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );

  return (
    <div className="wr-pipeline">
      <div className="wr-pipeline-steps">
        {PIPELINE_STEPS.map((step, index) => {
          const state = getStepState(index);
          const isLast = index === PIPELINE_STEPS.length - 1;

          return (
            <React.Fragment key={step.key}>
              <div className="wr-pipeline-step">
                <div className={`wr-pipeline-step-icon wr-pipeline-step-icon-${state}`}>
                  {state === 'done' && <CheckIcon />}
                  {state === 'active' && <SpinnerIcon />}
                  {state === 'pending' && <CircleIcon />}
                </div>
                <span className="wr-pipeline-step-label">{step.label}</span>
              </div>
              {!isLast && (
                <div
                  className={`wr-pipeline-connector ${
                    getConnectorState(index + 1) === 'done' ? 'wr-pipeline-connector-done' : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Success message */}
      {isCompleted && (
        <div className="wr-pipeline-result wr-pipeline-success">
          <div className="wr-pipeline-result-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="wr-pipeline-result-content">
            <span className="wr-pipeline-result-text">Relatorio gerado com sucesso!</span>
            <div className="wr-pipeline-result-links">
              {status?.drive_url && (
                <a href={status.drive_url} target="_blank" rel="noopener noreferrer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Abrir no Drive
                </a>
              )}
              {status?.draft_url && (
                <a href={status.draft_url} target="_blank" rel="noopener noreferrer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Ver rascunho
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failure message */}
      {isFailed && (
        <div className="wr-pipeline-result wr-pipeline-failure">
          <div className="wr-pipeline-result-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <div className="wr-pipeline-result-content">
            <span className="wr-pipeline-result-text">
              Erro ao gerar relatorio
            </span>
            {status?.error_message && (
              <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                {status.error_message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Polling error */}
      {error && !isFailed && (
        <div className="wr-pipeline-result wr-pipeline-failure">
          <div className="wr-pipeline-result-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="wr-pipeline-result-content">
            <span className="wr-pipeline-result-text">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportPipeline;

/**
 * ReadinessChecks - Verifica prontidao para gerar relatorio semanal
 *
 * Exibe grid de checks (Construflow, Smartsheet, Pasta Drive, etc.)
 * com indicadores visuais de status (verde = pronto, vermelho = nao pronto)
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

// Configuracao dos checks com labels e icones
const CHECK_ITEMS = [
  { key: 'construflow', name: 'Construflow', countLabel: 'issues' },
  { key: 'smartsheet', name: 'Smartsheet', countLabel: 'tarefas' },
  { key: 'pasta_drive', name: 'Pasta Drive', countLabel: '' },
  { key: 'emails_cliente', name: 'Emails Cliente', countLabel: 'emails' },
  { key: 'emails_equipe', name: 'Emails Equipe', countLabel: 'emails' },
];

function ReadinessChecks({ projectCode, onReadinessChange }) {
  const [checks, setChecks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReadiness = useCallback(async () => {
    if (!projectCode) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/api/weekly-reports/readiness/${projectCode}`,
        { withCredentials: true }
      );

      const data = response.data;
      setChecks(data.checks || {});

      if (onReadinessChange) {
        onReadinessChange(data.ready === true);
      }
    } catch (err) {
      console.error('Erro ao verificar prontidao:', err);
      setError(err.response?.data?.error || 'Erro ao verificar prontidao');
      if (onReadinessChange) {
        onReadinessChange(false);
      }
    } finally {
      setLoading(false);
    }
  }, [projectCode, onReadinessChange]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  if (loading && !checks) {
    return (
      <div className="wr-readiness-loading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'wr-dot-pulse 1.5s infinite' }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>Verificando fontes de dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wr-readiness-error">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  if (!checks) return null;

  return (
    <div className="wr-readiness-grid">
      {CHECK_ITEMS.map((item) => {
        const check = checks[item.key];
        const isReady = check?.ready === true;
        const count = check?.count;

        // Build detail text
        let detail = '';
        if (count !== undefined && count !== null && item.countLabel) {
          detail = `${count.toLocaleString('pt-BR')} ${item.countLabel}`;
        } else if (isReady) {
          detail = 'Disponivel';
        } else {
          detail = 'Indisponivel';
        }

        return (
          <div key={item.key} className="wr-check-item">
            <span
              className={`wr-check-dot ${
                isReady ? 'wr-check-dot-ready' : 'wr-check-dot-not-ready'
              }`}
            />
            <div className="wr-check-info">
              <span className="wr-check-name">{item.name}</span>
              <span className="wr-check-detail">{detail}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ReadinessChecks;

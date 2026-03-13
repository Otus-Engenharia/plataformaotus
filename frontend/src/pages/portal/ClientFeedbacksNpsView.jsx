/**
 * Componente: Feedbacks NPS para Portal do Cliente
 *
 * Adaptacao de NpsClienteView.jsx para usar Bearer auth.
 * Projeto vem de useOutletContext + useParams (sem seletor).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import '../nps/NpsClienteView.css';

function getScoreCategory(score) {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ClientFeedbacksNpsView() {
  const { projectCode } = useParams();
  const { currentProject } = useOutletContext();
  const { getClientToken } = useClientAuth();

  const [feedbackText, setFeedbackText] = useState('');
  const [npsScore, setNpsScore] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const clientAxios = useCallback(() => {
    const token = getClientToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [getClientToken]);

  const fetchHistory = useCallback(async () => {
    if (!projectCode) return;
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API_URL}/api/client/nps`, {
        params: { project_code: projectCode, limit: 20 },
        ...clientAxios(),
      });
      setHistory(res.data.data || []);
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false);
    }
  }, [projectCode, clientAxios]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!projectCode) {
      setError('Projeto não selecionado');
      return;
    }
    if (!feedbackText.trim()) {
      setError('O texto do feedback é obrigatório');
      return;
    }
    if (npsScore === null) {
      setError('Selecione uma nota de 0 a 10');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/api/client/nps`, {
        project_code: projectCode,
        nps_score: npsScore,
        feedback_text: feedbackText.trim(),
      }, clientAxios());

      setSuccess(true);
      setFeedbackText('');
      setNpsScore(null);
      fetchHistory();

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const projectName = currentProject?.nome || currentProject?.projectCode || projectCode;

  return (
    <div className="nps-cliente-view">
      <h1>Feedbacks e Opiniões</h1>
      <p className="nps-subtitle">
        Sua opiniao e fundamental para melhorarmos continuamente nossos servicos.
      </p>

      <div className="nps-form-card">
        <h2>Novo Feedback</h2>

        {success && (
          <div className="nps-success">
            Feedback enviado com sucesso! Obrigado pela sua contribuicao.
          </div>
        )}

        {error && (
          <div className="nps-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="nps-textarea-group">
            <label htmlFor="nps-feedback">Qual sua opiniao/feedback sobre nosso trabalho?</label>
            <textarea
              id="nps-feedback"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Conte-nos sobre sua experiencia, sugestoes ou observacoes..."
              required
            />
          </div>

          <div className="nps-score-group">
            <label>De 0 a 10, o quanto voce recomendaria nossos servicos?</label>
            <div className="nps-score-labels">
              <span>Pouco provavel</span>
              <span>Muito provavel</span>
            </div>
            <div className="nps-score-buttons">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`nps-score-btn ${getScoreCategory(n)}${npsScore === n ? ' selected' : ''}`}
                  onClick={() => setNpsScore(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="nps-submit-btn"
            disabled={submitting || !projectCode}
          >
            {submitting ? 'Enviando...' : 'Enviar Feedback'}
          </button>
        </form>
      </div>

      <div className="nps-history">
        <h2>Historico de Feedbacks{projectName ? ` — ${projectName}` : ''}</h2>

        {loadingHistory ? (
          <p className="nps-history-empty">Carregando...</p>
        ) : history.length === 0 ? (
          <p className="nps-history-empty">Nenhum feedback registrado para este projeto.</p>
        ) : (
          <div className="nps-history-list">
            {history.map((item) => (
              <div key={item.id} className="nps-history-item">
                <div className="nps-history-header">
                  <span className={`nps-history-score ${getScoreCategory(item.nps_score)}`}>
                    {item.nps_score}
                  </span>
                  <div className="nps-history-meta">
                    <span>{item.respondent_name || item.respondent_email}</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
                <div className="nps-history-text">{item.feedback_text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientFeedbacksNpsView;

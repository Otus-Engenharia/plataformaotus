/**
 * Vista de Pesquisas CS — Área Líderes
 * Mesma estrutura da CS, mas filtrada pelos projetos do líder logado.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { useMemo } from 'react';
import '../cs/PesquisasCSView.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function scoreColor(score, type = 'nps') {
  if (score == null) return '';
  if (type === 'nps') {
    if (score >= 9) return 'score-green';
    if (score >= 7) return 'score-yellow';
    return 'score-red';
  }
  if (score >= 7) return 'score-green';
  if (score >= 4) return 'score-yellow';
  return 'score-red';
}

function sourceLabel(source) {
  const labels = { plataforma: 'Plataforma', google_forms: 'Google Forms', externo: 'Externo' };
  return labels[source] || source;
}

function PesquisasLiderView() {
  const { data: portfolioData } = usePortfolio();
  const projectCodes = useMemo(() => {
    if (!portfolioData || !Array.isArray(portfolioData)) return [];
    return [...new Set(portfolioData.map(r => r.project_code_norm).filter(Boolean))];
  }, [portfolioData]);
  const [responses, setResponses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!projectCodes || projectCodes.length === 0) {
      setResponses([]);
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const codesParam = projectCodes.join(',');
      const [respRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/nps`, {
          params: { project_codes: codesParam, limit: 200 },
          withCredentials: true,
        }),
        axios.get(`${API_URL}/api/nps/stats`, {
          params: { project_codes: codesParam },
          withCredentials: true,
        }),
      ]);

      setResponses(respRes.data.data || []);
      setStats(statsRes.data.data || null);
    } catch (err) {
      console.error('Erro ao carregar pesquisas:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCodes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="pesquisas-cs-view">
      <h1>Pesquisas CS</h1>
      <p className="pesquisas-subtitle">
        Feedbacks NPS, CSAT e CES dos seus projetos.
      </p>

      {/* KPI Strip */}
      {stats && stats.total > 0 && (
        <div className="pesquisas-kpi-strip">
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_nps ?? '—'}</span>
            <span className="pesquisas-kpi-label">NPS Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_csat ?? '—'}</span>
            <span className="pesquisas-kpi-label">CSAT Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.average_ces ?? '—'}</span>
            <span className="pesquisas-kpi-label">CES Médio</span>
          </div>
          <div className="pesquisas-kpi">
            <span className="pesquisas-kpi-value">{stats.total}</span>
            <span className="pesquisas-kpi-label">Total Respostas</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="pesquisas-loading">Carregando...</p>
      ) : responses.length === 0 ? (
        <p className="pesquisas-empty">Nenhuma pesquisa encontrada para seus projetos.</p>
      ) : (
        <div className="pesquisas-table-container">
          <table className="pesquisas-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Projeto</th>
                <th>Cliente</th>
                <th>Entrevistado</th>
                <th>NPS</th>
                <th>CSAT</th>
                <th>CES</th>
                <th>Nível</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {responses.map(r => (
                <React.Fragment key={r.id}>
                  <tr
                    className={`pesquisas-row${expandedId === r.id ? ' expanded' : ''}${r.feedback_text ? ' clickable' : ''}`}
                    onClick={() => r.feedback_text && setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td>{formatDate(r.created_at)}</td>
                    <td className="pesquisas-project">{r.project_name || r.project_code}</td>
                    <td>{r.client_company || '—'}</td>
                    <td>{r.interviewed_person || r.respondent_name || '—'}</td>
                    <td><span className={`pesquisas-score ${scoreColor(r.nps_score, 'nps')}`}>{r.nps_score ?? '—'}</span></td>
                    <td><span className={`pesquisas-score ${scoreColor(r.csat_score, 'csat')}`}>{r.csat_score ?? '—'}</span></td>
                    <td><span className={`pesquisas-score ${scoreColor(r.ces_score, 'ces')}`}>{r.ces_score ?? '—'}</span></td>
                    <td>{r.decision_level_label || '—'}</td>
                    <td><span className="pesquisas-source">{sourceLabel(r.source)}</span></td>
                  </tr>
                  {expandedId === r.id && r.feedback_text && (
                    <tr className="pesquisas-expand-row">
                      <td colSpan={9}>
                        <div className="pesquisas-feedback-text">
                          <strong>Feedback qualitativo:</strong>
                          <p>{r.feedback_text}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PesquisasLiderView;

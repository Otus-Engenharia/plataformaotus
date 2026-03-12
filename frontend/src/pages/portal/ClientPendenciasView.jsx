/**
 * Portal do Cliente - Pendências
 *
 * Exibe issues abertas nas disciplinas do cliente como página dedicada.
 * Extraído de ClientApontamentosView.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import {
  processIssueData,
  extractClientDisciplines, filterClientOpenIssues,
  translatePriority, getTimeSinceUpdate,
} from '../../utils/apontamentosHelpers';
import '../../styles/VistaClienteView.css';
import '../vista-cliente/VistaClienteApontamentosView.css';

function ClientPendenciasView() {
  const { projectCode } = useParams();
  const { currentProject } = useOutletContext();
  const { getClientToken } = useClientAuth();

  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const construflowId = currentProject?.construflowId || null;

  const clientAxios = useCallback(() => ({
    headers: { Authorization: `Bearer ${getClientToken()}` },
  }), [getClientToken]);

  // Fetch issues
  useEffect(() => {
    if (!construflowId || !projectCode) {
      setIssues([]);
      setLoading(false);
      return;
    }
    async function loadIssues() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/apontamentos`,
          { ...clientAxios(), params: { construflowId } }
        );
        setIssues(processIssueData(res.data.data || []));
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Erro ao carregar pendências');
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }
    loadIssues();
  }, [construflowId, projectCode, clientAxios]);

  // Client disciplines & open issues
  const projectWithDisciplina = useMemo(() => {
    if (!currentProject) return null;
    return { ...currentProject, disciplina_cliente: currentProject.disciplinaCliente || null };
  }, [currentProject]);

  const clientDisciplines = useMemo(() => extractClientDisciplines(projectWithDisciplina), [projectWithDisciplina]);
  const clientOpenIssues = useMemo(() => filterClientOpenIssues(issues, clientDisciplines), [issues, clientDisciplines]);

  // Sort by priority then days pending
  const sortedClientIssues = useMemo(() => {
    const priorityOrder = { 'alta': 1, 'média': 2, 'media': 2, 'baixa': 3 };
    return [...clientOpenIssues].sort((a, b) => {
      const pA = translatePriority(a.priority).toLowerCase();
      const pB = translatePriority(b.priority).toLowerCase();
      const oA = priorityOrder[pA] || 999;
      const oB = priorityOrder[pB] || 999;
      if (oA !== oB) return oA - oB;
      const tA = getTimeSinceUpdate(a);
      const tB = getTimeSinceUpdate(b);
      return tB.days - tA.days;
    });
  }, [clientOpenIssues]);

  // Helpers
  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getIssueLink = (issue) => {
    const cfProjectId = currentProject?.construflowId;
    if (!cfProjectId || !issue.id) return '#';
    return `https://app.construflow.com.br/workspace/project/${cfProjectId}/issues?issueId=${issue.id}`;
  };

  const retryLoad = () => {
    if (construflowId && projectCode) {
      setLoading(true);
      setError(null);
      axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/apontamentos`,
        { ...clientAxios(), params: { construflowId } }
      ).then(res => {
        setIssues(processIssueData(res.data.data || []));
      }).catch(err => {
        setError(err.response?.data?.error || err.message);
      }).finally(() => setLoading(false));
    }
  };

  // No construflow integration
  if (!construflowId && !loading) {
    return (
      <div className="cp-view-empty">
        <span className="cp-view-empty-icon">&#128279;</span>
        Este projeto não possui integração com o Construflow.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cp-view-loading">
        <div className="cp-view-spinner" />
        Carregando pendências...
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-view-error">
        <span>Erro: {error}</span>
        <button className="vca-error-retry" onClick={retryLoad}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="vista-cliente-container">
      <div className="vca-pendencias-section">
        <div className="vca-pendencias-header">
          <h3 className="vca-pendencias-title">Pendências do Cliente</h3>
          {clientDisciplines.length > 0 && (
            <span className="vca-pendencias-badge">
              {clientOpenIssues.length} em aberto
            </span>
          )}
        </div>

        {clientDisciplines.length > 0 && (
          <div className="vca-pendencias-info">
            Disciplinas do cliente: <strong>{clientDisciplines.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}</strong>
          </div>
        )}

        {clientDisciplines.length === 0 && (
          <div className="vca-pendencias-empty">
            <span className="vca-pendencias-empty-icon">&#9881;</span>
            Disciplinas do cliente não configuradas para este projeto.
          </div>
        )}

        {clientDisciplines.length > 0 && sortedClientIssues.length === 0 && (
          <div className="vca-pendencias-empty">
            <span className="vca-pendencias-empty-icon">&#10003;</span>
            Nenhuma pendência em aberto. Tudo em dia!
          </div>
        )}

        {sortedClientIssues.length > 0 && (
          <div className="vca-table-container">
            <table className="vca-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Código</th>
                  <th>Título</th>
                  <th style={{ width: 90 }}>Prioridade</th>
                  <th style={{ width: 120 }}>Disciplina</th>
                  <th style={{ width: 100 }}>Local</th>
                  <th style={{ width: 110 }}>Dias pendente</th>
                </tr>
              </thead>
              <tbody>
                {sortedClientIssues.map(issue => {
                  const priority = translatePriority(issue.priority);
                  const priorityClass = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  const timeSince = getTimeSinceUpdate(issue);
                  const isExpanded = expandedRows.has(issue.guid || issue.id);

                  const matchingDiscs = (issue.disciplines || [])
                    .filter(d => {
                      const name = String(d.name || '').toLowerCase();
                      const status = String(d.status || '').toLowerCase();
                      const isOpen = status === 'todo' || status === '' || !d.status;
                      return isOpen && clientDisciplines.some(cd =>
                        name.includes(cd) || cd.includes(name)
                      );
                    })
                    .map(d => d.name);

                  const localsStr = (issue.locals || [])
                    .map(l => l.abbreviation || l.name || l)
                    .join(', ') || '-';

                  return (
                    <React.Fragment key={issue.guid || issue.id}>
                      <tr>
                        <td>
                          <a href={getIssueLink(issue)} target="_blank" rel="noopener noreferrer" className="vca-issue-code">
                            {issue.code || '-'}
                          </a>
                        </td>
                        <td>
                          <div className="vca-issue-title-row">
                            <button className="vca-expand-btn" onClick={() => toggleRow(issue.guid || issue.id)}>
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <span className="vca-issue-title">{issue.title || 'Sem título'}</span>
                          </div>
                          {isExpanded && issue.description && (
                            <div
                              className="vca-issue-description"
                              dangerouslySetInnerHTML={{ __html: issue.description }}
                            />
                          )}
                        </td>
                        <td>
                          <span className={`vca-priority-badge ${priorityClass}`}>
                            {priority}
                          </span>
                        </td>
                        <td>{matchingDiscs.join(', ') || '-'}</td>
                        <td>{localsStr}</td>
                        <td>
                          <span className={timeSince.days > 30 ? 'vca-days-danger' : ''}>
                            {timeSince.text}
                          </span>
                          <div className="vca-update-type">{timeSince.type}</div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientPendenciasView;

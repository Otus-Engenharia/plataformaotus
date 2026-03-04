/**
 * Contexto da Vista do Cliente
 *
 * Compartilha seleção de projeto e dados do portfolio entre as abas
 * (Início, Apontamentos, Marcos) da Vista do Cliente.
 */

import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const VistaClienteContext = createContext(null);

const FINALIZED_STATUSES = [
  'churn pelo cliente', 'close', 'obra finalizada', 'termo de encerramento',
  'termo de encerrame', 'encerrado', 'finalizado', 'concluído', 'concluido',
  'cancelado', 'execução', 'execucao',
];
const PAUSED_STATUSES = ['pausado', 'pausa', 'em pausa', 'pausado pelo cliente', 'suspenso', 'suspensão'];

export const isFinalizedStatus = (s) => {
  if (!s) return false;
  const low = String(s).toLowerCase().trim();
  return FINALIZED_STATUSES.some(f => low === f.toLowerCase().trim() || low.includes(f.toLowerCase().trim()));
};

export const isPausedStatus = (s) => {
  if (!s) return false;
  const low = String(s).toLowerCase().trim();
  return PAUSED_STATUSES.some(p => low === p.toLowerCase().trim() || low.includes(p.toLowerCase().trim()));
};

export function VistaClienteProvider({ children }) {
  const [portfolio, setPortfolio] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);

  // Fetch portfolio once
  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
        const data = res.data.data || [];
        setPortfolio(data);

        const valid = data
          .filter(p => p.project_code_norm && !isFinalizedStatus(p.status) && !isPausedStatus(p.status))
          .reduce((acc, p) => {
            if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
            return acc;
          }, [])
          .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));

        if (valid.length > 0) {
          setSelectedProjectId(valid[0].project_code_norm);
        }
      } catch (err) {
        console.error('Erro ao buscar portfolio:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Derived: selected project object
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return portfolio.find(p =>
      String(p.project_code_norm || p.project_code) === String(selectedProjectId)
    ) || null;
  }, [portfolio, selectedProjectId]);

  // Derived fields
  const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code || selectedProjectId;
  const smartsheetId = selectedProject?.smartsheet_id;
  const projectName = selectedProject?.project_name;
  const projectId = selectedProject?.id;
  const construflowId = selectedProject?.construflow_id;

  // Filtered/sorted project list
  const sortedProjects = useMemo(() => {
    return portfolio
      .filter(p => {
        if (!p.project_code_norm) return false;
        if (showOnlyActive) {
          if (isFinalizedStatus(p.status) || isPausedStatus(p.status)) return false;
        }
        return true;
      })
      .reduce((acc, p) => {
        if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
        return acc;
      }, [])
      .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));
  }, [portfolio, showOnlyActive]);

  const value = useMemo(() => ({
    portfolio,
    loading,
    selectedProjectId,
    setSelectedProjectId,
    showOnlyActive,
    setShowOnlyActive,
    selectedProject,
    projectCode,
    smartsheetId,
    projectName,
    projectId,
    construflowId,
    sortedProjects,
  }), [portfolio, loading, selectedProjectId, showOnlyActive, selectedProject, projectCode, smartsheetId, projectName, projectId, construflowId, sortedProjects]);

  return (
    <VistaClienteContext.Provider value={value}>
      {children}
    </VistaClienteContext.Provider>
  );
}

export function useVistaCliente() {
  const ctx = useContext(VistaClienteContext);
  if (!ctx) {
    throw new Error('useVistaCliente deve ser usado dentro de VistaClienteProvider');
  }
  return ctx;
}

export default VistaClienteContext;

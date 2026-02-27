/**
 * Componente: Vista de Equipe do Projeto (Orquestrador)
 *
 * 3 sub-abas:
 * 1. Equipe Otus - Time interno baseado na alocação do portfólio
 * 2. Equipe do Cliente - Contatos do cliente + cadastro de disciplinas
 * 3. Controle de Disciplinas - Cobertura Smartsheet x ConstruFlow x Otus
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import EquipeOtusPanel from './EquipeOtusPanel';
import EquipeClientePanel from './EquipeClientePanel';
import DisciplineCoveragePanel from './DisciplineCoveragePanel';
import '../styles/EquipeView.css';

function EquipeView({ selectedProjectId, portfolio = [] }) {
  const [activeTab, setActiveTab] = useState('equipeOtus');

  // Dados auxiliares compartilhados
  const [equipe, setEquipe] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(false);

  // Análise cruzada de disciplinas
  const [crossRef, setCrossRef] = useState(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);

  // Projeto selecionado
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio.length) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  const construflowId = selectedProject?.construflow_id || null;
  const projectCode = selectedProject?.project_code_norm || null;

  // Busca dados auxiliares
  const fetchAuxData = useCallback(async () => {
    try {
      const [discRes, empRes, contRes] = await Promise.all([
        axios.get(`${API_URL}/api/projetos/equipe/disciplinas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/projetos/equipe/empresas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/projetos/equipe/contatos`, { withCredentials: true })
      ]);
      setDisciplinas(discRes.data.data || []);
      setEmpresas(empRes.data.data || []);
      setContatos(contRes.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados auxiliares:', err);
    }
  }, []);

  // Busca equipe (disciplinas do projeto)
  const fetchEquipe = useCallback(async () => {
    if (!construflowId) { setEquipe([]); return; }
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe`, {
        params: { projectId: construflowId },
        withCredentials: true
      });
      const data = response.data.data || [];
      setEquipe([...data].sort((a, b) =>
        (a.discipline?.discipline_name || '').localeCompare(b.discipline?.discipline_name || '', 'pt-BR')
      ));
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    } finally {
      setLoading(false);
    }
  }, [construflowId]);

  // Busca análise cruzada
  const fetchCrossRef = useCallback(async () => {
    if (!construflowId) { setCrossRef(null); return; }
    setCrossRefLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe/disciplinas-cruzadas`, {
        params: {
          construflowId,
          smartsheetId: selectedProject?.smartsheet_id || '',
          projectName: selectedProject?.project_name || selectedProject?.project_code_norm || ''
        },
        withCredentials: true
      });
      setCrossRef(response.data.data || null);
    } catch (err) {
      console.error('Erro ao buscar análise cruzada:', err);
      setCrossRef(null);
    } finally {
      setCrossRefLoading(false);
    }
  }, [construflowId, selectedProject]);

  useEffect(() => { fetchAuxData(); }, [fetchAuxData]);
  useEffect(() => { fetchEquipe(); fetchCrossRef(); }, [fetchEquipe, fetchCrossRef]);

  // Quick-add do painel de cobertura
  const handleQuickAdd = (disciplineName) => {
    setActiveTab('equipeCliente');
    // O EquipeClientePanel gerencia seu próprio modal
  };

  const pendingCount = crossRef?.analysis?.pendingCount || 0;

  if (!selectedProjectId) {
    return (
      <div className="equipe-container">
        <div className="equipe-empty-state">
          <div className="equipe-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="equipe-empty-text">Selecione um projeto para ver a equipe</p>
        </div>
      </div>
    );
  }

  return (
    <div className="equipe-container">
      <div className="equipe-tabs-container">
        <div className="equipe-tabs-header">
          {/* Sub-aba 1: Equipe Otus */}
          <button
            type="button"
            onClick={() => setActiveTab('equipeOtus')}
            className={`equipe-tab ${activeTab === 'equipeOtus' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M9 12h6" />
              <path d="M12 9v6" />
            </svg>
            Equipe Otus
          </button>

          {/* Sub-aba 2: Equipe do Cliente */}
          <button
            type="button"
            onClick={() => setActiveTab('equipeCliente')}
            className={`equipe-tab ${activeTab === 'equipeCliente' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Equipe do Cliente
            <span className="equipe-tab-badge">{equipe.length}</span>
          </button>

          {/* Sub-aba 3: Controle de Disciplinas */}
          <button
            type="button"
            onClick={() => setActiveTab('controle')}
            className={`equipe-tab ${activeTab === 'controle' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Controle de Disciplinas
            {pendingCount > 0 && (
              <span className="equipe-tab-badge equipe-tab-badge--alert">{pendingCount}</span>
            )}
          </button>
        </div>

        <div className="equipe-tabs-content">
          {activeTab === 'equipeOtus' && (
            <div className="equipe-tab-panel">
              <EquipeOtusPanel
                projectCode={projectCode}
              />
            </div>
          )}

          {activeTab === 'equipeCliente' && (
            <div className="equipe-tab-panel">
              <EquipeClientePanel
                construflowId={construflowId}
                projectCode={projectCode}
                disciplinas={disciplinas}
                empresas={empresas}
                contatos={contatos}
                equipe={equipe}
                onEquipeChange={fetchEquipe}
                onCrossRefChange={fetchCrossRef}
              />
            </div>
          )}

          {activeTab === 'controle' && (
            <div className="equipe-tab-panel">
              <DisciplineCoveragePanel
                data={crossRef}
                loading={crossRefLoading}
                onQuickAdd={(name) => {
                  handleQuickAdd(name);
                }}
                standardDisciplines={disciplinas}
                projectId={construflowId}
                onMappingChange={fetchCrossRef}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EquipeView;

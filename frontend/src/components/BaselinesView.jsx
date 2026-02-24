/**
 * Componente: Vista de Baselines
 *
 * Gerenciamento de baselines de projetos:
 * - Seleção de projeto
 * - Listagem de baselines com revisão, nome, data, tarefas
 * - Criação de novas baselines (snapshot das tarefas atuais)
 * - Edição e exclusão de baselines
 * - Detalhes expandíveis com motivo/descrição
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { isFinalizedStatus, isPausedStatus } from '../utils/portfolio-utils';
import SearchableSelect from './SearchableSelect';
import CreateBaselineModal from './baselines/CreateBaselineModal';
import BaselineTable from './baselines/BaselineTable';
import BaselineDetailPanel from './baselines/BaselineDetailPanel';
import PendingRequestsSection from './baselines/PendingRequestsSection';
import '../styles/BaselinesView.css';

function BaselinesView() {
  const { hasFullAccess, isPrivileged } = useAuth();

  // Estado
  const [portfolio, setPortfolio] = useState([]);
  const [selectedProjectCode, setSelectedProjectCode] = useState('');
  const [baselines, setBaselines] = useState([]);
  const [selectedBaseline, setSelectedBaseline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [baselineSummary, setBaselineSummary] = useState(null);
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);

  // Carregar portfólio e resumo de baselines
  useEffect(() => {
    async function loadData() {
      try {
        const [portfolioRes, summaryRes] = await Promise.all([
          axios.get(`${API_URL}/api/portfolio?leaderFilter=true`, { withCredentials: true }),
          axios.get(`${API_URL}/api/baselines/summary`, { withCredentials: true }).catch(() => null),
        ]);
        if (portfolioRes.data.success) {
          setPortfolio(portfolioRes.data.data || []);
        }
        if (summaryRes?.data?.success) {
          setBaselineSummary(summaryRes.data.data || {});
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setPortfolioLoading(false);
      }
    }
    loadData();
  }, []);

  // Projetos únicos para o seletor (projetos com baselines primeiro)
  const projectOptions = useMemo(() => {
    const seen = new Set();
    return portfolio
      .filter(p => {
        if (!p.project_code_norm || seen.has(p.project_code_norm)) return false;
        if (!showFinalizedProjects && isFinalizedStatus(p.status)) return false;
        if (!showPausedProjects && isPausedStatus(p.status)) return false;
        seen.add(p.project_code_norm);
        return true;
      })
      .sort((a, b) => {
        // Projetos com baselines primeiro
        const aHas = baselineSummary?.[a.project_code_norm] ? 1 : 0;
        const bHas = baselineSummary?.[b.project_code_norm] ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        return (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR');
      })
      .map(p => {
        const count = baselineSummary?.[p.project_code_norm] || 0;
        const suffix = count > 0 ? ` (${count})` : '';
        return {
          value: p.project_code_norm,
          label: (p.project_name || p.project_code_norm) + suffix,
        };
      });
  }, [portfolio, baselineSummary, showFinalizedProjects, showPausedProjects]);

  // Estatísticas do resumo
  const summaryStats = useMemo(() => {
    if (!baselineSummary) return null;
    const projectCount = Object.keys(baselineSummary).length;
    const totalBaselines = Object.values(baselineSummary).reduce((sum, c) => sum + c, 0);
    return { projectCount, totalBaselines };
  }, [baselineSummary]);

  // Projeto selecionado
  const selectedProject = useMemo(() => {
    if (!selectedProjectCode) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectCode);
  }, [portfolio, selectedProjectCode]);

  // Carregar baselines quando projeto muda
  const fetchBaselines = useCallback(async () => {
    if (!selectedProjectCode) {
      setBaselines([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/baselines`, {
        params: { project_code: selectedProjectCode },
        withCredentials: true,
      });
      if (res.data.success) {
        setBaselines(res.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar baselines:', err);
      setError(err.response?.data?.error || 'Erro ao carregar baselines');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectCode]);

  useEffect(() => {
    fetchBaselines();
    setSelectedBaseline(null);
  }, [selectedProjectCode]);

  // Criar nova baseline
  const handleCreate = async ({ name, description }) => {
    if (!selectedProject) return;
    setCreating(true);
    try {
      const res = await axios.post(`${API_URL}/api/baselines`, {
        project_code: selectedProject.project_code_norm,
        smartsheet_id: selectedProject.smartsheet_id,
        project_name: selectedProject.project_name,
        name,
        description,
      }, { withCredentials: true });

      if (res.data.success) {
        setShowCreateModal(false);
        await fetchBaselines();
      }
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Erro ao criar baseline');
    } finally {
      setCreating(false);
    }
  };

  // Atualizar baseline
  const handleUpdate = async (id, updates) => {
    try {
      await axios.put(`${API_URL}/api/baselines/${id}`, updates, { withCredentials: true });
      await fetchBaselines();
    } catch (err) {
      alert('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    }
  };

  // Deletar baseline
  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta baseline? Os dados do snapshot serão perdidos.')) return;
    try {
      await axios.delete(`${API_URL}/api/baselines/${id}`, { withCredentials: true });
      if (selectedBaseline?.id === id) setSelectedBaseline(null);
      await fetchBaselines();
    } catch (err) {
      alert('Erro ao excluir: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="baselines-container">
      <div className="baselines-content">
        {/* Header */}
        <div className="baselines-header">
          <h2>Baselines</h2>
          <p className="baselines-subtitle">
            Gerencie baselines de cronograma dos projetos
          </p>
        </div>

        {/* Solicitações pendentes (visível para leaders/admins/directors) */}
        {isPrivileged && (
          <PendingRequestsSection
            portfolio={portfolio}
            onApproved={fetchBaselines}
          />
        )}

        {/* Seletor de Projeto e Filtros */}
        <div className="baselines-project-selector">
          <label>Projeto</label>
          {portfolioLoading ? (
            <span className="baselines-loading-text">Carregando projetos...</span>
          ) : (
            <SearchableSelect
              id="baseline-project-select"
              value={selectedProjectCode}
              onChange={(e) => setSelectedProjectCode(e.target.value)}
              options={projectOptions}
              placeholder="Selecione um projeto..."
            />
          )}
          <div className="baselines-filters">
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showFinalizedProjects}
                  onChange={(e) => setShowFinalizedProjects(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Mostrar Projetos Finalizados</span>
              </label>
            </div>
            <div className="finalized-toggle-wrapper">
              <label className="finalized-toggle">
                <input
                  type="checkbox"
                  checked={showPausedProjects}
                  onChange={(e) => setShowPausedProjects(e.target.checked)}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Mostrar Projetos Pausados</span>
              </label>
            </div>
          </div>
        </div>

        {/* Conteúdo principal */}
        {!selectedProjectCode ? (
          <div className="baselines-empty-state">
            <div className="baselines-empty-icon">&#128203;</div>
            <p>Selecione um projeto para visualizar e gerenciar suas baselines.</p>
            {summaryStats && summaryStats.totalBaselines > 0 && (
              <p className="baselines-summary-hint">
                {summaryStats.totalBaselines} baseline{summaryStats.totalBaselines !== 1 ? 's' : ''} registrada{summaryStats.totalBaselines !== 1 ? 's' : ''} em {summaryStats.projectCount} projeto{summaryStats.projectCount !== 1 ? 's' : ''}.
                Projetos com baselines aparecem primeiro no seletor.
              </p>
            )}
          </div>
        ) : loading ? (
          <div className="baselines-loading">Carregando baselines...</div>
        ) : error ? (
          <div className="baselines-error">{error}</div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="baselines-toolbar">
              <span className="baselines-count">
                {baselines.length} baseline{baselines.length !== 1 ? 's' : ''} registrada{baselines.length !== 1 ? 's' : ''}
              </span>
              <button
                className="baselines-btn-create"
                onClick={() => setShowCreateModal(true)}
              >
                + Nova Baseline
              </button>
            </div>

            {/* Tabela de Baselines */}
            {baselines.length === 0 ? (
              <div className="baselines-empty-state">
                <p>Nenhuma baseline registrada para este projeto.</p>
                <p className="baselines-empty-hint">
                  Clique em "+ Nova Baseline" para criar o primeiro snapshot do cronograma.
                </p>
              </div>
            ) : (
              <BaselineTable
                baselines={baselines}
                selectedId={selectedBaseline?.id}
                onSelect={setSelectedBaseline}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}

            {/* Painel de detalhes */}
            {selectedBaseline && (
              <BaselineDetailPanel
                baseline={selectedBaseline}
                onClose={() => setSelectedBaseline(null)}
              />
            )}
          </>
        )}

        {/* Modal de criação */}
        {showCreateModal && (
          <CreateBaselineModal
            projectName={selectedProject?.project_name || selectedProjectCode}
            project={selectedProject}
            nextRevision={baselines.length}
            onConfirm={handleCreate}
            onCancel={() => setShowCreateModal(false)}
            loading={creating}
          />
        )}
      </div>
    </div>
  );
}

export default BaselinesView;

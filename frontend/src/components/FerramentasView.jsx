/**
 * Componente: Vista de Ferramentas
 *
 * Design profissional com sub-abas:
 * - Configuração: toggles, ferramentas internas, IDs/URLs
 * - Relatório Semanal: KPIs do time, geração, pipeline, histórico
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ReportTeamKPIs from './weekly-reports/ReportTeamKPIs';
import ReportWeeklyLog from './weekly-reports/ReportWeeklyLog';
import ReportPipeline from './weekly-reports/ReportPipeline';
import ReportHistory from './weekly-reports/ReportHistory';
import '../styles/FerramentasView.css';
import '../styles/WeeklyReport.css';

// Ferramentas com toggle liga/desliga
const TOGGLE_TOOLS = [
  { key: 'bot_whatsapp_status', name: 'WhatsApp' },
  { key: 'relatorio_semanal_status', name: 'Relatório Semanal' },
  { key: 'portal_cliente_status', name: 'Portal do Cliente' },
];

// Ferramentas em desenvolvimento (botões desabilitados)
const DEV_TOOLS = [
  { key: 'checklist_status', name: 'Checklist' },
  { key: 'dod_status', name: 'DOD' },
  { key: 'escopo_status', name: 'Escopo' },
];

// Status de projetos ativos (para tabela de status dos relatórios)
const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];

// Configuração dos campos de IDs e URLs (edição inline)
const TOOL_ID_FIELDS = [
  { key: 'construflow_id', name: 'Construflow', type: 'id' },
  { key: 'whatsapp_group_id', name: 'WhatsApp', type: 'id' },
  { key: 'dod_id', name: 'DOD', type: 'id', google: true },
  { key: 'escopo_entregas_id', name: 'Escopo Entregas', type: 'id', google: true },
  { key: 'smartsheet_id', name: 'Smartsheet', type: 'id' },
  { key: 'discord_id', name: 'Discord', type: 'id' },
  { key: 'pasta_emails_id', name: 'Pasta Emails', type: 'id', google: true },
  { key: 'capa_email_url', name: 'Capa Email', type: 'url' },
  { key: 'gantt_email_url', name: 'Gantt Email', type: 'url' },
  { key: 'disciplina_email_url', name: 'Disciplina Email', type: 'url' },
  { key: 'construflow_disciplinasclientes', name: 'Disciplinas Cliente', type: 'tags' },
];

// Campos dropdown (plataformas)
const PLATFORM_FIELDS = [
  {
    key: 'plataforma_comunicacao',
    name: 'Plataforma Comunicacao',
    options: [
      { value: 'construflow', label: 'Construflow' },
      { value: 'bim360', label: 'BIM360' },
      { value: 'bimcollab', label: 'BIMCollab' },
      { value: 'trimble_connect', label: 'Trimble Connect' },
      { value: 'excel', label: 'Excel' },
      { value: 'construcode', label: 'Construcode' },
      { value: 'qicloud', label: 'QICloud' },
      { value: 'outros', label: 'Outros' },
    ],
  },
  {
    key: 'plataforma_acd',
    name: 'Plataforma ACD',
    options: [
      { value: 'google_drive', label: 'Google Drive' },
      { value: 'bim360', label: 'BIM360' },
      { value: 'autodoc', label: 'Autodoc' },
      { value: 'construcode', label: 'Construcode' },
      { value: 'onedrive', label: 'OneDrive' },
      { value: 'qicloud', label: 'QICloud' },
      { value: 'construmanager', label: 'Construmanager' },
      { value: 'dropbox', label: 'DropBox' },
      { value: 'outros', label: 'Outros' },
    ],
  },
];

/**
 * Extrai o ID de uma URL do Google (Docs, Sheets, Drive) ou retorna o valor original se já for um ID.
 */
function extractGoogleId(value) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.includes('google.com')) return trimmed;
  const match = trimmed.match(/(?:\/d\/|\/folders\/|[?&]id=)([a-zA-Z0-9_-]{10,})/);
  return match ? match[1] : trimmed;
}

function FerramentasView({ selectedProjectId, portfolio = [], onToolUpdate }) {
  const { canEditPortfolio } = useAuth();
  const [activeTab, setActiveTab] = useState('status');
  const [saving, setSaving] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localOverrides, setLocalOverrides] = useState({});
  const [error, setError] = useState(null);
  const [tagsModal, setTagsModal] = useState(null);
  const [botStatusOpen, setBotStatusOpen] = useState(false);
  const [platformStatusOpen, setPlatformStatusOpen] = useState(false);
  const [equipeNomStatusOpen, setEquipeNomStatusOpen] = useState(false);
  const [equipeNomStatus, setEquipeNomStatus] = useState({});

  // Weekly Report state
  const [wrReady, setWrReady] = useState(false);
  const [wrGenerating, setWrGenerating] = useState(false);
  const [wrReportId, setWrReportId] = useState(null);
  const [relatosDias, setRelatosDias] = useState(7);
  const [relatosCustomInput, setRelatosCustomInput] = useState('');
  const [wrExistsForWeek, setWrExistsForWeek] = useState(false);

  // Prerequisites state
  const [prerequisites, setPrerequisites] = useState(null);
  const [prerequisitesLoading, setPrerequisitesLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  const projectData = useMemo(() => {
    if (!selectedProject) return null;
    return { ...selectedProject, ...localOverrides };
  }, [selectedProject, localOverrides]);

  const isRelatorioAtivo = projectData?.relatorio_semanal_status === 'ativo';

  const activeProjects = useMemo(() => {
    if (!portfolio || portfolio.length === 0) return [];
    const teamName = selectedProject?.nome_time;
    const seen = new Set();
    return portfolio
      .filter(p => {
        if (!p.project_code_norm || seen.has(p.project_code_norm)) return false;
        seen.add(p.project_code_norm);
        if (!ACTIVE_STATUSES.includes((p.status || '').toLowerCase().trim())) return false;
        if (teamName && p.nome_time !== teamName) return false;
        return true;
      })
      .sort((a, b) => {
        const nameA = (a.nome_comercial || a.project_name || '').toLowerCase();
        const nameB = (b.nome_comercial || b.project_name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });
  }, [portfolio, selectedProject]);

  useEffect(() => {
    setLocalOverrides({});
    setEditingField(null);
    setError(null);
    setWrReady(false);
    setWrGenerating(false);
    setWrReportId(null);
    setRelatosDias(7);
    setRelatosCustomInput('');
    setActiveTab('config');
    setPrerequisites(null);
    setShowTooltip(false);
  }, [selectedProjectId]);

  // Fetch prerequisites when project changes
  useEffect(() => {
    const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code;
    if (!projectCode) return;

    let cancelled = false;
    setPrerequisitesLoading(true);

    axios.get(
      `${API_URL}/api/weekly-reports/prerequisites/${projectCode}`,
      { withCredentials: true }
    ).then(res => {
      if (!cancelled) {
        setPrerequisites(res.data?.data || null);
      }
    }).catch(err => {
      console.warn('Erro ao buscar pré-requisitos:', err.message);
      if (!cancelled) setPrerequisites(null);
    }).finally(() => {
      if (!cancelled) setPrerequisitesLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedProject]);

  // Fetch team & nomenclatura status for active projects
  useEffect(() => {
    if (!activeProjects || activeProjects.length === 0) {
      setEquipeNomStatus({});
      return;
    }

    const projectsPayload = activeProjects
      .filter(p => p.project_code_norm)
      .map(p => ({
        projectCode: p.project_code_norm,
        construflowId: p.construflow_id || null,
        smartsheetId: p.smartsheet_id || null,
      }));
    if (projectsPayload.length === 0) return;

    let cancelled = false;

    axios.post(
      `${API_URL}/api/projects/team-status`,
      { projects: projectsPayload },
      { withCredentials: true }
    ).then(res => {
      if (!cancelled && res.data?.data) {
        setEquipeNomStatus(res.data.data);
      }
    }).catch(err => {
      console.warn('Erro ao buscar team-status:', err.message);
    });

    return () => { cancelled = true; };
  }, [activeProjects]);

  const getProjectCode = () => {
    return selectedProject?.project_code_norm || selectedProject?.project_code;
  };

  // Toggle de status
  const handleToggle = async (field, currentValue) => {
    if (!canEditPortfolio) return;
    const projectCode = getProjectCode();
    if (!projectCode) return;

    const isActivating = currentValue !== 'ativo';

    // Validação de pré-requisitos apenas para ativação do relatório semanal
    if (field === 'relatorio_semanal_status' && isActivating && prerequisites && !prerequisites.canActivate) {
      setShowTooltip(true);
      return;
    }

    const newValue = currentValue === 'ativo' ? 'desativado' : 'ativo';

    setLocalOverrides(prev => ({ ...prev, [field]: newValue }));
    setSaving(prev => ({ ...prev, [field]: true }));
    setError(null);

    try {
      await axios.put(
        `${API_URL}/api/portfolio/${projectCode}/tools`,
        { field, value: newValue, oldValue: currentValue },
        { withCredentials: true }
      );
      onToolUpdate?.(projectCode, field, newValue);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setLocalOverrides(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setError(`Erro ao atualizar ${field}: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  // Dropdown change (plataformas)
  const handleDropdownChange = async (field, value) => {
    const projectCode = getProjectCode();
    if (!projectCode) return;

    const oldValue = projectData?.[field];
    setLocalOverrides(prev => ({ ...prev, [field]: value || null }));
    setSaving(prev => ({ ...prev, [field]: true }));
    setError(null);

    try {
      await axios.put(
        `${API_URL}/api/portfolio/${projectCode}/tools`,
        { field, value: value || null, oldValue },
        { withCredentials: true }
      );
      onToolUpdate?.(projectCode, field, value || null);
    } catch (err) {
      setLocalOverrides(prev => { const n = {...prev}; delete n[field]; return n; });
      setError(`Erro ao atualizar ${field}: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleStartEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async (field) => {
    const projectCode = getProjectCode();
    if (!projectCode) return;

    const oldValue = projectData?.[field];
    const fieldConfig = TOOL_ID_FIELDS.find(f => f.key === field);

    // Normaliza URLs do Google → extrai ID automaticamente
    let finalValue = editValue;
    if (fieldConfig?.google && editValue) {
      finalValue = extractGoogleId(editValue);
      setEditValue(finalValue);
    }

    setSaving(prev => ({ ...prev, [field]: true }));
    setError(null);

    try {
      await axios.put(
        `${API_URL}/api/portfolio/${projectCode}/tools`,
        { field, value: finalValue, oldValue },
        { withCredentials: true }
      );
      setLocalOverrides(prev => ({ ...prev, [field]: finalValue }));
      onToolUpdate?.(projectCode, field, finalValue);
      setEditingField(null);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setError(`Erro ao salvar: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e, field) => {
    if (e.key === 'Enter') {
      handleSaveEdit(field);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Disciplinas modal handlers
  const handleOpenTagsModal = async (field, name, currentValue) => {
    const currentTags = currentValue
      ? currentValue.split(/[;,]/).map(t => t.trim()).filter(Boolean)
      : [];
    const selected = new Set(currentTags);

    setTagsModal({ field, name, selected, options: [], loading: true });

    const construflowId = projectData?.construflow_id;
    if (!construflowId) {
      setTagsModal(prev => prev ? { ...prev, loading: false } : null);
      return;
    }

    try {
      const res = await axios.get(
        `${API_URL}/api/projetos/equipe/disciplinas-cruzadas`,
        { params: { construflowId }, withCredentials: true }
      );
      const cfDisciplines = res.data?.data?.construflow || [];
      setTagsModal(prev => prev ? { ...prev, options: cfDisciplines, loading: false } : null);
    } catch (err) {
      console.error('Erro ao buscar disciplinas:', err);
      setTagsModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const handleToggleDiscipline = (name) => {
    setTagsModal(prev => {
      if (!prev) return null;
      const next = new Set(prev.selected);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return { ...prev, selected: next };
    });
  };

  const handleSaveTags = async () => {
    if (!tagsModal) return;
    const projectCode = getProjectCode();
    if (!projectCode) return;

    const newValue = Array.from(tagsModal.selected).join(';');
    const oldValue = projectData?.[tagsModal.field];

    setSaving(prev => ({ ...prev, [tagsModal.field]: true }));
    setError(null);

    try {
      await axios.put(
        `${API_URL}/api/portfolio/${projectCode}/tools`,
        { field: tagsModal.field, value: newValue, oldValue },
        { withCredentials: true }
      );
      setLocalOverrides(prev => ({ ...prev, [tagsModal.field]: newValue }));
      onToolUpdate?.(projectCode, tagsModal.field, newValue);
      setTagsModal(null);
    } catch (err) {
      console.error('Erro ao salvar disciplinas:', err);
      setError(`Erro ao salvar: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [tagsModal.field]: false }));
    }
  };

  // Weekly Report handlers
  const handleReadinessChange = useCallback((ready) => {
    setWrReady(ready);
  }, []);

  const handleGenerateReport = async (forceRegenerate = false) => {
    const projectCode = getProjectCode();
    if (!projectCode || wrGenerating) return;

    setWrGenerating(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/weekly-reports/generate`,
        { projectCode, options: { relatosDias, force: forceRegenerate } },
        { withCredentials: true }
      );
      setWrReportId(response.data.data?.id || response.data.reportId);
    } catch (err) {
      console.error('Erro ao gerar relatorio semanal:', err);
      setError(`Erro ao iniciar geracao: ${err.response?.data?.error || err.message}`);
      setWrGenerating(false);
    }
  };

  const handlePipelineComplete = useCallback(() => {
    setWrGenerating(false);
  }, []);

  // Fetch readiness silently for the generate button
  useEffect(() => {
    const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code;
    if (!projectCode || !isRelatorioAtivo) {
      setWrReady(false);
      return;
    }

    axios.get(
      `${API_URL}/api/weekly-reports/readiness/${projectCode}`,
      { withCredentials: true }
    ).then(res => {
      setWrReady(res.data?.data?.ready === true || res.data?.ready === true);
    }).catch(() => {
      setWrReady(false);
    });

    // Check if report already exists for current week
    axios.get(
      `${API_URL}/api/weekly-reports/history/${projectCode}?limit=1`,
      { withCredentials: true }
    ).then(res => {
      const reports = res.data?.data || res.data?.reports || [];
      if (reports.length > 0) {
        const latest = reports[0];
        // Check if latest report is from current ISO week
        const now = new Date();
        const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const currentWeek = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        const currentYear = d.getUTCFullYear();
        setWrExistsForWeek(
          latest.week_number === currentWeek &&
          latest.week_year === currentYear &&
          latest.status === 'completed'
        );
      } else {
        setWrExistsForWeek(false);
      }
    }).catch(() => {
      setWrExistsForWeek(false);
    });
  }, [selectedProject, isRelatorioAtivo]);

  if (!selectedProjectId) {
    return (
      <div className="ftv-empty">
        <p>Selecione um projeto para visualizar o status das ferramentas.</p>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="ftv-empty">
        <p>Nenhum dado disponível para este projeto.</p>
      </div>
    );
  }

  const idFieldsToShow = TOOL_ID_FIELDS;

  // Verifica se o toggle do relatório pode ser ativado
  const canActivateRelatorio = prerequisites?.canActivate !== false;
  const missingFields = prerequisites?.missingFields || [];

  return (
    <div className="ftv-container">
      {/* Erro */}
      {error && (
        <div className="ftv-error">
          <span>{error}</span>
          <button className="ftv-error-close" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {/* Sub-abas */}
      <div className="ftv-tabs-container">
        <div className="ftv-tabs-header">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`ftv-tab ${activeTab === 'status' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Status
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`ftv-tab ${activeTab === 'config' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configuração
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('relatorio')}
            className={`ftv-tab ${activeTab === 'relatorio' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Relatório Semanal
          </button>
        </div>

        <div className="ftv-tabs-content">
          {/* Tab: Status */}
          {activeTab === 'status' && (
            <div className="ftv-tab-panel">
              {/* Seção: Status dos Bots da Equipe */}
              {activeProjects.length > 0 && (
                <section className="ftv-section">
                  <h4 className="ftv-section-title">Status dos Bots da Equipe <span className="ftv-bot-status-badge">{activeProjects.length}</span></h4>
                  <div className="wr-status-table-wrapper">
                    <table className="wr-status-table">
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th className="wr-status-table-center">WhatsApp</th>
                          <th className="wr-status-table-center">Relatório Semanal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProjects.map((project) => {
                          const isSelected = project.project_code_norm === selectedProjectId;
                          const whatsappAtivo = project.bot_whatsapp_status === 'ativo';
                          const relatorioAtivo = project.relatorio_semanal_status === 'ativo';
                          return (
                            <tr
                              key={project.project_code_norm}
                              className={isSelected ? 'wr-status-row-current' : ''}
                            >
                              <td>
                                <div className="wr-status-project-name">
                                  {project.nome_comercial || project.project_name || project.project_code_norm}
                                </div>
                                <div className="wr-status-project-code">{project.project_code_norm}</div>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${whatsappAtivo ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {whatsappAtivo ? 'Ativo' : 'Desativado'}
                                </span>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${relatorioAtivo ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {relatorioAtivo ? 'Ativo' : 'Desativado'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Seção: Plataformas da Equipe */}
              {activeProjects.length > 0 && (
                <section className="ftv-section">
                  <h4 className="ftv-section-title">Plataformas da Equipe <span className="ftv-bot-status-badge">{activeProjects.length}</span></h4>
                  <div className="wr-status-table-wrapper">
                    <table className="wr-status-table">
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th className="wr-status-table-center">Comunicação</th>
                          <th className="wr-status-table-center">ACD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProjects.map((project) => {
                          const isSelected = project.project_code_norm === selectedProjectId;
                          const comValue = project.plataforma_comunicacao;
                          const acdValue = project.plataforma_acd;
                          const comField = PLATFORM_FIELDS.find(f => f.key === 'plataforma_comunicacao');
                          const acdField = PLATFORM_FIELDS.find(f => f.key === 'plataforma_acd');
                          const comLabel = comValue && comField
                            ? (comField.options.find(o => o.value === comValue)?.label || comValue)
                            : null;
                          const acdLabel = acdValue && acdField
                            ? (acdField.options.find(o => o.value === acdValue)?.label || acdValue)
                            : null;
                          return (
                            <tr
                              key={project.project_code_norm}
                              className={isSelected ? 'wr-status-row-current' : ''}
                            >
                              <td>
                                <div className="wr-status-project-name">
                                  {project.nome_comercial || project.project_name || project.project_code_norm}
                                </div>
                                <div className="wr-status-project-code">{project.project_code_norm}</div>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${comLabel ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {comLabel || 'Não definido'}
                                </span>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${acdLabel ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {acdLabel || 'Não definido'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Seção: Equipe & Nomenclatura da Equipe */}
              {activeProjects.length > 0 && (
                <section className="ftv-section">
                  <h4 className="ftv-section-title">Equipe &amp; Nomenclatura da Equipe <span className="ftv-bot-status-badge">{activeProjects.length}</span></h4>
                  <div className="wr-status-table-wrapper">
                    <table className="wr-status-table">
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th className="wr-status-table-center">Equipe</th>
                          <th className="wr-status-table-center">Nomenclatura Modelos</th>
                          <th className="wr-status-table-center">Nomenclatura Pranchas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProjects.map((project) => {
                          const isSelected = project.project_code_norm === selectedProjectId;
                          const status = equipeNomStatus[project.project_code_norm];
                          const equipePct = status?.equipe_percentage;
                          const hasModelos = status?.has_nomenclatura_modelos || false;
                          const hasPranchas = status?.has_nomenclatura_pranchas || false;
                          return (
                            <tr
                              key={project.project_code_norm}
                              className={isSelected ? 'wr-status-row-current' : ''}
                            >
                              <td>
                                <div className="wr-status-project-name">
                                  {project.nome_comercial || project.project_name || project.project_code_norm}
                                </div>
                                <div className="wr-status-project-code">{project.project_code_norm}</div>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${equipePct === 100 ? 'wr-kpi-pill-green' : equipePct > 0 ? 'wr-kpi-pill-yellow' : 'wr-kpi-pill-red'}`}>
                                  {equipePct != null ? `${equipePct}%` : '—'}
                                </span>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${hasModelos ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {hasModelos ? 'Preenchido' : 'Não preenchido'}
                                </span>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${hasPranchas ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {hasPranchas ? 'Preenchido' : 'Não preenchido'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Seção: Portal do Cliente */}
              {activeProjects.length > 0 && (
                <section className="ftv-section">
                  <h4 className="ftv-section-title">Portal do Cliente <span className="ftv-bot-status-badge">{activeProjects.length}</span></h4>
                  <div className="wr-status-table-wrapper">
                    <table className="wr-status-table">
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th className="wr-status-table-center">Portal do Cliente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProjects.map((project) => {
                          const isSelected = project.project_code_norm === selectedProjectId;
                          const portalAtivo = project.portal_cliente_status !== 'desativado';
                          return (
                            <tr
                              key={project.project_code_norm}
                              className={isSelected ? 'wr-status-row-current' : ''}
                            >
                              <td>
                                <div className="wr-status-project-name">
                                  {project.nome_comercial || project.project_name || project.project_code_norm}
                                </div>
                                <div className="wr-status-project-code">{project.project_code_norm}</div>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${portalAtivo ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {portalAtivo ? 'Ativo' : 'Desativado'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeProjects.length === 0 && (
                <div style={{ color: '#737373', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
                  Nenhum projeto ativo na equipe para exibir status.
                </div>
              )}
            </div>
          )}

          {/* Tab: Configuração */}
          {activeTab === 'config' && (
            <div className="ftv-tab-panel">
              {/* Seção: Ativar / Desativar */}
              <section className="ftv-section">
                <h4 className="ftv-section-title">Ativar / Desativar</h4>
                <div className="ftv-status-grid">
                  {TOGGLE_TOOLS.map((tool) => {
                    const value = projectData[tool.key];
                    const isActive = value === 'ativo';
                    const isRelatorioToggle = tool.key === 'relatorio_semanal_status';
                    const showWarning = isRelatorioToggle && !isActive && missingFields.length > 0;
                    const toggleDisabled = !canEditPortfolio || saving[tool.key] ||
                      (isRelatorioToggle && !isActive && !canActivateRelatorio && !prerequisitesLoading);

                    return (
                      <div
                        key={tool.key}
                        className={`ftv-status-card ${isActive ? 'ftv-status-card-active' : ''} ${showWarning ? 'ftv-status-card-warning' : ''}`}
                      >
                        <div className="ftv-status-card-top">
                          <span className="ftv-status-name">{tool.name}</span>
                          {saving[tool.key] && <span className="ftv-saving">Salvando...</span>}
                        </div>
                        <div className="ftv-status-card-bottom">
                          {showWarning ? (
                            <div
                              className="ftv-toggle-wrapper"
                              onMouseEnter={() => setShowTooltip(true)}
                              onMouseLeave={() => setShowTooltip(false)}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                              <span className="ftv-status-label ftv-label-warning">Campos faltantes</span>
                              {showTooltip && (
                                <div className="ftv-prereq-tooltip">
                                  <div className="ftv-prereq-tooltip-title">Campos obrigatórios faltantes:</div>
                                  <ul className="ftv-prereq-tooltip-list">
                                    {missingFields.map((f, i) => (
                                      <li key={i}>
                                        <span className="ftv-prereq-tooltip-dot" />
                                        {f.label}
                                        <span className="ftv-prereq-tooltip-location">
                                          ({f.location === 'equipe' ? 'Aba Equipe' : 'IDs e URLs'})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : (
                            <>
                              <label className="ftv-toggle" aria-label={`${tool.name}: ${isActive ? 'ativo' : 'desativado'}`}>
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  onChange={() => handleToggle(tool.key, value || 'desativado')}
                                  disabled={toggleDisabled}
                                />
                                <span className="ftv-toggle-track">
                                  <span className="ftv-toggle-thumb"></span>
                                </span>
                              </label>
                              <span className={`ftv-status-label ${isActive ? 'ftv-label-active' : 'ftv-label-inactive'}`}>
                                {isActive ? 'Ativo' : 'Desativado'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Seção: Ferramentas Internas */}
              <section className="ftv-section">
                <h4 className="ftv-section-title">Ferramentas Internas</h4>
                <div className="ftv-status-grid">
                  {DEV_TOOLS.map((tool) => (
                    <div key={tool.key} className="ftv-status-card ftv-dev-card">
                      <div className="ftv-status-card-top">
                        <span className="ftv-status-name">{tool.name}</span>
                        <span className="ftv-dev-badge">Em desenvolvimento</span>
                      </div>
                      <div className="ftv-status-card-bottom">
                        <svg className="ftv-dev-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                        </svg>
                        <span className="ftv-dev-status">Em breve</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Seção: Plataformas */}
              <section className="ftv-section">
                <h4 className="ftv-section-title">Plataformas</h4>
                <div className="ftv-id-list">
                  {PLATFORM_FIELDS.map(field => (
                    <div key={field.key} className="ftv-id-row">
                      <span className="ftv-id-label">{field.name}</span>
                      <div className="ftv-id-value-area">
                        <select
                          className="ftv-dropdown-select"
                          value={projectData[field.key] || ''}
                          onChange={(e) => handleDropdownChange(field.key, e.target.value)}
                          disabled={saving[field.key]}
                        >
                          <option value="">Nao definido</option>
                          {field.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {saving[field.key] && <span className="ftv-saving">Salvando...</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Seção: IDs e URLs */}
              {idFieldsToShow.length > 0 && (
                <section className="ftv-section">
                  <h4 className="ftv-section-title">IDs e URLs</h4>
                  <div className="ftv-id-list">
                    {idFieldsToShow.map((tool) => {
                      const value = projectData[tool.key];
                      const hasValue = value !== null && value !== undefined && value !== '';
                      const isEditing = editingField === tool.key;

                      // Tipo tags: renderiza badges + botão editar abre modal
                      if (tool.type === 'tags') {
                        const tags = hasValue
                          ? value.split(/[;,]/).map(t => t.trim()).filter(Boolean)
                          : [];
                        return (
                          <div key={tool.key} className="ftv-id-row">
                            <span className="ftv-id-label">{tool.name}</span>
                            <div className="ftv-id-value-area">
                              {tags.length > 0 ? (
                                <div className="ftv-tags-preview">
                                  {tags.map((tag, i) => (
                                    <span key={i} className="ftv-tag-badge">{tag}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="ftv-id-empty">Nenhuma disciplina</span>
                              )}
                              {canEditPortfolio && (
                                <button
                                  onClick={() => handleOpenTagsModal(tool.key, tool.name, value)}
                                  className="ftv-edit-btn"
                                  aria-label={`Editar ${tool.name}`}
                                  disabled={saving[tool.key]}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                    <path d="m15 5 4 4"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={tool.key} className={`ftv-id-row ${isEditing ? 'ftv-id-row-editing' : ''}`}>
                          <span className="ftv-id-label">
                            {tool.name} {tool.type === 'url' ? 'URL' : 'ID'}
                          </span>

                          {isEditing ? (
                            <div className="ftv-edit-area">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleEditKeyDown(e, tool.key)}
                                className="ftv-edit-input"
                                placeholder={tool.google ? 'Cole o ID ou URL do Google' : `${tool.type === 'url' ? 'URL' : 'ID'} do ${tool.name}`}
                                autoFocus
                              />
                              <div className="ftv-edit-actions">
                                <button
                                  onClick={() => handleSaveEdit(tool.key)}
                                  className="ftv-btn-save"
                                  disabled={saving[tool.key]}
                                >
                                  {saving[tool.key] ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="ftv-btn-cancel"
                                  disabled={saving[tool.key]}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="ftv-id-value-area">
                              {hasValue ? (
                                <>
                                  {tool.type === 'url' ? (
                                    <>
                                      <a
                                        href={value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ftv-link"
                                        title={value}
                                      >
                                        {value.length > 50 ? value.substring(0, 50) + '...' : value}
                                        <svg className="ftv-link-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                          <polyline points="15 3 21 3 21 9"/>
                                          <line x1="10" y1="14" x2="21" y2="3"/>
                                        </svg>
                                      </a>
                                      {tool.key === 'capa_email_url' && !value.includes('drive.google.com') && (
                                        <span className="ftv-url-hint">Use um link do Google Drive</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="ftv-id-value" title={value}>
                                      {value.length > 50 ? value.substring(0, 50) + '...' : value}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="ftv-id-empty">Nenhum valor</span>
                              )}

                              {canEditPortfolio && (
                                <button
                                  onClick={() => handleStartEdit(tool.key, value)}
                                  className="ftv-edit-btn"
                                  aria-label={`Editar ${tool.name}`}
                                  disabled={saving[tool.key]}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                    <path d="m15 5 4 4"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Tab: Relatório Semanal */}
          {activeTab === 'relatorio' && (
            <div className="ftv-tab-panel">
              {/* 1. Controles do projeto (primeiro) */}
              <div className="wr-project-section wr-project-section-first">
                <h4 className="wr-project-section-title">
                  {projectData?.nome_comercial || projectData?.project_name || getProjectCode()}
                </h4>

                {isRelatorioAtivo ? (
                  <>
                    {/* Seletor de período dos relatos */}
                    <div className="wr-period-selector">
                      <span className="wr-period-label">Período dos relatos:</span>
                      <div className="wr-period-options">
                        <button
                          type="button"
                          className={`wr-period-btn ${relatosDias === 7 ? 'active' : ''}`}
                          onClick={() => { setRelatosDias(7); setRelatosCustomInput(''); }}
                          disabled={wrGenerating}
                        >
                          1 semana
                        </button>
                        <button
                          type="button"
                          className={`wr-period-btn ${relatosDias === 14 ? 'active' : ''}`}
                          onClick={() => { setRelatosDias(14); setRelatosCustomInput(''); }}
                          disabled={wrGenerating}
                        >
                          2 semanas
                        </button>
                        <button
                          type="button"
                          className={`wr-period-btn ${![7, 14].includes(relatosDias) ? 'active' : ''}`}
                          onClick={() => {
                            setRelatosCustomInput(String(relatosDias));
                            if (relatosDias === 7 || relatosDias === 14) setRelatosDias(0);
                          }}
                          disabled={wrGenerating}
                        >
                          Personalizado
                        </button>
                      </div>
                      {![7, 14].includes(relatosDias) && (
                        <div className="wr-period-custom">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={relatosCustomInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRelatosCustomInput(val);
                              const num = parseInt(val);
                              if (num >= 1 && num <= 30) setRelatosDias(num);
                            }}
                            className="wr-period-custom-input"
                            placeholder="Dias (1-30)"
                            disabled={wrGenerating}
                          />
                          <span className="wr-period-custom-unit">dias</span>
                        </div>
                      )}
                    </div>

                    {/* Generate button - destacado */}
                    <div className="wr-generate-area">
                      <button
                        className={`wr-generate-btn wr-generate-btn-primary ${wrGenerating ? 'wr-generate-btn-loading' : ''}`}
                        onClick={() => handleGenerateReport(wrExistsForWeek)}
                        disabled={wrGenerating}
                      >
                        {wrGenerating ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'wr-dot-pulse 1.5s infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Gerando...
                          </>
                        ) : wrExistsForWeek ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="1 4 1 10 7 10" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            Regerar Relatório Semanal
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Gerar Relatório Semanal
                          </>
                        )}
                      </button>
                      {wrExistsForWeek && !wrGenerating && (
                        <p className="wr-regenerate-hint">Relatório anterior será mantido como histórico</p>
                      )}
                    </div>

                    {/* Pipeline progress */}
                    {wrReportId && (
                      <ReportPipeline
                        reportId={wrReportId}
                        onComplete={handlePipelineComplete}
                      />
                    )}

                    {/* History */}
                    <ReportHistory projectCode={getProjectCode()} />
                  </>
                ) : (
                  <div className="wr-activation-alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div className="wr-activation-alert-content">
                      <strong>Relatório Semanal desativado</strong>
                      <p>Ative o Relatório Semanal na aba Configuração para gerar relatórios.</p>
                      {missingFields.length > 0 && (
                        <div className="wr-activation-missing">
                          <span>Campos faltantes para ativação:</span>
                          <ul>
                            {missingFields.map((f, i) => (
                              <li key={i}>
                                {f.label}
                                <span className="wr-activation-missing-location">
                                  {f.location === 'equipe' ? ' (Aba Equipe)' : ' (IDs e URLs)'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. KPIs do time */}
              <ReportTeamKPIs />

              {/* 2.5 Log Semanal - Matriz projeto x semana */}
              <ReportWeeklyLog />

              {/* 3. Tabela de status dos relatórios do time (por último) */}
              {activeProjects.length > 0 && (
                <div className="wr-status-section">
                  <h4 className="wr-status-section-title">Status dos Relatórios</h4>
                  <div className="wr-status-table-wrapper">
                    <table className="wr-status-table">
                      <thead>
                        <tr>
                          <th>Projeto</th>
                          <th className="wr-status-table-center">Relatório Semanal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProjects.map((project) => {
                          const isSelected = project.project_code_norm === selectedProjectId;
                          const isAtivo = project.relatorio_semanal_status === 'ativo';
                          return (
                            <tr
                              key={project.project_code_norm}
                              className={isSelected ? 'wr-status-row-current' : ''}
                            >
                              <td>
                                <div className="wr-status-project-name">
                                  {project.nome_comercial || project.project_name || project.project_code_norm}
                                </div>
                                <div className="wr-status-project-code">{project.project_code_norm}</div>
                              </td>
                              <td className="wr-status-table-center">
                                <span className={`wr-kpi-pill ${isAtivo ? 'wr-kpi-pill-green' : 'wr-kpi-pill-red'}`}>
                                  {isAtivo ? 'Ativo' : 'Desativado'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Disciplinas */}
      {tagsModal && (
        <div className="ftv-modal-overlay" onClick={() => setTagsModal(null)}>
          <div className="ftv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ftv-modal-header">
              <h3 className="ftv-modal-title">{tagsModal.name}</h3>
              <button className="ftv-modal-close" onClick={() => setTagsModal(null)}>
                &times;
              </button>
            </div>

            <div className="ftv-modal-body">
              {tagsModal.loading ? (
                <div className="ftv-modal-loading">Carregando disciplinas...</div>
              ) : tagsModal.options.length === 0 ? (
                <span className="ftv-id-empty">
                  {projectData?.construflow_id
                    ? 'Nenhuma disciplina encontrada no Construflow'
                    : 'Configure o Construflow ID para carregar disciplinas'}
                </span>
              ) : (
                <div className="ftv-disc-grid">
                  {tagsModal.options.map((disc) => {
                    const isChecked = tagsModal.selected.has(disc);
                    return (
                      <label key={disc} className={`ftv-disc-option ${isChecked ? 'ftv-disc-selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDiscipline(disc)}
                        />
                        <span className="ftv-disc-check">
                          {isChecked && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className="ftv-disc-name">{disc}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {tagsModal.selected.size > 0 && (
                <div className="ftv-disc-summary">
                  <span className="ftv-disc-summary-label">Selecionadas ({tagsModal.selected.size}):</span>
                  <div className="ftv-tags-preview" style={{ justifyContent: 'flex-start' }}>
                    {Array.from(tagsModal.selected).map((tag) => (
                      <span key={tag} className="ftv-tag-badge">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="ftv-modal-footer">
              <button
                onClick={() => setTagsModal(null)}
                className="ftv-btn-cancel"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTags}
                className="ftv-btn-save"
                disabled={saving[tagsModal.field] || tagsModal.loading}
              >
                {saving[tagsModal.field] ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default FerramentasView;

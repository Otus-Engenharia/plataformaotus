/**
 * Componente: Vista de Ferramentas
 *
 * Design profissional com sub-abas:
 * - Configuração: toggles, ferramentas internas, IDs/URLs
 * - Relatório Semanal: readiness, geração, pipeline, histórico
 */

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/FerramentasView.css';

// Ferramentas com toggle liga/desliga
const TOGGLE_TOOLS = [
  { key: 'bot_whatsapp_status', name: 'WhatsApp' },
  { key: 'relatorio_semanal_status', name: 'Relatório Semanal' },
];

// Ferramentas em desenvolvimento (botões desabilitados)
const DEV_TOOLS = [
  { key: 'checklist_status', name: 'Checklist' },
  { key: 'dod_status', name: 'DOD' },
  { key: 'escopo_status', name: 'Escopo' },
];

// Configuração dos campos de IDs e URLs (edição inline)
const TOOL_ID_FIELDS = [
  { key: 'construflow_id', name: 'Construflow', type: 'id' },
  { key: 'whatsapp_group_id', name: 'WhatsApp', type: 'id' },
  { key: 'dod_id', name: 'DOD', type: 'id' },
  { key: 'escopo_entregas_id', name: 'Escopo Entregas', type: 'id' },
  { key: 'smartsheet_id', name: 'Smartsheet', type: 'id' },
  { key: 'discord_id', name: 'Discord', type: 'id' },
  { key: 'pasta_emails_id', name: 'Pasta Emails', type: 'id' },
  { key: 'capa_email_url', name: 'Capa Email', type: 'url' },
  { key: 'gantt_email_url', name: 'Gantt Email', type: 'url' },
  { key: 'disciplina_email_url', name: 'Disciplina Email', type: 'url' },
  { key: 'construflow_disciplinasclientes', name: 'Disciplinas Cliente', type: 'tags' },
];

function FerramentasView({ selectedProjectId, portfolio = [] }) {
  const { hasFullAccess } = useAuth();
  const [activeTab, setActiveTab] = useState('config');
  const [saving, setSaving] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localOverrides, setLocalOverrides] = useState({});
  const [error, setError] = useState(null);
  const [tagsModal, setTagsModal] = useState(null); // { field, name, selected: Set, options: [] loading: bool }


  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  const projectData = useMemo(() => {
    if (!selectedProject) return null;
    return { ...selectedProject, ...localOverrides };
  }, [selectedProject, localOverrides]);

  const isRelatorioAtivo = projectData?.relatorio_semanal_status === 'ativo';

  React.useEffect(() => {
    setLocalOverrides({});
    setEditingField(null);
    setError(null);
    setWrReady(false);
    setWrGenerating(false);
    setWrReportId(null);
    setActiveTab('config');
  }, [selectedProjectId]);

  const getProjectCode = () => {
    return selectedProject?.project_code_norm || selectedProject?.project_code;
  };

  // Toggle de status
  const handleToggle = async (field, currentValue) => {
    if (!hasFullAccess) return;
    const projectCode = getProjectCode();
    if (!projectCode) return;

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

  const handleStartEdit = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async (field) => {
    const projectCode = getProjectCode();
    if (!projectCode) return;

    const oldValue = projectData?.[field];

    setSaving(prev => ({ ...prev, [field]: true }));
    setError(null);

    try {
      await axios.put(
        `${API_URL}/api/portfolio/${projectCode}/tools`,
        { field, value: editValue, oldValue },
        { withCredentials: true }
      );
      setLocalOverrides(prev => ({ ...prev, [field]: editValue }));
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

    // Busca disciplinas do Construflow do projeto
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

  const handleGenerateReport = async () => {
    const projectCode = getProjectCode();
    if (!projectCode || !wrReady || wrGenerating) return;

    setWrGenerating(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/weekly-reports/generate`,
        { projectCode },
        { withCredentials: true }
      );
      setWrReportId(response.data.reportId);
    } catch (err) {
      console.error('Erro ao gerar relatorio semanal:', err);
      setError(`Erro ao iniciar geracao: ${err.response?.data?.error || err.message}`);
      setWrGenerating(false);
    }
  };

  const handlePipelineComplete = useCallback(() => {
    setWrGenerating(false);
  }, []);

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

  // Filtra IDs/URLs que têm valor OU que o usuário pode editar
  const idFieldsToShow = TOOL_ID_FIELDS.filter(tool => {
    const value = projectData[tool.key];
    const hasValue = value !== null && value !== undefined && value !== '';
    return hasValue || hasFullAccess;
  });

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
            onClick={() => setActiveTab('config')}
            className={`ftv-tab ${activeTab === 'config' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Configuração
          </button>

          {isRelatorioAtivo && (
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
          )}
        </div>

        <div className="ftv-tabs-content">
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

                    return (
                      <div
                        key={tool.key}
                        className={`ftv-status-card ${isActive ? 'ftv-status-card-active' : ''}`}
                      >
                        <div className="ftv-status-card-top">
                          <span className="ftv-status-name">{tool.name}</span>
                          {saving[tool.key] && <span className="ftv-saving">Salvando...</span>}
                        </div>
                        <div className="ftv-status-card-bottom">
                          <label className="ftv-toggle" aria-label={`${tool.name}: ${isActive ? 'ativo' : 'desativado'}`}>
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange={() => handleToggle(tool.key, value || 'desativado')}
                              disabled={!hasFullAccess || saving[tool.key]}
                            />
                            <span className="ftv-toggle-track">
                              <span className="ftv-toggle-thumb"></span>
                            </span>
                          </label>
                          <span className={`ftv-status-label ${isActive ? 'ftv-label-active' : 'ftv-label-inactive'}`}>
                            {isActive ? 'Ativo' : 'Desativado'}
                          </span>
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
                              {hasFullAccess && (
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
                                placeholder={`${tool.type === 'url' ? 'URL' : 'ID'} do ${tool.name}`}
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
                                  ) : (
                                    <span className="ftv-id-value" title={value}>
                                      {value.length > 50 ? value.substring(0, 50) + '...' : value}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="ftv-id-empty">Nenhum valor</span>
                              )}

                              {hasFullAccess && (
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
          {activeTab === 'relatorio' && isRelatorioAtivo && (
            <div className="ftv-tab-panel">
              {/* Readiness checks */}
              <ReadinessChecks
                projectCode={getProjectCode()}
                onReadinessChange={handleReadinessChange}
              />

              {/* Generate button */}
              <div className="wr-generate-area">
                <button
                  className={`wr-generate-btn ${wrReady && !wrGenerating ? 'wr-generate-btn-ready' : 'wr-generate-btn-disabled'}`}
                  onClick={handleGenerateReport}
                  disabled={!wrReady || wrGenerating}
                >
                  {wrGenerating ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'wr-dot-pulse 1.5s infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Gerando...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/**
 * Componente: Vista de Ferramentas
 *
 * Design profissional com:
 * - Status cards compactos com toggle e borda colorida
 * - IDs/URLs em lista key-value com edição inline
 * - Campos vazios filtrados (não aparecem na lista de IDs)
 * - Botão editar aparece no hover
 */

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/FerramentasView.css';

// Ferramentas com toggle liga/desliga
const TOGGLE_TOOLS = [
  { key: 'whatsapp_status', name: 'WhatsApp' },
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
  { key: 'dod_id', name: 'DOD', type: 'id' },
  { key: 'escopo_entregas_id', name: 'Escopo Entregas', type: 'id' },
  { key: 'smartsheet_id', name: 'Smartsheet', type: 'id' },
  { key: 'discord_id', name: 'Discord', type: 'id' },
  { key: 'capa_email_url', name: 'Capa Email', type: 'url' },
  { key: 'gantt_email_url', name: 'Gantt Email', type: 'url' },
  { key: 'disciplina_email_url', name: 'Disciplina Email', type: 'url' },
];

function FerramentasView({ selectedProjectId, portfolio = [] }) {
  const { hasFullAccess } = useAuth();
  const [saving, setSaving] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [localOverrides, setLocalOverrides] = useState({});
  const [error, setError] = useState(null);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  const projectData = useMemo(() => {
    if (!selectedProject) return null;
    return { ...selectedProject, ...localOverrides };
  }, [selectedProject, localOverrides]);

  React.useEffect(() => {
    setLocalOverrides({});
    setEditingField(null);
    setError(null);
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
  );
}

export default FerramentasView;

/**
 * WorkspaceView - Pagina principal de gestao de tarefas
 *
 * Lista setores (da tabela sectors) e seus projetos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './WorkspaceView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Cores padrão para setores (já que sectors não tem campo color)
const SECTOR_COLORS = {
  'CS': '#22c55e',
  'Tecnologia': '#3b82f6',
  'Marketing': '#ec4899',
  'Vendas': '#f59e0b',
  'Gente & Gestão': '#8b5cf6',
  'Administrativo & Financeiro': '#6b7280',
  'Diretoria': '#ef4444',
  'Operação': '#06b6d4',
};

const SECTOR_ICONS = {
  'CS': '🎯',
  'Tecnologia': '💻',
  'Marketing': '📢',
  'Vendas': '💼',
  'Gente & Gestão': '👥',
  'Administrativo & Financeiro': '📊',
  'Diretoria': '🏢',
  'Operação': '⚙️',
};

// === ICONS ===
const Icons = {
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Folder: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
};

// === HELPERS ===
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function getSectorColor(name) {
  return SECTOR_COLORS[name] || '#64748b';
}

function getSectorIcon(name) {
  return SECTOR_ICONS[name] || '📁';
}

// === MODAL DE CRIAR/EDITAR PROJETO ===
function ProjectModal({ project, sectorId, sectors, onClose, onSave }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [selectedSector, setSelectedSector] = useState(project?.sector_id || sectorId || '');
  const [color, setColor] = useState(project?.color || '');
  const [startDate, setStartDate] = useState(project?.start_date || '');
  const [dueDate, setDueDate] = useState(project?.due_date || '');
  const [saving, setSaving] = useState(false);

  const colors = ['', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !selectedSector) return;

    setSaving(true);
    try {
      await onSave({
        sector_id: selectedSector,
        name,
        description,
        color: color || null,
        start_date: startDate || null,
        due_date: dueDate || null,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ws-modal-overlay" onClick={onClose}>
      <div className="ws-modal" onClick={e => e.stopPropagation()}>
        <div className="ws-modal-header">
          <h2>{project ? 'Editar Projeto' : 'Novo Projeto'}</h2>
          <button className="ws-modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-modal-body">
            <div className="ws-form-group">
              <label>Setor *</label>
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {sectors.map(s => (
                  <option key={s.id} value={s.id}>
                    {getSectorIcon(s.name)} {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ws-form-group">
              <label>Nome do Projeto *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Melhoria de NPS Q1..."
                required
              />
            </div>
            <div className="ws-form-group">
              <label>Descricao</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descricao do projeto..."
                rows={3}
              />
            </div>
            <div className="ws-form-row">
              <div className="ws-form-group">
                <label>Data Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="ws-form-group">
                <label>Data Fim</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="ws-form-group">
              <label>Cor (opcional)</label>
              <div className="ws-color-picker">
                {colors.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`ws-color-option ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c || '#64748b' }}
                    onClick={() => setColor(c)}
                  >
                    {c === '' && 'Auto'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="ws-modal-footer">
            <button type="button" className="ws-btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="ws-btn-primary" disabled={saving || !name.trim() || !selectedSector}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// === COMPONENTE PRINCIPAL ===
export default function WorkspaceView() {
  const { user, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const isAdmin = hasFullAccess; // já é booleano no contexto

  const [sectors, setSectors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedSectorId, setSelectedSectorId] = useState(null);

  const [expandedSectors, setExpandedSectors] = useState({});

  // === FETCH DATA ===
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectorsRes, projRes] = await Promise.all([
        fetch(`${API_URL}/api/ind/sectors`, { credentials: 'include' }),
        fetch(`${API_URL}/api/workspace-projects`, { credentials: 'include' }),
      ]);

      if (!sectorsRes.ok || !projRes.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const sectorsData = await sectorsRes.json();
      const projData = await projRes.json();

      setSectors(sectorsData.data || []);
      setProjects(projData.data || []);

      // Expandir todos os setores por padrao
      const expanded = {};
      (sectorsData.data || []).forEach(s => {
        expanded[s.id] = true;
      });
      setExpandedSectors(expanded);
    } catch (err) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === HANDLERS ===
  const toggleSector = (sectorId) => {
    setExpandedSectors(prev => ({
      ...prev,
      [sectorId]: !prev[sectorId],
    }));
  };

  const handleSaveProject = async (data) => {
    const url = editingProject
      ? `${API_URL}/api/workspace-projects/${editingProject.id}`
      : `${API_URL}/api/workspace-projects`;
    const method = editingProject ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao salvar');
    }

    fetchData();
  };

  const handleDeleteProject = async (proj) => {
    if (!confirm(`Tem certeza que deseja excluir o projeto "${proj.name}"?\n\nTodas as tarefas serao excluidas.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/workspace-projects/${proj.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Erro ao excluir');
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao excluir projeto');
    }
  };

  const openProject = (projectId) => {
    navigate(`/workspace/project/${projectId}`);
  };

  // === RENDER ===
  if (loading) {
    return (
      <div className="ws-loading">
        <div className="ws-spinner" />
        <p>Carregando setores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ws-error">
        <p>Erro: {error}</p>
        <button onClick={fetchData} className="ws-btn-primary">
          <Icons.Refresh /> Tentar novamente
        </button>
      </div>
    );
  }

  // Agrupar projetos por setor
  const projectsBySector = {};
  projects.forEach(proj => {
    if (!projectsBySector[proj.sector_id]) {
      projectsBySector[proj.sector_id] = [];
    }
    projectsBySector[proj.sector_id].push(proj);
  });

  return (
    <div className="ws-container">
      {/* Header */}
      <div className="ws-header">
        <div className="ws-header-left">
          <h1>
            <Icons.Folder />
            Gestao de Tarefas
          </h1>
          <p>Organize projetos e tarefas por setor</p>
        </div>
        <div className="ws-header-actions">
          <button className="ws-btn-icon" onClick={fetchData} title="Atualizar">
            <Icons.Refresh />
          </button>
          {isAdmin && (
            <button
              className="ws-btn-primary"
              onClick={() => {
                setEditingProject(null);
                setSelectedSectorId(null);
                setShowProjectModal(true);
              }}
            >
              <Icons.Plus /> Novo Projeto
            </button>
          )}
        </div>
      </div>

      {/* Lista de Setores */}
      <div className="ws-list">
        {sectors.length === 0 ? (
          <div className="ws-empty">
            <Icons.Folder />
            <h3>Nenhum setor encontrado</h3>
            <p>Configure os setores na area de Configuracoes</p>
          </div>
        ) : (
          sectors.map(sector => {
            const sectorProjects = projectsBySector[sector.id] || [];
            const isExpanded = expandedSectors[sector.id];
            const sectorColor = getSectorColor(sector.name);
            const sectorIcon = getSectorIcon(sector.name);

            return (
              <div key={sector.id} className="ws-workspace-card">
                <div
                  className="ws-workspace-header"
                  onClick={() => toggleSector(sector.id)}
                  style={{ borderLeftColor: sectorColor }}
                >
                  <div className="ws-workspace-info">
                    <span className={`ws-chevron ${isExpanded ? 'expanded' : ''}`}>
                      <Icons.ChevronRight />
                    </span>
                    <span className="ws-workspace-icon">{sectorIcon}</span>
                    <div className="ws-workspace-text">
                      <h3>{sector.name}</h3>
                      {sector.description && <p>{sector.description}</p>}
                    </div>
                  </div>
                  <div className="ws-workspace-meta">
                    <span className="ws-project-count">
                      {sectorProjects.length} projeto{sectorProjects.length !== 1 ? 's' : ''}
                    </span>
                    {isAdmin && (
                      <div className="ws-workspace-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="ws-btn-icon-sm"
                          onClick={() => {
                            setEditingProject(null);
                            setSelectedSectorId(sector.id);
                            setShowProjectModal(true);
                          }}
                          title="Adicionar projeto"
                        >
                          <Icons.Plus />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="ws-projects-list">
                    {sectorProjects.length === 0 ? (
                      <div className="ws-no-projects">
                        <p>Nenhum projeto neste setor</p>
                        {isAdmin && (
                          <button
                            className="ws-btn-link"
                            onClick={() => {
                              setEditingProject(null);
                              setSelectedSectorId(sector.id);
                              setShowProjectModal(true);
                            }}
                          >
                            <Icons.Plus /> Criar primeiro projeto
                          </button>
                        )}
                      </div>
                    ) : (
                      sectorProjects.map(proj => (
                        <div
                          key={proj.id}
                          className="ws-project-card"
                          onClick={() => openProject(proj.id)}
                        >
                          <div
                            className="ws-project-color"
                            style={{ backgroundColor: proj.color || sectorColor }}
                          />
                          <div className="ws-project-info">
                            <h4>{proj.name}</h4>
                            {proj.description && <p>{proj.description}</p>}
                            <div className="ws-project-meta">
                              {proj.start_date && (
                                <span>
                                  <Icons.Calendar /> {formatDate(proj.start_date)}
                                </span>
                              )}
                              {proj.due_date && (
                                <span>
                                  ate {formatDate(proj.due_date)}
                                </span>
                              )}
                              <span className={`ws-project-status ws-status-${proj.status}`}>
                                {proj.status === 'ativo' ? 'Ativo' : proj.status === 'arquivado' ? 'Arquivado' : 'Pausado'}
                              </span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="ws-project-actions" onClick={e => e.stopPropagation()}>
                              <button
                                className="ws-btn-icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProject(proj);
                                  setSelectedSectorId(proj.sector_id);
                                  setShowProjectModal(true);
                                }}
                                title="Editar projeto"
                              >
                                <Icons.Edit />
                              </button>
                              <button
                                className="ws-btn-icon-sm ws-btn-danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(proj);
                                }}
                                title="Excluir projeto"
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Projeto */}
      {showProjectModal && (
        <ProjectModal
          project={editingProject}
          sectorId={selectedSectorId}
          sectors={sectors}
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
            setSelectedSectorId(null);
          }}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}

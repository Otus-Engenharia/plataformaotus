/**
 * WorkspaceView - Gestao de Tarefas por Setor
 *
 * Grid de setores com drawer lateral de projetos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './WorkspaceView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// Cores e icones por setor
const SECTOR_CONFIG = {
  'CS': { color: '#22c55e', icon: '🎯', gradient: 'linear-gradient(135deg, #22c55e20, #16a34a10)' },
  'Tecnologia': { color: '#3b82f6', icon: '💻', gradient: 'linear-gradient(135deg, #3b82f620, #2563eb10)' },
  'Marketing': { color: '#ec4899', icon: '📢', gradient: 'linear-gradient(135deg, #ec489920, #db277710)' },
  'Vendas': { color: '#f59e0b', icon: '💼', gradient: 'linear-gradient(135deg, #f59e0b20, #d9770610)' },
  'Gente & Gestão': { color: '#8b5cf6', icon: '👥', gradient: 'linear-gradient(135deg, #8b5cf620, #7c3aed10)' },
  'Administrativo & Financeiro': { color: '#6366f1', icon: '📊', gradient: 'linear-gradient(135deg, #6366f120, #4f46e510)' },
  'Operação': { color: '#06b6d4', icon: '⚙️', gradient: 'linear-gradient(135deg, #06b6d420, #0891b210)' },
};

const getSectorConfig = (name) => SECTOR_CONFIG[name] || {
  color: '#64748b',
  icon: '📁',
  gradient: 'linear-gradient(135deg, #64748b20, #47556910)'
};

// === ICONS ===
const Icons = {
  Folder: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
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
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
};

// === HELPERS ===
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// === MODAL DE CRIAR/EDITAR PROJETO ===
function ProjectModal({ project, sectorId, sectorName, onClose, onSave }) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [color, setColor] = useState(project?.color || '');
  const [startDate, setStartDate] = useState(project?.start_date || '');
  const [dueDate, setDueDate] = useState(project?.due_date || '');
  const [saving, setSaving] = useState(false);

  const colors = ['', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        sector_id: sectorId,
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

  const sectorConfig = getSectorConfig(sectorName);

  return (
    <div className="ws-modal-overlay">
      <div className="ws-modal">
        <div className="ws-modal-header">
          <h2>{project ? 'Editar Projeto' : 'Novo Projeto'}</h2>
          <button className="ws-modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ws-modal-body">
            <div className="ws-form-group">
              <label>Setor</label>
              <div className="ws-sector-display" style={{ borderColor: sectorConfig.color }}>
                <span className="ws-sector-icon">{sectorConfig.icon}</span>
                <span>{sectorName}</span>
              </div>
            </div>
            <div className="ws-form-group">
              <label>Nome do Projeto *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Sprint Q1, OKR Vendas..."
                required
                autoFocus
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
            <button type="submit" className="ws-btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// === SECTOR CARD ===
function SectorCard({ sector, projectCount, onClick }) {
  const config = getSectorConfig(sector.name);

  return (
    <div
      className="ws-sector-card"
      onClick={onClick}
      style={{ '--sector-color': config.color }}
    >
      <div className="ws-sector-card-bg" style={{ background: config.gradient }} />
      <div className="ws-sector-card-content">
        <div className="ws-sector-card-icon">{config.icon}</div>
        <h3 className="ws-sector-card-title">{sector.name}</h3>
        <div className="ws-sector-card-meta">
          <span className="ws-sector-card-count">
            {projectCount} projeto{projectCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="ws-sector-card-arrow">
          <Icons.ChevronRight />
        </div>
      </div>
      <div className="ws-sector-card-glow" style={{ background: config.color }} />
    </div>
  );
}

// === PROJECT DRAWER ===
function ProjectDrawer({
  open,
  sector,
  projects,
  loading,
  onClose,
  onProjectClick,
  onCreateProject,
  onEditProject,
  onDeleteProject,
  isAdmin
}) {
  if (!sector) return null;

  const config = getSectorConfig(sector.name);

  return (
    <>
      <div
        className={`ws-drawer-overlay ${open ? 'visible' : ''}`}
      />
      <div className={`ws-drawer ${open ? 'open' : ''}`}>
        <div className="ws-drawer-header" style={{ borderBottomColor: `${config.color}30` }}>
          <button className="ws-drawer-close" onClick={onClose}>
            <Icons.X />
          </button>
          <div className="ws-drawer-title">
            <span className="ws-drawer-icon">{config.icon}</span>
            <div>
              <h2>{sector.name}</h2>
              <span className="ws-drawer-subtitle">
                {projects.length} projeto{projects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {isAdmin && (
            <button className="ws-btn-primary ws-btn-sm" onClick={onCreateProject}>
              <Icons.Plus /> Novo
            </button>
          )}
        </div>

        <div className="ws-drawer-content">
          {loading ? (
            <div className="ws-drawer-loading">
              <div className="ws-spinner" />
              <p>Carregando projetos...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="ws-drawer-empty">
              <div className="ws-drawer-empty-icon">
                <Icons.Folder />
              </div>
              <h3>Nenhum projeto</h3>
              <p>Crie o primeiro projeto para este setor</p>
              {isAdmin && (
                <button className="ws-btn-primary" onClick={onCreateProject}>
                  <Icons.Plus /> Criar Projeto
                </button>
              )}
            </div>
          ) : (
            <div className="ws-drawer-projects">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="ws-project-item"
                  onClick={() => onProjectClick(project.id)}
                >
                  <div
                    className="ws-project-item-color"
                    style={{ backgroundColor: project.color || config.color }}
                  />
                  <div className="ws-project-item-content">
                    <h4>{project.name}</h4>
                    {project.description && (
                      <p className="ws-project-item-desc">{project.description}</p>
                    )}
                    <div className="ws-project-item-meta">
                      {project.start_date && (
                        <span>
                          <Icons.Calendar />
                          {formatDate(project.start_date)}
                        </span>
                      )}
                      {project.due_date && (
                        <span>ate {formatDate(project.due_date)}</span>
                      )}
                      <span className={`ws-status ws-status-${project.status}`}>
                        {project.status === 'ativo' ? 'Ativo' :
                         project.status === 'arquivado' ? 'Arquivado' : 'Pausado'}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="ws-project-item-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="ws-btn-icon-sm"
                        onClick={() => onEditProject(project)}
                        title="Editar"
                      >
                        <Icons.Edit />
                      </button>
                      <button
                        className="ws-btn-icon-sm ws-btn-danger"
                        onClick={() => onDeleteProject(project)}
                        title="Excluir"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  )}
                  <div className="ws-project-item-arrow">
                    <Icons.ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// === COMPONENTE PRINCIPAL ===
export default function WorkspaceView() {
  const navigate = useNavigate();
  const { hasFullAccess } = useAuth();
  const isAdmin = hasFullAccess;

  const [sectors, setSectors] = useState([]);
  const [projectCounts, setProjectCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Drawer state
  const [selectedSector, setSelectedSector] = useState(null);
  const [sectorProjects, setSectorProjects] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // === FETCH SECTORS ===
  const fetchSectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sectorsRes, projectsRes] = await Promise.all([
        fetch(`${API_URL}/api/ind/sectors`, { credentials: 'include' }),
        fetch(`${API_URL}/api/workspace-projects`, { credentials: 'include' }),
      ]);

      if (!sectorsRes.ok) throw new Error('Erro ao carregar setores');

      const sectorsData = await sectorsRes.json();
      const projectsData = projectsRes.ok ? await projectsRes.json() : { data: [] };

      // Filtrar Diretoria
      const filtered = (sectorsData.data || []).filter(s => s.name !== 'Diretoria');
      setSectors(filtered);

      // Contar projetos por setor
      const counts = {};
      (projectsData.data || []).forEach(p => {
        counts[p.sector_id] = (counts[p.sector_id] || 0) + 1;
      });
      setProjectCounts(counts);
    } catch (err) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // === FETCH SECTOR PROJECTS ===
  const fetchSectorProjects = useCallback(async (sectorId) => {
    setDrawerLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/workspace-projects?sector_id=${sectorId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSectorProjects(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  // Listener para abrir drawer via sidebar
  useEffect(() => {
    const handleOpenSectorDrawer = (e) => {
      const sector = e.detail;
      if (sector) {
        setSelectedSector(sector);
        setDrawerOpen(true);
        fetchSectorProjects(sector.id);
      }
    };

    window.addEventListener('openSectorDrawer', handleOpenSectorDrawer);
    return () => window.removeEventListener('openSectorDrawer', handleOpenSectorDrawer);
  }, [fetchSectorProjects]);

  // === HANDLERS ===
  const handleSectorClick = (sector) => {
    setSelectedSector(sector);
    setDrawerOpen(true);
    fetchSectorProjects(sector.id);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    // Delay para animacao terminar
    setTimeout(() => {
      setSelectedSector(null);
      setSectorProjects([]);
    }, 300);
  };

  const handleProjectClick = (projectId) => {
    navigate(`/workspace/project/${projectId}`);
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setShowProjectModal(true);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const handleDeleteProject = async (project) => {
    if (!confirm(`Excluir "${project.name}"?\n\nTodas as tarefas serao excluidas.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/workspace-projects/${project.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        fetchSectorProjects(selectedSector.id);
        fetchSectors(); // Atualizar contagem
      }
    } catch (err) {
      console.error('Erro ao excluir:', err);
      alert('Erro ao excluir projeto');
    }
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

    fetchSectorProjects(selectedSector.id);
    fetchSectors(); // Atualizar contagem
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
        <button onClick={fetchSectors} className="ws-btn-primary">
          <Icons.Refresh /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="ws-container">
      {/* Header */}
      <div className="ws-header">
        <div className="ws-header-content">
          <h1>
            <Icons.Users />
            Gestao por Setor
          </h1>
          <p>Selecione um setor para ver seus projetos e tarefas</p>
        </div>
        <div className="ws-header-actions">
          <button className="ws-btn-icon" onClick={fetchSectors} title="Atualizar">
            <Icons.Refresh />
          </button>
        </div>
      </div>

      {/* Sector Grid */}
      <div className="ws-sector-grid">
        {sectors.map(sector => (
          <SectorCard
            key={sector.id}
            sector={sector}
            projectCount={projectCounts[sector.id] || 0}
            onClick={() => handleSectorClick(sector)}
          />
        ))}
      </div>

      {/* Project Drawer */}
      <ProjectDrawer
        open={drawerOpen}
        sector={selectedSector}
        projects={sectorProjects}
        loading={drawerLoading}
        onClose={handleCloseDrawer}
        onProjectClick={handleProjectClick}
        onCreateProject={handleCreateProject}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        isAdmin={isAdmin}
      />

      {/* Project Modal */}
      {showProjectModal && selectedSector && (
        <ProjectModal
          project={editingProject}
          sectorId={selectedSector.id}
          sectorName={selectedSector.name}
          onClose={() => {
            setShowProjectModal(false);
            setEditingProject(null);
          }}
          onSave={handleSaveProject}
        />
      )}
    </div>
  );
}

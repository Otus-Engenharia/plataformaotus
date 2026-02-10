import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DemandaCard, { STATUS_CONFIG, CATEGORIA_CONFIG } from '../../components/apoio/DemandaCard';
import DemandaDetailDialog from '../../components/apoio/DemandaDetailDialog';
import DemandaCreateDialog from '../../components/apoio/DemandaCreateDialog';
import './DemandasKanbanView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const KANBAN_COLUMNS = [
  {
    id: 'pendentes',
    title: 'Pendentes',
    statuses: ['pendente'],
    dropStatus: 'pendente',
    color: '#f59e0b',
  },
  {
    id: 'em_analise',
    title: 'Em Analise',
    statuses: ['em_analise', 'aguardando_info'],
    dropStatus: 'em_analise',
    color: '#3b82f6',
  },
  {
    id: 'em_progresso',
    title: 'Em Progresso',
    statuses: ['em_progresso'],
    dropStatus: 'em_progresso',
    color: '#06b6d4',
  },
  {
    id: 'finalizados',
    title: 'Finalizados',
    statuses: ['finalizado'],
    dropStatus: 'finalizado',
    color: '#22c55e',
  },
  {
    id: 'recusados',
    title: 'Recusados',
    statuses: ['recusado'],
    dropStatus: 'recusado',
    color: '#6b7280',
  },
];

export default function DemandasKanbanView() {
  const { user, isPrivileged, canManageDemandas } = useAuth();
  const [demandas, setDemandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [selectedDemandaId, setSelectedDemandaId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const fetchDemandas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/demandas`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar demandas');
      setDemandas(data.data || []);
    } catch (err) {
      console.error('Erro ao carregar demandas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDemandas();
  }, [fetchDemandas]);

  const handleCreateDemanda = async (formData) => {
    const response = await fetch(`${API_URL}/api/demandas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao criar demanda');
    }

    fetchDemandas();
  };

  // Filtros
  let filteredDemandas = filter === 'minhas'
    ? demandas.filter(d => d.author_email === user?.email)
    : demandas;

  if (categoriaFilter) {
    filteredDemandas = filteredDemandas.filter(d => d.categoria === categoriaFilter);
  }

  const getColumnDemandas = (column) => {
    return filteredDemandas.filter(d => column.statuses.includes(d.status));
  };

  const isOwnDemanda = (demanda) => demanda.author_email === user?.email;

  const canDragDemanda = (demanda) => {
    return canManageDemandas || isOwnDemanda(demanda);
  };

  // --- Drag and Drop handlers ---
  const handleDragStart = (e, demanda) => {
    setDraggingId(demanda.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(demanda.id));
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e, columnId) => {
    // Only clear if actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverColumn === columnId) {
        setDragOverColumn(null);
      }
    }
  };

  const handleDrop = async (e, column) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingId(null);

    const demandaId = e.dataTransfer.getData('text/plain');
    if (!demandaId) return;

    const parsedId = parseInt(demandaId, 10);
    const demanda = demandas.find(d => d.id === parsedId);
    if (!demanda) return;

    // Don't do anything if dropping in same column
    if (column.statuses.includes(demanda.status)) return;

    const newStatus = column.dropStatus;

    // Optimistic update
    setDemandas(prev => prev.map(d =>
      d.id === parsedId ? { ...d, status: newStatus } : d
    ));

    try {
      const response = await fetch(`${API_URL}/api/demandas/${parsedId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status');
      }

      // Refresh to get accurate data
      fetchDemandas();
    } catch (err) {
      console.error('Erro ao mover demanda:', err);
      // Revert optimistic update
      fetchDemandas();
      alert(err.message);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const stats = {
    total: demandas.length,
    minhas: demandas.filter(d => d.author_email === user?.email).length,
  };

  if (loading) {
    return (
      <div className="dm-kanban">
        <div className="dm-kanban__loading">
          <div className="spinner"></div>
          <p>Carregando demandas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-kanban">
      {/* Toolbar */}
      <div className="dm-kanban__toolbar">
        <div className="dm-kanban__tabs">
          <button
            className={`dm-kanban__tab ${filter === 'todos' ? 'active' : ''}`}
            onClick={() => setFilter('todos')}
          >
            Todas
            <span className="dm-kanban__tab-count">{stats.total}</span>
          </button>
          <button
            className={`dm-kanban__tab ${filter === 'minhas' ? 'active' : ''}`}
            onClick={() => setFilter('minhas')}
          >
            Minhas Demandas
            <span className="dm-kanban__tab-count">{stats.minhas}</span>
          </button>
        </div>

        <select
          className="dm-kanban__category-filter"
          value={categoriaFilter}
          onChange={(e) => setCategoriaFilter(e.target.value)}
        >
          <option value="">Todas categorias</option>
          {Object.entries(CATEGORIA_CONFIG).map(([value, config]) => (
            <option key={value} value={value}>{config.icon} {config.label}</option>
          ))}
        </select>

        <div className="dm-kanban__actions">
          <button className="dm-kanban__refresh" onClick={fetchDemandas} title="Atualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button
            className="dm-kanban__create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova Demanda
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="dm-kanban__error">
          <p>{error}</p>
          <button onClick={fetchDemandas}>Tentar novamente</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="dm-kanban__board">
        {KANBAN_COLUMNS.map(column => {
          const columnDemandas = getColumnDemandas(column);
          const isDragOver = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              className={`dm-kanban__column ${isDragOver ? 'dm-kanban__column--drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column)}
            >
              <div
                className="dm-kanban__column-header"
                style={{ '--column-color': column.color }}
              >
                <h3>{column.title}</h3>
                <span className="dm-kanban__column-count">{columnDemandas.length}</span>
              </div>
              <div className="dm-kanban__column-content">
                {columnDemandas.length === 0 ? (
                  <div className="dm-kanban__empty">
                    {isDragOver ? 'Soltar aqui' : 'Nenhum item'}
                  </div>
                ) : (
                  columnDemandas.map(demanda => (
                    <DemandaCard
                      key={demanda.id}
                      demanda={demanda}
                      isOwn={isOwnDemanda(demanda)}
                      isDragging={draggingId === demanda.id}
                      draggable={canDragDemanda(demanda)}
                      onDragStart={(e) => handleDragStart(e, demanda)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedDemandaId(demanda.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      {selectedDemandaId && (
        <DemandaDetailDialog
          demandaId={selectedDemandaId}
          isPrivileged={isPrivileged}
          canManageDemandas={canManageDemandas}
          currentUserEmail={user?.email}
          currentUserId={user?.id}
          onUpdate={fetchDemandas}
          onClose={() => setSelectedDemandaId(null)}
        />
      )}

      {/* Create Dialog */}
      {showCreateForm && (
        <DemandaCreateDialog
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateDemanda}
        />
      )}
    </div>
  );
}

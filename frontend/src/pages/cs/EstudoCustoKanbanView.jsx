import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EstudoCustoCard, { STATUS_CONFIG } from '../../components/cs/EstudoCustoCard';
import EstudoCustoDetailDialog from '../../components/cs/EstudoCustoDetailDialog';
import EstudoCustoCreateDialog from '../../components/cs/EstudoCustoCreateDialog';
import './EstudoCustoKanbanView.css';

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

export default function EstudoCustoKanbanView() {
  const { user, isPrivileged, canManageEstudosCustos } = useAuth();
  const [estudos, setEstudos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [selectedEstudoId, setSelectedEstudoId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Drag and drop state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const fetchEstudos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/estudos-custos`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar solicitacoes');
      setEstudos(data.data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitacoes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstudos();
  }, [fetchEstudos]);

  const handleCreateEstudo = async (formData) => {
    const response = await fetch(`${API_URL}/api/estudos-custos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao criar solicitacao');
    }

    fetchEstudos();
  };

  // Filtros
  const filteredEstudos = filter === 'minhas'
    ? estudos.filter(e => e.author_email === user?.email)
    : estudos;

  const getColumnEstudos = (column) => {
    return filteredEstudos.filter(e => column.statuses.includes(e.status));
  };

  const isOwnEstudo = (estudo) => estudo.author_email === user?.email;

  const canDragEstudo = (estudo) => {
    return canManageEstudosCustos || isOwnEstudo(estudo);
  };

  // --- Drag and Drop handlers ---
  const handleDragStart = (e, estudo) => {
    setDraggingId(estudo.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(estudo.id));
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e, columnId) => {
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

    const estudoId = e.dataTransfer.getData('text/plain');
    if (!estudoId) return;

    const parsedId = parseInt(estudoId, 10);
    const estudo = estudos.find(e => e.id === parsedId);
    if (!estudo) return;

    // Don't do anything if dropping in same column
    if (column.statuses.includes(estudo.status)) return;

    const newStatus = column.dropStatus;

    // Optimistic update
    setEstudos(prev => prev.map(e =>
      e.id === parsedId ? { ...e, status: newStatus } : e
    ));

    try {
      const response = await fetch(`${API_URL}/api/estudos-custos/${parsedId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status');
      }

      fetchEstudos();
    } catch (err) {
      console.error('Erro ao mover solicitacao:', err);
      fetchEstudos();
      alert(err.message);
    }
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const stats = {
    total: estudos.length,
    minhas: estudos.filter(e => e.author_email === user?.email).length,
  };

  if (loading) {
    return (
      <div className="ec-kanban">
        <div className="ec-kanban__loading">
          <div className="spinner"></div>
          <p>Carregando solicitacoes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-kanban">
      {/* Toolbar */}
      <div className="ec-kanban__toolbar">
        <div className="ec-kanban__tabs">
          <button
            className={`ec-kanban__tab ${filter === 'todos' ? 'active' : ''}`}
            onClick={() => setFilter('todos')}
          >
            Todas
            <span className="ec-kanban__tab-count">{stats.total}</span>
          </button>
          <button
            className={`ec-kanban__tab ${filter === 'minhas' ? 'active' : ''}`}
            onClick={() => setFilter('minhas')}
          >
            Minhas Solicitacoes
            <span className="ec-kanban__tab-count">{stats.minhas}</span>
          </button>
        </div>

        <div className="ec-kanban__actions">
          <button className="ec-kanban__refresh" onClick={fetchEstudos} title="Atualizar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
          <button
            className="ec-kanban__create-btn"
            onClick={() => setShowCreateForm(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova Solicitacao
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="ec-kanban__error">
          <p>{error}</p>
          <button onClick={fetchEstudos}>Tentar novamente</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="ec-kanban__board">
        {KANBAN_COLUMNS.map(column => {
          const columnEstudos = getColumnEstudos(column);
          const isDragOver = dragOverColumn === column.id;
          return (
            <div
              key={column.id}
              className={`ec-kanban__column ${isDragOver ? 'ec-kanban__column--drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDrop={(e) => handleDrop(e, column)}
            >
              <div
                className="ec-kanban__column-header"
                style={{ '--column-color': column.color }}
              >
                <h3>{column.title}</h3>
                <span className="ec-kanban__column-count">{columnEstudos.length}</span>
              </div>
              <div className="ec-kanban__column-content">
                {columnEstudos.length === 0 ? (
                  <div className="ec-kanban__empty">
                    {isDragOver ? 'Soltar aqui' : 'Nenhum item'}
                  </div>
                ) : (
                  columnEstudos.map(estudo => (
                    <EstudoCustoCard
                      key={estudo.id}
                      estudo={estudo}
                      isOwn={isOwnEstudo(estudo)}
                      isDragging={draggingId === estudo.id}
                      draggable={canDragEstudo(estudo)}
                      onDragStart={(e) => handleDragStart(e, estudo)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedEstudoId(estudo.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      {selectedEstudoId && (
        <EstudoCustoDetailDialog
          estudoCustoId={selectedEstudoId}
          isPrivileged={isPrivileged}
          canManageEstudosCustos={canManageEstudosCustos}
          currentUserEmail={user?.email}
          currentUserId={user?.id}
          onUpdate={fetchEstudos}
          onClose={() => setSelectedEstudoId(null)}
        />
      )}

      {/* Create Dialog */}
      {showCreateForm && (
        <EstudoCustoCreateDialog
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateEstudo}
        />
      )}
    </div>
  );
}

/**
 * ProjectView - Visualizacao de um projeto com tarefas
 *
 * Abas: Lista, Kanban, Gantt, Chat
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import './ProjectView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

// === STATUS E PRIORIDADE ===
const STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#64748b' },
  a_fazer: { label: 'A Fazer', color: '#f59e0b' },
  em_progresso: { label: 'Em Progresso', color: '#3b82f6' },
  em_revisao: { label: 'Em Revisao', color: '#8b5cf6' },
  concluido: { label: 'Concluido', color: '#22c55e' },
  cancelado: { label: 'Cancelado', color: '#ef4444' },
};

const PRIORITY_CONFIG = {
  baixa: { label: 'Baixa', color: '#64748b' },
  media: { label: 'Media', color: '#f59e0b' },
  alta: { label: 'Alta', color: '#ef4444' },
  urgente: { label: 'Urgente', color: '#dc2626' },
};

const KANBAN_COLUMNS = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'a_fazer', label: 'A Fazer' },
  { status: 'em_progresso', label: 'Em Progresso' },
  { status: 'em_revisao', label: 'Em Revisao' },
  { status: 'concluido', label: 'Concluido' },
];

// === ICONS ===
const Icons = {
  ArrowLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  List: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  Kanban: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="12" rx="1"/>
      <rect x="17" y="3" width="5" height="8" rx="1"/>
    </svg>
  ),
  BarChart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  MessageCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
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
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
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
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Send: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
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
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9"/>
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
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// === TASK CARD COMPONENT ===
function TaskCard({ task, onClick, onDragStart, onDragEnd, isDragging }) {
  return (
    <div
      className={`pv-task-card ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(task)}
    >
      <div className="pv-task-header">
        <span
          className="pv-task-priority"
          style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color || '#64748b' }}
        />
        <span className="pv-task-title">{task.title}</span>
      </div>
      {task.description && (
        <p className="pv-task-description">{task.description}</p>
      )}
      <div className="pv-task-footer">
        {task.due_date && (
          <span className="pv-task-due">
            <Icons.Calendar />
            {formatDate(task.due_date)}
          </span>
        )}
        {task.assignee && (
          <span className="pv-task-assignee" title={task.assignee.name}>
            {task.assignee.avatar_url ? (
              <img src={task.assignee.avatar_url} alt="" />
            ) : (
              <span className="pv-avatar-fallback">{getInitials(task.assignee.name)}</span>
            )}
          </span>
        )}
        {task.subtasks?.length > 0 && (
          <span className="pv-task-subtasks">
            {task.subtasks.filter(s => s.status === 'concluido').length}/{task.subtasks.length}
          </span>
        )}
      </div>
    </div>
  );
}

// === TASK MODAL ===
function TaskModal({ task, projectId, users, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'a_fazer');
  const [priority, setPriority] = useState(task?.priority || 'media');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id || '');
  const [startDate, setStartDate] = useState(task?.start_date || '');
  const [dueDate, setDueDate] = useState(task?.due_date || '');
  const [tags, setTags] = useState(task?.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onSave({
        project_id: projectId,
        title,
        description,
        status,
        priority,
        assignee_id: assigneeId || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pv-modal-overlay" onClick={onClose}>
      <div className="pv-modal pv-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="pv-modal-header">
          <h2>{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
          <button className="pv-modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="pv-modal-body">
            <div className="pv-form-group">
              <label>Titulo *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="O que precisa ser feito?"
                required
                autoFocus
              />
            </div>
            <div className="pv-form-group">
              <label>Descricao</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Detalhes da tarefa..."
                rows={4}
              />
            </div>
            <div className="pv-form-row pv-form-row-3">
              <div className="pv-form-group">
                <label>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="pv-form-group">
                <label>Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="pv-form-group">
                <label>Responsavel</label>
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                  <option value="">Ninguem</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="pv-form-row">
              <div className="pv-form-group">
                <label>Data Inicio</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className="pv-form-group">
                <label>Data Fim</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="pv-form-group">
              <label>Tags (separadas por virgula)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="Ex: urgente, cliente, bug"
              />
            </div>
          </div>
          <div className="pv-modal-footer">
            {task && onDelete && (
              <button
                type="button"
                className="pv-btn-danger"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
              >
                <Icons.Trash /> Excluir
              </button>
            )}
            <div className="pv-modal-footer-right">
              <button type="button" className="pv-btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="pv-btn-primary" disabled={saving || !title.trim()}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// === KANBAN VIEW ===
function KanbanView({ tasks, users, onTaskClick, onCreateTask, onUpdateTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) return;

    await onUpdateTask(draggedTask.id, { status: newStatus });
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  return (
    <div className="pv-kanban">
      {KANBAN_COLUMNS.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.status);
        const statusCfg = STATUS_CONFIG[col.status];

        return (
          <div
            key={col.status}
            className={`pv-kanban-column ${dragOverColumn === col.status ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div className="pv-kanban-header" style={{ borderTopColor: statusCfg.color }}>
              <span className="pv-kanban-title">
                <span className="pv-kanban-dot" style={{ backgroundColor: statusCfg.color }} />
                {col.label}
              </span>
              <span className="pv-kanban-count">{columnTasks.length}</span>
            </div>
            <div className="pv-kanban-cards">
              {columnTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={onTaskClick}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedTask?.id === task.id}
                />
              ))}
              <button
                className="pv-add-task-btn"
                onClick={() => onCreateTask(col.status)}
              >
                <Icons.Plus /> Adicionar tarefa
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// === LIST VIEW ===
function ListView({ tasks, users, onTaskClick, onCreateTask, onUpdateTask }) {
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'assignee') {
        aVal = a.assignee?.name || '';
        bVal = b.assignee?.name || '';
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="pv-list">
      <div className="pv-list-header">
        <button className="pv-list-col pv-col-title" onClick={() => toggleSort('title')}>
          Tarefa {sortField === 'title' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
        <button className="pv-list-col pv-col-status" onClick={() => toggleSort('status')}>
          Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
        <button className="pv-list-col pv-col-priority" onClick={() => toggleSort('priority')}>
          Prioridade {sortField === 'priority' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
        <button className="pv-list-col pv-col-assignee" onClick={() => toggleSort('assignee')}>
          Responsavel {sortField === 'assignee' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
        <button className="pv-list-col pv-col-due" onClick={() => toggleSort('due_date')}>
          Prazo {sortField === 'due_date' && (sortDir === 'asc' ? '↑' : '↓')}
        </button>
      </div>
      <div className="pv-list-body">
        {sortedTasks.map(task => (
          <div key={task.id} className="pv-list-row" onClick={() => onTaskClick(task)}>
            <div className="pv-list-col pv-col-title">
              <span
                className="pv-task-priority-dot"
                style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }}
              />
              <span className="pv-task-title">{task.title}</span>
            </div>
            <div className="pv-list-col pv-col-status">
              <span
                className="pv-status-badge"
                style={{ backgroundColor: `${STATUS_CONFIG[task.status]?.color}20`, color: STATUS_CONFIG[task.status]?.color }}
              >
                {STATUS_CONFIG[task.status]?.label}
              </span>
            </div>
            <div className="pv-list-col pv-col-priority">
              <span
                className="pv-priority-badge"
                style={{ backgroundColor: `${PRIORITY_CONFIG[task.priority]?.color}20`, color: PRIORITY_CONFIG[task.priority]?.color }}
              >
                {PRIORITY_CONFIG[task.priority]?.label}
              </span>
            </div>
            <div className="pv-list-col pv-col-assignee">
              {task.assignee ? (
                <span className="pv-assignee-name">
                  {task.assignee.avatar_url ? (
                    <img src={task.assignee.avatar_url} alt="" />
                  ) : (
                    <span className="pv-avatar-fallback-sm">{getInitials(task.assignee.name)}</span>
                  )}
                  {task.assignee.name}
                </span>
              ) : (
                <span className="pv-no-assignee">-</span>
              )}
            </div>
            <div className="pv-list-col pv-col-due">
              {task.due_date ? formatDate(task.due_date) : '-'}
            </div>
          </div>
        ))}
      </div>
      <button className="pv-add-task-row" onClick={() => onCreateTask('a_fazer')}>
        <Icons.Plus /> Adicionar tarefa
      </button>
    </div>
  );
}

// === GANTT VIEW (Placeholder) ===
function GanttView({ tasks }) {
  return (
    <div className="pv-gantt-placeholder">
      <Icons.BarChart />
      <h3>Gantt Chart</h3>
      <p>Visualizacao de timeline em desenvolvimento.</p>
      <p>{tasks.length} tarefas no projeto.</p>
    </div>
  );
}

// === CHAT VIEW ===
function ChatView({ projectId, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/workspace-projects/${projectId}/messages?limit=100`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Realtime
  useEffect(() => {
    let channel;
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        channel = supabase
          .channel(`project-${projectId}-messages`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'project_messages',
            filter: `project_id=eq.${projectId}`,
          }, (payload) => {
            setMessages(prev => [...prev, payload.new]);
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('Realtime nao disponivel:', err);
    }

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [projectId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/workspace-projects/${projectId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        setNewMessage('');
        // Mensagem sera adicionada via realtime, mas fazer fetch manual como fallback
        setTimeout(fetchMessages, 500);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="pv-chat-loading">
        <div className="pv-spinner" />
        <p>Carregando mensagens...</p>
      </div>
    );
  }

  return (
    <div className="pv-chat">
      <div className="pv-chat-messages">
        {messages.length === 0 ? (
          <div className="pv-chat-empty">
            <Icons.MessageCircle />
            <p>Nenhuma mensagem ainda. Comece a conversa!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === user?.id;
            return (
              <div key={msg.id} className={`pv-message ${isMe ? 'pv-message-me' : ''}`}>
                {!isMe && (
                  <span className="pv-message-avatar">
                    {msg.user?.avatar_url ? (
                      <img src={msg.user.avatar_url} alt="" />
                    ) : (
                      <span>{getInitials(msg.user?.name)}</span>
                    )}
                  </span>
                )}
                <div className="pv-message-content">
                  {!isMe && <span className="pv-message-author">{msg.user?.name}</span>}
                  <p>{msg.content}</p>
                  <span className="pv-message-time">{formatDateTime(msg.created_at)}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="pv-chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Digite uma mensagem..."
          disabled={sending}
        />
        <button type="submit" disabled={!newMessage.trim() || sending}>
          <Icons.Send />
        </button>
      </form>
    </div>
  );
}

// === COMPONENTE PRINCIPAL ===
export default function ProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('kanban');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTaskStatus, setNewTaskStatus] = useState('a_fazer');

  // === FETCH DATA ===
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, tasksRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/workspace-projects/${projectId}`, { credentials: 'include' }),
        fetch(`${API_URL}/api/workspace-tasks?project_id=${projectId}`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/people`, { credentials: 'include' }).catch(() => ({ ok: false })),
      ]);

      if (!projRes.ok) throw new Error('Projeto nao encontrado');
      if (!tasksRes.ok) throw new Error('Erro ao carregar tarefas');

      const projData = await projRes.json();
      const tasksData = await tasksRes.json();

      setProject(projData.data);
      setTasks(tasksData.data || []);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.data || []);
      }
    } catch (err) {
      console.error('Erro:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === HANDLERS ===
  const handleSaveTask = async (data) => {
    const url = editingTask
      ? `${API_URL}/api/workspace-tasks/${editingTask.id}`
      : `${API_URL}/api/workspace-tasks`;
    const method = editingTask ? 'PUT' : 'POST';

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

  const handleUpdateTask = async (taskId, data) => {
    try {
      const res = await fetch(`${API_URL}/api/workspace-tasks/${taskId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error('Erro ao atualizar');
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const res = await fetch(`${API_URL}/api/workspace-tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Erro ao excluir');
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const openTaskModal = (task = null) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const openCreateTask = (status = 'a_fazer') => {
    setEditingTask(null);
    setNewTaskStatus(status);
    setShowTaskModal(true);
  };

  // === RENDER ===
  if (loading) {
    return (
      <div className="pv-loading">
        <div className="pv-spinner" />
        <p>Carregando projeto...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pv-error">
        <p>Erro: {error}</p>
        <button onClick={() => navigate('/workspace')} className="pv-btn-primary">
          <Icons.ArrowLeft /> Voltar
        </button>
      </div>
    );
  }

  if (!project) return null;

  const tabs = [
    { id: 'kanban', label: 'Kanban', icon: <Icons.Kanban /> },
    { id: 'list', label: 'Lista', icon: <Icons.List /> },
    { id: 'gantt', label: 'Gantt', icon: <Icons.BarChart /> },
    { id: 'chat', label: 'Chat', icon: <Icons.MessageCircle /> },
  ];

  return (
    <div className="pv-container">
      {/* Header */}
      <div className="pv-header">
        <div className="pv-header-left">
          <button className="pv-back-btn" onClick={() => navigate('/workspace')}>
            <Icons.ArrowLeft />
          </button>
          <div className="pv-project-info">
            <div className="pv-project-breadcrumb">
              <span>{project.workspace?.icon} {project.workspace?.name}</span>
              <span>/</span>
            </div>
            <h1>{project.name}</h1>
            {project.description && <p>{project.description}</p>}
          </div>
        </div>
        <div className="pv-header-actions">
          <button className="pv-btn-icon" onClick={fetchData} title="Atualizar">
            <Icons.Refresh />
          </button>
          <button className="pv-btn-icon" title="Membros">
            <Icons.Users />
          </button>
          <button className="pv-btn-primary" onClick={() => openCreateTask()}>
            <Icons.Plus /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="pv-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`pv-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pv-content">
        {activeTab === 'kanban' && (
          <KanbanView
            tasks={tasks}
            users={users}
            onTaskClick={openTaskModal}
            onCreateTask={openCreateTask}
            onUpdateTask={handleUpdateTask}
          />
        )}
        {activeTab === 'list' && (
          <ListView
            tasks={tasks}
            users={users}
            onTaskClick={openTaskModal}
            onCreateTask={openCreateTask}
            onUpdateTask={handleUpdateTask}
          />
        )}
        {activeTab === 'gantt' && (
          <GanttView tasks={tasks} />
        )}
        {activeTab === 'chat' && (
          <ChatView projectId={projectId} user={user} />
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          projectId={projectId}
          users={users}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={editingTask ? handleDeleteTask : null}
        />
      )}
    </div>
  );
}

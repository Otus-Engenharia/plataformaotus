import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import './VincularParcelaDialog.css';

export default function VincularParcelaDialog({ open, onClose, onVincular, parcela, smartsheetId, projectName }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || (!smartsheetId && !projectName)) return;
    setLoading(true);
    setSelectedTask(null);
    setSearch('');

    const params = new URLSearchParams();
    if (smartsheetId) params.set('smartsheetId', smartsheetId);
    if (projectName) params.set('projectName', projectName);

    axios.get(`/api/projetos/cronograma?${params.toString()}`)
      .then(({ data }) => {
        if (data.success) {
          // Filter Level 5 tasks only
          const level5 = (data.data || []).filter(t => t.Level === 5 || t.Level === '5');
          setTasks(level5);
        }
      })
      .catch(err => console.error('Erro ao buscar tarefas:', err))
      .finally(() => setLoading(false));
  }, [open, smartsheetId, projectName]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const term = search.toLowerCase();
    return tasks.filter(t =>
      (t.NomeDaTarefa || '').toLowerCase().includes(term) ||
      (t.Status || '').toLowerCase().includes(term)
    );
  }, [tasks, search]);

  if (!open) return null;

  const handleVincular = async () => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      await onVincular({
        smartsheet_row_id: selectedTask.rowId,
        smartsheet_task_name: selectedTask.NomeDaTarefa,
        smartsheet_data_termino: selectedTask.DataDeTermino || null,
      });
      onClose();
    } catch (err) {
      console.error('Erro ao vincular:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  return (
    <div className="vincular-dialog-overlay" onClick={onClose}>
      <div className="vincular-dialog" onClick={e => e.stopPropagation()}>
        <div className="vincular-dialog-header">
          <div>
            <h3>Vincular Parcela ao Cronograma</h3>
            {parcela && <p className="vincular-subtitle">Parcela {parcela.parcela_numero} - {parcela.descricao || projectName}</p>}
          </div>
          <button className="vincular-dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="vincular-dialog-search">
          <input
            type="text"
            placeholder="Buscar tarefa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="vincular-dialog-body">
          {loading && <div className="vincular-loading">Carregando tarefas do cronograma...</div>}
          {!loading && filteredTasks.length === 0 && (
            <div className="vincular-empty">
              {tasks.length === 0 ? 'Nenhuma tarefa nivel 5 encontrada' : 'Nenhuma tarefa corresponde a busca'}
            </div>
          )}
          {!loading && filteredTasks.map(task => (
            <div
              key={task.rowId}
              className={`vincular-task-item ${selectedTask?.rowId === task.rowId ? 'vincular-task-selected' : ''}`}
              onClick={() => setSelectedTask(task)}
            >
              <div className="vincular-task-name">{task.NomeDaTarefa}</div>
              <div className="vincular-task-meta">
                <span>Termino: {formatDate(task.DataDeTermino)}</span>
                {task.Status && <span>Status: {task.Status}</span>}
                {task.LiberaPagamento && <span className="vincular-task-payment">Libera Pagamento</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="vincular-dialog-actions">
          <button className="parcela-btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="parcela-btn-primary"
            onClick={handleVincular}
            disabled={!selectedTask || saving}
          >
            {saving ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      </div>
    </div>
  );
}

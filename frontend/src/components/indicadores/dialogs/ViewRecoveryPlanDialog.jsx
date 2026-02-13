import React, { useState } from 'react';
import './Dialogs.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', color: '#f59e0b' },
  { value: 'em_andamento', label: 'Em andamento', color: '#3b82f6' },
  { value: 'concluido', label: 'Concluído', color: '#22c55e' },
  { value: 'cancelado', label: 'Cancelado', color: '#ef4444' }
];

export default function ViewRecoveryPlanDialog({
  plan,
  responsaveis = [],
  onUpdate,
  onAddActivity,
  onToggleActivity,
  onDeleteActivity,
  onClose
}) {
  const [status, setStatus] = useState(plan?.status || 'pendente');
  const [newActivity, setNewActivity] = useState('');
  const [newActivityResponsavel, setNewActivityResponsavel] = useState('');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    if (onUpdate) {
      setLoading(true);
      try {
        await onUpdate({ status: newStatus });
      } catch (err) {
        alert(err.message);
        setStatus(plan?.status || 'pendente');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.trim()) return;

    if (onAddActivity) {
      setLoading(true);
      try {
        await onAddActivity({
          descricao: newActivity.trim(),
          responsavel: newActivityResponsavel.trim() || null,
          concluida: false
        });
        setNewActivity('');
        setNewActivityResponsavel('');
        setShowAddActivity(false);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleToggleActivity = async (activityIndex, concluida) => {
    if (onToggleActivity) {
      try {
        await onToggleActivity(activityIndex, concluida);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDeleteActivity = async (activityIndex) => {
    if (onDeleteActivity) {
      setDeletingIndex(activityIndex);
      try {
        await onDeleteActivity(activityIndex);
      } catch (err) {
        alert(err.message);
      } finally {
        setDeletingIndex(null);
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (statusValue) => {
    const opt = STATUS_OPTIONS.find(s => s.value === statusValue);
    return opt?.color || '#737373';
  };

  // Parse acoes - pode ser JSON string, texto simples ou array
  const parseAcoes = (acoes) => {
    if (!acoes) return [];
    if (Array.isArray(acoes)) return acoes;
    if (typeof acoes === 'string') {
      // Tenta parsear como JSON primeiro
      try {
        const parsed = JSON.parse(acoes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Se não for JSON válido, converte texto simples para array
        return acoes.split('\n').filter(a => a.trim()).map(a => ({
          descricao: a.trim(),
          concluida: false
        }));
      }
    }
    return [];
  };

  const actions = parseAcoes(plan?.acoes);

  const completedCount = actions.filter(a => a.concluida).length;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content dialog-large glass-card">
        <div className="dialog-header">
          <div className="plan-header-info">
            <div className="plan-reference">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              <span>Referente a {MONTH_NAMES[(plan?.mes_referencia || 1) - 1]} {plan?.ano_referencia || new Date().getFullYear()}</span>
            </div>
            <div className="plan-status-row">
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="plan-status-select"
                style={{ borderColor: getStatusColor(status) }}
                disabled={loading}
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {plan?.prazo && (
                <span className="plan-prazo">
                  Prazo: {formatDate(plan.prazo)}
                </span>
              )}
            </div>
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="dialog-form">
          {/* Descrição */}
          <div className="plan-description-section">
            <p className="plan-description">{plan?.descricao || 'Sem descrição'}</p>
          </div>

          {/* Atividades */}
          <div className="plan-activities-section">
            <div className="form-section-header">
              <h4>Atividades ({completedCount}/{actions.length})</h4>
              <button
                type="button"
                className="btn-small"
                onClick={() => setShowAddActivity(true)}
              >
                + Atividade
              </button>
            </div>

            {showAddActivity && (
              <div className="add-activity-form">
                <div className="add-activity-row">
                  <input
                    type="text"
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    placeholder="Descreva a nova atividade..."
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-icon-small"
                    onClick={() => {
                      setShowAddActivity(false);
                      setNewActivity('');
                      setNewActivityResponsavel('');
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
                <div className="add-activity-row add-activity-row--secondary">
                  {responsaveis.length > 0 ? (
                    <select
                      value={newActivityResponsavel}
                      onChange={(e) => setNewActivityResponsavel(e.target.value)}
                      className="add-activity-select"
                    >
                      <option value="">Responsável (opcional)</option>
                      {responsaveis.map(r => (
                        <option key={r.email || r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newActivityResponsavel}
                      onChange={(e) => setNewActivityResponsavel(e.target.value)}
                      placeholder="Responsável (opcional)"
                    />
                  )}
                  <button
                    type="button"
                    className="btn-small"
                    onClick={handleAddActivity}
                    disabled={loading || !newActivity.trim()}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            <div className="activities-list">
              {actions.length === 0 ? (
                <p className="empty-activities">Nenhuma atividade cadastrada</p>
              ) : (
                actions.map((activity, index) => (
                  <div
                    key={index}
                    className={`activity-item ${activity.concluida ? 'activity-completed' : ''}`}
                  >
                    <label className="activity-checkbox">
                      <input
                        type="checkbox"
                        checked={activity.concluida || false}
                        onChange={(e) => handleToggleActivity(index, e.target.checked)}
                      />
                      <span className="activity-checkmark"></span>
                    </label>
                    <div className="activity-content">
                      <span className="activity-text">{activity.descricao}</span>
                      {activity.prazo && (
                        <span className="activity-meta">
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                          </svg>
                          {formatDate(activity.prazo)}
                        </span>
                      )}
                      {activity.responsavel && (
                        <span className="activity-meta">
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                          {activity.responsavel}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-icon-small btn-danger"
                      title="Remover atividade"
                      onClick={() => handleDeleteActivity(index)}
                      disabled={deletingIndex === index}
                    >
                      {deletingIndex === index ? (
                        <span className="btn-spinner"></span>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Metadados */}
          {plan?.created_by && (
            <div className="plan-meta">
              <span>Criado por {plan.created_by}</span>
              {plan.created_at && (
                <span> em {formatDate(plan.created_at)}</span>
              )}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

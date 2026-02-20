import React, { useState, useRef, useEffect } from 'react';
import './Dialogs.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  { value: 'em_andamento', label: 'Em andamento', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  { value: 'concluido', label: 'Concluído', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  { value: 'cancelado', label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
];

export default function ViewRecoveryPlanDialog({
  plan,
  responsaveis = [],
  onUpdate,
  onAddActivity,
  onToggleActivity,
  onDeleteActivity,
  onEditActivity,
  onDelete,
  onClose
}) {
  const [status, setStatus] = useState(plan?.status || 'pendente');
  const [newActivity, setNewActivity] = useState('');
  const [newActivityResponsavel, setNewActivityResponsavel] = useState('');
  const [newActivityPrazo, setNewActivityPrazo] = useState('');
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState(null);

  // Edit states
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState(plan?.descricao || '');
  const [editingPrazo, setEditingPrazo] = useState(false);
  const [editPrazoValue, setEditPrazoValue] = useState(plan?.prazo ? plan.prazo.split('T')[0] : '');
  const [editingActivityIndex, setEditingActivityIndex] = useState(null);
  const [editActivityValue, setEditActivityValue] = useState('');
  const [editActivityPrazo, setEditActivityPrazo] = useState('');
  const [editActivityResponsavel, setEditActivityResponsavel] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const descriptionRef = useRef(null);
  const editActivityRef = useRef(null);

  useEffect(() => {
    if (editingDescription && descriptionRef.current) {
      descriptionRef.current.focus();
      descriptionRef.current.setSelectionRange(
        descriptionRef.current.value.length,
        descriptionRef.current.value.length
      );
    }
  }, [editingDescription]);

  useEffect(() => {
    if (editingActivityIndex !== null && editActivityRef.current) {
      editActivityRef.current.focus();
    }
  }, [editingActivityIndex]);

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

  const handleSaveDescription = async () => {
    if (!editDescriptionValue.trim()) return;
    if (onUpdate) {
      setLoading(true);
      try {
        await onUpdate({ descricao: editDescriptionValue.trim() });
        setEditingDescription(false);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSavePrazo = async () => {
    if (onUpdate) {
      setLoading(true);
      try {
        await onUpdate({ prazo: editPrazoValue || null });
        setEditingPrazo(false);
      } catch (err) {
        alert(err.message);
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
          prazo: newActivityPrazo || null,
          concluida: false
        });
        setNewActivity('');
        setNewActivityResponsavel('');
        setNewActivityPrazo('');
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

  const startEditActivity = (index, activity) => {
    setEditingActivityIndex(index);
    setEditActivityValue(activity.descricao || '');
    setEditActivityPrazo(activity.prazo ? activity.prazo.split('T')[0] : '');
    setEditActivityResponsavel(activity.responsavel || '');
  };

  const handleSaveActivity = async () => {
    if (editingActivityIndex === null || !editActivityValue.trim()) return;
    if (onEditActivity) {
      setLoading(true);
      try {
        await onEditActivity(editingActivityIndex, {
          descricao: editActivityValue.trim(),
          prazo: editActivityPrazo || null,
          responsavel: editActivityResponsavel.trim() || null,
        });
        setEditingActivityIndex(null);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeletePlan = async () => {
    if (onDelete) {
      setDeleting(true);
      try {
        await onDelete();
      } catch (err) {
        alert(err.message);
        setDeleting(false);
        setShowDeleteConfirm(false);
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusConfig = (statusValue) => {
    return STATUS_OPTIONS.find(s => s.value === statusValue) || STATUS_OPTIONS[0];
  };

  const parseAcoes = (acoes) => {
    if (!acoes) return [];
    if (Array.isArray(acoes)) return acoes;
    if (typeof acoes === 'string') {
      try {
        const parsed = JSON.parse(acoes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
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
  const statusCfg = getStatusConfig(status);
  const progressPercent = actions.length > 0 ? Math.round((completedCount / actions.length) * 100) : 0;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content dialog-large glass-card vrp-dialog">
        {/* Header */}
        <div className="vrp-header">
          <div className="vrp-header__left">
            <div className="vrp-reference-badge">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              <span>{MONTH_NAMES[(plan?.mes_referencia || 1) - 1]} {plan?.ano_referencia || new Date().getFullYear()}</span>
            </div>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="vrp-status-select"
              style={{ borderColor: statusCfg.color, background: statusCfg.bg, color: statusCfg.color }}
              disabled={loading}
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="vrp-header__right">
            {onDelete && (
              <button
                type="button"
                className="vrp-icon-btn vrp-icon-btn--danger"
                title="Excluir plano"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
            <button className="dialog-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="vrp-delete-confirm">
            <div className="vrp-delete-confirm__icon">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
            </div>
            <div className="vrp-delete-confirm__text">
              <strong>Excluir este plano de recuperação?</strong>
              <span>Todas as atividades vinculadas também serão removidas. Esta ação não pode ser desfeita.</span>
            </div>
            <div className="vrp-delete-confirm__actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeletePlan}
                disabled={deleting}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        )}

        <div className="dialog-form vrp-body">
          {/* Prazo */}
          <div className="vrp-prazo-row">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
            {editingPrazo ? (
              <div className="vrp-inline-edit vrp-inline-edit--row">
                <input
                  type="date"
                  value={editPrazoValue}
                  onChange={(e) => setEditPrazoValue(e.target.value)}
                  className="vrp-date-input"
                />
                <button type="button" className="vrp-inline-btn vrp-inline-btn--save" onClick={handleSavePrazo} disabled={loading}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </button>
                <button type="button" className="vrp-inline-btn vrp-inline-btn--cancel" onClick={() => { setEditingPrazo(false); setEditPrazoValue(plan?.prazo ? plan.prazo.split('T')[0] : ''); }}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </div>
            ) : (
              <span className="vrp-prazo-text" onClick={() => setEditingPrazo(true)} title="Clique para editar o prazo">
                {plan?.prazo ? `Prazo: ${formatDate(plan.prazo)}` : 'Definir prazo...'}
                <svg className="vrp-edit-hint" viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </span>
            )}
          </div>

          {/* Description */}
          <div className="vrp-description-section">
            {editingDescription ? (
              <div className="vrp-description-edit">
                <textarea
                  ref={descriptionRef}
                  className="vrp-description-textarea"
                  value={editDescriptionValue}
                  onChange={(e) => setEditDescriptionValue(e.target.value)}
                  rows={4}
                />
                <div className="vrp-description-edit__actions">
                  <button
                    type="button"
                    className="vrp-inline-btn vrp-inline-btn--cancel"
                    onClick={() => { setEditingDescription(false); setEditDescriptionValue(plan?.descricao || ''); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="vrp-inline-btn vrp-inline-btn--save-text"
                    onClick={handleSaveDescription}
                    disabled={loading || !editDescriptionValue.trim()}
                  >
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="vrp-description-view" onClick={() => setEditingDescription(true)} title="Clique para editar">
                <p className="plan-description">{plan?.descricao || 'Sem descrição'}</p>
                <svg className="vrp-edit-hint" viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {actions.length > 0 && (
            <div className="vrp-progress">
              <div className="vrp-progress__bar">
                <div
                  className="vrp-progress__fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="vrp-progress__label">{completedCount}/{actions.length} concluídas</span>
            </div>
          )}

          {/* Activities */}
          <div className="plan-activities-section">
            <div className="form-section-header">
              <h4>Atividades</h4>
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && newActivity.trim()) handleAddActivity(); }}
                  />
                  <button
                    type="button"
                    className="btn-icon-small"
                    onClick={() => {
                      setShowAddActivity(false);
                      setNewActivity('');
                      setNewActivityResponsavel('');
                      setNewActivityPrazo('');
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
                  <input
                    type="date"
                    value={newActivityPrazo}
                    onChange={(e) => setNewActivityPrazo(e.target.value)}
                    className="vrp-date-input"
                    title="Prazo da atividade"
                  />
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
                    className={`activity-item ${activity.concluida ? 'activity-completed' : ''} ${editingActivityIndex === index ? 'activity-item--editing' : ''}`}
                  >
                    <label className="activity-checkbox">
                      <input
                        type="checkbox"
                        checked={activity.concluida || false}
                        onChange={(e) => handleToggleActivity(index, e.target.checked)}
                      />
                      <span className="activity-checkmark"></span>
                    </label>

                    {editingActivityIndex === index ? (
                      <div className="vrp-activity-edit">
                        <input
                          ref={editActivityRef}
                          type="text"
                          className="vrp-activity-edit__input"
                          value={editActivityValue}
                          onChange={(e) => setEditActivityValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveActivity(); if (e.key === 'Escape') setEditingActivityIndex(null); }}
                        />
                        <div className="vrp-activity-edit__row">
                          {responsaveis.length > 0 ? (
                            <select
                              value={editActivityResponsavel}
                              onChange={(e) => setEditActivityResponsavel(e.target.value)}
                              className="vrp-activity-edit__select"
                            >
                              <option value="">Responsável</option>
                              {responsaveis.map(r => (
                                <option key={r.email || r.id} value={r.name}>{r.name}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="vrp-activity-edit__select"
                              value={editActivityResponsavel}
                              onChange={(e) => setEditActivityResponsavel(e.target.value)}
                              placeholder="Responsável"
                            />
                          )}
                          <input
                            type="date"
                            className="vrp-date-input"
                            value={editActivityPrazo}
                            onChange={(e) => setEditActivityPrazo(e.target.value)}
                          />
                        </div>
                        <div className="vrp-activity-edit__actions">
                          <button type="button" className="vrp-inline-btn vrp-inline-btn--cancel" onClick={() => setEditingActivityIndex(null)}>
                            Cancelar
                          </button>
                          <button type="button" className="vrp-inline-btn vrp-inline-btn--save-text" onClick={handleSaveActivity} disabled={loading || !editActivityValue.trim()}>
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="activity-content" onClick={() => onEditActivity && startEditActivity(index, activity)} style={onEditActivity ? { cursor: 'pointer' } : undefined}>
                          <span className="activity-text">{activity.descricao}</span>
                          <div className="activity-meta-row">
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
                        </div>
                        <div className="vrp-activity-actions">
                          {onEditActivity && (
                            <button
                              type="button"
                              className="btn-icon-small"
                              title="Editar atividade"
                              onClick={() => startEditActivity(index, activity)}
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                              </svg>
                            </button>
                          )}
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
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Metadata */}
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

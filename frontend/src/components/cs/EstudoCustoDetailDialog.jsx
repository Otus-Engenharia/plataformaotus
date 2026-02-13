import React, { useState, useEffect, useCallback } from 'react';
import { STATUS_CONFIG, PRIORIDADE_CONFIG } from './EstudoCustoCard';
import ComentariosThread from '../apoio/ComentariosThread';
import './EstudoCustoDetailDialog.css';

const API_URL = import.meta.env.VITE_API_URL || '';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function EstudoCustoDetailDialog({
  estudoCustoId,
  isPrivileged = false,
  canManageEstudosCustos = false,
  currentUserEmail,
  currentUserId,
  onUpdate,
  onClose,
}) {
  const [estudo, setEstudo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin edit state
  const [editStatus, setEditStatus] = useState('');
  const [editPrioridade, setEditPrioridade] = useState('');
  const [editLinkEstudoCustos, setEditLinkEstudoCustos] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Content edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingContent, setSavingContent] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const fetchEstudo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/estudos-custos/${estudoCustoId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar solicitacao');
      setEstudo(data.data);
      setEditStatus(data.data.status);
      setEditPrioridade(data.data.prioridade);
      setEditLinkEstudoCustos(data.data.link_estudo_custos || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [estudoCustoId]);

  useEffect(() => {
    fetchEstudo();
  }, [fetchEstudo]);

  useEffect(() => {
    if (!estudo) return;
    const changed =
      editStatus !== estudo.status ||
      editPrioridade !== estudo.prioridade ||
      editLinkEstudoCustos !== (estudo.link_estudo_custos || '');
    setHasChanges(changed);
  }, [editStatus, editPrioridade, editLinkEstudoCustos, estudo]);

  const canEdit = canManageEstudosCustos || (estudo && estudo.author_id === currentUserId);

  const startEditing = () => {
    if (!estudo) return;
    setEditForm({
      descricao: estudo.descricao || '',
      data_prevista_apresentacao: estudo.data_prevista_apresentacao || '',
      observacoes: estudo.observacoes || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveContent = async () => {
    setSavingContent(true);
    try {
      const response = await fetch(`${API_URL}/api/estudos-custos/${estudo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar');
      }

      setIsEditing(false);
      await fetchEstudo();
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingContent(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {};
      if (editStatus !== estudo.status) updateData.status = editStatus;
      if (editPrioridade !== estudo.prioridade) updateData.prioridade = editPrioridade;
      if (editLinkEstudoCustos !== (estudo.link_estudo_custos || '')) {
        updateData.link_estudo_custos = editLinkEstudoCustos || null;
      }

      const response = await fetch(`${API_URL}/api/estudos-custos/${estudo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar');
      }

      await fetchEstudo();
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja deletar esta solicitacao? Esta acao nao pode ser desfeita.')) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/estudos-custos/${estudo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar');
      }

      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  };

  const handleAddComentario = async (texto) => {
    const response = await fetch(`${API_URL}/api/estudos-custos/${estudoCustoId}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ texto }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao adicionar comentario');
    }

    await fetchEstudo();
  };

  if (loading) {
    return (
      <div className="ecdetail-overlay">
        <div className="ecdetail">
          <div className="ecdetail__loading">
            <div className="spinner"></div>
            <p>Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !estudo) {
    return (
      <div className="ecdetail-overlay">
        <div className="ecdetail">
          <div className="ecdetail__error">
            <p>{error || 'Solicitacao nao encontrada'}</p>
            <button onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[estudo.status] || {};
  const prioridadeConfig = PRIORIDADE_CONFIG[estudo.prioridade] || {};

  return (
    <div className="ecdetail-overlay">
      <div className="ecdetail">
        {/* Header */}
        <div className="ecdetail__header">
          <div className="ecdetail__header-left">
            <span className="ecdetail__code">EC-{estudo.id}</span>
            <span
              className="ecdetail__status-badge"
              style={{ '--status-color': statusConfig.color }}
            >
              {statusConfig.label}
            </span>
            {prioridadeConfig.color && estudo.prioridade !== 'normal' && (
              <span
                className="ecdetail__prioridade-badge"
                style={{ '--pri-color': prioridadeConfig.color }}
              >
                {prioridadeConfig.label}
              </span>
            )}
          </div>
          <div className="ecdetail__header-actions">
            {canEdit && !isEditing && (
              <button className="ecdetail__edit-btn" onClick={startEditing} title="Editar solicitacao">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canEdit && (
              <button
                className="ecdetail__delete-btn"
                onClick={handleDelete}
                disabled={deleting}
                title="Deletar solicitacao"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <button className="ecdetail__close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="ecdetail__content">
          {/* Edit Mode */}
          {isEditing ? (
            <div className="ecdetail__section ecdetail__section--editing">
              <h3 className="ecdetail__section-title">Editar Solicitacao</h3>
              <div className="ecdetail__edit-grid">
                <div className="ecdetail__edit-field">
                  <label>Data Prevista para Apresentacao</label>
                  <input
                    type="date"
                    value={editForm.data_prevista_apresentacao}
                    onChange={(e) => handleEditChange('data_prevista_apresentacao', e.target.value)}
                  />
                </div>
                <div className="ecdetail__edit-field ecdetail__edit-field--full">
                  <label>Descricao</label>
                  <textarea
                    value={editForm.descricao}
                    onChange={(e) => handleEditChange('descricao', e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="ecdetail__edit-field ecdetail__edit-field--full">
                  <label>Observacoes</label>
                  <textarea
                    value={editForm.observacoes}
                    onChange={(e) => handleEditChange('observacoes', e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="ecdetail__edit-actions">
                <button
                  className="ecdetail__cancel-btn"
                  onClick={cancelEditing}
                  disabled={savingContent}
                >
                  Cancelar
                </button>
                <button
                  className="ecdetail__save-btn"
                  onClick={handleSaveContent}
                  disabled={savingContent}
                >
                  {savingContent ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Info Section (read-only) */}
              <div className="ecdetail__section">
                <h3 className="ecdetail__section-title">Informacoes da Solicitacao</h3>
                <div className="ecdetail__info-grid">
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Projeto</span>
                    <span className="ecdetail__info-value">{estudo.projeto}</span>
                  </div>
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Nome do Time</span>
                    <span className="ecdetail__info-value">{estudo.nome_time || '-'}</span>
                  </div>
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Status / Fase</span>
                    <span className="ecdetail__info-value">{estudo.status_fase || '-'}</span>
                  </div>
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Solicitante</span>
                    <span className="ecdetail__info-value">
                      {estudo.author_name || estudo.author_email}
                    </span>
                  </div>
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Data Prevista</span>
                    <span className="ecdetail__info-value">
                      {formatDateOnly(estudo.data_prevista_apresentacao) || '-'}
                    </span>
                  </div>
                  <div className="ecdetail__info-item">
                    <span className="ecdetail__info-label">Criado em</span>
                    <span className="ecdetail__info-value">{formatDate(estudo.created_at)}</span>
                  </div>
                  {estudo.assigned_name && (
                    <div className="ecdetail__info-item">
                      <span className="ecdetail__info-label">Atribuido a</span>
                      <span className="ecdetail__info-value">{estudo.assigned_name}</span>
                    </div>
                  )}
                </div>

                {/* Links */}
                {(estudo.link_construflow || estudo.link_estudo_custos) && (
                  <div className="ecdetail__links">
                    {estudo.link_construflow && (
                      <a href={estudo.link_construflow} target="_blank" rel="noopener noreferrer" className="ecdetail__link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        ConstruFlow
                      </a>
                    )}
                    {estudo.link_estudo_custos && (
                      <a href={estudo.link_estudo_custos} target="_blank" rel="noopener noreferrer" className="ecdetail__link ecdetail__link--study">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <polyline points="16 13 12 17 8 13" />
                        </svg>
                        Estudo de Custos
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Descricao */}
              {estudo.descricao && (
                <div className="ecdetail__section">
                  <h3 className="ecdetail__section-title">Descricao</h3>
                  <p className="ecdetail__descricao">{estudo.descricao}</p>
                </div>
              )}

              {/* Observacoes */}
              {estudo.observacoes && (
                <div className="ecdetail__section">
                  <h3 className="ecdetail__section-title">Observacoes</h3>
                  <p className="ecdetail__descricao">{estudo.observacoes}</p>
                </div>
              )}
            </>
          )}

          {/* Admin Controls - visible for canManageEstudosCustos users */}
          {canManageEstudosCustos && (
            <div className="ecdetail__section ecdetail__section--admin">
              <h3 className="ecdetail__section-title">Gerenciar (CS)</h3>
              <div className="ecdetail__admin-grid">
                <div className="ecdetail__admin-field">
                  <label>Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ecdetail__admin-field">
                  <label>Prioridade</label>
                  <select value={editPrioridade} onChange={(e) => setEditPrioridade(e.target.value)}>
                    {Object.entries(PRIORIDADE_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ecdetail__admin-field ecdetail__admin-field--full">
                  <label>Link Estudo de Custos</label>
                  <input
                    type="url"
                    value={editLinkEstudoCustos}
                    onChange={(e) => setEditLinkEstudoCustos(e.target.value)}
                    placeholder="https://... (link do estudo pronto)"
                  />
                </div>
              </div>
              {hasChanges && (
                <div className="ecdetail__admin-actions">
                  <button
                    className="ecdetail__save-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Comentarios */}
          <ComentariosThread
            comentarios={estudo.comentarios || []}
            onAddComentario={handleAddComentario}
            currentUserEmail={currentUserEmail}
          />
        </div>
      </div>
    </div>
  );
}

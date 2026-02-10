import React, { useState, useEffect, useCallback } from 'react';
import { STATUS_CONFIG, CATEGORIA_CONFIG, TIPO_SERVICO_CONFIG, PRIORIDADE_CONFIG } from './DemandaCard';
import ComentariosThread from './ComentariosThread';
import './DemandaDetailDialog.css';

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

export default function DemandaDetailDialog({
  demandaId,
  isPrivileged = false,
  canManageDemandas = false,
  currentUserEmail,
  currentUserId,
  onUpdate,
  onClose,
}) {
  const [demanda, setDemanda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin edit state
  const [editStatus, setEditStatus] = useState('');
  const [editPrioridade, setEditPrioridade] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Content edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingContent, setSavingContent] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  const fetchDemanda = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/demandas/${demandaId}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar demanda');
      setDemanda(data.data);
      setEditStatus(data.data.status);
      setEditPrioridade(data.data.prioridade);
      setEditAssignedTo(data.data.assigned_to || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [demandaId]);

  useEffect(() => {
    fetchDemanda();
  }, [fetchDemanda]);

  useEffect(() => {
    if (!demanda) return;
    const changed =
      editStatus !== demanda.status ||
      editPrioridade !== demanda.prioridade ||
      editAssignedTo !== (demanda.assigned_to || '');
    setHasChanges(changed);
  }, [editStatus, editPrioridade, editAssignedTo, demanda]);

  const canEdit = canManageDemandas || (demanda && demanda.author_id === currentUserId);

  const startEditing = () => {
    if (!demanda) return;
    setEditForm({
      categoria: demanda.categoria,
      tipo_servico: demanda.tipo_servico || '',
      tipo_servico_outro: demanda.tipo_servico_outro || '',
      coordenador_projeto: demanda.coordenador_projeto || '',
      cliente_projeto: demanda.cliente_projeto || '',
      descricao: demanda.descricao || '',
      acesso_cronograma: demanda.acesso_cronograma || false,
      link_cronograma: demanda.link_cronograma || '',
      acesso_drive: demanda.acesso_drive || false,
      link_drive: demanda.link_drive || '',
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
      const response = await fetch(`${API_URL}/api/demandas/${demanda.id}`, {
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
      await fetchDemanda();
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
      if (editStatus !== demanda.status) updateData.status = editStatus;
      if (editPrioridade !== demanda.prioridade) updateData.prioridade = editPrioridade;
      if (editAssignedTo !== (demanda.assigned_to || '')) updateData.assigned_to = editAssignedTo || null;

      const response = await fetch(`${API_URL}/api/demandas/${demanda.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar');
      }

      await fetchDemanda();
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja deletar esta demanda? Esta acao nao pode ser desfeita.')) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/demandas/${demanda.id}`, {
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
    const response = await fetch(`${API_URL}/api/demandas/${demandaId}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ texto }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao adicionar comentario');
    }

    await fetchDemanda();
  };

  const handleOverlayClick = () => {
    if (hasChanges || isEditing) {
      if (window.confirm('Existem alteracoes nao salvas. Deseja sair?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (loading) {
    return (
      <div className="dmdetail-overlay" onClick={onClose}>
        <div className="dmdetail" onClick={e => e.stopPropagation()}>
          <div className="dmdetail__loading">
            <div className="spinner"></div>
            <p>Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !demanda) {
    return (
      <div className="dmdetail-overlay" onClick={onClose}>
        <div className="dmdetail" onClick={e => e.stopPropagation()}>
          <div className="dmdetail__error">
            <p>{error || 'Demanda nao encontrada'}</p>
            <button onClick={onClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  const categoriaConfig = CATEGORIA_CONFIG[demanda.categoria] || {};
  const statusConfig = STATUS_CONFIG[demanda.status] || {};
  const prioridadeConfig = PRIORIDADE_CONFIG[demanda.prioridade] || {};
  const tipoConfig = demanda.tipo_servico ? TIPO_SERVICO_CONFIG[demanda.tipo_servico] : null;

  return (
    <div className="dmdetail-overlay" onClick={handleOverlayClick}>
      <div className="dmdetail" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="dmdetail__header">
          <div className="dmdetail__header-left">
            <span className="dmdetail__code">{demanda.code}</span>
            <span
              className="dmdetail__status-badge"
              style={{ '--status-color': statusConfig.color }}
            >
              {statusConfig.label}
            </span>
            <span
              className="dmdetail__categoria-badge"
              style={{ '--cat-color': categoriaConfig.color }}
            >
              {categoriaConfig.icon} {categoriaConfig.label}
            </span>
            {prioridadeConfig.color && demanda.prioridade !== 'normal' && (
              <span
                className="dmdetail__prioridade-badge"
                style={{ '--pri-color': prioridadeConfig.color }}
              >
                {prioridadeConfig.label}
              </span>
            )}
          </div>
          <div className="dmdetail__header-actions">
            {canEdit && !isEditing && (
              <button className="dmdetail__edit-btn" onClick={startEditing} title="Editar demanda">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canEdit && (
              <button
                className="dmdetail__delete-btn"
                onClick={handleDelete}
                disabled={deleting}
                title="Deletar demanda"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <button className="dmdetail__close" onClick={handleOverlayClick}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="dmdetail__content">
          {/* Edit Mode */}
          {isEditing ? (
            <div className="dmdetail__section dmdetail__section--editing">
              <h3 className="dmdetail__section-title">Editar Demanda</h3>
              <div className="dmdetail__edit-grid">
                <div className="dmdetail__edit-field">
                  <label>Categoria</label>
                  <select
                    value={editForm.categoria}
                    onChange={(e) => handleEditChange('categoria', e.target.value)}
                  >
                    {Object.entries(CATEGORIA_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
                {editForm.categoria === 'modelagem' && (
                  <div className="dmdetail__edit-field">
                    <label>Tipo de Servico</label>
                    <select
                      value={editForm.tipo_servico}
                      onChange={(e) => handleEditChange('tipo_servico', e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(TIPO_SERVICO_CONFIG).map(([value, config]) => (
                        <option key={value} value={value}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {editForm.tipo_servico === 'outro' && (
                  <div className="dmdetail__edit-field">
                    <label>Especifique o tipo</label>
                    <input
                      type="text"
                      value={editForm.tipo_servico_outro}
                      onChange={(e) => handleEditChange('tipo_servico_outro', e.target.value)}
                    />
                  </div>
                )}
                <div className="dmdetail__edit-field">
                  <label>Coordenador do Projeto</label>
                  <input
                    type="text"
                    value={editForm.coordenador_projeto}
                    onChange={(e) => handleEditChange('coordenador_projeto', e.target.value)}
                  />
                </div>
                <div className="dmdetail__edit-field">
                  <label>Cliente / Projeto</label>
                  <input
                    type="text"
                    value={editForm.cliente_projeto}
                    onChange={(e) => handleEditChange('cliente_projeto', e.target.value)}
                  />
                </div>
                <div className="dmdetail__edit-field dmdetail__edit-field--full">
                  <label>Descricao</label>
                  <textarea
                    value={editForm.descricao}
                    onChange={(e) => handleEditChange('descricao', e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="dmdetail__edit-field dmdetail__edit-field--checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.acesso_cronograma}
                      onChange={(e) => handleEditChange('acesso_cronograma', e.target.checked)}
                    />
                    Acesso ao Cronograma
                  </label>
                </div>
                {editForm.acesso_cronograma && (
                  <div className="dmdetail__edit-field">
                    <label>Link Cronograma</label>
                    <input
                      type="text"
                      value={editForm.link_cronograma}
                      onChange={(e) => handleEditChange('link_cronograma', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                )}
                <div className="dmdetail__edit-field dmdetail__edit-field--checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.acesso_drive}
                      onChange={(e) => handleEditChange('acesso_drive', e.target.checked)}
                    />
                    Acesso ao Drive
                  </label>
                </div>
                {editForm.acesso_drive && (
                  <div className="dmdetail__edit-field">
                    <label>Link Drive</label>
                    <input
                      type="text"
                      value={editForm.link_drive}
                      onChange={(e) => handleEditChange('link_drive', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                )}
              </div>
              <div className="dmdetail__edit-actions">
                <button
                  className="dmdetail__cancel-btn"
                  onClick={cancelEditing}
                  disabled={savingContent}
                >
                  Cancelar
                </button>
                <button
                  className="dmdetail__save-btn"
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
              <div className="dmdetail__section">
                <h3 className="dmdetail__section-title">Informacoes da Demanda</h3>
                <div className="dmdetail__info-grid">
                  <div className="dmdetail__info-item">
                    <span className="dmdetail__info-label">Cliente / Projeto</span>
                    <span className="dmdetail__info-value">{demanda.cliente_projeto}</span>
                  </div>
                  <div className="dmdetail__info-item">
                    <span className="dmdetail__info-label">Coordenador</span>
                    <span className="dmdetail__info-value">{demanda.coordenador_projeto}</span>
                  </div>
                  {tipoConfig && (
                    <div className="dmdetail__info-item">
                      <span className="dmdetail__info-label">Tipo de Servico</span>
                      <span className="dmdetail__info-value">
                        {tipoConfig.label}
                        {demanda.tipo_servico_outro && ` - ${demanda.tipo_servico_outro}`}
                      </span>
                    </div>
                  )}
                  <div className="dmdetail__info-item">
                    <span className="dmdetail__info-label">Solicitante</span>
                    <span className="dmdetail__info-value">
                      {demanda.author_name || demanda.author_email}
                    </span>
                  </div>
                  <div className="dmdetail__info-item">
                    <span className="dmdetail__info-label">Criado em</span>
                    <span className="dmdetail__info-value">{formatDate(demanda.created_at)}</span>
                  </div>
                  {demanda.assigned_name && (
                    <div className="dmdetail__info-item">
                      <span className="dmdetail__info-label">Atribuido a</span>
                      <span className="dmdetail__info-value">{demanda.assigned_name}</span>
                    </div>
                  )}
                </div>

                {/* Links */}
                {(demanda.link_cronograma || demanda.link_drive) && (
                  <div className="dmdetail__links">
                    {demanda.link_cronograma && (
                      <a href={demanda.link_cronograma} target="_blank" rel="noopener noreferrer" className="dmdetail__link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Cronograma
                      </a>
                    )}
                    {demanda.link_drive && (
                      <a href={demanda.link_drive} target="_blank" rel="noopener noreferrer" className="dmdetail__link">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Drive
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Descricao */}
              <div className="dmdetail__section">
                <h3 className="dmdetail__section-title">Descricao</h3>
                <p className="dmdetail__descricao">{demanda.descricao}</p>
              </div>
            </>
          )}

          {/* Admin Controls - visible for canManageDemandas users */}
          {canManageDemandas && (
            <div className="dmdetail__section dmdetail__section--admin">
              <h3 className="dmdetail__section-title">Gerenciar</h3>
              <div className="dmdetail__admin-grid">
                <div className="dmdetail__admin-field">
                  <label>Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div className="dmdetail__admin-field">
                  <label>Prioridade</label>
                  <select value={editPrioridade} onChange={(e) => setEditPrioridade(e.target.value)}>
                    {Object.entries(PRIORIDADE_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {hasChanges && (
                <div className="dmdetail__admin-actions">
                  <button
                    className="dmdetail__save-btn"
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
            comentarios={demanda.comentarios || []}
            onAddComentario={handleAddComentario}
            currentUserEmail={currentUserEmail}
          />
        </div>
      </div>
    </div>
  );
}

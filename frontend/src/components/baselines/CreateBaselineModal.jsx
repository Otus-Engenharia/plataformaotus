/**
 * Componente: Modal de Criação de Baseline
 * Permite definir nome e motivo/descrição ao criar uma nova baseline.
 */

import React, { useState } from 'react';

function CreateBaselineModal({ projectName, nextRevision, onConfirm, onCancel, loading }) {
  const defaultName = nextRevision === 0
    ? 'Baseline Original'
    : `R${String(nextRevision).padStart(2, '0')}`;

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    setError(null);
    try {
      await onConfirm({ name: name.trim(), description: description.trim() || null });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="baselines-modal-overlay" onClick={onCancel}>
      <div className="baselines-modal" onClick={e => e.stopPropagation()}>
        <div className="baselines-modal-header">
          <h3>Nova Baseline</h3>
          <button className="baselines-modal-close" onClick={onCancel}>&#10005;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="baselines-modal-body">
            <p className="baselines-modal-info">
              Um snapshot das tarefas atuais de <strong>{projectName}</strong> será criado.
            </p>

            <div className="baselines-form-group">
              <label htmlFor="baseline-name">Nome da Baseline</label>
              <input
                id="baseline-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: R01 - Reprogramação Março"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="baselines-form-group">
              <label htmlFor="baseline-desc">Motivo / Descrição</label>
              <textarea
                id="baseline-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o motivo desta baseline (opcional)..."
                rows={3}
                maxLength={500}
              />
            </div>

            {error && <div className="baselines-modal-error">{error}</div>}
          </div>

          <div className="baselines-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-confirm" disabled={loading}>
              {loading ? 'Criando snapshot...' : 'Criar Baseline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateBaselineModal;

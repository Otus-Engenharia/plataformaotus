/**
 * Componente: Modal de Solicitação de Baseline
 * Coordenador solicita nova baseline para aprovação do gerente.
 */

import React, { useState } from 'react';

function RequestBaselineModal({ projectName, projectCode, onConfirm, onCancel, loading }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [error, setError] = useState(null);

  // Default deadline: 7 days from now
  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  useState(() => {
    setResponseDeadline(getDefaultDeadline());
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Titulo e obrigatorio');
      return;
    }
    if (!description.trim()) {
      setError('Descricao e obrigatoria');
      return;
    }
    if (!responseDeadline) {
      setError('Prazo para resposta e obrigatorio');
      return;
    }
    setError(null);
    try {
      await onConfirm({
        title: title.trim(),
        description: description.trim(),
        response_deadline: responseDeadline,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="baselines-modal-overlay" onClick={onCancel}>
      <div className="baselines-modal" onClick={e => e.stopPropagation()}>
        <div className="baselines-modal-header">
          <h3>Solicitar Nova Baseline</h3>
          <button className="baselines-modal-close" onClick={onCancel}>&#10005;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="baselines-modal-body">
            <p className="baselines-modal-info">
              Solicitar nova linha de base para <strong>{projectName || projectCode}</strong>.
              A solicitacao sera enviada para aprovacao do gerente.
            </p>

            <div className="baselines-form-group">
              <label htmlFor="request-title">Titulo da Baseline</label>
              <input
                id="request-title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: R01 - Reprogramacao Marco"
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="baselines-form-group">
              <label htmlFor="request-desc">Descricao / Log</label>
              <textarea
                id="request-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o motivo da nova baseline..."
                rows={4}
                maxLength={1000}
              />
            </div>

            <div className="baselines-form-group">
              <label htmlFor="request-deadline">Prazo para Resposta do Gerente</label>
              <input
                id="request-deadline"
                type="date"
                value={responseDeadline}
                onChange={e => setResponseDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {error && <div className="baselines-modal-error">{error}</div>}
          </div>

          <div className="baselines-modal-footer">
            <button type="button" className="btn-modal-cancel" onClick={onCancel} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-confirm" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Solicitacao'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RequestBaselineModal;

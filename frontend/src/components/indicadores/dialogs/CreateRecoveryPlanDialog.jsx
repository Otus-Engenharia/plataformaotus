import React, { useState } from 'react';
import { formatValue } from '../../../utils/indicator-utils';
import './Dialogs.css';

export default function CreateRecoveryPlanDialog({
  indicador,
  onSubmit,
  onClose
}) {
  const [descricao, setDescricao] = useState('');
  const [actions, setActions] = useState([{ descricao: '' }]);
  const [prazo, setPrazo] = useState('');
  const [loading, setLoading] = useState(false);

  const addAction = () => {
    setActions([...actions, { descricao: '' }]);
  };

  const removeAction = (index) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const updateAction = (index, value) => {
    const newActions = [...actions];
    newActions[index] = { descricao: value };
    setActions(newActions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!descricao.trim()) {
      alert('Descreva o problema ou objetivo do plano');
      return;
    }

    const validActions = actions.filter(a => a.descricao.trim());
    if (validActions.length === 0) {
      alert('Adicione pelo menos uma ação');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        indicador_id: indicador.id,
        descricao: descricao.trim(),
        actions: validActions,
        prazo: prazo || null,
        status: 'pending'
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content dialog-large glass-card" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Criar Plano de Recuperação</h2>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="dialog-indicator-info warning">
          <div className="indicator-warning-icon">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="#EA4335" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          </div>
          <div>
            <h3>{indicador?.nome}</h3>
            <p>
              Valor atual: {formatValue(indicador?.valor_consolidado, indicador?.metric_type)} |
              Meta: {formatValue(indicador?.meta, indicador?.metric_type)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <div className="form-group">
            <label htmlFor="recovery-descricao">Diagnóstico / Objetivo *</label>
            <textarea
              id="recovery-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o problema identificado e o objetivo do plano de recuperação..."
              rows={3}
              required
              autoFocus
            />
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <h4>Ações do Plano</h4>
              <button type="button" className="btn-small" onClick={addAction}>
                + Adicionar
              </button>
            </div>

            <div className="actions-list">
              {actions.map((action, index) => (
                <div key={index} className="action-item">
                  <span className="action-number">{index + 1}</span>
                  <input
                    type="text"
                    value={action.descricao}
                    onChange={(e) => updateAction(index, e.target.value)}
                    placeholder="Descreva a ação a ser tomada..."
                  />
                  {actions.length > 1 && (
                    <button
                      type="button"
                      className="btn-icon-small btn-danger"
                      onClick={() => removeAction(index)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="recovery-prazo">Prazo para Conclusão</label>
            <input
              id="recovery-prazo"
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <span className="form-hint">Deixe em branco para definir depois</span>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

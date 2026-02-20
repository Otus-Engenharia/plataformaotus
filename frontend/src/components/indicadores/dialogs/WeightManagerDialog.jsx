import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import './Dialogs.css';

/**
 * Dialog para gerenciar pesos dos indicadores e excluir indicadores.
 * Pesos devem somar 100% para salvar.
 */
export default function WeightManagerDialog({ indicadores, onClose, onSave, onDelete }) {
  const [weights, setWeights] = useState(() => {
    const w = {};
    for (const ind of indicadores) w[ind.id] = ind.peso ?? 1;
    return w;
  });
  const [removed, setRemoved] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const activeIndicadores = indicadores.filter(ind => !removed.includes(ind.id));
  const total = useMemo(
    () => activeIndicadores.reduce((sum, ind) => sum + (parseInt(weights[ind.id], 10) || 0), 0),
    [weights, activeIndicadores]
  );

  const isValid = total === 100 && activeIndicadores.length > 0;
  const statusClass = total === 100 ? 'complete' : total > 100 ? 'exceeded' : 'warning';

  const handleWeightChange = (id, value) => {
    setWeights(prev => ({ ...prev, [id]: value === '' ? '' : parseInt(value, 10) || 0 }));
  };

  const handleDelete = async (id) => {
    setConfirmDeleteId(null);
    setRemoved(prev => [...prev, id]);
    try {
      await onDelete(id);
    } catch {
      setRemoved(prev => prev.filter(r => r !== id));
    }
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const changed = activeIndicadores
        .filter(ind => (parseInt(weights[ind.id], 10) || 0) !== (ind.peso ?? 1))
        .map(ind => ({ id: ind.id, peso: parseInt(weights[ind.id], 10) || 0 }));
      await onSave(changed);
    } catch {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content glass-card weight-manager"
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h2>Gerenciar Pesos</h2>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="weight-manager__body">
          {/* Progress bar */}
          <div className="weight-manager__progress-section">
            <div className="weight-manager__progress-track">
              <div
                className={`weight-manager__progress-fill weight-manager__progress-fill--${statusClass}`}
                style={{ width: `${Math.min(total, 100)}%` }}
              />
            </div>
            <span className={`weight-manager__progress-label weight-manager__progress-label--${statusClass}`}>
              {total}/100
            </span>
          </div>
          {total !== 100 && (
            <p className={`weight-manager__hint weight-manager__hint--${statusClass}`}>
              {total < 100
                ? `Faltam ${100 - total}% para completar`
                : `Excedido em ${total - 100}%`}
            </p>
          )}

          {/* Indicator list */}
          <ul className="weight-manager__list">
            {activeIndicadores.map(ind => (
              <li key={ind.id} className="weight-manager__item">
                <span className="weight-manager__item-name" title={ind.nome}>
                  {ind.nome}
                </span>
                <div className="weight-manager__item-actions">
                  <input
                    type="number"
                    className="weight-manager__input"
                    min="0"
                    max="100"
                    value={weights[ind.id]}
                    onChange={e => handleWeightChange(ind.id, e.target.value)}
                  />
                  <span className="weight-manager__pct">%</span>
                  {confirmDeleteId === ind.id ? (
                    <div className="weight-manager__confirm-delete">
                      <button
                        className="weight-manager__confirm-yes"
                        onClick={() => handleDelete(ind.id)}
                      >
                        Sim
                      </button>
                      <button
                        className="weight-manager__confirm-no"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Nao
                      </button>
                    </div>
                  ) : (
                    <button
                      className="weight-manager__delete-btn"
                      title="Excluir indicador"
                      onClick={() => setConfirmDeleteId(ind.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {activeIndicadores.length === 0 && (
            <p className="weight-manager__empty">Nenhum indicador restante.</p>
          )}
        </div>

        <div className="weight-manager__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn--primary"
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

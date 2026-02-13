import React, { useState } from 'react';
import { getMonthsForCycle } from '../../../utils/indicator-utils';
import './Dialogs.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function EditMonthlyTargetsDialog({
  indicador,
  onSubmit,
  onClose
}) {
  const cycle = indicador?.ciclo || 'anual';
  const defaultTarget = indicador?.meta || 0;
  const months = getMonthsForCycle(cycle);

  const [targets, setTargets] = useState(() => {
    const initial = {};
    months.forEach(m => {
      initial[m.value] = indicador?.monthly_targets?.[m.value] ?? defaultTarget;
    });
    return initial;
  });

  const [loading, setLoading] = useState(false);

  const handleTargetChange = (month, value) => {
    setTargets(prev => ({
      ...prev,
      [month]: value === '' ? '' : parseFloat(value)
    }));
  };

  const applyFirstToAll = () => {
    const firstMonth = months[0]?.value;
    const firstValue = targets[firstMonth];
    if (firstValue !== '' && firstValue !== null && firstValue !== undefined) {
      const newTargets = {};
      months.forEach(m => {
        newTargets[m.value] = firstValue;
      });
      setTargets(newTargets);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanTargets = {};
    Object.entries(targets).forEach(([month, value]) => {
      if (value !== '' && value !== null) {
        cleanTargets[parseInt(month)] = parseFloat(value);
      }
    });

    setLoading(true);
    try {
      await onSubmit({ monthly_targets: cleanTargets });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCycleLabel = () => {
    if (cycle === 'q1') return 'Q1';
    if (cycle === 'q2') return 'Q2';
    if (cycle === 'q3') return 'Q3';
    if (cycle === 'q4') return 'Q4';
    return 'o ano';
  };

  const unit = indicador?.metric_type === 'percentage' ? '%' : '';

  return (
    <div className="dialog-overlay">
      <div className="dialog-content dialog-small glass-card">
        <div className="dialog-header">
          <div>
            <h2>Metas Mensais</h2>
            <p className="dialog-subtitle">Defina a meta esperada para cada mês do {getCycleLabel()}.</p>
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          {/* Apply to all button */}
          <div className="apply-all-section">
            <button type="button" className="btn-apply-all" onClick={applyFirstToAll}>
              Aplicar 1º valor a todos
            </button>
          </div>

          {/* Monthly inputs */}
          <div className="monthly-inputs-list">
            {months.map(m => (
              <div key={m.value} className="monthly-input-row">
                <label htmlFor={`target-${m.value}`}>
                  {MONTH_NAMES[m.value - 1]}
                </label>
                <div className="input-with-unit">
                  <input
                    id={`target-${m.value}`}
                    type="number"
                    step="any"
                    value={targets[m.value] ?? ''}
                    onChange={(e) => handleTargetChange(m.value, e.target.value)}
                    placeholder="0"
                  />
                  {unit && <span className="input-unit">{unit}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Metas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

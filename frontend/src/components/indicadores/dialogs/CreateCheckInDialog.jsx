import React, { useState } from 'react';
import { getMonthsForCycle, formatValue } from '../../../utils/indicator-utils';
import './Dialogs.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Dialog para criar um check-in mensal
 */
export default function CreateCheckInDialog({
  indicador,
  ano,
  mes: initialMes,
  onSubmit,
  onClose
}) {
  const currentMonth = new Date().getMonth() + 1;
  const availableMonths = getMonthsForCycle(indicador.ciclo || 'anual');

  const [mes, setMes] = useState(
    initialMes || availableMonths.find(m => m.value === currentMonth)?.value || availableMonths[0]?.value || 1
  );
  const [valor, setValor] = useState('');
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);

  const metaMensal = indicador.monthly_targets?.[mes] || indicador.meta;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!valor && valor !== 0) {
      alert('Informe o valor');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        mes: parseInt(mes, 10),
        ano: parseInt(ano, 10),
        valor: parseFloat(valor),
        notas: notas.trim() || null
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Registrar Check-in</h2>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <div className="dialog-indicator-info">
          <h3>{indicador.nome}</h3>
          {indicador.descricao && <p>{indicador.descricao}</p>}
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="check-in-mes">Mês</label>
              <select
                id="check-in-mes"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                required
              >
                {availableMonths.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="check-in-ano">Ano</label>
              <input
                id="check-in-ano"
                type="number"
                value={ano}
                disabled
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="check-in-valor">
              Valor {indicador.unidade && <span className="label-unit">({indicador.unidade})</span>}
            </label>
            <input
              id="check-in-valor"
              type="number"
              step="any"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={`Meta: ${formatValue(metaMensal, indicador.metric_type)}`}
              required
              autoFocus
            />
            <span className="form-hint">
              Meta para {MONTH_NAMES[mes - 1]}: {formatValue(metaMensal, indicador.metric_type)}
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="check-in-notas">Observações (opcional)</label>
            <textarea
              id="check-in-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Adicione contexto ou observações sobre este resultado..."
              rows={3}
            />
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Check-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

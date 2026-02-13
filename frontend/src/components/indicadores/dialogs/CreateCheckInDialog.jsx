import React, { useState } from 'react';
import { getMonthsForCycle, formatValue } from '../../../utils/indicator-utils';
import './Dialogs.css';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Dialog para criar ou editar um check-in mensal
 */
export default function CreateCheckInDialog({
  indicador,
  ano,
  mes: initialMes,
  existingCheckIn,
  onSubmit,
  onDelete,
  onClose
}) {
  const currentMonth = new Date().getMonth() + 1;
  const availableMonths = getMonthsForCycle(indicador.ciclo || 'anual');
  const isEditing = !!existingCheckIn;

  const [mes, setMes] = useState(
    initialMes || existingCheckIn?.mes || availableMonths.find(m => m.value === currentMonth)?.value || availableMonths[0]?.value || 1
  );
  const [valor, setValor] = useState(existingCheckIn?.valor?.toString() || '');
  const [notas, setNotas] = useState(existingCheckIn?.notas || '');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!onDelete || !existingCheckIn) return;

    if (!window.confirm('Tem certeza que deseja excluir este check-in?')) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete(existingCheckIn.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content glass-card">
        <div className="dialog-header">
          <div>
            <h2>{isEditing ? 'Editar Check-in' : 'Registrar Check-in'}</h2>
            {isEditing && (
              <p className="dialog-subtitle">
                {MONTH_NAMES[mes - 1]} de {ano}
                <br />
                Meta do mês: {formatValue(metaMensal, indicador.metric_type)}
              </p>
            )}
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        {!isEditing && (
          <div className="dialog-indicator-info">
            <h3>{indicador.nome}</h3>
            {indicador.descricao && <p>{indicador.descricao}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="dialog-form">
          {!isEditing && (
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
          )}

          <div className="form-group">
            <label htmlFor="check-in-valor">
              Valor alcançado {indicador.unidade && <span className="label-unit">({indicador.unidade})</span>}
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
            {!isEditing && (
              <span className="form-hint">
                Meta para {MONTH_NAMES[mes - 1]}: {formatValue(metaMensal, indicador.metric_type)}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="check-in-notas">Observações (opcional)</label>
            <textarea
              id="check-in-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Contexto sobre o resultado..."
              rows={3}
            />
          </div>

          <div className="dialog-actions dialog-actions--spread">
            {isEditing && onDelete && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={loading || deleting}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            )}
            <div className="dialog-actions__right">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading || deleting}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={loading || deleting}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

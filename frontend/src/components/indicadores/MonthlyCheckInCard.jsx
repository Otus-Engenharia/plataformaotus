import React from 'react';
import { formatValue, getTrafficLightHex, calculateIndicatorScore } from '../../utils/indicator-utils';
import './MonthlyCheckInCard.css';

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Card de check-in mensal
 * @param {Object} props
 * @param {Object} props.checkIn - Dados do check-in
 * @param {Object} props.indicador - Indicador pai (para calcular score)
 * @param {boolean} props.editable - Se pode editar
 * @param {Function} props.onEdit - Callback para editar
 */
export default function MonthlyCheckInCard({
  checkIn,
  indicador,
  editable = false,
  onEdit
}) {
  // Calcula score do check-in
  const score = calculateIndicatorScore(
    checkIn.valor,
    indicador.threshold_80,
    indicador.monthly_targets?.[checkIn.mes] || indicador.meta,
    indicador.threshold_120,
    indicador.is_inverse
  );
  const color = getTrafficLightHex(score);
  const valorFormatado = formatValue(checkIn.valor, indicador.metric_type);
  const metaMensal = indicador.monthly_targets?.[checkIn.mes] || indicador.meta;
  const metaFormatada = formatValue(metaMensal, indicador.metric_type);

  return (
    <div className="check-in-card" style={{ '--check-in-color': color }}>
      <div className="check-in-header">
        <span className="check-in-month">{MONTH_NAMES[checkIn.mes - 1]}</span>
        <span className="check-in-year">{checkIn.ano}</span>
      </div>

      <div className="check-in-body">
        <div className="check-in-value" style={{ color }}>
          {valorFormatado}
        </div>
        <div className="check-in-meta">
          Meta: {metaFormatada}
        </div>
        <div className="check-in-score">
          Score: <span style={{ color }}>{score.toFixed(0)}</span>
        </div>
      </div>

      {checkIn.notas && (
        <div className="check-in-notes">
          <p>{checkIn.notas}</p>
        </div>
      )}

      {editable && (
        <button
          className="check-in-edit-btn"
          onClick={() => onEdit && onEdit(checkIn)}
          aria-label="Editar check-in"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </button>
      )}

      <div className="check-in-indicator" style={{ backgroundColor: color }} />
    </div>
  );
}

/**
 * Grid de check-ins mensais com meses vazios
 */
export function MonthlyCheckInsGrid({
  checkIns,
  indicador,
  months,
  onAddCheckIn,
  onEditCheckIn,
  editable = false
}) {
  // Cria mapa de check-ins por mês
  const checkInsByMonth = {};
  (checkIns || []).forEach(ci => {
    checkInsByMonth[ci.mes] = ci;
  });

  return (
    <div className="check-ins-grid">
      {months.map(month => {
        const checkIn = checkInsByMonth[month.value];
        const metaMensal = indicador.monthly_targets?.[month.value] || indicador.meta;

        if (checkIn) {
          return (
            <MonthlyCheckInCard
              key={month.value}
              checkIn={checkIn}
              indicador={indicador}
              editable={editable}
              onEdit={onEditCheckIn}
            />
          );
        }

        // Mês vazio - botão para adicionar
        return (
          <div key={month.value} className="check-in-empty">
            <span className="check-in-empty-month">{month.label.slice(0, 3)}</span>
            <span className="check-in-empty-meta">
              Meta: {formatValue(metaMensal, indicador.metric_type)}
            </span>
            {editable && (
              <button
                className="check-in-add-btn"
                onClick={() => onAddCheckIn && onAddCheckIn(month.value)}
              >
                + Adicionar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

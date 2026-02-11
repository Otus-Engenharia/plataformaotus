import React from 'react';
import { Link } from 'react-router-dom';
import { getIndicatorScore, formatValue, isIndicatorAtRisk, getCycleLabel } from '../../utils/indicator-utils';
import TrafficLightBadge from './TrafficLightBadge';
import ScoreZoneGauge from './ScoreZoneGauge';
import './IndicadorCard.css';

/**
 * Card de indicador individual
 * @param {Object} props
 * @param {Object} props.indicador - Dados do indicador
 * @param {boolean} props.compact - Versão compacta
 * @param {boolean} props.showCheckIn - Mostrar botão de check-in
 * @param {Function} props.onCheckIn - Callback para check-in
 */
export default function IndicadorCard({
  indicador,
  compact = false,
  showCheckIn = false,
  onCheckIn
}) {
  const score = getIndicatorScore(indicador);
  const atRisk = isIndicatorAtRisk(indicador);
  const valorFormatado = formatValue(indicador.valor, indicador.metric_type);
  const metaFormatada = formatValue(indicador.meta, indicador.metric_type);

  if (compact) {
    return (
      <Link to={`/ind/indicador/${indicador.id}`} className="indicador-card indicador-card-compact">
        <div className="indicador-card-header">
          <TrafficLightBadge score={score} size="sm" />
          <span className="indicador-card-title">{indicador.nome}</span>
        </div>
        <div className="indicador-card-value">
          {valorFormatado} <span className="indicador-card-meta">/ {metaFormatada}</span>
        </div>
      </Link>
    );
  }

  return (
    <div className={`indicador-card glass-card ${atRisk ? 'indicador-card-at-risk' : ''}`}>
      <div className="indicador-card-header">
        <div className="indicador-card-info">
          <Link to={`/ind/indicador/${indicador.id}`} className="indicador-card-title-link">
            <h3 className="indicador-card-title">{indicador.nome}</h3>
          </Link>
          {indicador.descricao && (
            <p className="indicador-card-description">{indicador.descricao}</p>
          )}
        </div>
        <TrafficLightBadge score={score} showLabel size="md" />
      </div>

      <div className="indicador-card-body">
        <div className="indicador-card-values">
          <div className="indicador-value-item">
            <span className="indicador-value-label">Atual</span>
            <span className="indicador-value-number">{valorFormatado}</span>
          </div>
          <div className="indicador-value-item">
            <span className="indicador-value-label">Meta</span>
            <span className="indicador-value-number indicador-value-meta">{metaFormatada}</span>
          </div>
          <div className="indicador-value-item">
            <span className="indicador-value-label">Score</span>
            <span className="indicador-value-number">{score.toFixed(0)}</span>
          </div>
        </div>

        <ScoreZoneGauge score={score} size="sm" showLabels={false} showScore={false} />

        <div className="indicador-card-meta">
          {indicador.ciclo && (
            <span className="indicador-meta-badge">{getCycleLabel(indicador.ciclo)}</span>
          )}
          {indicador.consolidation_type && (
            <span className="indicador-meta-badge indicador-meta-consolidation">
              {indicador.consolidation_type === 'sum' ? 'Soma' :
               indicador.consolidation_type === 'average' ? 'Média' :
               indicador.consolidation_type === 'last_value' ? 'Último valor' : 'Manual'}
            </span>
          )}
          {indicador.is_inverse && (
            <span className="indicador-meta-badge indicador-meta-inverse">Inverso</span>
          )}
        </div>
      </div>

      {showCheckIn && (
        <div className="indicador-card-footer">
          <button
            className="btn-check-in"
            onClick={() => onCheckIn && onCheckIn(indicador)}
          >
            Registrar Check-in
          </button>
          <Link to={`/ind/indicador/${indicador.id}`} className="btn-details">
            Ver detalhes
          </Link>
        </div>
      )}
    </div>
  );
}

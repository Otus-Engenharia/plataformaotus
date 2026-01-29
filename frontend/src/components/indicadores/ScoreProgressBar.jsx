import React from 'react';
import { getTrafficLightHex } from '../../utils/indicator-utils';
import './ScoreProgressBar.css';

/**
 * Barra de progresso com score
 * @param {Object} props
 * @param {number} props.score - Score (0-120)
 * @param {number} props.value - Valor atual
 * @param {number} props.target - Meta
 * @param {boolean} props.showValue - Mostrar valor numérico
 * @param {'sm'|'md'|'lg'} props.size - Tamanho
 */
export default function ScoreProgressBar({
  score,
  value,
  target,
  showValue = true,
  size = 'md'
}) {
  const color = getTrafficLightHex(score);
  const percentage = Math.min(Math.max((score || 0) / 120 * 100, 0), 100);

  return (
    <div className={`score-progress-container score-progress-${size}`}>
      <div className="score-progress-bar">
        <div
          className="score-progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
        {/* Marcadores de referência */}
        <div className="score-progress-marker score-marker-80" title="80%" />
        <div className="score-progress-marker score-marker-100" title="100%" />
      </div>
      {showValue && (
        <div className="score-progress-values">
          <span className="score-progress-current" style={{ color }}>
            {score !== null && score !== undefined ? score.toFixed(0) : '-'}
          </span>
          <span className="score-progress-max">/120</span>
        </div>
      )}
    </div>
  );
}

/**
 * Barra de progresso circular
 */
export function ScoreProgressCircle({ score, size = 80, strokeWidth = 8 }) {
  const color = getTrafficLightHex(score);
  const percentage = Math.min(Math.max((score || 0) / 120 * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="score-circle-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="score-circle">
        <circle
          className="score-circle-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="score-circle-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            stroke: color,
            filter: `drop-shadow(0 0 6px ${color}40)`
          }}
        />
      </svg>
      <div className="score-circle-value" style={{ color }}>
        {score !== null && score !== undefined ? Math.round(score) : '-'}
      </div>
    </div>
  );
}

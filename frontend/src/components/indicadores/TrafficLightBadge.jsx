import React from 'react';
import { getTrafficLightColor, getTrafficLightHex, getScoreStatus } from '../../utils/indicator-utils';
import './TrafficLightBadge.css';

/**
 * Badge colorido de semáforo baseado no score
 * @param {Object} props
 * @param {number} props.score - Score (0-120)
 * @param {boolean} props.showLabel - Mostrar label textual
 * @param {'sm'|'md'|'lg'} props.size - Tamanho do badge
 */
export default function TrafficLightBadge({ score, showLabel = false, size = 'md' }) {
  const color = getTrafficLightColor(score);
  const hex = getTrafficLightHex(score);
  const status = getScoreStatus(score);

  return (
    <span
      className={`traffic-light-badge traffic-light-${color} traffic-light-${size}`}
      style={{ '--badge-color': hex }}
      title={`Score: ${score !== null && score !== undefined ? score.toFixed(1) : '-'} - ${status}`}
    >
      <span className="traffic-light-dot" />
      {showLabel && <span className="traffic-light-label">{status}</span>}
    </span>
  );
}

import React from 'react';
import { getScoreStatus } from '../../utils/indicator-utils';
import './ScoreZoneGauge.css';

const ZONES = [
  { id: 'zerado', label: 'Zerado', range: '< 80', min: 0, max: 80, color: '#ef4444' },
  { id: 'risco', label: 'Em risco', range: '80–99', min: 80, max: 100, color: '#f59e0b' },
  { id: 'alvo', label: 'No alvo', range: '100–119', min: 100, max: 120, color: '#22c55e' },
  { id: 'superou', label: 'Superou', range: '≥ 120', min: 120, max: 140, color: '#1a1a1a' },
];

/**
 * Calcula a posição percentual do ponteiro no gauge.
 * Cada zona ocupa 25% do espaço visual.
 */
function getPointerPosition(score) {
  if (score === null || score === undefined) return 0;
  const s = Math.max(0, Math.min(score, 120));

  if (s < 80) {
    // Zona Zerado: 0-80 mapeia para 0%-25%
    return (s / 80) * 25;
  }
  if (s < 100) {
    // Zona Em Risco: 80-99 mapeia para 25%-50%
    return 25 + ((s - 80) / 20) * 25;
  }
  if (s < 120) {
    // Zona No Alvo: 100-119 mapeia para 50%-75%
    return 50 + ((s - 100) / 20) * 25;
  }
  // Superou: 120 = 75% (fixa no início da zona)
  return 75;
}

function getActiveZoneIndex(score) {
  if (score === null || score === undefined) return -1;
  if (score >= 120) return 3;
  if (score >= 100) return 2;
  if (score >= 80) return 1;
  return 0;
}

/**
 * Gauge de score com zonas segmentadas.
 * Cada zona recebe espaço visual igual (~25%), eliminando a "zona morta".
 *
 * @param {Object} props
 * @param {number} props.score - Score (0-120)
 * @param {'lg'|'md'|'sm'} props.size - Variante de tamanho
 * @param {boolean} props.showLabels - Mostrar labels das zonas
 * @param {boolean} props.showLegend - Mostrar legenda abaixo
 * @param {boolean} props.showScore - Mostrar valor numérico do score
 */
export default function ScoreZoneGauge({
  score,
  size = 'md',
  showLabels = true,
  showLegend = false,
  showScore = true,
}) {
  const activeZone = getActiveZoneIndex(score);
  const pointerPos = getPointerPosition(score);
  const status = getScoreStatus(score);
  const hasScore = score !== null && score !== undefined;

  return (
    <div className={`zone-gauge zone-gauge--${size}`}>
      {/* Score value + status */}
      {showScore && size !== 'sm' && (
        <div className="zone-gauge__header">
          <span className={`zone-gauge__score zone-gauge__score--${ZONES[Math.max(activeZone, 0)].id}`}>
            {hasScore ? Math.round(score) : '—'}
          </span>
          <span className={`zone-gauge__status zone-gauge__status--${ZONES[Math.max(activeZone, 0)].id}`}>
            {hasScore ? status : 'Sem dados'}
          </span>
        </div>
      )}

      {/* Zone bar */}
      <div className="zone-gauge__bar">
        {ZONES.map((zone, i) => (
          <div
            key={zone.id}
            className={`zone-gauge__segment zone-gauge__segment--${zone.id} ${
              i === activeZone ? 'zone-gauge__segment--active' : ''
            } ${i < activeZone ? 'zone-gauge__segment--passed' : ''}`}
          >
            {showLabels && size === 'lg' && (
              <span className="zone-gauge__zone-label">{zone.label}</span>
            )}
          </div>
        ))}

        {/* Pointer/needle */}
        {hasScore && (
          <div
            className={`zone-gauge__pointer zone-gauge__pointer--${ZONES[Math.max(activeZone, 0)].id}`}
            style={{ left: `${pointerPos}%` }}
          >
            <div className="zone-gauge__pointer-line" />
            {size === 'sm' && (
              <span className="zone-gauge__pointer-value">
                {Math.round(score)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Range labels */}
      {showLabels && size !== 'sm' && (
        <div className="zone-gauge__ranges">
          {ZONES.map((zone, i) => (
            <span
              key={zone.id}
              className={`zone-gauge__range ${i === activeZone ? 'zone-gauge__range--active' : ''}`}
            >
              {zone.range}
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="zone-gauge__legend">
          {ZONES.map((zone) => (
            <div key={zone.id} className="zone-gauge__legend-item">
              <span className={`zone-gauge__legend-dot zone-gauge__legend-dot--${zone.id}`} />
              {zone.label} ({zone.range})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Mini score badge colorido com ícone de zona.
 * Alternativa compacta para listas.
 */
export function ScoreZoneBadge({ score }) {
  const activeZone = getActiveZoneIndex(score);
  const zone = ZONES[Math.max(activeZone, 0)];
  const hasScore = score !== null && score !== undefined;

  return (
    <span className={`zone-badge zone-badge--${zone.id}`}>
      {hasScore ? Math.round(score) : '—'}
    </span>
  );
}

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
  showBar = true,
  showStatus = true,
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
            {hasScore ? score.toFixed(1) : '—'}
          </span>
          {showStatus && (
            <span className={`zone-gauge__status zone-gauge__status--${ZONES[Math.max(activeZone, 0)].id}`}>
              {hasScore ? status : 'Sem dados'}
            </span>
          )}
        </div>
      )}

      {/* Zone bar */}
      {showBar && (
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
                  {score.toFixed(1)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Range labels */}
      {showBar && showLabels && size !== 'sm' && (
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
      {hasScore ? score.toFixed(1) : '—'}
    </span>
  );
}


/**
 * Gauge semicircular SVG com 4 zonas coloridas e agulha animada.
 * Usado como peça central do Farol no dashboard.
 */
export function ArcGauge({ score, size = 280 }) {
  const cx = 140, cy = 148, r = 110;
  const activeZone = getActiveZoneIndex(score);
  const pointerPos = getPointerPosition(score);
  const hasScore = score !== null && score !== undefined;
  const status = hasScore ? getScoreStatus(score) : 'Sem dados';
  const zoneColor = ZONES[Math.max(activeZone, 0)].color;

  // Convert pointerPos (0-75) to angle in radians (-PI to 0)
  const needleAngle = -Math.PI + (pointerPos / 75) * Math.PI;

  // Helper: degree angle to point on arc
  const arcPoint = (angleDeg, radius) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  // Build arc path for each zone (each 45deg of 180deg sweep)
  const zoneArcs = ZONES.map((zone, i) => {
    const startAngle = -180 + i * 45;
    const endAngle = startAngle + 45;
    const start = arcPoint(startAngle, r);
    const end = arcPoint(endAngle, r);
    const isActive = i === activeZone;
    const isPassed = i < activeZone;

    return (
      <path
        key={zone.id}
        d={`M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`}
        stroke={zone.color}
        strokeWidth={isActive ? 14 : 10}
        fill="none"
        strokeLinecap="round"
        opacity={isActive ? 1 : isPassed ? 0.45 : 0.18}
        className="arc-gauge__zone"
      />
    );
  });

  // Needle tip point
  const needleTip = {
    x: cx + (r - 22) * Math.cos(needleAngle),
    y: cy + (r - 22) * Math.sin(needleAngle),
  };

  return (
    <svg viewBox="0 0 280 175" width="100%" style={{ maxWidth: size }} className="arc-gauge">
      {/* Zone arcs */}
      {zoneArcs}

      {/* Needle */}
      {hasScore && (
        <g className="arc-gauge__needle">
          <line
            x1={cx} y1={cy}
            x2={needleTip.x.toFixed(1)} y2={needleTip.y.toFixed(1)}
            stroke="rgba(255,255,255,0.85)" strokeWidth={2.5}
            strokeLinecap="round"
          />
          <circle
            cx={needleTip.x.toFixed(1)} cy={needleTip.y.toFixed(1)} r={5}
            fill={zoneColor} stroke="rgba(255,255,255,0.9)" strokeWidth={1.5}
          />
          <circle cx={cx} cy={cy} r={4} fill="rgba(255,255,255,0.5)" />
        </g>
      )}

      {/* Score number */}
      <text
        x={cx} y={126}
        textAnchor="middle"
        fontSize={46} fontWeight={800}
        fill={hasScore ? zoneColor : 'rgba(255,255,255,0.3)'}
        fontFamily="'Bricolage Grotesque', 'DM Sans', sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {hasScore ? score.toFixed(1) : '--'}
      </text>

      {/* Status label */}
      <text
        x={cx} y={150}
        textAnchor="middle"
        fontSize={12} fontWeight={600}
        fill="rgba(255,255,255,0.55)"
        fontFamily="'DM Sans', sans-serif"
        style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        {status}
      </text>
    </svg>
  );
}


/**
 * Mini anel circular SVG mostrando score como progresso.
 * Usado no header dos indicator cards.
 */
export function ScoreRing({ score, size = 44 }) {
  const strokeW = 3;
  const r = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const activeZone = getActiveZoneIndex(score);
  const zone = ZONES[Math.max(activeZone, 0)];
  const hasScore = score !== null && score !== undefined;
  const fill = hasScore ? Math.min(score / 120, 1) : 0;
  const dashOffset = circumference * (1 - fill);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring">
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="rgba(0,0,0,0.07)" strokeWidth={strokeW} fill="none"
      />
      {/* Filled arc */}
      {hasScore && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={zone.color} strokeWidth={strokeW} fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="score-ring__fill"
        />
      )}
      {/* Score text */}
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="central"
        fontSize={size * 0.3} fontWeight={700}
        fill={hasScore ? zone.color : '#ccc'}
        fontFamily="'DM Sans', sans-serif"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {hasScore ? score.toFixed(1) : '--'}
      </text>
    </svg>
  );
}

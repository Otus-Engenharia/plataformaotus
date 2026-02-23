import React from 'react';
import { getScoreStatus, getTrafficLightHex } from '../../../utils/indicator-utils';

/**
 * Timeline horizontal mostrando evolucao do score geral mês a mês.
 * Redesign: SVG line chart com pontos conectados, area gradient e dots coloridos.
 * @param {{ monthlyScores: Array<{ month: number, monthName: string, score: number|null, hasData: boolean }> }} props
 */
export default function MonthlyTimeline({ monthlyScores }) {
  if (!monthlyScores || monthlyScores.length === 0) return null;

  const currentMonth = new Date().getMonth() + 1;
  const count = monthlyScores.length;

  // SVG dimensions
  const padding = { top: 28, bottom: 30, left: 36, right: 36 };
  const width = 800;
  const height = 150;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Score range 0-140
  const maxScore = 140;
  const yScale = (score) => padding.top + chartH - (score / maxScore) * chartH;
  const xScale = (i) => count === 1
    ? padding.left + chartW / 2
    : padding.left + (i / (count - 1)) * chartW;

  // Build data points
  const points = monthlyScores.map((ms, i) => ({
    ...ms,
    x: xScale(i),
    y: ms.hasData ? yScale(ms.score) : null,
    color: ms.hasData ? getTrafficLightHex(ms.score) : '#d1d5db',
    isCurrent: ms.month === currentMonth,
  }));

  // Points with data for the line path
  const dataPoints = points.filter(p => p.y !== null);

  // Line path (straight segments)
  const linePath = dataPoints.length > 1
    ? `M ${dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
    : '';

  // Gradient area under the curve
  const areaPath = dataPoints.length > 1
    ? `${linePath} L ${dataPoints[dataPoints.length - 1].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} L ${dataPoints[0].x.toFixed(1)},${(padding.top + chartH).toFixed(1)} Z`
    : '';

  // Reference lines y positions
  const y80 = yScale(80);
  const y100 = yScale(100);

  return (
    <div className="monthly-timeline">
      <div className="monthly-timeline__label">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
        <span>Evolucao Mensal</span>
      </div>
      <div className="monthly-timeline__chart">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="timeline-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e6bb00" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#e6bb00" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Reference zone lines */}
          <line
            x1={padding.left} y1={y80}
            x2={width - padding.right} y2={y80}
            stroke="#ef4444" strokeWidth={0.7} strokeDasharray="6,4" opacity={0.25}
          />
          <text x={padding.left - 4} y={y80 + 3} textAnchor="end" fontSize={9} fill="#ef4444" opacity={0.5} fontFamily="'DM Sans', sans-serif">80</text>

          <line
            x1={padding.left} y1={y100}
            x2={width - padding.right} y2={y100}
            stroke="#22c55e" strokeWidth={0.7} strokeDasharray="6,4" opacity={0.25}
          />
          <text x={padding.left - 4} y={y100 + 3} textAnchor="end" fontSize={9} fill="#22c55e" opacity={0.5} fontFamily="'DM Sans', sans-serif">100</text>

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#timeline-area-grad)" className="timeline-area" />
          )}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              stroke="#e6bb00" strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
              className="timeline-line"
            />
          )}

          {/* Data points and labels */}
          {points.map((p) => (
            <g key={p.month}>
              {/* Month label at bottom */}
              <text
                x={p.x} y={height - 6}
                textAnchor="middle"
                fontSize={11}
                fill={p.isCurrent ? '#1a1a1a' : '#8a8a8a'}
                fontWeight={p.isCurrent ? 700 : 400}
                fontFamily="'DM Sans', sans-serif"
              >
                {p.monthName}
              </text>

              {p.hasData ? (
                <>
                  {/* Score label above dot */}
                  <text
                    x={p.x} y={p.y - 12}
                    textAnchor="middle"
                    fontSize={10} fontWeight={700} fill={p.color}
                    fontFamily="'DM Sans', sans-serif"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {p.score.toFixed(1)}
                  </text>
                  {/* Filled dot */}
                  <circle
                    cx={p.x} cy={p.y}
                    r={p.isCurrent ? 6.5 : 5}
                    fill={p.color} stroke="white" strokeWidth={2}
                    className={p.isCurrent ? 'timeline-dot--current' : ''}
                  />
                </>
              ) : (
                /* Hollow dot for empty months */
                <circle
                  cx={p.x} cy={yScale(70)}
                  r={3.5}
                  fill="none" stroke="#d1d5db" strokeWidth={1.5}
                  strokeDasharray="3,2" opacity={0.45}
                />
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

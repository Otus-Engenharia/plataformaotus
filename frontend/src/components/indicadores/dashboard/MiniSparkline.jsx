import React from 'react';

const ZONE_COLORS = {
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
  exceeded: '#1a1a1a',
  empty: '#d1d5db',
};

function getZoneColor(score) {
  if (score === null || score === undefined) return ZONE_COLORS.empty;
  if (score >= 120) return ZONE_COLORS.exceeded;
  if (score >= 100) return ZONE_COLORS.success;
  if (score >= 80) return ZONE_COLORS.warning;
  return ZONE_COLORS.danger;
}

/**
 * Mini sparkline SVG mostrando valores mensais vs metas
 * @param {{ months: Array<{ month: number, monthName: string, value: number|null, target: number, score: number|null }>, height?: number }} props
 */
export default function MiniSparkline({ months, height = 48 }) {
  if (!months || months.length === 0) return null;

  const padding = { top: 4, bottom: 14, left: 4, right: 4 };
  const barGap = 3;
  const barCount = months.length;
  const width = Math.max(barCount * 32, 120);
  const chartHeight = height - padding.top - padding.bottom;

  // Find max value for scale (include targets)
  const allValues = months.flatMap(m => [m.value, m.target].filter(v => v !== null && v !== undefined));
  const maxVal = allValues.length > 0 ? Math.max(...allValues) * 1.1 : 100;

  const barWidth = (width - padding.left - padding.right - barGap * (barCount - 1)) / barCount;

  const scaleY = (val) => {
    if (val === null || val === undefined || maxVal === 0) return chartHeight;
    return chartHeight - (val / maxVal) * chartHeight;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: 'block' }}
    >
      {months.map((m, i) => {
        const x = padding.left + i * (barWidth + barGap);
        const targetY = padding.top + scaleY(m.target);
        const hasValue = m.value !== null && m.value !== undefined;
        const valueY = hasValue ? padding.top + scaleY(m.value) : null;
        const barHeight = hasValue ? Math.max(chartHeight - scaleY(m.value), 2) : 0;
        const color = getZoneColor(m.score);

        return (
          <g key={m.month}>
            {/* Target marker line */}
            <line
              x1={x - 1}
              y1={targetY}
              x2={x + barWidth + 1}
              y2={targetY}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.6}
            />

            {/* Value bar */}
            {hasValue ? (
              <rect
                x={x}
                y={valueY}
                width={barWidth}
                height={barHeight}
                rx={2}
                fill={color}
                opacity={0.85}
              />
            ) : (
              /* Empty state - dashed outline */
              <rect
                x={x}
                y={padding.top + chartHeight - 2}
                width={barWidth}
                height={2}
                rx={1}
                fill="#e5e7eb"
              />
            )}

            {/* Month label */}
            <text
              x={x + barWidth / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize={8}
              fill={hasValue ? '#666' : '#bbb'}
              fontFamily="DM Sans, system-ui, sans-serif"
            >
              {m.monthName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

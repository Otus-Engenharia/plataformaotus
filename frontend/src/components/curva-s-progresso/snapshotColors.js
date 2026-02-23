// Cores para curva Baseline (cinza/grafite, tracejada longa)
const BASELINE_COLOR = '#6B7280';

// Cores para múltiplas baselines (grafite escuro ao cinza claro)
const BASELINE_COLORS = ['#374151', '#6B7280', '#9CA3AF', '#D1D5DB'];

function getBaselineColor(index) {
  return BASELINE_COLORS[index % BASELINE_COLORS.length];
}

// Cores para curvas de Reprogramados (verde-teal, tracejada curta)
const REPROGRAMADO_COLORS = [
  '#065F46', '#047857', '#059669', '#10B981',
  '#34D399', '#6EE7B7', '#0D9488', '#14B8A6',
];

// Cor do Executado (amber)
const EXECUTADO_COLOR = '#F59E0B';

function getReprogramadoColor(index, total) {
  if (total <= REPROGRAMADO_COLORS.length) {
    const step = REPROGRAMADO_COLORS.length / total;
    return REPROGRAMADO_COLORS[Math.min(Math.floor(index * step), REPROGRAMADO_COLORS.length - 1)];
  }
  return REPROGRAMADO_COLORS[index % REPROGRAMADO_COLORS.length];
}

// Cores para barras de progresso mensal (com alpha)
const BASELINE_BAR_COLORS = [
  'rgba(55, 65, 81, 0.40)',
  'rgba(107, 114, 128, 0.40)',
  'rgba(156, 163, 175, 0.40)',
  'rgba(209, 213, 219, 0.40)',
];

const EXECUTADO_BAR_COLOR = 'rgba(245, 158, 11, 0.45)';

function getBaselineBarColor(index) {
  return BASELINE_BAR_COLORS[index % BASELINE_BAR_COLORS.length];
}

// Alias para retrocompatibilidade
function getSnapshotColor(index, total) {
  return getReprogramadoColor(index, total);
}

export {
  BASELINE_COLOR,
  BASELINE_COLORS,
  REPROGRAMADO_COLORS,
  EXECUTADO_COLOR,
  EXECUTADO_BAR_COLOR,
  BASELINE_BAR_COLORS,
  getBaselineColor,
  getBaselineBarColor,
  getReprogramadoColor,
  getSnapshotColor,
};

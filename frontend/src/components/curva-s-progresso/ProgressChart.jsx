/**
 * Componente: Gráfico Curva S de Progresso Físico
 * Exibe múltiplas curvas: Baseline Original, Reprogramações mensais (snapshots),
 * Executado (realizado) e Projeção Atual.
 */

import React, { useMemo, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { BASELINE_COLOR, EXECUTADO_COLOR, EXECUTADO_BAR_COLOR, getReprogramadoColor, getBaselineColor, getBaselineBarColor } from './snapshotColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Tooltip externo HTML agrupado por categoria
function getOrCreateTooltipEl(chart) {
  let el = chart.canvas.parentNode.querySelector('.chart-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.className = 'chart-tooltip';
    chart.canvas.parentNode.appendChild(el);
  }
  return el;
}

function externalTooltipHandler(context) {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateTooltipEl(chart);

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0';
    tooltipEl.style.pointerEvents = 'none';
    return;
  }

  // Filtrar items válidos
  const items = tooltip.dataPoints?.filter(item =>
    item.parsed.y != null && !(item.dataset.type === 'bar' && item.parsed.y === 0)
  ) || [];

  if (items.length === 0) {
    tooltipEl.style.opacity = '0';
    return;
  }

  // Agrupar por categoria usando dataset.order
  const acumulado = items.filter(i => (i.dataset.order ?? 0) < 2);
  const mensal = items.filter(i => (i.dataset.order ?? 0) >= 2);

  // Construir HTML
  let html = `<div class="chart-tooltip-title">${tooltip.title?.[0] || ''}</div>`;

  if (acumulado.length > 0) {
    html += '<div class="chart-tooltip-section">';
    html += '<div class="chart-tooltip-section-header">Acumulado</div>';
    acumulado.forEach(item => {
      const color = item.dataset.borderColor || item.dataset.backgroundColor;
      const isDashed = item.dataset.borderDash && item.dataset.borderDash.length > 0;
      const isThick = (item.dataset.borderWidth || 1) >= 3;
      let lineStyle = 'solid';
      if (isDashed) lineStyle = 'dashed';

      html += `<div class="chart-tooltip-item">
        <span class="chart-tooltip-swatch" style="
          background: transparent;
          border-top: ${isThick ? '3px' : '2px'} ${lineStyle} ${color};
        "></span>
        <span class="chart-tooltip-label">${item.dataset.label}</span>
        <span class="chart-tooltip-value">${item.parsed.y.toFixed(2)}%</span>
      </div>`;
    });
    html += '</div>';
  }

  if (mensal.length > 0) {
    html += '<div class="chart-tooltip-section">';
    html += '<div class="chart-tooltip-section-header">Mensal</div>';
    mensal.forEach(item => {
      const color = item.dataset.backgroundColor || item.dataset.borderColor;
      html += `<div class="chart-tooltip-item">
        <span class="chart-tooltip-swatch chart-tooltip-swatch-bar" style="background: ${color}; border-color: ${item.dataset.borderColor};"></span>
        <span class="chart-tooltip-label">${item.dataset.label}</span>
        <span class="chart-tooltip-value">${item.parsed.y.toFixed(2)}%</span>
      </div>`;
    });
    html += '</div>';
  }

  tooltipEl.innerHTML = html;
  tooltipEl.style.opacity = '1';
  tooltipEl.style.pointerEvents = 'none';

  // Posicionar
  const { offsetLeft, offsetTop } = chart.canvas;
  const tooltipWidth = tooltipEl.offsetWidth;
  const chartWidth = chart.width;
  let left = offsetLeft + tooltip.caretX + 12;

  // Se sair pela direita, mostrar à esquerda do cursor
  if (left + tooltipWidth > offsetLeft + chartWidth) {
    left = offsetLeft + tooltip.caretX - tooltipWidth - 12;
  }

  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = offsetTop + tooltip.caretY + 'px';
}

function ProgressChart({
  timeseries,
  snapshotCurves,
  baselineCurve,
  baselineCurves,
  visibleBaselines,
  visibleSnapshots,
  showExecutado,
  showBaseline,
  showBarExecutado = true,
  visibleBaselineBars,
  loading,
}) {
  // Todas as baselines disponíveis (novo sistema + fallback)
  const allBaselines = useMemo(() => {
    if (baselineCurves && baselineCurves.length > 0) return baselineCurves;
    if (baselineCurve) return [baselineCurve];
    return [];
  }, [baselineCurves, baselineCurve]);

  // Contagem de curvas visíveis para subtítulo
  const curveCount = useMemo(() => {
    const baseline = showBaseline
      ? allBaselines.filter(b => !visibleBaselines || visibleBaselines.has(b.id ?? b.label)).length
      : 0;
    const snapshots = snapshotCurves
      ? snapshotCurves.filter(sc => !visibleSnapshots || visibleSnapshots.has(sc.snapshot_date)).length
      : 0;
    const executado = showExecutado ? 1 : 0;
    return { baseline, snapshots, executado };
  }, [showBaseline, allBaselines, visibleBaselines, snapshotCurves, visibleSnapshots, showExecutado]);

  const counterText = useMemo(() => {
    const parts = [];
    if (curveCount.baseline > 0) parts.push(`${curveCount.baseline} baseline`);
    if (curveCount.snapshots > 0) parts.push(`${curveCount.snapshots} reprogramado(s)`);
    if (curveCount.executado > 0) parts.push('Executado');
    return parts.length > 0 ? parts.join(', ') : 'Nenhuma curva selecionada';
  }, [curveCount]);

  const chartData = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return null;

    const labels = timeseries.map(t => t.month);
    const datasets = [];

    // ========================================
    // BARRAS MENSAIS (order: 2 = renderizam atrás)
    // ========================================

    // Barras das Baselines (cinza semi-transparente)
    if (showBaseline && allBaselines.length > 0) {
      allBaselines.forEach((bl, idx) => {
        if (!bl.timeseries) return;
        const blKey = bl.id ?? bl.label;
        // visibleBaselineBars é sempre um Set; se não existe ou não contém a key, pular
        if (!visibleBaselineBars || !visibleBaselineBars.has(blKey)) return;

        const data = labels.map(label => {
          const point = bl.timeseries.find(t => t.month === label);
          return point ? point.monthly_increment : null;
        });

        const color = allBaselines.length > 1 ? getBaselineColor(idx) : BASELINE_COLOR;

        datasets.push({
          type: 'bar',
          label: `Mensal ${bl.label || bl.revision_label || 'Baseline'}`,
          data,
          yAxisID: 'y1',
          backgroundColor: getBaselineBarColor(idx),
          borderColor: color,
          borderWidth: 1,
          barPercentage: 0.7,
          categoryPercentage: 0.85,
          order: 2,
        });
      });
    }

    // Barras do Executado (amber semi-transparente)
    if (showBarExecutado && showExecutado !== false) {
      datasets.push({
        type: 'bar',
        label: 'Progresso Mensal',
        data: timeseries.map(t => t.monthly_increment),
        yAxisID: 'y1',
        backgroundColor: EXECUTADO_BAR_COLOR,
        borderColor: EXECUTADO_COLOR,
        borderWidth: 1,
        barPercentage: 0.7,
        categoryPercentage: 0.85,
        order: 2,
      });
    }

    // ========================================
    // LINHAS ACUMULADAS (order: 1 = renderizam na frente)
    // ========================================

    // 1. Baselines (cinza, tracejadas) - renderizar primeiro (fundo)
    if (showBaseline && allBaselines.length > 0) {
      allBaselines.forEach((bl, idx) => {
        if (!bl.timeseries) return;
        const blKey = bl.id ?? bl.label;
        if (visibleBaselines && !visibleBaselines.has(blKey)) return;

        const data = labels.map(label => {
          const point = bl.timeseries.find(t => t.month === label);
          return point ? point.cumulative_progress : null;
        });

        const color = allBaselines.length > 1 ? getBaselineColor(idx) : BASELINE_COLOR;
        const dashPattern = idx === 0 ? [8, 4] : [4 + idx * 2, 4];

        datasets.push({
          label: bl.label || bl.revision_label || 'Baseline',
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: dashPattern,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointBackgroundColor: color,
          spanGaps: true,
          order: 1,
        });
      });
    }

    // 2. Curvas de snapshots (reprogramações) - verde-teal, tracejadas curtas
    if (snapshotCurves && snapshotCurves.length > 0) {
      const visible = snapshotCurves.filter(sc =>
        !visibleSnapshots || visibleSnapshots.has(sc.snapshot_date)
      );

      visible.forEach((sc, idx) => {
        const data = labels.map(label => {
          const point = sc.timeseries.find(t => t.month === label);
          return point ? point.cumulative_progress : null;
        });

        const color = getReprogramadoColor(idx, visible.length);

        datasets.push({
          label: `Reprog. ${sc.label}`,
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 3],
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointBackgroundColor: color,
          spanGaps: true,
          order: 1,
        });
      });
    }

    // 3. Executado (linha grossa amber) - dados realizados
    if (showExecutado !== false) {
      const realizado = timeseries.map(t => t.is_past ? t.cumulative_progress : null);
      const lastPastIndex = timeseries.reduce((acc, t, i) => t.is_past ? i : acc, -1);

      datasets.push({
        label: 'Executado',
        data: realizado,
        borderColor: EXECUTADO_COLOR,
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: EXECUTADO_COLOR,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        spanGaps: false,
        order: 0,
      });

      // 4. Projeção Atual (tracejada amber)
      const projecao = timeseries.map(t => t.is_past ? null : t.cumulative_progress);

      // Conectar as duas curvas no ponto de transição
      if (lastPastIndex >= 0 && lastPastIndex < timeseries.length - 1) {
        projecao[lastPastIndex] = realizado[lastPastIndex];
      }

      datasets.push({
        label: 'Projeção Atual',
        data: projecao,
        borderColor: EXECUTADO_COLOR,
        backgroundColor: 'rgba(245, 158, 11, 0.03)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: EXECUTADO_COLOR,
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        spanGaps: false,
        order: 0,
      });
    }

    return { labels, datasets };
  }, [timeseries, snapshotCurves, allBaselines, visibleBaselines, visibleSnapshots, showExecutado, showBaseline, showBarExecutado, visibleBaselineBars]);

  const options = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return {};

    const todayIndex = timeseries.reduce((acc, t, i) => t.is_past ? i : acc, -1);

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        datalabels: { display: false },
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
          mode: 'index',
          intersect: false,
          external: externalTooltipHandler,
        },
        todayLine: { todayIndex },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: {
            font: { size: 10 },
            callback: (value) => `${value}%`,
            stepSize: 10,
          },
          title: {
            display: true,
            text: 'Progresso acumulado (%)',
            font: { size: 10 },
            color: '#888',
          },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: {
            font: { size: 10 },
            callback: (value) => `${value}%`,
          },
          title: {
            display: true,
            text: 'Progresso mensal (%)',
            font: { size: 10 },
            color: '#888',
          },
        },
      },
    };
  }, [timeseries]);

  // Plugin para desenhar linha vertical "Hoje"
  const todayLinePlugin = useMemo(() => ({
    id: 'todayLine',
    afterDraw: (chart) => {
      const todayIndex = chart.options.plugins.todayLine?.todayIndex;
      if (todayIndex == null || todayIndex < 0) return;

      let x = null;
      for (const meta of chart.getSortedVisibleDatasetMetas()) {
        if (meta.data[todayIndex]) {
          x = meta.data[todayIndex].x;
          break;
        }
      }
      if (x == null) return;

      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.4)';
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(26, 26, 26, 0.7)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hoje', x, top - 4);
      ctx.restore();
    },
  }), []);

  if (loading) {
    return (
      <div className="progress-chart-container">
        <div className="progress-chart-loading">Calculando série temporal...</div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="progress-chart-container">
        <div className="progress-chart-empty">
          Sem dados para exibir o gráfico.
          <br /><small style={{ opacity: 0.7 }}>Verifique se as tarefas possuem datas de término no cronograma.</small>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-chart-container">
      <div className="progress-chart-header">
        <h4>Avanço do projeto</h4>
        <span className="progress-chart-counter">
          Mostrando: {counterText}
        </span>
      </div>
      <div className="progress-chart-wrapper">
        <Chart
          type="line"
          data={{ labels: chartData.labels, datasets: chartData.datasets }}
          options={options}
          plugins={[todayLinePlugin]}
        />
      </div>
    </div>
  );
}

export default ProgressChart;

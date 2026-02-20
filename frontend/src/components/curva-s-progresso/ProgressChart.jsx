/**
 * Componente: Gráfico Curva S de Progresso Físico
 * Exibe múltiplas curvas: Executado, Projeção Atual e Reprogramações mensais (snapshots)
 */

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getSnapshotColor } from './snapshotColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function ProgressChart({ timeseries, snapshotCurves, visibleSnapshots, showExecutado, loading }) {
  const chartData = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return null;

    const labels = timeseries.map(t => t.month);
    const datasets = [];

    // 1. Curvas de snapshots (reprogramações) - renderizar primeiro (fundo)
    if (snapshotCurves && snapshotCurves.length > 0) {
      const visible = snapshotCurves.filter(sc =>
        !visibleSnapshots || visibleSnapshots.has(sc.snapshot_date)
      );

      visible.forEach((sc, idx) => {
        const data = labels.map(label => {
          const point = sc.timeseries.find(t => t.month === label);
          return point ? point.cumulative_progress : null;
        });

        const color = getSnapshotColor(idx, visible.length);

        datasets.push({
          label: `Reprog. ${sc.label}`,
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          pointBackgroundColor: color,
          spanGaps: true,
        });
      });
    }

    // 2. Executado (linha grossa dourada) - dados realizados
    if (showExecutado !== false) {
      const realizado = timeseries.map(t => t.is_past ? t.cumulative_progress : null);
      const lastPastIndex = timeseries.reduce((acc, t, i) => t.is_past ? i : acc, -1);

      datasets.push({
        label: 'Executado',
        data: realizado,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.06)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#F59E0B',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        spanGaps: false,
      });

      // 3. Projeção Atual (tracejada dourada)
      const projecao = timeseries.map(t => t.is_past ? null : t.cumulative_progress);

      // Conectar as duas curvas no ponto de transição
      if (lastPastIndex >= 0 && lastPastIndex < timeseries.length - 1) {
        projecao[lastPastIndex] = realizado[lastPastIndex];
      }

      datasets.push({
        label: 'Projeção Atual',
        data: projecao,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.03)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        fill: true,
        pointRadius: 2,
        pointBackgroundColor: '#F59E0B',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        spanGaps: false,
      });
    }

    return { labels, datasets };
  }, [timeseries, snapshotCurves, visibleSnapshots, showExecutado]);

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
        legend: {
          display: false, // Legenda custom abaixo do gráfico
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          padding: 10,
          callbacks: {
            label: (context) => {
              if (context.parsed.y == null) return null;
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`;
            },
          },
        },
        todayLine: { todayIndex },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: {
            font: { size: 11 },
            callback: (value) => `${value}%`,
            stepSize: 10,
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
        <h4>Curva S - Progresso Físico</h4>
      </div>
      <div className="progress-chart-wrapper">
        <Line
          data={{ labels: chartData.labels, datasets: chartData.datasets }}
          options={options}
          plugins={[todayLinePlugin]}
        />
      </div>
      <div className="progress-chart-legend">
        {chartData.datasets.map((ds, i) => (
          <span key={i} className="legend-item">
            <span
              className="legend-color"
              style={ds.borderDash
                ? {
                    display: 'inline-block',
                    width: '20px',
                    height: '2px',
                    borderTop: `2px dashed ${ds.borderColor}`,
                    backgroundColor: 'transparent',
                    verticalAlign: 'middle',
                  }
                : {
                    display: 'inline-block',
                    width: '20px',
                    height: ds.borderWidth >= 3 ? '3px' : '2px',
                    backgroundColor: ds.borderColor,
                    verticalAlign: 'middle',
                  }
              }
            />
            <span className="legend-label">{ds.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default ProgressChart;

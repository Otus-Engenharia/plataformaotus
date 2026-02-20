/**
 * Componente: Gráfico Curva S de Progresso Físico
 * Exibe curva "Atual" (realizado + projeção) com Chart.js
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

function ProgressChart({ timeseries, loading }) {
  const chartData = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return null;

    // Separar dados realizados vs projetados
    const labels = timeseries.map(t => t.month);
    const realizado = [];
    const projecao = [];
    let lastPastIndex = -1;

    for (let i = 0; i < timeseries.length; i++) {
      const t = timeseries[i];
      if (t.is_past) {
        realizado.push(t.cumulative_progress);
        projecao.push(null);
        lastPastIndex = i;
      } else {
        realizado.push(null);
        projecao.push(t.cumulative_progress);
      }
    }

    // Conectar as duas curvas no ponto de transição
    if (lastPastIndex >= 0 && lastPastIndex < timeseries.length - 1) {
      projecao[lastPastIndex] = realizado[lastPastIndex];
    }

    return {
      labels,
      datasets: [
        {
          label: 'Realizado',
          data: realizado,
          borderColor: '#d4a800',
          backgroundColor: 'rgba(212, 168, 0, 0.08)',
          borderWidth: 3,
          tension: 0.3,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: '#d4a800',
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          spanGaps: false,
        },
        {
          label: 'Projeção',
          data: projecao,
          borderColor: '#d4a800',
          backgroundColor: 'rgba(212, 168, 0, 0.03)',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.3,
          fill: true,
          pointRadius: 2,
          pointBackgroundColor: '#d4a800',
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          spanGaps: false,
        },
      ],
      lastPastIndex,
    };
  }, [timeseries]);

  const options = useMemo(() => {
    if (!timeseries || timeseries.length === 0) return {};

    // Encontrar index do "hoje"
    let todayIndex = -1;
    for (let i = 0; i < timeseries.length; i++) {
      if (timeseries[i].is_past) todayIndex = i;
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            padding: 16,
            font: { size: 12 },
          },
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
            afterBody: (contexts) => {
              const idx = contexts[0]?.dataIndex;
              if (idx == null || !timeseries[idx]) return '';
              const t = timeseries[idx];
              if (t.monthly_increment > 0) {
                return `Incremento: +${t.monthly_increment.toFixed(2)}%`;
              }
              return '';
            },
          },
        },
        // Vertical "Hoje" line plugin
        todayLine: {
          todayIndex,
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0,0,0,0.04)',
          },
          ticks: {
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(0,0,0,0.06)',
          },
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

      const meta = chart.getDatasetMeta(0);
      if (!meta.data[todayIndex]) return;

      const x = meta.data[todayIndex].x;
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

      // Label "Hoje"
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
        <div className="progress-chart-empty">Sem dados para exibir o gráfico</div>
      </div>
    );
  }

  return (
    <div className="progress-chart-container">
      <div className="progress-chart-header">
        <h4>Curva S - Progresso Físico</h4>
        <div className="progress-chart-legend-info">
          <span className="legend-realizado">Realizado</span>
          <span className="legend-projecao">Projeção</span>
        </div>
      </div>
      <div className="progress-chart-wrapper">
        <Line
          data={{ labels: chartData.labels, datasets: chartData.datasets }}
          options={options}
          plugins={[todayLinePlugin]}
        />
      </div>
    </div>
  );
}

export default ProgressChart;

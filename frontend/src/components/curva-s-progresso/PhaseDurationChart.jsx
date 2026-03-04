/**
 * Componente: Gráfico de Duração por Fase (Cronograma Fases)
 * Exibe barras horizontais comparando a duração por fase:
 * - Executado: span das tarefas concluídas (amber sólido)
 * - A Executar: span das tarefas pendentes (amber transparente)
 * - Baselines: duração prevista no momento do snapshot (cinzas)
 *
 * Datasets ativáveis/desativáveis por checkboxes na sidebar.
 */

import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import { EXECUTADO_COLOR, CRONOGRAMA_ATUAL_COLOR, BASELINE_COLORS, getBaselineColor } from './snapshotColors';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// Ícones SVG
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Mapa status do portfolio → índice da fase atual no gráfico
// -1 = nenhuma fase iniciou, 99 = todas finalizadas
const STATUS_TO_PHASE_INDEX = {
  'a iniciar': -1,
  'planejamento': -1,
  'fase 01': 0,
  'fase 02': 1,
  'fase 03': 2,
  'fase 04': 3,
  'pausado - f01': 0,
  'pausado - f02': 1,
  'pausado - f03': 2,
  'pausado - f04': 3,
  'termo de encerramento': 99,
  'execução': 99,
  'obra finalizada': 99,
  'close': 99,
  'churn pelo cliente': -1,
};

function PhaseDurationChart({ data, visibleDatasets, onToggleDataset, faseAtual }) {
  const [baselinesOpen, setBaselinesOpen] = useState(true);

  const { phases, actual, baselines } = data || {};

  // Derivar keys dos datasets
  const FINALIZADO_KEY = 'finalizado';
  const A_INICIAR_KEY = 'a_iniciar';

  const isVisible = (key) => {
    if (!visibleDatasets) return true;
    return visibleDatasets.has(key);
  };

  // Índice da fase atual no array de fases
  const faseAtualIndex = useMemo(() => {
    if (!faseAtual || !phases) return -1;
    const key = faseAtual.toLowerCase().trim();
    const idx = STATUS_TO_PHASE_INDEX[key];
    return idx != null ? idx : -1;
  }, [faseAtual, phases]);

  // Montar datasets Chart.js
  const chartData = useMemo(() => {
    if (!phases || !actual) return { labels: [], datasets: [] };

    const datasets = [];
    const datalabelConfig = {
      display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
      color: '#fff',
      font: { size: 11, weight: '600' },
      anchor: 'center',
      align: 'center',
      formatter: (v) => `${v}d`,
    };

    // Dataset único de duração real com cor por barra (Finalizado=amber, Cronograma Atual=laranja claro)
    const showFinalizado = isVisible(FINALIZADO_KEY);
    const showCronograma = isVisible(A_INICIAR_KEY);

    datasets.push({
      label: 'Duração Real',
      data: phases.map((f, idx) => {
        const isFinalizado = faseAtualIndex >= 0 && idx < faseAtualIndex;
        if (isFinalizado && !showFinalizado) return 0;
        if (!isFinalizado && !showCronograma) return 0;
        return actual.executado?.[f] ?? 0;
      }),
      backgroundColor: phases.map((_, idx) =>
        faseAtualIndex >= 0 && idx < faseAtualIndex ? EXECUTADO_COLOR : CRONOGRAMA_ATUAL_COLOR
      ),
      borderWidth: 0,
      barThickness: 18,
      borderRadius: 3,
      datalabels: datalabelConfig,
    });

    // Datasets por baseline
    (baselines || []).forEach((bl, idx) => {
      const blKey = `bl_${bl.id}`;
      if (!isVisible(blKey)) return;
      const color = getBaselineColor(idx);
      datasets.push({
        label: bl.revision_label || bl.label,
        data: phases.map(f => bl.durations?.[f] ?? 0),
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        barThickness: 18,
        borderRadius: 3,
        datalabels: datalabelConfig,
      });
    });

    return {
      labels: phases,
      datasets,
    };
  }, [phases, actual, baselines, visibleDatasets, faseAtualIndex]);

  const chartHeight = Math.max(200, (phases?.length || 1) * 70 + 60);

  const chartOptions = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} dias`,
        },
      },
      datalabels: { display: false }, // desabilitado globalmente, cada dataset configura o seu
    },
    scales: {
      x: {
        beginAtZero: true,
        title: { display: true, text: 'Dias', font: { size: 11 }, color: '#6b7280' },
        ticks: { font: { size: 11 }, color: '#374151' },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      y: {
        ticks: { font: { size: 12, weight: '500' }, color: '#374151' },
        grid: { display: false },
      },
    },
  }), []);

  if (!data) return null;

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', minHeight: chartHeight + 40 }}>
      {/* Sidebar de filtros */}
      <div style={{
        width: '190px',
        flexShrink: 0,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '0.75rem',
        fontSize: '0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        overflowY: 'auto',
      }}>
        <div style={{ fontWeight: '600', fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
          Visibilidade
        </div>

        {/* Executado */}
        <ToggleRow
          color={EXECUTADO_COLOR}
          label="Finalizado"
          visible={isVisible(FINALIZADO_KEY)}
          onToggle={() => onToggleDataset(FINALIZADO_KEY)}
          solid
        />

        {/* Cronograma Atual */}
        <ToggleRow
          color={CRONOGRAMA_ATUAL_COLOR}
          label="Cronograma Atual"
          visible={isVisible(A_INICIAR_KEY)}
          onToggle={() => onToggleDataset(A_INICIAR_KEY)}
          solid
        />

        {/* Baselines */}
        {baselines && baselines.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => setBaselinesOpen(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: '600', color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '0.25rem 0', width: '100%',
              }}
            >
              <span style={{ fontSize: '0.65rem' }}>{baselinesOpen ? '▾' : '▸'}</span>
              Baselines
              <span style={{ marginLeft: 'auto', fontWeight: '400', color: '#9ca3af' }}>
                {baselines.filter((_, i) => isVisible(`bl_${baselines[i].id}`)).length}/{baselines.length}
              </span>
            </button>

            {baselinesOpen && baselines.map((bl, idx) => {
              const blKey = `bl_${bl.id}`;
              const color = getBaselineColor(idx);
              return (
                <ToggleRow
                  key={blKey}
                  color={color}
                  label={bl.revision_label || bl.label}
                  sublabel={bl.snapshot_date ? new Date(bl.snapshot_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : undefined}
                  visible={isVisible(blKey)}
                  onToggle={() => onToggleDataset(blKey)}
                  solid
                />
              );
            })}
          </div>
        )}

        {(!baselines || baselines.length === 0) && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#9ca3af', fontStyle: 'italic' }}>
            Nenhuma baseline cadastrada
          </div>
        )}
      </div>

      {/* Área do gráfico */}
      <div style={{ flex: 1, minWidth: 0, height: chartHeight }}>
        <Bar data={chartData} options={chartOptions} height={chartHeight} />
      </div>
    </div>
  );
}

function ToggleRow({ color, label, sublabel, visible, onToggle, solid, dashed }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0.3rem 0.25rem', borderRadius: '4px', width: '100%',
        textAlign: 'left', opacity: visible ? 1 : 0.45,
        transition: 'opacity 0.15s',
      }}
    >
      <span style={{ color: visible ? '#374151' : '#9ca3af', flexShrink: 0 }}>
        {visible ? <EyeIcon /> : <EyeOffIcon />}
      </span>
      <span style={{
        width: '22px', height: '4px', borderRadius: '2px',
        flexShrink: 0,
        background: solid ? color : 'transparent',
        border: dashed ? `2px dashed ${color}` : 'none',
        opacity: solid ? 1 : 0.7,
      }} />
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.78rem', color: '#374151', fontWeight: visible ? '500' : '400', lineHeight: '1.2' }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: '0.68rem', color: '#9ca3af', lineHeight: '1.2' }}>{sublabel}</span>
        )}
      </span>
    </button>
  );
}

export default PhaseDurationChart;

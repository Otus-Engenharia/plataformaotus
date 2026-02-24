/**
 * Componente: Seção do Gráfico S-Curve para Vista do Cliente
 *
 * Reutiliza ProgressChart e ChartFilterSidebar existentes.
 * Adiciona header com prazos do projeto.
 */

import React from 'react';
import ProgressChart from '../../components/curva-s-progresso/ProgressChart';
import ChartFilterSidebar from '../../components/curva-s-progresso/ChartFilterSidebar';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ChartSection({
  prazos,
  timeseries,
  snapshotCurves,
  baselineCurve,
  baselineCurves,
  timeseriesLoading,
  // Filtros
  showExecutado,
  onToggleExecutado,
  showBaseline,
  onToggleBaseline,
  visibleBaselines,
  onToggleBaseline2,
  visibleSnapshots,
  onToggleSnapshot,
  onSelectAllSnapshots,
  onClearAllSnapshots,
  showBarExecutado,
  onToggleBarExecutado,
  visibleBaselineBars,
  onToggleBaselineBar,
  visibleBaselinesSet,
}) {
  const variacaoDias = prazos?.variacao_dias;

  return (
    <div className="vc-chart-section">
      {/* Sidebar de filtros (baselines, reprogramados) */}
      <div className="vc-chart-sidebar">
        <ChartFilterSidebar
          showExecutado={showExecutado}
          onToggleExecutado={onToggleExecutado}
          baselineCurve={baselineCurve}
          baselineCurves={baselineCurves}
          showBaseline={showBaseline}
          onToggleBaseline={onToggleBaseline}
          visibleBaselines={visibleBaselines}
          onToggleBaseline2={onToggleBaseline2}
          snapshotCurves={snapshotCurves}
          visibleSnapshots={visibleSnapshots}
          onToggleSnapshot={onToggleSnapshot}
          onSelectAllSnapshots={onSelectAllSnapshots}
          onClearAllSnapshots={onClearAllSnapshots}
          showBarExecutado={showBarExecutado}
          onToggleBarExecutado={onToggleBarExecutado}
          visibleBaselineBars={visibleBaselineBars}
          onToggleBaselineBar={onToggleBaselineBar}
        />
      </div>

      {/* Área principal do gráfico */}
      <div className="vc-chart-main">
        {/* Header com prazos */}
        <div className="vc-chart-header">
          <h4 className="vc-chart-title">Avanço do projeto</h4>
          <div className="vc-chart-prazos">
            {prazos?.prazo_baseline && (
              <div className="vc-chart-prazo-item">
                <span className="vc-chart-prazo-label">Prazo base</span>
                <span className="vc-chart-prazo-value">{formatDate(prazos.prazo_baseline)}</span>
              </div>
            )}
            {prazos?.prazo_reprogramado && (
              <div className="vc-chart-prazo-item">
                <span className="vc-chart-prazo-label">Prazo reprogramado</span>
                <span className="vc-chart-prazo-value">{formatDate(prazos.prazo_reprogramado)}</span>
              </div>
            )}
            {prazos?.prazo_atual && (
              <div className="vc-chart-prazo-item">
                <span className="vc-chart-prazo-label">Prazo atual</span>
                <span className={`vc-chart-prazo-value ${variacaoDias > 0 ? 'atrasado' : ''}`}>
                  {formatDate(prazos.prazo_atual)}
                </span>
              </div>
            )}
            {variacaoDias != null && (
              <div className="vc-chart-prazo-item">
                <span className="vc-chart-prazo-label">Variação (dias)</span>
                <span className={`vc-chart-prazo-value ${variacaoDias > 0 ? 'variacao-positiva' : variacaoDias < 0 ? 'variacao-negativa' : ''}`}>
                  {variacaoDias > 0 ? '+' : ''}{variacaoDias}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico */}
        <div className="vc-chart-area">
          <ProgressChart
            timeseries={timeseries}
            snapshotCurves={snapshotCurves}
            baselineCurve={baselineCurve}
            baselineCurves={baselineCurves}
            visibleBaselines={visibleBaselines}
            visibleSnapshots={visibleSnapshots}
            showExecutado={showExecutado}
            showBaseline={showBaseline}
            showBarExecutado={showBarExecutado}
            visibleBaselineBars={visibleBaselineBars}
            loading={timeseriesLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default ChartSection;

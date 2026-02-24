/**
 * Componente: Seção do Gráfico S-Curve para Vista do Cliente
 *
 * Reutiliza ProgressChart e ChartFilterSidebar existentes.
 * Header + gráfico com scroll horizontal.
 */

import React from 'react';
import ProgressChart from '../../components/curva-s-progresso/ProgressChart';
import ChartFilterSidebar from '../../components/curva-s-progresso/ChartFilterSidebar';

function ChartSection({
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
}) {
  // Calcular min-width para scroll horizontal em projetos longos
  const chartMinWidth = timeseries.length > 24
    ? `${Math.max(800, timeseries.length * 36)}px`
    : '100%';

  return (
    <div className="vc-chart-section">
      {/* Sidebar de filtros (baselines, reprogramados, legenda) */}
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

      {/* Área principal */}
      <div className="vc-chart-main">
        <div className="vc-chart-header">
          <h4 className="vc-chart-title">Avanço do projeto</h4>
        </div>

        {/* Gráfico com scroll horizontal */}
        <div className="vc-chart-area">
          <div className="vc-chart-scroll" style={{ minWidth: chartMinWidth }}>
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
    </div>
  );
}

export default ChartSection;

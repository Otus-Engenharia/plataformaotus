/**
 * Componente: Sidebar de Filtros da Curva S
 * Permite ativar/desativar curvas individuais: Executado, Baseline e Reprogramados mensais.
 * Inspirado no design do Lovable com seções colapsáveis e quick actions.
 */

import React, { useState } from 'react';
import { BASELINE_COLOR, EXECUTADO_COLOR, EXECUTADO_BAR_COLOR, getReprogramadoColor, getBaselineColor, getBaselineBarColor } from './snapshotColors';

// Ícones SVG inline
const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const BarChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="0.5" />
    <rect x="10" y="7" width="4" height="14" rx="0.5" />
    <rect x="17" y="3" width="4" height="18" rx="0.5" />
  </svg>
);

function ChartFilterSidebar({
  showExecutado,
  onToggleExecutado,
  baselineCurve,
  baselineCurves = [],
  showBaseline,
  onToggleBaseline,
  visibleBaselines,
  onToggleBaseline2,
  snapshotCurves,
  visibleSnapshots,
  onToggleSnapshot,
  onSelectAllSnapshots,
  onClearAllSnapshots,
  showBarExecutado,
  onToggleBarExecutado,
  visibleBaselineBars,
  onToggleBaselineBar,
}) {
  const [baselinesOpen, setBaselinesOpen] = useState(true);
  const [reprogramadosOpen, setReprogramadosOpen] = useState(true);
  const [barrasOpen, setBarrasOpen] = useState(true);

  const visibleSnapshotCount = visibleSnapshots
    ? visibleSnapshots.size
    : snapshotCurves.length;

  // Combinar baselines: novas (baselineCurves) ou fallback (baselineCurve)
  const allBaselines = baselineCurves.length > 0
    ? baselineCurves
    : (baselineCurve ? [baselineCurve] : []);

  const isBaselineVisible = (bl) => {
    const key = bl.id ?? bl.label;
    return !visibleBaselines || visibleBaselines.has(key);
  };

  const visibleBaselineCount = allBaselines.filter(isBaselineVisible).length;

  const isSnapshotVisible = (date) =>
    !visibleSnapshots || visibleSnapshots.has(date);

  return (
    <div className="chart-filter-sidebar">
      {/* Executado toggle */}
      <div className="cfs-section">
        <button
          className={`cfs-executado-toggle ${showExecutado ? 'active' : ''}`}
          onClick={onToggleExecutado}
        >
          <span className="cfs-toggle-icon">
            {showExecutado ? <EyeIcon /> : <EyeOffIcon />}
          </span>
          <span
            className="cfs-line-preview cfs-line-solid"
            style={{ backgroundColor: EXECUTADO_COLOR, height: '3px' }}
          />
          <span className="cfs-toggle-label">Executado</span>
        </button>
      </div>

      {/* Baselines section */}
      {allBaselines.length > 0 && (
        <div className="cfs-section">
          <button
            className="cfs-section-header"
            onClick={() => setBaselinesOpen(!baselinesOpen)}
          >
            <span className="cfs-chevron">
              {baselinesOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
            <span className="cfs-section-title">Baselines</span>
            <span className="cfs-count">{visibleBaselineCount}/{allBaselines.length}</span>
          </button>
          {baselinesOpen && (
            <div className="cfs-section-content">
              {allBaselines.length > 1 && (
                <div className="cfs-quick-actions">
                  <button onClick={() => {
                    // Tornar todas visíveis (null = todas)
                    if (visibleBaselines) {
                      allBaselines.forEach(bl => {
                        const key = bl.id ?? bl.label;
                        if (!visibleBaselines.has(key)) onToggleBaseline2(key);
                      });
                    }
                  }}>Todos</button>
                  <span className="cfs-quick-separator">|</span>
                  <button onClick={() => {
                    // Desligar todas
                    allBaselines.forEach(bl => {
                      const key = bl.id ?? bl.label;
                      if (isBaselineVisible(bl)) onToggleBaseline2(key);
                    });
                  }}>Limpar</button>
                </div>
              )}
              {allBaselines.map((bl, idx) => {
                const key = bl.id ?? bl.label;
                const color = allBaselines.length > 1 ? getBaselineColor(idx) : BASELINE_COLOR;
                const visible = isBaselineVisible(bl);
                return (
                  <label
                    key={key}
                    className={`cfs-item ${visible ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggleBaseline2(key)}
                      className="cfs-checkbox"
                    />
                    <span
                      className="cfs-line-preview cfs-line-dashed"
                      style={{ borderColor: color }}
                    />
                    <span className="cfs-item-label">{bl.label}</span>
                    {visible && (
                      <span className="cfs-eye-indicator"><EyeIcon /></span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reprogramado Mensal section */}
      {snapshotCurves.length > 0 && (
        <div className="cfs-section">
          <button
            className="cfs-section-header"
            onClick={() => setReprogramadosOpen(!reprogramadosOpen)}
          >
            <span className="cfs-chevron">
              {reprogramadosOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            </span>
            <span className="cfs-section-title">Reprogramado Mensal</span>
            <span className="cfs-count">{visibleSnapshotCount}/{snapshotCurves.length}</span>
          </button>
          {reprogramadosOpen && (
            <div className="cfs-section-content">
              <div className="cfs-quick-actions">
                <button onClick={onSelectAllSnapshots}>Todos</button>
                <span className="cfs-quick-separator">|</span>
                <button onClick={onClearAllSnapshots}>Limpar</button>
              </div>
              {snapshotCurves.map((sc, idx) => {
                const color = getReprogramadoColor(idx, snapshotCurves.length);
                const visible = isSnapshotVisible(sc.snapshot_date);
                return (
                  <label
                    key={sc.snapshot_date}
                    className={`cfs-item ${visible ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggleSnapshot(sc.snapshot_date)}
                      className="cfs-checkbox"
                    />
                    <span
                      className="cfs-line-preview cfs-line-dashed"
                      style={{ borderColor: color }}
                    />
                    <span className="cfs-item-label">Reprog. {sc.label}</span>
                    {visible && (
                      <span className="cfs-eye-indicator"><EyeIcon /></span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barras Mensais section */}
      <div className="cfs-section">
        <button
          className="cfs-section-header"
          onClick={() => setBarrasOpen(!barrasOpen)}
        >
          <span className="cfs-chevron">
            {barrasOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <span className="cfs-section-title">Barras Mensais</span>
        </button>
        {barrasOpen && (
          <div className="cfs-section-content">
            <label className={`cfs-item ${showBarExecutado ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={showBarExecutado}
                onChange={onToggleBarExecutado}
                className="cfs-checkbox"
              />
              <span className="cfs-bar-preview" style={{ backgroundColor: EXECUTADO_BAR_COLOR, borderColor: EXECUTADO_COLOR }} />
              <span className="cfs-item-label">Executado</span>
              {showBarExecutado && (
                <span className="cfs-eye-indicator"><BarChartIcon /></span>
              )}
            </label>
            {allBaselines.map((bl, idx) => {
              const key = bl.id ?? bl.label;
              const barColor = getBaselineBarColor(idx);
              const lineColor = allBaselines.length > 1 ? getBaselineColor(idx) : BASELINE_COLOR;
              const visible = visibleBaselineBars ? visibleBaselineBars.has(key) : false;
              return (
                <label
                  key={`bar-${key}`}
                  className={`cfs-item ${visible ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggleBaselineBar(key)}
                    className="cfs-checkbox"
                  />
                  <span className="cfs-bar-preview" style={{ backgroundColor: barColor, borderColor: lineColor }} />
                  <span className="cfs-item-label">{bl.label || 'Baseline'}</span>
                  {visible && (
                    <span className="cfs-eye-indicator"><BarChartIcon /></span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="cfs-legend">
        <div className="cfs-legend-title">Legenda</div>
        <div className="cfs-legend-item">
          <span className="cfs-line-preview cfs-line-dashed" style={{ borderColor: BASELINE_COLOR }} />
          <span>Baseline (planejado)</span>
        </div>
        <div className="cfs-legend-item">
          <span className="cfs-line-preview cfs-line-dashed" style={{ borderColor: '#059669' }} />
          <span>Reprogramado (tracejado)</span>
        </div>
        <div className="cfs-legend-item">
          <span className="cfs-line-preview cfs-line-solid" style={{ backgroundColor: EXECUTADO_COLOR, height: '3px' }} />
          <span>Executado (grosso)</span>
        </div>
        <div className="cfs-legend-item">
          <span className="cfs-bar-preview" style={{ backgroundColor: EXECUTADO_BAR_COLOR, borderColor: EXECUTADO_COLOR }} />
          <span>Barra mensal</span>
        </div>
      </div>
    </div>
  );
}

export default ChartFilterSidebar;

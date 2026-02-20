/**
 * Componente: Resumo de Pesos por Fase
 * Exibe o breakdown de progresso por fase
 */

import React from 'react';

function WeightSummaryTable({ phaseBreakdown, progress }) {
  if (!phaseBreakdown || phaseBreakdown.length === 0) {
    return (
      <div className="weight-summary-container">
        <h4>Resumo por Fase</h4>
        <p className="no-data">Calcule o progresso para ver o resumo.</p>
      </div>
    );
  }

  const totalWeight = phaseBreakdown.reduce((s, p) => s + p.weight_percent, 0);
  const totalProgress = progress?.total_progress || 0;

  return (
    <div className="weight-summary-container">
      <h4>Resumo por Fase</h4>
      <table className="weight-summary-table">
        <thead>
          <tr>
            <th>Fase</th>
            <th>Peso</th>
            <th>Tarefas</th>
            <th>Concluídas</th>
            <th>Contribuição</th>
          </tr>
        </thead>
        <tbody>
          {phaseBreakdown.map((phase, idx) => (
            <tr key={idx}>
              <td>{phase.phase_name}</td>
              <td className="number">{phase.weight_percent.toFixed(1)}%</td>
              <td className="number">{phase.total_tasks}</td>
              <td className="number">{phase.completed_tasks}</td>
              <td className="number">{phase.phase_progress.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td><strong>Total</strong></td>
            <td className="number"><strong>{totalWeight.toFixed(1)}%</strong></td>
            <td className="number"><strong>{phaseBreakdown.reduce((s, p) => s + p.total_tasks, 0)}</strong></td>
            <td className="number"><strong>{phaseBreakdown.reduce((s, p) => s + p.completed_tasks, 0)}</strong></td>
            <td className="number"><strong>{totalProgress.toFixed(2)}%</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default WeightSummaryTable;

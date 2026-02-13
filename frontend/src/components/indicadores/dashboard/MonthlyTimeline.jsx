import React from 'react';
import { getScoreStatus, getTrafficLightHex } from '../../../utils/indicator-utils';

/**
 * Timeline horizontal mostrando evolucao do score geral mês a mês
 * @param {{ monthlyScores: Array<{ month: number, monthName: string, score: number|null, hasData: boolean }> }} props
 */
export default function MonthlyTimeline({ monthlyScores }) {
  if (!monthlyScores || monthlyScores.length === 0) return null;

  return (
    <div className="monthly-timeline">
      <div className="monthly-timeline__label">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
        <span>Evolucao Mensal</span>
      </div>
      <div className="monthly-timeline__cells">
        {monthlyScores.map((ms) => {
          const color = ms.hasData ? getTrafficLightHex(ms.score) : '#d1d5db';
          const status = ms.hasData ? getScoreStatus(ms.score) : null;

          return (
            <div
              key={ms.month}
              className={`monthly-timeline__cell ${ms.hasData ? 'monthly-timeline__cell--active' : 'monthly-timeline__cell--empty'}`}
              style={{ '--cell-color': color }}
              title={ms.hasData ? `${ms.monthName}: ${ms.score?.toFixed(0)} - ${status}` : `${ms.monthName}: Sem dados`}
            >
              <span className="monthly-timeline__month">{ms.monthName}</span>
              {ms.hasData ? (
                <span className="monthly-timeline__score">{ms.score?.toFixed(0)}</span>
              ) : (
                <span className="monthly-timeline__no-data">-</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import TrafficLightBadge from './TrafficLightBadge';
import { ScoreProgressCircle } from './ScoreProgressBar';
import './SectorCard.css';

/**
 * Card de setor para overview
 * @param {Object} props
 * @param {Object} props.sector - Dados do setor
 * @param {Function} props.onClick - Callback ao clicar
 */
export default function SectorCard({ sector, onClick }) {
  return (
    <div
      className="sector-card glass-card"
      onClick={() => onClick && onClick(sector)}
      role="button"
      tabIndex={0}
    >
      <div className="sector-card-header">
        <h3 className="sector-name">{sector.name}</h3>
        <TrafficLightBadge score={sector.avgScore} size="md" />
      </div>

      <div className="sector-card-body">
        <ScoreProgressCircle score={sector.avgScore} size={80} strokeWidth={8} />

        <div className="sector-stats">
          <div className="sector-stat">
            <span className="sector-stat-value">{sector.peopleCount || 0}</span>
            <span className="sector-stat-label">Pessoas</span>
          </div>
          <div className="sector-stat">
            <span className="sector-stat-value sector-stat-score">
              {sector.avgScore !== null ? sector.avgScore.toFixed(0) : '-'}
            </span>
            <span className="sector-stat-label">Score médio</span>
          </div>
          {sector.atRiskCount > 0 && (
            <div className="sector-stat sector-stat-risk">
              <span className="sector-stat-value">{sector.atRiskCount}</span>
              <span className="sector-stat-label">Em risco</span>
            </div>
          )}
        </div>
      </div>

      {sector.description && (
        <p className="sector-description">{sector.description}</p>
      )}
    </div>
  );
}

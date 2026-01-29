import React from 'react';
import { Link } from 'react-router-dom';
import TrafficLightBadge from './TrafficLightBadge';
import { ScoreProgressCircle } from './ScoreProgressBar';
import './PersonCard.css';

/**
 * Card de pessoa com score
 * @param {Object} props
 * @param {Object} props.person - Dados da pessoa
 * @param {boolean} props.compact - Versão compacta
 */
export default function PersonCard({ person, compact = false }) {
  const initials = person.name
    ? person.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (compact) {
    return (
      <Link to={`/ind/pessoa/${person.id}`} className="person-card person-card-compact">
        <div className="person-avatar person-avatar-sm">
          {initials}
        </div>
        <div className="person-info">
          <span className="person-name">{person.name}</span>
          <span className="person-position">{person.cargo?.name || '-'}</span>
        </div>
        <TrafficLightBadge score={person.score} size="sm" />
      </Link>
    );
  }

  return (
    <div className="person-card glass-card">
      <Link to={`/ind/pessoa/${person.id}`} className="person-card-link">
        <div className="person-card-header">
          <div className="person-avatar">
            {initials}
          </div>
          <div className="person-info">
            <h3 className="person-name">{person.name}</h3>
            <span className="person-position">{person.cargo?.name || 'Sem cargo'}</span>
            {person.setor && (
              <span className="person-sector">{person.setor.name}</span>
            )}
          </div>
        </div>

        <div className="person-card-body">
          <ScoreProgressCircle score={person.score} size={72} strokeWidth={6} />
          <div className="person-stats">
            <div className="person-stat">
              <span className="person-stat-value">{person.indicadoresCount || 0}</span>
              <span className="person-stat-label">Indicadores</span>
            </div>
            {person.indicadoresAtRisk > 0 && (
              <div className="person-stat person-stat-risk">
                <span className="person-stat-value">{person.indicadoresAtRisk}</span>
                <span className="person-stat-label">Em risco</span>
              </div>
            )}
          </div>
        </div>

        <div className="person-card-footer">
          <TrafficLightBadge score={person.score} showLabel size="md" />
        </div>
      </Link>
    </div>
  );
}

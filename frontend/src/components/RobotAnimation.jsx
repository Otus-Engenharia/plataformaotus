/**
 * RobotAnimation - Robô animado reutilizável em CSS puro
 *
 * States: 'working' | 'success' | 'error' | 'idle'
 * Sizes: 'sm' (28px) | 'md' (52px) | 'lg' (40px)
 */

import React from 'react';
import '../styles/RobotAnimation.css';

function RobotAnimation({ state = 'idle', size = 'md' }) {
  const faceClass =
    state === 'success'
      ? 'robot-face-success'
      : state === 'error'
        ? 'robot-face-error'
        : '';

  const isWorking = state === 'working';
  const showGear = isWorking || state === 'success';

  // Gear SVG sizes per size variant
  const gearSize = size === 'sm' ? 12 : size === 'lg' ? 18 : 22;

  return (
    <div className={`robot robot-${size} ${isWorking ? 'robot-working' : ''}`}>
      {/* Antena */}
      <div className="robot-antenna">
        <div className="robot-antenna-ball" />
        <div className="robot-antenna-stick" />
      </div>
      {/* Cabeça */}
      <div className={`robot-head ${faceClass}`}>
        <div className="robot-eyes">
          <div className="robot-eye robot-eye-left" />
          <div className="robot-eye robot-eye-right" />
        </div>
        {state === 'success' && <div className="robot-mouth-happy" />}
        {state === 'error' && <div className="robot-mouth-sad" />}
        {(state === 'working' || state === 'idle') && <div className="robot-mouth-neutral" />}
      </div>
      {/* Engrenagem */}
      {isWorking && (
        <div className="robot-gear">
          <svg width={gearSize} height={gearSize} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
      )}
      {state === 'success' && (
        <div className="robot-gear robot-gear-done">
          <svg width={gearSize} height={gearSize} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default RobotAnimation;

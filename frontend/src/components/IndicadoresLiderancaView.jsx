/**
 * Componente: Vista de Indicadores Liderança
 * 
 * Vista principal com navegação por subabas:
 * - Portfólio de Projetos
 * - Curva S
 * - Baselines
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PortfolioView from './PortfolioView';
import CurvaSView from './CurvaSView';
import BaselinesView from './BaselinesView';
import AlocacaoTimesView from './AlocacaoTimesView';
import '../styles/IndicadoresLiderancaView.css';

// Definição das subabas disponíveis
const SUBVIEWS = {
  portfolio: {
    id: 'portfolio',
    name: 'Portfolio',
    component: PortfolioView,
  },
  'curva-s': {
    id: 'curva-s',
    name: 'Curva S',
    component: CurvaSView,
  },
  baselines: {
    id: 'baselines',
    name: 'Baselines',
    component: BaselinesView,
  },
  'alocacao-times': {
    id: 'alocacao-times',
    name: 'Alocacao de Times',
    component: AlocacaoTimesView,
  },
};

function IndicadoresLiderancaView() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Detecta subaba ativa pela URL ou usa a primeira como padrão
  const getActiveSubview = () => {
    const hash = location.hash.replace('#', '');
    if (hash && SUBVIEWS[hash]) {
      return hash;
    }
    return Object.keys(SUBVIEWS)[0]; // Primeira subaba como padrão
  };

  const [activeSubview, setActiveSubview] = useState(getActiveSubview());

  // Atualiza quando a hash da URL muda
  React.useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && SUBVIEWS[hash]) {
      setActiveSubview(hash);
    } else {
      // Se a hash não for válida, garante que activeSubview seja válido
      const defaultSubview = Object.keys(SUBVIEWS)[0];
      if (activeSubview !== defaultSubview) {
        setActiveSubview(defaultSubview);
      }
    }
  }, [location.hash]);

  const handleSubviewChange = (subviewId) => {
    setActiveSubview(subviewId);
    navigate(`/indicadores-lideranca#${subviewId}`, { replace: true });
  };

  const currentSubview = SUBVIEWS[activeSubview] || SUBVIEWS[Object.keys(SUBVIEWS)[0]];
  const SubviewComponent = currentSubview?.component;

  return (
    <div className="indicadores-lideranca-container">
      {/* Navegação por tabs (subabas) */}
      <div className="indicadores-lideranca-tabs">
        {Object.values(SUBVIEWS).map((subview) => (
          <button
            key={subview.id}
            onClick={() => handleSubviewChange(subview.id)}
            className={`indicadores-lideranca-tab ${activeSubview === subview.id ? 'indicadores-lideranca-tab-active' : ''}`}
          >
            {subview.name}
          </button>
        ))}
      </div>

      {/* Conteúdo da subaba ativa */}
      <div className="indicadores-lideranca-content">
        {SubviewComponent ? (
          <SubviewComponent />
        ) : (
          <div className="indicadores-lideranca-placeholder">
            <h3>{currentSubview?.name || 'Subaba não encontrada'}</h3>
            <p>Esta subaba será implementada em breve.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default IndicadoresLiderancaView;

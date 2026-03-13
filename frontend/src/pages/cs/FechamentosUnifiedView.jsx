/**
 * Vista Unificada de Fechamentos de Fase — Área CS
 * Tabs: Calendário (timeline) | Pesquisas NPS (feedback pós-fechamento)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PesquisasCSView from './PesquisasCSView';
import FechamentosFaseView from './FechamentosFaseView';
import './FechamentosUnifiedView.css';

function FechamentosUnifiedView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'pesquisas' ? 'pesquisas' : 'calendario';
  const [activeTab, setActiveTab] = useState(initialTab);
  const pesquisasRef = useRef(null);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'pesquisas' ? { tab: 'pesquisas' } : {}, { replace: true });
  };

  const handleRegisterClick = useCallback(() => {
    if (pesquisasRef.current?.openForm) {
      pesquisasRef.current.openForm();
    }
  }, []);

  const [pendingProject, setPendingProject] = useState(null);

  const handleCardClick = useCallback((projectInfo) => {
    handleTabChange('pesquisas');
    setPendingProject(projectInfo);
  }, [handleTabChange]);

  useEffect(() => {
    if (pendingProject && activeTab === 'pesquisas') {
      pesquisasRef.current?.openForm(pendingProject);
      setPendingProject(null);
    }
  }, [pendingProject, activeTab]);

  return (
    <div className="fechamentos-unified">
      <div className="fechamentos-unified-header">
        <div>
          <h1>Fechamentos de Fase</h1>
          <p className="fechamentos-unified-subtitle">
            Calendário de fechamentos e pesquisas NPS/CSAT/CES pós-fechamento.
          </p>
        </div>
        {activeTab === 'pesquisas' && (
          <button className="pesquisas-add-btn" onClick={handleRegisterClick}>
            + Registrar Pesquisa
          </button>
        )}
      </div>

      <div className="fechamentos-unified-tabs">
        <button
          className={`fechamentos-unified-tab ${activeTab === 'calendario' ? 'active' : ''}`}
          onClick={() => handleTabChange('calendario')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendário
        </button>
        <button
          className={`fechamentos-unified-tab ${activeTab === 'pesquisas' ? 'active' : ''}`}
          onClick={() => handleTabChange('pesquisas')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Pesquisas NPS
        </button>
      </div>

      <div
        className="fechamentos-unified-content"
        style={{ display: activeTab === 'calendario' ? 'block' : 'none' }}
      >
        <FechamentosFaseView embedded onCardClick={handleCardClick} />
      </div>

      <div
        className="fechamentos-unified-content"
        style={{ display: activeTab === 'pesquisas' ? 'block' : 'none' }}
      >
        <PesquisasCSView embedded ref={pesquisasRef} />
      </div>
    </div>
  );
}

export default FechamentosUnifiedView;

/**
 * Componente: Vista de Projetos
 * 
 * Vista principal com navegação por subvistas (tabs)
 * Estrutura reutilizável para outras vistas com subvistas
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ApontamentosView from './ApontamentosView';
import PortfolioProjetoView from './PortfolioProjetoView';
import FerramentasView from './FerramentasView';
import CronogramaView from './CronogramaView';
import EquipeView from './EquipeView';
import { API_URL } from '../api';
import '../styles/ProjetosView.css';

// Status que representam projetos finalizados (case-insensitive)
const FINALIZED_STATUSES = [
  'churn pelo cliente',
  'close',
  'obra finalizada',
  'termo de encerramento',
  'termo de encerrame',
  'encerrado',
  'finalizado',
  'concluído',
  'concluido',
  'cancelado',
  'execução',
  'execucao'
];

// Status que representam projetos pausados (case-insensitive)
const PAUSED_STATUSES = [
  'pausado',
  'pausa',
  'em pausa',
  'pausado pelo cliente',
  'suspenso',
  'suspensão'
];

// Função auxiliar para verificar se um status é finalizado
const isFinalizedStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return FINALIZED_STATUSES.some(finalizedStatus => 
    statusLower === finalizedStatus.toLowerCase().trim() ||
    statusLower.includes(finalizedStatus.toLowerCase().trim())
  );
};

// Função auxiliar para verificar se um status é pausado
const isPausedStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return PAUSED_STATUSES.some(pausedStatus => 
    statusLower === pausedStatus.toLowerCase().trim() ||
    statusLower.includes(pausedStatus.toLowerCase().trim())
  );
};

// Busca dados do portfólio para o seletor de projetos
async function fetchPortfolio() {
  try {
    const response = await axios.get(`${API_URL}/api/portfolio`, {
      withCredentials: true,
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Erro ao buscar portfólio:', error);
    return [];
  }
}

// Definição das subvistas disponíveis
const SUBVIEWS = {
  portfolio: {
    id: 'portfolio',
    name: 'Portfólio',
    component: PortfolioProjetoView,
  },
  processo: {
    id: 'processo',
    name: 'Processo',
    component: null, // Será implementado depois
  },
  ferramentas: {
    id: 'ferramentas',
    name: 'Ferramentas',
    component: FerramentasView,
  },
  cronograma: {
    id: 'cronograma',
    name: 'Cronograma',
    component: CronogramaView,
  },
  apontamentos: {
    id: 'apontamentos',
    name: 'Apontamentos',
    component: ApontamentosView,
  },
  equipe: {
    id: 'equipe',
    name: 'Equipe',
    component: EquipeView,
  },
};

function ProjetosView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showOnlyActiveProjects, setShowOnlyActiveProjects] = useState(true); // Padrão: ativo
  
  // Detecta subvista ativa pela URL ou usa a primeira como padrão
  const getActiveSubview = () => {
    const hash = location.hash.replace('#', '');
    if (hash && SUBVIEWS[hash]) {
      return hash;
    }
    return Object.keys(SUBVIEWS)[0]; // Primeira subvista como padrão
  };

  const [activeSubview, setActiveSubview] = useState(getActiveSubview());

  // Atualiza quando a hash da URL muda
  React.useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && SUBVIEWS[hash]) {
      setActiveSubview(hash);
    }
  }, [location.hash]);

  // Carrega portfólio ao montar
  useEffect(() => {
    async function loadPortfolio() {
      const data = await fetchPortfolio();
      setPortfolio(data);
      
      // Filtra e ordena projetos para selecionar o primeiro alfabeticamente
      // Aplica o filtro de projetos ativos por padrão (exclui finalizados e pausados)
      const validProjects = data
        .filter(p => {
          const id = p.construflow_id;
          if (id === null || id === undefined || String(id).trim() === '') {
            return false;
          }
          // Por padrão, exclui projetos finalizados e pausados
          if (isFinalizedStatus(p.status) || isPausedStatus(p.status)) {
            return false;
          }
          return true;
        })
        .reduce((acc, project) => {
          const exists = acc.find(p => p.construflow_id === project.construflow_id);
          if (!exists) {
            acc.push(project);
          }
          return acc;
        }, [])
        .sort((a, b) => {
          const nameA = (a.project_name || a.project_code_norm || a.construflow_id || '').toLowerCase();
          const nameB = (b.project_name || b.project_code_norm || b.construflow_id || '').toLowerCase();
          return nameA.localeCompare(nameB, 'pt-BR');
        });
      
      if (validProjects.length > 0 && validProjects[0].construflow_id) {
        setSelectedProjectId(validProjects[0].construflow_id);
      }
    }
    loadPortfolio();
  }, []);

  // Atualiza lastUpdate quando o projeto muda
  useEffect(() => {
    if (selectedProjectId) {
      setLastUpdate(new Date());
    }
  }, [selectedProjectId]);

  const handleSubviewChange = (subviewId) => {
    setActiveSubview(subviewId);
    navigate(`/projetos#${subviewId}`, { replace: true });
  };

  const currentSubview = SUBVIEWS[activeSubview];
  const SubviewComponent = currentSubview?.component;

  // Ordena projetos para o select (filtra por ativos se necessário)
  const sortedProjects = portfolio
    .filter(p => {
      const id = p.construflow_id;
      if (id === null || id === undefined || String(id).trim() === '') {
        return false;
      }
      // Se o filtro de apenas ativos estiver ativo, filtra projetos finalizados e pausados
      if (showOnlyActiveProjects) {
        if (isFinalizedStatus(p.status) || isPausedStatus(p.status)) {
          return false;
        }
      }
      return true;
    })
    .reduce((acc, project) => {
      const exists = acc.find(p => p.construflow_id === project.construflow_id);
      if (!exists) {
        acc.push(project);
      }
      return acc;
    }, [])
    .sort((a, b) => {
      const nameA = (a.project_name || a.project_code_norm || a.construflow_id || '').toLowerCase();
      const nameB = (b.project_name || b.project_code_norm || b.construflow_id || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });

  return (
    <div className="projetos-container">
      <div className="projetos-header">
        <h2>Projetos</h2>
        <p className="projetos-subtitle">Gerenciamento e acompanhamento de projetos</p>
      </div>

      {/* Filtro de projeto - Movido para cima das tabs */}
      <div className="projetos-project-filter">
        <select
          value={selectedProjectId || ''}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="apontamentos-project-select"
        >
          <option value="">Selecione um projeto</option>
          {sortedProjects.map(project => (
            <option key={project.construflow_id} value={project.construflow_id}>
              {project.project_name || project.project_code_norm || project.construflow_id}
            </option>
          ))}
        </select>
        
        {/* Toggle para mostrar apenas projetos ativos */}
        <label className="projetos-active-toggle">
          <input
            type="checkbox"
            checked={showOnlyActiveProjects}
            onChange={(e) => {
              setShowOnlyActiveProjects(e.target.checked);
              // Se o projeto selecionado for finalizado e o filtro for ativado, limpa a seleção
              if (e.target.checked && selectedProjectId) {
                const selectedProject = portfolio.find(p => String(p.construflow_id) === String(selectedProjectId));
                if (selectedProject && isFinalizedStatus(selectedProject.status)) {
                  setSelectedProjectId(null);
                }
              }
            }}
          />
          <span className="projetos-active-toggle-slider"></span>
          <span className="projetos-active-toggle-label">Somente Projetos Ativos</span>
        </label>
        
        {lastUpdate && (
          <span className="apontamentos-last-update">
            {lastUpdate.toLocaleDateString('pt-BR')} {lastUpdate.toLocaleTimeString('pt-BR')} - Última Atualização
          </span>
        )}
      </div>

      {/* Navegação por tabs (subvistas) */}
      <div className="projetos-tabs">
        {Object.values(SUBVIEWS).map((subview) => (
          <button
            key={subview.id}
            onClick={() => handleSubviewChange(subview.id)}
            className={`projetos-tab ${activeSubview === subview.id ? 'projetos-tab-active' : ''}`}
          >
            {subview.name}
          </button>
        ))}
      </div>

      {/* Conteúdo da subvista ativa */}
      <div className="projetos-content">
        {SubviewComponent ? (
          activeSubview === 'portfolio' ? (
            <SubviewComponent 
              selectedProjectId={selectedProjectId}
              portfolio={portfolio}
            />
          ) : activeSubview === 'apontamentos' ? (
            <SubviewComponent 
              selectedProjectId={selectedProjectId}
              setSelectedProjectId={setSelectedProjectId}
              portfolio={portfolio}
              lastUpdate={lastUpdate}
              setLastUpdate={setLastUpdate}
            />
          ) : activeSubview === 'ferramentas' ? (
            <SubviewComponent 
              selectedProjectId={selectedProjectId}
            />
          ) : activeSubview === 'cronograma' ? (
            <SubviewComponent
              selectedProjectId={selectedProjectId}
              portfolio={portfolio}
            />
          ) : activeSubview === 'equipe' ? (
            <SubviewComponent
              selectedProjectId={selectedProjectId}
            />
          ) : (
            <SubviewComponent />
          )
        ) : (
          <div className="projetos-placeholder">
            <h3>{currentSubview?.name || 'Subvista'}</h3>
            <p>Esta subvista será implementada em breve.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjetosView;

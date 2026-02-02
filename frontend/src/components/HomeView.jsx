/**
 * Componente: Vista Inicial (Home)
 *
 * Tela principal com opções de navegação dinâmicas.
 * Módulos são carregados da API e filtrados por permissão:
 * - access_type 'all': todos os usuários (incluindo Operação)
 * - access_type 'leader_up': líder, admin, diretor, dev (exclui Operação)
 * - access_type 'privileged': dev/admin/diretor
 * - access_type 'dev_only': apenas devs
 *
 * Mantém a identidade visual do login
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../api';
import '../styles/HomeView.css';

// Mapeamento de icon_name para componentes SVG
const ICON_MAP = {
  projetos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm0 2h7v5h5v11H6V4Z" />
    </svg>
  ),
  indicadores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 12l4-4 4 4 6-6" />
    </svg>
  ),
  okrs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="5" height="18" rx="1"/>
      <rect x="10" y="3" width="5" height="12" rx="1"/>
      <rect x="17" y="3" width="5" height="8" rx="1"/>
    </svg>
  ),
  configuracoes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  // Ícone padrão para módulos sem ícone definido
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
};

function HomeView() {
  const navigate = useNavigate();
  const { isDev, isAdmin, isDirector, isLeader } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Níveis de acesso hierárquicos
  const canSeePrivileged = isDev || isAdmin || isDirector;
  const canSeeLeaderUp = isDev || isAdmin || isDirector || isLeader;

  // Buscar módulos da API
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/home-modules`, {
          withCredentials: true,
        });
        if (response.data?.success) {
          setModules(response.data.data || []);
        }
      } catch (error) {
        console.error('Erro ao buscar módulos da Home:', error);
        // Em caso de erro, não mostra nada
        setModules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  // Filtrar módulos baseado em visibilidade e permissões
  const visibleModules = useMemo(() => {
    return modules.filter(module => {
      // Módulos ocultos não aparecem
      if (!module.visible) return false;
      // Filtrar por tipo de acesso
      if (module.access_type === 'dev_only' && !isDev) return false;
      if (module.access_type === 'privileged' && !canSeePrivileged) return false;
      if (module.access_type === 'leader_up' && !canSeeLeaderUp) return false;
      return true;
    });
  }, [modules, isDev, canSeePrivileged, canSeeLeaderUp]);

  // Mapear módulos para o formato de renderização
  const options = useMemo(() => {
    return visibleModules.map(module => ({
      id: module.id,
      title: module.name,
      description: module.description,
      icon: ICON_MAP[module.icon_name] || ICON_MAP.default,
      path: module.path,
      color: module.color,
    }));
  }, [visibleModules]);

  const handleOptionClick = (option) => {
    navigate(option.path);
  };

  // Loading state
  if (loading) {
    return (
      <div className="home-container">
        <div className="home-content">
          <div className="home-header">
            <img src="/Otus-logo-300x300.png" alt="Otus Engenharia" className="home-logo" />
            <div className="home-slogan">Elevando o padrão de se construir</div>
            <h1 className="home-title">Plataforma Otus</h1>
            <p className="home-subtitle">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-content">
        {/* Logo e título */}
        <div className="home-header">
          <img src="/Otus-logo-300x300.png" alt="Otus Engenharia" className="home-logo" />
          <div className="home-slogan">Elevando o padrão de se construir</div>
          <h1 className="home-title">Plataforma Otus</h1>
          <p className="home-subtitle">Selecione uma área para começar</p>
        </div>

        {/* Grid de opções */}
        <div className="home-options-grid">
          {options.map((option) => (
            <button
              key={option.id}
              className="home-option-card"
              onClick={() => handleOptionClick(option)}
              style={{ '--option-color': option.color }}
            >
              <div className="home-option-icon" style={{ color: option.color }}>
                {option.icon}
              </div>
              <h3 className="home-option-title">{option.title}</h3>
              <p className="home-option-description">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomeView;

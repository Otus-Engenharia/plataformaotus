/**
 * Componente: Vista Inicial (Home)
 *
 * Tela principal com opções de navegação dinâmicas.
 * Módulos são carregados da API já filtrados por permissão do usuário.
 * O backend aplica os filtros baseado no nível de acesso do usuário.
 *
 * Mantém a identidade visual do login
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
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
  // Ícone para Líderes de Projeto
  lideres: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  // Ícone para CS (Customer Success)
  cs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  // Ícone para Apoio de Projetos (estrela - FB-202)
  apoio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  // Ícone para Admin & Financeiro
  admin_financeiro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  // Ícone para Vendas (briefcase)
  vendas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  // Ícone para Vista do Cliente
  vista_cliente: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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
  const { canAccessArea } = useAuth();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Buscar módulos da API (já filtrados pelo backend)
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/modules/home`, {
          withCredentials: true,
        });
        if (response.data?.success) {
          setModules(response.data.data || []);
        }
      } catch (error) {
        console.error('Erro ao buscar módulos da Home:', error);
        setModules([]);
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, []);

  // Mapear módulos para o formato de renderização, filtrando por área acessível
  const options = useMemo(() => {
    return modules
      .filter(module => canAccessArea(module.area))
      .map(module => ({
        id: module.id,
        title: module.name,
        description: module.description,
        icon: ICON_MAP[module.icon_name] || ICON_MAP.default,
        path: module.path,
        color: module.color,
      }));
  }, [modules, canAccessArea]);

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

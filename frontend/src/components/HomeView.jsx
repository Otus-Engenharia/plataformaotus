/**
 * Componente: Vista Inicial (Home)
 *
 * Tela principal com opções de navegação:
 * - Projetos (apenas admin/diretor)
 * - Indicadores
 * - OKRs
 * - Configurações (apenas admin/diretor)
 *
 * Mantém a identidade visual do login
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/HomeView.css';

function HomeView() {
  const navigate = useNavigate();
  const { isAdmin, isDirector } = useAuth();

  // Apenas admin e diretor podem ver Projetos e Configurações
  // Líderes só veem Indicadores e OKRs
  const canSeeAllOptions = isAdmin || isDirector;

  const allOptions = [
    {
      id: 'projetos',
      title: 'Projetos',
      description: 'Gestão de projetos e portfólio',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6Zm0 2h7v5h5v11H6V4Z" />
        </svg>
      ),
      path: '/projetos',
      color: '#4285F4',
      requiresPrivilege: true,
    },
    {
      id: 'indicadores',
      title: 'Indicadores',
      description: 'Métricas e indicadores de desempenho',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 12l4-4 4 4 6-6" />
        </svg>
      ),
      path: '/ind',
      color: '#34A853',
    },
    {
      id: 'okrs',
      title: 'OKRs',
      description: 'Objetivos e Resultados Chave',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
      path: '/okrs',
      color: '#FBBC05',
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      description: 'Gerenciar acessos e permissões',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      ),
      path: '/acessos',
      color: '#EA4335',
      requiresPrivilege: true,
    },
  ];

  // Filtra opções baseado em permissões
  // Líderes só veem Indicadores e OKRs (opções sem requiresPrivilege)
  // Admin e Diretor veem todas as opções
  const options = allOptions.filter(option => !option.requiresPrivilege || canSeeAllOptions);

  const handleOptionClick = (option) => {
    navigate(option.path);
  };

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

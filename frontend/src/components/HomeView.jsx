/**
 * Componente: Vista Inicial (Home)
 * 
 * Tela principal com 4 opções principais:
 * - Projetos
 * - Indicadores
 * - OKRs
 * - Configurações
 * 
 * Mantém a identidade visual do login
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/HomeView.css';

function HomeView() {
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const options = [
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
      path: '/indicadores',
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
        </svg>
      ),
      path: '/acessos',
      color: '#EA4335',
      requiresPrivilege: true,
    },
  ];

  const handleOptionClick = (option) => {
    if (option.requiresPrivilege && !isPrivileged) {
      return; // Não navega se não tiver permissão
    }
    navigate(option.path);
  };

  return (
    <div className="home-container">
      <div className="home-content">
        {/* Logo e título */}
        <div className="home-header">
          <img src="/Otus-logo-300x300.png" alt="Otus Engenharia" className="home-logo" />
          <h1 className="home-title">Plataforma Otus</h1>
          <p className="home-subtitle">Selecione uma área para começar</p>
        </div>

        {/* Grid de opções */}
        <div className="home-options-grid">
          {options.map((option) => {
            const isDisabled = option.requiresPrivilege && !isPrivileged;
            return (
              <button
                key={option.id}
                className={`home-option-card ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleOptionClick(option)}
                disabled={isDisabled}
                style={{ '--option-color': option.color }}
              >
                <div className="home-option-icon" style={{ color: option.color }}>
                  {option.icon}
                </div>
                <h3 className="home-option-title">{option.title}</h3>
                <p className="home-option-description">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HomeView;

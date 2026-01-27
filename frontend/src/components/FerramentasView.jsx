/**
 * Componente: Vista de Ferramentas
 * 
 * Exibe o status das ferramentas disponíveis para o projeto
 * em formato de cards com grid
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/FerramentasView.css';

function FerramentasView({ selectedProjectId }) {
  const [toolsStatus, setToolsStatus] = useState([]);
  const [toolsIds, setToolsIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // TODO: Implementar busca de dados da API quando disponível
  // Por enquanto, usa dados mockados baseados na imagem
  useEffect(() => {
    if (!selectedProjectId) {
      setToolsStatus([]);
      setToolsIds([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Dados mockados - substituir por chamada à API quando disponível
    // Exemplo: const response = await axios.get(`${API_URL}/api/projects/${selectedProjectId}/tools`);
    setTimeout(() => {
      // Status das ferramentas
      const statusData = [
        { id: 'whatsapp', name: 'WhatsApp', status: 'ativo' },
        { id: 'checklist', name: 'Checklist', status: 'ativo' },
        { id: 'dashboard', name: 'Dashboard', status: 'desativado' },
        { id: 'dod_status', name: 'DOD', status: 'desativado' },
        { id: 'escopo_status', name: 'Escopo', status: 'ativo', isLink: true },
        { id: 'relatorio_semanal', name: 'Relatório Semanal', status: 'desativado' },
      ];

      // IDs e URLs das ferramentas
      const idsData = [
        { 
          id: 'dod', 
          name: 'DOD', 
          value: '1Adj75msYIQmOYap3MPMPoj6dh5NhckUTwmwD4mE4Vns',
          isLink: false
        },
        { 
          id: 'escopo_entregas', 
          name: 'Escopo Entregas', 
          value: '1x3H9hR2bNCgGkngj3qf9gaFLbk9r9DIB02zDL_A9sE4',
          isLink: true
        },
        { 
          id: 'smartsheet', 
          name: 'Smartsheet', 
          value: '6626537281376132',
          isLink: false
        },
        { 
          id: 'discord', 
          name: 'Discord', 
          value: '1225896455991070880',
          isLink: false
        },
        { 
          id: 'capa_email', 
          name: 'Capa Email', 
          value: 'https://drive.google.com/file/d/17we25crx9q23l6MntCtEZGp5SggEeAkp/view?usp=drive_link',
          isLink: true
        },
      ];

      setToolsStatus(statusData);
      setToolsIds(idsData);
      setLoading(false);
    }, 300);
  }, [selectedProjectId]);

  if (!selectedProjectId) {
    return (
      <div className="ferramentas-empty">
        <p>Selecione um projeto para visualizar o status das ferramentas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ferramentas-loading">
        <p>Carregando status das ferramentas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ferramentas-error">
        <p>{error}</p>
      </div>
    );
  }

  if (toolsStatus.length === 0 && toolsIds.length === 0) {
    return (
      <div className="ferramentas-empty">
        <p>Nenhuma ferramenta disponível para este projeto.</p>
      </div>
    );
  }

  const getLabel = (tool) => {
    const name = tool.name.toUpperCase();
    if (name.includes('URL')) {
      return name;
    }
    return `${name} ID`;
  };

  return (
    <div className="ferramentas-container">
      {/* Seção de Status das Ferramentas */}
      {toolsStatus.length > 0 && (
        <>
          <h3 className="ferramentas-section-title">Status das Ferramentas</h3>
          <div className="ferramentas-grid">
            {toolsStatus.map((tool) => (
              <div key={tool.id} className="ferramentas-card">
                <div className="ferramentas-label">
                  {tool.name.toUpperCase()} STATUS
                </div>
                <div className={`ferramentas-value ${tool.isLink ? 'ferramentas-value-link' : ''}`}>
                  {tool.status}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Seção de IDs e URLs das Ferramentas */}
      {toolsIds.length > 0 && (
        <>
          {toolsStatus.length > 0 && <div className="ferramentas-section-divider"></div>}
          <h3 className="ferramentas-section-title">IDs e URLs das Ferramentas</h3>
          <div className="ferramentas-grid">
            {toolsIds.map((tool) => (
              <div key={tool.id} className="ferramentas-card">
                <div className="ferramentas-label">
                  {getLabel(tool)}
                </div>
                <div className={`ferramentas-value ${tool.isLink ? 'ferramentas-value-link' : ''}`}>
                  {tool.isLink ? (
                    <a 
                      href={tool.value} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ferramentas-link"
                    >
                      {tool.value}
                    </a>
                  ) : (
                    tool.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default FerramentasView;

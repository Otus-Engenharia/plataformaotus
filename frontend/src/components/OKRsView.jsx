/**
 * Componente: Vista de OKRs
 * 
 * Gestão de Objetivos e Resultados Chave (OKRs)
 * Baseado no repositório: https://github.com/Otus-Engenharia/okrs
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/OKRsView.css';

function OKRsView() {
  const [loading, setLoading] = useState(true);
  const [okrs, setOkrs] = useState([]);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1-2025');
  const [selectedLevel, setSelectedLevel] = useState('todos'); // todos, empresa, time, individual
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOkr, setEditingOkr] = useState(null);

  useEffect(() => {
    fetchOKRs();
  }, [selectedQuarter, selectedLevel]);

  const fetchOKRs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/okrs`, {
        params: { quarter: selectedQuarter, level: selectedLevel },
        withCredentials: true,
      });
      
      if (response.data?.success) {
        setOkrs(response.data.data || []);
      } else {
        // Fallback para dados mockados se a tabela ainda não existir
        setOkrs([
        {
          id: 1,
          titulo: 'Aumentar satisfação do cliente',
          nivel: 'empresa',
          responsavel: 'Diretoria',
          quarter: 'Q1-2025',
          progresso: 75,
          keyResults: [
            { id: 1, descricao: 'Atingir NPS de 80+', progresso: 90, meta: 80, atual: 72 },
            { id: 2, descricao: 'Reduzir tempo de resposta em 30%', progresso: 60, meta: 30, atual: 18 },
            { id: 3, descricao: 'Aumentar taxa de retenção para 95%', progresso: 75, meta: 95, atual: 71 },
          ],
        },
        {
          id: 2,
          titulo: 'Melhorar eficiência operacional',
          nivel: 'time',
          responsavel: 'Time de Projetos',
          quarter: 'Q1-2025',
          progresso: 65,
          keyResults: [
            { id: 4, descricao: 'Reduzir tempo médio de entrega em 20%', progresso: 80, meta: 20, atual: 16 },
            { id: 5, descricao: 'Aumentar taxa de conclusão para 90%', progresso: 50, meta: 90, atual: 45 },
          ],
        },
        {
          id: 3,
          titulo: 'Expandir portfólio de clientes',
          nivel: 'empresa',
          responsavel: 'Comercial',
          quarter: 'Q1-2025',
          progresso: 55,
          keyResults: [
            { id: 6, descricao: 'Fechar 10 novos contratos', progresso: 60, meta: 10, atual: 6 },
            { id: 7, descricao: 'Aumentar receita recorrente em 25%', progresso: 50, meta: 25, atual: 12.5 },
          ],
        },
        ]);
      }
    } catch (error) {
      console.error('Erro ao buscar OKRs:', error);
      // Em caso de erro (ex: tabela não existe ainda), usa dados mockados
      setOkrs([
        {
          id: 1,
          titulo: 'Aumentar satisfação do cliente',
          nivel: 'empresa',
          responsavel: 'Diretoria',
          quarter: 'Q1-2025',
          progresso: 75,
          keyResults: [
            { id: 1, descricao: 'Atingir NPS de 80+', progresso: 90, meta: 80, atual: 72 },
            { id: 2, descricao: 'Reduzir tempo de resposta em 30%', progresso: 60, meta: 30, atual: 18 },
            { id: 3, descricao: 'Aumentar taxa de retenção para 95%', progresso: 75, meta: 95, atual: 71 },
          ],
        },
        {
          id: 2,
          titulo: 'Melhorar eficiência operacional',
          nivel: 'time',
          responsavel: 'Time de Projetos',
          quarter: 'Q1-2025',
          progresso: 65,
          keyResults: [
            { id: 4, descricao: 'Reduzir tempo médio de entrega em 20%', progresso: 80, meta: 20, atual: 16 },
            { id: 5, descricao: 'Aumentar taxa de conclusão para 90%', progresso: 50, meta: 90, atual: 45 },
          ],
        },
        {
          id: 3,
          titulo: 'Expandir portfólio de clientes',
          nivel: 'empresa',
          responsavel: 'Comercial',
          quarter: 'Q1-2025',
          progresso: 55,
          keyResults: [
            { id: 6, descricao: 'Fechar 10 novos contratos', progresso: 60, meta: 10, atual: 6 },
            { id: 7, descricao: 'Aumentar receita recorrente em 25%', progresso: 50, meta: 25, atual: 12.5 },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOKRs = selectedLevel === 'todos' 
    ? okrs 
    : okrs.filter(okr => okr.nivel === selectedLevel);

  const getProgressColor = (progresso) => {
    if (progresso >= 80) return '#34A853'; // Verde
    if (progresso >= 50) return '#FBBC05'; // Amarelo
    return '#EA4335'; // Vermelho
  };

  const getProgressLabel = (progresso) => {
    if (progresso >= 100) return 'Concluído';
    if (progresso >= 80) return 'No caminho';
    if (progresso >= 50) return 'Em progresso';
    return 'Atenção necessária';
  };

  const handleAddOKR = () => {
    setEditingOkr(null);
    setShowAddModal(true);
  };

  const handleEditOKR = (okr) => {
    setEditingOkr(okr);
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="okrs-container">
        <div className="okrs-loading">
          <p>Carregando OKRs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="okrs-container">
      <div className="okrs-header">
        <div>
          <h2>OKRs</h2>
          <p className="okrs-subtitle">Objetivos e Resultados Chave</p>
        </div>
        <button className="btn-add-okr" onClick={handleAddOKR}>
          + Adicionar OKR
        </button>
      </div>

      {/* Filtros */}
      <div className="okrs-filters">
        <div className="filter-group">
          <label>Trimestre:</label>
          <select 
            value={selectedQuarter} 
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="filter-select"
          >
            <option value="Q1-2025">Q1 2025</option>
            <option value="Q2-2025">Q2 2025</option>
            <option value="Q3-2025">Q3 2025</option>
            <option value="Q4-2025">Q4 2025</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Nível:</label>
          <select 
            value={selectedLevel} 
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="filter-select"
          >
            <option value="todos">Todos</option>
            <option value="empresa">Empresa</option>
            <option value="time">Time</option>
            <option value="individual">Individual</option>
          </select>
        </div>
      </div>

      {/* Lista de OKRs */}
      <div className="okrs-list">
        {filteredOKRs.length === 0 ? (
          <div className="okrs-empty">
            <p>Nenhum OKR encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          filteredOKRs.map((okr) => (
            <div key={okr.id} className="okr-card">
              <div className="okr-header">
                <div className="okr-title-section">
                  <h3 className="okr-title">{okr.titulo}</h3>
                  <div className="okr-meta">
                    <span className={`okr-badge okr-badge-${okr.nivel}`}>{okr.nivel}</span>
                    <span className="okr-responsavel">{okr.responsavel}</span>
                    <span className="okr-quarter">{okr.quarter}</span>
                  </div>
                </div>
                <div className="okr-progress-section">
                  <div className="okr-progress-circle">
                    <svg className="progress-ring" width="80" height="80">
                      <circle
                        className="progress-ring-circle-bg"
                        stroke="#f0f0f0"
                        strokeWidth="8"
                        fill="transparent"
                        r="32"
                        cx="40"
                        cy="40"
                      />
                      <circle
                        className="progress-ring-circle"
                        stroke={getProgressColor(okr.progresso)}
                        strokeWidth="8"
                        fill="transparent"
                        r="32"
                        cx="40"
                        cy="40"
                        strokeDasharray={`${2 * Math.PI * 32}`}
                        strokeDashoffset={`${2 * Math.PI * 32 * (1 - okr.progresso / 100)}`}
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                    <div className="progress-text">
                      <span className="progress-value">{okr.progresso}%</span>
                      <span className="progress-label">{getProgressLabel(okr.progresso)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Results */}
              <div className="okr-key-results">
                <h4 className="key-results-title">Resultados Chave:</h4>
                {okr.keyResults.map((kr) => (
                  <div key={kr.id} className="key-result-item">
                    <div className="kr-header">
                      <span className="kr-descricao">{kr.descricao}</span>
                      <span className="kr-progress-text">
                        {kr.atual} / {kr.meta} ({Math.round((kr.atual / kr.meta) * 100)}%)
                      </span>
                    </div>
                    <div className="kr-progress-bar">
                      <div 
                        className="kr-progress-fill"
                        style={{ 
                          width: `${Math.min((kr.atual / kr.meta) * 100, 100)}%`,
                          backgroundColor: getProgressColor((kr.atual / kr.meta) * 100)
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="okr-actions">
                <button 
                  className="btn-edit-okr"
                  onClick={() => handleEditOKR(okr)}
                >
                  Editar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de adicionar/editar OKR */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingOkr ? 'Editar OKR' : 'Adicionar OKR'}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-note">
                <strong>Nota:</strong> A funcionalidade de adicionar/editar OKRs será implementada em breve.
                Esta interface está preparada para integração com o backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nota de desenvolvimento */}
      <div className="okrs-note">
        <p>
          <strong>Nota:</strong> Esta funcionalidade está em desenvolvimento. 
          Baseado no repositório: <a href="https://github.com/Otus-Engenharia/okrs" target="_blank" rel="noreferrer">github.com/Otus-Engenharia/okrs</a>
        </p>
      </div>
    </div>
  );
}

export default OKRsView;

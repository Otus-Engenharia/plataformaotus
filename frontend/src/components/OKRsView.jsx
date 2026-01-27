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
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    nivel: 'empresa',
    responsavel: '',
    quarter: 'Q1-2025',
    data_inicio: '',
    data_fim: '',
    keyResults: [{ descricao: '', meta: '', atual: '', unidade: '%' }]
  });
  const [saving, setSaving] = useState(false);

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
    setFormData({
      titulo: '',
      descricao: '',
      nivel: 'empresa',
      responsavel: '',
      quarter: selectedQuarter,
      data_inicio: '',
      data_fim: '',
      keyResults: [{ descricao: '', meta: '', atual: '', unidade: '%' }]
    });
    setShowAddModal(true);
  };

  const handleEditOKR = (okr) => {
    setEditingOkr(okr);
    setFormData({
      titulo: okr.titulo || '',
      descricao: okr.descricao || '',
      nivel: okr.nivel || 'empresa',
      responsavel: okr.responsavel || '',
      quarter: okr.quarter || selectedQuarter,
      data_inicio: okr.data_inicio || '',
      data_fim: okr.data_fim || '',
      keyResults: okr.keyResults && okr.keyResults.length > 0 
        ? okr.keyResults.map(kr => ({
            descricao: kr.descricao || '',
            meta: kr.meta || '',
            atual: kr.atual || '',
            unidade: kr.unidade || '%'
          }))
        : [{ descricao: '', meta: '', atual: '', unidade: '%' }]
    });
    setShowAddModal(true);
  };

  const handleSaveOKR = async () => {
    try {
      setSaving(true);
      
      // Validação básica
      if (!formData.titulo || !formData.responsavel || !formData.quarter) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      const okrPayload = {
        titulo: formData.titulo,
        descricao: formData.descricao,
        nivel: formData.nivel,
        responsavel: formData.responsavel,
        quarter: formData.quarter,
        data_inicio: formData.data_inicio || null,
        data_fim: formData.data_fim || null,
        keyResults: formData.keyResults
          .filter(kr => kr.descricao && kr.meta)
          .map(kr => ({
            descricao: kr.descricao,
            meta: parseFloat(kr.meta) || 0,
            atual: parseFloat(kr.atual) || 0,
            unidade: kr.unidade || '%'
          }))
      };

      if (editingOkr) {
        // Editar OKR existente
        await axios.put(`${API_URL}/api/okrs/${editingOkr.id}`, okrPayload, {
          withCredentials: true,
        });
      } else {
        // Criar novo OKR
        await axios.post(`${API_URL}/api/okrs`, okrPayload, {
          withCredentials: true,
        });
      }

      setShowAddModal(false);
      fetchOKRs(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao salvar OKR:', error);
      alert(error.response?.data?.error || 'Erro ao salvar OKR');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOKR = async (okrId) => {
    if (!confirm('Tem certeza que deseja deletar este OKR?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/okrs/${okrId}`, {
        withCredentials: true,
      });
      fetchOKRs(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao deletar OKR:', error);
      alert(error.response?.data?.error || 'Erro ao deletar OKR');
    }
  };

  const handleAddKeyResult = () => {
    setFormData({
      ...formData,
      keyResults: [...formData.keyResults, { descricao: '', meta: '', atual: '', unidade: '%' }]
    });
  };

  const handleRemoveKeyResult = (index) => {
    setFormData({
      ...formData,
      keyResults: formData.keyResults.filter((_, i) => i !== index)
    });
  };

  const handleKeyResultChange = (index, field, value) => {
    const newKeyResults = [...formData.keyResults];
    newKeyResults[index][field] = value;
    setFormData({
      ...formData,
      keyResults: newKeyResults
    });
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
                <button 
                  className="btn-delete-okr"
                  onClick={() => handleDeleteOKR(okr.id)}
                >
                  Deletar
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
              <form onSubmit={(e) => { e.preventDefault(); handleSaveOKR(); }}>
                <div className="form-group">
                  <label>Título *</label>
                  <input
                    type="text"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    required
                    placeholder="Ex: Aumentar satisfação do cliente"
                  />
                </div>

                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows="3"
                    placeholder="Descrição detalhada do OKR"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Nível *</label>
                    <select
                      value={formData.nivel}
                      onChange={(e) => setFormData({ ...formData, nivel: e.target.value })}
                      required
                    >
                      <option value="empresa">Empresa</option>
                      <option value="time">Time</option>
                      <option value="individual">Individual</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Responsável *</label>
                    <input
                      type="text"
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                      required
                      placeholder="Nome do responsável"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Trimestre *</label>
                    <select
                      value={formData.quarter}
                      onChange={(e) => setFormData({ ...formData, quarter: e.target.value })}
                      required
                    >
                      <option value="Q1-2025">Q1 2025</option>
                      <option value="Q2-2025">Q2 2025</option>
                      <option value="Q3-2025">Q3 2025</option>
                      <option value="Q4-2025">Q4 2025</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Data Início</label>
                    <input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Data Fim</label>
                    <input
                      type="date"
                      value={formData.data_fim}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div className="key-results-header">
                    <label>Key Results (Resultados Chave)</label>
                    <button type="button" onClick={handleAddKeyResult} className="btn-add-kr">
                      + Adicionar Key Result
                    </button>
                  </div>
                  {formData.keyResults.map((kr, index) => (
                    <div key={index} className="key-result-item">
                      <div className="form-row">
                        <div className="form-group flex-2">
                          <input
                            type="text"
                            value={kr.descricao}
                            onChange={(e) => handleKeyResultChange(index, 'descricao', e.target.value)}
                            placeholder="Descrição do Key Result"
                          />
                        </div>
                        <div className="form-group">
                          <input
                            type="number"
                            value={kr.meta}
                            onChange={(e) => handleKeyResultChange(index, 'meta', e.target.value)}
                            placeholder="Meta"
                            step="0.01"
                          />
                        </div>
                        <div className="form-group">
                          <input
                            type="number"
                            value={kr.atual}
                            onChange={(e) => handleKeyResultChange(index, 'atual', e.target.value)}
                            placeholder="Atual"
                            step="0.01"
                          />
                        </div>
                        <div className="form-group">
                          <select
                            value={kr.unidade}
                            onChange={(e) => handleKeyResultChange(index, 'unidade', e.target.value)}
                          >
                            <option value="%">%</option>
                            <option value="pontos">Pontos</option>
                            <option value="dias">Dias</option>
                            <option value="unidades">Unidades</option>
                            <option value="R$">R$</option>
                          </select>
                        </div>
                        {formData.keyResults.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveKeyResult(index)}
                            className="btn-remove-kr"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-cancel">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-save" disabled={saving}>
                    {saving ? 'Salvando...' : editingOkr ? 'Atualizar' : 'Criar OKR'}
                  </button>
                </div>
              </form>
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

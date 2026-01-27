/**
 * Vista: Feedbacks
 * 
 * Permite ao time criar feedbacks sobre processos ou plataforma
 * - Formulário para criar feedbacks
 * - Vista para o time acompanhar status dos seus feedbacks
 * - Vista para admin dar parecer sobre feedbacks
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../api';
import '../styles/FeedbacksView.css';

function FeedbacksView() {
  const { user, isPrivileged } = useAuth();
  const [view, setView] = useState('form'); // 'form', 'meus', 'admin'
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    tipo: 'processo',
    titulo: '',
    descricao: '',
  });
  const [editingParecer, setEditingParecer] = useState(null);
  const [parecerText, setParecerText] = useState('');

  useEffect(() => {
    if (view !== 'form') {
      fetchFeedbacks();
    }
  }, [view]);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/feedbacks`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setFeedbacks(response.data.data || []);
      } else {
        setError(response.data.error || 'Erro ao carregar feedbacks');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao carregar feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/feedbacks`,
        formData,
        { withCredentials: true }
      );

      if (response.data.success) {
        setFormData({
          tipo: 'processo',
          titulo: '',
          descricao: '',
        });
        setError(null);
        alert('Feedback enviado com sucesso!');
        if (view === 'meus') {
          fetchFeedbacks();
        }
      } else {
        setError(response.data.error || 'Erro ao enviar feedback');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao enviar feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/feedbacks/${id}/status`,
        { status: newStatus },
        { withCredentials: true }
      );

      if (response.data.success) {
        fetchFeedbacks();
      } else {
        alert('Erro ao atualizar status: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      alert('Erro ao atualizar status: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleParecerSubmit = async (id) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/feedbacks/${id}/parecer`,
        { parecer: parecerText },
        { withCredentials: true }
      );

      if (response.data.success) {
        setEditingParecer(null);
        setParecerText('');
        fetchFeedbacks();
      } else {
        alert('Erro ao salvar parecer: ' + (response.data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      alert('Erro ao salvar parecer: ' + (err.response?.data?.error || err.message));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente':
        return '#f59e0b';
      case 'em_analise':
        return '#3b82f6';
      case 'resolvido':
        return '#10b981';
      case 'arquivado':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pendente':
        return 'Pendente';
      case 'em_analise':
        return 'Em Análise';
      case 'resolvido':
        return 'Resolvido';
      case 'arquivado':
        return 'Arquivado';
      default:
        return status;
    }
  };

  const getTipoLabel = (tipo) => {
    return tipo === 'processo' ? 'Processo' : 'Plataforma';
  };

  return (
    <div className="feedbacks-container">
      <div className="feedbacks-header">
        <h1>Feedbacks</h1>
        <div className="feedbacks-tabs">
          <button
            className={`tab-button ${view === 'form' ? 'active' : ''}`}
            onClick={() => setView('form')}
          >
            Novo Feedback
          </button>
          <button
            className={`tab-button ${view === 'meus' ? 'active' : ''}`}
            onClick={() => setView('meus')}
          >
            Meus Feedbacks
          </button>
          {isPrivileged && (
            <button
              className={`tab-button ${view === 'admin' ? 'active' : ''}`}
              onClick={() => setView('admin')}
            >
              Gerenciar Feedbacks
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="feedbacks-error">
          {error}
        </div>
      )}

      {view === 'form' && (
        <div className="feedbacks-form-container">
          <form className="feedbacks-form" onSubmit={handleFormSubmit}>
            <div className="form-group">
              <label htmlFor="tipo">Tipo de Feedback *</label>
              <select
                id="tipo"
                name="tipo"
                value={formData.tipo}
                onChange={handleFormChange}
                required
              >
                <option value="processo">Processo</option>
                <option value="plataforma">Plataforma</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="titulo">Título *</label>
              <input
                type="text"
                id="titulo"
                name="titulo"
                value={formData.titulo}
                onChange={handleFormChange}
                required
                placeholder="Resumo do feedback"
              />
            </div>

            <div className="form-group">
              <label htmlFor="descricao">Descrição *</label>
              <textarea
                id="descricao"
                name="descricao"
                value={formData.descricao}
                onChange={handleFormChange}
                required
                rows="6"
                placeholder="Descreva seu feedback em detalhes..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'meus' && (
        <div className="feedbacks-list-container">
          {loading ? (
            <div className="feedbacks-loading">Carregando...</div>
          ) : feedbacks.length === 0 ? (
            <div className="feedbacks-empty">
              Você ainda não enviou nenhum feedback.
            </div>
          ) : (
            <div className="feedbacks-list">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="feedback-card">
                  <div className="feedback-header">
                    <div className="feedback-meta">
                      <span className="feedback-tipo">{getTipoLabel(feedback.tipo)}</span>
                      <span
                        className="feedback-status"
                        style={{ backgroundColor: getStatusColor(feedback.status) }}
                      >
                        {getStatusLabel(feedback.status)}
                      </span>
                    </div>
                    <span className="feedback-date">
                      {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <h3 className="feedback-titulo">{feedback.titulo}</h3>
                  <p className="feedback-descricao">{feedback.descricao}</p>
                  {feedback.parecer_admin && (
                    <div className="feedback-parecer">
                      <strong>Parecer Admin:</strong>
                      <p>{feedback.parecer_admin}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'admin' && isPrivileged && (
        <div className="feedbacks-admin-container">
          {loading ? (
            <div className="feedbacks-loading">Carregando...</div>
          ) : feedbacks.length === 0 ? (
            <div className="feedbacks-empty">Nenhum feedback encontrado.</div>
          ) : (
            <div className="feedbacks-list">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="feedback-card admin">
                  <div className="feedback-header">
                    <div className="feedback-meta">
                      <span className="feedback-tipo">{getTipoLabel(feedback.tipo)}</span>
                      <span
                        className="feedback-status"
                        style={{ backgroundColor: getStatusColor(feedback.status) }}
                      >
                        {getStatusLabel(feedback.status)}
                      </span>
                    </div>
                    <span className="feedback-date">
                      {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="feedback-author">
                    Por: {feedback.created_by}
                  </div>
                  <h3 className="feedback-titulo">{feedback.titulo}</h3>
                  <p className="feedback-descricao">{feedback.descricao}</p>

                  <div className="feedback-actions">
                    <select
                      value={feedback.status}
                      onChange={(e) => handleStatusChange(feedback.id, e.target.value)}
                      className="status-select"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_analise">Em Análise</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="arquivado">Arquivado</option>
                    </select>
                  </div>

                  <div className="feedback-parecer-section">
                    {editingParecer === feedback.id ? (
                      <div className="parecer-editor">
                        <textarea
                          value={parecerText}
                          onChange={(e) => setParecerText(e.target.value)}
                          placeholder="Digite seu parecer sobre este feedback..."
                          rows="4"
                        />
                        <div className="parecer-actions">
                          <button
                            onClick={() => handleParecerSubmit(feedback.id)}
                            className="btn-save"
                          >
                            Salvar Parecer
                          </button>
                          <button
                            onClick={() => {
                              setEditingParecer(null);
                              setParecerText('');
                            }}
                            className="btn-cancel"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="parecer-display">
                        {feedback.parecer_admin ? (
                          <>
                            <strong>Parecer:</strong>
                            <p>{feedback.parecer_admin}</p>
                            <button
                              onClick={() => {
                                setEditingParecer(feedback.id);
                                setParecerText(feedback.parecer_admin);
                              }}
                              className="btn-edit"
                            >
                              Editar Parecer
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingParecer(feedback.id);
                              setParecerText('');
                            }}
                            className="btn-add-parecer"
                          >
                            Adicionar Parecer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FeedbacksView;

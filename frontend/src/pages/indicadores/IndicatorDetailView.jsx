import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculateIndicatorScore,
  getTrafficLightColor,
  formatValue,
  getMonthsForCycle
} from '../../utils/indicator-utils';
import CreateCheckInDialog from '../../components/indicadores/dialogs/CreateCheckInDialog';
import EditMonthlyTargetsDialog from '../../components/indicadores/dialogs/EditMonthlyTargetsDialog';
import CreateRecoveryPlanDialog from '../../components/indicadores/dialogs/CreateRecoveryPlanDialog';
import ViewRecoveryPlanDialog from '../../components/indicadores/dialogs/ViewRecoveryPlanDialog';
import EditIndicatorDialog from '../../components/indicadores/dialogs/EditIndicatorDialog';
import './IndicatorDetailView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function IndicatorDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged, user } = useAuth();

  const [indicador, setIndicador] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [recoveryPlans, setRecoveryPlans] = useState([]);
  const [comments, setComments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showEditTargetsDialog, setShowEditTargetsDialog] = useState(false);
  const [showEditIndicatorDialog, setShowEditIndicatorDialog] = useState(false);
  const [showRecoveryPlanDialog, setShowRecoveryPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    fetchIndicador();
  }, [id]);

  // Busca membros da equipe quando o indicador é carregado
  useEffect(() => {
    if (indicador?.setor_id) {
      fetchTeamMembers(indicador.setor_id);
    }
  }, [indicador?.setor_id]);

  const fetchTeamMembers = async (setorId) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/sectors/${setorId}/team`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
    }
  };

  const fetchIndicador = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ind/indicators/${id}`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao carregar indicador');

      const data = await res.json();
      setIndicador(data.data);
      setCheckIns(data.data?.check_ins || []);
      setRecoveryPlans(data.data?.recovery_plans || []);
      setComments(data.data?.comments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCheckIn = async (checkInData) => {
    try {
      console.log('Criando check-in:', checkInData);
      const res = await fetch(`${API_URL}/api/ind/indicators/${id}/check-ins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(checkInData)
      });

      const responseData = await res.json();
      console.log('Resposta do check-in:', responseData);

      if (!res.ok) {
        throw new Error(responseData.error || 'Erro ao criar check-in');
      }

      setShowCheckInDialog(false);
      setSelectedMonth(null);
      await fetchIndicador();
    } catch (error) {
      console.error('Erro ao criar check-in:', error);
      throw error;
    }
  };

  const openCheckInDialog = (month = null, existingCheckIn = null) => {
    setSelectedMonth(month);
    setSelectedCheckIn(existingCheckIn);
    setShowCheckInDialog(true);
  };

  const closeCheckInDialog = () => {
    setShowCheckInDialog(false);
    setSelectedMonth(null);
    setSelectedCheckIn(null);
  };

  const handleDeleteCheckIn = async (checkInId) => {
    const res = await fetch(`${API_URL}/api/ind/check-ins/${checkInId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao excluir check-in');
    }

    closeCheckInDialog();
    await fetchIndicador();
  };

  const handleUpdateMonthlyTargets = async (data) => {
    const res = await fetch(`${API_URL}/api/ind/indicators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar metas');
    }

    setShowEditTargetsDialog(false);
    fetchIndicador();
  };

  const handleCreateRecoveryPlan = async (planData) => {
    const res = await fetch(`${API_URL}/api/ind/indicators/${id}/recovery-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        descricao: planData.descricao,
        acoes: JSON.stringify(planData.actions),
        prazo: planData.prazo,
        mes_referencia: planData.mes_referencia,
        ano_referencia: planData.ano_referencia,
        status: 'pendente'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao criar plano de recuperação');
    }

    setShowRecoveryPlanDialog(false);
    fetchIndicador();
  };

  const handleUpdateRecoveryPlan = async (planId, data, skipRefresh = false) => {
    const res = await fetch(`${API_URL}/api/ind/indicators/${id}/recovery-plans/${planId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar plano');
    }

    // Atualiza a lista local de planos sem refresh completo
    if (!skipRefresh) {
      setRecoveryPlans(prev => prev.map(p =>
        p.id === planId ? { ...p, ...data } : p
      ));
    }
  };

  // Helper para parsear acoes (pode ser JSON, texto simples ou array)
  const parseAcoes = (acoes) => {
    if (!acoes) return [];
    if (Array.isArray(acoes)) return acoes;
    if (typeof acoes === 'string') {
      // Tenta parsear como JSON primeiro
      try {
        const parsed = JSON.parse(acoes);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // Se não for JSON válido, converte texto simples para array
        return acoes.split('\n').filter(a => a.trim()).map(a => ({
          descricao: a.trim(),
          concluida: false
        }));
      }
    }
    return [];
  };

  const openPlanDialog = (plan) => {
    setSelectedPlan(plan);
  };

  const closePlanDialog = () => {
    setSelectedPlan(null);
  };

  const handleEditIndicator = async (data) => {
    const res = await fetch(`${API_URL}/api/ind/indicators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar indicador');
    }

    setShowEditIndicatorDialog(false);
    fetchIndicador();
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      // API call would go here
      // For now, just add locally
      setComments(prev => [...prev, {
        id: Date.now(),
        texto: newComment,
        user_name: user?.name || 'Você',
        created_at: new Date().toISOString()
      }]);
      setNewComment('');
    } catch (err) {
      console.error('Erro ao comentar:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const getScore = () => {
    if (!indicador) return 0;
    return calculateIndicatorScore(
      indicador.valor,
      indicador.threshold_80,
      indicador.meta,
      indicador.threshold_120,
      indicador.is_inverse
    );
  };

  const getMonthlyData = () => {
    const months = getMonthsForCycle(indicador?.ciclo || 'anual');
    const yearCheckIns = checkIns.filter(c => c.ano === selectedYear);

    return months.map(m => {
      const checkIn = yearCheckIns.find(c => c.mes === m.value);
      const target = indicador?.monthly_targets?.[m.value] || indicador?.meta;

      return {
        month: m.value,
        monthName: MONTH_NAMES[m.value - 1],
        shortName: MONTH_SHORT[m.value - 1],
        target,
        value: checkIn?.valor ?? null,
        notes: checkIn?.notas,
        checkInId: checkIn?.id,
        checkIn: checkIn || null,
        date: checkIn?.created_at
      };
    });
  };

  const getCycleLabel = () => {
    const year = selectedYear;
    const ciclo = indicador?.ciclo || 'anual';
    if (ciclo === 'trimestral') {
      const q = Math.ceil((new Date().getMonth() + 1) / 3);
      return `Q${q} ${year}`;
    }
    return `${year}`;
  };

  const getScoreLabel = (score) => {
    if (score >= 100) return 'Superou';
    if (score >= 80) return 'No alvo';
    if (score >= 60) return 'Em risco';
    return 'Zerado';
  };

  const getScoreColor = (score) => {
    if (score >= 100) return 'excellent';
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="indicator-detail indicator-detail--loading">
        <div className="loading-spinner"></div>
        <p>Carregando indicador...</p>
      </div>
    );
  }

  if (error || !indicador) {
    return (
      <div className="indicator-detail">
        <div className="error-message">
          {error || 'Indicador não encontrado'}
        </div>
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Voltar
        </button>
      </div>
    );
  }

  const score = getScore();
  const monthlyData = getMonthlyData();
  const scoreColor = getScoreColor(score);

  return (
    <div className="indicator-detail">
      {/* Header */}
      <header className="detail-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Voltar
        </button>

        <div className={`score-badge score-badge--${scoreColor}`}>
          <span className="score-badge__value">{score.toFixed(0)}%</span>
          <span className="score-badge__trend">— Estável</span>
        </div>
      </header>

      {/* Title Section */}
      <section className="detail-title-section">
        <h1 className="detail-title">{indicador.nome}</h1>
        {indicador.descricao && (
          <p className="detail-description">{indicador.descricao}</p>
        )}

        <div className="detail-owner">
          {indicador.pessoa && (
            <>
              <div className="owner-avatar">
                {indicador.pessoa.name?.charAt(0) || 'U'}
              </div>
              <span className="owner-name">{indicador.pessoa.name}</span>
              <span className="owner-separator">·</span>
            </>
          )}
          <span className="owner-sector">{indicador.sector?.name || 'Sem setor'}</span>
        </div>

        <div className="detail-tags">
          <span className="tag tag--neutral">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
            </svg>
            {getCycleLabel()}
          </span>
          <span className="tag tag--neutral">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>
              <path fill="currentColor" d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
            Peso: {indicador.peso || 1}
          </span>
          <span className="tag tag--accent">
            {indicador.metric_type === 'percentage' ? 'Porcentagem' :
             indicador.metric_type === 'currency' ? 'Moeda' : 'Número'}
          </span>
        </div>
      </section>

      {/* Progress Card */}
      <section className="card progress-card">
        <div className="progress-card__content">
          <div className="progress-card__main">
            <div className="progress-header">
              <span className="progress-label">Progresso</span>
              <span className={`progress-value progress-value--${scoreColor}`}>{score.toFixed(0)}%</span>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className={`progress-bar__fill progress-bar__fill--${scoreColor}`}
                  style={{ width: `${Math.min(score, 120) / 1.2}%` }}
                />
                <div className="progress-bar__markers">
                  <span className="marker" style={{ left: '0%' }}>0%</span>
                  <span className="marker" style={{ left: '66.67%' }}>80%</span>
                  <span className="marker marker--target" style={{ left: '83.33%' }}>100%</span>
                  <span className="marker" style={{ left: '100%' }}>120%</span>
                </div>
              </div>
            </div>

            <div className="progress-values">
              <div className="progress-value-item">
                <span className="value-label">Inicial</span>
                <span className="value-number">
                  {formatValue(indicador.valor_inicial || 0, indicador.metric_type)}
                </span>
              </div>
              <div className="progress-value-item">
                <span className="value-label">
                  Consolidado ({indicador.consolidation_type === 'sum' ? 'Soma' :
                               indicador.consolidation_type === 'average' ? 'Média' : 'Manual'})
                </span>
                <span className="value-number value-number--editable">
                  {formatValue(indicador.valor, indicador.metric_type)}
                  <svg viewBox="0 0 24 24" width="14" height="14" className="edit-icon">
                    <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </span>
              </div>
              <div className="progress-value-item">
                <span className="value-label">Meta</span>
                <span className="value-number">
                  {formatValue(indicador.meta, indicador.metric_type)}
                </span>
              </div>
            </div>
          </div>

          <div className="progress-card__legend">
            <h4 className="legend-title">Faixas do Farol</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-dot legend-dot--danger"></span>
                <span className="legend-label">Zerado (0%)</span>
                <span className="legend-range">&lt; 80.0%</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-dot--warning"></span>
                <span className="legend-label">Em risco (80-99%)</span>
                <span className="legend-range">80.0% - 100.0%</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-dot--success"></span>
                <span className="legend-label">No alvo (100-119%)</span>
                <span className="legend-range">100.0% - 120.0%</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-dot--excellent"></span>
                <span className="legend-label">Superou (120%)</span>
                <span className="legend-range">&gt; 120.0%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Targets Card */}
      <section className="card monthly-card">
        <div className="monthly-header">
          <div className="monthly-header__left">
            <h3 className="monthly-title">Metas Mensais</h3>
            <span className="monthly-subtitle">Planejado vs Realizado</span>
          </div>
          <div className="monthly-header__right">
            <button
              type="button"
              className="btn-action"
              onClick={() => openCheckInDialog()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Check-in
            </button>
            <button
              type="button"
              className="btn-action btn-action--outline"
              onClick={() => setShowEditTargetsDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
              </svg>
              Editar Metas
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowEditIndicatorDialog(true)}
              title="Editar configurações do indicador"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="monthly-grid">
          {monthlyData.map((month) => {
            const hasValue = month.value !== null;
            const percentage = month.target > 0 && hasValue
              ? ((month.value / month.target) * 100).toFixed(0)
              : null;
            const pctColor = percentage >= 100 ? 'success' : percentage >= 80 ? 'warning' : 'danger';

            return (
              <div key={month.month} className="monthly-item">
                <div className="monthly-item__header">
                  <svg viewBox="0 0 24 24" width="16" height="16" className="calendar-icon">
                    <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                  <span className="monthly-item__month">{month.monthName}</span>
                  {hasValue && month.notes && (
                    <svg viewBox="0 0 24 24" width="14" height="14" className="notes-icon" title={month.notes}>
                      <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                  )}
                  {hasValue && (
                    <svg viewBox="0 0 24 24" width="14" height="14" className="clock-icon">
                      <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                  )}
                </div>
                <div className="monthly-item__values">
                  <div className="value-group">
                    <span className="value-group__label">Planejado</span>
                    <span className="value-group__number">
                      {formatValue(month.target, indicador.metric_type)}
                    </span>
                  </div>
                  <div className="value-group">
                    <span className="value-group__label">Realizado</span>
                    {hasValue ? (
                      <span
                        className="value-group__number value-group__number--clickable"
                        onClick={() => openCheckInDialog(month.month, month.checkIn)}
                        title="Clique para editar"
                      >
                        {formatValue(month.value, indicador.metric_type)}
                        <span className={`value-badge value-badge--${pctColor}`}>
                          {percentage}%
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-register"
                        onClick={() => openCheckInDialog(month.month)}
                      >
                        Registrar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Section - Comments & Recovery Plans */}
      <div className="detail-bottom-grid">
        {/* Comments */}
        <section className="card comments-card">
          <div className="card-header">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <h3>Comentários ({comments.length})</h3>
          </div>

          <form onSubmit={handleSubmitComment} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicione um comentário..."
              rows={3}
            />
            <button
              type="submit"
              className="btn-comment"
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? 'Enviando...' : 'Comentar'}
            </button>
          </form>

          {comments.length === 0 ? (
            <p className="empty-text">Nenhum comentário ainda</p>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-avatar">
                    {comment.user_name?.charAt(0) || 'U'}
                  </div>
                  <div className="comment-content">
                    <div className="comment-header">
                      <span className="comment-author">{comment.user_name}</span>
                      <span className="comment-date">
                        {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="comment-text">{comment.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recovery Plans */}
        <section className="card recovery-card">
          <div className="card-header">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <h3>Planos de Recuperação ({recoveryPlans.length})</h3>
            <button
              type="button"
              className="btn-add"
              onClick={() => setShowRecoveryPlanDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Novo
            </button>
          </div>

          {recoveryPlans.length === 0 ? (
            <p className="empty-text">Nenhum plano de recuperação</p>
          ) : (
            <div className="recovery-list">
              {recoveryPlans.map(plan => {
                const statusLabel = {
                  pendente: 'Pendente',
                  em_andamento: 'Em andamento',
                  concluido: 'Concluído',
                  cancelado: 'Cancelado',
                  pending: 'Pendente',
                  in_progress: 'Em Andamento',
                  completed: 'Concluído'
                }[plan.status] || plan.status;

                const planActions = parseAcoes(plan.acoes);
                const completedCount = planActions.filter(a => a.concluida).length;

                return (
                  <div key={plan.id} className="recovery-item-expanded">
                    <div
                      className="recovery-item__top recovery-item--clickable"
                      onClick={() => openPlanDialog(plan)}
                    >
                      <div className="recovery-item__header">
                        <span className={`recovery-status status--${plan.status}`}>
                          {statusLabel}
                        </span>
                        {plan.mes_referencia && (
                          <span className="recovery-reference">
                            {MONTH_SHORT[(plan.mes_referencia || 1) - 1]}/{plan.ano_referencia || new Date().getFullYear()}
                          </span>
                        )}
                      </div>
                      <p className="recovery-description">{plan.descricao}</p>
                      {plan.prazo && (
                        <span className="recovery-prazo">
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                          </svg>
                          Prazo: {new Date(plan.prazo).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    {/* Activities section */}
                    {planActions.length > 0 && (
                      <div className="recovery-activities">
                        <div className="recovery-activities__header">
                          <span className="recovery-activities__title">
                            Atividades ({completedCount}/{planActions.length})
                          </span>
                        </div>
                        <div className="recovery-activities__list">
                          {planActions.map((activity, actIdx) => (
                            <label
                              key={actIdx}
                              className={`recovery-activity-item ${activity.concluida ? 'recovery-activity-item--done' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={activity.concluida || false}
                                onChange={async (e) => {
                                  e.stopPropagation();
                                  const newConcluida = e.target.checked;
                                  const currentActions = parseAcoes(plan.acoes);
                                  currentActions[actIdx] = { ...currentActions[actIdx], concluida: newConcluida };
                                  const newAcoesJson = JSON.stringify(currentActions);
                                  await handleUpdateRecoveryPlan(plan.id, { acoes: newAcoesJson }, true);
                                  setRecoveryPlans(prev => prev.map(p =>
                                    p.id === plan.id ? { ...p, acoes: newAcoesJson } : p
                                  ));
                                }}
                              />
                              <span className="recovery-activity-check">
                                <svg viewBox="0 0 24 24" width="12" height="12">
                                  <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                              </span>
                              <div className="recovery-activity-content">
                                <span className="recovery-activity-text">{activity.descricao}</span>
                                {activity.responsavel && (
                                  <span className="recovery-activity-responsible">
                                    <svg viewBox="0 0 24 24" width="10" height="10">
                                      <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                    </svg>
                                    {activity.responsavel}
                                  </span>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Check-in Dialog */}
      {showCheckInDialog && (
        <CreateCheckInDialog
          indicador={indicador}
          ano={selectedYear}
          mes={selectedMonth}
          existingCheckIn={selectedCheckIn}
          onSubmit={handleCreateCheckIn}
          onDelete={handleDeleteCheckIn}
          onClose={closeCheckInDialog}
        />
      )}

      {/* Edit Monthly Targets Dialog */}
      {showEditTargetsDialog && (
        <EditMonthlyTargetsDialog
          indicador={indicador}
          onSubmit={handleUpdateMonthlyTargets}
          onClose={() => setShowEditTargetsDialog(false)}
        />
      )}

      {/* Create Recovery Plan Dialog */}
      {showRecoveryPlanDialog && (
        <CreateRecoveryPlanDialog
          responsaveis={teamMembers}
          indicador={indicador}
          onSubmit={handleCreateRecoveryPlan}
          onClose={() => setShowRecoveryPlanDialog(false)}
        />
      )}

      {/* Edit Indicator Dialog */}
      {showEditIndicatorDialog && (
        <EditIndicatorDialog
          indicador={indicador}
          onSubmit={handleEditIndicator}
          onClose={() => setShowEditIndicatorDialog(false)}
        />
      )}

      {/* View Recovery Plan Dialog */}
      {selectedPlan && (
        <ViewRecoveryPlanDialog
          plan={selectedPlan}
          responsaveis={teamMembers}
          onUpdate={async (data) => {
            await handleUpdateRecoveryPlan(selectedPlan.id, data, true);
            // Atualiza estados locais sem refresh
            setSelectedPlan(prev => ({ ...prev, ...data }));
            setRecoveryPlans(prev => prev.map(p =>
              p.id === selectedPlan.id ? { ...p, ...data } : p
            ));
          }}
          onAddActivity={async (activity) => {
            const currentActions = parseAcoes(selectedPlan.acoes);
            const newActions = [...currentActions, activity];
            const newAcoesJson = JSON.stringify(newActions);
            await handleUpdateRecoveryPlan(selectedPlan.id, { acoes: newAcoesJson }, true);
            // Atualiza estados locais
            setSelectedPlan(prev => ({ ...prev, acoes: newAcoesJson }));
            setRecoveryPlans(prev => prev.map(p =>
              p.id === selectedPlan.id ? { ...p, acoes: newAcoesJson } : p
            ));
          }}
          onToggleActivity={async (index, concluida) => {
            const currentActions = parseAcoes(selectedPlan.acoes);
            currentActions[index] = { ...currentActions[index], concluida };
            const newAcoesJson = JSON.stringify(currentActions);
            await handleUpdateRecoveryPlan(selectedPlan.id, { acoes: newAcoesJson }, true);
            // Atualiza estados locais
            setSelectedPlan(prev => ({ ...prev, acoes: newAcoesJson }));
            setRecoveryPlans(prev => prev.map(p =>
              p.id === selectedPlan.id ? { ...p, acoes: newAcoesJson } : p
            ));
          }}
          onDeleteActivity={async (index) => {
            const currentActions = parseAcoes(selectedPlan.acoes);
            currentActions.splice(index, 1);
            const newAcoesJson = JSON.stringify(currentActions);
            await handleUpdateRecoveryPlan(selectedPlan.id, { acoes: newAcoesJson }, true);
            // Atualiza estados locais
            setSelectedPlan(prev => ({ ...prev, acoes: newAcoesJson }));
            setRecoveryPlans(prev => prev.map(p =>
              p.id === selectedPlan.id ? { ...p, acoes: newAcoesJson } : p
            ));
          }}
          onClose={closePlanDialog}
        />
      )}
    </div>
  );
}

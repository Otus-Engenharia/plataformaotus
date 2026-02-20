import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculateIndicatorScore,
  calculateAccumulatedProgress,
  formatValue,
  getMonthsForCycle,
  getCycleMonthRange,
  isMeasurementMonth
} from '../../utils/indicator-utils';
import ScoreZoneGauge from '../../components/indicadores/ScoreZoneGauge';
import CreateCheckInDialog from '../../components/indicadores/dialogs/CreateCheckInDialog';
import CreateRecoveryPlanDialog from '../../components/indicadores/dialogs/CreateRecoveryPlanDialog';
import ViewRecoveryPlanDialog from '../../components/indicadores/dialogs/ViewRecoveryPlanDialog';
import UnifiedEditIndicatorDialog from '../../components/indicadores/dialogs/UnifiedEditIndicatorDialog';
import './IndicatorDetailView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CONSOLIDATION_LABELS = {
  sum: {
    realizado: 'Realizado Acumulado',
    planejado: 'Planejado Acumulado',
    score: 'Score Acumulado',
    sublabelPlanejado: 'Esperado até agora',
    description: 'Soma dos valores mensais',
    tagLabel: 'Soma',
    tagColor: 'blue',
  },
  average: {
    realizado: 'Realizado (Média)',
    planejado: 'Planejado (Média)',
    score: 'Score (Média)',
    sublabelPlanejado: 'Média esperada',
    description: 'Média dos valores registrados',
    tagLabel: 'Média',
    tagColor: 'purple',
  },
  last_value: {
    realizado: 'Último Realizado',
    planejado: 'Meta Atual',
    score: 'Score Atual',
    sublabelPlanejado: 'Meta do período',
    description: 'Último valor do período',
    tagLabel: 'Último Valor',
    tagColor: 'green',
  },
  manual: {
    realizado: 'Realizado',
    planejado: 'Meta',
    score: 'Score',
    sublabelPlanejado: 'Definido manualmente',
    description: 'Definido manualmente',
    tagLabel: 'Manual',
    tagColor: 'orange',
  },
};

function EditableKpiValue({ value, onSave, canEdit, formatFn, placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setTempValue(value ?? '');
  }, [value]);

  const handleSave = async () => {
    if (saving) return;
    const newValue = tempValue === '' ? null : parseFloat(tempValue);
    const oldValue = value ?? null;
    if (newValue === oldValue) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch {
      setTempValue(value ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    else if (e.key === 'Escape') { setTempValue(value ?? ''); setEditing(false); }
  };

  const displayValue = formatFn ? formatFn(value) : (value ?? placeholder);

  if (!canEdit) return <span className="kpi-value">{displayValue}</span>;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        value={tempValue}
        onChange={e => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="kpi-inline-input"
        disabled={saving}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className="kpi-value kpi-value--editable"
      onClick={() => { setTempValue(value ?? ''); setEditing(true); }}
      title="Clique para editar"
    >
      {displayValue}
      <svg className="kpi-edit-icon" viewBox="0 0 24 24" width="12" height="12">
        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </span>
  );
}

/**
 * Barra de range visual com zonas coloridas e ponteiro.
 * Mostra onde um valor cai dentro do range 80%/100%/120%.
 */
function MonthRangeBar({ score, min, target, max, value, metricType, hasValue, size = 'md' }) {
  const getPosition = (s) => {
    const clamped = Math.max(0, Math.min(s, 120));
    if (clamped < 80) return (clamped / 80) * 25;
    if (clamped < 100) return 25 + ((clamped - 80) / 20) * 25;
    if (clamped < 120) return 50 + ((clamped - 100) / 20) * 25;
    return 75;
  };

  const getZoneId = (s) => {
    if (s >= 120) return 'superou';
    if (s >= 100) return 'alvo';
    if (s >= 80) return 'risco';
    return 'zerado';
  };

  const pos = hasValue && score != null ? getPosition(score) : null;
  const zoneId = hasValue && score != null ? getZoneId(score) : null;

  return (
    <div className={`range-bar range-bar--${size}`}>
      <div className="range-bar__track">
        <div className="range-bar__zone range-bar__zone--zerado" />
        <div className="range-bar__zone range-bar__zone--risco" />
        <div className="range-bar__zone range-bar__zone--alvo" />
        <div className="range-bar__zone range-bar__zone--superou" />
        {pos !== null && (
          <div
            className={`range-bar__needle range-bar__needle--${zoneId}`}
            style={{ left: `${pos}%` }}
          >
            <div className="range-bar__needle-line" />
            {size !== 'sm' && (
              <span className="range-bar__needle-value">
                {formatValue(value, metricType)}
              </span>
            )}
          </div>
        )}
      </div>
      {size !== 'sm' && (
        <div className="range-bar__labels">
          <span className="range-bar__label range-bar__label--min">
            {formatValue(min, metricType)}
          </span>
          <span className="range-bar__label range-bar__label--target">
            {formatValue(target, metricType)}
          </span>
          <span className="range-bar__label range-bar__label--max">
            {formatValue(max, metricType)}
          </span>
        </div>
      )}
    </div>
  );
}

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
  const [showEditIndicatorDialog, setShowEditIndicatorDialog] = useState(false);
  const [showRecoveryPlanDialog, setShowRecoveryPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedCheckIn, setSelectedCheckIn] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [recoveryPlanContext, setRecoveryPlanContext] = useState(null);

  useEffect(() => {
    fetchIndicador();
  }, [id]);

  // Inicializa o quarter selecionado quando o indicador carrega
  useEffect(() => {
    if (!indicador) return;
    const ciclo = indicador.ciclo || 'anual';
    const currentQ = `q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    if (ciclo === 'anual' || ciclo === 'trimestral') {
      setSelectedQuarter(currentQ);
    } else if (/^q[1-4]$/.test(ciclo)) {
      setSelectedQuarter(ciclo);
    }
  }, [indicador?.ciclo, indicador?.id]);

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
      setSelectedCheckIn(null);
      await fetchIndicador();

      // Calcular score do mês para verificar necessidade de plano de recuperação
      const monthlyTargets = indicador.monthly_targets || {};
      const target = parseFloat(monthlyTargets[checkInData.mes]) || parseFloat(indicador.meta) || 0;
      if (target > 0) {
        const min = target * ratio80;
        const max = target * ratio120;
        const monthScore = calculateIndicatorScore(
          checkInData.valor,
          min,
          target,
          max,
          indicador.is_inverse
        );

        if (monthScore < 80) {
          // OBRIGATÓRIO - Score ZERADO
          setRecoveryPlanContext({ month: checkInData.mes, score: monthScore, isMandatory: true });
        } else if (monthScore < 100) {
          // SUGESTÃO - Score EM RISCO
          setRecoveryPlanContext({ month: checkInData.mes, score: monthScore, isMandatory: false });
        }
      }
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

  const handleUpdateIndicatorField = async (data) => {
    const res = await fetch(`${API_URL}/api/ind/indicators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar valor');
    }

    await fetchIndicador();
  };

  const handleToggleAutoCalculate = async () => {
    const newValue = !indicador.auto_calculate;
    // Ao ativar auto, limpa valores manuais
    const data = { auto_calculate: newValue };
    if (newValue) {
      data.realizado_acumulado = null;
      data.planejado_acumulado = null;
    }
    await handleUpdateIndicatorField(data);
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

  // Ratios derivados dos thresholds do indicador
  const metaNum = parseFloat(indicador?.meta) || 0;
  const ratio80 = metaNum > 0
    ? (indicador?.threshold_80 != null ? parseFloat(indicador.threshold_80) : metaNum * 0.8) / metaNum
    : 0.8;
  const ratio120 = metaNum > 0
    ? (indicador?.threshold_120 != null ? parseFloat(indicador.threshold_120) : metaNum * 1.2) / metaNum
    : 1.2;

  const getMonthlyData = () => {
    let months = getMonthsForCycle(indicador?.ciclo || 'anual');
    // Filtrar pelo quarter selecionado
    if (selectedQuarter && (indicador?.ciclo === 'anual' || indicador?.ciclo === 'trimestral')) {
      const { start, end } = getCycleMonthRange(selectedQuarter);
      months = months.filter(m => m.value >= start && m.value <= end);
    }
    // Filtrar apenas meses de medição para a frequência (ex: semestral → só Jun e Dez)
    const freq = indicador?.frequencia || 'mensal';
    if (freq !== 'mensal') {
      months = months.filter(m => isMeasurementMonth(m.value, freq));
    }
    const yearCheckIns = checkIns.filter(c => c.ano === selectedYear);

    return months.map(m => {
      const checkIn = yearCheckIns.find(c => c.mes === m.value);
      const mt = indicador?.monthly_targets?.[m.value];
      const target = mt != null ? parseFloat(mt) : (parseFloat(indicador?.meta) || 0);
      const min = target * ratio80;
      const max = target * ratio120;

      return {
        month: m.value,
        monthName: MONTH_NAMES[m.value - 1],
        shortName: MONTH_SHORT[m.value - 1],
        target,
        min,
        max,
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
    if (score >= 120) return 'Superou';
    if (score >= 100) return 'No alvo';
    if (score >= 80) return 'Em risco';
    return 'Zerado';
  };

  const getScoreColor = (score) => {
    if (score >= 120) return 'excellent';
    if (score >= 100) return 'success';
    if (score >= 80) return 'warning';
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

  const monthlyData = getMonthlyData();
  const currentMonth = new Date().getMonth() + 1;
  const yearCheckIns = checkIns.filter(c => c.ano === selectedYear);
  // Usa o quarter selecionado para calcular acumulado quando aplicável
  const cycleForCalc = selectedQuarter && (indicador.ciclo === 'anual' || indicador.ciclo === 'trimestral')
    ? selectedQuarter
    : indicador.ciclo;
  const autoAccumulated = calculateAccumulatedProgress({ ...indicador, ciclo: cycleForCalc }, yearCheckIns, currentMonth);
  const cLabels = CONSOLIDATION_LABELS[indicador.consolidation_type] || CONSOLIDATION_LABELS.last_value;
  const isAutoCalc = indicador.auto_calculate !== false; // default true

  // Auto: calculado dos check-ins/metas; Manual: valores salvos no indicador
  const realizadoValue = isAutoCalc ? autoAccumulated.realizado : (indicador.realizado_acumulado ?? 0);
  const planejadoValue = isAutoCalc ? autoAccumulated.planejado : (indicador.planejado_acumulado ?? 0);
  const hasCheckIns = isAutoCalc ? autoAccumulated.hasData : true;
  const score = planejadoValue > 0 && hasCheckIns
    ? calculateIndicatorScore(realizadoValue, planejadoValue * 0.8, planejadoValue, planejadoValue * 1.2, indicador.is_inverse)
    : null;
  const scoreColor = score !== null ? getScoreColor(score) : 'neutral';

  // Range acumulado
  const accMin = planejadoValue * ratio80;
  const accMax = planejadoValue * ratio120;

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
          <span className="score-badge__value">{score !== null ? score.toFixed(0) : '--'}</span>
          <span className="score-badge__trend">{score !== null ? getScoreLabel(score) : 'Sem dados'}</span>
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
                {indicador.pessoa.avatar_url ? (
                  <img src={indicador.pessoa.avatar_url} alt="" className="avatar-img" />
                ) : (
                  indicador.pessoa.name?.charAt(0) || 'U'
                )}
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
          <span className={`tag tag--consolidation tag--consolidation-${cLabels.tagColor}`}>
            {cLabels.tagColor === 'blue' && (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M18 4H6v2l6.5 6L6 18v2h12v-3h-7l5-5-5-5h7z"/>
              </svg>
            )}
            {cLabels.tagColor === 'purple' && (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
              </svg>
            )}
            {cLabels.tagColor === 'green' && (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
            )}
            {cLabels.tagColor === 'orange' && (
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            )}
            {cLabels.tagLabel}
          </span>
        </div>
      </section>

      {/* Progress Card - KPIs + Range + Score Bar */}
      <section className="card progress-card">
        <div className="progress-kpi-row">
          <div className="kpi-block kpi-block--hero">
            <span className="kpi-label">Meta Final</span>
            <span className="kpi-value kpi-value--hero">
              {formatValue(indicador.meta, indicador.metric_type)}
            </span>
            <span className="kpi-sublabel">
              Peso: {indicador.peso || 1} · {cLabels.description}
            </span>
            <div className="kpi-range-row">
              <span className="kpi-range kpi-range--min">
                Mín: {formatValue(metaNum * ratio80, indicador.metric_type)}
              </span>
              <span className="kpi-range kpi-range--max">
                Sup: {formatValue(metaNum * ratio120, indicador.metric_type)}
              </span>
            </div>
          </div>

          <div className={`kpi-block kpi-block--accent-${scoreColor}`}>
            <div className="kpi-label-row">
              <span className="kpi-label">{cLabels.realizado}</span>
              {isAutoCalc ? (
                <span className="kpi-auto-badge">
                  <svg viewBox="0 0 24 24" width="10" height="10">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  auto
                </span>
              ) : (
                <span className="kpi-manual-badge">editar</span>
              )}
            </div>
            {isAutoCalc ? (
              <span className="kpi-value">
                {formatValue(realizadoValue, indicador.metric_type)}
              </span>
            ) : (
              <EditableKpiValue
                value={realizadoValue}
                onSave={(v) => handleUpdateIndicatorField({ realizado_acumulado: v ?? 0 })}
                canEdit={isPrivileged}
                formatFn={(v) => formatValue(v, indicador.metric_type)}
              />
            )}
            <span className={`kpi-score kpi-score--${scoreColor}`}>
              Score: {score !== null ? score.toFixed(0) : '--'}
            </span>
            {planejadoValue > 0 && (
              <MonthRangeBar
                score={score}
                min={accMin}
                target={planejadoValue}
                max={accMax}
                value={realizadoValue}
                metricType={indicador.metric_type}
                hasValue={realizadoValue > 0}
                size="sm"
              />
            )}
          </div>

          <div className="kpi-block">
            <div className="kpi-label-row">
              <span className="kpi-label">{cLabels.planejado}</span>
              {isAutoCalc ? (
                <span className="kpi-auto-badge">
                  <svg viewBox="0 0 24 24" width="10" height="10">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  auto
                </span>
              ) : (
                <span className="kpi-manual-badge">editar</span>
              )}
            </div>
            {isAutoCalc ? (
              <span className="kpi-value">
                {formatValue(planejadoValue, indicador.metric_type)}
              </span>
            ) : (
              <EditableKpiValue
                value={planejadoValue}
                onSave={(v) => handleUpdateIndicatorField({ planejado_acumulado: v ?? 0 })}
                canEdit={isPrivileged}
                formatFn={(v) => formatValue(v, indicador.metric_type)}
              />
            )}
            <span className="kpi-sublabel">{cLabels.sublabelPlanejado}</span>
            <div className="kpi-range-row">
              <span className="kpi-range kpi-range--min">
                Mín: {formatValue(accMin, indicador.metric_type)}
              </span>
              <span className="kpi-range kpi-range--max">
                Sup: {formatValue(accMax, indicador.metric_type)}
              </span>
            </div>
          </div>
        </div>

        <div className="progress-bar-section">
          <div className="progress-bar-header">
            <span className="progress-label">{cLabels.score}</span>
          </div>
          <ScoreZoneGauge score={score} size="lg" showLabels showLegend showScore />
        </div>

        {isPrivileged && (
          <div className="progress-card__footer">
            <div className="progress-card__footer-left">
              <svg viewBox="0 0 24 24" width="12" height="12">
                <path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
              {isAutoCalc ? (
                <span><strong>Planejado</strong> e <strong>Realizado</strong> calculados automaticamente dos check-ins e metas mensais.</span>
              ) : (
                <span><strong>Planejado</strong> e <strong>Realizado</strong> definidos manualmente. Clique nos valores para editar.</span>
              )}
            </div>
            <label className="ind-toggle" title={isAutoCalc ? 'Desativar cálculo automático' : 'Ativar cálculo automático'}>
              <input
                type="checkbox"
                checked={isAutoCalc}
                onChange={handleToggleAutoCalculate}
              />
              <span className="ind-toggle__slider" />
              <span className="ind-toggle__label">{isAutoCalc ? 'Automático' : 'Manual'}</span>
            </label>
          </div>
        )}
      </section>

      {/* Monthly Targets Card */}
      <section className="card monthly-card">
        <div className="monthly-header">
          <div className="monthly-header__left">
            <h3 className="monthly-title">Metas Mensais</h3>
            <span className="monthly-subtitle">Planejado vs Realizado</span>
          </div>
          {(isPrivileged || indicador?.person_email === user?.email) && (
            <div className="monthly-header__right">
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
          )}
        </div>

        {/* Quarter Selector */}
        {(indicador.ciclo === 'anual' || indicador.ciclo === 'trimestral') && (
          <div className="quarter-selector">
            {[
              { key: 'q1', label: 'Q1', months: 'Jan-Mar' },
              { key: 'q2', label: 'Q2', months: 'Abr-Jun' },
              { key: 'q3', label: 'Q3', months: 'Jul-Set' },
              { key: 'q4', label: 'Q4', months: 'Out-Dez' },
            ].map(q => (
              <button
                key={q.key}
                type="button"
                className={`quarter-tab ${selectedQuarter === q.key ? 'quarter-tab--active' : ''}`}
                onClick={() => setSelectedQuarter(q.key)}
              >
                {q.label}
                <span className="quarter-months">{q.months}</span>
              </button>
            ))}
          </div>
        )}

        <div className="monthly-grid">
          {monthlyData.map((month) => {
            const hasValue = month.value !== null;
            const monthScore = hasValue && month.target > 0
              ? calculateIndicatorScore(
                  month.value,
                  month.min,
                  month.target,
                  month.max,
                  indicador.is_inverse
                )
              : null;
            const monthColor = monthScore !== null ? getScoreColor(monthScore) : null;

            return (
              <div key={month.month} className={`monthly-item ${hasValue ? `monthly-item--${monthColor}` : 'monthly-item--empty'}`}>
                <div className="monthly-item__header">
                  <span className="monthly-item__month">{month.monthName}</span>
                  {hasValue && month.notes && (
                    <svg viewBox="0 0 24 24" width="14" height="14" className="notes-icon" title={month.notes}>
                      <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                  )}
                  {hasValue && monthScore !== null && (
                    <span className={`month-score-badge month-score-badge--${monthColor}`}>
                      {monthScore.toFixed(0)}
                    </span>
                  )}
                </div>

                {/* Range Bar Visual */}
                {month.target > 0 && (
                  <MonthRangeBar
                    score={monthScore || 0}
                    min={month.min}
                    target={month.target}
                    max={month.max}
                    value={month.value}
                    metricType={indicador.metric_type}
                    hasValue={hasValue}
                    size="md"
                  />
                )}

                {/* Range reference values */}
                {month.target > 0 && (
                  <div className="monthly-item__range-refs">
                    <div className="range-ref">
                      <span className="range-ref__label">Mínima</span>
                      <span className="range-ref__value range-ref__value--min">
                        {formatValue(month.min, indicador.metric_type)}
                      </span>
                    </div>
                    <div className="range-ref range-ref--center">
                      <span className="range-ref__label">Meta</span>
                      <span className="range-ref__value range-ref__value--target">
                        {formatValue(month.target, indicador.metric_type)}
                      </span>
                    </div>
                    <div className="range-ref">
                      <span className="range-ref__label">Superação</span>
                      <span className="range-ref__value range-ref__value--max">
                        {formatValue(month.max, indicador.metric_type)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Realizado */}
                <div className="monthly-item__realizado">
                  {hasValue ? (
                    <>
                      <div className="monthly-item__realizado-row">
                        <span className="monthly-item__realizado-label">Realizado</span>
                        <span className="monthly-item__realizado-value">
                          {formatValue(month.value, indicador.metric_type)}
                        </span>
                        <button
                          type="button"
                          className="btn-edit-checkin"
                          onClick={() => openCheckInDialog(month.month, month.checkIn)}
                          title="Editar medição"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                      </div>
                      {monthScore !== null && (
                        <span className={`monthly-item__status monthly-item__status--${monthColor}`}>
                          {getScoreLabel(monthScore)}
                        </span>
                      )}
                    </>
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

      {/* Create Recovery Plan Dialog */}
      {showRecoveryPlanDialog && (
        <CreateRecoveryPlanDialog
          responsaveis={teamMembers}
          indicador={indicador}
          initialMonth={recoveryPlanContext?.month}
          initialYear={selectedYear}
          onSubmit={async (planData) => {
            await handleCreateRecoveryPlan(planData);
            setRecoveryPlanContext(null);
          }}
          onClose={() => {
            // Se é obrigatório, não permite fechar sem criar
            if (recoveryPlanContext?.isMandatory) return;
            setShowRecoveryPlanDialog(false);
            setRecoveryPlanContext(null);
          }}
        />
      )}

      {/* Edit Indicator Dialog (Unified - same as AdminCargos) */}
      {showEditIndicatorDialog && (
        <UnifiedEditIndicatorDialog
          indicador={indicador}
          isTemplate={false}
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

      {/* Recovery Plan Suggestion/Mandatory Dialog */}
      {recoveryPlanContext && !showRecoveryPlanDialog && (
        <div className="dialog-overlay recovery-suggestion-overlay">
          <div className="recovery-suggestion-dialog">
            <div className="recovery-suggestion-dialog__header">
              <h3>
                {recoveryPlanContext.isMandatory
                  ? 'Plano de Recuperação Obrigatório'
                  : 'Sugestão de Plano de Recuperação'}
              </h3>
              {!recoveryPlanContext.isMandatory && (
                <button
                  className="dialog-close"
                  onClick={() => setRecoveryPlanContext(null)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="recovery-suggestion-dialog__body">
              <div className={`score-warning score-warning--${recoveryPlanContext.isMandatory ? 'danger' : 'warning'}`}>
                <div className="score-warning__badge">
                  <span className="score-warning__value">{recoveryPlanContext.score.toFixed(0)}</span>
                  <span className="score-warning__label">{getScoreLabel(recoveryPlanContext.score)}</span>
                </div>
                <p className="score-warning__text">
                  {recoveryPlanContext.isMandatory
                    ? `O check-in de ${MONTH_NAMES[(recoveryPlanContext.month || 1) - 1]} resultou em score zerado. É obrigatório criar um plano de recuperação.`
                    : `O check-in de ${MONTH_NAMES[(recoveryPlanContext.month || 1) - 1]} ficou abaixo da meta. Recomendamos criar um plano de recuperação.`}
                </p>
              </div>
            </div>

            <div className="recovery-suggestion-dialog__actions">
              {!recoveryPlanContext.isMandatory && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRecoveryPlanContext(null)}
                >
                  Não agora
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowRecoveryPlanDialog(true);
                }}
              >
                Criar Plano de Recuperação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

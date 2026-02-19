import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculatePersonScore,
  calculateIndicatorScore,
  calculateAccumulatedProgress,
  filterAtRiskIndicators,
  getIndicatorScore,
  formatValue,
  getCycleOptions,
  getCurrentCycle,
  getCurrentYear,
  getCycleLabel,
  getCycleMonthRange,
  hasActiveMonthsInCycle,
  parseAcoes,
} from '../../utils/indicator-utils';
import ScoreZoneGauge, { ScoreRing } from '../../components/indicadores/ScoreZoneGauge';
import MiniSparkline from '../../components/indicadores/dashboard/MiniSparkline';
import './DashboardIndicadores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function getIndicatorMonthlyData(indicador, ciclo, ano) {
  const { start, end } = getCycleMonthRange(ciclo);
  const months = [];
  for (let m = start; m <= end; m++) {
    const checkIn = (indicador.check_ins || []).find(ci => ci.mes === m && ci.ano === ano);
    const target = parseFloat(indicador.monthly_targets?.[m]) || parseFloat(indicador.meta) || 0;
    const value = checkIn ? parseFloat(checkIn.valor) : null;
    const t80 = target * 0.8;
    const t120 = target * 1.2;
    const score = value !== null && target > 0
      ? calculateIndicatorScore(value, t80, target, t120, indicador.is_inverse)
      : null;
    months.push({ month: m, monthName: MONTH_SHORT[m - 1], value, target, score, notas: checkIn?.notas || null });
  }
  return months;
}

function getAllNotes(indicador) {
  return (indicador.check_ins || [])
    .filter(ci => ci.notas && ci.notas.trim())
    .sort((a, b) => b.mes - a.mes)
    .map(ci => ({ month: MONTH_SHORT[ci.mes - 1], monthNum: ci.mes, text: ci.notas }));
}

function getScoreZoneId(score) {
  if (score === null || score === undefined) return 'none';
  if (score >= 120) return 'superou';
  if (score >= 100) return 'alvo';
  if (score >= 80) return 'risco';
  return 'zerado';
}

function getActivePlans(indicador) {
  return (indicador.recovery_plans || [])
    .filter(p => p.status === 'pendente' || p.status === 'em_andamento');
}

// Premium Metric Card with glassmorphism
function MetricCard({ title, value, subtitle, icon, variant = 'default', delay = 0 }) {
  return (
    <div
      className={`metric-card metric-card--${variant}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="metric-card__glow" />
      <div className="metric-card__content">
        <div className="metric-card__header">
          <span className="metric-card__title">{title}</span>
          {icon && <span className="metric-card__icon">{icon}</span>}
        </div>
        <div className="metric-card__value">{value}</div>
        {subtitle && <div className="metric-card__subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

// Premium Indicator Card (same as DashboardIndicadores)
function IndicadorCard({ indicador, ciclo, ano, index, accumulatedData }) {
  const acc = accumulatedData || { realizado: 0, planejado: 0, score: 0 };
  const score = acc.score;
  const metaFormatada = formatValue(indicador.meta, indicador.metric_type);
  const realizadoFormatado = formatValue(acc.realizado, indicador.metric_type);
  const planejadoFormatado = formatValue(acc.planejado, indicador.metric_type);
  const monthlyData = getIndicatorMonthlyData(indicador, ciclo, ano);
  const allNotes = getAllNotes(indicador);
  const activePlans = getActivePlans(indicador);

  const getStatus = () => {
    if (score >= 100) return 'success';
    if (score >= 80) return 'warning';
    return 'danger';
  };
  const status = getStatus();

  const progressPct = acc.planejado > 0
    ? Math.min((acc.realizado / acc.planejado) * 100, 150)
    : 0;

  return (
    <div
      className={`ind-card ind-card--${status}`}
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      {/* SECTION 1: Identity */}
      <div className="ind-card__identity">
        <div className="ind-card__title-block">
          <h3 className="ind-card__title">{indicador.nome}</h3>
          {indicador.descricao && (
            <p className="ind-card__description">{indicador.descricao}</p>
          )}
        </div>
        {allNotes.length > 0 && (
          <span className="ind-card__notes-badge" title={`${allNotes.length} nota(s)`}>
            <svg viewBox="0 0 24 24" width="12" height="12">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
            </svg>
            {allNotes.length}
          </span>
        )}
      </div>

      {/* SECTION 2: Result Cluster (Score + Peso) */}
      <div className="ind-card__result-cluster">
        <ScoreRing score={score} size={56} />
        <div className="ind-card__result-info">
          <span className={`ind-card__zone-label ind-card__zone-label--${getScoreZoneId(score)}`}>
            {score >= 120 ? 'Superou' : score >= 100 ? 'No alvo' : score >= 80 ? 'Em risco' : 'Zerado'}
          </span>
          <span className="ind-card__peso-tag">
            Peso {indicador.peso || 1}
          </span>
        </div>
      </div>

      {/* SECTION 3: Key Metrics (Meta, Realizado, Planejado) */}
      <div className="ind-card__metrics">
        <div className="ind-card__meta-row">
          <span className="ind-card__meta-label">Meta (anual)</span>
          <span className="ind-card__meta-value">{metaFormatada}</span>
        </div>

        <div className="ind-card__comparison">
          <div className="ind-card__metric ind-card__metric--realizado">
            <span className="ind-card__metric-label">Realizado</span>
            <span className="ind-card__metric-value">{realizadoFormatado}</span>
          </div>
          <div className="ind-card__metric-divider">
            <span className="ind-card__metric-vs">vs</span>
          </div>
          <div className="ind-card__metric ind-card__metric--planejado">
            <span className="ind-card__metric-label">Planejado</span>
            <span className="ind-card__metric-value">{planejadoFormatado}</span>
          </div>
        </div>

        <div className="ind-card__progress-track">
          <div
            className={`ind-card__progress-fill ind-card__progress-fill--${status}`}
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
          <span className="ind-card__progress-label">
            {progressPct > 0 ? `${Math.round(progressPct)}%` : '--'}
          </span>
        </div>
      </div>

      {/* SECTION 4: Monthly Sparkline */}
      <div className="ind-card__sparkline">
        <div className="ind-card__sparkline-header">
          <span className="ind-card__sparkline-label">Evolucao Mensal</span>
        </div>
        <MiniSparkline months={monthlyData} height={64} />
      </div>

      {/* SECTION 5: Zone Gauge */}
      <div className="ind-card__zone-bar">
        <ScoreZoneGauge score={score} size="sm" showLabels={false} showScore={false} />
      </div>

      {/* SECTION 6: Recovery Plans */}
      {activePlans.length > 0 && (
        <div className="ind-card__alerts">
          <div className="ind-card__alerts-header">
            <svg viewBox="0 0 24 24" width="13" height="13" className="ind-card__alerts-icon">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <span className="ind-card__alerts-title">
              Plano de Recuperacao ({activePlans.length})
            </span>
          </div>
          {activePlans.map(plan => {
            const actions = parseAcoes(plan.acoes);
            const completed = actions.filter(a => a.concluida).length;
            const total = actions.length;
            const statusConfig = {
              pendente: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.06)', label: 'Pendente' },
              em_andamento: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.06)', label: 'Em andamento' },
            };
            const config = statusConfig[plan.status] || statusConfig.pendente;

            return (
              <div key={plan.id} className="ind-card__alert-strip" style={{ '--alert-color': config.color, '--alert-bg': config.bg }}>
                <div className="ind-card__alert-top">
                  <span className="ind-card__alert-dot" />
                  <span className="ind-card__alert-status">{config.label}</span>
                  {total > 0 && (
                    <span className="ind-card__alert-progress">{completed}/{total}</span>
                  )}
                </div>
                {plan.descricao && (
                  <p className="ind-card__alert-desc">{plan.descricao}</p>
                )}
                {total > 0 && (
                  <div className="ind-card__alert-bar-track">
                    <div
                      className="ind-card__alert-bar-fill"
                      style={{ width: `${(completed / total) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 7: Collapsible Notes */}
      {allNotes.length > 0 && (
        <details className="ind-card__notes-details">
          <summary className="ind-card__notes-summary">
            <svg viewBox="0 0 24 24" width="13" height="13">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
            </svg>
            Notas ({allNotes.length})
            <svg viewBox="0 0 24 24" width="14" height="14" className="ind-card__notes-chevron">
              <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
            </svg>
          </summary>
          <div className="ind-card__notes-list">
            {allNotes.map((note, i) => (
              <div key={i} className="ind-card__note-item">
                <span className="ind-card__note-month">{note.month}</span>
                <span className="ind-card__note-text">{note.text}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Footer Link */}
      <Link to={`/ind/indicador/${indicador.id}`} className="ind-card__link">
        Ver detalhes
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
        </svg>
      </Link>
    </div>
  );
}

export default function PersonDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const [person, setPerson] = useState(null);
  const [indicadores, setIndicadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ciclo, setCiclo] = useState(getCurrentCycle());
  const [ano, setAno] = useState(getCurrentYear());

  useEffect(() => {
    fetchPerson();
  }, [id, ciclo, ano]);

  const fetchPerson = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/ind/people/${id}?ciclo=${ciclo}&ano=${ano}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Erro ao carregar pessoa');

      const data = await res.json();
      setPerson(data.data);
      setIndicadores(data.data?.indicadores || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar indicadores que têm meses ativos no ciclo selecionado
  const indicadoresNoCiclo = useMemo(
    () => indicadores.filter(ind => hasActiveMonthsInCycle(ind, ciclo)),
    [indicadores, ciclo]
  );

  // Calculate metrics
  const scoreGeral = calculatePersonScore(indicadoresNoCiclo) || 0;
  const indicadoresAtRisk = filterAtRiskIndicators(indicadoresNoCiclo);
  const indicadoresAtingidos = indicadoresNoCiclo.filter(i => getIndicatorScore(i) >= 100);

  const currentMonth = new Date().getMonth() + 1;

  const accumulatedMap = useMemo(() => {
    const map = {};
    for (const ind of indicadoresNoCiclo) {
      const yearCheckIns = (ind.check_ins || []).filter(ci => ci.ano === ano);
      const acc = calculateAccumulatedProgress(ind, yearCheckIns, currentMonth);
      const isAutoCalc = ind.auto_calculate !== false;
      const realizado = isAutoCalc ? acc.realizado : (ind.realizado_acumulado ?? 0);
      const planejado = isAutoCalc ? acc.planejado : (ind.planejado_acumulado ?? 0);
      const score = planejado > 0
        ? calculateIndicatorScore(realizado, planejado * 0.8, planejado, planejado * 1.2, ind.is_inverse)
        : 0;
      map[ind.id] = { realizado, planejado, score };
    }
    return map;
  }, [indicadoresNoCiclo, ano, currentMonth]);

  if (loading) {
    return (
      <div className="dashboard-ind dashboard-ind--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando indicadores...</p>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="dashboard-ind dashboard-ind--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="error-state__message">{error || 'Pessoa não encontrada'}</p>
          <button onClick={() => navigate(-1)} className="btn btn--primary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-ind">
      {/* Ambient background effects */}
      <div className="dashboard-ind__bg">
        <div className="dashboard-ind__gradient" />
        <div className="dashboard-ind__noise" />
      </div>

      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <button onClick={() => navigate(-1)} className="btn btn--outline" style={{ marginBottom: '0.75rem' }}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Voltar
          </button>
          <h1 className="dashboard-header__title">{person.name}</h1>
          <p className="dashboard-header__subtitle">
            {person.cargo?.name || 'Sem cargo'} • {person.setor?.name || 'Sem setor'}
          </p>
        </div>

        <div className="dashboard-header__filters">
          <div className="filter-chip">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
            <select
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value)}
              className="filter-chip__select"
            >
              {getCycleOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-chip">
            <select
              value={ano}
              onChange={(e) => setAno(parseInt(e.target.value, 10))}
              className="filter-chip__select"
            >
              {[getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="metrics-grid">
        <div className="metric-card metric-card--featured" style={{ animationDelay: '0ms' }}>
          <div className="metric-card__glow metric-card__glow--featured" />
          <div className="metric-card__content">
            <div className="metric-card__header">
              <span className="metric-card__title">Score Geral</span>
              <svg viewBox="0 0 24 24" width="20" height="20" className="metric-card__trend-icon">
                {scoreGeral >= 80 ? (
                  <path fill="currentColor" d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                ) : (
                  <path fill="currentColor" d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
                )}
              </svg>
            </div>
            <div className="metric-card--featured__body">
              <ScoreRing score={scoreGeral} size={80} strokeWidth={7} />
              <div className="metric-card--featured__info">
                <span className="metric-card--featured__percent">{scoreGeral.toFixed(0)}%</span>
                <span className="metric-card__subtitle">{indicadoresNoCiclo.length} indicadores</span>
              </div>
            </div>
          </div>
        </div>

        <MetricCard
          title="Cargo"
          value={person.cargo?.name || 'Não definido'}
          subtitle={person.setor?.name || '-'}
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
            </svg>
          }
          variant="default"
          delay={50}
        />

        <MetricCard
          title="Em Risco"
          value={indicadoresAtRisk.length}
          subtitle="abaixo da meta"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
          }
          variant={indicadoresAtRisk.length > 0 ? 'danger' : 'default'}
          delay={100}
        />

        <MetricCard
          title="Atingidos"
          value={indicadoresAtingidos.length}
          subtitle="na meta ou acima"
          icon={
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          }
          variant={indicadoresAtingidos.length > 0 ? 'success' : 'default'}
          delay={150}
        />
      </section>

      {/* Indicators Section */}
      <section className="indicators-section">
        <div className="indicators-section__header">
          <h2 className="indicators-section__title">Indicadores</h2>
        </div>

        {indicadoresNoCiclo.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <h3 className="empty-state__title">Nenhum indicador encontrado</h3>
            <p className="empty-state__description">
              Esta pessoa não tem indicadores para {getCycleLabel(ciclo)} de {ano}.
            </p>
          </div>
        ) : (
          <div className="indicators-grid">
            {indicadoresNoCiclo.map((ind, index) => (
              <IndicadorCard
                key={ind.id}
                indicador={ind}
                ciclo={ciclo}
                ano={ano}
                index={index}
                accumulatedData={accumulatedMap[ind.id]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

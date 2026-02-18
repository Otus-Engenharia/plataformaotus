import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculatePersonScore,
  calculateIndicatorScore,
  calculateAccumulatedProgress,
  filterAtRiskIndicators,
  getIndicatorScore,
  getScoreStatus,
  formatValue,
  getCycleOptions,
  getCurrentCycle,
  getCurrentYear,
  getCycleLabel,
  getCycleMonthRange,
  parseAcoes,
} from '../../utils/indicator-utils';
import ScoreZoneGauge, { ScoreRing } from '../../components/indicadores/ScoreZoneGauge';
import MiniSparkline from '../../components/indicadores/dashboard/MiniSparkline';
import CreateCheckInDialog from '../../components/indicadores/dialogs/CreateCheckInDialog';
import './DashboardIndicadores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Computes per-month data for an indicator's sparkline
 */
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
    months.push({
      month: m,
      monthName: MONTH_SHORT[m - 1],
      value,
      target,
      score,
      notas: checkIn?.notas || null,
    });
  }
  return months;
}

/**
 * Gets all check-in notes for an indicator, sorted newest first
 */
function getAllNotes(indicador) {
  return (indicador.check_ins || [])
    .filter(ci => ci.notas && ci.notas.trim())
    .sort((a, b) => b.mes - a.mes)
    .map(ci => ({ month: MONTH_SHORT[ci.mes - 1], monthNum: ci.mes, text: ci.notas }));
}

/**
 * Maps score to zone id for CSS classes
 */
function getScoreZoneId(score) {
  if (score === null || score === undefined) return 'none';
  if (score >= 120) return 'superou';
  if (score >= 100) return 'alvo';
  if (score >= 80) return 'risco';
  return 'zerado';
}

/**
 * Gets active recovery plans (pendente or em_andamento)
 */
function getActivePlans(indicador) {
  return (indicador.recovery_plans || [])
    .filter(p => p.status === 'pendente' || p.status === 'em_andamento');
}


// ────────────────────────────────────────────────────────────
// Enriched Indicator Card — tells the full story per indicator
// ────────────────────────────────────────────────────────────
function IndicadorCard({ indicador, ciclo, ano, index, accumulatedData }) {
  const acc = accumulatedData || { realizado: 0, planejado: 0, score: 0 };
  const score = acc.score;
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

  return (
    <div
      className={`ind-card ind-card--${status}`}
      style={{ animationDelay: `${80 + index * 60}ms` }}
    >
      {/* Card Header with ScoreRing */}
      <div className="ind-card__header">
        <ScoreRing score={score} size={44} />
        <div className="ind-card__title-group">
          <h3 className="ind-card__title">{indicador.nome}</h3>
          {indicador.descricao && (
            <p className="ind-card__description">{indicador.descricao}</p>
          )}
        </div>
      </div>

      {/* Zone Gauge Bar — shows where the indicator falls on the scale */}
      <div className="ind-card__zone-bar">
        <ScoreZoneGauge score={score} size="sm" showLabels={false} showScore={false} />
      </div>

      {/* Stats Row */}
      <div className="ind-card__stats">
        <div className="ind-card__stat">
          <span className="ind-card__stat-label">Realizado</span>
          <span className="ind-card__stat-value">{realizadoFormatado}</span>
        </div>
        <div className="ind-card__stat">
          <span className="ind-card__stat-label">Planejado</span>
          <span className="ind-card__stat-value">{planejadoFormatado}</span>
        </div>
        <div className="ind-card__stat ind-card__stat--weight">
          <span className="ind-card__stat-label">Peso</span>
          <span className="ind-card__stat-value">{indicador.peso || 1}</span>
        </div>
      </div>

      {/* Mini Sparkline — monthly evolution */}
      <div className="ind-card__sparkline">
        <MiniSparkline months={monthlyData} height={52} />
      </div>

      {/* All Monthly Notes — month-by-month narrative for the leader */}
      {allNotes.length > 0 && (
        <div className="ind-card__notes">
          <div className="ind-card__notes-header">
            <svg viewBox="0 0 24 24" width="14" height="14" className="ind-card__notes-icon">
              <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
            </svg>
            <span className="ind-card__notes-title">Notas ({allNotes.length})</span>
          </div>
          <div className="ind-card__notes-list">
            {allNotes.map((note, i) => (
              <div key={i} className="ind-card__note-item">
                <span className="ind-card__note-month">{note.month}:</span>
                <span className="ind-card__note-text">{note.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Recovery Plans — the star feature */}
      {activePlans.length > 0 && (
        <div className="ind-card__plans">
          {activePlans.map(plan => {
            const actions = parseAcoes(plan.acoes);
            const completed = actions.filter(a => a.concluida).length;
            const total = actions.length;
            const statusConfig = {
              pendente: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'Pendente' },
              em_andamento: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', label: 'Em andamento' },
            };
            const config = statusConfig[plan.status] || statusConfig.pendente;

            return (
              <div key={plan.id} className="ind-card__plan" style={{ '--plan-color': config.color, '--plan-bg': config.bg }}>
                <div className="ind-card__plan-header">
                  <span className="ind-card__plan-dot" />
                  <span className="ind-card__plan-status">{config.label}</span>
                  {total > 0 && (
                    <span className="ind-card__plan-count">{completed}/{total}</span>
                  )}
                </div>
                {plan.descricao && (
                  <p className="ind-card__plan-desc">{plan.descricao}</p>
                )}
                {total > 0 && (
                  <>
                    <div className="ind-card__plan-progress-track">
                      <div className="ind-card__plan-progress-fill" style={{ width: `${(completed / total) * 100}%` }} />
                    </div>
                    <ul className="ind-card__plan-actions">
                      {actions.map((action, ai) => (
                        <li key={ai} className={`ind-card__plan-action ${action.concluida ? 'ind-card__plan-action--done' : ''}`}>
                          <span className="ind-card__plan-action-check">
                            {action.concluida ? (
                              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                            )}
                          </span>
                          <span className="ind-card__plan-action-text">{action.descricao}</span>
                          {action.responsavel && (
                            <span className="ind-card__plan-action-resp">{action.responsavel}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Card Footer Link */}
      <Link to={`/ind/indicador/${indicador.id}`} className="ind-card__link">
        Ver detalhes
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
        </svg>
      </Link>
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// Attention Section — consolidated recovery plans
// ────────────────────────────────────────────────────────────
function AttentionSection({ indicadores }) {
  const allActivePlans = indicadores.flatMap(ind => {
    const plans = getActivePlans(ind);
    return plans.map(p => ({ ...p, indicadorNome: ind.nome, indicadorId: ind.id }));
  });

  if (allActivePlans.length === 0) return null;

  return (
    <section className="attention-section">
      <div className="attention-section__header">
        <div className="attention-section__title-group">
          <svg viewBox="0 0 24 24" width="20" height="20" className="attention-section__icon">
            <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <h2 className="attention-section__title">Atencao Necessaria</h2>
        </div>
        <span className="attention-section__count">{allActivePlans.length} plano{allActivePlans.length > 1 ? 's' : ''}</span>
      </div>

      <div className="attention-section__list">
        {allActivePlans.map(plan => {
          const actions = parseAcoes(plan.acoes);
          const completed = actions.filter(a => a.concluida).length;
          const total = actions.length;
          const statusConfig = {
            pendente: { color: '#f59e0b', label: 'Pendente' },
            em_andamento: { color: '#3b82f6', label: 'Em andamento' },
          };
          const config = statusConfig[plan.status] || statusConfig.pendente;

          return (
            <Link
              key={plan.id}
              to={`/ind/indicador/${plan.indicadorId}`}
              className="attention-item"
            >
              <div className="attention-item__indicator">
                <span className="attention-item__dot" style={{ background: config.color }} />
                <span className="attention-item__ind-name">{plan.indicadorNome}</span>
              </div>
              <div className="attention-item__detail">
                <span className="attention-item__status" style={{ color: config.color }}>
                  {config.label}
                </span>
                <span className="attention-item__desc">
                  {plan.descricao?.slice(0, 80)}{plan.descricao?.length > 80 ? '...' : ''}
                </span>
              </div>
              {total > 0 && (
                <div className="attention-item__progress">
                  <div className="attention-item__progress-bar">
                    <div
                      className="attention-item__progress-fill"
                      style={{ width: `${(completed / total) * 100}%`, background: config.color }}
                    />
                  </div>
                  <span className="attention-item__progress-text">{completed}/{total}</span>
                </div>
              )}
              <svg viewBox="0 0 24 24" width="16" height="16" className="attention-item__arrow">
                <path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
              </svg>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


// ════════════════════════════════════════════════════════════
// Main Dashboard Component
// ════════════════════════════════════════════════════════════
export default function DashboardIndicadores() {
  const { user } = useAuth();
  const [indicadores, setIndicadores] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ciclo, setCiclo] = useState(getCurrentCycle());
  const [ano, setAno] = useState(getCurrentYear());
  const [selectedIndicador, setSelectedIndicador] = useState(null);
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [ciclo, ano]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [indRes, templatesRes] = await Promise.all([
        fetch(`${API_URL}/api/ind/indicators/my?ciclo=${ciclo}&ano=${ano}`, { credentials: 'include' }),
        fetch(`${API_URL}/api/ind/my-templates`, { credentials: 'include' })
      ]);

      if (!indRes.ok) throw new Error('Erro ao carregar indicadores');

      const indData = await indRes.json();
      setIndicadores(indData.data || []);

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSubmit = async (checkInData) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/indicators/${selectedIndicador.id}/check-ins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(checkInData)
      });

      if (!res.ok) throw new Error('Erro ao registrar check-in');

      setShowCheckInDialog(false);
      setSelectedIndicador(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddIndicator = async (templateId) => {
    try {
      const res = await fetch(`${API_URL}/api/ind/indicators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ template_id: templateId, ciclo, ano })
      });

      if (!res.ok) throw new Error('Erro ao adicionar indicador');

      setShowAddDialog(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // ── Computed values ──
  const scoreGeral = calculatePersonScore(indicadores) || 0;
  const currentMonth = new Date().getMonth() + 1;

  const accumulatedMap = useMemo(() => {
    const map = {};
    for (const ind of indicadores) {
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
  }, [indicadores, ano, currentMonth]);

  const usedTemplateIds = new Set(indicadores.map(i => i.template_id).filter(Boolean));
  const availableTemplates = templates.filter(t => !usedTemplateIds.has(t.id));

  // ── Loading state ──
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

  // ── Error state ──
  if (error) {
    return (
      <div className="dashboard-ind dashboard-ind--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="error-state__message">Erro: {error}</p>
          <button onClick={fetchData} className="btn btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-ind">
      {/* Ambient background */}
      <div className="dashboard-ind__bg">
        <div className="dashboard-ind__gradient" />
      </div>

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <h1 className="dashboard-header__title">Meus Indicadores</h1>
          <p className="dashboard-header__subtitle">
            Acompanhe seu desempenho em {getCycleLabel(ciclo)} de {ano}
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

      {/* ── Farol — Nota Final ── */}
      <section className="farol-section farol-section--compact">
        <div className="farol-card farol-card--dark">
          <div className="farol-card__glow" />
          <div className="farol-card__content farol-card__content--horizontal">
            <div className="farol-card__score-area">
              <span className="farol-card__label-text">FAROL</span>
              <span className="farol-card__big-score">
                {scoreGeral !== null ? Math.round(scoreGeral) : '--'}
              </span>
            </div>
            <div className="farol-card__summary-badges">
              <span className="farol-badge farol-badge--subtitle">
                Resultado ponderado de {indicadores.length} indicador{indicadores.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Indicators Section ── */}
      <section className="indicators-section">
        <div className="indicators-section__header">
          <h2 className="indicators-section__title">
            Indicadores
            <span className="indicators-section__count">{indicadores.length}</span>
          </h2>
          {availableTemplates.length > 0 && (
            <button className="btn btn--outline" onClick={() => setShowAddDialog(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Adicionar
            </button>
          )}
        </div>

        {indicadores.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
            </div>
            <h3 className="empty-state__title">Nenhum indicador encontrado</h3>
            <p className="empty-state__description">
              Voce ainda nao tem indicadores para este ciclo.
            </p>
            {availableTemplates.length > 0 && (
              <button className="btn btn--primary" onClick={() => setShowAddDialog(true)}>
                Adicionar indicador do meu cargo
              </button>
            )}
          </div>
        ) : (
          <div className="indicators-grid">
            {indicadores.map((ind, index) => (
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

      {/* ── Dialogs ── */}
      {showCheckInDialog && selectedIndicador && (
        <CreateCheckInDialog
          indicador={selectedIndicador}
          ano={ano}
          onSubmit={handleCheckInSubmit}
          onClose={() => {
            setShowCheckInDialog(false);
            setSelectedIndicador(null);
          }}
        />
      )}

      {showAddDialog && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">Adicionar Indicador</h2>
              <button className="modal__close" onClick={() => setShowAddDialog(false)}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <p className="modal__description">
                Selecione um indicador do seu cargo para adicionar ao ciclo {getCycleLabel(ciclo)} de {ano}:
              </p>
              <div className="template-list">
                {availableTemplates.map(template => (
                  <div key={template.id} className="template-item">
                    <div className="template-item__info">
                      <h4 className="template-item__title">{template.title}</h4>
                      {template.description && (
                        <p className="template-item__description">{template.description}</p>
                      )}
                      <div className="template-item__meta">
                        <span>Meta: {template.default_target}</span>
                        <span>Peso: {template.default_weight}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => handleAddIndicator(template.id)}
                    >
                      Adicionar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

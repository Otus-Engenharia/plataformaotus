import React, { useState, useMemo, useEffect } from 'react';
import { distributeAccumulatedTarget } from '../../../utils/indicator-utils';
import './Dialogs.css';

const METRIC_TYPES = [
  { value: 'number', label: 'Número' },
  { value: 'integer', label: 'Número Inteiro' },
  { value: 'percentage', label: 'Percentual' },
  { value: 'currency', label: 'Moeda (R$)' },
  { value: 'boolean', label: 'Sim/Não' }
];

const CONSOLIDATION_TYPES = [
  { value: 'sum', label: 'Soma' },
  { value: 'average', label: 'Média' },
  { value: 'last_value', label: 'Último Valor' },
  { value: 'manual', label: 'Manual' }
];

const QUARTER_GROUPS = [
  { key: 'q1', label: 'Q1', months: [1, 2, 3] },
  { key: 'q2', label: 'Q2', months: [4, 5, 6] },
  { key: 'q3', label: 'Q3', months: [7, 8, 9] },
  { key: 'q4', label: 'Q4', months: [10, 11, 12] },
];

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function isMonthActive(month, activeQuarters, mesInicio = 1) {
  if (month < mesInicio) return false;
  if (month <= 3) return !!activeQuarters.q1;
  if (month <= 6) return !!activeQuarters.q2;
  if (month <= 9) return !!activeQuarters.q3;
  return !!activeQuarters.q4;
}

export default function UnifiedEditIndicatorDialog({
  indicador,
  onSubmit,
  onClose,
  isTemplate = false
}) {
  const isEditing = !!indicador;

  const getField = (templateField, individualField) =>
    isTemplate ? (indicador?.[templateField] ?? '') : (indicador?.[individualField] ?? '');

  const [formData, setFormData] = useState({
    title: getField('title', 'nome') || '',
    description: getField('description', 'descricao') || '',
    metric_type: indicador?.metric_type || 'number',
    consolidation_type: indicador?.consolidation_type || 'last_value',
    initial_value: isTemplate
      ? (indicador?.default_initial ?? 0)
      : (indicador?.initial_value ?? 0),
    target: isTemplate
      ? (indicador?.default_target ?? 100)
      : (indicador?.meta ?? 100),
    threshold_80: isTemplate
      ? (indicador?.default_threshold_80 ?? 80)
      : (indicador?.threshold_80 ?? 80),
    threshold_120: isTemplate
      ? (indicador?.default_threshold_120 ?? 120)
      : (indicador?.threshold_120 ?? 120),
    weight: isTemplate
      ? (indicador?.default_weight ?? 1)
      : (indicador?.peso ?? 1),
    is_inverse: indicador?.is_inverse || false,
    auto_calculate: indicador?.auto_calculate !== false,
    mes_inicio: indicador?.mes_inicio || 1
  });

  const [showMetasPanel, setShowMetasPanel] = useState(false);
  const [activeQuarters, setActiveQuarters] = useState(() => {
    const existing = indicador?.active_quarters;
    if (existing && typeof existing === 'object') return { ...existing };
    return { q1: true, q2: true, q3: true, q4: true };
  });
  const [monthlyTargets, setMonthlyTargets] = useState(() => {
    const existing = indicador?.monthly_targets || {};
    const initial = {};
    for (let i = 1; i <= 12; i++) {
      initial[i] = existing[i] ?? existing[String(i)] ?? '';
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);

  // Auto-distribuir metas quando Acúmulo Automático está ligado
  useEffect(() => {
    if (!formData.auto_calculate) return;
    if (formData.consolidation_type === 'manual') return;

    const target = parseFloat(formData.target);
    if (isNaN(target)) return;

    const mInicio = parseInt(formData.mes_inicio) || 1;
    const distributed = distributeAccumulatedTarget(
      target, formData.consolidation_type, activeQuarters, mInicio, formData.metric_type
    );
    setMonthlyTargets(prev => {
      const updated = { ...prev };
      Object.entries(distributed).forEach(([month, value]) => {
        updated[month] = value;
      });
      return updated;
    });
  }, [formData.auto_calculate, formData.target, formData.consolidation_type, formData.mes_inicio, formData.metric_type, activeQuarters]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'consolidation_type' && (value === 'last_value' || value === 'manual')) {
        next.auto_calculate = false;
      }
      return next;
    });
  };

  const handleTargetChange = (month, value) => {
    setMonthlyTargets(prev => ({
      ...prev,
      [month]: value === '' ? '' : value
    }));
  };

  const handleQuarterToggle = (quarterKey) => {
    setActiveQuarters(prev => {
      const next = { ...prev, [quarterKey]: !prev[quarterKey] };
      // Zero out months of deactivated quarter
      if (!next[quarterKey]) {
        const group = QUARTER_GROUPS.find(g => g.key === quarterKey);
        if (group) {
          setMonthlyTargets(prevTargets => {
            const updated = { ...prevTargets };
            group.months.forEach(m => { updated[m] = 0; });
            return updated;
          });
        }
      }
      return next;
    });
  };

  const handleDistribute = () => {
    if (formData.consolidation_type === 'manual') {
      alert('Método Manual não suporta distribuição automática. Preencha cada mês manualmente.');
      return;
    }

    const accumulated = parseFloat(formData.target);
    if (!accumulated && accumulated !== 0) {
      alert('Defina a Meta 100% Anual antes de distribuir.');
      return;
    }

    const distributed = distributeAccumulatedTarget(accumulated, formData.consolidation_type, activeQuarters, mesInicio, formData.metric_type);
    setMonthlyTargets(prev => {
      const updated = { ...prev };
      Object.entries(distributed).forEach(([month, value]) => {
        updated[month] = value;
      });
      return updated;
    });
  };

  const applyFirstToAll = () => {
    // Encontrar o primeiro mês ativo
    let firstActiveMonth = null;
    for (let i = 1; i <= 12; i++) {
      if (isMonthActive(i, activeQuarters, mesInicio)) {
        firstActiveMonth = i;
        break;
      }
    }
    if (!firstActiveMonth) return;
    const firstValue = monthlyTargets[firstActiveMonth];
    if (firstValue !== '' && firstValue !== null && firstValue !== undefined) {
      const newTargets = { ...monthlyTargets };
      for (let i = 1; i <= 12; i++) {
        if (isMonthActive(i, activeQuarters, mesInicio)) {
          newTargets[i] = firstValue;
        }
      }
      setMonthlyTargets(newTargets);
    }
  };

  // Ratios for rule-of-three calculation
  const ratio80 = useMemo(() => {
    const t = parseFloat(formData.target);
    const t80 = parseFloat(formData.threshold_80);
    if (!t || t === 0) return 0;
    return t80 / t;
  }, [formData.target, formData.threshold_80]);

  const ratio120 = useMemo(() => {
    const t = parseFloat(formData.target);
    const t120 = parseFloat(formData.threshold_120);
    if (!t || t === 0) return 0;
    return t120 / t;
  }, [formData.target, formData.threshold_120]);

  // Auto-detect indicador inverso pela relação entre thresholds
  const isInverse = useMemo(() => {
    const t80 = parseFloat(formData.threshold_80);
    const t120 = parseFloat(formData.threshold_120);
    if (isNaN(t80) || isNaN(t120) || t80 === t120) return formData.is_inverse;
    return t80 > t120; // Mínima > Superação = inverso
  }, [formData.threshold_80, formData.threshold_120, formData.is_inverse]);

  const mesInicio = parseInt(formData.mes_inicio) || 1;

  // Arredondamento: Math.floor para inteiro, 2 casas decimais para o resto
  const roundByMetric = (val) =>
    formData.metric_type === 'integer' ? Math.floor(val) : Math.round(val * 100) / 100;

  // Accumulated values computed from monthly targets + consolidation type
  const accumulatedValues = useMemo(() => {
    const result = {};
    const consolidation = formData.consolidation_type;
    let runningSum = 0;
    let activeCount = 0;

    for (let m = 1; m <= 12; m++) {
      const val = parseFloat(monthlyTargets[m]) || 0;
      const active = isMonthActive(m, activeQuarters, mesInicio);

      if (!active) {
        result[m] = { value: null, meta80: null, meta120: null };
        continue;
      }

      if (consolidation === 'sum') {
        runningSum += val;
        result[m] = {
          value: roundByMetric(runningSum),
          meta80: roundByMetric(runningSum * ratio80),
          meta120: roundByMetric(runningSum * ratio120),
        };
      } else if (consolidation === 'average') {
        runningSum += val;
        activeCount++;
        const avg = activeCount > 0 ? runningSum / activeCount : 0;
        result[m] = {
          value: roundByMetric(avg),
          meta80: roundByMetric(avg * ratio80),
          meta120: roundByMetric(avg * ratio120),
        };
      } else {
        // last_value or manual: accumulated = current month's value
        result[m] = {
          value: roundByMetric(val),
          meta80: roundByMetric(val * ratio80),
          meta120: roundByMetric(val * ratio120),
        };
      }
    }
    return result;
  }, [monthlyTargets, activeQuarters, formData.consolidation_type, formData.metric_type, ratio80, ratio120, mesInicio]);

  // Validação: acumulado do último mês ativo deve bater com meta anual
  const accMismatch = useMemo(() => {
    const target = parseFloat(formData.target);
    if (!target) return null;
    let lastActiveMonth = null;
    for (let m = 12; m >= 1; m--) {
      if (isMonthActive(m, activeQuarters, mesInicio) && accumulatedValues[m]?.value !== null) {
        lastActiveMonth = m;
        break;
      }
    }
    if (!lastActiveMonth) return null;
    const accValue = accumulatedValues[lastActiveMonth].value;
    if (accValue === 0 && Object.values(monthlyTargets).every(v => v === '' || v === 0)) return null;
    const diff = Math.abs(accValue - target);
    if (diff < 0.01) return null;
    return { lastMonth: lastActiveMonth, accValue, target, diff };
  }, [accumulatedValues, formData.target, activeQuarters, mesInicio, monthlyTargets]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Título é obrigatório');
      return;
    }

    if (!formData.target && formData.target !== 0) {
      alert('Meta é obrigatória');
      return;
    }

    const cleanTargets = {};
    Object.entries(monthlyTargets).forEach(([month, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        cleanTargets[parseInt(month)] = parseFloat(value);
      }
    });

    setLoading(true);
    try {
      if (isTemplate) {
        await onSubmit({
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          metric_type: formData.metric_type,
          consolidation_type: formData.consolidation_type,
          default_initial: parseFloat(formData.initial_value) || 0,
          default_target: parseFloat(formData.target),
          default_threshold_80: formData.threshold_80 ? parseFloat(formData.threshold_80) : null,
          default_threshold_120: formData.threshold_120 ? parseFloat(formData.threshold_120) : null,
          default_weight: formData.weight !== '' ? parseInt(formData.weight, 10) : 1,
          is_inverse: isInverse,
          auto_calculate: formData.auto_calculate,
          monthly_targets: cleanTargets,
          active_quarters: activeQuarters,
          mes_inicio: parseInt(formData.mes_inicio) || 1,
        });
      } else {
        await onSubmit({
          nome: formData.title.trim(),
          descricao: formData.description?.trim() || null,
          metric_type: formData.metric_type,
          consolidation_type: formData.consolidation_type,
          meta: parseFloat(formData.target),
          threshold_80: formData.threshold_80 ? parseFloat(formData.threshold_80) : null,
          threshold_120: formData.threshold_120 ? parseFloat(formData.threshold_120) : null,
          peso: formData.weight !== '' ? parseInt(formData.weight, 10) : 1,
          is_inverse: isInverse,
          auto_calculate: formData.auto_calculate,
          monthly_targets: cleanTargets,
          active_quarters: activeQuarters,
          mes_inicio: parseInt(formData.mes_inicio) || 1,
        });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const unit = formData.metric_type === 'percentage' ? '%' : '';

  return (
    <div className="dialog-overlay">
      <div
        className={`dialog-content dialog-expandable glass-card ${showMetasPanel ? 'expanded' : ''}`}
      >
        <div className="dialog-header">
          <div>
            <h2>
              {isEditing ? 'Editar Indicador' : 'Novo Indicador Padrão'}
              {showMetasPanel && (
                <span className="periodicity-badge">ANUAL</span>
              )}
            </h2>
            <p className="dialog-subtitle">
              {isEditing
                ? 'Altere as configurações do indicador'
                : 'Este indicador será atribuído automaticamente a pessoas com este cargo'}
            </p>
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <div className="dialog-expandable-layout">
            {/* ---- SEÇÃO PRINCIPAL ---- */}
            <div className="dialog-main-section">
              {/* Título */}
              <div className="form-group">
                <label htmlFor="u-title">Título *</label>
                <input
                  id="u-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Nome do indicador"
                  required
                  autoFocus
                />
              </div>

              {/* Descrição */}
              <div className="form-group">
                <label htmlFor="u-desc">Descrição</label>
                <textarea
                  id="u-desc"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Como este indicador é calculado..."
                  rows={1}
                />
              </div>

              {/* Tipo de Métrica + Método de Acúmulo */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="u-metric">Tipo de Métrica</label>
                  <select
                    id="u-metric"
                    value={formData.metric_type}
                    onChange={(e) => handleChange('metric_type', e.target.value)}
                  >
                    {METRIC_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="u-consolidation">Método de Acúmulo</label>
                  <select
                    id="u-consolidation"
                    value={formData.consolidation_type}
                    onChange={(e) => handleChange('consolidation_type', e.target.value)}
                  >
                    {CONSOLIDATION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Divider */}
              <hr className="form-divider" />

              {/* Metas Anuais */}
              <div className="form-row form-row--triple">
                <div className="form-group">
                  <label htmlFor="u-t80">Meta Mínima Anual</label>
                  <input
                    id="u-t80"
                    type="number"
                    step="any"
                    value={formData.threshold_80}
                    onChange={(e) => handleChange('threshold_80', e.target.value)}
                    placeholder="80"
                  />
                  <span className="form-hint" data-level="min">80%</span>
                </div>

                <div className="form-group">
                  <label htmlFor="u-target">Meta 100% Anual</label>
                  <input
                    id="u-target"
                    type="number"
                    step="any"
                    value={formData.target}
                    onChange={(e) => handleChange('target', e.target.value)}
                    placeholder="100"
                    required
                  />
                  <span className="form-hint" data-level="target">100% — principal</span>
                </div>

                <div className="form-group">
                  <label htmlFor="u-t120">Meta Superação Anual</label>
                  <input
                    id="u-t120"
                    type="number"
                    step="any"
                    value={formData.threshold_120}
                    onChange={(e) => handleChange('threshold_120', e.target.value)}
                    placeholder="120"
                  />
                  <span className="form-hint" data-level="super">120%</span>
                </div>
              </div>

              {/* Mismatch warning - só no modo manual */}
              {!formData.auto_calculate && accMismatch && showMetasPanel && (
                <div className="acc-mismatch-warning">
                  <span>Acumulado {MONTH_NAMES_SHORT[accMismatch.lastMonth - 1]} = {accMismatch.accValue}, Meta Anual = {accMismatch.target}</span>
                  <button type="button" className="btn-fix-distribution" onClick={handleDistribute}>
                    Corrigir
                  </button>
                </div>
              )}

              {/* Divider */}
              <hr className="form-divider" />

              {/* Valor Inicial + Mês de Início + Peso */}
              <div className="form-row form-row--triple">
                <div className="form-group">
                  <label htmlFor="u-initial">Valor Inicial</label>
                  <input
                    id="u-initial"
                    type="number"
                    step="any"
                    value={formData.initial_value}
                    onChange={(e) => handleChange('initial_value', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="u-mes-inicio">Mês de Início</label>
                  <select
                    id="u-mes-inicio"
                    value={formData.mes_inicio}
                    onChange={(e) => handleChange('mes_inicio', e.target.value)}
                  >
                    {MONTH_NAMES_SHORT.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="u-peso">Peso</label>
                  <input
                    id="u-peso"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              <label className={`inverse-toggle readonly ${isInverse ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={isInverse}
                  disabled
                />
                <div className="inverse-toggle-indicator">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d={isInverse
                      ? 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z'
                      : 'M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z'
                    } />
                  </svg>
                </div>
                <div className="inverse-toggle-text">
                  <strong>{isInverse ? 'Indicador Inverso' : 'Indicador Normal'}</strong>
                  <span>{isInverse
                    ? 'Quanto menor o valor, melhor o resultado (ex: turnover, bugs, acidentes)'
                    : 'Quanto maior o valor, melhor o resultado (ex: receita, NPS, entregas)'
                  }</span>
                </div>
              </label>

              <label className={`inverse-toggle ${!formData.auto_calculate ? 'active active--blue' : ''}`}>
                <input
                  type="checkbox"
                  checked={!formData.auto_calculate}
                  onChange={(e) => handleChange('auto_calculate', !e.target.checked)}
                />
                <div className="inverse-toggle-indicator">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d={!formData.auto_calculate
                      ? 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'
                      : 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z'
                    } />
                  </svg>
                </div>
                <div className="inverse-toggle-text">
                  <strong>{formData.auto_calculate ? 'Acúmulo Automático' : 'Acúmulo Manual'}</strong>
                  <span>{formData.auto_calculate
                    ? 'O acumulado é calculado automaticamente a partir dos check-ins mensais'
                    : 'O valor acumulado é preenchido manualmente na vista do indicador'
                  }</span>
                </div>
              </label>

              {/* Toggle Metas Mensais */}
              <button
                type="button"
                className={`metas-toggle-btn ${showMetasPanel ? 'open' : ''}`}
                onClick={() => setShowMetasPanel(!showMetasPanel)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
                </svg>
                {showMetasPanel ? 'Fechar Metas Mensais' : 'Configurar Metas Mensais'}
                <svg viewBox="0 0 24 24" width="14" height="14" className="metas-toggle-chevron">
                  <path fill="currentColor" d={showMetasPanel ? 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z' : 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z'} />
                </svg>
              </button>

              {/* Actions */}
              <div className="dialog-actions">
                <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* ---- PAINEL LATERAL: Metas Mensais ---- */}
            {showMetasPanel && (
              <div className="dialog-side-panel visible">
                <h3 className="side-panel-title">Metas Mensais</h3>
                <p className="side-panel-subtitle">
                  Defina a meta esperada para cada mês. As metas serão copiadas ao atribuir o indicador.
                </p>

                {/* Header com 80% / 100% / 120% */}
                <div className="accumulated-header-row">
                  <span className="acc-header acc-header--80">80%</span>
                  <span className="acc-header acc-header--100">100%</span>
                  <span className="acc-header acc-header--120">120%</span>
                </div>

                {/* Grade Mensal no formato tabela (igual ao Acumulado) */}
                <div className="monthly-groups">
                  {QUARTER_GROUPS.map(group => {
                    const quarterActive = activeQuarters[group.key];
                    return (
                      <div key={group.label} className={`period-group period-group--with-toggle ${!quarterActive ? 'period-group--disabled' : ''}`}>
                        <label className="quarter-side-toggle">
                          <input
                            type="checkbox"
                            checked={!!quarterActive}
                            onChange={() => handleQuarterToggle(group.key)}
                          />
                          <span className="quarter-inline-slider" />
                        </label>
                        <div className="period-group-content">
                          <div className="period-group-header">
                            <span className="period-group-label">{group.label}</span>
                          </div>
                          <div className="accumulated-months">
                            {group.months.map(m => {
                              const monthActive = isMonthActive(m, activeQuarters, mesInicio);
                              const val = parseFloat(monthlyTargets[m]) || 0;
                              const m80 = val ? roundByMetric(val * ratio80) : 0;
                              const m120 = val ? roundByMetric(val * ratio120) : 0;
                              if (!monthActive) {
                                return (
                                  <div key={m} className="accumulated-month-row accumulated-month-row--disabled">
                                    <span className="acc-month-label">{MONTH_NAMES_SHORT[m - 1]}</span>
                                    <span className="acc-value acc-value--disabled">—</span>
                                    <span className="acc-value acc-value--disabled">—</span>
                                    <span className="acc-value acc-value--disabled">—</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={m} className="accumulated-month-row">
                                  <span className="acc-month-label">{MONTH_NAMES_SHORT[m - 1]}</span>
                                  <span className="acc-value acc-value--80">{val > 0 ? m80 : '—'}</span>
                                  <div className="acc-input-cell">
                                    <input
                                      type="number"
                                      step="any"
                                      value={monthlyTargets[m] ?? ''}
                                      onChange={(e) => handleTargetChange(m, e.target.value)}
                                      placeholder="0"
                                      readOnly={formData.auto_calculate}
                                      className={`acc-input ${formData.auto_calculate ? 'acc-input--readonly' : ''}`}
                                    />
                                  </div>
                                  <span className="acc-value acc-value--120">{val > 0 ? m120 : '—'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- PAINEL ACUMULADO ---- */}
            {showMetasPanel && (
              <div className="dialog-accumulated-panel visible">
                <h3 className="side-panel-title">Acumulado</h3>
                <p className="side-panel-subtitle">
                  Valores acumulados mês a mês ({CONSOLIDATION_TYPES.find(c => c.value === formData.consolidation_type)?.label || 'Soma'})
                </p>

                <div className="accumulated-header-row">
                  <span className="acc-header acc-header--80">80%</span>
                  <span className="acc-header acc-header--100">100%</span>
                  <span className="acc-header acc-header--120">120%</span>
                </div>

                <div className="monthly-groups">
                  {QUARTER_GROUPS.map(group => {
                    const quarterActive = activeQuarters[group.key];
                    return (
                      <div key={group.label} className={`period-group ${!quarterActive ? 'period-group--disabled' : ''}`}>
                        <div className="period-group-header">
                          <span className="period-group-label">{group.label}</span>
                        </div>
                        <div className="accumulated-months">
                          {group.months.map(m => {
                            const monthActive = isMonthActive(m, activeQuarters, mesInicio);
                            const acc = accumulatedValues[m];
                            if (!monthActive || !acc || acc.value === null) {
                              return (
                                <div key={m} className="accumulated-month-row accumulated-month-row--disabled">
                                  <span className="acc-month-label">{MONTH_NAMES_SHORT[m - 1]}</span>
                                  <span className="acc-value acc-value--disabled">—</span>
                                  <span className="acc-value acc-value--disabled">—</span>
                                  <span className="acc-value acc-value--disabled">—</span>
                                </div>
                              );
                            }
                            const isLastMonth = accMismatch && m === accMismatch.lastMonth;
                            return (
                              <div key={m} className={`accumulated-month-row ${isLastMonth ? 'accumulated-month-row--warning' : ''}`}>
                                <span className="acc-month-label">{MONTH_NAMES_SHORT[m - 1]}</span>
                                <span className="acc-value acc-value--80">{acc.meta80}</span>
                                <span className="acc-value acc-value--100">{acc.value}</span>
                                <span className="acc-value acc-value--120">{acc.meta120}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

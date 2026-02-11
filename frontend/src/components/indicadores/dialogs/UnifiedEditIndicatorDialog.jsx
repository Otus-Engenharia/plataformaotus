import React, { useState } from 'react';
import { distributeAccumulatedTarget } from '../../../utils/indicator-utils';
import './Dialogs.css';

const METRIC_TYPES = [
  { value: 'number', label: 'Número' },
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

const PERIODICITY_OPTIONS = [
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' }
];

// Sempre Q1-Q4 na grade de meses
const QUARTER_GROUPS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
];

const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
    auto_calculate: indicador?.auto_calculate !== false
  });

  const [showMetasPanel, setShowMetasPanel] = useState(false);
  const [periodicity, setPeriodicity] = useState('trimestral');
  const [monthlyTargets, setMonthlyTargets] = useState(() => {
    const existing = indicador?.monthly_targets || {};
    const initial = {};
    for (let i = 1; i <= 12; i++) {
      initial[i] = existing[i] ?? existing[String(i)] ?? '';
    }
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTargetChange = (month, value) => {
    setMonthlyTargets(prev => ({
      ...prev,
      [month]: value === '' ? '' : value
    }));
  };

  const handleDistribute = () => {
    if (formData.consolidation_type === 'manual') {
      alert('Método Manual não suporta distribuição automática. Preencha cada mês manualmente.');
      return;
    }

    const accumulated = parseFloat(formData.target);
    if (!accumulated && accumulated !== 0) {
      alert('Defina a Meta 100% Acumulada antes de distribuir.');
      return;
    }

    const distributed = distributeAccumulatedTarget(accumulated, formData.consolidation_type, periodicity);
    setMonthlyTargets(prev => {
      const updated = { ...prev };
      Object.entries(distributed).forEach(([month, value]) => {
        updated[month] = value;
      });
      return updated;
    });
  };

  const applyFirstToAll = () => {
    const firstValue = monthlyTargets[1];
    if (firstValue !== '' && firstValue !== null && firstValue !== undefined) {
      const newTargets = { ...monthlyTargets };
      for (let i = 1; i <= 12; i++) {
        newTargets[i] = firstValue;
      }
      setMonthlyTargets(newTargets);
    }
  };

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
          default_weight: formData.weight ? parseInt(formData.weight, 10) : 1,
          is_inverse: formData.is_inverse,
          auto_calculate: formData.auto_calculate,
          monthly_targets: cleanTargets
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
          peso: formData.weight ? parseInt(formData.weight, 10) : 1,
          is_inverse: formData.is_inverse,
          auto_calculate: formData.auto_calculate,
          monthly_targets: cleanTargets
        });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const unit = formData.metric_type === 'percentage' ? '%' : '';
  const periodicityLabel = PERIODICITY_OPTIONS.find(p => p.value === periodicity)?.label || '';

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className={`dialog-content dialog-expandable glass-card ${showMetasPanel ? 'expanded' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div>
            <h2>
              {isEditing ? 'Editar Indicador' : 'Novo Indicador Padrão'}
              {showMetasPanel && (
                <span className="periodicity-badge">{periodicityLabel}</span>
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

              {/* Periodicidade */}
              <div className="periodicity-selector">
                <label className="periodicity-label">Periodicidade da Meta</label>
                <div className="periodicity-buttons">
                  {PERIODICITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`periodicity-btn ${periodicity === opt.value ? 'active' : ''}`}
                      onClick={() => setPeriodicity(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="form-hint">
                  {periodicity === 'trimestral' && 'As metas acumuladas abaixo representam o total por trimestre'}
                  {periodicity === 'semestral' && 'As metas acumuladas abaixo representam o total por semestre'}
                  {periodicity === 'anual' && 'As metas acumuladas abaixo representam o total anual'}
                </span>
              </div>

              {/* Divider */}
              <hr className="form-divider" />

              {/* Metas Acumuladas */}
              <div className="form-row form-row--triple">
                <div className="form-group">
                  <label htmlFor="u-t80">Meta Mínima Acumulada</label>
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
                  <label htmlFor="u-target">Meta 100% Acumulada</label>
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
                  <label htmlFor="u-t120">Meta Superação Acumulada</label>
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

              {/* Divider */}
              <hr className="form-divider" />

              {/* Valor Inicial + Peso */}
              <div className="form-row">
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
                  <label htmlFor="u-peso">Peso</label>
                  <input
                    id="u-peso"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.weight}
                    onChange={(e) => handleChange('weight', e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
              <label className={`inverse-toggle ${formData.is_inverse ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.is_inverse}
                  onChange={(e) => handleChange('is_inverse', e.target.checked)}
                />
                <div className="inverse-toggle-indicator">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d={formData.is_inverse
                      ? 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z'
                      : 'M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z'
                    } />
                  </svg>
                </div>
                <div className="inverse-toggle-text">
                  <strong>{formData.is_inverse ? 'Indicador Inverso' : 'Indicador Normal'}</strong>
                  <span>{formData.is_inverse
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

            {/* ---- PAINEL LATERAL: Metas Mensais (sempre Q1-Q4) ---- */}
            {showMetasPanel && (
              <div className="dialog-side-panel visible">
                <h3 className="side-panel-title">Metas Mensais</h3>
                <p className="side-panel-subtitle">
                  Defina a meta esperada para cada mês. As metas serão copiadas ao atribuir o indicador.
                </p>

                {/* Botões de ação */}
                <div className="side-panel-actions">
                  <button
                    type="button"
                    className="btn-distribute"
                    onClick={handleDistribute}
                    title={`Distribui a Meta 100% Acumulada (${periodicityLabel}) nos meses com base no Método de Acúmulo`}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V9h-2l3-4 3 4h-2v8z"/>
                    </svg>
                    Distribuir Automático
                  </button>
                  <button
                    type="button"
                    className="btn-apply-all-small"
                    onClick={applyFirstToAll}
                    title="Copiar o primeiro valor para todos os meses"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    1º → todos
                  </button>
                </div>

                {/* Grade Mensal - SEMPRE Q1-Q4 */}
                <div className="monthly-groups">
                  {QUARTER_GROUPS.map(group => (
                    <div key={group.label} className="period-group">
                      <span className="period-group-label">{group.label}</span>
                      <div className="period-group-inputs">
                        {group.months.map(m => (
                          <div key={m} className="period-month-input">
                            <label>{MONTH_NAMES_SHORT[m - 1]}</label>
                            <div className="input-with-unit">
                              <input
                                type="number"
                                step="any"
                                value={monthlyTargets[m] ?? ''}
                                onChange={(e) => handleTargetChange(m, e.target.value)}
                                placeholder="0"
                              />
                              {unit && <span className="input-unit">{unit}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

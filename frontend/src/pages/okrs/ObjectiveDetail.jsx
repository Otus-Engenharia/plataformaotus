import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './DashboardOKRs.css';

// Portal component to render modals outside the component tree
function Portal({ children }) {
  return createPortal(children, document.body);
}

// Calculate KR progress (handles inverse metrics)
function calculateKRProgress(kr, checkIns = []) {
  if (!kr) return 0;
  const meta = kr.meta || 0;
  if (meta === 0) return 0;

  let consolidatedValue = kr.atual || 0;

  if (checkIns && checkIns.length > 0) {
    const sortedCheckIns = [...checkIns].sort((a, b) =>
      (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes)
    );

    if (kr.consolidation_type === 'sum') {
      consolidatedValue = checkIns.reduce((sum, c) => sum + (c.valor || 0), 0);
    } else if (kr.consolidation_type === 'average') {
      consolidatedValue = checkIns.reduce((sum, c) => sum + (c.valor || 0), 0) / checkIns.length;
    } else {
      consolidatedValue = sortedCheckIns[0]?.valor || kr.atual || 0;
    }
  }

  if (kr.is_inverse) {
    const initial = kr.valor_inicial || meta * 1.5;
    if (initial === meta) return consolidatedValue <= meta ? 100 : 0;
    const progress = ((initial - consolidatedValue) / (initial - meta)) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  return Math.max(0, Math.min(100, (consolidatedValue / meta) * 100));
}

// Get consolidated value
function getConsolidatedValue(kr, checkIns = []) {
  if (!kr) return 0;
  let consolidatedValue = kr.atual || 0;

  if (checkIns && checkIns.length > 0) {
    const sortedCheckIns = [...checkIns].sort((a, b) =>
      (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes)
    );

    if (kr.consolidation_type === 'sum') {
      consolidatedValue = checkIns.reduce((sum, c) => sum + (c.valor || 0), 0);
    } else if (kr.consolidation_type === 'average') {
      consolidatedValue = checkIns.reduce((sum, c) => sum + (c.valor || 0), 0) / checkIns.length;
    } else {
      consolidatedValue = sortedCheckIns[0]?.valor || kr.atual || 0;
    }
  }

  return consolidatedValue;
}

// Status configuration
const statusConfig = {
  on_track: { label: 'No prazo', color: 'success' },
  at_risk: { label: 'Em risco', color: 'warning' },
  delayed: { label: 'Atrasado', color: 'danger' },
  completed: { label: 'Concluído', color: 'success' }
};

// Key Result Card Component
function KeyResultCard({ kr, checkIns = [], index }) {
  const progress = useMemo(() => calculateKRProgress(kr, checkIns), [kr, checkIns]);
  const consolidatedValue = useMemo(() => getConsolidatedValue(kr, checkIns), [kr, checkIns]);

  const getProgressColor = () => {
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  const trend = useMemo(() => {
    const expectedProgress = 50;
    if (progress > expectedProgress + 10) return 'up';
    if (progress < expectedProgress - 10) return 'down';
    return 'stable';
  }, [progress]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (kr.tipo_metrica === 'percentage') return `${value}%`;
    if (kr.tipo_metrica === 'currency') return `R$ ${value.toLocaleString('pt-BR')}`;
    if (kr.tipo_metrica === 'boolean') return value >= 1 ? 'Sim' : 'Não';
    return value.toLocaleString('pt-BR');
  };

  const status = kr.status || 'on_track';
  const statusInfo = statusConfig[status] || statusConfig.on_track;

  return (
    <Link
      to={`/okrs/kr/${kr.id}`}
      className={`okr-kr-card okr-kr-card--${getProgressColor()}`}
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="okr-kr-card__content">
        {/* Progress Circle */}
        <div className={`okr-kr-card__progress-circle okr-kr-card__progress-circle--${getProgressColor()}`}>
          <span className="okr-kr-card__progress-value">{Math.round(progress)}%</span>
          {trend !== 'stable' && (
            <span className={`okr-kr-card__trend okr-kr-card__trend--${trend}`}>
              <svg viewBox="0 0 24 24" width="12" height="12">
                {trend === 'up' ? (
                  <path fill="currentColor" d="M7 14l5-5 5 5z"/>
                ) : (
                  <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                )}
              </svg>
            </span>
          )}
        </div>

        {/* Main Content */}
        <div className="okr-kr-card__main">
          <div className="okr-kr-card__badges">
            <span className={`okr-kr-card__status okr-kr-card__status--${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className="okr-kr-card__weight">Peso: {kr.peso || 0}%</span>
            {kr.is_inverse && (
              <span className="okr-kr-card__inverse" title="Para este KR, valores menores indicam melhor desempenho">
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                </svg>
                Menor é melhor
              </span>
            )}
          </div>

          <h4 className="okr-kr-card__title">{kr.titulo || kr.descricao}</h4>

          <div className="okr-kr-card__values">
            <span className="okr-kr-card__current">{formatValue(consolidatedValue)}</span>
            <span className="okr-kr-card__separator">/</span>
            <span className="okr-kr-card__target">{formatValue(kr.meta || 0)}</span>
          </div>

          <div className="okr-kr-card__progress-bar-container">
            <div
              className={`okr-kr-card__progress-bar okr-kr-card__progress-bar--${getProgressColor()}`}
              style={{ '--progress': `${Math.min(100, progress)}%` }}
            />
          </div>

          {kr.responsavel && (
            <div className="okr-kr-card__footer">
              <div className="okr-kr-card__owner">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <span>{kr.responsavel}</span>
              </div>
            </div>
          )}
        </div>

        {/* Chevron */}
        <div className="okr-kr-card__chevron">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </div>
      </div>
    </Link>
  );
}

// Create Key Result Dialog
function CreateKeyResultDialog({ open, onClose, onSuccess, objectiveId, currentTotalWeight = 0 }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const maxWeight = 100 - currentTotalWeight;

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    meta: '',
    atual: '0',
    peso: Math.min(25, maxWeight).toString(),
    tipo_metrica: 'number',
    consolidation_type: 'last_value',
    is_inverse: false,
    responsavel: ''
  });

  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        peso: Math.min(25, maxWeight).toString()
      }));
    }
  }, [open, maxWeight]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.meta) return;

    const pesoNum = parseInt(formData.peso);
    if (pesoNum > maxWeight) {
      alert(`Peso máximo disponível: ${maxWeight}%`);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`/api/okrs/${objectiveId}/key-results`, {
        descricao: formData.titulo.trim(),
        meta: parseFloat(formData.meta),
        atual: parseFloat(formData.atual) || 0,
        peso: pesoNum,
        is_inverse: formData.is_inverse,
        responsavel: formData.responsavel.trim() || user?.name || 'Não definido',
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setFormData({
        titulo: '',
        descricao: '',
        meta: '',
        atual: '0',
        peso: Math.min(25, maxWeight).toString(),
        tipo_metrica: 'number',
        consolidation_type: 'last_value',
        is_inverse: false,
        responsavel: ''
      });
    } catch (err) {
      console.error('Error creating KR:', err);
      alert('Erro ao criar Key Result: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay" onClick={onClose}>
        <div className="okr-modal okr-modal--lg" onClick={e => e.stopPropagation()}>
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Novo Key Result</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            <div className="okr-form-group">
              <label className="okr-form-label">Título *</label>
              <input
                type="text"
                className="okr-form-input"
                value={formData.titulo}
                onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Aumentar NPS para 80 pontos"
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Descrição</label>
              <textarea
                className="okr-form-textarea"
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Como este resultado será mensurado..."
                rows={2}
              />
            </div>

            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Meta *</label>
                <input
                  type="number"
                  step="any"
                  className="okr-form-input"
                  value={formData.meta}
                  onChange={e => setFormData({ ...formData, meta: e.target.value })}
                  placeholder="100"
                  required
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Valor Atual</label>
                <input
                  type="number"
                  step="any"
                  className="okr-form-input"
                  value={formData.atual}
                  onChange={e => setFormData({ ...formData, atual: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Peso (%) *</label>
                <input
                  type="number"
                  min="1"
                  max={maxWeight}
                  className="okr-form-input"
                  value={formData.peso}
                  onChange={e => setFormData({ ...formData, peso: e.target.value })}
                  required
                />
                <span className="okr-form-hint">Disponível: {maxWeight}%</span>
              </div>
            </div>

            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Tipo de Métrica</label>
                <select
                  className="okr-form-select"
                  value={formData.tipo_metrica}
                  onChange={e => setFormData({ ...formData, tipo_metrica: e.target.value })}
                >
                  <option value="number">Número</option>
                  <option value="percentage">Porcentagem</option>
                  <option value="currency">Moeda (R$)</option>
                  <option value="boolean">Sim/Não</option>
                </select>
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Consolidação</label>
                <select
                  className="okr-form-select"
                  value={formData.consolidation_type}
                  onChange={e => setFormData({ ...formData, consolidation_type: e.target.value })}
                >
                  <option value="last_value">Último Valor</option>
                  <option value="sum">Soma</option>
                  <option value="average">Média</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Responsável</label>
              <input
                type="text"
                className="okr-form-input"
                value={formData.responsavel}
                onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="okr-form-group okr-form-group--checkbox">
              <label className="okr-checkbox">
                <input
                  type="checkbox"
                  checked={formData.is_inverse}
                  onChange={e => setFormData({ ...formData, is_inverse: e.target.checked })}
                />
                <span className="okr-checkbox__mark" />
                <span className="okr-checkbox__label">
                  <strong>Métrica inversa</strong>
                  <small>Valores menores indicam melhor desempenho</small>
                </span>
              </label>
            </div>
          </div>

          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Key Result'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Create Initiative Dialog
function CreateInitiativeDialog({ open, onClose, onSuccess, objectiveId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    responsible: '',
    status: 'pending'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/okrs/initiatives', {
        objective_id: objectiveId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        responsible: formData.responsible.trim() || user?.name || 'Não definido',
        status: formData.status
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setFormData({
        title: '',
        description: '',
        responsible: '',
        status: 'pending'
      });
    } catch (err) {
      console.error('Error creating initiative:', err);
      alert('Erro ao criar iniciativa: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay" onClick={onClose}>
        <div className="okr-modal okr-modal--md" onClick={e => e.stopPropagation()}>
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Nova Iniciativa</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            <div className="okr-form-group">
              <label className="okr-form-label">Título *</label>
              <input
                type="text"
                className="okr-form-input"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Migrar sistema para nova plataforma"
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Descrição</label>
              <textarea
                className="okr-form-textarea"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva a iniciativa..."
                rows={3}
              />
            </div>

            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Responsável</label>
                <input
                  type="text"
                  className="okr-form-input"
                  value={formData.responsible}
                  onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Status</label>
                <select
                  className="okr-form-select"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Progresso</option>
                  <option value="completed">Concluída</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Iniciativa'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Edit Initiative Dialog
function EditInitiativeDialog({ open, onClose, onSuccess, initiative }) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    responsible: '',
    status: 'pending'
  });

  useEffect(() => {
    if (initiative && open) {
      setFormData({
        title: initiative.title || '',
        description: initiative.description || '',
        responsible: initiative.responsible || '',
        status: initiative.status || 'pending'
      });
    }
  }, [initiative, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const response = await axios.put(`/api/okrs/initiatives/${initiative.id}`, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        responsible: formData.responsible.trim(),
        status: formData.status
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating initiative:', err);
      alert('Erro ao atualizar iniciativa: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open || !initiative) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay" onClick={onClose}>
        <div className="okr-modal okr-modal--md" onClick={e => e.stopPropagation()}>
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Editar Iniciativa</h2>
            <button className="okr-modal__close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="okr-modal__body">
              <div className="okr-form-group">
                <label className="okr-form-label">Título *</label>
                <input
                  type="text"
                  className="okr-form-input"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Descrição</label>
                <textarea
                  className="okr-form-textarea"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="okr-form-row">
                <div className="okr-form-group">
                  <label className="okr-form-label">Responsável</label>
                  <input
                    type="text"
                    className="okr-form-input"
                    value={formData.responsible}
                    onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                  />
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Status</label>
                  <select
                    className="okr-form-select"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="pending">Pendente</option>
                    <option value="in_progress">Em Progresso</option>
                    <option value="completed">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="okr-modal__footer">
              <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// Edit Objective Dialog
function EditObjectiveDialog({ open, onClose, onSuccess, objective }) {
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    nivel: 'time',
    quarter: '',
    responsavel: ''
  });

  useEffect(() => {
    if (objective && open) {
      setFormData({
        titulo: objective.titulo || '',
        descricao: objective.descricao || '',
        nivel: objective.nivel || 'time',
        quarter: objective.quarter || '',
        responsavel: objective.responsavel || ''
      });
    }
  }, [objective, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    setLoading(true);
    try {
      const response = await axios.put(`/api/okrs/${objective.id}`, {
        titulo: formData.titulo.trim(),
        nivel: formData.nivel,
        quarter: formData.quarter,
        responsavel: formData.responsavel.trim() || null
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating objective:', err);
      alert('Erro ao atualizar objetivo: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const quarterOptions = [
    { value: `Q1-${currentYear}`, label: `Q1 ${currentYear}` },
    { value: `Q2-${currentYear}`, label: `Q2 ${currentYear}` },
    { value: `Q3-${currentYear}`, label: `Q3 ${currentYear}` },
    { value: `Q4-${currentYear}`, label: `Q4 ${currentYear}` },
    { value: `Anual-${currentYear}`, label: `Anual ${currentYear}` },
  ];

  return (
    <Portal>
      <div className="okr-modal-overlay" onClick={onClose}>
        <div className="okr-modal" onClick={e => e.stopPropagation()}>
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Editar Objetivo</h2>
            <button className="okr-modal__close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="okr-modal__body">
              <div className="okr-form-group">
                <label className="okr-form-label">Título *</label>
                <input
                  type="text"
                  className="okr-form-input"
                  value={formData.titulo}
                  onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Descrição</label>
                <textarea
                  className="okr-form-textarea"
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="okr-form-row">
                <div className="okr-form-group">
                  <label className="okr-form-label">Ciclo</label>
                  <select
                    className="okr-form-select"
                    value={formData.quarter}
                    onChange={e => setFormData({ ...formData, quarter: e.target.value })}
                  >
                    {quarterOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Nível</label>
                  <select
                    className="okr-form-select"
                    value={formData.nivel}
                    onChange={e => setFormData({ ...formData, nivel: e.target.value })}
                  >
                    <option value="time">Time</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Responsável</label>
                <input
                  type="text"
                  className="okr-form-input"
                  value={formData.responsavel}
                  onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                />
              </div>
            </div>

            <div className="okr-modal__footer">
              <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// Delete Confirm Dialog
function DeleteConfirmDialog({ open, onClose, onConfirm, title, message, isDeleting }) {
  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay" onClick={onClose}>
        <div className="okr-modal okr-modal--sm" onClick={e => e.stopPropagation()}>
          <div className="okr-modal__header">
            <div className="okr-modal__icon okr-modal__icon--danger">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </div>
            <h2 className="okr-modal__title">{title}</h2>
          </div>
          <div className="okr-modal__body">
            <p className="okr-modal__message">{message}</p>
          </div>
          <div className="okr-modal__footer">
            <button
              type="button"
              className="okr-btn okr-btn--outline"
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="okr-btn okr-btn--danger"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export default function ObjectiveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged } = useAuth();

  const [objective, setObjective] = useState(null);
  const [keyResults, setKeyResults] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [initiativeComments, setInitiativeComments] = useState([]);
  const [sector, setSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreateKRDialog, setShowCreateKRDialog] = useState(false);
  const [showCreateInitiativeDialog, setShowCreateInitiativeDialog] = useState(false);
  const [showEditInitiativeDialog, setShowEditInitiativeDialog] = useState(false);
  const [selectedInitiative, setSelectedInitiative] = useState(null);
  const [expandedInitiative, setExpandedInitiative] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch objective via API
      const objResponse = await axios.get(`/api/okrs/${id}`, { withCredentials: true });
      if (!objResponse.data.success) throw new Error(objResponse.data.error);

      const objData = objResponse.data.data;
      setObjective(objData);

      if (!objData) {
        setLoading(false);
        return;
      }

      // Fetch sector if exists
      if (objData.setor_id) {
        const sectorResponse = await axios.get(`/api/ind/sectors/${objData.setor_id}`, { withCredentials: true });
        if (sectorResponse.data.success) {
          setSector(sectorResponse.data.data);
        }
      }

      // Get key results from objective data
      const krsData = objData.key_results || [];
      setKeyResults(krsData);

      // Fetch check-ins for all KRs
      if (krsData.length > 0) {
        const krIds = krsData.map(kr => kr.id);
        const checkInsResponse = await axios.get('/api/okrs/check-ins', {
          params: { keyResultIds: krIds.join(',') },
          withCredentials: true
        });
        setCheckIns(checkInsResponse.data.data || []);
      }

      // Fetch initiatives
      const initiativesResponse = await axios.get(`/api/okrs/initiatives/${id}`, { withCredentials: true });
      if (initiativesResponse.data.success) {
        const initiativesData = initiativesResponse.data.data || [];
        setInitiatives(initiativesData);

        // Fetch comments for all initiatives
        if (initiativesData.length > 0) {
          const initiativeIds = initiativesData.map(i => i.id);
          const commentsResponse = await axios.get('/api/okrs/initiative-comments', {
            params: { initiativeIds: initiativeIds.join(',') },
            withCredentials: true
          });
          setInitiativeComments(commentsResponse.data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching objective:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteObjective = async () => {
    if (!id) return;
    setIsDeleting(true);

    try {
      const response = await axios.delete(`/api/okrs/${id}`, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);

      navigate(sector ? `/okrs/setor/${sector.id}` : '/okrs/empresa');
    } catch (err) {
      console.error('Error deleting objective:', err);
      alert('Erro ao excluir objetivo: ' + err.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEditInitiative = (initiative) => {
    setSelectedInitiative(initiative);
    setShowEditInitiativeDialog(true);
  };

  const handleDeleteInitiative = async (initiativeId) => {
    if (!confirm('Tem certeza que deseja excluir esta iniciativa?')) return;

    try {
      const response = await axios.delete(`/api/okrs/initiatives/${initiativeId}`, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      fetchData();
    } catch (err) {
      console.error('Error deleting initiative:', err);
      alert('Erro ao excluir iniciativa: ' + err.message);
    }
  };

  const handleAddComment = async (initiativeId) => {
    if (!newComment.trim()) return;

    try {
      const response = await axios.post('/api/okrs/initiative-comments', {
        initiative_id: initiativeId,
        content: newComment.trim()
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      setInitiativeComments([...initiativeComments, response.data.data]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Erro ao adicionar comentário: ' + err.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Tem certeza que deseja excluir este comentário?')) return;

    try {
      const response = await axios.delete(`/api/okrs/initiative-comments/${commentId}`, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      setInitiativeComments(initiativeComments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Erro ao excluir comentário: ' + err.message);
    }
  };

  const getCommentsForInitiative = (initiativeId) => {
    return initiativeComments.filter(c => c.initiative_id === initiativeId);
  };

  const { progress, totalWeight, statusCounts } = useMemo(() => {
    if (keyResults.length === 0) {
      return { progress: 0, totalWeight: 0, statusCounts: { on_track: 0, at_risk: 0, delayed: 0, completed: 0 } };
    }

    let weightedProgress = 0;
    let totalW = 0;
    const counts = { on_track: 0, at_risk: 0, delayed: 0, completed: 0 };

    keyResults.forEach(kr => {
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const krProgress = calculateKRProgress(kr, krCheckIns);
      weightedProgress += krProgress * (kr.peso || 1);
      totalW += (kr.peso || 1);

      const status = kr.status || 'on_track';
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });

    return {
      progress: totalW > 0 ? Math.round(weightedProgress / totalW) : 0,
      totalWeight: totalW,
      statusCounts: counts,
    };
  }, [keyResults, checkIns]);

  const cycleLabel = objective?.quarter?.toLowerCase().includes('anual')
    ? `Anual ${objective.quarter?.split('-')[1] || ''}`
    : objective?.quarter || 'Q1';

  const getProgressColor = () => {
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="okr-dashboard okr-dashboard--loading">
        <div className="okr-loading-pulse">
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
        </div>
        <p className="okr-loading-text">Carregando objetivo...</p>
      </div>
    );
  }

  if (!objective) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Objetivo não encontrado</p>
          <button onClick={() => navigate('/okrs')} className="okr-btn okr-btn--primary">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Erro: {error}</p>
          <button onClick={fetchData} className="okr-btn okr-btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="okr-dashboard">
      {/* Background effects */}
      <div className="okr-dashboard__bg">
        <div className="okr-dashboard__gradient" />
        <div className="okr-dashboard__noise" />
      </div>

      {/* Header */}
      <header className="okr-header">
        <div className="okr-header__left">
          <button
            className="okr-back-btn"
            onClick={() => navigate(sector ? `/okrs/setor/${sector.id}` : '/okrs/empresa')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div>
            <div className="okr-header__breadcrumb">
              <Link
                to={sector ? `/okrs/setor/${sector.id}` : '/okrs/empresa'}
                className="okr-header__breadcrumb-link"
              >
                {sector ? sector.name : 'OKRs da Empresa'}
              </Link>
            </div>
            <div className="okr-header__badges">
              <span className="okr-badge okr-badge--outline">
                <svg viewBox="0 0 24 24" width="12" height="12">
                  <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
                {cycleLabel}
              </span>
              {sector && (
                <span className="okr-badge okr-badge--secondary">
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                  {sector.name}
                </span>
              )}
            </div>
            <h1 className="okr-header__title">{objective.titulo}</h1>
            {objective.descricao && (
              <p className="okr-header__description">{objective.descricao}</p>
            )}
          </div>
        </div>

        {isPrivileged && (
          <div className="okr-header__actions">
            <button
              className="okr-btn okr-btn--outline"
              onClick={() => setShowEditDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Editar
            </button>
            <button
              className="okr-btn okr-btn--danger-outline"
              onClick={() => setShowDeleteDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Progress Summary Card */}
      <section className="okr-section">
        <div className="okr-progress-summary">
          <div className="okr-progress-summary__header">
            <span className="okr-progress-summary__label">Progresso do Objetivo</span>
          </div>
          <div className="okr-progress-summary__content">
            <div className="okr-progress-summary__value-row">
              <span className={`okr-progress-summary__value okr-progress-summary__value--${getProgressColor()}`}>
                {progress}%
              </span>
              <div className="okr-progress-summary__badges">
                {statusCounts.completed > 0 && (
                  <span className="okr-badge okr-badge--success">
                    {statusCounts.completed} concluído{statusCounts.completed > 1 ? 's' : ''}
                  </span>
                )}
                {statusCounts.delayed > 0 && (
                  <span className="okr-badge okr-badge--danger">
                    {statusCounts.delayed} atrasado{statusCounts.delayed > 1 ? 's' : ''}
                  </span>
                )}
                {statusCounts.at_risk > 0 && (
                  <span className="okr-badge okr-badge--warning">
                    {statusCounts.at_risk} em risco
                  </span>
                )}
              </div>
            </div>
            <div className="okr-progress-summary__bar">
              <div
                className={`okr-progress-summary__bar-fill okr-progress-summary__bar-fill--${getProgressColor()}`}
                style={{ '--progress': `${progress}%` }}
              />
            </div>
            <div className="okr-progress-summary__footer">
              <span>{keyResults.length} Key Result{keyResults.length !== 1 ? 's' : ''}</span>
              <span>Peso total: {totalWeight}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Key Results Section */}
      <section className="okr-section">
        <div className="okr-section__header">
          <h2 className="okr-section__title">Key Results</h2>
          {isPrivileged && totalWeight < 100 && (
            <button
              className="okr-btn okr-btn--primary"
              onClick={() => setShowCreateKRDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Novo KR
            </button>
          )}
        </div>

        {keyResults.length === 0 ? (
          <div className="okr-empty-state">
            <div className="okr-empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="okr-empty-state__title">Nenhum Key Result cadastrado</h3>
            <p className="okr-empty-state__description">
              Adicione resultados-chave mensuráveis para acompanhar o progresso deste objetivo.
            </p>
            {isPrivileged && (
              <button
                className="okr-btn okr-btn--primary"
                onClick={() => setShowCreateKRDialog(true)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Criar Primeiro KR
              </button>
            )}
          </div>
        ) : (
          <div className="okr-kr-list">
            {keyResults.map((kr, index) => (
              <KeyResultCard
                key={kr.id}
                kr={kr}
                checkIns={checkIns.filter(c => c.key_result_id === kr.id)}
                index={index}
              />
            ))}
          </div>
        )}

        {totalWeight >= 100 && keyResults.length > 0 && (
          <p className="okr-section__info">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            Peso total dos KRs atingiu 100%
          </p>
        )}
      </section>

      {/* Initiatives Section */}
      <section className="okr-section">
        <div className="okr-section__header">
          <h2 className="okr-section__title">Iniciativas</h2>
          {isPrivileged && (
            <button
              className="okr-btn okr-btn--outline"
              onClick={() => setShowCreateInitiativeDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Nova Iniciativa
            </button>
          )}
        </div>

        {initiatives.length === 0 ? (
          <div className="okr-empty-state">
            <div className="okr-empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 017 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
              </svg>
            </div>
            <h3 className="okr-empty-state__title">Nenhuma iniciativa cadastrada</h3>
            <p className="okr-empty-state__description">
              Iniciativas são projetos e ações de suporte que não afetam o progresso numérico do OKR.
            </p>
            {isPrivileged && (
              <button
                className="okr-btn okr-btn--primary"
                onClick={() => setShowCreateInitiativeDialog(true)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Criar Primeira Iniciativa
              </button>
            )}
          </div>
        ) : (
          <div className="okr-initiatives-list">
            {initiatives.map((initiative, index) => {
              const comments = getCommentsForInitiative(initiative.id);
              const isExpanded = expandedInitiative === initiative.id;

              return (
                <div
                  key={initiative.id}
                  className={`okr-initiative-card okr-initiative-card--${initiative.status || 'pending'} ${isExpanded ? 'okr-initiative-card--expanded' : ''}`}
                  style={{ animationDelay: `${100 + index * 50}ms` }}
                >
                  <div className="okr-initiative-card__header">
                    <div className="okr-initiative-card__badges">
                      <span className={`okr-initiative-card__status okr-initiative-card__status--${initiative.status || 'pending'}`}>
                        {initiative.status === 'completed' ? 'Concluída' :
                         initiative.status === 'in_progress' ? 'Em Progresso' :
                         initiative.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                      </span>
                      {initiative.responsible && (
                        <span className="okr-initiative-card__responsible">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                          {initiative.responsible}
                        </span>
                      )}
                    </div>
                    {isPrivileged && (
                      <div className="okr-initiative-card__actions">
                        <button
                          className="okr-btn-icon"
                          onClick={() => handleEditInitiative(initiative)}
                          title="Editar"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                        <button
                          className="okr-btn-icon okr-btn-icon--danger"
                          onClick={() => handleDeleteInitiative(initiative.id)}
                          title="Excluir"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <h4 className="okr-initiative-card__title">{initiative.title}</h4>
                  {initiative.description && (
                    <p className="okr-initiative-card__description">{initiative.description}</p>
                  )}

                  <button
                    className="okr-initiative-card__expand"
                    onClick={() => setExpandedInitiative(isExpanded ? null : initiative.id)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
                    </svg>
                    {comments.length} comentário{comments.length !== 1 ? 's' : ''}
                    <svg viewBox="0 0 24 24" width="16" height="16" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="okr-initiative-card__comments">
                      {comments.length > 0 ? (
                        <div className="okr-comments-list">
                          {comments.map(comment => (
                            <div key={comment.id} className="okr-comment">
                              <div className="okr-comment__header">
                                <span className="okr-comment__author">{comment.author_name}</span>
                                <span className="okr-comment__date">
                                  {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isPrivileged && (
                                  <button
                                    className="okr-btn-icon okr-btn-icon--small"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    title="Excluir comentário"
                                  >
                                    <svg viewBox="0 0 24 24" width="12" height="12">
                                      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                              <p className="okr-comment__content">{comment.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="okr-comments-empty">Nenhum comentário ainda.</p>
                      )}

                      <div className="okr-add-comment">
                        <input
                          type="text"
                          className="okr-form-input"
                          placeholder="Adicionar comentário..."
                          value={expandedInitiative === initiative.id ? newComment : ''}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && handleAddComment(initiative.id)}
                        />
                        <button
                          className="okr-btn okr-btn--primary okr-btn--sm"
                          onClick={() => handleAddComment(initiative.id)}
                          disabled={!newComment.trim()}
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <CreateKeyResultDialog
        open={showCreateKRDialog}
        onClose={() => setShowCreateKRDialog(false)}
        onSuccess={fetchData}
        objectiveId={id}
        currentTotalWeight={totalWeight}
      />

      <CreateInitiativeDialog
        open={showCreateInitiativeDialog}
        onClose={() => setShowCreateInitiativeDialog(false)}
        onSuccess={fetchData}
        objectiveId={id}
      />

      <EditInitiativeDialog
        open={showEditInitiativeDialog}
        onClose={() => {
          setShowEditInitiativeDialog(false);
          setSelectedInitiative(null);
        }}
        onSuccess={fetchData}
        initiative={selectedInitiative}
      />

      {objective && (
        <EditObjectiveDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={fetchData}
          objective={objective}
        />
      )}

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteObjective}
        title="Excluir Objetivo"
        message="Tem certeza que deseja excluir este objetivo? Todos os Key Results, check-ins e iniciativas vinculados também serão excluídos. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}

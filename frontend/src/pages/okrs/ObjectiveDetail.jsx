import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { calculateKRProgress, calculateKRProgressVsMeta } from '../../utils/indicator-utils';
import './DashboardOKRs.css';

// Portal component to render modals outside the component tree
function Portal({ children }) {
  return createPortal(children, document.body);
}

// Get consolidated value (manual - kr.atual)
function getConsolidatedValue(kr) {
  if (!kr) return 0;
  return kr.atual ?? 0;
}

// Status configuration
const statusConfig = {
  on_track: { label: 'No prazo', color: 'success' },
  at_risk: { label: 'Em risco', color: 'warning' },
  delayed: { label: 'Atrasado', color: 'danger' },
  completed: { label: 'Concluído', color: 'success' }
};

// Key Result Card Component
function KeyResultCard({ kr, checkIns = [], index, onWeightChange }) {
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [editWeight, setEditWeight] = useState(kr.peso || 0);
  const [savingWeight, setSavingWeight] = useState(false);

  const progress = useMemo(() => calculateKRProgress(kr), [kr]);
  const progressVsMeta = useMemo(() => calculateKRProgressVsMeta(kr), [kr]);
  const consolidatedValue = useMemo(() => getConsolidatedValue(kr), [kr]);
  const isNotMeasured = progress === null;

  const getProgressColor = () => {
    if (isNotMeasured) return 'muted';
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  const trend = useMemo(() => {
    if (isNotMeasured) return 'stable';
    const expectedProgress = 50;
    if (progress > expectedProgress + 10) return 'up';
    if (progress < expectedProgress - 10) return 'down';
    return 'stable';
  }, [progress, isNotMeasured]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (kr.tipo_metrica === 'percentage') return `${value}%`;
    if (kr.tipo_metrica === 'currency') return `R$ ${value.toLocaleString('pt-BR')}`;
    if (kr.tipo_metrica === 'boolean') return value >= 1 ? 'Sim' : 'Não';
    return value.toLocaleString('pt-BR');
  };

  const status = kr.status || 'on_track';
  const statusInfo = statusConfig[status] || statusConfig.on_track;

  const handleWeightClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditWeight(kr.peso || 0);
    setIsEditingWeight(true);
  };

  const handleWeightSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const newWeight = parseInt(editWeight, 10);
    if (isNaN(newWeight) || newWeight < 0 || newWeight > 100) return;

    setSavingWeight(true);
    try {
      await axios.put(`/api/okrs/key-results/${kr.id}`, { peso: newWeight }, { withCredentials: true });
      if (onWeightChange) onWeightChange(kr.id, newWeight);
      setIsEditingWeight(false);
    } catch (err) {
      console.error('Erro ao atualizar peso:', err);
    } finally {
      setSavingWeight(false);
    }
  };

  const handleWeightCancel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditingWeight(false);
    setEditWeight(kr.peso || 0);
  };

  const handleWeightKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleWeightSave(e);
    } else if (e.key === 'Escape') {
      handleWeightCancel(e);
    }
  };

  return (
    <Link
      to={`/okrs/kr/${kr.id}`}
      className="okr-kr-card-v2"
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      {/* Header: Responsável + Peso (estilo OKR) */}
      <div className="okr-kr-card-v2__header-row">
        {/* Responsável à esquerda */}
        {kr.responsavel_user ? (
          <div className="okr-kr-card-v2__owner-block">
            {kr.responsavel_user.avatar_url ? (
              <img src={kr.responsavel_user.avatar_url} alt="" className="okr-kr-card-v2__avatar" />
            ) : (
              <div className="okr-kr-card-v2__avatar-placeholder">
                {kr.responsavel_user.name?.charAt(0) || '?'}
              </div>
            )}
            <div className="okr-kr-card-v2__owner-info">
              <span className="okr-kr-card-v2__owner-label">Responsável</span>
              <span className="okr-kr-card-v2__owner-name">{kr.responsavel_user.name}</span>
            </div>
          </div>
        ) : (
          <div className="okr-kr-card-v2__owner-block okr-kr-card-v2__owner-block--empty" />
        )}

        {/* Peso à direita (editável) */}
        <div className="okr-kr-card-v2__weight-block" onClick={handleWeightClick}>
          {isEditingWeight ? (
            <div className="okr-kr-card-v2__weight-edit" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                min="0"
                max="100"
                value={editWeight}
                onChange={(e) => setEditWeight(e.target.value)}
                onKeyDown={handleWeightKeyDown}
                className="okr-kr-card-v2__weight-input"
                autoFocus
                disabled={savingWeight}
              />
              <span className="okr-kr-card-v2__weight-unit">%</span>
              <button
                className="okr-kr-card-v2__weight-btn okr-kr-card-v2__weight-btn--save"
                onClick={handleWeightSave}
                disabled={savingWeight}
              >
                ✓
              </button>
              <button
                className="okr-kr-card-v2__weight-btn okr-kr-card-v2__weight-btn--cancel"
                onClick={handleWeightCancel}
                disabled={savingWeight}
              >
                ✕
              </button>
            </div>
          ) : (
            <>
              <span className="okr-kr-card-v2__weight-number">{kr.peso || 0}%</span>
              <span className="okr-kr-card-v2__weight-label-text">PESO</span>
            </>
          )}
        </div>
      </div>

      {/* Título */}
      <h4 className="okr-kr-card-v2__title">{kr.titulo || kr.descricao}</h4>

      {/* Dual Metrics Grid */}
      <div className="okr-kr-card-v2__metrics">
        {/* Ritmo */}
        <div className={`okr-kr-card-v2__metric okr-kr-card-v2__metric--${getProgressColor()}`}>
          <div className="okr-kr-card-v2__metric-header">
            <span className="okr-kr-card-v2__metric-icon">⚡</span>
            <span className="okr-kr-card-v2__metric-label">Ritmo</span>
          </div>
          <span className={`okr-kr-card-v2__metric-percent okr-kr-card-v2__metric-percent--${getProgressColor()}`}>
            {isNotMeasured ? '—' : `${Math.round(progress)}%`}
          </span>
          <span className="okr-kr-card-v2__metric-formula">
            {formatValue(consolidatedValue)} / {formatValue(kr.planejado_acumulado || 0)}
          </span>
          <div className="okr-kr-card-v2__metric-bar">
            <div
              className={`okr-kr-card-v2__metric-bar-fill okr-kr-card-v2__metric-bar-fill--${getProgressColor()}`}
              style={{ width: `${Math.min(progress || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Progresso */}
        <div className={`okr-kr-card-v2__metric okr-kr-card-v2__metric--${
          progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
        }`}>
          <div className="okr-kr-card-v2__metric-header">
            <span className="okr-kr-card-v2__metric-icon">🎯</span>
            <span className="okr-kr-card-v2__metric-label">Progresso</span>
          </div>
          <span className={`okr-kr-card-v2__metric-percent okr-kr-card-v2__metric-percent--${
            progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
          }`}>
            {progressVsMeta === null ? '—' : `${progressVsMeta}%`}
          </span>
          <span className="okr-kr-card-v2__metric-formula">
            {formatValue(consolidatedValue)} / {formatValue(kr.meta || 0)}
          </span>
          <div className="okr-kr-card-v2__metric-bar">
            <div
              className={`okr-kr-card-v2__metric-bar-fill okr-kr-card-v2__metric-bar-fill--${
                progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
              }`}
              style={{ width: `${Math.min(progressVsMeta || 0, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer: Status badges */}
      <div className="okr-kr-card-v2__footer">
        <div className="okr-kr-card-v2__status-badges">
          {isNotMeasured ? (
            <span className="okr-kr-card-v2__badge okr-kr-card-v2__badge--muted">Não medido</span>
          ) : (
            <span className={`okr-kr-card-v2__badge okr-kr-card-v2__badge--${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          )}
          {kr.is_inverse && (
            <span className="okr-kr-card-v2__badge okr-kr-card-v2__badge--inverse">↓ Menor é melhor</span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <div className="okr-kr-card-v2__chevron">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </div>
    </Link>
  );
}

// Create Key Result Dialog
function CreateKeyResultDialog({ open, onClose, onSuccess, objectiveId, currentTotalWeight = 0, setorId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [onlyLeadership, setOnlyLeadership] = useState(false);
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
    responsavel_id: ''
  });

  // Busca lista de usuários ao abrir o dialog ou mudar filtros
  useEffect(() => {
    if (open) {
      const params = new URLSearchParams();
      if (setorId) params.append('setor_id', setorId);
      if (onlyLeadership) params.append('only_leadership', 'true');

      axios.get(`/api/okrs/usuarios-responsaveis?${params.toString()}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));
    }
  }, [open, setorId, onlyLeadership]);

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
        responsavel_id: formData.responsavel_id || null,
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
        responsavel_id: ''
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
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--lg">
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
              <select
                className="okr-form-select"
                value={formData.responsavel_id}
                onChange={e => setFormData({ ...formData, responsavel_id: e.target.value })}
              >
                <option value="">Selecione um responsável</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="okr-form-toggle-row">
                <label className="okr-toggle">
                  <input
                    type="checkbox"
                    checked={onlyLeadership}
                    onChange={e => setOnlyLeadership(e.target.checked)}
                  />
                  <span className="okr-toggle__slider" />
                </label>
                <span className="okr-form-toggle-label">Somente lideranças</span>
              </div>
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

// Action Plan Dialog (Create/Edit)
function ActionPlanDialog({ open, onClose, onSuccess, initiativeId, plan, setorId }) {
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const isEditing = !!plan;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    responsible_id: '',
    due_date: '',
    status: 'pending'
  });

  useEffect(() => {
    if (open) {
      // Busca usuários do setor
      const params = new URLSearchParams();
      if (setorId) params.append('setor_id', setorId);
      axios.get(`/api/okrs/usuarios-responsaveis?${params.toString()}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));

      // Preenche dados se editando
      if (plan) {
        setFormData({
          title: plan.title || '',
          description: plan.description || '',
          responsible_id: plan.responsible?.id || plan.responsible_id || '',
          due_date: plan.due_date ? plan.due_date.split('T')[0] : '',
          status: plan.status || 'pending'
        });
      } else {
        setFormData({
          title: '',
          description: '',
          responsible_id: '',
          due_date: '',
          status: 'pending'
        });
      }
    }
  }, [open, plan, setorId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.due_date) return;

    setLoading(true);
    try {
      let response;
      if (isEditing) {
        response = await axios.put(`/api/okrs/action-plans/${plan.id}`, {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          responsible_id: formData.responsible_id || null,
          due_date: formData.due_date,
          status: formData.status
        }, { withCredentials: true });
      } else {
        response = await axios.post(`/api/okrs/initiatives/${initiativeId}/action-plans`, {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          responsible_id: formData.responsible_id || null,
          due_date: formData.due_date,
          status: formData.status
        }, { withCredentials: true });
      }

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.(response.data.data, isEditing);
      onClose();
    } catch (err) {
      console.error('Error saving action plan:', err);
      alert('Erro ao salvar plano de ação: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--md">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">{isEditing ? 'Editar' : 'Novo'} Plano de Ação</h2>
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
                  placeholder="Ex: Reunião com stakeholders"
                  required
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Descrição</label>
                <textarea
                  className="okr-form-textarea"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes do plano de ação..."
                  rows={2}
                />
              </div>

              <div className="okr-form-row">
                <div className="okr-form-group">
                  <label className="okr-form-label">Data *</label>
                  <input
                    type="date"
                    className="okr-form-input"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Responsável</label>
                  <select
                    className="okr-form-select"
                    value={formData.responsible_id}
                    onChange={e => setFormData({ ...formData, responsible_id: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
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
                  <option value="completed">Concluído</option>
                </select>
              </div>
            </div>

            <div className="okr-modal__footer">
              <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
                {loading ? 'Salvando...' : (isEditing ? 'Salvar' : 'Criar')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// Create Initiative Dialog
function CreateInitiativeDialog({ open, onClose, onSuccess, objectiveId, setorId }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    responsible_id: '',
    status: 'pending'
  });

  // Fetch users when dialog opens
  useEffect(() => {
    if (open && setorId) {
      axios.get(`/api/okrs/usuarios-responsaveis?setor_id=${setorId}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));
    }
  }, [open, setorId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      // Find selected user name for backward compatibility
      const selectedUser = usuarios.find(u => u.id === formData.responsible_id);
      const response = await axios.post('/api/okrs/initiatives', {
        objective_id: objectiveId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        responsible_id: formData.responsible_id || null,
        responsible: selectedUser?.name || user?.name || 'Não definido',
        status: formData.status
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setFormData({
        title: '',
        description: '',
        responsible_id: '',
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
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--md">
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
                <select
                  className="okr-form-select"
                  value={formData.responsible_id}
                  onChange={e => setFormData({ ...formData, responsible_id: e.target.value })}
                >
                  <option value="">Selecione um responsável</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
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
function EditInitiativeDialog({ open, onClose, onSuccess, initiative, setorId }) {
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    responsible_id: '',
    status: 'pending'
  });

  // Fetch users when dialog opens
  useEffect(() => {
    if (open && setorId) {
      axios.get(`/api/okrs/usuarios-responsaveis?setor_id=${setorId}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));
    }
  }, [open, setorId]);

  useEffect(() => {
    if (initiative && open) {
      setFormData({
        title: initiative.title || '',
        description: initiative.description || '',
        responsible_id: initiative.responsible_id || initiative.responsible_user?.id || '',
        status: initiative.status || 'pending'
      });
    }
  }, [initiative, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      // Find selected user name for backward compatibility
      const selectedUser = usuarios.find(u => u.id === formData.responsible_id);
      const response = await axios.put(`/api/okrs/initiatives/${initiative.id}`, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        responsible_id: formData.responsible_id || null,
        responsible: selectedUser?.name || '',
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
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--md">
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
                  <select
                    className="okr-form-select"
                    value={formData.responsible_id}
                    onChange={e => setFormData({ ...formData, responsible_id: e.target.value })}
                  >
                    <option value="">Selecione um responsável</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
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
  const [usuarios, setUsuarios] = useState([]);
  const [onlyLeadership, setOnlyLeadership] = useState(false);
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    nivel: 'time',
    quarter: '',
    responsavel_id: '',
    peso: 1
  });

  // Fetch users when dialog opens
  useEffect(() => {
    if (open && objective?.setor_id) {
      const params = new URLSearchParams();
      params.append('setor_id', objective.setor_id);
      if (onlyLeadership) params.append('only_leadership', 'true');

      axios.get(`/api/okrs/usuarios-responsaveis?${params.toString()}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));
    }
  }, [open, objective?.setor_id, onlyLeadership]);

  useEffect(() => {
    if (objective && open) {
      setFormData({
        titulo: objective.titulo || '',
        descricao: objective.descricao || '',
        nivel: objective.nivel || 'time',
        quarter: objective.quarter || '',
        responsavel_id: objective.responsavel_id || objective.responsavel_user?.id || '',
        peso: objective.peso || 1
      });
    }
  }, [objective, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    setLoading(true);
    try {
      // Find selected user name for backward compatibility
      const selectedUser = usuarios.find(u => u.id === formData.responsavel_id);
      const response = await axios.put(`/api/okrs/${objective.id}`, {
        titulo: formData.titulo.trim(),
        nivel: formData.nivel,
        quarter: formData.quarter,
        responsavel_id: formData.responsavel_id || null,
        responsavel: selectedUser?.name || null,
        peso: formData.peso || 1
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
      <div className="okr-modal-overlay">
        <div className="okr-modal">
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

              <div className="okr-form-row">
                <div className="okr-form-group">
                  <label className="okr-form-label">Responsável</label>
                  <select
                    className="okr-form-select"
                    value={formData.responsavel_id}
                    onChange={e => setFormData({ ...formData, responsavel_id: e.target.value })}
                  >
                    <option value="">Selecione um responsável</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <div className="okr-form-toggle-row">
                    <label className="okr-toggle">
                      <input
                        type="checkbox"
                        checked={onlyLeadership}
                        onChange={e => setOnlyLeadership(e.target.checked)}
                      />
                      <span className="okr-toggle__slider" />
                    </label>
                    <span className="okr-form-toggle-label">Somente lideranças</span>
                  </div>
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Peso do Objetivo (%)</label>
                  <input
                    type="number"
                    className="okr-form-input"
                    value={formData.peso}
                    onChange={e => setFormData({ ...formData, peso: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="100"
                    step="1"
                  />
                  <span className="okr-form-hint">Peso para cálculo do progresso do setor (soma deve ser 100%)</span>
                </div>
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
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--sm">
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
  const [actionPlans, setActionPlans] = useState([]);
  const [dodItems, setDodItems] = useState([]);
  const [sector, setSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreateKRDialog, setShowCreateKRDialog] = useState(false);
  const [showCreateInitiativeDialog, setShowCreateInitiativeDialog] = useState(false);
  const [showEditInitiativeDialog, setShowEditInitiativeDialog] = useState(false);
  const [showActionPlanDialog, setShowActionPlanDialog] = useState(false);
  const [editingActionPlan, setEditingActionPlan] = useState(null);
  const [actionPlanInitiativeId, setActionPlanInitiativeId] = useState(null);
  const [selectedInitiative, setSelectedInitiative] = useState(null);

  // Estado para abas das iniciativas (por initiative.id)
  const [initiativeActiveTab, setInitiativeActiveTab] = useState({});
  const getInitiativeTab = (initiativeId) => initiativeActiveTab[initiativeId] || 'dod';
  const setInitiativeTab = (initiativeId, tab) => {
    setInitiativeActiveTab(prev => ({ ...prev, [initiativeId]: tab }));
  };
  // expandedInitiative state removed - cards are now always open
  const [newComment, setNewComment] = useState('');
  const [newDodItem, setNewDodItem] = useState('');
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

        // Fetch comments and action plans for all initiatives
        if (initiativesData.length > 0) {
          const initiativeIds = initiativesData.map(i => i.id);

          const [commentsResponse, plansResponse, dodResponse] = await Promise.all([
            axios.get('/api/okrs/initiative-comments', {
              params: { initiativeIds: initiativeIds.join(',') },
              withCredentials: true
            }),
            axios.get('/api/okrs/action-plans', {
              params: { initiativeIds: initiativeIds.join(',') },
              withCredentials: true
            }),
            axios.get('/api/okrs/dod', {
              params: { initiativeIds: initiativeIds.join(',') },
              withCredentials: true
            })
          ]);

          setInitiativeComments(commentsResponse.data.data || []);
          setActionPlans(plansResponse.data.data || []);
          setDodItems(dodResponse.data.data || []);
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

  const getActionPlansForInitiative = (initiativeId) => {
    return actionPlans.filter(p => p.initiative_id === initiativeId);
  };

  const handleCreateActionPlan = (initiativeId) => {
    setActionPlanInitiativeId(initiativeId);
    setEditingActionPlan(null);
    setShowActionPlanDialog(true);
  };

  const handleEditActionPlan = (plan) => {
    setActionPlanInitiativeId(plan.initiative_id);
    setEditingActionPlan(plan);
    setShowActionPlanDialog(true);
  };

  const handleDeleteActionPlan = async (planId) => {
    if (!confirm('Tem certeza que deseja excluir este plano de ação?')) return;

    try {
      const response = await axios.delete(`/api/okrs/action-plans/${planId}`, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      setActionPlans(actionPlans.filter(p => p.id !== planId));
    } catch (err) {
      console.error('Error deleting action plan:', err);
      alert('Erro ao excluir plano de ação: ' + err.message);
    }
  };

  const handleToggleActionPlanStatus = async (plan) => {
    const newStatus = plan.status === 'completed' ? 'pending' : 'completed';
    try {
      const response = await axios.put(`/api/okrs/action-plans/${plan.id}`, {
        ...plan,
        status: newStatus,
        responsible_id: plan.responsible?.id || plan.responsible_id,
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);
      setActionPlans(actionPlans.map(p => p.id === plan.id ? response.data.data : p));
    } catch (err) {
      console.error('Error updating action plan:', err);
      alert('Erro ao atualizar plano: ' + err.message);
    }
  };

  // DoD (Definition of Done) handlers
  const getDodItemsForInitiative = (initiativeId) => {
    return dodItems.filter(d => d.initiative_id === initiativeId);
  };

  const getDodProgress = (initiativeId) => {
    const items = getDodItemsForInitiative(initiativeId);
    if (items.length === 0) return null;
    const completed = items.filter(d => d.completed).length;
    return Math.round((completed / items.length) * 100);
  };

  const handleAddDodItem = async (initiativeId) => {
    if (!newDodItem.trim()) return;

    try {
      const response = await axios.post(`/api/okrs/initiatives/${initiativeId}/dod`, {
        title: newDodItem.trim()
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      setDodItems([...dodItems, response.data.data]);
      setNewDodItem('');
    } catch (err) {
      console.error('Error adding DoD item:', err);
      alert('Erro ao adicionar critério: ' + err.message);
    }
  };

  const handleToggleDodItem = async (item) => {
    try {
      const response = await axios.put(`/api/okrs/dod/${item.id}`, {
        completed: !item.completed
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);
      setDodItems(dodItems.map(d => d.id === item.id ? response.data.data : d));
    } catch (err) {
      console.error('Error toggling DoD item:', err);
      alert('Erro ao atualizar critério: ' + err.message);
    }
  };

  const handleDeleteDodItem = async (itemId) => {
    try {
      const response = await axios.delete(`/api/okrs/dod/${itemId}`, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      setDodItems(dodItems.filter(d => d.id !== itemId));
    } catch (err) {
      console.error('Error deleting DoD item:', err);
      alert('Erro ao excluir critério: ' + err.message);
    }
  };

  // Handler para atualização de peso do KR
  const handleKRWeightChange = (krId, newWeight) => {
    setKeyResults(keyResults.map(kr =>
      kr.id === krId ? { ...kr, peso: newWeight } : kr
    ));
  };

  const { progress, progressVsMetaObj, totalWeight, measuredWeight, statusCounts } = useMemo(() => {
    if (keyResults.length === 0) {
      return { progress: null, progressVsMetaObj: null, totalWeight: 0, measuredWeight: 0, statusCounts: { on_track: 0, at_risk: 0, delayed: 0, completed: 0 } };
    }

    let weightedProgress = 0;
    let weightedProgressVsMeta = 0;
    let measuredW = 0; // Peso dos KRs medidos (usados no cálculo)
    let measuredWMeta = 0; // Peso dos KRs com meta definida
    let totalW = 0;    // Peso total de todos os KRs
    const counts = { on_track: 0, at_risk: 0, delayed: 0, completed: 0 };

    keyResults.forEach(kr => {
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const krProgress = calculateKRProgress(kr, krCheckIns);
      const krProgressVsMeta = calculateKRProgressVsMeta(kr);
      const peso = kr.peso || 1;
      totalW += peso;

      // Ignorar KRs não medidos (progress === null)
      if (krProgress !== null) {
        weightedProgress += krProgress * peso;
        measuredW += peso;
      }

      // Calcular progressVsMeta agregado
      if (krProgressVsMeta !== null) {
        weightedProgressVsMeta += krProgressVsMeta * peso;
        measuredWMeta += peso;
      }

      const status = kr.status || 'on_track';
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });

    return {
      progress: measuredW > 0 ? Math.round(weightedProgress / measuredW) : null,
      progressVsMetaObj: measuredWMeta > 0 ? Math.round(weightedProgressVsMeta / measuredWMeta) : null,
      totalWeight: totalW,
      measuredWeight: measuredW,
      statusCounts: counts,
    };
  }, [keyResults, checkIns]);

  const cycleLabel = objective?.quarter?.toLowerCase().includes('anual')
    ? `Anual ${objective.quarter?.split('-')[1] || ''}`
    : objective?.quarter || 'Q1';

  const isNotMeasured = progress === null;
  const isNotMeasuredMeta = progressVsMetaObj === null;

  const getProgressColor = () => {
    if (isNotMeasured) return 'muted';
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  const getProgressVsMetaColor = () => {
    if (isNotMeasuredMeta) return 'muted';
    if (progressVsMetaObj >= 100) return 'success';
    if (progressVsMetaObj >= 70) return 'warning';
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

      {/* Progress Summary Card - V2 */}
      <section className="okr-section">
        <div className="okr-obj-progress">
          {/* Header: Responsável + Meta/Peso */}
          <div className="okr-obj-progress__header">
            <div className="okr-obj-progress__owner">
              {objective.responsavel_user ? (
                <>
                  {objective.responsavel_user.avatar_url ? (
                    <img src={objective.responsavel_user.avatar_url} alt="" className="okr-obj-progress__avatar" />
                  ) : (
                    <div className="okr-obj-progress__avatar-placeholder">
                      {objective.responsavel_user.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="okr-obj-progress__owner-info">
                    <span className="okr-obj-progress__owner-label">Responsável</span>
                    <span className="okr-obj-progress__owner-name">{objective.responsavel_user.name}</span>
                  </div>
                </>
              ) : objective.responsavel ? (
                <>
                  <div className="okr-obj-progress__avatar-placeholder">
                    {objective.responsavel.charAt(0)}
                  </div>
                  <div className="okr-obj-progress__owner-info">
                    <span className="okr-obj-progress__owner-label">Responsável</span>
                    <span className="okr-obj-progress__owner-name">{objective.responsavel}</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="okr-obj-progress__stats">
              <div className="okr-obj-progress__stat">
                <span className="okr-obj-progress__stat-value">{keyResults.length}</span>
                <span className="okr-obj-progress__stat-label">KRs</span>
              </div>
              <div className="okr-obj-progress__stat">
                <span className="okr-obj-progress__stat-value">{objective.peso || 1}%</span>
                <span className="okr-obj-progress__stat-label">Peso</span>
              </div>
            </div>
          </div>

          {/* Dual Progress Cards */}
          <div className="okr-obj-progress__metrics">
            {/* Ritmo */}
            <div className={`okr-obj-progress__card okr-obj-progress__card--${getProgressColor()}`}>
              <div className="okr-obj-progress__card-header">
                <span className="okr-obj-progress__card-icon">⚡</span>
                <span className="okr-obj-progress__card-title">Ritmo</span>
              </div>
              <span className={`okr-obj-progress__card-value okr-obj-progress__card-value--${getProgressColor()}`}>
                {isNotMeasured ? '—' : `${progress}%`}
              </span>
              <div className="okr-obj-progress__card-bar">
                <div
                  className={`okr-obj-progress__card-bar-fill okr-obj-progress__card-bar-fill--${getProgressColor()}`}
                  style={{ width: `${Math.min(progress || 0, 100)}%` }}
                />
              </div>
              <span className="okr-obj-progress__card-desc">Média ponderada dos KRs</span>
            </div>

            {/* Progresso vs Meta */}
            <div className={`okr-obj-progress__card okr-obj-progress__card--${getProgressVsMetaColor()}`}>
              <div className="okr-obj-progress__card-header">
                <span className="okr-obj-progress__card-icon">🎯</span>
                <span className="okr-obj-progress__card-title">Progresso</span>
              </div>
              <span className={`okr-obj-progress__card-value okr-obj-progress__card-value--${getProgressVsMetaColor()}`}>
                {isNotMeasuredMeta ? '—' : `${progressVsMetaObj}%`}
              </span>
              <div className="okr-obj-progress__card-bar">
                <div
                  className={`okr-obj-progress__card-bar-fill okr-obj-progress__card-bar-fill--${getProgressVsMetaColor()}`}
                  style={{ width: `${Math.min(progressVsMetaObj || 0, 100)}%` }}
                />
              </div>
              <span className="okr-obj-progress__card-desc">Em direção às metas finais</span>
            </div>
          </div>

          {/* Footer: Status badges */}
          <div className="okr-obj-progress__footer">
            <div className="okr-obj-progress__badges">
              {statusCounts.completed > 0 && (
                <span className="okr-obj-progress__badge okr-obj-progress__badge--success">
                  ✓ {statusCounts.completed} concluído{statusCounts.completed > 1 ? 's' : ''}
                </span>
              )}
              {statusCounts.on_track > 0 && (
                <span className="okr-obj-progress__badge okr-obj-progress__badge--info">
                  {statusCounts.on_track} no prazo
                </span>
              )}
              {statusCounts.at_risk > 0 && (
                <span className="okr-obj-progress__badge okr-obj-progress__badge--warning">
                  ⚠ {statusCounts.at_risk} em risco
                </span>
              )}
              {statusCounts.delayed > 0 && (
                <span className="okr-obj-progress__badge okr-obj-progress__badge--danger">
                  ! {statusCounts.delayed} atrasado{statusCounts.delayed > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <span className="okr-obj-progress__weight-info">
              Peso total: <strong>{totalWeight}%</strong>
            </span>
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
                onWeightChange={handleKRWeightChange}
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
              const initDodItems = getDodItemsForInitiative(initiative.id);
              const dodProgress = getDodProgress(initiative.id);
              const plans = getActionPlansForInitiative(initiative.id);
              const completedDod = initDodItems.filter(d => d.completed).length;

              return (
                <div
                  key={initiative.id}
                  className={`initiative-card initiative-card--${initiative.status || 'pending'}`}
                  style={{ animationDelay: `${100 + index * 50}ms` }}
                >
                  {/* Zone A: Status Band */}
                  <div className="initiative-card__status-band">
                    {/* Avatar do responsável */}
                    {initiative.responsible_user ? (
                      <div className="initiative-card__avatar-wrapper">
                        {initiative.responsible_user.avatar_url ? (
                          <img
                            src={initiative.responsible_user.avatar_url}
                            alt={initiative.responsible_user.name}
                            className="initiative-card__avatar"
                          />
                        ) : (
                          <div className="initiative-card__avatar-placeholder">
                            {initiative.responsible_user.name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                    ) : null}
                    <div className="initiative-card__status-indicator" />
                    <span className="initiative-card__status-label">
                      {initiative.status === 'completed' ? 'Concluída' :
                       initiative.status === 'in_progress' ? 'Em Progresso' :
                       initiative.status === 'cancelled' ? 'Cancelada' : 'Pendente'}
                    </span>
                    <span className="initiative-card__status-id">INI-{index + 1}</span>
                    {isPrivileged && (
                      <div className="initiative-card__actions">
                        <button
                          className="initiative-card__action-btn"
                          onClick={() => handleEditInitiative(initiative)}
                          title="Editar"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                        <button
                          className="initiative-card__action-btn initiative-card__action-btn--danger"
                          onClick={() => handleDeleteInitiative(initiative.id)}
                          title="Excluir"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="initiative-card__progress-bar">
                    <div
                      className="initiative-card__progress-fill"
                      style={{ width: `${dodProgress || 0}%` }}
                    />
                  </div>

                  {/* Zone B: Title Block */}
                  <div className="initiative-card__title-block">
                    <h4 className="initiative-card__title">{initiative.title}</h4>
                    {initiative.description && (
                      <p className="initiative-card__description">{initiative.description}</p>
                    )}
                    <div className="initiative-card__meta">
                      <span className="initiative-card__progress-text">
                        {completedDod}/{initDodItems.length} DoD ({dodProgress || 0}%)
                      </span>
                    </div>
                  </div>

                  {/* Zone C: Content with Tabs */}
                  <div className="initiative-card__content">
                    {/* Tab Header with DoD percentage always visible */}
                    <div className="initiative-card__tab-header">
                      <div className="initiative-card__dod-summary">
                        <span className={`initiative-card__dod-percent ${dodProgress >= 100 ? 'initiative-card__dod-percent--complete' : ''}`}>
                          {dodProgress || 0}%
                        </span>
                        <span className="initiative-card__dod-label">DoD completo</span>
                      </div>

                      <div className="initiative-card__tabs">
                        <button
                          className={`initiative-card__tab ${getInitiativeTab(initiative.id) === 'dod' ? 'initiative-card__tab--active' : ''}`}
                          onClick={() => setInitiativeTab(initiative.id, 'dod')}
                        >
                          Definição de Pronto
                        </button>
                        <button
                          className={`initiative-card__tab ${getInitiativeTab(initiative.id) === 'actions' ? 'initiative-card__tab--active' : ''}`}
                          onClick={() => setInitiativeTab(initiative.id, 'actions')}
                        >
                          Plano de Ação + Comentários
                        </button>
                      </div>
                    </div>

                    {/* Tab Content */}
                    <div className="initiative-card__tab-content">
                      {getInitiativeTab(initiative.id) === 'dod' ? (
                        /* DoD Tab Content */
                        <div className="initiative-card__section">
                          <div className="initiative-card__section-header">
                            <div className="initiative-card__section-icon">
                              <svg viewBox="0 0 24 24">
                                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            </div>
                            <h5 className="initiative-card__section-title">Definição de Pronto</h5>
                            <span className="initiative-card__section-count">{completedDod}/{initDodItems.length}</span>
                          </div>

                          {initDodItems.length > 0 ? (
                            <div className="initiative-card__dod-list">
                              {initDodItems.map(item => (
                                <div key={item.id} className={`initiative-card__dod-item ${item.completed ? 'initiative-card__dod-item--completed' : ''}`}>
                                  <button
                                    className="initiative-card__dod-checkbox"
                                    onClick={() => handleToggleDodItem(item)}
                                    title={item.completed ? 'Desmarcar' : 'Marcar como concluído'}
                                  >
                                    {item.completed && (
                                      <svg viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                      </svg>
                                    )}
                                  </button>
                                  <span className={`initiative-card__dod-text ${item.completed ? 'initiative-card__dod-text--completed' : ''}`}>
                                    {item.title}
                                  </span>
                                  {isPrivileged && (
                                    <button
                                      className="initiative-card__dod-delete"
                                      onClick={() => handleDeleteDodItem(item.id)}
                                      title="Excluir"
                                    >
                                      <svg viewBox="0 0 24 24" width="12" height="12">
                                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="initiative-card__dod-empty">Nenhum critério definido.</p>
                          )}

                          {isPrivileged && (
                            <div className="initiative-card__add-dod">
                              <input
                                type="text"
                                placeholder="Adicionar critério..."
                                value={newDodItem}
                                onChange={e => setNewDodItem(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleAddDodItem(initiative.id)}
                              />
                              <button
                                className="initiative-card__add-btn"
                                onClick={() => handleAddDodItem(initiative.id)}
                                disabled={!newDodItem.trim()}
                                title="Adicionar"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14">
                                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Action Plans + Comments Tab Content */
                        <div className="initiative-card__actions-comments">
                          {/* Action Plans Column */}
                          <div className="initiative-card__section">
                            <div className="initiative-card__section-header">
                              <div className="initiative-card__section-icon">
                                <svg viewBox="0 0 24 24">
                                  <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                                </svg>
                              </div>
                              <h5 className="initiative-card__section-title">Planos de Ação</h5>
                              <span className="initiative-card__section-count">{plans.length}</span>
                              {isPrivileged && (
                                <button
                                  className="initiative-card__section-add"
                                  onClick={() => handleCreateActionPlan(initiative.id)}
                                  title="Novo plano"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                  </svg>
                                </button>
                              )}
                            </div>

                            {plans.length > 0 ? (
                              <div className="initiative-card__plans-list">
                                {plans.map(plan => (
                                  <div key={plan.id} className={`initiative-card__plan-item initiative-card__plan-item--${plan.status}`}>
                                    <button
                                      className="initiative-card__plan-checkbox"
                                      onClick={() => handleToggleActionPlanStatus(plan)}
                                      title={plan.status === 'completed' ? 'Marcar como pendente' : 'Marcar como concluído'}
                                    >
                                      {plan.status === 'completed' ? (
                                        <svg viewBox="0 0 24 24" width="16" height="16">
                                          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                        </svg>
                                      ) : (
                                        <svg viewBox="0 0 24 24" width="16" height="16">
                                          <path fill="currentColor" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                                        </svg>
                                      )}
                                    </button>
                                    <div className="initiative-card__plan-content">
                                      <span className={`initiative-card__plan-title ${plan.status === 'completed' ? 'initiative-card__plan-title--completed' : ''}`}>
                                        {plan.title}
                                      </span>
                                      <div className="initiative-card__plan-meta">
                                        {plan.due_date && (
                                          <span className="initiative-card__plan-date">
                                            <svg viewBox="0 0 24 24" width="10" height="10">
                                              <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                                            </svg>
                                            {new Date(plan.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                          </span>
                                        )}
                                        {plan.responsible && (
                                          <span className="initiative-card__plan-responsible">
                                            {plan.responsible.avatar_url ? (
                                              <img src={plan.responsible.avatar_url} alt="" className="initiative-card__plan-avatar" />
                                            ) : (
                                              <svg viewBox="0 0 24 24" width="10" height="10">
                                                <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                                              </svg>
                                            )}
                                            {plan.responsible.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isPrivileged && (
                                      <div className="initiative-card__plan-actions">
                                        <button
                                          className="initiative-card__plan-action-btn"
                                          onClick={() => handleEditActionPlan(plan)}
                                          title="Editar"
                                        >
                                          <svg viewBox="0 0 24 24" width="12" height="12">
                                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                          </svg>
                                        </button>
                                        <button
                                          className="initiative-card__plan-action-btn initiative-card__plan-action-btn--danger"
                                          onClick={() => handleDeleteActionPlan(plan.id)}
                                          title="Excluir"
                                        >
                                          <svg viewBox="0 0 24 24" width="12" height="12">
                                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                          </svg>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="initiative-card__plans-empty">Nenhum plano de ação.</p>
                            )}
                          </div>

                          {/* Comments Column */}
                          <div className="initiative-card__section">
                            <div className="initiative-card__section-header">
                              <div className="initiative-card__section-icon">
                                <svg viewBox="0 0 24 24">
                                  <path fill="currentColor" d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
                                </svg>
                              </div>
                              <h5 className="initiative-card__section-title">Comentários</h5>
                              <span className="initiative-card__section-count">{comments.length}</span>
                            </div>

                            {comments.length > 0 ? (
                              <div className="initiative-card__comments-scroll">
                                {comments.map(comment => (
                                  <div key={comment.id} className="initiative-card__comment">
                                    <div className="initiative-card__comment-header">
                                      <span className="initiative-card__comment-author">{comment.author_name}</span>
                                      <span className="initiative-card__comment-date">
                                        {new Date(comment.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isPrivileged && (
                                        <button
                                          className="initiative-card__comment-delete"
                                          onClick={() => handleDeleteComment(comment.id)}
                                          title="Excluir"
                                        >
                                          <svg viewBox="0 0 24 24" width="12" height="12">
                                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                    <p className="initiative-card__comment-content">{comment.content}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="initiative-card__comments-empty">Nenhum comentário ainda.</p>
                            )}

                            <div className="initiative-card__add-comment">
                              <input
                                type="text"
                                placeholder="Adicionar comentário..."
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyPress={e => e.key === 'Enter' && handleAddComment(initiative.id)}
                              />
                              <button
                                className="initiative-card__send-btn"
                                onClick={() => handleAddComment(initiative.id)}
                                disabled={!newComment.trim()}
                              >
                                Enviar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
        setorId={objective?.setor_id}
      />

      <CreateInitiativeDialog
        open={showCreateInitiativeDialog}
        onClose={() => setShowCreateInitiativeDialog(false)}
        onSuccess={fetchData}
        objectiveId={id}
        setorId={objective?.setor_id}
      />

      <EditInitiativeDialog
        open={showEditInitiativeDialog}
        onClose={() => {
          setShowEditInitiativeDialog(false);
          setSelectedInitiative(null);
        }}
        onSuccess={fetchData}
        initiative={selectedInitiative}
        setorId={objective?.setor_id}
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

      <ActionPlanDialog
        open={showActionPlanDialog}
        onClose={() => {
          setShowActionPlanDialog(false);
          setEditingActionPlan(null);
          setActionPlanInitiativeId(null);
        }}
        onSuccess={(plan, isEditing) => {
          if (isEditing) {
            setActionPlans(actionPlans.map(p => p.id === plan.id ? plan : p));
          } else {
            setActionPlans([...actionPlans, plan]);
          }
        }}
        initiativeId={actionPlanInitiativeId}
        plan={editingActionPlan}
        setorId={objective?.setor_id}
      />
    </div>
  );
}

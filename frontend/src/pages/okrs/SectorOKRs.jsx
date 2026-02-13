import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { calculateKRProgress, calculateKRProgressVsMeta } from '../../utils/indicator-utils';
import './DashboardOKRs.css';

// Objective Card Component
function ObjectiveCard({ objective, checkIns = [], index, editingWeight, setEditingWeight, tempWeight, setTempWeight, onSaveWeight, isPrivileged }) {
  const { progress, progressVsMeta, statusCounts } = useMemo(() => {
    const krs = objective.key_results || [];
    if (krs.length === 0) return { progress: null, progressVsMeta: null, statusCounts: { completed: 0, delayed: 0, at_risk: 0 } };

    let weightedProgress = 0;
    let weightedProgressVsMeta = 0;
    let measuredW = 0;
    let measuredWMeta = 0;
    const counts = { completed: 0, delayed: 0, at_risk: 0 };

    krs.forEach((kr) => {
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const krProgress = calculateKRProgress(kr, krCheckIns);
      const krProgressVsMeta = calculateKRProgressVsMeta(kr);
      const peso = kr.peso || 1;

      // Ritmo: progresso vs planejado acumulado
      if (krProgress !== null) {
        weightedProgress += krProgress * peso;
        measuredW += peso;
      }

      // Progresso: vs meta final
      if (krProgressVsMeta !== null) {
        weightedProgressVsMeta += krProgressVsMeta * peso;
        measuredWMeta += peso;
      }

      if (kr.status === 'completed') counts.completed++;
      else if (kr.status === 'delayed') counts.delayed++;
      else if (kr.status === 'at_risk') counts.at_risk++;
    });

    return {
      progress: measuredW > 0 ? Math.round(weightedProgress / measuredW) : null,
      progressVsMeta: measuredWMeta > 0 ? Math.round(weightedProgressVsMeta / measuredWMeta) : null,
      statusCounts: counts
    };
  }, [objective.key_results, checkIns]);

  const getProgressColor = (value) => {
    if (value === null) return 'muted';
    if (value >= 100) return 'success';
    if (value >= 70) return 'warning';
    return 'danger';
  };

  const cycleLabel = objective.quarter?.toLowerCase().includes('anual')
    ? 'Anual'
    : objective.quarter || 'Q1';

  const responsavelName = objective.responsavel_user?.name || objective.responsavel || null;
  const responsavelAvatar = objective.responsavel_user?.avatar_url || null;

  const handleWeightClick = (e) => {
    if (!isPrivileged) return;
    e.preventDefault();
    e.stopPropagation();
    setEditingWeight(objective.id);
    setTempWeight(objective.peso || 1);
  };

  const handleWeightKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveWeight(objective.id, tempWeight);
    } else if (e.key === 'Escape') {
      setEditingWeight(null);
    }
  };

  const handleWeightBlur = () => {
    onSaveWeight(objective.id, tempWeight);
  };

  return (
    <Link
      to={`/okrs/objetivo/${objective.id}`}
      className={`okr-objective-card okr-objective-card--${getProgressColor(progressVsMeta)}`}
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="okr-objective-card__header">
        <div className="okr-objective-card__badges">
          <span className="okr-objective-card__cycle">{cycleLabel}</span>
          {objective.nivel && (
            <span className="okr-objective-card__level">{objective.nivel}</span>
          )}
        </div>
        <div className="okr-objective-card__meta">
          {responsavelName && (
            <div className="okr-objective-card__avatar" title={responsavelName}>
              {responsavelAvatar ? (
                <img src={responsavelAvatar} alt="" />
              ) : (
                <span>{responsavelName.charAt(0).toUpperCase()}</span>
              )}
            </div>
          )}
          <span className="okr-objective-card__chevron">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </span>
        </div>
      </div>

      <h3 className="okr-objective-card__title">{objective.titulo}</h3>
      {objective.descricao && (
        <p className="okr-objective-card__description">{objective.descricao}</p>
      )}

      {/* Métricas: Ritmo, Progresso, Peso */}
      <div className="okr-objective-card__metrics">
        <div className="okr-objective-card__metric">
          <span className="okr-objective-card__metric-label">Ritmo</span>
          <span className={`okr-objective-card__metric-value okr-objective-card__metric-value--${getProgressColor(progress)}`}>
            {progress === null ? '—' : `${progress}%`}
          </span>
          <div className="okr-objective-card__metric-bar">
            <div
              className={`okr-objective-card__metric-bar-fill okr-objective-card__metric-bar-fill--${getProgressColor(progress)}`}
              style={{ width: `${Math.min(progress || 0, 100)}%` }}
            />
          </div>
        </div>

        <div className="okr-objective-card__metric">
          <span className="okr-objective-card__metric-label">Progresso</span>
          <span className={`okr-objective-card__metric-value okr-objective-card__metric-value--${getProgressColor(progressVsMeta)}`}>
            {progressVsMeta === null ? '—' : `${progressVsMeta}%`}
          </span>
          <div className="okr-objective-card__metric-bar">
            <div
              className={`okr-objective-card__metric-bar-fill okr-objective-card__metric-bar-fill--${getProgressColor(progressVsMeta)}`}
              style={{ width: `${Math.min(progressVsMeta || 0, 100)}%` }}
            />
          </div>
        </div>

        <div className="okr-objective-card__metric">
          <span className="okr-objective-card__metric-label">Peso</span>
          {editingWeight === objective.id ? (
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={tempWeight}
              onChange={(e) => setTempWeight(parseInt(e.target.value) || 1)}
              onBlur={handleWeightBlur}
              onKeyDown={handleWeightKeyDown}
              onClick={(e) => e.preventDefault()}
              autoFocus
              className="okr-weight-input"
            />
          ) : (
            <span
              className={`okr-objective-card__metric-value okr-weight-display ${isPrivileged ? 'okr-weight-display--editable' : ''}`}
              onClick={handleWeightClick}
              title={isPrivileged ? 'Clique para editar' : ''}
            >
              {objective.peso || 1}%
            </span>
          )}
        </div>
      </div>

      {(objective.key_results?.length || 0) > 0 && (
        <div className="okr-objective-card__footer">
          <div className="okr-objective-card__stat">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>{objective.key_results.length} KR{objective.key_results.length !== 1 ? 's' : ''}</span>
          </div>
          {statusCounts.completed > 0 && (
            <div className="okr-objective-card__stat okr-objective-card__stat--success">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              <span>{statusCounts.completed}</span>
            </div>
          )}
          {statusCounts.delayed > 0 && (
            <div className="okr-objective-card__stat okr-objective-card__stat--danger">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <span>{statusCounts.delayed}</span>
            </div>
          )}
          {statusCounts.at_risk > 0 && (
            <div className="okr-objective-card__stat okr-objective-card__stat--warning">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              <span>{statusCounts.at_risk}</span>
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

// Create Objective Dialog
function CreateObjectiveDialog({ open, onClose, onSuccess, defaultSectorId, sectors = [] }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${currentYear}`;

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    nivel: 'time',
    quarter: currentQuarter,
    setor_id: defaultSectorId || null,
    responsavel: '',
    peso: 1
  });

  useEffect(() => {
    if (defaultSectorId) {
      setFormData(prev => ({ ...prev, setor_id: defaultSectorId }));
    }
  }, [defaultSectorId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/okrs', {
        titulo: formData.titulo.trim(),
        nivel: formData.nivel,
        quarter: formData.quarter,
        responsavel: formData.responsavel.trim() || user?.name || 'Não definido',
        peso: formData.peso || 1,
        setor_id: formData.setor_id,
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setFormData({
        titulo: '',
        descricao: '',
        nivel: 'time',
        quarter: currentQuarter,
        setor_id: defaultSectorId || null,
        responsavel: '',
        peso: 1
      });
    } catch (err) {
      console.error('Error creating objective:', err);
      alert('Erro ao criar objetivo: ' + (err.response?.data?.error || err.message));
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
    <div className="okr-modal-overlay">
      <div className="okr-modal">
        <div className="okr-modal__header">
          <h2 className="okr-modal__title">Novo Objetivo do Setor</h2>
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
                placeholder="Ex: Aumentar eficiência operacional"
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Descrição</label>
              <textarea
                className="okr-form-textarea"
                value={formData.descricao}
                onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição detalhada do objetivo..."
                rows={3}
              />
            </div>

            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Ciclo *</label>
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
                <input
                  type="text"
                  className="okr-form-input"
                  value={formData.responsavel}
                  onChange={e => setFormData({ ...formData, responsavel: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="okr-form-group">
                <label className="okr-form-label">Peso do Objetivo</label>
                <input
                  type="number"
                  className="okr-form-input"
                  value={formData.peso}
                  onChange={e => setFormData({ ...formData, peso: parseFloat(e.target.value) || 1 })}
                  min="0.1"
                  max="10"
                  step="0.1"
                  placeholder="1"
                />
                <span className="okr-form-hint">Peso para cálculo do progresso do setor</span>
              </div>
            </div>
          </div>

          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Objetivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SectorOKRs() {
  const { id } = useParams();
  const { isPrivileged } = useAuth();
  const navigate = useNavigate();

  const [sector, setSector] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [weightSum, setWeightSum] = useState({ totalWeight: 0, remaining: 100 });
  const [editingWeight, setEditingWeight] = useState(null);
  const [tempWeight, setTempWeight] = useState(1);

  const currentYear = new Date().getFullYear();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const currentQuarterValue = `${currentQuarter}-${currentYear}`;

  const fetchData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch sector info via API
      const sectorResponse = await axios.get(`/api/ind/sectors/${id}`, { withCredentials: true });
      if (!sectorResponse.data.success) throw new Error(sectorResponse.data.error);

      const sectorData = sectorResponse.data.data;
      setSector(sectorData);

      if (!sectorData) {
        setLoading(false);
        return;
      }

      // Fetch OKRs via API
      const okrsResponse = await axios.get('/api/okrs', { withCredentials: true });
      if (!okrsResponse.data.success) throw new Error(okrsResponse.data.error);

      // Map keyResults to key_results and filter by sector
      const allOkrs = (okrsResponse.data.data || []).map(okr => ({
        ...okr,
        key_results: okr.keyResults || okr.key_results || []
      }));

      // Filter by sector and current year
      const filteredObjectives = allOkrs.filter(obj => {
        if (obj.setor_id !== id) return false;
        if (!obj.quarter) return true;
        return obj.quarter.includes(String(currentYear));
      });

      setObjectives(filteredObjectives);

      // Fetch check-ins for all KRs
      const allKrIds = filteredObjectives.flatMap(obj =>
        (obj.key_results || []).map(kr => kr.id)
      );

      if (allKrIds.length > 0) {
        const checkInsResponse = await axios.get('/api/okrs/check-ins', {
          params: { keyResultIds: allKrIds.join(',') },
          withCredentials: true
        });
        setCheckIns(checkInsResponse.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching sector OKRs:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [id, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch weight sum when sector or objectives change
  useEffect(() => {
    if (id && currentQuarterValue) {
      axios.get(`/api/okrs/sector-weight-sum?setor_id=${id}&quarter=${currentQuarterValue}`, { withCredentials: true })
        .then(res => {
          if (res.data.success) {
            setWeightSum(res.data.data);
          }
        })
        .catch(err => console.error('Erro ao buscar soma de pesos:', err));
    }
  }, [id, currentQuarterValue, objectives]);

  // Função para salvar peso do OKR
  const handleSaveWeight = async (okrId, newWeight) => {
    setEditingWeight(null);
    const weight = parseInt(newWeight) || 1;

    // Atualização otimista
    setObjectives(prev => prev.map(obj =>
      obj.id === okrId ? { ...obj, peso: weight } : obj
    ));

    try {
      await axios.put(`/api/okrs/${okrId}`, { peso: weight }, { withCredentials: true });
      // Refetch weight sum
      const res = await axios.get(`/api/okrs/sector-weight-sum?setor_id=${id}&quarter=${currentQuarterValue}`, { withCredentials: true });
      if (res.data.success) {
        setWeightSum(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao atualizar peso:', err);
      // Reverter em caso de erro
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="okr-dashboard okr-dashboard--loading">
        <div className="okr-loading-pulse">
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
        </div>
        <p className="okr-loading-text">Carregando OKRs do setor...</p>
      </div>
    );
  }

  if (!sector) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Setor não encontrado</p>
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
          <button className="okr-back-btn" onClick={() => navigate('/okrs')}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div>
            <h1 className="okr-header__title">{sector.name}</h1>
            <p className="okr-header__subtitle">
              {currentQuarter} {currentYear} • OKRs do setor
            </p>
          </div>
          {objectives.length > 0 && (
            <div className={`okr-weight-indicator ${weightSum.totalWeight === 100 ? 'okr-weight-indicator--valid' : 'okr-weight-indicator--warning'}`}>
              <span>Soma dos pesos: {weightSum.totalWeight}%</span>
              {weightSum.totalWeight !== 100 && (
                <span className="okr-weight-indicator__warning">
                  {weightSum.totalWeight < 100
                    ? `(faltam ${weightSum.remaining}%)`
                    : `(excede em ${Math.abs(weightSum.remaining)}%)`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="okr-header__actions">
          {isPrivileged && (
            <button
              className="okr-btn okr-btn--primary"
              onClick={() => setShowCreateDialog(true)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Novo OKR
            </button>
          )}
        </div>
      </header>

      {/* Objectives List */}
      <section className="okr-section">
        {objectives.length === 0 ? (
          <div className="okr-empty-state">
            <div className="okr-empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="okr-empty-state__title">Nenhum OKR cadastrado</h3>
            <p className="okr-empty-state__description">
              Nenhum OKR cadastrado para este setor no ciclo atual.
            </p>
            {isPrivileged && (
              <button
                className="okr-btn okr-btn--primary"
                onClick={() => setShowCreateDialog(true)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Criar Primeiro OKR
              </button>
            )}
          </div>
        ) : (
          <div className="okr-objectives-list">
            {objectives.map((objective, index) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                checkIns={checkIns.filter(c =>
                  (objective.key_results || []).some(kr => kr.id === c.key_result_id)
                )}
                index={index}
                editingWeight={editingWeight}
                setEditingWeight={setEditingWeight}
                tempWeight={tempWeight}
                setTempWeight={setTempWeight}
                onSaveWeight={handleSaveWeight}
                isPrivileged={isPrivileged}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create Dialog */}
      <CreateObjectiveDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={fetchData}
        defaultSectorId={id}
      />
    </div>
  );
}

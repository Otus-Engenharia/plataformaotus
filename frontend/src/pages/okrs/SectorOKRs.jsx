import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import './DashboardOKRs.css';

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

// Objective Card Component
function ObjectiveCard({ objective, checkIns = [], index }) {
  const { progress, statusCounts } = useMemo(() => {
    const krs = objective.key_results || [];
    if (krs.length === 0) return { progress: 0, statusCounts: { completed: 0, delayed: 0, at_risk: 0 } };

    let weightedProgress = 0;
    let totalWeight = 0;
    const counts = { completed: 0, delayed: 0, at_risk: 0 };

    krs.forEach((kr) => {
      const krCheckIns = checkIns.filter(c => c.key_result_id === kr.id);
      const krProgress = calculateKRProgress(kr, krCheckIns);
      weightedProgress += krProgress * (kr.peso || 1);
      totalWeight += (kr.peso || 1);

      if (kr.status === 'completed') counts.completed++;
      else if (kr.status === 'delayed') counts.delayed++;
      else if (kr.status === 'at_risk') counts.at_risk++;
    });

    return {
      progress: totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0,
      statusCounts: counts
    };
  }, [objective.key_results, checkIns]);

  const getProgressColor = () => {
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  const cycleLabel = objective.quarter?.toLowerCase().includes('anual')
    ? 'Anual'
    : objective.quarter || 'Q1';

  return (
    <Link
      to={`/okrs/objetivo/${objective.id}`}
      className={`okr-objective-card okr-objective-card--${getProgressColor()}`}
      style={{ animationDelay: `${100 + index * 50}ms` }}
    >
      <div className="okr-objective-card__header">
        <div className="okr-objective-card__badges">
          <span className="okr-objective-card__cycle">{cycleLabel}</span>
          {objective.nivel && (
            <span className="okr-objective-card__level">{objective.nivel}</span>
          )}
        </div>
        <span className="okr-objective-card__chevron">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </span>
      </div>

      <h3 className="okr-objective-card__title">{objective.titulo}</h3>
      {objective.descricao && (
        <p className="okr-objective-card__description">{objective.descricao}</p>
      )}

      <div className="okr-objective-card__progress-section">
        <div className="okr-objective-card__progress-header">
          <span className="okr-objective-card__progress-label">Progresso</span>
          <span className={`okr-objective-card__progress-value okr-objective-card__progress-value--${getProgressColor()}`}>
            {progress}%
          </span>
        </div>
        <div className="okr-objective-card__progress">
          <div
            className={`okr-objective-card__progress-bar okr-objective-card__progress-bar--${getProgressColor()}`}
            style={{ '--progress': `${progress}%` }}
          />
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
    responsavel: ''
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
        responsavel: ''
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
    <div className="okr-modal-overlay" onClick={onClose}>
      <div className="okr-modal" onClick={e => e.stopPropagation()}>
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

  const currentYear = new Date().getFullYear();
  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

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

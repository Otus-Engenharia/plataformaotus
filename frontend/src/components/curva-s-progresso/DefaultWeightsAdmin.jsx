/**
 * Componente: Administração de Pesos Padrão da Curva S
 * Permite editar os pesos globais (Fases, Disciplinas, Etapas)
 * que servem de base para todos os projetos.
 * Acessível apenas por usuários privilegiados em Configurações.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function DefaultWeightsAdmin() {
  const [weights, setWeights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Edit states
  const [phaseEdits, setPhaseEdits] = useState([]);
  const [disciplineEdits, setDisciplineEdits] = useState([]);
  const [activityEdits, setActivityEdits] = useState([]);

  // New item forms
  const [newDiscipline, setNewDiscipline] = useState({ name: '', factor: 1 });
  const [newActivity, setNewActivity] = useState({ name: '', factor: 1 });
  const [showNewDiscipline, setShowNewDiscipline] = useState(false);
  const [showNewActivity, setShowNewActivity] = useState(false);

  const fetchDefaults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/curva-s-progresso/defaults`, {
        withCredentials: true,
      });
      if (res.data.success) {
        const data = res.data.data;
        setWeights(data);
        syncEdits(data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar pesos padrão');
    } finally {
      setLoading(false);
    }
  }, []);

  const syncEdits = (data) => {
    setPhaseEdits(
      (data.phase_weights || []).map(pw => ({
        phase_name: pw.phase_name,
        weight_percent: pw.weight_percent,
        sort_order: pw.sort_order,
      }))
    );
    setDisciplineEdits(
      (data.discipline_weights || []).map(dw => ({
        discipline_name: dw.discipline_name,
        weight_factor: dw.weight_factor,
      }))
    );
    setActivityEdits(
      (data.activity_weights || []).map(aw => ({
        activity_type: aw.activity_type,
        weight_factor: aw.weight_factor,
      }))
    );
  };

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const phaseTotal = useMemo(
    () => phaseEdits.reduce((s, p) => s + (Number(p.weight_percent) || 0), 0),
    [phaseEdits]
  );

  const isPhaseValid = Math.abs(phaseTotal - 100) < 0.01;

  const handlePhaseChange = (idx, value) => {
    const updated = [...phaseEdits];
    updated[idx] = { ...updated[idx], weight_percent: Number(value) };
    setPhaseEdits(updated);
  };

  const handleDisciplineChange = (idx, value) => {
    const updated = [...disciplineEdits];
    updated[idx] = { ...updated[idx], weight_factor: Number(value) };
    setDisciplineEdits(updated);
  };

  const handleActivityChange = (idx, value) => {
    const updated = [...activityEdits];
    updated[idx] = { ...updated[idx], weight_factor: Number(value) };
    setActivityEdits(updated);
  };

  const handleRemoveDiscipline = (idx) => {
    setDisciplineEdits(disciplineEdits.filter((_, i) => i !== idx));
  };

  const handleRemoveActivity = (idx) => {
    setActivityEdits(activityEdits.filter((_, i) => i !== idx));
  };

  const handleAddDiscipline = () => {
    if (!newDiscipline.name.trim()) return;
    const exists = disciplineEdits.some(
      d => d.discipline_name.toLowerCase() === newDiscipline.name.trim().toLowerCase()
    );
    if (exists) {
      alert('Disciplina já existe');
      return;
    }
    setDisciplineEdits([
      ...disciplineEdits,
      { discipline_name: newDiscipline.name.trim(), weight_factor: Number(newDiscipline.factor) || 1 },
    ]);
    setNewDiscipline({ name: '', factor: 1 });
    setShowNewDiscipline(false);
  };

  const handleAddActivity = () => {
    if (!newActivity.name.trim()) return;
    const exists = activityEdits.some(
      a => a.activity_type.toLowerCase() === newActivity.name.trim().toLowerCase()
    );
    if (exists) {
      alert('Etapa já existe');
      return;
    }
    setActivityEdits([
      ...activityEdits,
      { activity_type: newActivity.name.trim(), weight_factor: Number(newActivity.factor) || 1 },
    ]);
    setNewActivity({ name: '', factor: 1 });
    setShowNewActivity(false);
  };

  const handleSave = async () => {
    if (!isPhaseValid) {
      setError('A soma dos pesos das fases deve ser 100%');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload = {
        phase_weights: phaseEdits,
        discipline_weights: disciplineEdits,
        activity_weights: activityEdits,
      };
      const res = await axios.put(`${API_URL}/api/curva-s-progresso/defaults`, payload, {
        withCredentials: true,
      });
      if (res.data.success) {
        setSuccessMsg('Pesos padrão salvos com sucesso');
        setEditMode(false);
        await fetchDefaults();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar pesos padrão');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (weights) syncEdits(weights);
    setEditMode(false);
    setError(null);
    setShowNewDiscipline(false);
    setShowNewActivity(false);
  };

  if (loading) {
    return (
      <div className="default-weights-admin">
        <div className="dwa-loading">Carregando pesos padrão...</div>
      </div>
    );
  }

  return (
    <div className="default-weights-admin">
      <div className="dwa-header">
        <div>
          <h3>Pesos Padrão - Curva S de Progresso</h3>
          <p className="dwa-description">
            Configure os pesos globais que servirão de base para todos os projetos.
            Projetos podem customizar seus próprios pesos a partir destes valores.
          </p>
        </div>
        <div className="dwa-actions">
          {!editMode ? (
            <button className="dwa-btn dwa-btn-primary" onClick={() => setEditMode(true)}>
              Editar Pesos
            </button>
          ) : (
            <>
              <button
                className="dwa-btn dwa-btn-save"
                onClick={handleSave}
                disabled={!isPhaseValid || saving}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="dwa-btn dwa-btn-cancel" onClick={handleCancel}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="dwa-alert dwa-alert-error">{error}</div>}
      {successMsg && <div className="dwa-alert dwa-alert-success">{successMsg}</div>}

      <div className="dwa-grid">
        {/* Fases */}
        <div className="dwa-section">
          <div className="dwa-section-header">
            <h4>Fases do Projeto</h4>
            <span className={`dwa-total ${isPhaseValid ? 'valid' : 'invalid'}`}>
              Total: {phaseTotal.toFixed(1)}%
            </span>
          </div>
          <div className="dwa-section-hint">A soma dos pesos deve ser exatamente 100%</div>
          <table className="dwa-table">
            <thead>
              <tr>
                <th>Fase</th>
                <th className="dwa-col-value">Peso (%)</th>
              </tr>
            </thead>
            <tbody>
              {phaseEdits.map((p, idx) => (
                <tr key={p.phase_name}>
                  <td>{p.phase_name}</td>
                  <td className="dwa-col-value">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={p.weight_percent}
                        onChange={e => handlePhaseChange(idx, e.target.value)}
                        className="dwa-input"
                      />
                    ) : (
                      <span className="dwa-value">{Number(p.weight_percent).toFixed(1)}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isPhaseValid && editMode && (
            <div className="dwa-validation-error">
              Soma deve ser 100% (atual: {phaseTotal.toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Disciplinas */}
        <div className="dwa-section">
          <div className="dwa-section-header">
            <h4>Disciplinas (Fatores)</h4>
            <span className="dwa-count">{disciplineEdits.length} disciplinas</span>
          </div>
          <div className="dwa-section-hint">Fatores relativos entre disciplinas (maior = mais peso)</div>
          <table className="dwa-table">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th className="dwa-col-value">Fator</th>
                {editMode && <th className="dwa-col-action"></th>}
              </tr>
            </thead>
            <tbody>
              {disciplineEdits
                .sort((a, b) => b.weight_factor - a.weight_factor)
                .map((d, idx) => (
                  <tr key={d.discipline_name}>
                    <td>{d.discipline_name}</td>
                    <td className="dwa-col-value">
                      {editMode ? (
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="10"
                          value={d.weight_factor}
                          onChange={e => handleDisciplineChange(
                            disciplineEdits.findIndex(x => x.discipline_name === d.discipline_name),
                            e.target.value
                          )}
                          className="dwa-input"
                        />
                      ) : (
                        <span className="dwa-value">{Number(d.weight_factor).toFixed(1)}</span>
                      )}
                    </td>
                    {editMode && (
                      <td className="dwa-col-action">
                        <button
                          className="dwa-btn-remove"
                          onClick={() => handleRemoveDiscipline(
                            disciplineEdits.findIndex(x => x.discipline_name === d.discipline_name)
                          )}
                          title="Remover"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
          {editMode && (
            <div className="dwa-add-row">
              {showNewDiscipline ? (
                <div className="dwa-add-form">
                  <input
                    type="text"
                    placeholder="Nome da disciplina"
                    value={newDiscipline.name}
                    onChange={e => setNewDiscipline({ ...newDiscipline, name: e.target.value })}
                    className="dwa-input dwa-input-name"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={newDiscipline.factor}
                    onChange={e => setNewDiscipline({ ...newDiscipline, factor: e.target.value })}
                    className="dwa-input"
                  />
                  <button className="dwa-btn dwa-btn-small" onClick={handleAddDiscipline}>Adicionar</button>
                  <button className="dwa-btn dwa-btn-small dwa-btn-cancel" onClick={() => setShowNewDiscipline(false)}>×</button>
                </div>
              ) : (
                <button className="dwa-btn dwa-btn-add" onClick={() => setShowNewDiscipline(true)}>
                  + Adicionar Disciplina
                </button>
              )}
            </div>
          )}
        </div>

        {/* Etapas */}
        <div className="dwa-section">
          <div className="dwa-section-header">
            <h4>Etapas / Atividades (Fatores)</h4>
            <span className="dwa-count">{activityEdits.length} etapas</span>
          </div>
          <div className="dwa-section-hint">Identificadas automaticamente pelo nome da tarefa Level 5</div>
          <table className="dwa-table">
            <thead>
              <tr>
                <th>Etapa</th>
                <th className="dwa-col-value">Fator</th>
                {editMode && <th className="dwa-col-action"></th>}
              </tr>
            </thead>
            <tbody>
              {activityEdits.map((a, idx) => (
                <tr key={a.activity_type}>
                  <td>{a.activity_type}</td>
                  <td className="dwa-col-value">
                    {editMode ? (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={a.weight_factor}
                        onChange={e => handleActivityChange(idx, e.target.value)}
                        className="dwa-input"
                      />
                    ) : (
                      <span className="dwa-value">{Number(a.weight_factor).toFixed(1)}</span>
                    )}
                  </td>
                  {editMode && (
                    <td className="dwa-col-action">
                      <button
                        className="dwa-btn-remove"
                        onClick={() => handleRemoveActivity(idx)}
                        title="Remover"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {editMode && (
            <div className="dwa-add-row">
              {showNewActivity ? (
                <div className="dwa-add-form">
                  <input
                    type="text"
                    placeholder="Nome da etapa"
                    value={newActivity.name}
                    onChange={e => setNewActivity({ ...newActivity, name: e.target.value })}
                    className="dwa-input dwa-input-name"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={newActivity.factor}
                    onChange={e => setNewActivity({ ...newActivity, factor: e.target.value })}
                    className="dwa-input"
                  />
                  <button className="dwa-btn dwa-btn-small" onClick={handleAddActivity}>Adicionar</button>
                  <button className="dwa-btn dwa-btn-small dwa-btn-cancel" onClick={() => setShowNewActivity(false)}>×</button>
                </div>
              ) : (
                <button className="dwa-btn dwa-btn-add" onClick={() => setShowNewActivity(true)}>
                  + Adicionar Etapa
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DefaultWeightsAdmin;

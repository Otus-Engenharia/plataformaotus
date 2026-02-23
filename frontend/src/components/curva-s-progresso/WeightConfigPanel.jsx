/**
 * Componente: Painel de Configuração de Pesos
 * Permite editar pesos de Fases, Disciplinas e Etapas
 */

import React, { useState, useEffect, useMemo } from 'react';

function WeightConfigPanel({ weights, phaseBreakdown, onSave, onReset, loading }) {
  const [editMode, setEditMode] = useState(false);
  const [phaseEdits, setPhaseEdits] = useState({});
  const [disciplineEdits, setDisciplineEdits] = useState({});
  const [activityEdits, setActivityEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState('phases');

  // Sincronizar edits com weights recebidos
  useEffect(() => {
    if (weights) {
      const phases = {};
      for (const pw of weights.phase_weights || []) {
        phases[pw.phase_name] = pw.weight_percent;
      }
      setPhaseEdits(phases);

      const discs = {};
      for (const dw of weights.discipline_weights || []) {
        discs[dw.discipline_name] = dw.weight_factor;
      }
      setDisciplineEdits(discs);

      const acts = {};
      for (const aw of weights.activity_weights || []) {
        acts[aw.activity_type] = aw.weight_factor;
      }
      setActivityEdits(acts);
    }
  }, [weights]);

  const phaseTotal = useMemo(
    () => Object.values(phaseEdits).reduce((s, v) => s + (Number(v) || 0), 0),
    [phaseEdits]
  );

  const isPhaseValid = Math.abs(phaseTotal - 100) < 0.01;

  // Detectar mismatches entre fases configuradas e fases reais do projeto
  const phaseWarnings = useMemo(() => {
    if (!phaseBreakdown || phaseBreakdown.length === 0) return null;
    const configNames = Object.keys(phaseEdits);
    const projectNames = phaseBreakdown.map(p => p.phase_name);
    const configLower = configNames.map(n => n.toLowerCase().trim());
    const projectLower = projectNames.map(n => n.toLowerCase().trim());

    const missingInConfig = projectNames.filter(
      name => !configLower.includes(name.toLowerCase().trim())
    );
    const missingInProject = configNames.filter(
      name => !projectLower.includes(name.toLowerCase().trim())
    );

    if (missingInConfig.length === 0 && missingInProject.length === 0) return null;
    return { missingInConfig, missingInProject };
  }, [phaseEdits, phaseBreakdown]);

  const handleSave = async () => {
    if (!isPhaseValid) return;
    setSaving(true);
    try {
      await onSave({
        phase_weights: phaseEdits,
        discipline_weights: disciplineEdits,
        activity_weights: activityEdits,
      });
      setEditMode(false);
    } catch (err) {
      alert('Erro ao salvar: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Resetar pesos para o padrão global?')) return;
    await onReset();
    setEditMode(false);
  };

  if (!weights) {
    return <div className="weight-config-loading">Carregando pesos...</div>;
  }

  return (
    <div className="weight-config-panel">
      <div className="weight-config-header">
        <h4>Pesos da Curva S</h4>
        <div className="weight-config-actions">
          {weights.is_customized && (
            <span className="customized-badge">Customizado</span>
          )}
          {!editMode ? (
            <button className="btn-edit" onClick={() => setEditMode(true)}>Editar</button>
          ) : (
            <>
              <button className="btn-save" onClick={handleSave} disabled={!isPhaseValid || saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="btn-cancel" onClick={() => setEditMode(false)}>Cancelar</button>
              {weights.is_customized && (
                <button className="btn-reset" onClick={handleReset}>Resetar Padrão</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Seção: Fases */}
      <div className="weight-section">
        <button
          className={`weight-section-toggle ${expandedSection === 'phases' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'phases' ? null : 'phases')}
        >
          <span>Fases do Projeto</span>
          <span className={`phase-total ${isPhaseValid ? 'valid' : 'invalid'}`}>
            {phaseTotal.toFixed(1)}%
          </span>
        </button>
        {expandedSection === 'phases' && (
          <div className="weight-section-content">
            {Object.entries(phaseEdits).map(([name, value]) => (
              <div key={name} className="weight-row">
                <label>{name}</label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={value}
                    onChange={e => setPhaseEdits({ ...phaseEdits, [name]: Number(e.target.value) })}
                  />
                ) : (
                  <span className="weight-value">{Number(value).toFixed(1)}%</span>
                )}
              </div>
            ))}
            {!isPhaseValid && editMode && (
              <div className="weight-error">Soma deve ser 100% (atual: {phaseTotal.toFixed(1)}%)</div>
            )}
            {phaseWarnings && (
              <div className="weight-phase-warnings">
                {phaseWarnings.missingInConfig.length > 0 && (
                  <div className="weight-warning warning-missing-config">
                    Fases do projeto sem configuração: {phaseWarnings.missingInConfig.join(', ')}
                  </div>
                )}
                {phaseWarnings.missingInProject.length > 0 && (
                  <div className="weight-warning warning-missing-project">
                    Fases configuradas sem tarefas no projeto: {phaseWarnings.missingInProject.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seção: Disciplinas */}
      <div className="weight-section">
        <button
          className={`weight-section-toggle ${expandedSection === 'disciplines' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'disciplines' ? null : 'disciplines')}
        >
          <span>Disciplinas (Fatores)</span>
          <span className="section-count">{Object.keys(disciplineEdits).length}</span>
        </button>
        {expandedSection === 'disciplines' && (
          <div className="weight-section-content">
            {Object.entries(disciplineEdits)
              .sort(([, a], [, b]) => b - a)
              .map(([name, value]) => (
                <div key={name} className="weight-row">
                  <label title={name}>{name}</label>
                  {editMode ? (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={value}
                      onChange={e => setDisciplineEdits({ ...disciplineEdits, [name]: Number(e.target.value) })}
                    />
                  ) : (
                    <span className="weight-value">{Number(value).toFixed(1)}</span>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Seção: Etapas */}
      <div className="weight-section">
        <button
          className={`weight-section-toggle ${expandedSection === 'activities' ? 'expanded' : ''}`}
          onClick={() => setExpandedSection(expandedSection === 'activities' ? null : 'activities')}
        >
          <span>Etapas (Fatores)</span>
          <span className="section-count">{Object.keys(activityEdits).length}</span>
        </button>
        {expandedSection === 'activities' && (
          <div className="weight-section-content">
            {Object.entries(activityEdits).map(([name, value]) => (
              <div key={name} className="weight-row">
                <label>{name}</label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={value}
                    onChange={e => setActivityEdits({ ...activityEdits, [name]: Number(e.target.value) })}
                  />
                ) : (
                  <span className="weight-value">{Number(value).toFixed(1)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WeightConfigPanel;

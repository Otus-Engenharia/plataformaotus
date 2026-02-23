/**
 * Componente: ChangeAnnotationEditor
 * Editor inline para anotações do coordenador sobre alterações no changelog.
 * Para DESVIO_PRAZO, permite override do delta de dias e data de término.
 */

import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function ChangeAnnotationEditor({ projectCode, change, monthPair, onSaved, onCancel }) {
  const existing = change.annotation;
  const [description, setDescription] = useState(existing?.description || '');
  const [justification, setJustification] = useState(existing?.justification || '');
  const [isVisible, setIsVisible] = useState(existing?.is_visible ?? true);
  const [overrideDeltaDays, setOverrideDeltaDays] = useState(
    existing?.override_delta_days ?? ''
  );
  const [overrideDataTermino, setOverrideDataTermino] = useState(
    existing?.override_data_termino ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isDesvio = change.type === 'DESVIO_PRAZO';
  const originalDelta = change.original_delta_days ?? change.delta_days;
  const originalTermino = change.original_data_termino ?? change.curr_data_termino;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/changelog/annotation`,
        {
          from_snapshot_date: monthPair.from_snapshot,
          to_snapshot_date: monthPair.to_snapshot,
          change_type: change.type,
          task_name: change.task_name,
          disciplina: change.disciplina,
          description: description || null,
          justification: justification || null,
          is_visible: isVisible,
          override_delta_days: overrideDeltaDays !== '' ? Number(overrideDeltaDays) : null,
          override_data_termino: overrideDataTermino || null,
        },
        { withCredentials: true }
      );
      onSaved();
    } catch (err) {
      console.error('Erro ao salvar anotação:', err);
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="changelog-annotation-editor">
      <div className="changelog-editor-field">
        <label>Descrição (visível ao cliente)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ex: Atraso devido a chuvas intensas"
          rows={2}
          disabled={saving}
        />
      </div>
      <div className="changelog-editor-field">
        <label>Justificativa (interno)</label>
        <textarea
          value={justification}
          onChange={e => setJustification(e.target.value)}
          placeholder="Ex: Cliente solicitou alteração de layout"
          rows={2}
          disabled={saving}
        />
      </div>

      {isDesvio && (
        <div className="changelog-editor-override-section">
          <div className="changelog-editor-override-label">
            Correção de Prazo
          </div>
          <div className="changelog-editor-override-fields">
            <div className="changelog-editor-field changelog-editor-field-inline">
              <label>Delta dias corrigido</label>
              <input
                type="number"
                value={overrideDeltaDays}
                onChange={e => setOverrideDeltaDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Detectado: ${originalDelta > 0 ? '+' : ''}${originalDelta}`}
                disabled={saving}
                className="changelog-override-input"
              />
            </div>
            <div className="changelog-editor-field changelog-editor-field-inline">
              <label>Data término corrigida</label>
              <input
                type="date"
                value={overrideDataTermino}
                onChange={e => setOverrideDataTermino(e.target.value)}
                disabled={saving}
                className="changelog-override-input"
              />
            </div>
          </div>
          <div className="changelog-editor-override-hint">
            Detectado: {originalDelta > 0 ? '+' : ''}{originalDelta} dias
            {originalTermino ? `, término ${originalTermino}` : ''}
          </div>
        </div>
      )}

      <div className="changelog-editor-row">
        <label className="changelog-editor-checkbox">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={e => setIsVisible(e.target.checked)}
            disabled={saving}
          />
          Visível para o cliente
        </label>
        <div className="changelog-editor-actions">
          <button
            className="changelog-btn changelog-btn-secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            className="changelog-btn changelog-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
      {error && <div className="changelog-editor-error">{error}</div>}
    </div>
  );
}

export default ChangeAnnotationEditor;

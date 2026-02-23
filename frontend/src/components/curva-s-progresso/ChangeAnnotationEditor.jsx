/**
 * Componente: ChangeAnnotationEditor
 * Editor inline para anotações do coordenador sobre alterações no changelog.
 */

import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function ChangeAnnotationEditor({ projectCode, change, monthPair, onSaved, onCancel }) {
  const existing = change.annotation;
  const [description, setDescription] = useState(existing?.description || '');
  const [justification, setJustification] = useState(existing?.justification || '');
  const [isVisible, setIsVisible] = useState(existing?.is_visible ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

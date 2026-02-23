/**
 * Componente: Formulário de Relato
 *
 * Modal para criar ou editar um relato.
 */

import React, { useState } from 'react';

function RelatoForm({ tipos, prioridades, relato, onSave, onClose }) {
  const isEditing = !!relato;

  const [tipo, setTipo] = useState(relato?.tipo_slug || (tipos[0]?.slug || ''));
  const [prioridade, setPrioridade] = useState(relato?.prioridade_slug || (prioridades[0]?.slug || ''));
  const [titulo, setTitulo] = useState(relato?.titulo || '');
  const [descricao, setDescricao] = useState(relato?.descricao || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError('Título é obrigatório');
      return;
    }
    if (!descricao.trim()) {
      setError('Descrição é obrigatória');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        tipo,
        prioridade,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      });
    } catch (err) {
      setError(err.message || 'Erro ao salvar relato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relato-form-overlay" onClick={onClose}>
      <div className="relato-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="relato-form-header">
          <h3>{isEditing ? 'Editar Relato' : 'Novo Relato'}</h3>
          <button className="relato-form-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="relato-form-body">
          {error && <div className="relato-form-error">{error}</div>}

          <div className="relato-form-row">
            <div className="relato-form-field">
              <label>Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {tipos.map(t => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="relato-form-field">
              <label>Prioridade</label>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {prioridades.map(p => (
                  <option key={p.slug} value={p.slug}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="relato-form-field">
            <label>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título do relato"
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="relato-form-field">
            <label>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o relato em detalhes..."
              rows={5}
            />
          </div>

          <div className="relato-form-actions">
            <button type="button" className="relato-form-btn-cancel" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="relato-form-btn-save" disabled={saving}>
              {saving ? 'Salvando...' : (isEditing ? 'Salvar' : 'Criar Relato')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RelatoForm;

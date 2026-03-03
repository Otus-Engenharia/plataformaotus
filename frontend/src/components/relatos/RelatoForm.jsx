/**
 * Componente: Formulário de Relato
 *
 * Modal para criar ou editar um relato.
 * Suporta link opcional com apontamento Construflow.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function RelatoForm({ tipos, prioridades, relato, construflowId, onSave, onClose }) {
  const isEditing = !!relato;

  const [tipo, setTipo] = useState(relato?.tipo_slug || (tipos[0]?.slug || ''));
  const [prioridade, setPrioridade] = useState(relato?.prioridade_slug || (prioridades[0]?.slug || ''));
  const [titulo, setTitulo] = useState(relato?.titulo || '');
  const [descricao, setDescricao] = useState(relato?.descricao || '');
  const [construflowIssueCode, setConstruflowIssueCode] = useState(relato?.construflow_issue_code || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Apontamentos Construflow
  const [apontamentos, setApontamentos] = useState([]);
  const [loadingApontamentos, setLoadingApontamentos] = useState(false);

  useEffect(() => {
    if (construflowId) {
      fetchApontamentos();
    }
  }, [construflowId]);

  const fetchApontamentos = async () => {
    setLoadingApontamentos(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/projetos/apontamentos?construflowId=${encodeURIComponent(construflowId)}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setApontamentos(res.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao buscar apontamentos:', err);
    } finally {
      setLoadingApontamentos(false);
    }
  };

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
        construflow_issue_code: construflowIssueCode || null,
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

          {construflowId && (
            <div className="relato-form-field">
              <label>Apontamento Construflow (opcional)</label>
              <select
                value={construflowIssueCode}
                onChange={(e) => setConstruflowIssueCode(e.target.value)}
              >
                <option value="">Nenhum</option>
                {loadingApontamentos ? (
                  <option disabled>Carregando...</option>
                ) : (
                  apontamentos.map(a => (
                    <option key={a.code || a.id} value={a.code}>
                      {a.code} - {a.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

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

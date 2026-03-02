import React, { useState, useEffect, useCallback } from 'react';
import './RelatoCreateDialog.css';

export default function RelatoCreateDialog({
  projects,
  tipos,
  prioridades,
  userTeamName,
  onSave,
  onClose,
}) {
  const [showMyProjects, setShowMyProjects] = useState(!!userTeamName);
  const [projectCode, setProjectCode] = useState('');
  const [tipo, setTipo] = useState('');
  const [prioridade, setPrioridade] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tipos.length > 0 && !tipo) setTipo(tipos[0].slug);
    if (prioridades.length > 0 && !prioridade) setPrioridade(prioridades[0].slug);
  }, [tipos, prioridades]);

  const filteredProjects = showMyProjects && userTeamName
    ? projects.filter(p => p.nome_time === userTeamName)
    : projects;

  const sortedProjects = [...filteredProjects].sort((a, b) =>
    (a.project_name || a.project_code_norm || '').localeCompare(
      b.project_name || b.project_code_norm || '', 'pt-BR'
    )
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!projectCode) {
      setError('Selecione um projeto');
      return;
    }
    if (!titulo.trim()) {
      setError('Titulo é obrigatório');
      return;
    }
    if (!descricao.trim()) {
      setError('Descrição é obrigatória');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        project_code: projectCode,
        tipo,
        prioridade,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      });
    } catch (err) {
      setError(err.message || 'Erro ao criar relato');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relato-create-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="relato-create-dialog" onSubmit={handleSubmit}>
        <h2 className="relato-create-dialog__title">Novo Relato</h2>

        {error && <div className="relato-create-dialog__error">{error}</div>}

        {/* Projeto com toggle Meus Projetos / Todos */}
        <div className="relato-create-dialog__field">
          <div className="relato-create-dialog__project-header">
            <label htmlFor="relato-project">Projeto</label>
            <div className="relato-create-dialog__project-toggle">
              <button
                type="button"
                className={`relato-create-dialog__toggle-btn${showMyProjects ? ' is-active' : ''}`}
                onClick={() => setShowMyProjects(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Meus Projetos
              </button>
              <button
                type="button"
                className={`relato-create-dialog__toggle-btn${!showMyProjects ? ' is-active' : ''}`}
                onClick={() => setShowMyProjects(false)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Todos
              </button>
            </div>
          </div>
          <select
            id="relato-project"
            value={projectCode}
            onChange={(e) => setProjectCode(e.target.value)}
          >
            <option value="">Selecione um projeto</option>
            {sortedProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.comercial_name
                  ? `${p.project_code_norm} (${p.comercial_name})`
                  : p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo + Prioridade */}
        <div className="relato-create-dialog__row">
          <div className="relato-create-dialog__field">
            <label htmlFor="relato-tipo">Tipo</label>
            <select
              id="relato-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              {tipos.map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="relato-create-dialog__field">
            <label htmlFor="relato-prioridade">Prioridade</label>
            <select
              id="relato-prioridade"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
            >
              {prioridades.map(p => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Titulo */}
        <div className="relato-create-dialog__field">
          <label htmlFor="relato-titulo">Titulo</label>
          <input
            id="relato-titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Titulo do relato"
            maxLength={255}
            autoFocus
          />
        </div>

        {/* Descricao */}
        <div className="relato-create-dialog__field">
          <label htmlFor="relato-descricao">Descrição</label>
          <textarea
            id="relato-descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o relato em detalhes..."
            rows={5}
          />
        </div>

        {/* Footer */}
        <div className="relato-create-dialog__footer">
          <button
            type="button"
            className="relato-create-dialog__btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="relato-create-dialog__btn-save"
            disabled={saving}
          >
            {saving ? 'Criando...' : 'Criar Relato'}
          </button>
        </div>
      </form>
    </div>
  );
}

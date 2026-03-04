/**
 * Componente: Sub-abas de Lookup para Nomenclatura
 *
 * Exibe tabelas auxiliares de siglas (De-Para) como sub-abas inline,
 * uma aba por parâmetro configurado no padrão de nomenclatura.
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/NomenclaturaLookupTabs.css';

const IMPORTABLE_PARAMS = ['DISCIPLINA', 'FASE'];

const PARAM_LABELS = {
  DISCIPLINA: 'Disciplina',
  FASE: 'Fase',
  SETOR: 'Setor',
  CONTEUDO: 'Conteúdo',
  TORRE: 'Torre/Posição',
  PRANCHA: 'Nº da Prancha',
  COMPLEMENTO: 'Complemento',
  LOCAL: 'Localização',
  PAV: 'Pavimento',
  BLOCO: 'Bloco',
  SEGMENTO: 'Segmento',
  NUM: 'Número',
};

function getParamLabel(name) {
  return PARAM_LABELS[name] || name;
}

/**
 * Conteúdo de uma aba individual — tabela CRUD de siglas
 */
function LookupTabContent({ projectCode, paramName, charCount, initialEntries, canEdit, onSaved, onCharCountChange }) {
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newAbbreviation, setNewAbbreviation] = useState('');

  useEffect(() => {
    setEntries(initialEntries.map((e, i) => ({
      full_name: e.full_name,
      abbreviation: e.abbreviation,
      sort_order: e.sort_order ?? i,
    })));
    setHasChanges(false);
    setMsg(null);
  }, [initialEntries]);

  const importable = IMPORTABLE_PARAMS.includes(paramName);

  const handleAdd = () => {
    const fullName = newFullName.trim();
    const abbr = newAbbreviation.trim().toUpperCase();
    if (!fullName || !abbr) return;

    if (entries.some(e => e.abbreviation === abbr)) {
      setMsg({ type: 'error', text: `Sigla "${abbr}" já existe` });
      return;
    }

    setEntries(prev => [...prev, { full_name: fullName, abbreviation: abbr, sort_order: prev.length }]);
    setNewFullName('');
    setNewAbbreviation('');
    setHasChanges(true);
    setMsg(null);
  };

  const handleRemove = (index) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setMsg(null);
  };

  const handleEditFullName = (index, value) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, full_name: value } : e));
    setHasChanges(true);
    setMsg(null);
  };

  const handleEditAbbreviation = (index, value) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, abbreviation: value.toUpperCase() } : e));
    setHasChanges(true);
    setMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await axios.put(
        `${API_URL}/api/nomenclatura/${projectCode}/lookups/${paramName}`,
        { entries },
        { withCredentials: true }
      );
      setMsg({ type: 'ok', text: 'Siglas salvas!' });
      setHasChanges(false);
      onSaved(paramName, entries);
    } catch (err) {
      console.error('Erro ao salvar siglas:', err);
      setMsg({ type: 'error', text: err.response?.data?.error || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setMsg(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/nomenclatura/${projectCode}/lookups/${paramName}/import`,
        { char_count: charCount },
        { withCredentials: true }
      );
      const imported = res.data?.data?.entries || [];
      if (imported.length === 0) {
        setMsg({ type: 'warn', text: 'Nenhum dado encontrado na plataforma.' });
        return;
      }
      setEntries(imported);
      setHasChanges(true);
      setMsg({ type: 'ok', text: `${imported.length} itens importados. Edite e salve.` });
    } catch (err) {
      console.error('Erro ao importar:', err);
      setMsg({ type: 'error', text: err.response?.data?.error || 'Erro ao importar' });
    } finally {
      setImporting(false);
    }
  };

  const inconsistentCount = charCount
    ? entries.filter(e => e.abbreviation.length !== charCount).length
    : 0;

  return (
    <div className="nlt-content">
      {/* Header da tab */}
      <div className="nlt-content-header">
        <div className="nlt-content-header-left">
          <span className="nlt-param-name">{getParamLabel(paramName)}</span>
          <div className="nlt-char-count-group">
            <label className="nlt-char-count-label">Nº caracteres:</label>
            {canEdit ? (
              <input
                type="number"
                className="nlt-char-count-input"
                value={charCount || ''}
                placeholder="—"
                min={1}
                max={20}
                onChange={e => onCharCountChange(paramName, parseInt(e.target.value) || null)}
              />
            ) : (
              <span className="nlt-char-count-display">{charCount || '—'}</span>
            )}
          </div>
        </div>
        <div className="nlt-content-header-right">
          {canEdit && importable && (
            <button
              type="button"
              className="nlt-import-btn"
              onClick={handleImport}
              disabled={importing}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {importing ? 'Importando...' : 'Importar da plataforma'}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className={`nlt-save-btn ${hasChanges ? 'nlt-save-btn--active' : ''}`}
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? 'Salvando...' : 'Salvar siglas'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {msg && (
        <div className={`nlt-msg nlt-msg--${msg.type}`}>{msg.text}</div>
      )}
      {inconsistentCount > 0 && (
        <div className="nlt-msg nlt-msg--warn">
          {inconsistentCount} sigla(s) com tamanho diferente de {charCount} caracteres
        </div>
      )}

      {/* Table */}
      <div className="nlt-table-wrap">
        <table className="nlt-table">
          <thead>
            <tr>
              <th className="nlt-th-name">Nome Completo</th>
              <th className="nlt-th-abbr">Sigla</th>
              {canEdit && <th className="nlt-th-actions"></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i} className={charCount && entry.abbreviation.length !== charCount ? 'nlt-row--warn' : ''}>
                <td>
                  {canEdit ? (
                    <input
                      className="nlt-cell-input"
                      value={entry.full_name}
                      onChange={e => handleEditFullName(i, e.target.value)}
                      placeholder="Nome completo"
                    />
                  ) : (
                    <span>{entry.full_name}</span>
                  )}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="nlt-cell-input nlt-cell-abbr"
                      value={entry.abbreviation}
                      onChange={e => handleEditAbbreviation(i, e.target.value)}
                      placeholder="Sigla"
                    />
                  ) : (
                    <code className="nlt-abbr-display">{entry.abbreviation}</code>
                  )}
                </td>
                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className="nlt-remove-btn"
                      onClick={() => handleRemove(i)}
                      title="Remover"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 3 : 2} className="nlt-empty">
                  Nenhuma sigla configurada.
                  {importable && ' Use "Importar da plataforma" para começar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      {canEdit && (
        <div className="nlt-add-row">
          <input
            className="nlt-add-input nlt-add-name"
            value={newFullName}
            onChange={e => setNewFullName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nome completo"
          />
          <input
            className="nlt-add-input nlt-add-abbr"
            value={newAbbreviation}
            onChange={e => setNewAbbreviation(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Sigla"
          />
          <button
            type="button"
            className="nlt-add-btn"
            onClick={handleAdd}
            disabled={!newFullName.trim() || !newAbbreviation.trim()}
          >
            + Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Componente principal: NomenclaturaLookupTabs
 */
function NomenclaturaLookupTabs({ projectCode, segments, lookups, canEdit, onLookupSaved, onCharCountChange }) {
  // Extrair nomes únicos de parâmetros (mantendo ordem de aparição)
  const paramNames = useMemo(() => {
    const seen = new Set();
    const names = [];
    for (const seg of segments) {
      if (seg.type === 'param' && !seen.has(seg.name)) {
        seen.add(seg.name);
        names.push(seg.name);
      }
    }
    return names;
  }, [segments]);

  const [activeTab, setActiveTab] = useState(null);

  // Sincronizar tab ativa quando paramNames mudar
  useEffect(() => {
    if (paramNames.length > 0 && (!activeTab || !paramNames.includes(activeTab))) {
      setActiveTab(paramNames[0]);
    }
  }, [paramNames, activeTab]);

  // Buscar char_count do segmento ativo
  const activeSegment = segments.find(s => s.type === 'param' && s.name === activeTab);
  const activeCharCount = activeSegment?.char_count || null;

  if (paramNames.length === 0) {
    return null;
  }

  return (
    <div className="nlt-container">
      <h4 className="nlt-section-title">Tabelas Auxiliares de Siglas</h4>

      {/* Tab buttons */}
      <div className="nlt-tabs">
        {paramNames.map(name => {
          const count = lookups[name]?.length || 0;
          return (
            <button
              key={name}
              type="button"
              className={`nlt-tab ${activeTab === name ? 'nlt-tab--active' : ''}`}
              onClick={() => setActiveTab(name)}
            >
              {getParamLabel(name)}
              {count > 0 && <span className="nlt-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab && (
        <LookupTabContent
          key={activeTab}
          projectCode={projectCode}
          paramName={activeTab}
          charCount={activeCharCount}
          initialEntries={lookups[activeTab] || []}
          canEdit={canEdit}
          onSaved={onLookupSaved}
          onCharCountChange={onCharCountChange}
        />
      )}
    </div>
  );
}

export default NomenclaturaLookupTabs;

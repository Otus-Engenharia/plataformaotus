/**
 * Componente: Painel de Nomenclatura de Arquivos
 *
 * Permite configurar os padrões de nomenclatura de modelos (IFC/RVT) e pranchas (DWG/PDF)
 * para cada projeto. Inclui builder de segmentos e validação contra arquivos IFC.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/NomenclaturaPanel.css';

// Catálogo de parâmetros disponíveis
const PARAM_CATALOG = [
  { id: 'DISCIPLINA', name: 'Disciplina', description: 'Sigla da disciplina (ARQ, EST, HID...)' },
  { id: 'FASE', name: 'Fase', description: 'Fase do projeto (EP, AP, PE, EX, LO)' },
  { id: 'TORRE', name: 'Torre/Posição', description: 'Segmento/torre (1A, 1B, HT...)' },
  { id: 'PRANCHA', name: 'Nº da Prancha', description: 'Número da folha (001, 002...)' },
  { id: 'COMPLEMENTO', name: 'Complemento', description: 'Tipo/nome do arquivo (Térreo, Tipo...)' },
  { id: 'LOCAL', name: 'Localização', description: 'Local ou pavimento' },
  { id: 'PAV', name: 'Pavimento', description: 'Pavimento do edifício' },
  { id: 'BLOCO', name: 'Bloco', description: 'Bloco do edifício' },
  { id: 'SEGMENTO', name: 'Segmento', description: 'Segmento do projeto' },
  { id: 'NUM', name: 'Número', description: 'Número genérico' },
];

const SEPARATORS = [
  { value: '-', label: 'Hífen (-)' },
  { value: '_', label: 'Underline (_)' },
  { value: '.', label: 'Ponto (.)' },
];

const DEFAULT_SEPARATOR = '-';

/**
 * Gera a string template a partir dos segmentos
 */
function buildTemplate(segments) {
  return segments.map((seg, i) => {
    const sep = i === 0 ? '' : (seg.separator || DEFAULT_SEPARATOR);
    if (seg.type === 'fixed') return sep + seg.value;
    if (seg.type === 'revision') return sep + 'RXX';
    return sep + seg.name;
  }).join('');
}

/**
 * Componente de um segmento individual
 */
function SegmentCard({ segment, index, total, onMove, onRemove, onChange, canEdit }) {
  const [editing, setEditing] = useState(false);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const handleSeparatorChange = (sep) => {
    onChange({ ...segment, separator: sep });
  };

  const handleValueChange = (value) => {
    onChange({ ...segment, value });
  };

  function getTypeLabel() {
    if (segment.type === 'fixed') return 'Fixo';
    if (segment.type === 'revision') return 'Revisão';
    return PARAM_CATALOG.find(p => p.id === segment.name)?.name || segment.name;
  }

  function getTypeColor() {
    if (segment.type === 'fixed') return 'nom-seg--fixed';
    if (segment.type === 'revision') return 'nom-seg--revision';
    return 'nom-seg--param';
  }

  const typeLabel = getTypeLabel();
  const typeColor = getTypeColor();

  return (
    <div className={`nom-segment-card ${typeColor}`}>
      <div className="nom-segment-header">
        {!isFirst && (
          <select
            className="nom-sep-select"
            value={segment.separator || DEFAULT_SEPARATOR}
            onChange={e => handleSeparatorChange(e.target.value)}
            disabled={!canEdit}
            title="Separador antes deste segmento"
          >
            {SEPARATORS.map(s => (
              <option key={s.value} value={s.value}>{s.value}</option>
            ))}
          </select>
        )}

        <div className="nom-segment-body">
          <span className="nom-segment-type-badge">
            {segment.type === 'fixed' && 'FIXO'}
            {segment.type === 'revision' && 'REV'}
            {segment.type === 'param' && 'PARAM'}
          </span>

          {segment.type === 'fixed' && editing ? (
            <input
              className="nom-segment-input"
              value={segment.value || ''}
              onChange={e => handleValueChange(e.target.value.toUpperCase())}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              autoFocus
              placeholder="Texto fixo"
            />
          ) : (
            <span
              className="nom-segment-label"
              onClick={() => segment.type === 'fixed' && canEdit && setEditing(true)}
              title={segment.type === 'fixed' ? 'Clique para editar' : ''}
            >
              {segment.type === 'fixed' && (segment.value || '???')}
              {segment.type === 'revision' && 'RXX'}
              {segment.type === 'param' && typeLabel}
            </span>
          )}
        </div>

        {canEdit && (
          <div className="nom-segment-actions">
            <button
              type="button"
              className="nom-btn-icon"
              onClick={() => onMove(index, -1)}
              disabled={isFirst}
              title="Mover para cima"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="nom-btn-icon"
              onClick={() => onMove(index, 1)}
              disabled={isLast}
              title="Mover para baixo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="nom-btn-icon nom-btn-icon--danger"
              onClick={() => onRemove(index)}
              title="Remover"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Builder de segmentos para um tipo (modelos ou pranchas)
 */
function SegmentBuilder({ tipo, label, segments, onSegmentsChange, canEdit }) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const template = useMemo(() => buildTemplate(segments), [segments]);

  const handleMove = (index, direction) => {
    const newSegs = [...segments];
    const target = index + direction;
    if (target < 0 || target >= newSegs.length) return;
    [newSegs[index], newSegs[target]] = [newSegs[target], newSegs[index]];
    // O primeiro segmento nunca tem separador
    if (newSegs[0]) newSegs[0] = { ...newSegs[0], separator: '' };
    // Se o segundo segmento ficou sem separador (ex: veio da posição 0), atribuir o padrão
    if (newSegs[1] && !newSegs[1].separator) {
      newSegs[1] = { ...newSegs[1], separator: DEFAULT_SEPARATOR };
    }
    onSegmentsChange(newSegs);
  };

  const handleRemove = (index) => {
    const newSegs = segments.filter((_, i) => i !== index);
    if (newSegs[0]) newSegs[0] = { ...newSegs[0], separator: '' };
    onSegmentsChange(newSegs);
  };

  const handleChange = (index, updated) => {
    const newSegs = [...segments];
    newSegs[index] = updated;
    onSegmentsChange(newSegs);
  };

  const addSegment = (type, paramId = null) => {
    const sep = segments.length === 0 ? '' : DEFAULT_SEPARATOR;
    let newSeg;
    if (type === 'fixed') {
      newSeg = { type: 'fixed', value: '', separator: sep };
    } else if (type === 'revision') {
      newSeg = { type: 'revision', separator: sep };
    } else {
      newSeg = { type: 'param', name: paramId, separator: sep };
    }
    onSegmentsChange([...segments, newSeg]);
    setShowAddMenu(false);
  };

  return (
    <div className="nom-builder">
      <div className="nom-builder-header">
        <h4 className="nom-builder-title">{label}</h4>
        {segments.length > 0 && (
          <div className="nom-preview">
            <span className="nom-preview-label">Preview:</span>
            <code className="nom-preview-code">{template}</code>
          </div>
        )}
      </div>

      {segments.length === 0 ? (
        <div className="nom-empty">
          <p>Nenhum segmento configurado.</p>
        </div>
      ) : (
        <div className="nom-segments-list">
          {segments.map((seg, i) => (
            <SegmentCard
              key={`${tipo}-${i}`}
              segment={seg}
              index={i}
              total={segments.length}
              onMove={handleMove}
              onRemove={handleRemove}
              onChange={(updated) => handleChange(i, updated)}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="nom-add-container">
          <button
            type="button"
            className="nom-btn-add"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Adicionar segmento
          </button>

          {showAddMenu && (
            <div className="nom-add-menu">
              <div className="nom-add-menu-section">
                <span className="nom-add-menu-label">Texto Fixo</span>
                <button type="button" onClick={() => addSegment('fixed')}>
                  Texto fixo (código, prefixo...)
                </button>
              </div>
              <div className="nom-add-menu-section">
                <span className="nom-add-menu-label">Parâmetros</span>
                {PARAM_CATALOG.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addSegment('param', p.id)}
                    title={p.description}
                  >
                    {p.name}
                    <span className="nom-add-menu-desc">{p.description}</span>
                  </button>
                ))}
              </div>
              <div className="nom-add-menu-section">
                <span className="nom-add-menu-label">Revisão</span>
                <button type="button" onClick={() => addSegment('revision')}>
                  Revisão (RXX)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Seção de validação de IFCs
 */
function ValidationSection({ projectCode }) {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runValidation = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/nomenclatura/${projectCode}/validate`,
        { withCredentials: true }
      );
      setValidation(res.data?.data || null);
    } catch (err) {
      console.error('Erro ao validar:', err);
      setValidation(null);
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  if (!projectCode) return null;

  return (
    <div className="nom-validation">
      <div className="nom-validation-header">
        <h4 className="nom-validation-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Validação de Arquivos IFC
        </h4>
        <button
          type="button"
          className="nom-btn-validate"
          onClick={runValidation}
          disabled={loading}
        >
          {loading ? 'Validando...' : 'Validar'}
        </button>
      </div>

      {validation && !validation.configured && (
        <p className="nom-validation-msg">Configure o padrão de modelos para habilitar a validação.</p>
      )}

      {validation && validation.configured && validation.total === 0 && (
        <p className="nom-validation-msg">Nenhum arquivo IFC encontrado para este projeto.</p>
      )}

      {validation && validation.configured && validation.total > 0 && (
        <>
          <div className="nom-validation-summary">
            <div className="nom-validation-stat">
              <span className="nom-stat-number">{validation.total}</span>
              <span className="nom-stat-label">Total</span>
            </div>
            <div className="nom-validation-stat nom-stat--ok">
              <span className="nom-stat-number">{validation.conformes}</span>
              <span className="nom-stat-label">Conformes</span>
            </div>
            <div className="nom-validation-stat nom-stat--error">
              <span className="nom-stat-number">{validation.naoConformes}</span>
              <span className="nom-stat-label">Não conformes</span>
            </div>
          </div>

          <button
            type="button"
            className="nom-btn-expand"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Ocultar detalhes' : 'Ver detalhes'}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {expanded && (
            <div className="nom-validation-list">
              {validation.arquivos.map((arq, i) => (
                <div key={i} className={`nom-file-item ${arq.conforme ? 'nom-file--ok' : 'nom-file--error'}`}>
                  <span className="nom-file-icon">
                    {arq.conforme ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    )}
                  </span>
                  <span className="nom-file-name">{arq.fileName}</span>
                  {arq.erros.length > 0 && (
                    <span className="nom-file-errors">
                      {arq.erros.join('; ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Componente principal: NomenclaturaPanel
 */
function NomenclaturaPanel({ projectCode }) {
  const { canEditPortfolio } = useAuth();
  const [modelosSegments, setModelosSegments] = useState([]);
  const [pranchasSegments, setPranchasSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialData, setInitialData] = useState(null);

  // Buscar dados existentes
  const fetchData = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/nomenclatura/${projectCode}`,
        { withCredentials: true }
      );
      const data = res.data?.data;
      if (data) {
        setModelosSegments(data.modelos?.segments || []);
        setPranchasSegments(data.pranchas?.segments || []);
        setInitialData(data);
      } else {
        setModelosSegments([]);
        setPranchasSegments([]);
        setInitialData(null);
      }
      setHasChanges(false);
    } catch (err) {
      console.error('Erro ao buscar nomenclatura:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Detectar mudanças
  const handleModelosChange = (segs) => {
    setModelosSegments(segs);
    setHasChanges(true);
    setSaveMsg(null);
  };

  const handlePranchasChange = (segs) => {
    setPranchasSegments(segs);
    setHasChanges(true);
    setSaveMsg(null);
  };

  // Salvar
  const handleSave = async () => {
    if (!projectCode) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {};
      if (modelosSegments.length > 0) {
        body.modelos = {
          padrao_template: buildTemplate(modelosSegments),
          segments: modelosSegments,
        };
      }
      if (pranchasSegments.length > 0) {
        body.pranchas = {
          padrao_template: buildTemplate(pranchasSegments),
          segments: pranchasSegments,
        };
      }

      if (Object.keys(body).length === 0) {
        setSaveMsg({ type: 'warn', text: 'Adicione pelo menos um segmento para salvar.' });
        setSaving(false);
        return;
      }

      await axios.put(
        `${API_URL}/api/nomenclatura/${projectCode}`,
        body,
        { withCredentials: true }
      );
      setSaveMsg({ type: 'ok', text: 'Padrão salvo com sucesso!' });
      setHasChanges(false);
      setInitialData(body);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setSaveMsg({ type: 'error', text: err.response?.data?.error || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  if (!projectCode) {
    return (
      <div className="nom-panel">
        <div className="nom-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p>Selecione um projeto para configurar a nomenclatura</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="nom-panel">
        <div className="nom-loading">Carregando configuração...</div>
      </div>
    );
  }

  return (
    <div className="nom-panel">
      <div className="nom-panel-header">
        <div>
          <h3 className="nom-panel-title">Nomenclatura de Arquivos</h3>
          <p className="nom-panel-subtitle">
            Configure o padrão de nomes para modelos e pranchas do projeto.
          </p>
        </div>
        {canEditPortfolio && (
          <button
            type="button"
            className={`nom-btn-save ${hasChanges ? 'nom-btn-save--active' : ''}`}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>

      {saveMsg && (
        <div className={`nom-save-msg nom-save-msg--${saveMsg.type}`}>
          {saveMsg.text}
        </div>
      )}

      <div className="nom-builders-grid">
        <SegmentBuilder
          tipo="modelos"
          label="Modelos (IFC / RVT)"
          segments={modelosSegments}
          onSegmentsChange={handleModelosChange}
          canEdit={canEditPortfolio}
        />
        <SegmentBuilder
          tipo="pranchas"
          label="Pranchas (DWG / PDF)"
          segments={pranchasSegments}
          onSegmentsChange={handlePranchasChange}
          canEdit={canEditPortfolio}
        />
      </div>

      <ValidationSection projectCode={projectCode} />
    </div>
  );
}

export default NomenclaturaPanel;

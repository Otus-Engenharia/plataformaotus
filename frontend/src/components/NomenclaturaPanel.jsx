/**
 * Componente: Painel de Nomenclatura de Arquivos
 *
 * Permite configurar os padrões de nomenclatura de modelos (IFC/RVT) e pranchas (DWG/PDF)
 * para cada projeto. Inclui builder de segmentos e tabelas auxiliares de siglas em sub-abas.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import NomenclaturaLookupTabs from './NomenclaturaLookupTabs';
import '../styles/NomenclaturaPanel.css';

// Catálogo de parâmetros disponíveis (sugestão, não lista fechada)
const PARAM_CATALOG = [
  { id: 'DISCIPLINA', name: 'Disciplina', description: 'Sigla da disciplina (ARQ, EST, HID...)', defaultCharCount: 3 },
  { id: 'FASE', name: 'Fase', description: 'Fase do projeto (EP, AP, PE, EX, LO)', defaultCharCount: 2 },
  { id: 'SETOR', name: 'Setor', description: 'Setor/torre do edifício (TA, TB, GE...)', defaultCharCount: 2 },
  { id: 'CONTEUDO', name: 'Conteúdo', description: 'Tipo de conteúdo (PL, CO, EL, DT...)', defaultCharCount: 2 },
  { id: 'TORRE', name: 'Torre/Posição', description: 'Segmento/torre (1A, 1B, HT...)', defaultCharCount: 2 },
  { id: 'PRANCHA', name: 'Nº da Prancha', description: 'Número da folha (001, 002...)', defaultCharCount: 3 },
  { id: 'COMPLEMENTO', name: 'Complemento', description: 'Tipo/nome do arquivo (Térreo, Tipo...)', defaultCharCount: null },
  { id: 'LOCAL', name: 'Localização', description: 'Local ou pavimento', defaultCharCount: 3 },
  { id: 'PAV', name: 'Pavimento', description: 'Pavimento do edifício', defaultCharCount: 3 },
  { id: 'BLOCO', name: 'Bloco', description: 'Bloco do edifício', defaultCharCount: 2 },
  { id: 'SEGMENTO', name: 'Segmento', description: 'Segmento do projeto', defaultCharCount: null },
  { id: 'NUM', name: 'Número', description: 'Número genérico', defaultCharCount: null },
];

const SEPARATORS = [
  { value: '', label: 'Sem' },
  { value: '-', label: '-' },
  { value: '_', label: '_' },
  { value: '.', label: '.' },
];

const DEFAULT_SEPARATOR = '_';

function buildTemplate(segments) {
  return segments.map((seg, i) => {
    const sep = i === 0 ? '' : (seg.separator ?? DEFAULT_SEPARATOR);
    if (seg.type === 'fixed') return sep + seg.value;
    if (seg.type === 'revision') return sep + 'RXX';
    if (seg.char_count) {
      const placeholder = (seg.label || seg.name || '').substring(0, seg.char_count).toUpperCase();
      return sep + placeholder.padEnd(seg.char_count, 'X');
    }
    return sep + (seg.label || seg.name);
  }).join('');
}

function getParamMeta(name) {
  return PARAM_CATALOG.find(p => p.id === name) || null;
}

/**
 * Diagrama visual do padrão — estilo documentação de engenharia
 */
function NomenclaturaDiagram({ segments, lookups }) {
  if (segments.length === 0) return null;

  function getExampleValue(seg) {
    if (seg.type === 'fixed') return seg.value || '???';
    if (seg.type === 'revision') return 'R00';
    const entries = lookups[seg.name];
    if (entries && entries.length > 0) return entries[0].abbreviation;
    if (seg.char_count) return 'X'.repeat(seg.char_count);
    return 'XXX';
  }

  function getLabel(seg) {
    if (seg.type === 'fixed') return 'Fixo';
    if (seg.type === 'revision') return 'Revisão';
    const meta = getParamMeta(seg.name);
    return meta?.name || seg.label || seg.name;
  }

  function getCharInfo(seg) {
    if (seg.type !== 'param') return null;
    if (seg.char_count) return `${seg.char_count} car.`;
    return 'livre';
  }

  function getBlockClass(seg) {
    if (seg.type === 'fixed') return 'nom-diagram-block--fixed';
    if (seg.type === 'revision') return 'nom-diagram-block--revision';
    return 'nom-diagram-block--param';
  }

  return (
    <div className="nom-diagram">
      <div className="nom-diagram-blocks">
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && seg.separator && (
              <span className="nom-diagram-sep">{seg.separator}</span>
            )}
            <div className={`nom-diagram-block ${getBlockClass(seg)}`}>
              <span className="nom-diagram-value">{getExampleValue(seg)}</span>
              <span className="nom-diagram-label">{getLabel(seg)}</span>
              {getCharInfo(seg) && (
                <span className="nom-diagram-chars">{getCharInfo(seg)}</span>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Segmento individual — simplificado (sem char_count, sem lookup button)
 */
function SegmentCard({ segment, index, total, onMove, onRemove, onChange, canEdit, lookupCount }) {
  const [editing, setEditing] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const paramMeta = segment.type === 'param' ? getParamMeta(segment.name) : null;

  function getTypeLabel() {
    if (segment.type === 'fixed') return 'Fixo';
    if (segment.type === 'revision') return 'Revisão';
    if (segment.custom && segment.label) return segment.label;
    return paramMeta?.name || segment.label || segment.name;
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
            value={segment.separator ?? DEFAULT_SEPARATOR}
            onChange={e => onChange({ ...segment, separator: e.target.value })}
            disabled={!canEdit}
            title="Separador antes deste segmento"
          >
            {SEPARATORS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
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
              onChange={e => onChange({ ...segment, value: e.target.value.toUpperCase() })}
              onBlur={() => setEditing(false)}
              onKeyDown={e => e.key === 'Enter' && setEditing(false)}
              autoFocus
              placeholder="Texto fixo"
            />
          ) : segment.type === 'param' && segment.custom && editingLabel ? (
            <input
              className="nom-segment-input"
              value={segment.label || ''}
              onChange={e => onChange({ ...segment, label: e.target.value, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
              onBlur={() => setEditingLabel(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingLabel(false)}
              autoFocus
              placeholder="Nome do parâmetro"
            />
          ) : (
            <span
              className="nom-segment-label"
              onClick={() => {
                if (segment.type === 'fixed' && canEdit) setEditing(true);
                if (segment.type === 'param' && segment.custom && canEdit) setEditingLabel(true);
              }}
              title={segment.type === 'fixed' ? 'Clique para editar' : segment.custom ? 'Clique para renomear' : ''}
            >
              {segment.type === 'fixed' && (segment.value || '???')}
              {segment.type === 'revision' && 'RXX'}
              {segment.type === 'param' && typeLabel}
            </span>
          )}

          {/* Badge com char_count e contagem de siglas */}
          {segment.type === 'param' && (
            <div className="nom-segment-badges">
              {segment.char_count && (
                <span className="nom-char-badge" title="Quantidade de caracteres">{segment.char_count} car.</span>
              )}
              {lookupCount > 0 && (
                <span className="nom-siglas-badge" title={`${lookupCount} siglas configuradas`}>{lookupCount} siglas</span>
              )}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="nom-segment-actions">
            <button type="button" className="nom-btn-icon" onClick={() => onMove(index, -1)} disabled={isFirst} title="Mover para cima">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
            </button>
            <button type="button" className="nom-btn-icon" onClick={() => onMove(index, 1)} disabled={isLast} title="Mover para baixo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <button type="button" className="nom-btn-icon nom-btn-icon--danger" onClick={() => onRemove(index)} title="Remover">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
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
function SegmentBuilder({ tipo, label, segments, onSegmentsChange, canEdit, lookups, copySource }) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customParamName, setCustomParamName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleMove = (index, direction) => {
    const newSegs = [...segments];
    const target = index + direction;
    if (target < 0 || target >= newSegs.length) return;
    [newSegs[index], newSegs[target]] = [newSegs[target], newSegs[index]];
    if (newSegs[0]) newSegs[0] = { ...newSegs[0], separator: '' };
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

  const addSegment = (type, paramId = null, meta = null) => {
    const sep = segments.length === 0 ? '' : DEFAULT_SEPARATOR;
    let newSeg;
    if (type === 'fixed') {
      newSeg = { type: 'fixed', value: '', separator: sep };
    } else if (type === 'revision') {
      newSeg = { type: 'revision', separator: sep };
    } else if (type === 'custom') {
      newSeg = { type: 'param', name: paramId, label: meta.label, separator: sep, char_count: null, custom: true };
    } else {
      const catalogItem = getParamMeta(paramId);
      newSeg = { type: 'param', name: paramId, separator: sep, char_count: catalogItem?.defaultCharCount || null };
    }
    onSegmentsChange([...segments, newSeg]);
    setShowAddMenu(false);
    setShowCustomInput(false);
    setCustomParamName('');
  };

  const handleAddCustom = () => {
    if (!customParamName.trim()) return;
    const name = customParamName.trim().toUpperCase().replace(/\s+/g, '_');
    addSegment('custom', name, { label: customParamName.trim() });
  };

  return (
    <div className="nom-builder">
      <div className="nom-builder-header">
        <div className="nom-builder-header-top">
          <h4 className="nom-builder-title">{label}</h4>
          {canEdit && copySource && copySource.length > 0 && (
            <button type="button" className="nom-btn-copy" onClick={() => onSegmentsChange(JSON.parse(JSON.stringify(copySource)))} title="Copiar configuração de Modelos">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar de Modelos
            </button>
          )}
        </div>
        <NomenclaturaDiagram segments={segments} lookups={lookups} />
      </div>

      {segments.length === 0 && !canEdit && (
        <div className="nom-empty"><p>Nenhum segmento configurado.</p></div>
      )}

      {segments.length > 0 && (
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
              lookupCount={seg.type === 'param' ? (lookups[seg.name]?.length || 0) : 0}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <div className="nom-add-container">
          <button type="button" className="nom-btn-add" onClick={() => setShowAddMenu(!showAddMenu)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            {segments.length === 0 ? 'Começar a configurar' : 'Adicionar segmento'}
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
                  <button key={p.id} type="button" onClick={() => addSegment('param', p.id)} title={p.description}>
                    {p.name}
                    <span className="nom-add-menu-desc">{p.description}</span>
                  </button>
                ))}
              </div>
              <div className="nom-add-menu-section">
                <span className="nom-add-menu-label">Personalizado</span>
                {showCustomInput ? (
                  <div className="nom-custom-input-row">
                    <input
                      className="nom-custom-input"
                      value={customParamName}
                      onChange={e => setCustomParamName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
                      placeholder="Nome do parâmetro"
                      autoFocus
                    />
                    <button type="button" className="nom-custom-btn" onClick={handleAddCustom} disabled={!customParamName.trim()}>
                      Adicionar
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowCustomInput(true)}>
                    Parâmetro personalizado
                    <span className="nom-add-menu-desc">Criar parâmetro com nome customizado</span>
                  </button>
                )}
              </div>
              <div className="nom-add-menu-section">
                <span className="nom-add-menu-label">Revisão</span>
                <button type="button" onClick={() => addSegment('revision')}>Revisão (RXX)</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente principal: NomenclaturaPanel
 */
function NomenclaturaPanel({ projectCode }) {
  const { isPrivileged } = useAuth();
  const [modelosSegments, setModelosSegments] = useState([]);
  const [pranchasSegments, setPranchasSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lookups, setLookups] = useState({});

  const fetchData = useCallback(async () => {
    if (!projectCode) return;
    setLoading(true);
    try {
      const [nomRes, lookupRes] = await Promise.all([
        axios.get(`${API_URL}/api/nomenclatura/${projectCode}`, { withCredentials: true }),
        axios.get(`${API_URL}/api/nomenclatura/${projectCode}/lookups`, { withCredentials: true }),
      ]);

      const data = nomRes.data?.data;
      if (data) {
        setModelosSegments(data.modelos?.segments || []);
        setPranchasSegments(data.pranchas?.segments || []);
      } else {
        setModelosSegments([]);
        setPranchasSegments([]);
      }

      setLookups(lookupRes.data?.data || {});
      setHasChanges(false);
    } catch (err) {
      console.error('Erro ao buscar nomenclatura:', err);
    } finally {
      setLoading(false);
    }
  }, [projectCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleModelosChange = (segs) => { setModelosSegments(segs); setHasChanges(true); setSaveMsg(null); };
  const handlePranchasChange = (segs) => { setPranchasSegments(segs); setHasChanges(true); setSaveMsg(null); };

  const handleLookupSaved = (paramName, entries) => {
    setLookups(prev => ({ ...prev, [paramName]: entries }));
  };

  // Atualizar char_count em todos os segmentos que usam esse param
  const handleCharCountChange = (paramName, newCharCount) => {
    const update = (segs) => segs.map(s =>
      s.type === 'param' && s.name === paramName ? { ...s, char_count: newCharCount } : s
    );
    setModelosSegments(prev => update(prev));
    setPranchasSegments(prev => update(prev));
    setHasChanges(true);
    setSaveMsg(null);
  };

  // Todos os segmentos combinados (para as tabs de lookup)
  const allSegments = useMemo(() => [...modelosSegments, ...pranchasSegments], [modelosSegments, pranchasSegments]);

  const handleSave = async () => {
    if (!projectCode) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {};
      if (modelosSegments.length > 0) {
        body.modelos = { padrao_template: buildTemplate(modelosSegments), segments: modelosSegments };
      }
      if (pranchasSegments.length > 0) {
        body.pranchas = { padrao_template: buildTemplate(pranchasSegments), segments: pranchasSegments };
      }

      if (Object.keys(body).length === 0) {
        setSaveMsg({ type: 'warn', text: 'Adicione pelo menos um segmento para salvar.' });
        setSaving(false);
        return;
      }

      await axios.put(`${API_URL}/api/nomenclatura/${projectCode}`, body, { withCredentials: true });
      setSaveMsg({ type: 'ok', text: 'Padrão salvo com sucesso!' });
      setHasChanges(false);
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
          </svg>
          <p>Selecione um projeto para configurar a nomenclatura</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="nom-panel"><div className="nom-loading">Carregando configuração...</div></div>;
  }

  return (
    <div className="nom-panel">
      <div className="nom-panel-header">
        <div>
          <h3 className="nom-panel-title">Nomenclatura de Arquivos</h3>
          <p className="nom-panel-subtitle">Configure o padrão de nomes para modelos e pranchas do projeto.</p>
        </div>
        {isPrivileged && (
          <button
            type="button"
            className={`nom-btn-save ${hasChanges ? 'nom-btn-save--active' : ''}`}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Salvando...' : 'Salvar padrão'}
          </button>
        )}
      </div>

      {saveMsg && (
        <div className={`nom-save-msg nom-save-msg--${saveMsg.type}`}>{saveMsg.text}</div>
      )}

      <div className="nom-builders-grid">
        <SegmentBuilder
          tipo="modelos"
          label="Modelos (IFC / RVT)"
          segments={modelosSegments}
          onSegmentsChange={handleModelosChange}
          canEdit={isPrivileged}
          lookups={lookups}
        />
        <SegmentBuilder
          tipo="pranchas"
          label="Pranchas (DWG / PDF)"
          segments={pranchasSegments}
          onSegmentsChange={handlePranchasChange}
          canEdit={isPrivileged}
          lookups={lookups}
          copySource={modelosSegments}
        />
      </div>

      <NomenclaturaLookupTabs
        projectCode={projectCode}
        segments={allSegments}
        lookups={lookups}
        canEdit={isPrivileged}
        onLookupSaved={handleLookupSaved}
        onCharCountChange={handleCharCountChange}
      />
    </div>
  );
}

export default NomenclaturaPanel;

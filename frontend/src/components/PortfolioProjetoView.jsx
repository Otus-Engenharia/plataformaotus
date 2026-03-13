/**
 * Componente: Super Card - Vista Completa do Projeto
 *
 * Mostra dados das 3 tabelas Supabase (projects, project_comercial_infos, project_features)
 * + dados BigQuery do portfolio em um card profissional com seções colapsáveis.
 *
 * Seções:
 * 1. Hero Card (sempre aberto)
 * 2. Cronograma (sempre aberto)
 * 3. Informações Comerciais (colapsável)
 * 4. Características do Empreendimento (colapsável)
 * 5. Visão Estratégica (colapsável)
 * 6. Ferramentas e Plataformas (colapsável)
 * 7. Entregáveis Otus (colapsável)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useAuth } from '../contexts/AuthContext';
import StatusDropdown from './StatusDropdown';
import '../styles/PortfolioProjetoView.css';

// Icons
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 200ms ease' }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ============================================
// EditableField - Sub-componente reutilizável
// ============================================

function EditableField({ label, value, fieldKey, inputType = 'text', options, canEdit, onSave, savedCell, errorCell, projectCode, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? '');
  const inputRef = useRef(null);

  const isSaved = savedCell?.projectCode === projectCode && savedCell?.field === fieldKey;
  const fieldError = errorCell?.projectCode === projectCode && errorCell?.field === fieldKey ? errorCell : null;

  useEffect(() => { setLocalValue(value ?? ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const handleSave = useCallback(() => {
    setEditing(false);
    const trimmed = typeof localValue === 'string' ? localValue.trim() : localValue;
    if (trimmed !== (value ?? '')) {
      onSave(fieldKey, trimmed, value);
    }
  }, [localValue, value, fieldKey, onSave]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && inputType !== 'textarea') handleSave();
    if (e.key === 'Escape') { setLocalValue(value ?? ''); setEditing(false); }
  }, [handleSave, inputType, value]);

  // Toggle type
  if (inputType === 'toggle') {
    const boolVal = value === true || value === 'ativo';
    return (
      <div className={`ppv-editable-field ppv-toggle-row${isSaved ? ' ppv-editable-saved' : ''}${fieldError ? ' ppv-editable-error' : ''}`}>
        <span className="ppv-editable-label">{label}</span>
        <div className="ppv-editable-value-row">
          <button
            className={`ppv-toggle${boolVal ? ' ppv-toggle-on' : ''}`}
            onClick={() => canEdit && onSave(fieldKey, boolVal ? 'inativo' : 'ativo', boolVal ? 'ativo' : 'inativo')}
            disabled={!canEdit}
            type="button"
          >
            <span className="ppv-toggle-knob" />
          </button>
          <span className="ppv-toggle-label">{boolVal ? 'Ativo' : 'Inativo'}</span>
          {isSaved && <span className="ppv-editable-check">&#10003;</span>}
          {fieldError && <span className="ppv-editable-error-msg">{fieldError.message}</span>}
        </div>
      </div>
    );
  }

  // Link type - show as clickable
  if (inputType === 'link' && !editing) {
    return (
      <div
        className={`ppv-editable-field${isSaved ? ' ppv-editable-saved' : ''}${fieldError ? ' ppv-editable-error' : ''}`}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? 'Clique para editar' : ''}
      >
        <span className="ppv-editable-label">{label}</span>
        <div className="ppv-editable-value-row">
          {value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="ppv-link ppv-link-field" onClick={e => e.stopPropagation()}>
              {value.length > 50 ? value.substring(0, 50) + '...' : value}
              <ExternalLinkIcon />
            </a>
          ) : (
            <span className="ppv-editable-placeholder">{placeholder || 'Adicionar link'}</span>
          )}
          {canEdit && <span className="ppv-editable-icon"><PencilIcon /></span>}
          {isSaved && <span className="ppv-editable-check">&#10003;</span>}
          {fieldError && <span className="ppv-editable-error-msg">{fieldError.message}</span>}
        </div>
      </div>
    );
  }

  // Multi-select type (valor_cliente)
  if (inputType === 'multi-select' && options) {
    const selected = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <div className={`ppv-editable-field${isSaved ? ' ppv-editable-saved' : ''}${fieldError ? ' ppv-editable-error' : ''}`}>
        <span className="ppv-editable-label">{label}</span>
        <div className="ppv-multi-select">
          {options.map(opt => {
            const isChecked = selected.includes(opt.value);
            return (
              <label key={opt.value} className={`ppv-multi-option${isChecked ? ' ppv-multi-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={!canEdit}
                  onChange={() => {
                    const newVal = isChecked
                      ? selected.filter(v => v !== opt.value)
                      : [...selected, opt.value];
                    onSave(fieldKey, newVal, selected);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
        {isSaved && <span className="ppv-editable-check">&#10003;</span>}
        {fieldError && <span className="ppv-editable-error-msg">{fieldError.message}</span>}
      </div>
    );
  }

  if (!editing) {
    const displayValue = inputType === 'date' && value
      ? formatDisplayDate(value)
      : inputType === 'number' && value != null
        ? String(value)
        : inputType === 'select' && options
          ? (options.find(o => o.value === value)?.label || value)
          : value;

    return (
      <div
        className={`ppv-editable-field${isSaved ? ' ppv-editable-saved' : ''}${fieldError ? ' ppv-editable-error' : ''}`}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? 'Clique para editar' : ''}
      >
        <span className="ppv-editable-label">{label}</span>
        <div className="ppv-editable-value-row">
          <span className={displayValue ? 'ppv-editable-value' : 'ppv-editable-placeholder'}>
            {displayValue || placeholder || 'Definir'}
          </span>
          {canEdit && <span className="ppv-editable-icon"><PencilIcon /></span>}
          {isSaved && <span className="ppv-editable-check">&#10003;</span>}
          {fieldError && <span className="ppv-editable-error-msg">{fieldError.message}</span>}
        </div>
      </div>
    );
  }

  // Editing mode
  if (inputType === 'select' && options) {
    return (
      <div className="ppv-editable-field ppv-editable-active">
        <span className="ppv-editable-label">{label}</span>
        <select
          ref={inputRef}
          className="ppv-editable-input"
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); }}
          onBlur={() => { handleSave(); }}
        >
          <option value="">-- Selecionar --</option>
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      </div>
    );
  }

  if (inputType === 'textarea') {
    return (
      <div className="ppv-editable-field ppv-editable-active">
        <span className="ppv-editable-label">{label}</span>
        <textarea
          ref={inputRef}
          className="ppv-editable-input ppv-textarea"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Escape') { setLocalValue(value ?? ''); setEditing(false); } }}
          rows={4}
        />
      </div>
    );
  }

  if (inputType === 'date') {
    const isoVal = toISODate(localValue);
    return (
      <div className="ppv-editable-field ppv-editable-active">
        <span className="ppv-editable-label">{label}</span>
        <input
          ref={inputRef}
          type="date"
          className="ppv-editable-input"
          value={isoVal}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <div className="ppv-editable-field ppv-editable-active">
      <span className="ppv-editable-label">{label}</span>
      <input
        ref={inputRef}
        type={inputType === 'number' ? 'number' : 'text'}
        className="ppv-editable-input"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}

// ============================================
// CollapsibleSection
// ============================================

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="ppv-section">
      <h4 className="ppv-section-title ppv-section-collapsible" onClick={() => setOpen(!open)}>
        <ChevronIcon open={open} />
        <span>{title}</span>
      </h4>
      <div className={`ppv-section-body${open ? ' ppv-section-open' : ''}`}>
        {open && children}
      </div>
    </section>
  );
}

// ============================================
// Helpers
// ============================================

function formatDisplayDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) return dateValue;
  try {
    let date;
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
        date = new Date(dateValue);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateValue);
      }
    } else if (typeof dateValue === 'object' && dateValue !== null) {
      date = dateValue.value ? new Date(dateValue.value) : new Date(dateValue);
    } else {
      date = new Date(dateValue);
    }
    return isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
  } catch {
    return null;
  }
}

function toISODate(val) {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) {
    const [d, m, y] = val.split('/');
    return `${y}-${m}-${d}`;
  }
  try {
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date.toISOString().substring(0, 10);
  } catch {}
  return '';
}

function parseDateValue(dateValue) {
  if (!dateValue) return null;
  try {
    if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;
    if (typeof dateValue === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        const d = new Date(`${year}-${month}-${day}`);
        return isNaN(d.getTime()) ? null : d;
      }
      if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
        const d = new Date(dateValue);
        return isNaN(d.getTime()) ? null : d;
      }
    }
    if (typeof dateValue === 'object' && dateValue !== null && dateValue.value) {
      const d = new Date(dateValue.value);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateValue);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

function calculateMonthDifference(date1, date2) {
  const d1 = parseDateValue(date1);
  const d2 = parseDateValue(date2);
  if (!d1 || !d2) return null;
  const yearDiff = d1.getFullYear() - d2.getFullYear();
  const monthDiff = d1.getMonth() - d2.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;
  const dayDiff = d1.getDate() - d2.getDate();
  if (dayDiff > 15) return totalMonths + 1;
  if (dayDiff < -15) return totalMonths - 1;
  return totalMonths;
}

function getStatusType(status) {
  if (!status) return 'default';
  const s = String(status).toLowerCase().trim();
  if (['close', 'obra finalizada', 'encerrado', 'finalizado', 'concluído', 'concluido', 'cancelado'].some(x => s.includes(x))) return 'closed';
  if (['pausado', 'pausa', 'em pausa', 'suspenso', 'suspensão'].some(x => s.includes(x))) return 'paused';
  if (['execução', 'execucao', 'em andamento', 'ativo'].some(x => s.includes(x))) return 'active';
  return 'default';
}

// ============================================
// Main Component
// ============================================

function PortfolioProjetoView({ selectedProjectId, portfolio = [], onFieldUpdate }) {
  const [projectData, setProjectData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null);

  const { hasFullAccess, canEditPortfolio } = useAuth();
  const { updatePortfolioField, updateComercialField, updateToolField, savedCell, errorCell } = usePortfolio();
  const canEdit = canEditPortfolio;

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  // Set BigQuery data from portfolio
  useEffect(() => {
    if (selectedProject) {
      setProjectData(selectedProject);
      setError(null);
    } else if (selectedProjectId) {
      setError('Projeto nao encontrado');
      setProjectData(null);
      setDetailData(null);
    } else {
      setProjectData(null);
      setDetailData(null);
      setError(null);
    }
  }, [selectedProject, selectedProjectId]);

  // Fetch Supabase detail when project changes
  useEffect(() => {
    if (!selectedProjectId) { setDetailData(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    axios.get(`${API_URL}/api/portfolio/${selectedProjectId}/detail`, { withCredentials: true })
      .then(res => {
        if (!cancelled && res.data?.success) setDetailData(res.data.data);
      })
      .catch(() => { /* detail is optional, BigQuery data still shows */ })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Fetch dropdown options once
  useEffect(() => {
    if (options) return;
    axios.get(`${API_URL}/api/projetos/detail/options`, { withCredentials: true })
      .then(res => { if (res.data?.success) setOptions(res.data.data); })
      .catch(() => {});
  }, [options]);

  // Merged data (BigQuery base + Supabase detail overlay)
  const data = useMemo(() => {
    if (!projectData) return null;
    return { ...projectData, ...(detailData || {}) };
  }, [projectData, detailData]);

  // Save handlers
  const handleProjectSave = useCallback((field, newValue, oldValue) => {
    const code = selectedProjectId;
    updatePortfolioField(code, field, newValue, oldValue);
    onFieldUpdate?.(code, field, newValue);
    // Update local detail data optimistically
    setDetailData(prev => prev ? { ...prev, [field]: newValue } : prev);
  }, [selectedProjectId, updatePortfolioField, onFieldUpdate]);

  const handleComercialSave = useCallback((field, newValue, oldValue) => {
    const code = selectedProjectId;
    updateComercialField(code, field, newValue, oldValue);
    setDetailData(prev => prev ? { ...prev, [field]: newValue } : prev);
  }, [selectedProjectId, updateComercialField]);

  const handleToolSave = useCallback((field, newValue, oldValue) => {
    const code = selectedProjectId;
    updateToolField(code, field, newValue, oldValue);
    setDetailData(prev => prev ? { ...prev, [field]: newValue } : prev);
  }, [selectedProjectId, updateToolField]);

  if (!selectedProjectId) {
    return <div className="ppv-empty"><p>Selecione um projeto para visualizar as informacoes.</p></div>;
  }
  if (error) {
    return <div className="ppv-error"><p>{error}</p></div>;
  }
  if (!data) {
    return <div className="ppv-empty"><p>Nenhum dado disponivel para este projeto.</p></div>;
  }

  const projectCode = data.project_code_norm;
  const statusType = getStatusType(data.status);

  // Cronograma KPIs
  let desvioValue = data.diferenca_cronograma_contrato;
  const terminoCronograma = data.data_termino_cronograma;
  const terminoContrato = data.data_termino_contrato_com_pausas || data.data_termino_contrato;
  if ((desvioValue === null || desvioValue === undefined || desvioValue === '' || typeof desvioValue !== 'number') && terminoCronograma && terminoContrato) {
    desvioValue = calculateMonthDifference(terminoCronograma, terminoContrato);
  }

  const cronogramaKPIs = [
    { label: 'Inicio Cronograma', value: formatDisplayDate(data.data_inicio_cronograma) },
    { label: 'Termino Cronograma', value: formatDisplayDate(data.data_termino_cronograma) },
    {
      label: 'Desvio',
      value: (typeof desvioValue === 'number' && !isNaN(desvioValue))
        ? `${desvioValue > 0 ? '+' : ''}${desvioValue} ${Math.abs(desvioValue) === 1 ? 'mes' : 'meses'}`
        : null,
      type: (typeof desvioValue === 'number' && !isNaN(desvioValue))
        ? (desvioValue >= 3 ? 'danger' : desvioValue >= 1 ? 'warning' : 'success')
        : null
    },
  ].filter(k => k.value);

  // Prazos read-only from BigQuery
  const prazosLabels = {
    'data_termino_contrato': 'Termino Contrato',
    'data_termino_contrato_com_pausas': 'Termino c/ Pausas',
    'qtd_pausas': 'Qtd. Pausas',
    'total_dias_pausa': 'Total Dias Pausa',
    'qtd_aditivos_distintos': 'Qtd. Aditivos',
    'duracao_contrato_total_meses': 'Duracao Contrato',
    'duracao_aditivo_total_meses': 'Duracao Aditivo',
    'duracao_total_meses': 'Duracao Total',
  };

  const fmtReadOnly = (key, val) => {
    if (val === null || val === undefined || val === '') return null;
    const k = key.toLowerCase();
    if (k.includes('data') || k.includes('date')) return formatDisplayDate(val);
    if (k.includes('duracao') && k.includes('meses')) return `${val} ${val === 1 ? 'mes' : 'meses'}`;
    return val;
  };

  const prazosFields = Object.entries(prazosLabels)
    .map(([key, label]) => {
      const v = fmtReadOnly(key, data[key]);
      return v != null ? { key, label, value: v } : null;
    })
    .filter(Boolean);

  // Read-only BigQuery fields for hero
  const heroMeta = [projectCode, data.client, data.nome_time].filter(Boolean);
  const heroLeaders = [
    data.lider && `Lider: ${data.lider}`,
    data.coordenador && `Coord: ${data.coordenador}`,
  ].filter(Boolean);

  // Feedback helpers
  const isSaved = (field) => savedCell?.projectCode === projectCode && savedCell?.field === field;
  const getError = (field) => errorCell?.projectCode === projectCode && errorCell?.field === field ? errorCell : null;

  // Hero editable fields
  const statusSaved = isSaved('status');
  const statusError = getError('status');
  const comercialSaved = isSaved('comercial_name');
  const comercialError = getError('comercial_name');

  // Tool fields (booleans)
  const toolToggles = [
    { key: 'bot_whatsapp_status', label: 'Bot WhatsApp' },
    { key: 'checklist_status', label: 'Checklist' },
    { key: 'dashboard_status', label: 'Dashboard' },
    { key: 'dod_status', label: 'DOD' },
    { key: 'escopo_status', label: 'Escopo' },
    { key: 'relatorio_semanal_status', label: 'Relatorio Semanal' },
  ];

  const toolIds = [
    { key: 'construflow_id', label: 'Construflow ID' },
    { key: 'smartsheet_id', label: 'Smartsheet ID' },
    { key: 'whatsapp_group_id', label: 'WhatsApp Group ID' },
    { key: 'pasta_emails_id', label: 'Pasta Emails ID' },
    { key: 'dod_id', label: 'DOD ID' },
    { key: 'escopo_entregas_id', label: 'Escopo Entregas ID' },
    { key: 'discord_id', label: 'Discord ID' },
  ];

  const toolUrls = [
    { key: 'capa_email_url', label: 'Capa Email URL' },
    { key: 'gantt_email_url', label: 'Gantt Email URL' },
    { key: 'disciplina_email_url', label: 'Disciplina Email URL' },
  ];

  return (
    <div className="ppv-container">
      {/* ===== HERO CARD ===== */}
      <div className="ppv-hero">
        <div className="ppv-hero-glow"></div>
        <div className="ppv-hero-content">
          <div className="ppv-hero-top">
            <h2 className="ppv-hero-name">{data.project_name || data.name || projectCode}</h2>
            <div className="ppv-status-badge-wrapper">
              {editingField === 'status' ? (
                <StatusDropdown
                  value={data.status}
                  onChange={(newVal) => {
                    handleProjectSave('status', newVal, data.status);
                    setEditingField(null);
                  }}
                  inline
                  defaultOpen
                />
              ) : (
                <span
                  className={`ppv-status-badge ppv-status-${statusType}${canEdit ? ' ppv-status-editable' : ''}`}
                  onClick={() => canEdit && setEditingField('status')}
                  title={canEdit ? 'Clique para alterar a fase' : ''}
                >
                  <span className="ppv-status-dot"></span>
                  {data.status || 'Definir fase'}
                  {canEdit && <span className="ppv-status-edit-icon"><PencilIcon /></span>}
                  {statusSaved && <span className="ppv-editable-check">&#10003;</span>}
                </span>
              )}
              {statusError && <span className="ppv-status-error">{statusError.message}</span>}
            </div>
          </div>

          {heroMeta.length > 0 && <p className="ppv-hero-meta">{heroMeta.join(' \u00b7 ')}</p>}

          {(heroLeaders.length > 0 || data.disciplina_cliente || data.cs_responsavel_name) && (
            <div className="ppv-hero-leaders">
              {heroLeaders.map((text, i) => (
                <span key={i} className={`ppv-hero-leader-tag ${text.startsWith('Lider') ? 'ppv-tag-lider' : 'ppv-tag-coord'}`}>{text}</span>
              ))}
              {data.disciplina_cliente && (
                <span className="ppv-hero-leader-tag ppv-tag-disciplina">{data.disciplina_cliente}</span>
              )}
              {data.cs_responsavel_name && (
                <span className="ppv-hero-leader-tag ppv-tag-cs">
                  {data.cs_responsavel_avatar && <img className="ppv-tag-avatar" src={data.cs_responsavel_avatar} alt="" />}
                  CS: {data.cs_responsavel_name}
                </span>
              )}
            </div>
          )}

          {/* Editable hero fields */}
          <div className="ppv-hero-editable-fields">
            <EditableField
              label="Nome comercial"
              value={data.comercial_name}
              fieldKey="comercial_name"
              canEdit={canEdit}
              onSave={handleProjectSave}
              savedCell={savedCell}
              errorCell={errorCell}
              projectCode={projectCode}
              placeholder="Definir nome comercial"
            />
            <EditableField
              label="Tipo de servico"
              value={data.service_type}
              fieldKey="service_type"
              inputType="select"
              options={options?.service_type}
              canEdit={canEdit}
              onSave={handleProjectSave}
              savedCell={savedCell}
              errorCell={errorCell}
              projectCode={projectCode}
              placeholder="Selecionar tipo"
            />
          </div>
        </div>
      </div>

      {/* ===== CRONOGRAMA (always open) ===== */}
      {(cronogramaKPIs.length > 0 || prazosFields.length > 0) && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Cronograma</h4>
          {cronogramaKPIs.length > 0 && (
            <div className="ppv-kpi-grid">
              {cronogramaKPIs.map(kpi => (
                <div key={kpi.label} className={`ppv-kpi-card ${kpi.type ? `ppv-kpi-${kpi.type}` : ''}`}>
                  <div className="ppv-kpi-glow"></div>
                  <span className="ppv-kpi-label">{kpi.label}</span>
                  <span className={`ppv-kpi-value ${kpi.type ? `ppv-kpi-value-${kpi.type}` : ''}`}>{kpi.value}</span>
                </div>
              ))}
            </div>
          )}
          {prazosFields.length > 0 && (
            <div className="ppv-kv-list" style={{ marginTop: '0.75rem' }}>
              {prazosFields.map(f => (
                <div key={f.key} className="ppv-kv-row">
                  <span className="ppv-kv-label">{f.label}</span>
                  <span className="ppv-kv-value">{f.value}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ===== INFORMACOES COMERCIAIS ===== */}
      <CollapsibleSection title="Informacoes Comerciais">
        <div className="ppv-edit-grid">
          <EditableField label="Data Venda" value={data.data_venda} fieldKey="data_venda" inputType="date" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Tipo Pagamento" value={data.tipo_pagamento} fieldKey="tipo_pagamento" inputType="select" options={options?.tipo_pagamento} canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Fase de Entrada" value={data.fase_entrada} fieldKey="fase_entrada" inputType="select" options={options?.fase_entrada} canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Complexidade" value={data.complexidade} fieldKey="complexidade" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Complexidade Projetista" value={data.complexidade_projetista} fieldKey="complexidade_projetista" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Complexidade Tecnica" value={data.complexidade_tecnica} fieldKey="complexidade_tecnica" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Resp. Plataforma Comunicacao" value={data.responsavel_plataforma_comunicacao} fieldKey="responsavel_plataforma_comunicacao" inputType="select" options={options?.responsavel_plataforma} canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Resp. ACD" value={data.responsavel_acd} fieldKey="responsavel_acd" inputType="select" options={options?.responsavel_acd} canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="VGV Empreendimento" value={data.vgv_empreendimento} fieldKey="vgv_empreendimento" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Coordenacao Externa" value={data.coordenacao_externa} fieldKey="coordenacao_externa" inputType="toggle" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        </div>
        <div className="ppv-edit-grid ppv-edit-grid-links">
          <EditableField label="Link Contrato GER" value={data.link_contrato_ger} fieldKey="link_contrato_ger" inputType="link" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Link Escopo Descritivo" value={data.link_escopo_descritivo} fieldKey="link_escopo_descritivo" inputType="link" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Link Proposta GER" value={data.link_proposta_ger} fieldKey="link_proposta_ger" inputType="link" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        </div>
        {/* Read-only BigQuery comercial fields */}
        {(data.responsavel_venda || data.closer || data.data_assinatura) && (
          <div className="ppv-kv-list" style={{ marginTop: '0.75rem' }}>
            {data.responsavel_venda && <div className="ppv-kv-row"><span className="ppv-kv-label">Responsavel Venda</span><span className="ppv-kv-value">{data.responsavel_venda}</span></div>}
            {data.closer && <div className="ppv-kv-row"><span className="ppv-kv-label">Closer</span><span className="ppv-kv-value">{data.closer}</span></div>}
            {data.data_assinatura && <div className="ppv-kv-row"><span className="ppv-kv-label">Data Assinatura</span><span className="ppv-kv-value">{formatDisplayDate(data.data_assinatura)}</span></div>}
          </div>
        )}
      </CollapsibleSection>

      {/* ===== CARACTERISTICAS DO EMPREENDIMENTO ===== */}
      <CollapsibleSection title="Caracteristicas do Empreendimento">
        <div className="ppv-edit-grid">
          <EditableField label="Endereco" value={data.address} fieldKey="address" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} placeholder={data.endereco_obra || data.endereco || 'Definir endereco'} />
          <EditableField label="Tipologia" value={data.tipologia_empreendimento} fieldKey="tipologia_empreendimento" inputType="select" options={options?.tipologia_empreendimento} canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Padrao Acabamento" value={data.padrao_acabamento} fieldKey="padrao_acabamento" inputType="select" options={options?.padrao_acabamento} canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Area Construida (m2)" value={data.area_construida} fieldKey="area_construida" inputType="number" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Area Efetiva (m2)" value={data.area_efetiva} fieldKey="area_efetiva" inputType="number" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Numero Unidades" value={data.numero_unidades} fieldKey="numero_unidades" inputType="number" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Numero Torres" value={data.numero_torres} fieldKey="numero_torres" inputType="number" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Numero Pavimentos" value={data.numero_pavimentos} fieldKey="numero_pavimentos" inputType="number" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        </div>
        <EditableField label="Descricao" value={data.description} fieldKey="description" inputType="textarea" canEdit={canEdit} onSave={handleProjectSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} placeholder="Descricao do projeto" />
      </CollapsibleSection>

      {/* ===== VISAO ESTRATEGICA ===== */}
      <CollapsibleSection title="Visao Estrategica">
        <EditableField label="Visao da Empresa" value={data.visao_empresa} fieldKey="visao_empresa" inputType="textarea" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        <EditableField label="Visao do Projeto / Riscos" value={data.visao_projeto_riscos} fieldKey="visao_projeto_riscos" inputType="textarea" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        <EditableField label="Principais Dores" value={data.principais_dores} fieldKey="principais_dores" inputType="textarea" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        <EditableField label="Valor Cliente" value={data.valor_cliente} fieldKey="valor_cliente" inputType="multi-select" options={options?.valor_cliente} canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        <EditableField label="Informacoes do Contrato" value={data.info_contrato} fieldKey="info_contrato" inputType="textarea" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        {hasFullAccess && (
          <EditableField label="Info Adicional Confidencial" value={data.info_adicional_confidencial} fieldKey="info_adicional_confidencial" inputType="textarea" canEdit={canEdit} onSave={handleComercialSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        )}
      </CollapsibleSection>

      {/* ===== FERRAMENTAS E PLATAFORMAS ===== */}
      <CollapsibleSection title="Ferramentas e Plataformas">
        <div className="ppv-edit-grid">
          <EditableField label="Plataforma Comunicacao" value={data.plataforma_comunicacao} fieldKey="plataforma_comunicacao" inputType="select" options={options?.plataforma_comunicacao} canEdit={canEdit} onSave={handleToolSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          <EditableField label="Plataforma ACD" value={data.plataforma_acd} fieldKey="plataforma_acd" inputType="select" options={options?.plataforma_acd} canEdit={canEdit} onSave={handleToolSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
        </div>
        <div className="ppv-edit-grid ppv-edit-grid-toggles">
          {toolToggles.map(t => (
            <EditableField key={t.key} label={t.label} value={data[t.key]} fieldKey={t.key} inputType="toggle" canEdit={canEdit} onSave={handleToolSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          ))}
        </div>
        <div className="ppv-edit-grid">
          {toolIds.map(t => (
            <EditableField key={t.key} label={t.label} value={data[t.key]} fieldKey={t.key} canEdit={canEdit} onSave={handleToolSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          ))}
        </div>
        <div className="ppv-edit-grid ppv-edit-grid-links">
          {toolUrls.map(t => (
            <EditableField key={t.key} label={t.label} value={data[t.key]} fieldKey={t.key} inputType="link" canEdit={canEdit} onSave={handleToolSave} savedCell={savedCell} errorCell={errorCell} projectCode={projectCode} />
          ))}
        </div>
      </CollapsibleSection>

      {/* ===== ENTREGAVEIS OTUS ===== */}
      {(data.entregaveis_otus?.length > 0) && (
        <CollapsibleSection title="Entregaveis Otus">
          <div className="ppv-chars-grid">
            {data.entregaveis_otus.map(name => (
              <div key={name} className="ppv-char-item">
                <span className="ppv-char-value">{name}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

export default PortfolioProjetoView;

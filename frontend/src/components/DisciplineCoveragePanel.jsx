/**
 * Componente: Painel de Controle de Disciplinas (Redesign v3)
 *
 * Layout orientado a AÇÕES com 5 categorias:
 * 1. Cadastrar na Otus (alta prioridade) - disciplinas em SS+CF mas não na Otus
 * 2. Falta Vincular ou Cadastrar (média prioridade) - disciplinas só num sistema externo, sem Otus
 * 3. Falta Alocar (informacional) - disciplinas já na Otus, falta sistema externo
 * 4. Cadastradas mas não alocadas - disciplinas somente na Otus
 * 5. Regularizado - disciplinas presentes em todos os 3 sistemas
 */

import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/DisciplineCoveragePanel.css';

// ===== SVG Icons =====

const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const UserIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ===== Progress Ring =====

function ProgressRing({ percentage, complete, total }) {
  const size = 72;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  let color;
  if (percentage >= 100) color = '#16a34a';
  else if (percentage >= 80) color = '#16a34a';
  else if (percentage >= 50) color = '#d97706';
  else color = '#dc2626';

  return (
    <div className="dcov-ring-wrapper" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="dcov-ring-svg">
        <circle
          className="dcov-ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="dcov-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
            stroke: color,
          }}
        />
      </svg>
      <div className="dcov-ring-center">
        <span className="dcov-ring-percent" style={{ color }}>{percentage}%</span>
        <span className="dcov-ring-label">Cobertura</span>
      </div>
    </div>
  );
}

// ===== Action Summary Strip =====

function ActionSummaryStrip({ cadastrarCount, faltaCadastrarCount, faltaAlocarCount, regularizadoCount, sectionRefs }) {
  const scrollTo = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="dcov-strip">
      <button
        type="button"
        className={`dcov-pill dcov-pill--red${cadastrarCount === 0 ? ' dcov-pill--muted' : ''}`}
        onClick={() => scrollTo(sectionRefs.cadastrar)}
        disabled={cadastrarCount === 0}
      >
        <span className="dcov-pill-icon"><AlertCircleIcon /></span>
        <span className="dcov-pill-text">
          <span className="dcov-pill-count">{cadastrarCount}</span>
          <span className="dcov-pill-label">Cadastrar</span>
        </span>
      </button>

      <button
        type="button"
        className={`dcov-pill dcov-pill--amber${faltaCadastrarCount === 0 ? ' dcov-pill--muted' : ''}`}
        onClick={() => scrollTo(sectionRefs.faltaCadastrar)}
        disabled={faltaCadastrarCount === 0}
      >
        <span className="dcov-pill-icon"><PlusIcon /></span>
        <span className="dcov-pill-text">
          <span className="dcov-pill-count">{faltaCadastrarCount}</span>
          <span className="dcov-pill-label">Vincular/Cadastrar</span>
        </span>
      </button>

      <button
        type="button"
        className={`dcov-pill dcov-pill--amber${faltaAlocarCount === 0 ? ' dcov-pill--muted' : ''}`}
        onClick={() => scrollTo(sectionRefs.faltaAlocar)}
        disabled={faltaAlocarCount === 0}
      >
        <span className="dcov-pill-icon"><SearchIcon /></span>
        <span className="dcov-pill-text">
          <span className="dcov-pill-count">{faltaAlocarCount}</span>
          <span className="dcov-pill-label">Falta Alocar</span>
        </span>
      </button>

      <button
        type="button"
        className={`dcov-pill dcov-pill--green${regularizadoCount === 0 ? ' dcov-pill--muted' : ''}`}
        onClick={() => scrollTo(sectionRefs.regularizado)}
        disabled={regularizadoCount === 0}
      >
        <span className="dcov-pill-icon"><CheckIcon size={14} /></span>
        <span className="dcov-pill-text">
          <span className="dcov-pill-count">{regularizadoCount}</span>
          <span className="dcov-pill-label">Regularizado</span>
        </span>
      </button>
    </div>
  );
}

// ===== Collapsible Section =====

function CollapsibleSection({ title, count, variant, defaultOpen, children, sectionRef }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`dcov-section dcov-section--${variant}`} ref={sectionRef}>
      <button
        type="button"
        className="dcov-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="dcov-section-header-dot" />
        {title}
        <span className="dcov-section-header-count">({count})</span>
        <span className={`dcov-section-chevron${open ? ' dcov-section-chevron--open' : ''}`}>
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="dcov-section-body">
          {children}
        </div>
      )}
    </div>
  );
}

// ===== Main Component =====

function DisciplineCoveragePanel({ data, loading, onQuickAdd, standardDisciplines = [], projectId, onMappingChange }) {
  const [expandedMapping, setExpandedMapping] = useState(null);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);
  const [savingClient, setSavingClient] = useState(null);

  // Refs for scroll-to
  const cadastrarRef = useRef(null);
  const faltaCadastrarRef = useRef(null);
  const faltaAlocarRef = useRef(null);
  const naoAlocadasRef = useRef(null);
  const regularizadoRef = useRef(null);

  // Save mapping (always standard - no free text)
  const handleSaveMapping = async (discipline) => {
    if (!selectedDisciplineId || !projectId) return;

    setSavingMapping(true);
    try {
      const source = discipline.inConstruflow ? 'construflow' : 'smartsheet';
      const sources = [];
      if (discipline.inSmartsheet) sources.push('smartsheet');
      if (discipline.inConstruflow) sources.push('construflow');

      const payload = {
        construflowId: projectId,
        externalSource: source,
        externalDisciplineName: discipline.name,
        standardDisciplineId: selectedDisciplineId,
        sources: sources.length > 1 ? sources : undefined,
      };

      await axios.post(`${API_URL}/api/projetos/equipe/mapeamentos-disciplinas`, payload, { withCredentials: true });
      setExpandedMapping(null);
      setSelectedDisciplineId('');
      if (onMappingChange) onMappingChange();
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
    } finally {
      setSavingMapping(false);
    }
  };

  // Mark as client-owned
  const handleMarkAsClient = async (d) => {
    if (!projectId) return;
    setSavingClient(d.normKey);
    try {
      const source = d.inConstruflow ? 'construflow' : 'smartsheet';
      const sources = [];
      if (d.inSmartsheet) sources.push('smartsheet');
      if (d.inConstruflow) sources.push('construflow');

      await axios.post(`${API_URL}/api/projetos/equipe/mapeamentos-disciplinas`, {
        construflowId: projectId,
        externalSource: source,
        externalDisciplineName: d.name,
        isClientOwned: true,
        sources: sources.length > 1 ? sources : undefined,
      }, { withCredentials: true });
      if (onMappingChange) onMappingChange();
    } catch (error) {
      console.error('Erro ao marcar como cliente:', error);
    } finally {
      setSavingClient(null);
    }
  };

  // Remove mapping
  const handleRemoveMapping = async (mappingId) => {
    try {
      await axios.delete(`${API_URL}/api/projetos/equipe/mapeamentos-disciplinas/${mappingId}`, { withCredentials: true });
      if (onMappingChange) onMappingChange();
    } catch (error) {
      console.error('Erro ao remover mapeamento:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="dcov-panel dcov-panel--loading">
        <div className="dcov-hero">
          <div className="dcov-hero-text">
            <h4 className="dcov-panel-title">Controle de Disciplinas</h4>
          </div>
        </div>
        <div className="dcov-loading" role="status">
          <div className="dcov-loading-spinner" />
          <span>Analisando disciplinas nos sistemas...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { smartsheet, construflow, otus, analysis, groups } = data;
  const hasExternalData = smartsheet.length > 0 || construflow.length > 0;

  if (!hasExternalData && otus.length === 0) {
    return (
      <div className="dcov-panel dcov-panel--empty">
        <div className="dcov-hero">
          <h4 className="dcov-panel-title">Controle de Disciplinas</h4>
        </div>
        <p className="dcov-empty-text">
          Nenhuma disciplina encontrada nos sistemas externos para este projeto.
        </p>
      </div>
    );
  }

  // ===== Data transformation: sub-groups =====
  const g = groups || {};

  const cadastrarNaOtus = g.notInOtus || [];

  // Falta Vincular ou Cadastrar: não tem Otus, precisa registrar
  const faltaCadastrar = [
    { key: 'onlySmartsheet', label: 'Somente Smartsheet', items: (g.onlySmartsheet || []).map(d => ({ ...d, _tag: 'Somente no Smartsheet', _tagColor: 'orange' })) },
    { key: 'onlyConstruflow', label: 'Somente ConstruFlow', items: (g.onlyConstruflow || []).map(d => ({ ...d, _tag: 'Somente no ConstruFlow', _tagColor: 'orange' })) },
  ].filter(grp => grp.items.length > 0);

  const faltaCadastrarCount = faltaCadastrar.reduce((sum, grp) => sum + grp.items.length, 0);

  // Falta Alocar: já tem Otus, falta sistema externo
  const faltaAlocar = [
    { key: 'missingConstruflow', label: 'Falta no ConstruFlow', items: (g.missingConstruflow || []).map(d => ({ ...d, _tag: 'Falta no ConstruFlow', _tagColor: 'yellow' })) },
    { key: 'missingSmartsheet', label: 'Falta no Smartsheet', items: (g.missingSmartsheet || []).map(d => ({ ...d, _tag: 'Falta no Smartsheet', _tagColor: 'yellow' })) },
  ].filter(grp => grp.items.length > 0);

  const faltaAlocarCount = faltaAlocar.reduce((sum, grp) => sum + grp.items.length, 0);

  // "Somente Otus" — separate informational section
  const naoAlocadas = g.onlyOtus || [];

  const regularizado = g.completeInAll3 || [];

  // Render inline mapping form (standard only, no free text)
  const renderMappingForm = (discipline) => (
    <div className="dcov-mapping-row">
      <div className="dcov-mapping-content">
        <span className="dcov-mapping-label">
          Conectar &ldquo;{discipline.name}&rdquo; a:
        </span>

        <div className="dcov-mapping-controls">
          <select
            className="dcov-mapping-select"
            value={selectedDisciplineId}
            onChange={(e) => setSelectedDisciplineId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {standardDisciplines
              .filter(sd => otus.includes(sd.discipline_name))
              .map(sd => (
                <option key={sd.id} value={sd.id}>
                  {sd.discipline_name}{sd.short_name ? ` (${sd.short_name})` : ''}
                </option>
              ))}
          </select>
          <button
            className="dcov-mapping-btn dcov-mapping-btn--save"
            onClick={() => handleSaveMapping(discipline)}
            disabled={savingMapping || !selectedDisciplineId}
          >
            {savingMapping ? 'Salvando...' : 'Salvar'}
          </button>
          <button
            className="dcov-mapping-btn dcov-mapping-btn--cancel"
            onClick={() => {
              setExpandedMapping(null);
              setSelectedDisciplineId('');
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  // Render custom mapping badge (existing mappings, including legacy free-text)
  const renderMappingBadge = (d) => {
    if (!d.hasCustomMapping || !d.mappedToName) return null;
    return (
      <span
        className={`dcov-custom-badge${d.isFreeMapping ? ' dcov-custom-badge--free' : ''}`}
        title={
          d.isFreeMapping
            ? `Mapeamento livre: "${d.name}" \u2192 "${d.mappedToName}"`
            : `Conectado \u00e0 disciplina Otus "${d.mappedToName}"`
        }
      >
        <LinkIcon /> {d.mappedToName}
        <button
          className="dcov-custom-badge-remove"
          onClick={() => handleRemoveMapping(d.mappingId)}
          title="Remover conex\u00e3o"
          aria-label={`Remover mapeamento de ${d.name}`}
        >
          <CloseIcon />
        </button>
      </span>
    );
  };

  // Client-owned button
  const renderClientButton = (d) => {
    if (d.isClientOwned || d.hasCustomMapping) return null;
    return (
      <button
        className="dcov-btn-client"
        onClick={() => handleMarkAsClient(d)}
        disabled={savingClient === d.normKey}
        aria-label={`Marcar ${d.name} como do cliente`}
      >
        <UserIcon /> {savingClient === d.normKey ? '...' : 'Cliente'}
      </button>
    );
  };

  // Render a discipline card for "Cadastrar" section
  const renderCadastrarCard = (d) => {
    const isExpanded = expandedMapping === d.normKey;
    const canRegisterInOtus = !d.inOtus && !d.hasCustomMapping;
    const canLinkMapping = !d.hasCustomMapping;

    return (
      <React.Fragment key={d.normKey}>
        <div className="dcov-card dcov-card--high">
          <div className="dcov-card-info">
            <div className="dcov-card-name">
              {d.name}
              {renderMappingBadge(d)}
            </div>
            <div className="dcov-card-desc">Presente no Smartsheet e ConstruFlow, falta na Otus</div>
          </div>
          <div className="dcov-card-actions">
            {canRegisterInOtus && onQuickAdd && (
              <button
                className="dcov-btn-primary"
                onClick={() => onQuickAdd(d.name)}
                aria-label={`Cadastrar ${d.name} na Otus`}
              >
                <PlusIcon /> Cadastrar
              </button>
            )}
            {canLinkMapping && standardDisciplines.length > 0 && (
              <button
                className="dcov-btn-secondary"
                onClick={() => {
                  setExpandedMapping(isExpanded ? null : d.normKey);
                  setSelectedDisciplineId('');
                }}
                aria-label={`Vincular ${d.name}`}
              >
                <LinkIcon /> Vincular
              </button>
            )}
            {renderClientButton(d)}
          </div>
        </div>
        {isExpanded && renderMappingForm(d)}
      </React.Fragment>
    );
  };

  // Render a discipline card for "Falta Cadastrar" section (with Cadastrar + Vincular + Cliente buttons)
  const renderFaltaCadastrarCard = (d) => {
    const isExpanded = expandedMapping === d.normKey;
    const canLinkMapping = !d.hasCustomMapping;

    return (
      <React.Fragment key={d.normKey}>
        <div className="dcov-card dcov-card--medium">
          <div className="dcov-card-info">
            <div className="dcov-card-name">
              {d.name}
              {d._tag && (
                <span className={`dcov-card-tag dcov-card-tag--${d._tagColor}`}>
                  {d._tag}
                </span>
              )}
              {renderMappingBadge(d)}
            </div>
          </div>
          <div className="dcov-card-actions">
            {!d.inOtus && !d.hasCustomMapping && onQuickAdd && (
              <button
                className="dcov-btn-primary"
                onClick={() => onQuickAdd(d.name)}
                aria-label={`Cadastrar ${d.name} na Otus`}
              >
                <PlusIcon /> Cadastrar
              </button>
            )}
            {canLinkMapping && standardDisciplines.length > 0 && (
              <button
                className="dcov-btn-secondary"
                onClick={() => {
                  setExpandedMapping(isExpanded ? null : d.normKey);
                  setSelectedDisciplineId('');
                }}
                aria-label={`Vincular ${d.name}`}
              >
                <LinkIcon /> Vincular
              </button>
            )}
            {renderClientButton(d)}
          </div>
        </div>
        {isExpanded && renderMappingForm(d)}
      </React.Fragment>
    );
  };

  // Render a discipline card for "Falta Alocar" section (informational only, no action buttons)
  const renderFaltaAlocarCard = (d) => (
    <div key={d.normKey} className="dcov-card dcov-card--medium">
      <div className="dcov-card-info">
        <div className="dcov-card-name">
          {d.name}
          {d._tag && (
            <span className={`dcov-card-tag dcov-card-tag--${d._tagColor}`}>
              {d._tag}
            </span>
          )}
          {renderMappingBadge(d)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="dcov-panel">
      {/* A: Hero - Title + Progress Ring */}
      <div className="dcov-hero">
        <div className="dcov-hero-text">
          <h4 className="dcov-panel-title">Controle de Disciplinas</h4>
          <p className="dcov-hero-subtitle">
            <strong>{analysis.completeInAll3 || 0}</strong> de <strong>{analysis.totalUnique || 0}</strong> disciplinas regularizadas nos 3 sistemas
          </p>
        </div>
        {hasExternalData && (
          <ProgressRing
            percentage={analysis.completionPercentage || 0}
            complete={analysis.completeInAll3 || 0}
            total={analysis.totalUnique || 0}
          />
        )}
      </div>

      <div className="dcov-panel-body">
        {/* B: Action Summary Strip */}
        <ActionSummaryStrip
          cadastrarCount={cadastrarNaOtus.length}
          faltaCadastrarCount={faltaCadastrarCount}
          faltaAlocarCount={faltaAlocarCount}
          regularizadoCount={regularizado.length}
          sectionRefs={{
            cadastrar: cadastrarRef,
            faltaCadastrar: faltaCadastrarRef,
            faltaAlocar: faltaAlocarRef,
            regularizado: regularizadoRef,
          }}
        />

        {/* C: Cadastrar na Otus (always open) */}
        {cadastrarNaOtus.length > 0 && (
          <CollapsibleSection
            title="Cadastrar na Otus"
            count={cadastrarNaOtus.length}
            variant="red"
            defaultOpen={true}
            sectionRef={cadastrarRef}
          >
            {cadastrarNaOtus.map(d => renderCadastrarCard(d))}
          </CollapsibleSection>
        )}

        {/* D1: Falta Vincular ou Cadastrar — não tem Otus, precisa registrar */}
        {faltaCadastrarCount > 0 && (
          <CollapsibleSection
            title="Falta Vincular ou Cadastrar"
            count={faltaCadastrarCount}
            variant="amber"
            defaultOpen={cadastrarNaOtus.length === 0}
            sectionRef={faltaCadastrarRef}
          >
            {faltaCadastrar.map(grp => (
              <div key={grp.key} className="dcov-subgroup">
                <div className="dcov-subgroup-header">{grp.label} ({grp.items.length})</div>
                {grp.items.map(d => renderFaltaCadastrarCard(d))}
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* D2: Falta Alocar — já tem Otus, falta sistema externo */}
        {faltaAlocarCount > 0 && (
          <CollapsibleSection
            title="Falta Alocar"
            count={faltaAlocarCount}
            variant="amber"
            defaultOpen={cadastrarNaOtus.length === 0 && faltaCadastrarCount === 0}
            sectionRef={faltaAlocarRef}
          >
            {faltaAlocar.map(grp => (
              <div key={grp.key} className="dcov-subgroup">
                <div className="dcov-subgroup-header">{grp.label} ({grp.items.length})</div>
                {grp.items.map(d => renderFaltaAlocarCard(d))}
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* E: Cadastradas mas não alocadas (onlyOtus) */}
        {naoAlocadas.length > 0 && (
          <CollapsibleSection
            title="CADASTRADAS MAS NÃO ALOCADAS"
            count={naoAlocadas.length}
            variant="blue"
            defaultOpen={false}
            sectionRef={naoAlocadasRef}
          >
            {naoAlocadas.map(d => (
              <div key={d.normKey} className="dcov-completed-row">
                {d.name}
                <span className="dcov-card-tag dcov-card-tag--blue">Somente na Otus</span>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* F: Regularizado (always collapsed) */}
        {regularizado.length > 0 && (
          <CollapsibleSection
            title="Regularizado"
            count={regularizado.length}
            variant="green"
            defaultOpen={false}
            sectionRef={regularizadoRef}
          >
            {regularizado.map(d => (
              <div key={d.normKey} className="dcov-completed-row">
                {d.name}
                <div className="dcov-completed-checks">
                  {d.isAutoOtus && (
                    <span className="dcov-auto-badge" title="Detectado automaticamente como Otus">Auto (Otus)</span>
                  )}
                  {d.isClientOwned && (
                    <span className="dcov-client-badge" title={d.isAutoClient ? 'Detectado automaticamente pelo nome' : 'Responsabilidade do cliente'}>
                      {d.isAutoClient ? 'Auto (Cliente)' : 'Cliente'}
                    </span>
                  )}
                  <span className="dcov-mini-check" title="Smartsheet"><CheckIcon size={12} /></span>
                  <span className="dcov-mini-check" title="ConstruFlow"><CheckIcon size={12} /></span>
                  <span className="dcov-mini-check" title="Otus"><CheckIcon size={12} /></span>
                </div>
              </div>
            ))}
          </CollapsibleSection>
        )}

        {/* G: System Details (collapsible disclosure) */}
        <details className="dcov-disclosure">
          <summary>Detalhes dos Sistemas</summary>
          <div className="dcov-disclosure-body">
            <div className="dcov-system-item dcov-system-item--ss">
              <span className="dcov-system-item-value">{analysis.smartsheetCount || 0}</span>
              <span className="dcov-system-item-label">Smartsheet</span>
            </div>
            <div className="dcov-system-item dcov-system-item--cf">
              <span className="dcov-system-item-value">{analysis.construflowCount || 0}</span>
              <span className="dcov-system-item-label">ConstruFlow</span>
            </div>
            <div className="dcov-system-item dcov-system-item--otus">
              <span className="dcov-system-item-value">{analysis.otusCount || 0}</span>
              <span className="dcov-system-item-label">Otus</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default DisciplineCoveragePanel;

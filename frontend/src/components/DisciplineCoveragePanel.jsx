/**
 * Componente: Painel de Cobertura de Disciplinas
 *
 * Análise cruzada mostrando disciplinas cadastradas em cada sistema:
 * Smartsheet (cronograma), ConstruFlow (issues), Otus (equipe).
 * Destaca disciplinas pendentes e permite mapeamento personalizado.
 */

import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/DisciplineCoveragePanel.css';

// Ícones SVG inline
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 9v4" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Badge de completude colorido
function CompletionBadge({ percentage }) {
  let color, bg;
  if (percentage >= 100) { color = '#a16207'; bg = '#fef9c3'; }
  else if (percentage >= 80) { color = '#15803d'; bg = '#dcfce7'; }
  else if (percentage >= 50) { color = '#a16207'; bg = '#fef3c7'; }
  else { color = '#dc2626'; bg = '#fef2f2'; }

  return (
    <span
      className="dcov-badge"
      style={{ color, background: bg }}
      title={`${percentage}% das disciplinas externas estão presentes em todos os 3 sistemas (Smartsheet, ConstruFlow e Otus)`}
    >
      {percentage >= 100 ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          100%
        </>
      ) : (
        `${percentage}%`
      )}
    </span>
  );
}

// Indicador de status por célula da matriz
function StatusIndicator({ present, missing, mapped }) {
  if (missing) {
    return (
      <span className="dcov-status dcov-status--missing" title="Pendente de registro - requer ação do coordenador">
        <AlertIcon />
      </span>
    );
  }
  if (present) {
    return (
      <span
        className={`dcov-status dcov-status--present${mapped ? ' dcov-status--mapped' : ''}`}
        title={mapped ? `Conectado manualmente a "${mapped}"` : 'Presente neste sistema'}
      >
        <CheckIcon />
      </span>
    );
  }
  return (
    <span className="dcov-status dcov-status--absent" title="Não encontrado neste sistema">
      <DashIcon />
    </span>
  );
}

function DisciplineCoveragePanel({ data, loading, onQuickAdd, standardDisciplines = [], projectId, onMappingChange }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedMapping, setExpandedMapping] = useState(null);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

  // Salva mapeamento personalizado
  const handleSaveMapping = async (discipline) => {
    if (!selectedDisciplineId || !projectId) return;
    setSavingMapping(true);
    try {
      const source = discipline.inConstruflow ? 'construflow' : 'smartsheet';
      await axios.post(`${API_URL}/api/projetos/equipe/mapeamentos-disciplinas`, {
        construflowId: projectId,
        externalSource: source,
        externalDisciplineName: discipline.name,
        standardDisciplineId: selectedDisciplineId
      }, { withCredentials: true });
      setExpandedMapping(null);
      setSelectedDisciplineId('');
      if (onMappingChange) onMappingChange();
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
    } finally {
      setSavingMapping(false);
    }
  };

  // Remove mapeamento personalizado
  const handleRemoveMapping = async (mappingId) => {
    try {
      await axios.delete(`${API_URL}/api/projetos/equipe/mapeamentos-disciplinas/${mappingId}`, { withCredentials: true });
      if (onMappingChange) onMappingChange();
    } catch (error) {
      console.error('Erro ao remover mapeamento:', error);
    }
  };

  if (loading) {
    return (
      <div className="dcov-panel dcov-panel--loading">
        <div className="dcov-panel-header">
          <div className="dcov-panel-title-row">
            <h4 className="dcov-panel-title">Cobertura de Disciplinas</h4>
          </div>
        </div>
        <div className="dcov-loading">
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
        <div className="dcov-panel-header">
          <h4 className="dcov-panel-title">Cobertura de Disciplinas</h4>
        </div>
        <p className="dcov-empty-text">
          Nenhuma disciplina encontrada nos sistemas externos para este projeto.
        </p>
      </div>
    );
  }

  // Sub-grupos do backend
  const g = groups || {};
  const completeList = g.completeInAll3 || [];

  // Sub-grupos de pendências (ordem: vermelho → laranja → amarelo)
  const pendencySubgroups = [
    { key: 'notInOtus', items: g.notInOtus || [], label: 'Somente não na Otus', tooltip: 'Presente no Smartsheet e ConstruFlow, mas NÃO registrada na Otus. Registre ou conecte manualmente', color: 'red' },
    { key: 'onlySmartsheet', items: g.onlySmartsheet || [], label: 'Somente no Smartsheet', tooltip: 'Presente apenas no Smartsheet. Falta no ConstruFlow e na Otus', color: 'orange' },
    { key: 'onlyConstruflow', items: g.onlyConstruflow || [], label: 'Somente no ConstruFlow', tooltip: 'Presente apenas no ConstruFlow. Falta no Smartsheet e na Otus', color: 'orange' },
    { key: 'onlyOtus', items: g.onlyOtus || [], label: 'Somente na Otus', tooltip: 'Cadastrada na Otus mas não encontrada no Smartsheet nem no ConstruFlow. Pode indicar nome divergente nos sistemas externos', color: 'orange' },
    { key: 'missingConstruflow', items: g.missingConstruflow || [], label: 'Falta no ConstruFlow', tooltip: 'Presente no Smartsheet e Otus, mas não encontrada no ConstruFlow', color: 'yellow' },
    { key: 'missingSmartsheet', items: g.missingSmartsheet || [], label: 'Falta no Smartsheet', tooltip: 'Presente no ConstruFlow e Otus, mas não encontrada no Smartsheet', color: 'yellow' },
  ].filter(sg => sg.items.length > 0);

  const totalPending = pendencySubgroups.reduce((sum, sg) => sum + sg.items.length, 0);

  // Renderiza uma linha da matriz
  const renderDisciplineRow = (d, groupType) => {
    const isAction = groupType === 'pending';
    const isExpanded = expandedMapping === d.normKey;
    const canRegisterInOtus = !d.inOtus && !d.hasCustomMapping;
    const canLinkMapping = !d.hasCustomMapping;

    return (
      <React.Fragment key={d.normKey}>
        <div className={`dcov-matrix-row${isAction ? ' dcov-matrix-row--action' : ''}`}>
          <div className="dcov-matrix-col-name">
            {d.name}
            {d.hasCustomMapping && d.mappedToName && (
              <span
                className="dcov-custom-badge"
                title={`Esta disciplina foi conectada manualmente à disciplina Otus "${d.mappedToName}"`}
              >
                <LinkIcon /> {d.mappedToName}
                <button
                  className="dcov-custom-badge-remove"
                  onClick={() => handleRemoveMapping(d.mappingId)}
                  title="Remover conexão personalizada"
                >
                  <CloseIcon />
                </button>
              </span>
            )}
          </div>
          <div className="dcov-matrix-col-system">
            <StatusIndicator present={d.inSmartsheet} />
          </div>
          <div className="dcov-matrix-col-system">
            <StatusIndicator present={d.inConstruflow} />
          </div>
          <div className="dcov-matrix-col-system">
            {d.inOtus ? (
              <StatusIndicator present={true} mapped={d.hasCustomMapping ? d.mappedToName : null} />
            ) : (
              <StatusIndicator missing={isAction} present={false} />
            )}
          </div>
          <div className="dcov-matrix-col-action">
            {isAction && (
              <div className="dcov-action-buttons">
                {canRegisterInOtus && onQuickAdd && (
                  <button
                    className="dcov-quick-add"
                    onClick={() => onQuickAdd(d.name)}
                    title="Cadastrar esta disciplina na equipe do projeto (cria novo registro na Otus)"
                  >
                    <PlusIcon />
                  </button>
                )}
                {canLinkMapping && standardDisciplines.length > 0 && (
                  <button
                    className="dcov-mapping-toggle"
                    onClick={() => {
                      setExpandedMapping(isExpanded ? null : d.normKey);
                      setSelectedDisciplineId('');
                    }}
                    title="Vincular esta disciplina externa a uma disciplina padrão Otus (nomes diferentes, mesma disciplina)"
                  >
                    <LinkIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dropdown inline de mapeamento */}
        {isExpanded && (
          <div className="dcov-mapping-row">
            <div className="dcov-mapping-content">
              <span className="dcov-mapping-label">
                Conectar "{d.name}" a qual disciplina Otus?
              </span>
              <div className="dcov-mapping-controls">
                <select
                  className="dcov-mapping-select"
                  value={selectedDisciplineId}
                  onChange={(e) => setSelectedDisciplineId(e.target.value)}
                  title="Selecione a disciplina Otus equivalente a esta disciplina externa"
                >
                  <option value="">Selecione...</option>
                  {standardDisciplines.map(sd => (
                    <option key={sd.id} value={sd.id}>
                      {sd.discipline_name}{sd.short_name ? ` (${sd.short_name})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  className="dcov-mapping-btn dcov-mapping-btn--save"
                  onClick={() => handleSaveMapping(d)}
                  disabled={!selectedDisciplineId || savingMapping}
                  title="Salvar conexão entre as disciplinas"
                >
                  {savingMapping ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  className="dcov-mapping-btn dcov-mapping-btn--cancel"
                  onClick={() => { setExpandedMapping(null); setSelectedDisciplineId(''); }}
                  title="Cancelar mapeamento"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="dcov-panel">
      {/* Header */}
      <div className="dcov-panel-header" onClick={() => setExpanded(!expanded)} role="button" tabIndex={0}>
        <div className="dcov-panel-title-row">
          <div className="dcov-panel-title-left">
            <h4 className="dcov-panel-title">Cobertura de Disciplinas</h4>
            {hasExternalData && (
              <CompletionBadge percentage={analysis.completionPercentage} />
            )}
          </div>
          <ChevronIcon open={expanded} />
        </div>
      </div>

      {expanded && (
        <div className="dcov-panel-body">
          {/* Summary Cards */}
          <div className="dcov-summary-cards">
            <div className="dcov-card" title="Total de disciplinas únicas encontradas em todos os sistemas combinados">
              <span className="dcov-card-value">{analysis.totalUnique || 0}</span>
              <span className="dcov-card-label">Total Encontradas</span>
            </div>
            <div className="dcov-card dcov-card--success" title="Disciplinas presentes em todos os 3 sistemas: Smartsheet, ConstruFlow e Otus">
              <span className="dcov-card-value">{analysis.completeInAll3 || 0}</span>
              <span className="dcov-card-label">Completo (3/3)</span>
            </div>
            <div
              className={`dcov-card ${totalPending > 0 ? 'dcov-card--danger' : 'dcov-card--success'}`}
              title="Disciplinas que faltam em pelo menos 1 dos 3 sistemas - requerem ação"
            >
              <span className="dcov-card-value">{totalPending}</span>
              <span className="dcov-card-label">Pendentes</span>
            </div>
          </div>

          {/* Discipline Matrix */}
          <div className="dcov-matrix">
            {/* Column headers */}
            <div className="dcov-matrix-header">
              <div className="dcov-matrix-col-name" title="Nome da disciplina conforme registrado nos sistemas">Disciplina</div>
              <div className="dcov-matrix-col-system">
                <span className="dcov-system-label dcov-system-label--ss" title="Disciplinas encontradas no cronograma Smartsheet do projeto">Smartsheet</span>
              </div>
              <div className="dcov-matrix-col-system">
                <span className="dcov-system-label dcov-system-label--cf" title="Disciplinas com apontamentos registrados no ConstruFlow">ConstruFlow</span>
              </div>
              <div className="dcov-matrix-col-system">
                <span className="dcov-system-label dcov-system-label--otus" title="Disciplinas cadastradas na equipe do projeto na plataforma Otus">Otus</span>
              </div>
              <div className="dcov-matrix-col-action"></div>
            </div>

            {/* Pending Group - Requer Atenção com sub-grupos */}
            {totalPending > 0 && (
              <div className="dcov-group dcov-group--action">
                <div
                  className="dcov-group-label"
                  title="Disciplinas que NÃO estão registradas em todos os 3 sistemas. Requerem ação do coordenador"
                >
                  <span className="dcov-group-dot dcov-group-dot--action" />
                  Requer Atenção ({totalPending})
                </div>

                {pendencySubgroups.map(sg => (
                  <React.Fragment key={sg.key}>
                    <div
                      className={`dcov-subgroup-label dcov-subgroup--${sg.color}`}
                      title={sg.tooltip}
                    >
                      <span className={`dcov-subgroup-dot dcov-subgroup-dot--${sg.color}`} />
                      {sg.label} ({sg.items.length})
                    </div>
                    {sg.items.map(d => renderDisciplineRow(d, 'pending'))}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Complete Group */}
            {completeList.length > 0 && (
              <div className="dcov-group dcov-group--complete">
                <div
                  className="dcov-group-label"
                  title="Disciplinas presentes nos 3 sistemas: Smartsheet, ConstruFlow e Otus. Nenhuma ação necessária"
                >
                  <span className="dcov-group-dot dcov-group-dot--complete" />
                  Completo ({completeList.length})
                </div>
                {completeList.map(d => renderDisciplineRow(d, 'complete'))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="dcov-legend" title="Legenda dos indicadores de status do painel">
            <div className="dcov-legend-item">
              <span className="dcov-status dcov-status--present" style={{ width: 20, height: 20 }}><CheckIcon /></span>
              <span>Presente</span>
            </div>
            <div className="dcov-legend-item">
              <span className="dcov-status dcov-status--absent" style={{ width: 20, height: 20 }}><DashIcon /></span>
              <span>Ausente</span>
            </div>
            <div className="dcov-legend-item">
              <span className="dcov-status dcov-status--missing" style={{ width: 20, height: 20, animation: 'none' }}><AlertIcon /></span>
              <span>Pendente</span>
            </div>
            <div className="dcov-legend-item">
              <span className="dcov-custom-badge" style={{ fontSize: '0.6rem' }}><LinkIcon /> Mapeado</span>
              <span>Conexão manual</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DisciplineCoveragePanel;

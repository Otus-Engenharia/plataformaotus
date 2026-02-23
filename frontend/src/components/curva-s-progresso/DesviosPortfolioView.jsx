/**
 * Componente: DesviosPortfolioView
 *
 * Vista consolidada de desvios de todos os projetos do portfolio.
 * Exibida como aba em IndicadoresView.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { usePortfolio } from '../../contexts/PortfolioContext';
import { CHANGE_TYPE_CONFIG } from './changeLogColors';
import '../../styles/DesviosPortfolioView.css';

function DesviosPortfolioView() {
  const { data: portfolioData, timeFilter, liderFilter } = usePortfolio();
  const [changelog, setChangelog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros locais
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [expandedProject, setExpandedProject] = useState(null);

  // Mapear ID_Projeto → metadata do portfolio
  const projectMeta = useMemo(() => {
    const map = new Map();
    for (const p of (portfolioData || [])) {
      const id = p.smartsheet_id ? String(p.smartsheet_id) : null;
      if (id) map.set(id, p);
    }
    return map;
  }, [portfolioData]);

  // IDs de todos os projetos do portfolio (já filtrado por líder no backend)
  const allProjectIds = useMemo(() => {
    return (portfolioData || [])
      .filter(p => p.smartsheet_id)
      .map(p => String(p.smartsheet_id));
  }, [portfolioData]);

  // IDs filtrados pelos filtros de Time/Lider do PortfolioContext
  const filteredProjectIds = useMemo(() => {
    const ids = [];
    for (const p of (portfolioData || [])) {
      if (!p.smartsheet_id) continue;
      if (timeFilter.length > 0 && !timeFilter.includes(p.nome_time)) continue;
      if (liderFilter.length > 0 && !liderFilter.includes(p.lider)) continue;
      ids.push(String(p.smartsheet_id));
    }
    return ids;
  }, [portfolioData, timeFilter, liderFilter]);

  const fetchData = useCallback(async () => {
    if (allProjectIds.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('projectIds', allProjectIds.join(','));
      const res = await axios.get(`${API_URL}/api/curva-s-progresso/portfolio/changelog?${params}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setChangelog(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar desvios do portfolio:', err);
      setError(err.response?.data?.error || 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  }, [allProjectIds]);

  useEffect(() => {
    if (allProjectIds.length > 0) {
      fetchData();
    }
  }, [fetchData]);

  // Filtrar projetos por Time/Lider e período/tipo
  const filteredData = useMemo(() => {
    if (!changelog) return null;

    const filterSet = filteredProjectIds.length > 0 ? new Set(filteredProjectIds) : null;

    const byProject = changelog.by_project
      .filter(p => !filterSet || filterSet.has(p.project_id))
      .map(proj => {
        // Filtrar month_pairs por período
        let pairs = proj.month_pairs;
        if (selectedPeriod !== 'all') {
          pairs = pairs.filter(mp => mp.to_snapshot === selectedPeriod);
        }

        // Filtrar changes por tipo
        if (selectedType !== 'all') {
          pairs = pairs.map(mp => ({
            ...mp,
            changes: mp.changes.filter(c => c.type === selectedType),
            summary: undefined,
          })).filter(mp => mp.changes.length > 0);
        }

        // Recalcular summary
        const totalChanges = pairs.reduce((s, mp) => s + mp.changes.length, 0);
        const totalDesvios = pairs.reduce((s, mp) => s + mp.changes.filter(c => c.type === 'DESVIO_PRAZO').length, 0);
        const totalCriadas = pairs.reduce((s, mp) => s + mp.changes.filter(c => c.type === 'TAREFA_CRIADA').length, 0);
        const totalDeletadas = pairs.reduce((s, mp) => s + mp.changes.filter(c => c.type === 'TAREFA_DELETADA').length, 0);
        const totalNaoFeitas = pairs.reduce((s, mp) => s + mp.changes.filter(c => c.type === 'TAREFA_NAO_FEITA').length, 0);

        return {
          ...proj,
          month_pairs: pairs,
          filtered_summary: { total: totalChanges, desvios: totalDesvios, criadas: totalCriadas, deletadas: totalDeletadas, nao_feitas: totalNaoFeitas },
        };
      })
      .filter(p => p.filtered_summary.total > 0)
      .sort((a, b) => b.filtered_summary.total - a.filtered_summary.total);

    // Agregar summary
    const summary = {
      total_projects: byProject.length,
      total_changes: byProject.reduce((s, p) => s + p.filtered_summary.total, 0),
      total_desvios: byProject.reduce((s, p) => s + p.filtered_summary.desvios, 0),
      total_criadas: byProject.reduce((s, p) => s + p.filtered_summary.criadas, 0),
      total_deletadas: byProject.reduce((s, p) => s + p.filtered_summary.deletadas, 0),
      total_nao_feitas: byProject.reduce((s, p) => s + p.filtered_summary.nao_feitas, 0),
    };

    // Agregar disciplinas
    const discMap = new Map();
    for (const proj of byProject) {
      for (const mp of proj.month_pairs) {
        for (const ch of mp.changes) {
          const disc = ch.disciplina || 'Sem disciplina';
          if (!discMap.has(disc)) discMap.set(disc, { disciplina: disc, total: 0, desvios: 0, criadas: 0, deletadas: 0, nao_feitas: 0, total_desvio_dias: 0 });
          const d = discMap.get(disc);
          d.total++;
          if (ch.type === 'DESVIO_PRAZO') { d.desvios++; d.total_desvio_dias += Math.abs(ch.delta_days || 0); }
          if (ch.type === 'TAREFA_CRIADA') d.criadas++;
          if (ch.type === 'TAREFA_DELETADA') d.deletadas++;
          if (ch.type === 'TAREFA_NAO_FEITA') d.nao_feitas++;
        }
      }
    }
    const disciplineScores = [...discMap.values()].sort((a, b) => b.total - a.total);

    return { by_project: byProject, summary, discipline_scores: disciplineScores };
  }, [changelog, filteredProjectIds, selectedPeriod, selectedType]);

  // Extrair períodos disponíveis para o dropdown
  const availablePeriods = useMemo(() => {
    if (!changelog) return [];
    const periods = new Set();
    for (const proj of changelog.by_project) {
      for (const mp of proj.month_pairs) {
        periods.add(mp.to_snapshot);
      }
    }
    return [...periods].sort().reverse();
  }, [changelog]);

  const getProjectName = (projectId) => {
    const meta = projectMeta.get(projectId);
    if (meta) return meta.project_name || meta.project_code_norm || projectId;
    return projectId;
  };

  const formatPeriodLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const label = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  if (loading) {
    return (
      <div className="desvios-portfolio">
        <div className="desvios-loading">Carregando análise de desvios do portfolio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="desvios-portfolio">
        <div className="desvios-error">
          {error}
          <button onClick={fetchData} className="desvios-retry-btn">Tentar novamente</button>
        </div>
      </div>
    );
  }

  if (!filteredData) return null;

  const { summary, by_project, discipline_scores } = filteredData;

  return (
    <div className="desvios-portfolio">
      {/* Filtros locais */}
      <div className="desvios-filters">
        <div className="desvios-filter-group">
          <label>Período:</label>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            <option value="all">Todos os períodos</option>
            {availablePeriods.map(p => (
              <option key={p} value={p}>{formatPeriodLabel(p)}</option>
            ))}
          </select>
        </div>
        <div className="desvios-filter-group">
          <label>Tipo:</label>
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
            <option value="all">Todos os tipos</option>
            {Object.entries(CHANGE_TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-hero-section">
        <div className="kpi-hero-card kpi-hero-primary">
          <div className="kpi-hero-label">Projetos Analisados</div>
          <div className="kpi-hero-value">{summary.total_projects}</div>
          <div className="kpi-hero-context">com alterações detectadas</div>
        </div>
        <div className="kpi-hero-card kpi-hero-warning">
          <div className="kpi-hero-label">Desvios de Duração</div>
          <div className="kpi-hero-value">{summary.total_desvios}</div>
          <div className="kpi-hero-context">tarefas com duração alterada</div>
        </div>
        <div className="kpi-hero-card">
          <div className="kpi-hero-label">Tarefas Adicionadas</div>
          <div className="kpi-hero-value" style={{ color: '#3B82F6' }}>{summary.total_criadas}</div>
          <div className="kpi-hero-context">novas no escopo</div>
        </div>
        <div className="kpi-hero-card">
          <div className="kpi-hero-label">Tarefas Removidas</div>
          <div className="kpi-hero-value" style={{ color: '#F97316' }}>{summary.total_deletadas}</div>
          <div className="kpi-hero-context">retiradas do escopo</div>
        </div>
        <div className="kpi-hero-card">
          <div className="kpi-hero-label">Total Alterações</div>
          <div className="kpi-hero-value">{summary.total_changes}</div>
          <div className="kpi-hero-context">todos os tipos</div>
        </div>
      </div>

      {/* Ranking de Projetos */}
      <div className="desvios-section">
        <h3 className="desvios-section-title">Ranking de Projetos por Alterações</h3>
        <div className="desvios-table-wrapper">
          <table className="desvios-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Projeto</th>
                <th style={{ color: '#EF4444' }}>Desvios</th>
                <th style={{ color: '#3B82F6' }}>Criadas</th>
                <th style={{ color: '#F97316' }}>Removidas</th>
                <th style={{ color: '#8B5CF6' }}>Não Feitas</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {by_project.map((proj, idx) => {
                const s = proj.filtered_summary;
                const isExpanded = expandedProject === proj.project_id;
                return (
                  <React.Fragment key={proj.project_id}>
                    <tr
                      className={`desvios-project-row ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedProject(isExpanded ? null : proj.project_id)}
                    >
                      <td>{idx + 1}</td>
                      <td className="desvios-project-name">
                        <span className={`desvios-expand-icon ${isExpanded ? 'rotated' : ''}`}>&#9654;</span>
                        {getProjectName(proj.project_id)}
                      </td>
                      <td className="desvios-num" style={{ color: s.desvios > 0 ? '#EF4444' : undefined }}>{s.desvios}</td>
                      <td className="desvios-num" style={{ color: s.criadas > 0 ? '#3B82F6' : undefined }}>{s.criadas}</td>
                      <td className="desvios-num" style={{ color: s.deletadas > 0 ? '#F97316' : undefined }}>{s.deletadas}</td>
                      <td className="desvios-num" style={{ color: s.nao_feitas > 0 ? '#8B5CF6' : undefined }}>{s.nao_feitas}</td>
                      <td className="desvios-num desvios-total">{s.total}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="desvios-detail-row">
                        <td colSpan={7}>
                          <div className="desvios-detail-content">
                            {proj.month_pairs.map(mp => (
                              <div key={mp.to_snapshot} className="desvios-month-group">
                                <div className="desvios-month-label">
                                  {mp.from_label} → {mp.to_label}
                                  <span className="desvios-month-count">{mp.changes.length} alterações</span>
                                </div>
                                <div className="desvios-changes-list">
                                  {mp.changes.slice(0, 20).map((ch, i) => {
                                    const cfg = CHANGE_TYPE_CONFIG[ch.type] || {};
                                    return (
                                      <div key={i} className="desvios-change-item" style={{ borderLeftColor: cfg.color }}>
                                        <span className="desvios-change-badge" style={{ background: cfg.bgColor, color: cfg.color }}>
                                          {cfg.label}
                                        </span>
                                        {ch.delta_days != null && (
                                          <span className="desvios-change-delta" style={{ color: ch.delta_days > 0 ? '#EF4444' : '#10B981' }}>
                                            {ch.delta_days > 0 ? '+' : ''}{ch.delta_days}d
                                          </span>
                                        )}
                                        <span className="desvios-change-task">{ch.task_name}</span>
                                        {ch.disciplina && <span className="desvios-change-disc">{ch.disciplina}</span>}
                                      </div>
                                    );
                                  })}
                                  {mp.changes.length > 20 && (
                                    <div className="desvios-more">...e mais {mp.changes.length - 20} alterações</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumo por Disciplina */}
      {discipline_scores.length > 0 && (
        <div className="desvios-section">
          <h3 className="desvios-section-title">Resumo por Disciplina</h3>
          <div className="desvios-table-wrapper">
            <table className="desvios-table">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th style={{ color: '#EF4444' }}>Desvios</th>
                  <th>Dias desvio</th>
                  <th style={{ color: '#3B82F6' }}>Criadas</th>
                  <th style={{ color: '#F97316' }}>Removidas</th>
                  <th style={{ color: '#8B5CF6' }}>Não Feitas</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {discipline_scores.slice(0, 20).map(ds => (
                  <tr key={ds.disciplina}>
                    <td>{ds.disciplina}</td>
                    <td className="desvios-num" style={{ color: ds.desvios > 0 ? '#EF4444' : undefined }}>{ds.desvios}</td>
                    <td className="desvios-num">{ds.total_desvio_dias > 0 ? `${ds.total_desvio_dias}d` : '-'}</td>
                    <td className="desvios-num" style={{ color: ds.criadas > 0 ? '#3B82F6' : undefined }}>{ds.criadas}</td>
                    <td className="desvios-num" style={{ color: ds.deletadas > 0 ? '#F97316' : undefined }}>{ds.deletadas}</td>
                    <td className="desvios-num" style={{ color: ds.nao_feitas > 0 ? '#8B5CF6' : undefined }}>{ds.nao_feitas}</td>
                    <td className="desvios-num desvios-total">{ds.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default DesviosPortfolioView;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { API_URL } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import PercepcaoFormDialog from './PercepcaoFormDialog';
import '../../styles/PercepcaoEquipe.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ACTIVE_STATUSES = ['planejamento', 'fase 01', 'fase 02', 'fase 03', 'fase 04'];
const isActive = (status) => ACTIVE_STATUSES.includes((status || '').toLowerCase());

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function PercepcaoProjetoTab({ selectedProjectId, portfolio }) {
  const { effectiveUser, hasFullAccess } = useAuth();
  const now = new Date();

  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [selectedTeam, setSelectedTeam] = useState('');
  const [percepcoes, setPercepcoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formProjeto, setFormProjeto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedProject, setExpandedProject] = useState(null);
  const [allYearPercepcoes, setAllYearPercepcoes] = useState([]);

  const isAdmin = hasFullAccess;
  const userTeam = effectiveUser?.team_name || null;
  const userEmail = effectiveUser?.email?.toLowerCase();

  // Portfolio já é filtrado server-side para líderes.
  // O dropdown de time só aparece para admins (que selecionam manualmente).
  // Extract unique teams from portfolio
  const uniqueTeams = useMemo(() => {
    return [...new Set(portfolio.map(p => p.nome_time).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [portfolio]);

  // Fetch percepcoes for the month
  const fetchPercepcoes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/cs/percepcao-equipe?mes=${mes}&ano=${ano}`,
        { withCredentials: true }
      );
      setPercepcoes(res.data?.data || []);
    } catch (err) {
      console.error('Erro ao buscar percepções:', err);
    } finally {
      setLoading(false);
    }
  }, [mes, ano]);

  useEffect(() => {
    fetchPercepcoes();
  }, [fetchPercepcoes]);

  // Fetch all percepcoes for the year (for timeline chart)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(
          `${API_URL}/api/cs/percepcao-equipe?ano=${ano}`,
          { withCredentials: true }
        );
        if (!cancelled) setAllYearPercepcoes(res.data?.data || []);
      } catch (err) {
        console.error('Erro ao buscar percepções anuais:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [ano]);

  // Per-user responded set
  const userRespondedCodes = useMemo(() => {
    if (!userEmail) return new Set();
    return new Set(
      percepcoes
        .filter(p => p.respondente_email?.toLowerCase() === userEmail)
        .map(p => p.project_code)
    );
  }, [percepcoes, userEmail]);

  // Compliance calculation (any response = filled for compliance)
  const { activeProjects, filledProjects, pendingProjects, compliancePercent } = useMemo(() => {
    const teamFilter = selectedTeam || null;
    const active = portfolio.filter(
      p => isActive(p.status) && p.project_code_norm && (teamFilter ? p.nome_time === teamFilter : true)
    );

    // Deduplicate by project_code_norm
    const uniqueActive = [];
    const seen = new Set();
    for (const p of active) {
      if (!seen.has(p.project_code_norm)) {
        seen.add(p.project_code_norm);
        uniqueActive.push(p);
      }
    }

    const respondedCodes = new Set(percepcoes.map(p => p.project_code));
    const filled = uniqueActive.filter(p => respondedCodes.has(p.project_name));
    const pending = uniqueActive.filter(p => !respondedCodes.has(p.project_name));
    const pct = uniqueActive.length > 0
      ? Math.round((filled.length / uniqueActive.length) * 100)
      : 0;

    return {
      activeProjects: uniqueActive,
      filledProjects: filled,
      pendingProjects: pending,
      compliancePercent: pct,
    };
  }, [portfolio, percepcoes, selectedTeam]);

  // User-pending projects (pending for the current user regardless of compliance)
  const userPendingCodes = useMemo(() => {
    return activeProjects
      .filter(p => !userRespondedCodes.has(p.project_name))
      .map(p => p.project_name);
  }, [activeProjects, userRespondedCodes]);

  // Portfolio map for revenda logic
  const portfolioMap = useMemo(() => {
    const map = new Map();
    portfolio.forEach(p => map.set(p.project_name, { client: p.client }));
    return map;
  }, [portfolio]);

  // Timeline chart data — monthly ativos vs preenchidos
  const chartData = useMemo(() => {
    const maxMes = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
    const labels = MESES.slice(0, maxMes).map(m => m.slice(0, 3));
    const ativosCount = activeProjects.length;

    // Build a set of active project codes for team-filtering percepcoes
    const activeCodesSet = new Set(activeProjects.map(p => p.project_name));

    const preenchidosData = [];
    for (let m = 1; m <= maxMes; m++) {
      const codesInMonth = new Set(
        allYearPercepcoes
          .filter(p => p.mes_referencia === m && activeCodesSet.has(p.project_code))
          .map(p => p.project_code)
      );
      preenchidosData.push(codesInMonth.size);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Ativos',
          data: Array(maxMes).fill(ativosCount),
          backgroundColor: 'rgba(26, 26, 26, 0.15)',
          borderColor: '#1a1a1a',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Preenchidos',
          data: preenchidosData,
          backgroundColor: 'rgba(21, 128, 61, 0.7)',
          borderColor: '#15803d',
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    };
  }, [allYearPercepcoes, activeProjects, ano, now]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 10 }, boxWidth: 12, padding: 12 },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          afterBody: (items) => {
            const ativos = items[0]?.raw || 0;
            const preenchidos = items[1]?.raw || 0;
            if (ativos > 0 && items.length > 1) {
              return `Compliance: ${Math.round((preenchidos / ativos) * 100)}%`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  }), []);

  // Get percepcao data for a specific project
  const getProjectPercepcao = (projectCode) => {
    return percepcoes.find(p => p.project_code === projectCode);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      const codes = payload.project_codes || [payload.project_code];
      for (const code of codes) {
        await axios.post(
          `${API_URL}/api/cs/percepcao-equipe`,
          { ...payload, project_code: code, project_codes: undefined },
          { withCredentials: true }
        );
      }
      setShowForm(false);
      setFormProjeto(null);
      fetchPercepcoes();
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFill = (projectCode) => {
    setFormProjeto(projectCode);
    setShowForm(true);
  };

  const handleFillAllPending = () => {
    setFormProjeto(null);
    setShowForm(true);
  };

  const currentYear = now.getFullYear();
  const anos = Array.from({ length: currentYear - 2023 + 1 }, (_, i) => currentYear - i);

  return (
    <div className="percepcao-view" style={{ padding: '1rem 0' }}>
      {/* Header */}
      <div className="percepcao-header">
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', margin: 0 }}>
          Compliance de Percepção
        </h3>
        <div className="percepcao-filters">
          <select
            className="percepcao-filter-select"
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
          >
            {MESES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="percepcao-filter-select"
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            style={{ minWidth: '90px' }}
          >
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          {isAdmin && (
            <select
              className="percepcao-filter-select"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              <option value="">Todos os times</option>
              {uniqueTeams.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Compliance Cards */}
      <div className="percepcao-cards-row">
        <div className="percepcao-card">
          <div className="percepcao-card-label">Ativos</div>
          <div className="percepcao-card-value" style={{ color: 'var(--text-primary, #1a1a1a)' }}>
            {activeProjects.length}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Preenchidos</div>
          <div className="percepcao-card-value" style={{ color: '#15803d' }}>
            {filledProjects.length}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Pendentes</div>
          <div className="percepcao-card-value" style={{ color: pendingProjects.length > 0 ? '#dc2626' : '#15803d' }}>
            {pendingProjects.length}
          </div>
          <div className="percepcao-card-desc">projetos</div>
        </div>
        <div className="percepcao-card">
          <div className="percepcao-card-label">Compliance</div>
          <div className="percepcao-card-value" style={{ color: compliancePercent >= 80 ? '#15803d' : compliancePercent >= 50 ? '#d97706' : '#dc2626' }}>
            {compliancePercent}%
          </div>
          <div className="percepcao-card-desc">preenchimento</div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="percepcao-chart-wrap">
        <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #1a1a1a)', margin: '0 0 0.5rem 0' }}>
          Timeline — Ativos vs Preenchidos ({ano})
        </h4>
        <div style={{ height: 180 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {loading && <p className="percepcao-loading">Carregando...</p>}

      {!loading && (
        <div className="percepcao-compliance-lists">
          {/* Pending projects */}
          {pendingProjects.length > 0 && (
            <div className="percepcao-section">
              <div className="percepcao-section-title-row">
                <h3 className="percepcao-section-title" style={{ color: '#dc2626' }}>
                  Pendentes ({pendingProjects.length})
                </h3>
                {userPendingCodes.length > 1 && (
                  <button
                    className="percepcao-btn-primary percepcao-btn-sm"
                    onClick={handleFillAllPending}
                  >
                    Preencher Pendentes
                  </button>
                )}
              </div>
              <div className="percepcao-project-list">
                {pendingProjects.map(p => (
                  <div key={p.project_name} className="percepcao-project-row percepcao-project-pending">
                    <div className="percepcao-project-info">
                      <span className="percepcao-project-dot" style={{ background: '#dc2626' }} />
                      <span className="percepcao-project-code">{p.project_name}</span>
                    </div>
                    <button
                      className="percepcao-btn-primary"
                      onClick={() => handleFill(p.project_name)}
                    >
                      Preencher
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filled projects */}
          {filledProjects.length > 0 && (
            <div className="percepcao-section">
              <h3 className="percepcao-section-title" style={{ color: '#15803d' }}>
                Preenchidos ({filledProjects.length})
              </h3>
              <div className="percepcao-project-list">
                {filledProjects.map(p => {
                  const perc = getProjectPercepcao(p.project_name);
                  const isExpanded = expandedProject === p.project_name;
                  const userResponded = userRespondedCodes.has(p.project_name);
                  return (
                    <div key={p.project_name} className="percepcao-project-row-wrap">
                      <div
                        className="percepcao-project-row percepcao-project-done"
                        onClick={() => setExpandedProject(isExpanded ? null : p.project_name)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="percepcao-project-info">
                          <span className="percepcao-project-dot" style={{ background: '#15803d' }} />
                          <span className="percepcao-project-code">{p.project_name}</span>
                        </div>
                        <div className="percepcao-project-meta">
                          {perc?.isp != null && (
                            <span
                              className="percepcao-isp-badge"
                              style={{ color: perc.isp >= 2.5 ? '#15803d' : perc.isp >= 1.5 ? '#d97706' : '#dc2626' }}
                            >
                              ISP: {perc.isp.toFixed(2)}
                            </span>
                          )}
                          {!userResponded && (
                            <button
                              className="percepcao-btn-secondary percepcao-btn-sm"
                              onClick={(e) => { e.stopPropagation(); handleFill(p.project_name); }}
                            >
                              Preencher
                            </button>
                          )}
                          <span className="percepcao-expand-icon">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                        </div>
                      </div>
                      {isExpanded && perc && (
                        <div className="percepcao-project-detail">
                          <div className="percepcao-detail-grid">
                            <DetailItem label="Cronograma" value={perc.cronograma} />
                            <DetailItem label="Qualidade" value={perc.qualidade} />
                            <DetailItem label="Comunicação" value={perc.comunicacao} />
                            <DetailItem label="Custos" value={perc.custos} />
                            <DetailItem label="Parceria" value={perc.parceria} />
                            <DetailItem label="Confiança" value={perc.confianca} />
                          </div>
                          <div className="percepcao-detail-indices">
                            <IndexBadge label="IP" value={perc.ip} />
                            <IndexBadge label="IVE" value={perc.ive} />
                            <IndexBadge label="ISP" value={perc.isp} />
                          </div>
                          {perc.comentarios && (
                            <p className="percepcao-detail-comment">{perc.comentarios}</p>
                          )}
                          <p className="percepcao-detail-respondent">
                            {perc.respondente_nome || perc.respondente_email}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeProjects.length === 0 && (
            <p className="percepcao-empty">Nenhum projeto ativo encontrado{selectedTeam ? ` para o time "${selectedTeam}"` : ''}.</p>
          )}
        </div>
      )}

      <PercepcaoFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setFormProjeto(null); }}
        onSubmit={handleSubmit}
        fixedProjeto={formProjeto}
        projetos={formProjeto ? [formProjeto] : userPendingCodes}
        submitting={submitting}
        percepcoes={percepcoes}
        portfolioMap={portfolioMap}
        userRespondedCodes={userRespondedCodes}
      />
    </div>
  );
}

const DIM_COLORS = { 1: '#dc2626', 2: '#d97706', 3: '#15803d' };
const DIM_LABELS = { 1: 'Insatisfeito', 2: 'Neutro', 3: 'Satisfeito' };

function DetailItem({ label, value }) {
  if (value == null) return (
    <div className="percepcao-detail-item">
      <span className="percepcao-detail-label">{label}</span>
      <span className="percepcao-na">N/A</span>
    </div>
  );
  return (
    <div className="percepcao-detail-item">
      <span className="percepcao-detail-label">{label}</span>
      <span
        className="percepcao-dim-badge"
        style={{ background: DIM_COLORS[value] }}
        title={DIM_LABELS[value]}
      >
        {value}
      </span>
    </div>
  );
}

function IndexBadge({ label, value }) {
  const color = value >= 2.5 ? '#15803d' : value >= 1.5 ? '#d97706' : '#dc2626';
  return (
    <span className="percepcao-index-badge" style={{ color }}>
      {label}: {value?.toFixed(2) ?? '-'}
    </span>
  );
}

export default PercepcaoProjetoTab;

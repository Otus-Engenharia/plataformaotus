/**
 * Painel de Entregas Autodoc
 *
 * Exibe documentos entregues via Autodoc na ultima semana,
 * organizados por projeto/fase/disciplina, classificados como
 * novo_arquivo/nova_revisao/mudanca_fase.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { autodocEntregasApi } from '../../api/autodocEntregas';
import { useAuth } from '../../contexts/AuthContext';
import './EntregasAutodocPanel.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CLASSIFICATION_CONFIG = {
  novo_arquivo: { label: 'Novo Arquivo', color: '#22c55e', bg: '#22c55e15' },
  nova_revisao: { label: 'Nova Revisao', color: '#3b82f6', bg: '#3b82f615' },
  mudanca_fase: { label: 'Mudanca de Fase', color: '#a855f7', bg: '#a855f715' },
};

const PALETTE = [
  '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

function getBusinessDayDaysAgo(n) {
  const now = new Date();
  let count = 0;
  let d = new Date(now);
  while (count < n) {
    d.setDate(d.getDate() - 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  const diffMs = now.getTime() - d.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const DAYS_OPTIONS = [
  { value: 'biz1', label: '1 dia util' },
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
];

function formatFileSize(bytes) {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = Number(bytes);
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function ClassificationBadge({ classification }) {
  const config = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.novo_arquivo;
  return (
    <span
      className="adoc-badge"
      style={{ backgroundColor: config.bg, color: config.color, borderColor: `${config.color}40` }}
    >
      {config.label}
    </span>
  );
}

function ChangeDescription({ doc }) {
  if (doc.classification === 'mudanca_fase' && doc.previous_phase && doc.phase_name) {
    return <span className="adoc-desc">{doc.previous_phase} → {doc.phase_name}</span>;
  }
  if (doc.classification === 'nova_revisao' && doc.previous_revision && doc.revision) {
    return <span className="adoc-desc">{doc.previous_revision} → {doc.revision}</span>;
  }
  return null;
}

function SummaryCards({ summary, loading }) {
  if (loading || !summary) {
    return (
      <div className="adoc-summary">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="adoc-stat-card adoc-stat--loading">
            <div className="adoc-stat-value">—</div>
            <div className="adoc-stat-label">Carregando...</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="adoc-summary">
      <div className="adoc-stat-card">
        <div className="adoc-stat-value">{summary.totalEntregas}</div>
        <div className="adoc-stat-label">Entregas</div>
      </div>
      <div className="adoc-stat-card adoc-stat--green">
        <div className="adoc-stat-value">{summary.porClassificacao?.novo_arquivo || 0}</div>
        <div className="adoc-stat-label">Novos Arq.</div>
      </div>
      <div className="adoc-stat-card adoc-stat--blue">
        <div className="adoc-stat-value">{summary.porClassificacao?.nova_revisao || 0}</div>
        <div className="adoc-stat-label">Revisoes</div>
      </div>
      <div className="adoc-stat-card adoc-stat--purple">
        <div className="adoc-stat-value">{summary.porClassificacao?.mudanca_fase || 0}</div>
        <div className="adoc-stat-label">Mud. Fase</div>
      </div>
      <div className="adoc-stat-card adoc-stat--amber">
        <div className="adoc-stat-value">{summary.projetosAtivos}</div>
        <div className="adoc-stat-label">Projetos c/ Entrega</div>
      </div>
    </div>
  );
}

function EntregasHistogram({ dailyStats, projectNames, loading }) {
  const entregasChartData = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return null;

    // Collect all project codes and their totals
    const projectTotals = {};
    for (const day of dailyStats) {
      for (const [code, count] of Object.entries(day.byProject)) {
        projectTotals[code] = (projectTotals[code] || 0) + count;
      }
    }

    // Sort by total descending, keep top 10, group rest as "Outros"
    const sorted = Object.entries(projectTotals).sort((a, b) => b[1] - a[1]);
    const topCodes = sorted.slice(0, 10).map(([code]) => code);
    const hasOthers = sorted.length > 10;

    const labels = dailyStats.map(d => {
      const [, m, day] = d.date.split('-');
      return `${day}/${m}`;
    });

    const datasets = topCodes.map((code, i) => ({
      label: projectNames[code] || code,
      data: dailyStats.map(d => d.byProject[code] || 0),
      backgroundColor: PALETTE[i % PALETTE.length],
      borderRadius: 3,
    }));

    if (hasOthers) {
      const otherCodes = sorted.slice(10).map(([code]) => code);
      datasets.push({
        label: 'Outros',
        data: dailyStats.map(d =>
          otherCodes.reduce((sum, code) => sum + (d.byProject[code] || 0), 0)
        ),
        backgroundColor: '#9ca3af',
        borderRadius: 3,
      });
    }

    return { labels, datasets };
  }, [dailyStats, projectNames]);

  const projetosChartData = useMemo(() => {
    if (!dailyStats || dailyStats.length === 0) return null;

    const labels = dailyStats.map(d => {
      const [, m, day] = d.date.split('-');
      return `${day}/${m}`;
    });

    const data = dailyStats.map(d => Object.keys(d.byProject).length);

    return {
      labels,
      datasets: [{
        label: 'Projetos',
        data,
        backgroundColor: '#ffdd00',
        borderRadius: 3,
      }],
    };
  }, [dailyStats]);

  const stackedTotalPlugin = useMemo(() => ({
    id: 'stackedTotal',
    afterDatasetsDraw(chart) {
      const { ctx, data, scales: { x, y } } = chart;
      const numBars = data.labels.length;
      ctx.save();
      ctx.font = "bold 11px 'Inter', Verdana, sans-serif";
      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = 0; i < numBars; i++) {
        let total = 0;
        for (const ds of data.datasets) {
          total += (ds.data[i] || 0);
        }
        if (total > 0) {
          const xPos = x.getPixelForValue(i);
          const yPos = y.getPixelForValue(total);
          ctx.fillText(total, xPos, yPos - 4);
        }
      }
      ctx.restore();
    },
  }), []);

  const entregasOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 12,
          font: { size: 11, family: "'Inter', Verdana, sans-serif" },
        },
      },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || '',
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Entregas',
          font: { size: 12, weight: '600' },
        },
      },
    },
  }), []);

  const projetosOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0]?.label || '',
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Projetos',
          font: { size: 12, weight: '600' },
        },
      },
    },
  }), []);

  if (loading) {
    return (
      <div className="adoc-loading">
        <div className="adoc-spinner-lg" />
        <p>Carregando histograma...</p>
      </div>
    );
  }

  if (!entregasChartData) {
    return (
      <div className="adoc-empty">
        <p className="adoc-empty-title">Sem dados para o histograma</p>
        <p className="adoc-empty-hint">Nenhuma entrega encontrada no periodo selecionado</p>
      </div>
    );
  }

  return (
    <div className="adoc-histogram-section">
      <div>
        <h4 className="adoc-histogram-title">Entregas por Dia</h4>
        <div className="adoc-histogram-wrapper">
          <Bar data={entregasChartData} options={entregasOptions} plugins={[stackedTotalPlugin]} height={350} />
        </div>
      </div>
      <div>
        <h4 className="adoc-histogram-title">Projetos por Dia</h4>
        <div className="adoc-histogram-wrapper">
          <Bar data={projetosChartData} options={projetosOptions} height={250} />
        </div>
      </div>
    </div>
  );
}

export default function EntregasAutodocPanel() {
  const { isPrivileged } = useAuth();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [daysOption, setDaysOption] = useState(7);
  const days = daysOption === 'biz1' ? getBusinessDayDaysAgo(1) : daysOption;
  const [classificationFilter, setClassificationFilter] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tabela');
  const [dailyStats, setDailyStats] = useState(null);
  const [projectNames, setProjectNames] = useState({});
  const [dailyStatsLoading, setDailyStatsLoading] = useState(false);
  const pollRef = useRef(null);
  const pollStartRef = useRef(null);
  const batchIdRef = useRef(null);

  const limit = 50;

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit, days };
      if (classificationFilter) params.classification = classificationFilter;
      const res = await autodocEntregasApi.getRecentEntregas(params);
      if (res.data?.success) {
        setDocs(res.data.data || []);
        setTotal(res.data.total || 0);
      } else {
        setError(res.data?.error || 'Erro ao carregar entregas');
      }
    } catch (err) {
      console.error('Erro ao buscar entregas Autodoc:', err);
      setError(err.response?.data?.error || 'Erro ao carregar entregas');
    } finally {
      setLoading(false);
    }
  }, [page, days, classificationFilter]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await autodocEntregasApi.getSummary({ days });
      if (res.data?.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [days]);

  const fetchDailyStats = useCallback(async () => {
    setDailyStatsLoading(true);
    try {
      const res = await autodocEntregasApi.getDailyStats({ days });
      if (res.data?.success) {
        setDailyStats(res.data.data.dailyStats || []);
        setProjectNames(res.data.data.projectNames || {});
      }
    } catch (err) {
      console.error('Erro ao buscar daily stats:', err);
    } finally {
      setDailyStatsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchDocs();
    fetchSummary();
  }, [fetchDocs, fetchSummary]);

  useEffect(() => {
    if (activeTab === 'histograma') {
      fetchDailyStats();
    }
  }, [activeTab, fetchDailyStats]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollStartRef.current = null;
    batchIdRef.current = null;
  }, []);

  const pollSyncStatus = useCallback(async () => {
    try {
      const res = await autodocEntregasApi.getSyncStatus(batchIdRef.current);
      if (!res.data?.success) return;

      const { running, completed, failed, total, totalProjectsAll, projectsCompletedAll, runs } = res.data.data;
      const runningRun = (runs || []).find(r => r.status === 'running');
      setSyncProgress({
        running, completed, failed, total,
        totalProjectsAll: totalProjectsAll || 0,
        projectsCompletedAll: projectsCompletedAll || 0,
        currentProject: runningRun?.current_project || null,
      });

      if (running === 0 && total > 0) {
        stopPolling();
        setSyncing(false);
        setSyncProgress(null);

        if (failed > 0) {
          setSyncResult({ error: `${failed} conta(s) com erro. ${completed} concluida(s).` });
        } else {
          setSyncResult({ totalCustomers: completed, totalDocuments: '-', newDocuments: '-' });
        }

        fetchDocs();
        fetchSummary();
        if (activeTab === 'histograma') fetchDailyStats();
        return;
      }

      const elapsed = pollStartRef.current ? Date.now() - pollStartRef.current : 0;
      if (elapsed > 20 * 60 * 1000 && elapsed <= 30 * 60 * 1000) {
        setSyncResult({ warning: 'Sync ainda em andamento. Os dados serao atualizados automaticamente ao concluir.' });
      }
      if (elapsed > 30 * 60 * 1000) {
        stopPolling();
        setSyncing(false);
        setSyncProgress(null);
        setSyncResult({ error: 'Sync demorou mais de 30 minutos. Verifique o status manualmente.' });
      }
    } catch (err) {
      console.error('Erro ao consultar sync status:', err);
    }
  }, [stopPolling, fetchDocs, fetchSummary, fetchDailyStats, activeTab]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollStartRef.current = Date.now();
    pollSyncStatus();
    pollRef.current = setInterval(pollSyncStatus, 5000);
  }, [stopPolling, pollSyncStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await autodocEntregasApi.getSyncStatus();
        if (cancelled || !res.data?.success) return;
        const { running } = res.data.data;
        if (running > 0) {
          batchIdRef.current = null;
          setSyncing(true);
          startPolling();
        }
      } catch (err) {
        // Ignora erro na verificacao inicial
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress(null);
    try {
      const res = await autodocEntregasApi.syncAll();
      if (res.data?.success) {
        batchIdRef.current = res.data.batchId || null;
        startPolling();
      }
    } catch (err) {
      console.error('Erro no sync:', err);
      setSyncing(false);
      setSyncResult({ error: err.response?.data?.error || err.message });
    }
  };

  const totalPages = Math.ceil(total / limit);

  const syncButtonText = () => {
    if (!syncProgress) return 'Sincronizando...';
    const { currentProject, projectsCompletedAll, totalProjectsAll } = syncProgress;
    if (totalProjectsAll > 0) {
      if (currentProject) {
        return `${currentProject} — ${projectsCompletedAll}/${totalProjectsAll} projetos`;
      }
      return `Sincronizando... ${projectsCompletedAll}/${totalProjectsAll} projetos`;
    }
    return `Sincronizando... ${syncProgress.completed}/${syncProgress.total} contas`;
  };

  return (
    <div className="adoc-container">
      {/* Header */}
      <div className="adoc-header">
        <h2 className="adoc-title">Entregas Autodoc</h2>
        <div className="adoc-header-actions">
          {isPrivileged && (
            <button
              className="adoc-sync-btn"
              onClick={handleSyncAll}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <span className="adoc-spinner" />
                  {syncButtonText()}
                </>
              ) : (
                'Sincronizar Agora'
              )}
            </button>
          )}
          <button className="adoc-refresh-btn" onClick={() => { fetchDocs(); fetchSummary(); if (activeTab === 'histograma') fetchDailyStats(); }} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sync result toast */}
      {syncResult?.warning && !syncResult.error && (
        <div className="adoc-toast adoc-toast--warning">
          {syncResult.warning}
        </div>
      )}
      {syncResult && !syncResult.error && !syncResult.warning && (
        <div className="adoc-toast adoc-toast--success">
          Sync concluido: {syncResult.totalCustomers} conta(s) sincronizada(s)
          <button className="adoc-toast-close" onClick={() => setSyncResult(null)}>&times;</button>
        </div>
      )}
      {syncResult?.error && (
        <div className="adoc-toast adoc-toast--error">
          {syncResult.error}
          <button className="adoc-toast-close" onClick={() => setSyncResult(null)}>&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      <SummaryCards summary={summary} loading={summaryLoading} />

      {/* Filters */}
      <div className="adoc-filters">
        <div className="adoc-filter-group">
          <label>Periodo:</label>
          <select
            value={daysOption}
            onChange={(e) => { const v = e.target.value; setDaysOption(v === 'biz1' ? v : Number(v)); setPage(1); }}
            className="adoc-select"
          >
            {DAYS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        {activeTab === 'tabela' && (
          <div className="adoc-filter-group">
            <label>Classificacao:</label>
            <select
              value={classificationFilter}
              onChange={(e) => { setClassificationFilter(e.target.value); setPage(1); }}
              className="adoc-select"
            >
              <option value="">Todas</option>
              {Object.entries(CLASSIFICATION_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        )}
        {activeTab === 'tabela' && (
          <div className="adoc-filter-count">
            <strong>{total}</strong> entrega{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="adoc-tabs">
        <button
          className={`adoc-tab ${activeTab === 'tabela' ? 'adoc-tab--active' : ''}`}
          onClick={() => setActiveTab('tabela')}
        >
          Tabela
        </button>
        <button
          className={`adoc-tab ${activeTab === 'histograma' ? 'adoc-tab--active' : ''}`}
          onClick={() => setActiveTab('histograma')}
        >
          Histograma
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tabela' ? (
        <>
          {loading ? (
            <div className="adoc-loading">
              <div className="adoc-spinner-lg" />
              <p>Carregando entregas...</p>
            </div>
          ) : error ? (
            <div className="adoc-error">
              <p>{error}</p>
              <button onClick={fetchDocs} className="adoc-refresh-btn">Tentar novamente</button>
            </div>
          ) : docs.length === 0 ? (
            <div className="adoc-empty">
              <p className="adoc-empty-title">Nenhuma entrega encontrada</p>
              <p className="adoc-empty-hint">
                {total === 0
                  ? 'Configure mapeamentos e sincronize para ver entregas'
                  : 'Tente ajustar os filtros'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="adoc-table-wrapper">
                <table className="adoc-table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Projeto</th>
                      <th>Documento</th>
                      <th style={{ width: 100 }}>Codigo</th>
                      <th style={{ width: 50 }}>Rev</th>
                      <th style={{ width: 80 }}>Fase</th>
                      <th style={{ width: 100 }}>Disciplina</th>
                      <th style={{ width: 60 }}>Formato</th>
                      <th style={{ width: 130 }}>Classificacao</th>
                      <th style={{ width: 120 }}>Detalhe</th>
                      <th style={{ width: 130 }}>Data</th>
                      <th style={{ width: 70 }}>Tam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id || doc.autodoc_doc_id}>
                        <td className="adoc-project-code" title={doc.project_code}>{doc.project_name || doc.project_code}</td>
                        <td className="adoc-doc-name" title={doc.document_name}>{doc.document_name}</td>
                        <td className="adoc-doc-code">{doc.document_code || '-'}</td>
                        <td>{doc.revision || '-'}</td>
                        <td>{doc.phase_name || '-'}</td>
                        <td>{doc.discipline_name || '-'}</td>
                        <td>{doc.format_folder || '-'}</td>
                        <td><ClassificationBadge classification={doc.classification} /></td>
                        <td><ChangeDescription doc={doc} /></td>
                        <td className="adoc-date">{formatDate(doc.autodoc_created_at)}</td>
                        <td className="adoc-file-size">{formatFileSize(doc.raw_size)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="adoc-pagination">
                  <button
                    className="adoc-page-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </button>
                  <span className="adoc-page-info">
                    Pagina {page} de {totalPages}
                  </span>
                  <button
                    className="adoc-page-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Proxima
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <EntregasHistogram
          dailyStats={dailyStats}
          projectNames={projectNames}
          loading={dailyStatsLoading}
        />
      )}
    </div>
  );
}

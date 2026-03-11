/**
 * Componente: Vista do Cliente - Início
 *
 * Dashboard principal do projeto na perspectiva do cliente.
 * Agrega KPIs, marcos, gráfico S-curve, relatos e changelog.
 * Reutiliza componentes existentes da plataforma.
 *
 * Layout: 2 colunas (chart+sidebar | marcos+changelog) + relatos full-width abaixo
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { useVistaCliente } from '../../contexts/VistaClienteContext';
import VistaClienteKpiStrip from './VistaClienteKpiStrip';
import MarcosProjetoSection from './MarcosProjetoSection';
import RelatosSection from './RelatosSection';
import ChartSection from './ChartSection';
import ChangeLogPanel from '../../components/curva-s-progresso/ChangeLogPanel';
import '../../styles/VistaClienteView.css';

function getHealthLevel(idp) {
  if (idp == null) return 'warning';
  if (idp >= 1.0) return 'good';
  if (idp >= 0.8) return 'warning';
  return 'danger';
}

function VistaClienteInicioView() {
  // ---- Estado compartilhado (contexto) ----
  const {
    selectedProjectId, setSelectedProjectId,
    showOnlyActive, setShowOnlyActive,
    selectedProject, projectCode, smartsheetId, projectName, projectId, construflowId,
    sortedProjects,
  } = useVistaCliente();

  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // ---- Dados do projeto ----
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Gráfico
  const [timeseries, setTimeseries] = useState([]);
  const [snapshotCurves, setSnapshotCurves] = useState([]);
  const [baselineCurve, setBaselineCurve] = useState(null);
  const [baselineCurves, setBaselineCurves] = useState([]);
  const [prazos, setPrazos] = useState(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  // Filtros de visibilidade do gráfico
  const [showExecutado, setShowExecutado] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [visibleSnapshots, setVisibleSnapshots] = useState(null);
  const [visibleBaselines, setVisibleBaselines] = useState(null);
  const [showBarExecutado, setShowBarExecutado] = useState(true);
  const [visibleBaselineBars, setVisibleBaselineBars] = useState(new Set());

  // Changelog
  const [changeLog, setChangeLog] = useState(null);
  const [changeLogLoading, setChangeLogLoading] = useState(false);

  // Marcos
  const [marcos, setMarcos] = useState([]);
  const [marcosLoading, setMarcosLoading] = useState(false);

  // Apontamentos (contagens)
  const [apontamentosCount, setApontamentosCount] = useState({ total: 0 });

  // IDP para health dot
  const idp = progress?.idp_baseline != null ? progress.idp_baseline : progress?.idp;


  useEffect(() => {
    if (selectedProjectId) setLastUpdate(new Date());
  }, [selectedProjectId]);

  // ---- Fetch progresso ----
  const fetchProgress = useCallback(async () => {
    if (!projectCode || (!smartsheetId && !projectName)) return;
    setProgressLoading(true);
    try {
      const params = new URLSearchParams();
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);
      if (projectId) params.set('projectId', projectId);

      const res = await axios.get(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/progress?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setProgress(res.data.data.progress);
      }
    } catch (err) {
      console.error('Erro ao buscar progresso:', err);
    } finally {
      setProgressLoading(false);
    }
  }, [projectCode, smartsheetId, projectName, projectId]);

  // ---- Fetch timeseries (gráfico) ----
  const fetchTimeseries = useCallback(async () => {
    if (!projectCode || (!smartsheetId && !projectName)) return;
    setTimeseriesLoading(true);
    try {
      const params = new URLSearchParams();
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);
      if (projectId) params.set('projectId', projectId);

      const res = await axios.get(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/timeseries?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setTimeseries(res.data.data.timeseries || []);
        setSnapshotCurves(res.data.data.snapshot_curves || []);
        setBaselineCurve(res.data.data.baseline_curve || null);
        setBaselineCurves(res.data.data.baseline_curves || []);
        setPrazos(res.data.data.prazos || null);
        setVisibleSnapshots(null);
        setVisibleBaselines(null);
        setShowExecutado(true);
        setShowBaseline(true);
      }
    } catch (err) {
      console.error('Erro ao buscar timeseries:', err);
    } finally {
      setTimeseriesLoading(false);
    }
  }, [projectCode, smartsheetId, projectName, projectId]);

  // ---- Fetch changelog ----
  const fetchChangeLog = useCallback(async () => {
    if (!projectCode || (!smartsheetId && !projectName)) return;
    setChangeLogLoading(true);
    try {
      const params = new URLSearchParams();
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);

      const res = await axios.get(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/changelog?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) setChangeLog(res.data.data);
    } catch (err) {
      console.error('Erro ao buscar changelog:', err);
    } finally {
      setChangeLogLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  // ---- Fetch marcos (Supabase enriched) ----
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) {
      setMarcos([]);
      return;
    }
    setMarcosLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('projectCode', projectCode);
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);

      const res = await axios.get(
        `${API_URL}/api/marcos-projeto/enriched?${params}`,
        { withCredentials: true }
      );
      const rawMarcos = res.data?.data || [];

      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      const mapped = rawMarcos.map(m => {
        const updatedAt = m.updated_at ? new Date(m.updated_at) : null;
        return {
          nome: m.nome,
          status: m.smartsheet_status || m.status || null,
          prazoAtual: m.smartsheet_data_termino || m.prazo_atual || null,
          prazoBase: m.prazo_baseline || null,
          variacaoDias: m.smartsheet_variancia != null ? Number(m.smartsheet_variancia) : (m.variacao_dias != null ? Number(m.variacao_dias) : null),
          alteradoRecente: updatedAt && updatedAt >= oneMonthAgo,
        };
      });

      setMarcos(mapped);
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
      setMarcos([]);
    } finally {
      setMarcosLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  // ---- Fetch apontamentos ----
  const fetchApontamentos = useCallback(async () => {
    if (!construflowId) {
      setApontamentosCount({ total: 0 });
      return;
    }
    try {
      const res = await axios.get(
        `${API_URL}/api/projetos/apontamentos?construflowId=${encodeURIComponent(construflowId)}`,
        { withCredentials: true }
      );
      const issues = res.data?.data || [];
      const closedStatuses = ['fechado', 'closed', 'resolvido', 'resolved', 'cancelado'];
      const open = issues.filter(i => {
        const s = String(i.status || '').toLowerCase().trim();
        return !closedStatuses.some(c => s.includes(c));
      });
      setApontamentosCount({ total: open.length });
    } catch (err) {
      console.error('Erro ao buscar apontamentos:', err);
      setApontamentosCount({ total: 0 });
    }
  }, [construflowId]);

  // ---- Efeitos de fetch ----
  useEffect(() => { fetchProgress(); }, [fetchProgress]);
  useEffect(() => { fetchTimeseries(); }, [fetchTimeseries]);
  useEffect(() => { fetchChangeLog(); }, [fetchChangeLog]);
  useEffect(() => { fetchMarcos(); }, [fetchMarcos]);
  useEffect(() => { fetchApontamentos(); }, [fetchApontamentos]);

  // Inicializar barras de baseline
  useEffect(() => {
    const allBl = baselineCurves.length > 0 ? baselineCurves : (baselineCurve ? [baselineCurve] : []);
    if (allBl.length > 0) {
      const last = allBl[allBl.length - 1];
      setVisibleBaselineBars(new Set([last.id ?? last.label]));
    } else {
      setVisibleBaselineBars(new Set());
    }
  }, [baselineCurves, baselineCurve]);

  useEffect(() => { setChangeLog(null); }, [projectCode]);

  // ---- Handlers de toggle do gráfico ----
  const toggleSnapshot = (date) => {
    setVisibleSnapshots(prev => {
      const current = prev || new Set(snapshotCurves.map(sc => sc.snapshot_date));
      const next = new Set(current);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const toggleBaselineBar = (key) => {
    setVisibleBaselineBars(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleToggleBaseline2 = (key) => {
    setVisibleBaselines(prev => {
      if (!prev) {
        const allKeys = new Set(
          (baselineCurves.length > 0 ? baselineCurves : (baselineCurve ? [baselineCurve] : []))
            .map(b => b.id ?? b.label)
        );
        allKeys.delete(key);
        return allKeys;
      }
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="vista-cliente-container">
      {/* Header */}
      <div className="vc-header">
        <div className="vc-header-title-row">
          {selectedProject && (
            <>
              <span className={`vc-health-dot ${getHealthLevel(idp)}`} />
              <h1 className="vc-project-title">
                {selectedProject.project_name || selectedProject.project_code_norm}
              </h1>
            </>
          )}
          {!selectedProject && (
            <h1 className="vc-project-title">Vista do Cliente</h1>
          )}
        </div>
        <div className="vc-header-controls">
          <select
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="vc-project-select"
          >
            <option value="">Selecione um projeto</option>
            {sortedProjects.map(p => (
              <option key={p.project_code_norm} value={p.project_code_norm}>
                {p.project_name || p.project_code_norm}
              </option>
            ))}
          </select>
          <label className="vc-active-toggle">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={e => setShowOnlyActive(e.target.checked)}
            />
            Somente Ativos
          </label>
          {lastUpdate && (
            <span className="vc-last-update">
              {lastUpdate.toLocaleDateString('pt-BR')} {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="vc-empty-state">
          <div className="vc-empty-state-icon">&#128203;</div>
          <div className="vc-empty-state-text">Selecione um projeto para visualizar o dashboard.</div>
        </div>
      ) : (
        <>
          <div className="vc-tabs">
            <button
              className={`vc-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`vc-tab ${activeTab === 'relatos' ? 'active' : ''}`}
              onClick={() => setActiveTab('relatos')}
            >
              Relatos
            </button>
          </div>

          {activeTab === 'dashboard' ? (
            <>
              <VistaClienteKpiStrip
                progress={progress}
                project={selectedProject}
                apontamentosCount={apontamentosCount}
                prazos={prazos}
                loading={progressLoading}
              />

              <div className="vc-main-grid">
                <div className="vc-chart-col">
                  <ChartSection
                    timeseries={timeseries}
                    snapshotCurves={snapshotCurves}
                    baselineCurve={baselineCurve}
                    baselineCurves={baselineCurves}
                    timeseriesLoading={timeseriesLoading}
                    showExecutado={showExecutado}
                    onToggleExecutado={() => setShowExecutado(prev => !prev)}
                    showBaseline={showBaseline}
                    onToggleBaseline={() => setShowBaseline(prev => !prev)}
                    visibleBaselines={visibleBaselines}
                    onToggleBaseline2={handleToggleBaseline2}
                    visibleSnapshots={visibleSnapshots}
                    onToggleSnapshot={toggleSnapshot}
                    onSelectAllSnapshots={() => setVisibleSnapshots(null)}
                    onClearAllSnapshots={() => setVisibleSnapshots(new Set())}
                    showBarExecutado={showBarExecutado}
                    onToggleBarExecutado={() => setShowBarExecutado(prev => !prev)}
                    visibleBaselineBars={visibleBaselineBars}
                    onToggleBaselineBar={toggleBaselineBar}
                  />
                </div>

                <div className="vc-sidebar-col">
                  <MarcosProjetoSection marcos={marcos} loading={marcosLoading} />
                  <div className="vc-changelog-wrapper">
                    <ChangeLogPanel changeLog={changeLog} loading={changeLogLoading} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <RelatosSection projectCode={projectCode} />
          )}
        </>
      )}
    </div>
  );
}

export default VistaClienteInicioView;

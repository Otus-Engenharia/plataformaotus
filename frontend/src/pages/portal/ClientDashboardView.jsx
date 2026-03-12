import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import VistaClienteKpiStrip from '../vista-cliente/VistaClienteKpiStrip';
import MarcosProjetoSection from '../vista-cliente/MarcosProjetoSection';
import ChartSection from '../vista-cliente/ChartSection';
import ChangeLogPanel from '../../components/curva-s-progresso/ChangeLogPanel';
import '../../styles/VistaClienteView.css';
import '../../styles/ClientPortal.css';

function ClientDashboardView() {
  const { projectCode } = useParams();
  const { currentProject, setProjectIdp } = useOutletContext();
  const { getClientToken } = useClientAuth();

  // Project metadata (from BigQuery portfolio)
  const [projectMeta, setProjectMeta] = useState(null);

  // Progress
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Timeseries (chart)
  const [timeseries, setTimeseries] = useState([]);
  const [snapshotCurves, setSnapshotCurves] = useState([]);
  const [baselineCurve, setBaselineCurve] = useState(null);
  const [baselineCurves, setBaselineCurves] = useState([]);
  const [prazos, setPrazos] = useState(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);

  // Chart filter toggles
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

  // Apontamentos count
  const [apontamentosCount, setApontamentosCount] = useState({ total: 0 });

  const clientAxios = useCallback(() => {
    const token = getClientToken();
    return { headers: { Authorization: `Bearer ${token}` } };
  }, [getClientToken]);

  // IDP for health dot
  const idp = progress?.idp_baseline != null ? progress.idp_baseline : progress?.idp;

  // Fetch project metadata from BigQuery
  const fetchMetadata = useCallback(async () => {
    if (!projectCode) return;
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/metadata`,
        clientAxios()
      );
      if (res.data.success && res.data.data) {
        setProjectMeta(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar metadata:', err);
    }
  }, [projectCode, clientAxios]);

  // Fetch apontamentos count
  const fetchApontamentosCount = useCallback(async () => {
    const construflowId = currentProject?.construflowId;
    if (!projectCode || !construflowId) {
      setApontamentosCount({ total: 0 });
      return;
    }
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/apontamentos-count?construflowId=${encodeURIComponent(construflowId)}`,
        clientAxios()
      );
      if (res.data.success) {
        setApontamentosCount(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar apontamentos count:', err);
      setApontamentosCount({ total: 0 });
    }
  }, [projectCode, currentProject?.construflowId, clientAxios]);

  // Build query params for endpoints that need project identifiers
  const buildProjectParams = useCallback((includeProjectId = true) => {
    const params = new URLSearchParams();
    if (currentProject?.smartsheetId) params.set('smartsheetId', currentProject.smartsheetId);
    if (currentProject?.nome) params.set('projectName', currentProject.nome);
    if (includeProjectId && projectMeta?.id) params.set('projectId', projectMeta.id);
    return params;
  }, [currentProject?.smartsheetId, currentProject?.nome, projectMeta?.id]);

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!projectCode || (!currentProject?.smartsheetId && !currentProject?.nome)) return;
    setProgressLoading(true);
    try {
      const params = buildProjectParams();
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/progress?${params}`,
        clientAxios()
      );
      if (res.data.success) {
        setProgress(res.data.data.progress);
      }
    } catch (err) {
      console.error('Erro ao buscar progresso:', err);
    } finally {
      setProgressLoading(false);
    }
  }, [projectCode, currentProject?.smartsheetId, currentProject?.nome, clientAxios, buildProjectParams]);

  // Fetch timeseries
  const fetchTimeseries = useCallback(async () => {
    if (!projectCode || (!currentProject?.smartsheetId && !currentProject?.nome)) return;
    setTimeseriesLoading(true);
    try {
      const params = buildProjectParams();
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/timeseries?${params}`,
        clientAxios()
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
  }, [projectCode, currentProject?.smartsheetId, currentProject?.nome, clientAxios, buildProjectParams]);

  // Fetch changelog
  const fetchChangeLog = useCallback(async () => {
    if (!projectCode || (!currentProject?.smartsheetId && !currentProject?.nome)) return;
    setChangeLogLoading(true);
    try {
      const params = buildProjectParams(false); // changelog doesn't need projectId
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/changelog?${params}`,
        clientAxios()
      );
      if (res.data.success) setChangeLog(res.data.data);
    } catch (err) {
      console.error('Erro ao buscar changelog:', err);
    } finally {
      setChangeLogLoading(false);
    }
  }, [projectCode, currentProject?.smartsheetId, currentProject?.nome, clientAxios, buildProjectParams]);

  // Fetch marcos (enriched)
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) return;
    setMarcosLoading(true);
    try {
      const params = buildProjectParams(false); // marcos doesn't need projectId
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos?${params}`,
        clientAxios()
      );
      const rawMarcos = res.data?.data || [];
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      const mapped = rawMarcos.map(m => {
        const updatedAt = m.updated_at ? new Date(m.updated_at) : null;
        const cronogramaDate = m.smartsheet_data_termino || m.prazo_atual || null;
        const expectativaCliente = m.cliente_expectativa_data || null;
        let desvio = null;
        if (cronogramaDate && expectativaCliente) {
          const dCrono = new Date(cronogramaDate);
          const dExpect = new Date(expectativaCliente);
          if (!isNaN(dCrono) && !isNaN(dExpect)) {
            desvio = Math.round((dCrono - dExpect) / (1000 * 60 * 60 * 24));
          }
        }
        return {
          nome: m.nome,
          status: m.smartsheet_status || m.status || null,
          prazoAtual: cronogramaDate,
          prazoBase: m.prazo_baseline || null,
          variacaoDias: desvio,
          alteradoRecente: updatedAt && updatedAt >= oneMonthAgo,
        };
      });

      setMarcos(mapped);
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
    } finally {
      setMarcosLoading(false);
    }
  }, [projectCode, clientAxios, buildProjectParams]);

  // Group 1: Fetch metadata (no dependency on currentProject)
  useEffect(() => {
    if (projectCode) {
      fetchMetadata();
    }
  }, [projectCode, fetchMetadata]);

  // Group 2: Fetch data that depends on currentProject (but not projectMeta)
  useEffect(() => {
    if (projectCode && currentProject) {
      fetchMarcos();
      fetchApontamentosCount();
    }
  }, [projectCode, currentProject, fetchMarcos, fetchApontamentosCount]);

  // Group 3: Fetch data that depends on currentProject AND projectMeta
  useEffect(() => {
    if (projectCode && currentProject && projectMeta) {
      fetchProgress();
      fetchTimeseries();
      fetchChangeLog();
    }
  }, [projectCode, currentProject, projectMeta, fetchProgress, fetchTimeseries, fetchChangeLog]);

  // Initialize baseline bars
  useEffect(() => {
    const allBl = baselineCurves.length > 0 ? baselineCurves : (baselineCurve ? [baselineCurve] : []);
    if (allBl.length > 0) {
      const last = allBl[allBl.length - 1];
      setVisibleBaselineBars(new Set([last.id ?? last.label]));
    } else {
      setVisibleBaselineBars(new Set());
    }
  }, [baselineCurves, baselineCurve]);

  // Reset changelog on project change
  useEffect(() => { setChangeLog(null); }, [projectCode]);

  // Communicate IDP to layout for health dot
  useEffect(() => {
    if (setProjectIdp) setProjectIdp(idp);
  }, [idp, setProjectIdp]);

  // Chart toggle handlers
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
      <VistaClienteKpiStrip
        progress={progress}
        project={projectMeta || {}}
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
    </div>
  );
}

export default ClientDashboardView;

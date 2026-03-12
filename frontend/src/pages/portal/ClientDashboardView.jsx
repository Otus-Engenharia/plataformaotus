import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { useClientAuth } from '../../contexts/ClientAuthContext';
import VistaClienteKpiStrip from '../vista-cliente/VistaClienteKpiStrip';
import MarcosProjetoSection from '../vista-cliente/MarcosProjetoSection';
import ChartSection from '../vista-cliente/ChartSection';
import ChangeLogPanel from '../../components/curva-s-progresso/ChangeLogPanel';
import '../../styles/VistaClienteView.css';
import '../../styles/ClientPortal.css';

function getHealthLevel(idp) {
  if (idp == null) return 'warning';
  if (idp >= 1.0) return 'good';
  if (idp >= 0.8) return 'warning';
  return 'danger';
}

function ClientDashboardView() {
  const { projectCode } = useParams();
  const { getClientToken } = useClientAuth();

  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [timeseries, setTimeseries] = useState([]);
  const [snapshotCurves, setSnapshotCurves] = useState([]);
  const [baselineCurve, setBaselineCurve] = useState(null);
  const [baselineCurves, setBaselineCurves] = useState([]);
  const [prazos, setPrazos] = useState(null);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [changeLog, setChangeLog] = useState(null);
  const [changeLogLoading, setChangeLogLoading] = useState(false);
  const [marcos, setMarcos] = useState([]);
  const [marcosLoading, setMarcosLoading] = useState(false);

  // Chart filter toggles
  const [showExecutado, setShowExecutado] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [visibleSnapshots, setVisibleSnapshots] = useState(null);
  const [visibleBaselines, setVisibleBaselines] = useState(null);
  const [showBarExecutado, setShowBarExecutado] = useState(true);
  const [visibleBaselineBars, setVisibleBaselineBars] = useState(new Set());

  const clientAxios = useCallback(() => {
    const token = getClientToken();
    return {
      headers: { Authorization: `Bearer ${token}` },
    };
  }, [getClientToken]);

  // Fetch progress
  const fetchProgress = useCallback(async () => {
    if (!projectCode) return;
    setProgressLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/progress`,
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
  }, [projectCode, clientAxios]);

  // Fetch timeseries
  const fetchTimeseries = useCallback(async () => {
    if (!projectCode) return;
    setTimeseriesLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/timeseries`,
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
  }, [projectCode, clientAxios]);

  // Fetch changelog
  const fetchChangeLog = useCallback(async () => {
    if (!projectCode) return;
    setChangeLogLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/changelog`,
        clientAxios()
      );
      if (res.data.success) setChangeLog(res.data.data);
    } catch (err) {
      console.error('Erro ao buscar changelog:', err);
    } finally {
      setChangeLogLoading(false);
    }
  }, [projectCode, clientAxios]);

  // Fetch marcos
  const fetchMarcos = useCallback(async () => {
    if (!projectCode) return;
    setMarcosLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/client/projects/${encodeURIComponent(projectCode)}/marcos`,
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
          alteradoRecente: updatedAt && updatedAt > oneMonthAgo,
        };
      });

      setMarcos(mapped);
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
    } finally {
      setMarcosLoading(false);
    }
  }, [projectCode, clientAxios]);

  // Fetch all on project change
  useEffect(() => {
    if (projectCode) {
      fetchProgress();
      fetchTimeseries();
      fetchChangeLog();
      fetchMarcos();
    }
  }, [projectCode, fetchProgress, fetchTimeseries, fetchChangeLog, fetchMarcos]);

  const idp = progress?.idp_baseline != null ? progress.idp_baseline : progress?.idp;

  return (
    <div className="vista-cliente-page client-dashboard-page">
      <VistaClienteKpiStrip
        progress={progress}
        project={{}}
        apontamentosCount={{ total: 0 }}
        prazos={prazos}
        loading={progressLoading}
      />

      <div className="vista-cliente-body">
        <div className="vista-cliente-chart-area">
          <ChartSection
            timeseries={timeseries}
            snapshotCurves={snapshotCurves}
            baselineCurve={baselineCurve}
            baselineCurves={baselineCurves}
            timeseriesLoading={timeseriesLoading}
            showExecutado={showExecutado}
            onToggleExecutado={() => setShowExecutado(v => !v)}
            showBaseline={showBaseline}
            onToggleBaseline={() => setShowBaseline(v => !v)}
            visibleBaselines={visibleBaselines}
            onToggleBaseline2={(name) => {
              setVisibleBaselines(prev => {
                const s = new Set(prev || baselineCurves.map(b => b.name));
                if (s.has(name)) s.delete(name);
                else s.add(name);
                return s;
              });
            }}
            visibleSnapshots={visibleSnapshots}
            onToggleSnapshot={(label) => {
              setVisibleSnapshots(prev => {
                const s = new Set(prev || snapshotCurves.map(c => c.label));
                if (s.has(label)) s.delete(label);
                else s.add(label);
                return s;
              });
            }}
            onSelectAllSnapshots={() => setVisibleSnapshots(new Set(snapshotCurves.map(c => c.label)))}
            onClearAllSnapshots={() => setVisibleSnapshots(new Set())}
            showBarExecutado={showBarExecutado}
            onToggleBarExecutado={() => setShowBarExecutado(v => !v)}
            visibleBaselineBars={visibleBaselineBars}
            onToggleBaselineBar={(name) => {
              setVisibleBaselineBars(prev => {
                const s = new Set(prev);
                if (s.has(name)) s.delete(name);
                else s.add(name);
                return s;
              });
            }}
          />
        </div>

        <div className="vista-cliente-sidebar">
          <MarcosProjetoSection marcos={marcos} loading={marcosLoading} />
          <ChangeLogPanel changeLog={changeLog} loading={changeLogLoading} />
        </div>
      </div>
    </div>
  );
}

export default ClientDashboardView;

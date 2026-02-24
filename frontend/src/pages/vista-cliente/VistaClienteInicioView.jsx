/**
 * Componente: Vista do Cliente - Início
 *
 * Dashboard principal do projeto na perspectiva do cliente.
 * Agrega KPIs, marcos, gráfico S-curve, relatos e changelog.
 * Reutiliza componentes existentes da plataforma.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import VistaClienteKpiStrip from './VistaClienteKpiStrip';
import MarcosProjetoSection from './MarcosProjetoSection';
import RelatosSection from './RelatosSection';
import ChartSection from './ChartSection';
import ChangeLogPanel from '../../components/curva-s-progresso/ChangeLogPanel';
import '../../styles/VistaClienteView.css';

// Status finalizados (excluir do seletor de projetos ativos)
const FINALIZED_STATUSES = [
  'churn pelo cliente', 'close', 'obra finalizada', 'termo de encerramento',
  'termo de encerrame', 'encerrado', 'finalizado', 'concluído', 'concluido',
  'cancelado', 'execução', 'execucao',
];
const PAUSED_STATUSES = ['pausado', 'pausa', 'em pausa', 'pausado pelo cliente', 'suspenso', 'suspensão'];

const isFinalizedStatus = (status) => {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return FINALIZED_STATUSES.some(f => s === f.toLowerCase().trim() || s.includes(f.toLowerCase().trim()));
};

const isPausedStatus = (status) => {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return PAUSED_STATUSES.some(p => s === p.toLowerCase().trim() || s.includes(p.toLowerCase().trim()));
};

function VistaClienteInicioView() {
  // ---- Estado geral ----
  const [portfolio, setPortfolio] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

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
  const [apontamentosCount, setApontamentosCount] = useState({ total: 0, definicoes: 0 });

  // ---- Projeto selecionado ----
  const selectedProject = portfolio.find(p =>
    String(p.project_code_norm || p.project_code) === String(selectedProjectId)
  );
  const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code || selectedProjectId;
  const smartsheetId = selectedProject?.smartsheet_id;
  const projectName = selectedProject?.project_name;
  const projectId = selectedProject?.id;
  const construflowId = selectedProject?.construflow_id;

  // ---- Fetch portfolio ----
  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
        const data = res.data.data || [];
        setPortfolio(data);

        // Selecionar primeiro projeto ativo
        const valid = data
          .filter(p => p.project_code_norm && !isFinalizedStatus(p.status) && !isPausedStatus(p.status))
          .reduce((acc, p) => {
            if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
            return acc;
          }, [])
          .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));

        if (valid.length > 0) {
          setSelectedProjectId(valid[0].project_code_norm);
        }
      } catch (err) {
        console.error('Erro ao buscar portfolio:', err);
      }
    }
    load();
  }, []);

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

  // ---- Fetch marcos (cronograma filtrado por CaminhoCriticoMarco) ----
  const fetchMarcos = useCallback(async () => {
    if (!smartsheetId && !projectName) {
      setMarcos([]);
      return;
    }
    setMarcosLoading(true);
    try {
      const params = new URLSearchParams();
      if (smartsheetId) params.set('smartsheetId', smartsheetId);
      if (projectName) params.set('projectName', projectName);

      const res = await axios.get(
        `${API_URL}/api/projetos/cronograma?${params}`,
        { withCredentials: true }
      );
      const tasks = res.data?.data || [];

      // Filtrar por CaminhoCriticoMarco preenchido e excluir internos (INT)
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      // Agrupar por nome do marco (deduplicar tarefas com mesmo CaminhoCriticoMarco)
      const marcosMap = new Map();
      tasks.forEach(t => {
        const marco = t.CaminhoCriticoMarco;
        if (!marco || !String(marco).trim()) return;
        // Excluir marcos internos
        if (String(marco).trim().toUpperCase().startsWith('INT')) return;

        const nome = String(marco).trim();
        const variancia = t.VarianciaBaselineOtus;
        const dataTermino = t.DataDeTermino;
        const dataAtualizacao = t.DataAtualizacao ? new Date(t.DataAtualizacao) : null;
        const alteradoRecente = dataAtualizacao && dataAtualizacao >= oneMonthAgo;

        // Se já existe, manter o com data de término mais tardia (última entrega)
        if (marcosMap.has(nome)) {
          const existing = marcosMap.get(nome);
          const existingDate = existing.prazoAtual ? new Date(existing.prazoAtual) : null;
          const newDate = dataTermino ? new Date(dataTermino) : null;
          if (newDate && (!existingDate || newDate > existingDate)) {
            marcosMap.set(nome, {
              nome,
              status: t.Status,
              prazoAtual: dataTermino,
              prazoBase: t.DataDeFimBaselineOtus,
              variacaoDias: variancia != null ? Number(variancia) : null,
              alteradoRecente: existing.alteradoRecente || alteradoRecente,
            });
          }
        } else {
          marcosMap.set(nome, {
            nome,
            status: t.Status,
            prazoAtual: dataTermino,
            prazoBase: t.DataDeFimBaselineOtus,
            variacaoDias: variancia != null ? Number(variancia) : null,
            alteradoRecente,
          });
        }
      });

      setMarcos(Array.from(marcosMap.values()));
    } catch (err) {
      console.error('Erro ao buscar marcos:', err);
      setMarcos([]);
    } finally {
      setMarcosLoading(false);
    }
  }, [smartsheetId, projectName]);

  // ---- Fetch apontamentos (contagem) ----
  const fetchApontamentos = useCallback(async () => {
    if (!construflowId) {
      setApontamentosCount({ total: 0, definicoes: 0 });
      return;
    }
    try {
      const res = await axios.get(
        `${API_URL}/api/projetos/apontamentos?construflowId=${encodeURIComponent(construflowId)}`,
        { withCredentials: true }
      );
      const issues = res.data?.data || [];

      // Contar apontamentos abertos (status != "Fechado" / "Closed")
      const closedStatuses = ['fechado', 'closed', 'resolvido', 'resolved', 'cancelado'];
      const open = issues.filter(i => {
        const s = String(i.status || '').toLowerCase().trim();
        return !closedStatuses.some(c => s.includes(c));
      });

      setApontamentosCount({
        total: open.length,
        definicoes: open.length, // Por enquanto, todas abertas = definições a tomar
      });
    } catch (err) {
      console.error('Erro ao buscar apontamentos:', err);
      setApontamentosCount({ total: 0, definicoes: 0 });
    }
  }, [construflowId]);

  // ---- Efeitos de fetch quando projeto muda ----
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

  // Reset changelog quando muda projeto
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

  // ---- Projetos filtrados para o select ----
  const sortedProjects = portfolio
    .filter(p => {
      if (!p.project_code_norm) return false;
      if (showOnlyActive) {
        if (isFinalizedStatus(p.status) || isPausedStatus(p.status)) return false;
      }
      return true;
    })
    .reduce((acc, p) => {
      if (!acc.find(x => x.project_code_norm === p.project_code_norm)) acc.push(p);
      return acc;
    }, [])
    .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || '', 'pt-BR'));

  return (
    <div className="vista-cliente-container">
      {/* Header com seletor de projeto */}
      <div className="vc-header">
        <div className="vc-header-left">
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
        </div>
        <div className="vc-header-right">
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
          {/* KPI Strip */}
          <VistaClienteKpiStrip
            progress={progress}
            project={selectedProject}
            apontamentosCount={apontamentosCount}
            loading={progressLoading}
          />

          {/* Grid principal: 3 colunas */}
          <div className="vc-main-grid">
            {/* Coluna esquerda: Marcos + Relatos */}
            <div className="vc-left-col">
              <MarcosProjetoSection marcos={marcos} loading={marcosLoading} />
              <RelatosSection projectCode={projectCode} />
            </div>

            {/* Coluna central: Gráfico S-curve */}
            <div className="vc-center-col">
              <ChartSection
                prazos={prazos}
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

            {/* Coluna direita: Changelog */}
            <div className="vc-right-col">
              <div className="vc-changelog-section">
                <ChangeLogPanel changeLog={changeLog} loading={changeLogLoading} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VistaClienteInicioView;

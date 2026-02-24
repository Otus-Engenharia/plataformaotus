/**
 * Componente: Curva S de Progresso Físico
 *
 * Container principal da aba "Curva S" em ProjetosView.
 * Exibe configuração de pesos, gráfico de progresso e breakdown de tarefas.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import RequestBaselineModal from './baselines/RequestBaselineModal';
import WeightConfigPanel from './curva-s-progresso/WeightConfigPanel';
import ProgressKpiCards from './curva-s-progresso/ProgressKpiCards';
import WeightSummaryTable from './curva-s-progresso/WeightSummaryTable';
import ProgressChart from './curva-s-progresso/ProgressChart';
import ChartFilterSidebar from './curva-s-progresso/ChartFilterSidebar';
import ChangeLogPanel from './curva-s-progresso/ChangeLogPanel';
import ChangeLogTab from './curva-s-progresso/ChangeLogTab';
import '../styles/CurvaSProgressoView.css';

function CurvaSProgressoView({ selectedProjectId, portfolio }) {
  const { user, isCoordinator, isPrivileged } = useAuth();
  const [weights, setWeights] = useState(null);
  const [progress, setProgress] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [phaseBreakdown, setPhaseBreakdown] = useState([]);
  const [timeseries, setTimeseries] = useState([]);
  const [snapshotCurves, setSnapshotCurves] = useState([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('grafico');

  // Filtros de visibilidade das curvas
  const [showExecutado, setShowExecutado] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);
  const [visibleSnapshots, setVisibleSnapshots] = useState(null); // null = todos visíveis
  const [baselineCurve, setBaselineCurve] = useState(null);
  const [baselineCurves, setBaselineCurves] = useState([]);
  const [visibleBaselines, setVisibleBaselines] = useState(null); // null = todas visíveis
  const [prazos, setPrazos] = useState(null);

  // Estado das barras mensais
  const [showBarExecutado, setShowBarExecutado] = useState(true);
  const [visibleBaselineBars, setVisibleBaselineBars] = useState(new Set());

  // Changelog state
  const [changeLog, setChangeLog] = useState(null);
  const [changeLogLoading, setChangeLogLoading] = useState(false);

  // Solicitação de baseline state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestingBaseline, setRequestingBaseline] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(null);

  // Buscar dados do projeto selecionado no portfolio
  const selectedProject = portfolio?.find(p =>
    String(p.project_code_norm || p.project_code) === String(selectedProjectId)
  );

  const projectCode = selectedProject?.project_code_norm || selectedProject?.project_code || selectedProjectId;
  const smartsheetId = selectedProject?.smartsheet_id;
  const projectName = selectedProject?.project_name;
  const projectId = selectedProject?.id;

  // Buscar pesos do projeto
  const fetchWeights = useCallback(async () => {
    if (!projectCode) return;
    try {
      const res = await axios.get(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/weights`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setWeights(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar pesos:', err);
    }
  }, [projectCode]);

  // Buscar progresso calculado
  const fetchProgress = useCallback(async () => {
    if (!projectCode || (!smartsheetId && !projectName)) return;
    setLoading(true);
    setError(null);
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
        setTasks(res.data.data.tasks || []);
        setPhaseBreakdown(res.data.data.phase_breakdown || []);
        if (res.data.data.weights) {
          setWeights(res.data.data.weights);
        }
      }
    } catch (err) {
      console.error('Erro ao calcular progresso:', err);
      setError(err.response?.data?.error || 'Erro ao calcular progresso');
    } finally {
      setLoading(false);
    }
  }, [projectCode, smartsheetId, projectName, projectId]);

  // Buscar série temporal para o gráfico
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
        // Resetar filtros quando mudar de projeto
        setVisibleSnapshots(null);
        setVisibleBaselines(null);
        setShowExecutado(true);
        setShowBaseline(true);
      }
    } catch (err) {
      console.error('Erro ao buscar série temporal:', err);
    } finally {
      setTimeseriesLoading(false);
    }
  }, [projectCode, smartsheetId, projectName, projectId]);

  // Buscar log de alterações mensais
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
      if (res.data.success) {
        setChangeLog(res.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar log de alterações:', err);
    } finally {
      setChangeLogLoading(false);
    }
  }, [projectCode, smartsheetId, projectName]);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    fetchTimeseries();
  }, [fetchTimeseries]);

  // Inicializar barras de baseline: apenas última visível por padrão
  useEffect(() => {
    const allBl = baselineCurves.length > 0 ? baselineCurves : (baselineCurve ? [baselineCurve] : []);
    if (allBl.length > 0) {
      const last = allBl[allBl.length - 1];
      setVisibleBaselineBars(new Set([last.id ?? last.label]));
    } else {
      setVisibleBaselineBars(new Set());
    }
  }, [baselineCurves, baselineCurve]);

  // Resetar changelog quando mudar de projeto
  useEffect(() => {
    setChangeLog(null);
  }, [projectCode]);

  // Lazy load changelog quando aba relevante fica ativa
  useEffect(() => {
    if ((activeTab === 'grafico' || activeTab === 'alteracoes') && !changeLog && !changeLogLoading) {
      fetchChangeLog();
    }
  }, [activeTab, changeLog, changeLogLoading, fetchChangeLog]);

  // Handler para salvar pesos customizados
  const handleSaveWeights = async (weightData) => {
    try {
      const res = await axios.put(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/weights`,
        weightData,
        { withCredentials: true }
      );
      if (res.data.success) {
        await fetchWeights();
        await fetchProgress();
        await fetchTimeseries();
      }
    } catch (err) {
      console.error('Erro ao salvar pesos:', err);
      throw err;
    }
  };

  // Handler para resetar para padrão
  const handleResetWeights = async () => {
    try {
      await axios.delete(
        `${API_URL}/api/curva-s-progresso/project/${encodeURIComponent(projectCode)}/weights`,
        { withCredentials: true }
      );
      await fetchWeights();
      await fetchProgress();
      await fetchTimeseries();
    } catch (err) {
      console.error('Erro ao resetar pesos:', err);
    }
  };

  // Toggle barras de baseline
  const toggleBaselineBar = (key) => {
    setVisibleBaselineBars(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Toggle de visibilidade de snapshot
  const toggleSnapshot = (snapshotDate) => {
    setVisibleSnapshots(prev => {
      const current = prev || new Set(snapshotCurves.map(sc => sc.snapshot_date));
      const next = new Set(current);
      if (next.has(snapshotDate)) {
        next.delete(snapshotDate);
      } else {
        next.add(snapshotDate);
      }
      return next;
    });
  };

  const selectAllSnapshots = () => setVisibleSnapshots(null);
  const clearAllSnapshots = () => setVisibleSnapshots(new Set());

  // Handler para solicitar baseline
  const handleRequestBaseline = async ({ title, description, response_deadline }) => {
    setRequestingBaseline(true);
    try {
      await axios.post(`${API_URL}/api/baseline-requests`, {
        project_code: projectCode,
        project_name: projectName,
        title,
        description,
        response_deadline,
      }, { withCredentials: true });
      setShowRequestModal(false);
      setRequestSuccess('Solicitacao enviada com sucesso! O gerente sera notificado.');
      setTimeout(() => setRequestSuccess(null), 5000);
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Erro ao enviar solicitacao');
    } finally {
      setRequestingBaseline(false);
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="curva-s-progresso-empty">
        <p>Selecione um projeto para visualizar a Curva S de progresso.</p>
      </div>
    );
  }

  if (!smartsheetId && !projectName) {
    return (
      <div className="curva-s-progresso-empty">
        <p>Este projeto não possui SmartSheet vinculado. A Curva S requer dados do cronograma.</p>
      </div>
    );
  }

  return (
    <div className="curva-s-progresso-container">
      {/* KPI Cards */}
      <ProgressKpiCards progress={progress} prazos={prazos} loading={loading} />

      {/* Botão de solicitação de baseline (coordenadores) */}
      {isCoordinator && projectCode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0.5rem 0' }}>
          <button
            className="btn-modal-confirm"
            onClick={() => setShowRequestModal(true)}
            style={{ fontSize: '0.813rem', padding: '0.5rem 1rem' }}
          >
            Solicitar Nova Baseline
          </button>
        </div>
      )}

      {/* Feedback de sucesso */}
      {requestSuccess && (
        <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          {requestSuccess}
        </div>
      )}

      {/* Modal de solicitação */}
      {showRequestModal && (
        <RequestBaselineModal
          projectName={projectName}
          projectCode={projectCode}
          onConfirm={handleRequestBaseline}
          onCancel={() => setShowRequestModal(false)}
          loading={requestingBaseline}
        />
      )}

      {/* Tabs internas */}
      <div className="curva-s-tabs">
        <button
          className={`curva-s-tab ${activeTab === 'grafico' ? 'active' : ''}`}
          onClick={() => setActiveTab('grafico')}
        >
          Gráfico
        </button>
        <button
          className={`curva-s-tab ${activeTab === 'resumo' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumo')}
        >
          Resumo
        </button>
        <button
          className={`curva-s-tab ${activeTab === 'pesos' ? 'active' : ''}`}
          onClick={() => setActiveTab('pesos')}
        >
          Configuração de Pesos
        </button>
        <button
          className={`curva-s-tab ${activeTab === 'tarefas' ? 'active' : ''}`}
          onClick={() => setActiveTab('tarefas')}
        >
          Tarefas ({tasks.length})
        </button>
        <button
          className={`curva-s-tab ${activeTab === 'alteracoes' ? 'active' : ''}`}
          onClick={() => setActiveTab('alteracoes')}
        >
          Alterações
          {changeLog?.overall_summary?.total_changes > 0 && (
            <span className="curva-s-tab-badge">{changeLog.overall_summary.total_changes}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="curva-s-error">
          <span>{error}</span>
        </div>
      )}

      {/* Conteúdo baseado na tab ativa */}
      <div className="curva-s-content">
        {activeTab === 'grafico' && (
          <div className="curva-s-chart-layout-v3">
            <ChartFilterSidebar
              showExecutado={showExecutado}
              onToggleExecutado={() => setShowExecutado(prev => !prev)}
              baselineCurve={baselineCurve}
              baselineCurves={baselineCurves}
              showBaseline={showBaseline}
              onToggleBaseline={() => setShowBaseline(prev => !prev)}
              visibleBaselines={visibleBaselines}
              onToggleBaseline2={(key) => {
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
              }}
              snapshotCurves={snapshotCurves}
              visibleSnapshots={visibleSnapshots}
              onToggleSnapshot={toggleSnapshot}
              onSelectAllSnapshots={selectAllSnapshots}
              onClearAllSnapshots={clearAllSnapshots}
              showBarExecutado={showBarExecutado}
              onToggleBarExecutado={() => setShowBarExecutado(prev => !prev)}
              visibleBaselineBars={visibleBaselineBars}
              onToggleBaselineBar={toggleBaselineBar}
            />
            <div className="curva-s-chart-main-v3">
              <ProgressChart
                timeseries={timeseries}
                snapshotCurves={snapshotCurves}
                baselineCurve={baselineCurve}
                baselineCurves={baselineCurves}
                visibleBaselines={visibleBaselines}
                visibleSnapshots={visibleSnapshots}
                showExecutado={showExecutado}
                showBaseline={showBaseline}
                showBarExecutado={showBarExecutado}
                visibleBaselineBars={visibleBaselineBars}
                loading={timeseriesLoading}
              />
            </div>
            <ChangeLogPanel
              changeLog={changeLog}
              loading={changeLogLoading}
            />
          </div>
        )}

        {activeTab === 'resumo' && (
          <div className="curva-s-resumo-layout">
            <WeightSummaryTable
              phaseBreakdown={phaseBreakdown}
              progress={progress}
            />
          </div>
        )}

        {activeTab === 'pesos' && (
          <div className="curva-s-pesos-layout">
            <div className="curva-s-pesos-config">
              <WeightConfigPanel
                weights={weights}
                phaseBreakdown={phaseBreakdown}
                onSave={handleSaveWeights}
                onReset={handleResetWeights}
                loading={loading}
              />
            </div>
            <div className="curva-s-pesos-summary">
              <WeightSummaryTable
                phaseBreakdown={phaseBreakdown}
                progress={progress}
              />
            </div>
          </div>
        )}

        {activeTab === 'tarefas' && (
          <div className="curva-s-tarefas-layout">
            <TaskWeightTable tasks={tasks} loading={loading} />
          </div>
        )}

        {activeTab === 'alteracoes' && (
          <ChangeLogTab
            changeLog={changeLog}
            loading={changeLogLoading}
            projectCode={projectCode}
            onRefresh={fetchChangeLog}
          />
        )}
      </div>
    </div>
  );
}

// Tabela de tarefas inline
function TaskWeightTable({ tasks, loading }) {
  const [filter, setFilter] = useState('all');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return t.peso_no_projeto > 0;
    if (filter === 'excluded') return t.peso_no_projeto === 0;
    return true;
  });

  if (loading) {
    return <div className="curva-s-loading">Calculando pesos das tarefas...</div>;
  }

  return (
    <div className="task-weight-table-container">
      <div className="task-weight-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Todas ({tasks.length})
        </button>
        <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>
          Com peso ({tasks.filter(t => t.peso_no_projeto > 0).length})
        </button>
        <button className={filter === 'excluded' ? 'active' : ''} onClick={() => setFilter('excluded')}>
          Excluídas ({tasks.filter(t => t.peso_no_projeto === 0).length})
        </button>
      </div>
      <div className="task-weight-table-scroll">
        <table className="task-weight-table">
          <thead>
            <tr>
              <th>Tarefa</th>
              <th>Fase</th>
              <th>Disciplina</th>
              <th>Etapa</th>
              <th>Status</th>
              <th>Peso (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task, idx) => (
              <tr key={idx} className={`${task.is_complete ? 'completed' : ''} ${task.peso_no_projeto === 0 ? 'excluded' : ''}`}>
                <td className="task-name" title={task.task_name}>{task.task_name}</td>
                <td>{task.fase || '-'}</td>
                <td>{task.discipline_standard || task.discipline_raw || '-'}</td>
                <td>{task.activity_type || '-'}</td>
                <td>
                  <span className={`status-badge ${task.is_complete ? 'complete' : 'pending'}`}>
                    {task.status || '-'}
                  </span>
                </td>
                <td className="peso-cell">{task.peso_no_projeto > 0 ? `${task.peso_no_projeto.toFixed(2)}%` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CurvaSProgressoView;

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
import WeightConfigPanel from './curva-s-progresso/WeightConfigPanel';
import ProgressKpiCards from './curva-s-progresso/ProgressKpiCards';
import WeightSummaryTable from './curva-s-progresso/WeightSummaryTable';
import '../styles/CurvaSProgressoView.css';

function CurvaSProgressoView({ selectedProjectId, portfolio }) {
  const { user } = useAuth();
  const [weights, setWeights] = useState(null);
  const [progress, setProgress] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [phaseBreakdown, setPhaseBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pesos'); // 'pesos' | 'tarefas'

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

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

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
    } catch (err) {
      console.error('Erro ao resetar pesos:', err);
    }
  };

  if (!selectedProjectId) {
    return (
      <div className="curva-s-progresso-empty">
        <p>Selecione um projeto para visualizar a Curva S de progresso.</p>
      </div>
    );
  }

  return (
    <div className="curva-s-progresso-container">
      {/* KPI Cards */}
      <ProgressKpiCards progress={progress} loading={loading} />

      {/* Tabs internas */}
      <div className="curva-s-tabs">
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
      </div>

      {error && (
        <div className="curva-s-error">
          <span>{error}</span>
        </div>
      )}

      {/* Conteúdo baseado na tab ativa */}
      <div className="curva-s-content">
        {activeTab === 'pesos' && (
          <div className="curva-s-pesos-layout">
            <div className="curva-s-pesos-config">
              <WeightConfigPanel
                weights={weights}
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
      </div>
    </div>
  );
}

// Tabela de tarefas inline para simplicidade
function TaskWeightTable({ tasks, loading }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'excluded'

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

/**
 * Componente: Vista de Indicadores
 * 
 * Dashboard de métricas e indicadores de desempenho
 * Baseado no repositório: https://github.com/Otus-Engenharia/indicadores
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Line, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from '../api';
import '../styles/IndicadoresView.css';

// Registra componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

function IndicadoresView() {
  const [loading, setLoading] = useState(true);
  const [indicadores, setIndicadores] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('mensal'); // mensal, trimestral, anual
  const [selectedCategory, setSelectedCategory] = useState('todos'); // todos, projetos, financeiro, operacional

  useEffect(() => {
    fetchIndicadores();
  }, [selectedPeriod, selectedCategory]);

  const fetchIndicadores = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/indicadores`, {
        params: { period: selectedPeriod, category: selectedCategory },
        withCredentials: true,
      });
      
      if (response.data?.success) {
        setIndicadores(response.data.data || []);
      } else {
        // Fallback para dados mockados se a tabela ainda não existir
        setIndicadores([
        {
          id: 1,
          nome: 'Taxa de Conclusão de Projetos',
          valor: 85,
          meta: 90,
          unidade: '%',
          categoria: 'projetos',
          tendencia: 'up',
        },
        {
          id: 2,
          nome: 'Satisfação do Cliente (NPS)',
          valor: 72,
          meta: 80,
          unidade: 'pontos',
          categoria: 'operacional',
          tendencia: 'up',
        },
        {
          id: 3,
          nome: 'Margem de Lucro',
          valor: 18.5,
          meta: 20,
          unidade: '%',
          categoria: 'financeiro',
          tendencia: 'stable',
        },
        {
          id: 4,
          nome: 'Tempo Médio de Entrega',
          valor: 45,
          meta: 40,
          unidade: 'dias',
          categoria: 'operacional',
          tendencia: 'down',
        },
        ]);
      }
    } catch (error) {
      console.error('Erro ao buscar indicadores:', error);
      // Em caso de erro (ex: tabela não existe ainda), usa dados mockados
      setIndicadores([
        {
          id: 1,
          nome: 'Taxa de Conclusão de Projetos',
          valor: 85,
          meta: 90,
          unidade: '%',
          categoria: 'projetos',
          tendencia: 'up',
        },
        {
          id: 2,
          nome: 'Satisfação do Cliente (NPS)',
          valor: 72,
          meta: 80,
          unidade: 'pontos',
          categoria: 'operacional',
          tendencia: 'up',
        },
        {
          id: 3,
          nome: 'Margem de Lucro',
          valor: 18.5,
          meta: 20,
          unidade: '%',
          categoria: 'financeiro',
          tendencia: 'stable',
        },
        {
          id: 4,
          nome: 'Tempo Médio de Entrega',
          valor: 45,
          meta: 40,
          unidade: 'dias',
          categoria: 'operacional',
          tendencia: 'down',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredIndicadores = selectedCategory === 'todos' 
    ? indicadores 
    : indicadores.filter(ind => ind.categoria === selectedCategory);

  const getStatusColor = (indicador) => {
    const percentual = (indicador.valor / indicador.meta) * 100;
    if (percentual >= 100) return '#34A853'; // Verde
    if (percentual >= 80) return '#FBBC05'; // Amarelo
    return '#EA4335'; // Vermelho
  };

  const getTendenciaIcon = (tendencia) => {
    switch (tendencia) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  // Dados para gráfico de barras
  const chartData = {
    labels: filteredIndicadores.map(ind => ind.nome),
    datasets: [
      {
        label: 'Valor Atual',
        data: filteredIndicadores.map(ind => ind.valor),
        backgroundColor: filteredIndicadores.map(ind => getStatusColor(ind)),
        borderColor: filteredIndicadores.map(ind => getStatusColor(ind)),
        borderWidth: 1,
      },
      {
        label: 'Meta',
        data: filteredIndicadores.map(ind => ind.meta),
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderColor: '#1a1a1a',
        borderWidth: 2,
        borderDash: [5, 5],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const indicador = filteredIndicadores[context.dataIndex];
            return `${context.dataset.label}: ${context.parsed.y} ${indicador.unidade}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) {
    return (
      <div className="indicadores-container">
        <div className="indicadores-loading">
          <p>Carregando indicadores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="indicadores-container">
      <div className="indicadores-header">
        <h2>Indicadores</h2>
        <p className="indicadores-subtitle">Métricas e indicadores de desempenho</p>
      </div>

      {/* Filtros */}
      <div className="indicadores-filters">
        <div className="filter-group">
          <label>Período:</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="filter-select"
          >
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Categoria:</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
          >
            <option value="todos">Todos</option>
            <option value="projetos">Projetos</option>
            <option value="financeiro">Financeiro</option>
            <option value="operacional">Operacional</option>
          </select>
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="indicadores-kpi-grid">
        {filteredIndicadores.map((indicador) => {
          const percentual = (indicador.valor / indicador.meta) * 100;
          return (
            <div key={indicador.id} className="kpi-card">
              <div className="kpi-header">
                <h3 className="kpi-title">{indicador.nome}</h3>
                <span className={`kpi-tendencia kpi-tendencia-${indicador.tendencia}`}>
                  {getTendenciaIcon(indicador.tendencia)}
                </span>
              </div>
              <div className="kpi-value-container">
                <span className="kpi-value">{indicador.valor}</span>
                <span className="kpi-unit">{indicador.unidade}</span>
              </div>
              <div className="kpi-meta">
                <span>Meta: {indicador.meta} {indicador.unidade}</span>
                <span className="kpi-percentual">{percentual.toFixed(1)}%</span>
              </div>
              <div className="kpi-progress-bar">
                <div 
                  className="kpi-progress-fill"
                  style={{ 
                    width: `${Math.min(percentual, 100)}%`,
                    backgroundColor: getStatusColor(indicador)
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico */}
      {filteredIndicadores.length > 0 && (
        <div className="indicadores-chart-container">
          <h3 className="chart-title">Comparativo: Valor vs Meta</h3>
          <div className="chart-wrapper">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Nota de desenvolvimento */}
      <div className="indicadores-note">
        <p>
          <strong>Nota:</strong> Esta funcionalidade está em desenvolvimento. 
          Baseado no repositório: <a href="https://github.com/Otus-Engenharia/indicadores" target="_blank" rel="noreferrer">github.com/Otus-Engenharia/indicadores</a>
        </p>
      </div>
    </div>
  );
}

export default IndicadoresView;

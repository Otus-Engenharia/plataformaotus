/**
 * Componente: Vista de Indicadores do Portfolio
 *
 * Exibe KPIs e analytics do portfolio de projetos
 * Separado da tabela detalhada (PortfolioView)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';
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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import CoberturaDisciplinasView from './CoberturaDisciplinasView';
import DesviosPortfolioView from './curva-s-progresso/DesviosPortfolioView';
import '../styles/IndicadoresView.css';

// Registra componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

function IndicadoresView() {
  const { hasFullAccess } = useAuth();
  const {
    loading,
    error,
    fetchPortfolioData,
    timeFilter,
    setTimeFilter,
    liderFilter,
    setLiderFilter,
    uniqueTimes,
    uniqueLiders,
    kpis,
    differenceChartData,
    projetosAtivosPorFase,
    projetosPausadosPorFase,
    projetosFinalizadosPorFase,
    tabelaAtivosData,
    tabelaPausadosData,
    tabelaFinalizadosData
  } = usePortfolio();

  // Estado da tab ativa
  const [activeTab, setActiveTab] = useState('lideres');

  // Estados locais para controle dos dropdowns
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [liderDropdownOpen, setLiderDropdownOpen] = useState(false);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.multi-select-wrapper')) {
        setTimeDropdownOpen(false);
        setLiderDropdownOpen(false);
      }
    };

    if (timeDropdownOpen || liderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [timeDropdownOpen, liderDropdownOpen]);

  // Handlers para filtros
  const handleTimeToggle = (time) => {
    setTimeFilter(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      } else {
        return [...prev, time];
      }
    });
  };

  const handleLiderToggle = (lider) => {
    setLiderFilter(prev => {
      if (prev.includes(lider)) {
        return prev.filter(l => l !== lider);
      } else {
        return [...prev, lider];
      }
    });
  };

  const handleSelectAllTime = () => {
    if (timeFilter.length === uniqueTimes.length) {
      setTimeFilter([]);
    } else {
      setTimeFilter([...uniqueTimes]);
    }
  };

  const handleSelectAllLider = () => {
    if (liderFilter.length === uniqueLiders.length) {
      setLiderFilter([]);
    } else {
      setLiderFilter([...uniqueLiders]);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="indicadores-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Carregando indicadores...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="indicadores-container">
        <div className="error-state">
          <h3>Erro ao carregar dados</h3>
          <p>{error}</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="indicadores-container">
      {/* Header */}
      <div className="header">
        <h2>Indicadores do Portfolio</h2>
        <div className="header-actions">
          <button onClick={fetchPortfolioData} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="indicadores-tabs">
        <button
          className={`indicadores-tab ${activeTab === 'lideres' ? 'indicadores-tab-active' : ''}`}
          onClick={() => setActiveTab('lideres')}
        >
          Lideres de Projeto
        </button>
        <button
          className={`indicadores-tab ${activeTab === 'coordenacao' ? 'indicadores-tab-active' : ''}`}
          onClick={() => setActiveTab('coordenacao')}
        >
          Indicadores de Coordenacao
        </button>
        <button
          className={`indicadores-tab ${activeTab === 'desvios' ? 'indicadores-tab-active' : ''}`}
          onClick={() => setActiveTab('desvios')}
        >
          Análise de Desvios
        </button>
      </div>

      {/* Filtros Principais - Sticky no topo */}
      <div className="top-filters-sticky">
        <div className="top-filters-container">
          <div className="top-filters-label">Filtros Principais:</div>
          <div className="top-filters-dropdowns">
            {/* Filtro de Time */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setTimeDropdownOpen(!timeDropdownOpen);
                  setLiderDropdownOpen(false);
                }}
              >
                <span>
                  {timeFilter.length === 0
                    ? 'Todos os Times'
                    : timeFilter.length === 1
                      ? timeFilter[0]
                      : `${timeFilter.length} Times selecionados`}
                </span>
                <span className="dropdown-arrow">{timeDropdownOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {timeDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={timeFilter.length === uniqueTimes.length && uniqueTimes.length > 0}
                        onChange={handleSelectAllTime}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueTimes.map(time => (
                      <label key={time} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={timeFilter.includes(time)}
                          onChange={() => handleTimeToggle(time)}
                        />
                        <span>{time}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Lider - apenas para diretora/admin */}
            {hasFullAccess && (
              <div className="multi-select-wrapper">
                <button
                  type="button"
                  className="multi-select-button"
                  onClick={() => {
                    setLiderDropdownOpen(!liderDropdownOpen);
                    setTimeDropdownOpen(false);
                  }}
                >
                  <span>
                    {liderFilter.length === 0
                      ? 'Todos os Lideres'
                      : liderFilter.length === 1
                        ? liderFilter[0]
                        : `${liderFilter.length} Lideres selecionados`}
                  </span>
                  <span className="dropdown-arrow">{liderDropdownOpen ? '\u25B2' : '\u25BC'}</span>
                </button>
                {liderDropdownOpen && (
                  <div className="multi-select-dropdown">
                    <div className="multi-select-header">
                      <label className="select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={liderFilter.length === uniqueLiders.length && uniqueLiders.length > 0}
                          onChange={handleSelectAllLider}
                        />
                        <span>Selecionar Todos</span>
                      </label>
                    </div>
                    <div className="multi-select-options">
                      {uniqueLiders.map(lider => (
                        <label key={lider} className="multi-select-option">
                          <input
                            type="checkbox"
                            checked={liderFilter.includes(lider)}
                            onChange={() => handleLiderToggle(lider)}
                          />
                          <span>{lider}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'coordenacao' && (
        <CoberturaDisciplinasView />
      )}

      {activeTab === 'desvios' && (
        <DesviosPortfolioView />
      )}

      {activeTab === 'lideres' && (
      <>
      {/* RESUMO EXECUTIVO - KPIs */}
      <div className="executive-summary">
        <div className="summary-header">
          <h3 className="summary-title">Resumo Executivo</h3>
          <p className="summary-subtitle">Visao geral do portfolio de projetos</p>
        </div>

        <div className="kpi-hero-section">
          <div className="kpi-hero-card kpi-hero-primary">
            <div className="kpi-hero-label">Projetos Ativos</div>
            <div className="kpi-hero-value">
              {kpis.projetosAtivos}
              {kpis.totalProjetos > 0 && (
                <span className="kpi-hero-percentage">
                  {' '}({((kpis.projetosAtivos / kpis.totalProjetos) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="kpi-hero-context">
              de {kpis.totalProjetos} total
            </div>
          </div>

          <div className="kpi-hero-card kpi-hero-warning">
            <div className="kpi-hero-label">Projetos em Atraso</div>
            <div className="kpi-hero-value">
              {kpis.projetosEmAtraso}
              {kpis.projetosAtivos > 0 && (
                <span className="kpi-hero-percentage">
                  {' '}({((kpis.projetosEmAtraso / kpis.projetosAtivos) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="kpi-hero-context">
              de {kpis.projetosAtivos} projetos ativos
            </div>
          </div>

          <div className="kpi-hero-card kpi-hero-currency">
            <div className="kpi-hero-label">Valor Total do Portfolio</div>
            <div className="kpi-hero-value kpi-hero-value-currency">
              {kpis.valorTotal > 0
                ? `R$ ${kpis.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'R$ 0,00'}
            </div>
            <div className="kpi-hero-context">
              {kpis.totalProjetos} projetos
            </div>
          </div>

          <div className="kpi-hero-card">
            <div className="kpi-hero-label">Projetos Pausados</div>
            <div className="kpi-hero-value">
              {kpis.projetosPausados}
              {kpis.totalProjetos > 0 && (
                <span className="kpi-hero-percentage">
                  {' '}({((kpis.projetosPausados / kpis.totalProjetos) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="kpi-hero-context">
              de {kpis.totalProjetos} total
            </div>
          </div>

          <div className="kpi-hero-card">
            <div className="kpi-hero-label">Projetos Finalizados</div>
            <div className="kpi-hero-value">
              {kpis.projetosFinalizados}
              {kpis.totalProjetos > 0 && (
                <span className="kpi-hero-percentage">
                  {' '}({((kpis.projetosFinalizados / kpis.totalProjetos) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="kpi-hero-context">
              de {kpis.totalProjetos} total
            </div>
          </div>
        </div>
      </div>

      {/* ANALISE DO PORTFOLIO - Graficos e tabelas */}
      <div className="insights-section">
        <div className="insights-header">
          <h3 className="insights-title">Analise do Portfolio</h3>
          <p className="insights-subtitle">Distribuicao e status dos projetos</p>
        </div>

        <div className="charts-storytelling">
          {/* Grafico Principal: Status de Prazo */}
          {differenceChartData && (
            <div className="chart-story-primary">
              <div className="chart-story-header">
                <h4 className="chart-story-title">Status de Prazo dos Projetos</h4>
                <p className="chart-story-description">
                  Distribuicao de projetos ativos por situacao de prazo em relacao ao contrato
                </p>
              </div>
              <div className="chart-story-wrapper">
                <Bar
                  key="difference-chart"
                  data={differenceChartData}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        backgroundColor: 'rgba(26, 26, 26, 0.9)',
                        padding: 10,
                        titleFont: {
                          size: 11,
                          weight: 'bold',
                          family: 'Verdana'
                        },
                        bodyFont: {
                          size: 10,
                          family: 'Verdana'
                        },
                        cornerRadius: 4,
                        displayColors: false
                      },
                      datalabels: {
                        anchor: (context) => {
                          if (!context || !context.dataset || !context.parsed) {
                            return 'end';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return 'end';
                          }
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return 'end';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          if (currentValue > maxValue * 0.8) {
                            return 'center';
                          }
                          return 'end';
                        },
                        align: 'right',
                        offset: (context) => {
                          if (!context || !context.dataset || !context.parsed) {
                            return 12;
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return 12;
                          }
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return 12;
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          if (currentValue > maxValue * 0.8) {
                            return -4;
                          }
                          return 12;
                        },
                        color: (context) => {
                          if (!context || !context.dataset || !context.parsed) {
                            return '#1a1a1a';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return '#1a1a1a';
                          }
                          const dataIndex = context.dataIndex;
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return '#1a1a1a';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;

                          if (dataIndex === 2 && currentValue > maxValue * 0.8) {
                            return '#ffffff';
                          }
                          return '#1a1a1a';
                        },
                        font: {
                          size: 11,
                          weight: 'bold',
                          family: 'Verdana'
                        },
                        formatter: (value, context) => {
                          if (typeof value !== 'number' || isNaN(value)) {
                            return '0 (0.0%)';
                          }
                          if (!context || !context.dataset) {
                            return `${value} (0.0%)`;
                          }
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return `${value} (0.0%)`;
                          const total = allValues.reduce((sum, val) => sum + (Number(val) || 0), 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                          return `${value} (${percentage}%)`;
                        },
                        backgroundColor: (context) => {
                          if (!context || !context.dataset || !context.parsed) {
                            return 'rgba(255, 255, 255, 0.95)';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return 'rgba(255, 255, 255, 0.95)';
                          }
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return 'rgba(255, 255, 255, 0.95)';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          const dataIndex = context.dataIndex;

                          if (currentValue > maxValue * 0.8) {
                            if (dataIndex === 2) {
                              return 'rgba(255, 59, 48, 0.7)';
                            } else if (dataIndex === 0) {
                              return 'rgba(52, 199, 89, 0.7)';
                            } else if (dataIndex === 1) {
                              return 'rgba(255, 204, 0, 0.7)';
                            } else {
                              return 'rgba(134, 134, 139, 0.7)';
                            }
                          }
                          return 'rgba(255, 255, 255, 0.95)';
                        },
                        padding: {
                          top: 3,
                          bottom: 3,
                          left: 5,
                          right: 5
                        },
                        borderRadius: 3,
                        borderWidth: 0,
                        display: true,
                        clip: false
                      }
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 10,
                          maxTicksLimit: 15,
                          font: {
                            size: 10,
                            family: 'Verdana'
                          },
                          color: '#737373'
                        },
                        grid: {
                          color: '#ededed',
                          drawBorder: false,
                          lineWidth: 1
                        }
                      },
                      y: {
                        ticks: {
                          font: {
                            size: 11,
                            weight: '500',
                            family: 'Verdana'
                          },
                          color: '#1a1a1a',
                          padding: 8
                        },
                        grid: {
                          display: false
                        }
                      }
                    },
                    layout: {
                      padding: {
                        right: 40,
                        left: 10,
                        top: 10,
                        bottom: 10
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Tabelas de Projetos por Fase */}
          <div className="chart-story-secondary">
            <div className="chart-story-header">
              <h4 className="chart-story-title">Projetos por Fase</h4>
              <p className="chart-story-description">
                Distribuicao de projetos por fase do ciclo de vida
              </p>
            </div>

            <div className="phase-tables-container">
              {/* Tabela 1: Projetos Ativos */}
              {tabelaAtivosData && projetosAtivosPorFase && projetosAtivosPorFase.length > 0 && (
                <div className="phase-table-section" key="ativos">
                  <h5 className="phase-table-title">Projetos Ativos</h5>
                  <div className="phase-table-wrapper">
                    <table className="phase-table">
                      <thead>
                        <tr>
                          <th>Fase</th>
                          <th className="text-right">Quantidade</th>
                          <th className="text-right">% do Grupo</th>
                          <th className="text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projetosAtivosPorFase.map((item, index) => {
                          if (!item || !tabelaAtivosData) return null;
                          const pctGrupo = tabelaAtivosData.totalGrupo > 0 ? ((item.count / tabelaAtivosData.totalGrupo) * 100).toFixed(1) : '0.0';
                          const pctTotal = tabelaAtivosData.totalGeral > 0 ? ((item.count / tabelaAtivosData.totalGeral) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={`ativo-${index}`}>
                              <td>{item.status || 'Sem Status'}</td>
                              <td className="phase-count text-right">{item.count || 0}</td>
                              <td className="text-right phase-percent">{pctGrupo}%</td>
                              <td className="text-right phase-percent">{pctTotal}%</td>
                            </tr>
                          );
                        })}
                        {tabelaAtivosData && (
                          <tr className="phase-total-row">
                            <td><strong>Total</strong></td>
                            <td className="phase-count text-right"><strong>{tabelaAtivosData.totalGrupo || 0}</strong></td>
                            <td className="text-right phase-percent"><strong>100.0%</strong></td>
                            <td className="text-right phase-percent"><strong>{tabelaAtivosData.totalGeral > 0 ? ((tabelaAtivosData.totalGrupo / tabelaAtivosData.totalGeral) * 100).toFixed(1) : '0.0'}%</strong></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela 2: Projetos Pausados */}
              {tabelaPausadosData && projetosPausadosPorFase && projetosPausadosPorFase.length > 0 && (
                <div className="phase-table-section" key="pausados">
                  <h5 className="phase-table-title">Projetos Pausados</h5>
                  <div className="phase-table-wrapper">
                    <table className="phase-table">
                      <thead>
                        <tr>
                          <th>Fase</th>
                          <th className="text-right">Quantidade</th>
                          <th className="text-right">% do Grupo</th>
                          <th className="text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projetosPausadosPorFase.map((item, index) => {
                          if (!item || !tabelaPausadosData) return null;
                          const pctGrupo = tabelaPausadosData.totalGrupo > 0 ? ((item.count / tabelaPausadosData.totalGrupo) * 100).toFixed(1) : '0.0';
                          const pctTotal = tabelaPausadosData.totalGeral > 0 ? ((item.count / tabelaPausadosData.totalGeral) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={`pausado-${index}`}>
                              <td>{item.status || 'Sem Status'}</td>
                              <td className="phase-count text-right">{item.count || 0}</td>
                              <td className="text-right phase-percent">{pctGrupo}%</td>
                              <td className="text-right phase-percent">{pctTotal}%</td>
                            </tr>
                          );
                        })}
                        {tabelaPausadosData && (
                          <tr className="phase-total-row">
                            <td><strong>Total</strong></td>
                            <td className="phase-count text-right"><strong>{tabelaPausadosData.totalGrupo || 0}</strong></td>
                            <td className="text-right phase-percent"><strong>100.0%</strong></td>
                            <td className="text-right phase-percent"><strong>{tabelaPausadosData.totalGeral > 0 ? ((tabelaPausadosData.totalGrupo / tabelaPausadosData.totalGeral) * 100).toFixed(1) : '0.0'}%</strong></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela 3: Projetos Finalizados */}
              {tabelaFinalizadosData && projetosFinalizadosPorFase && projetosFinalizadosPorFase.length > 0 && (
                <div className="phase-table-section" key="finalizados">
                  <h5 className="phase-table-title">Projetos Finalizados</h5>
                  <div className="phase-table-wrapper">
                    <table className="phase-table">
                      <thead>
                        <tr>
                          <th>Fase</th>
                          <th className="text-right">Quantidade</th>
                          <th className="text-right">% do Grupo</th>
                          <th className="text-right">% do Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projetosFinalizadosPorFase.map((item, index) => {
                          if (!item || !tabelaFinalizadosData) return null;
                          const pctGrupo = tabelaFinalizadosData.totalGrupo > 0 ? ((item.count / tabelaFinalizadosData.totalGrupo) * 100).toFixed(1) : '0.0';
                          const pctTotal = tabelaFinalizadosData.totalGeral > 0 ? ((item.count / tabelaFinalizadosData.totalGeral) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={`finalizado-${index}`}>
                              <td>{item.status || 'Sem Status'}</td>
                              <td className="phase-count text-right">{item.count || 0}</td>
                              <td className="text-right phase-percent">{pctGrupo}%</td>
                              <td className="text-right phase-percent">{pctTotal}%</td>
                            </tr>
                          );
                        })}
                        {tabelaFinalizadosData && (
                          <tr className="phase-total-row">
                            <td><strong>Total</strong></td>
                            <td className="phase-count text-right"><strong>{tabelaFinalizadosData.totalGrupo || 0}</strong></td>
                            <td className="text-right phase-percent"><strong>100.0%</strong></td>
                            <td className="text-right phase-percent"><strong>{tabelaFinalizadosData.totalGeral > 0 ? ((tabelaFinalizadosData.totalGrupo / tabelaFinalizadosData.totalGeral) * 100).toFixed(1) : '0.0'}%</strong></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

export default IndicadoresView;

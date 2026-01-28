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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndicador, setEditingIndicador] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    valor: '',
    meta: '',
    unidade: '%',
    categoria: 'projetos',
    periodo: 'mensal',
    tendencia: 'stable',
    responsavel: '',
    formula: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIndicadores();
  }, [selectedPeriod, selectedCategory]);

  const getMockData = () => [
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
  ];

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
        setIndicadores(getMockData());
      }
    } catch (error) {
      console.error('Erro ao buscar indicadores:', error);
      setIndicadores(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const filteredIndicadores = selectedCategory === 'todos' 
    ? indicadores 
    : indicadores.filter(ind => ind.categoria === selectedCategory);

  function getStatusColor(indicador) {
    const percentual = (indicador.valor / indicador.meta) * 100;
    if (percentual >= 100) return '#34A853';
    if (percentual >= 80) return '#FBBC05';
    return '#EA4335';
  }

  function getTendenciaIcon(tendencia) {
    if (tendencia === 'up') return '↑';
    if (tendencia === 'down') return '↓';
    return '→';
  }

  const handleAddIndicador = () => {
    setEditingIndicador(null);
    setFormData({
      nome: '',
      descricao: '',
      valor: '',
      meta: '',
      unidade: '%',
      categoria: 'projetos',
      periodo: selectedPeriod,
      tendencia: 'stable',
      responsavel: '',
      formula: ''
    });
    setShowAddModal(true);
  };

  const handleEditIndicador = (indicador) => {
    setEditingIndicador(indicador);
    setFormData({
      nome: indicador.nome || '',
      descricao: indicador.descricao || '',
      valor: indicador.valor || '',
      meta: indicador.meta || '',
      unidade: indicador.unidade || '%',
      categoria: indicador.categoria || 'projetos',
      periodo: indicador.periodo || selectedPeriod,
      tendencia: indicador.tendencia || 'stable',
      responsavel: indicador.responsavel || '',
      formula: indicador.formula || ''
    });
    setShowAddModal(true);
  };

  const handleSaveIndicador = async () => {
    try {
      setSaving(true);

      if (!formData.nome || formData.valor === '' || !formData.meta || !formData.unidade || !formData.categoria) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      const indicadorPayload = {
        nome: formData.nome,
        descricao: formData.descricao,
        valor: parseFloat(formData.valor) || 0,
        meta: parseFloat(formData.meta) || 0,
        unidade: formData.unidade,
        categoria: formData.categoria,
        periodo: formData.periodo,
        tendencia: formData.tendencia,
        responsavel: formData.responsavel || null,
        formula: formData.formula || null,
        ativo: true
      };

      const url = editingIndicador
        ? `${API_URL}/api/indicadores/${editingIndicador.id}`
        : `${API_URL}/api/indicadores`;

      const method = editingIndicador ? axios.put : axios.post;

      await method(url, indicadorPayload, { withCredentials: true });

      setShowAddModal(false);
      fetchIndicadores();
    } catch (error) {
      console.error('Erro ao salvar indicador:', error);
      alert(error.response?.data?.error || 'Erro ao salvar indicador');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIndicador = async (indicadorId) => {
    if (!confirm('Tem certeza que deseja deletar este indicador?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/indicadores/${indicadorId}`, {
        withCredentials: true,
      });
      fetchIndicadores(); // Recarrega a lista
    } catch (error) {
      console.error('Erro ao deletar indicador:', error);
      alert(error.response?.data?.error || 'Erro ao deletar indicador');
    }
  };

  // Dados para gráfico de barras com gradientes
  const chartData = {
    labels: filteredIndicadores.map(ind => ind.nome.length > 25 ? ind.nome.substring(0, 25) + '...' : ind.nome),
    datasets: [
      {
        label: 'Valor Atual',
        data: filteredIndicadores.map(ind => ind.valor),
        backgroundColor: filteredIndicadores.map(ind => {
          const color = getStatusColor(ind);
          return color === '#34A853' ? 'rgba(52, 168, 83, 0.85)' :
                 color === '#FBBC05' ? 'rgba(251, 188, 5, 0.85)' :
                 'rgba(234, 67, 53, 0.85)';
        }),
        borderColor: filteredIndicadores.map(ind => getStatusColor(ind)),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: 'Meta',
        data: filteredIndicadores.map(ind => ind.meta),
        backgroundColor: 'rgba(255, 221, 0, 0.2)',
        borderColor: '#ffdd00',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'rectRounded',
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 12,
            weight: '600'
          },
          color: '#1a1a1a'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        titleFont: {
          family: "'Inter', sans-serif",
          size: 13,
          weight: '700'
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 12
        },
        padding: 14,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          title: function(context) {
            return filteredIndicadores[context[0].dataIndex]?.nome || '';
          },
          label: function(context) {
            const indicador = filteredIndicadores[context.dataIndex];
            return ` ${context.dataset.label}: ${context.parsed.y} ${indicador?.unidade || ''}`;
          },
        },
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.04)',
          drawBorder: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: '500'
          },
          color: '#737373',
          padding: 10
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: '500'
          },
          color: '#737373',
          maxRotation: 45,
          minRotation: 0
        },
        border: {
          display: false
        }
      }
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart'
    },
    barPercentage: 0.7,
    categoryPercentage: 0.8
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
        <div>
          <h2>Indicadores</h2>
          <p className="indicadores-subtitle">Métricas e indicadores de desempenho</p>
        </div>
        <button className="btn-add-indicador" onClick={handleAddIndicador}>
          + Adicionar Indicador
        </button>
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
        {filteredIndicadores.length === 0 ? (
          <div className="indicadores-empty">
            <p>Nenhum indicador encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          filteredIndicadores.map((indicador) => {
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
                <div className="kpi-actions">
                  <button 
                    className="btn-edit-indicador"
                    onClick={() => handleEditIndicador(indicador)}
                  >
                    Editar
                  </button>
                  <button 
                    className="btn-delete-indicador"
                    onClick={() => handleDeleteIndicador(indicador.id)}
                  >
                    Deletar
                  </button>
                </div>
              </div>
            );
          })
        )}
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

      {/* Modal de adicionar/editar Indicador */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingIndicador ? 'Editar Indicador' : 'Adicionar Indicador'}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => { e.preventDefault(); handleSaveIndicador(); }}>
                <div className="form-group">
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    placeholder="Ex: Taxa de Conclusão de Projetos"
                  />
                </div>

                <div className="form-group">
                  <label>Descrição</label>
                  <textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows="3"
                    placeholder="Descrição detalhada do indicador"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Valor Atual *</label>
                    <input
                      type="number"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      required
                      step="0.01"
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Meta *</label>
                    <input
                      type="number"
                      value={formData.meta}
                      onChange={(e) => setFormData({ ...formData, meta: e.target.value })}
                      required
                      step="0.01"
                      placeholder="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Unidade *</label>
                    <select
                      value={formData.unidade}
                      onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                      required
                    >
                      <option value="%">%</option>
                      <option value="pontos">Pontos</option>
                      <option value="dias">Dias</option>
                      <option value="unidades">Unidades</option>
                      <option value="R$">R$</option>
                      <option value="horas">Horas</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Categoria *</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      required
                    >
                      <option value="projetos">Projetos</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="operacional">Operacional</option>
                      <option value="pessoas">Pessoas</option>
                      <option value="comercial">Comercial</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Período *</label>
                    <select
                      value={formData.periodo}
                      onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
                      required
                    >
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tendência</label>
                    <select
                      value={formData.tendencia}
                      onChange={(e) => setFormData({ ...formData, tendencia: e.target.value })}
                    >
                      <option value="up">↑ Subindo</option>
                      <option value="down">↓ Descendo</option>
                      <option value="stable">→ Estável</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Responsável</label>
                    <input
                      type="text"
                      value={formData.responsavel}
                      onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                      placeholder="Nome do responsável"
                    />
                  </div>

                  <div className="form-group flex-2">
                    <label>Fórmula (Opcional)</label>
                    <input
                      type="text"
                      value={formData.formula}
                      onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
                      placeholder="Ex: (receita - custos) / receita * 100"
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-cancel">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-save" disabled={saving}>
                    {saving ? 'Salvando...' : (editingIndicador ? 'Atualizar' : 'Criar Indicador')}
                  </button>
                </div>
              </form>
            </div>
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

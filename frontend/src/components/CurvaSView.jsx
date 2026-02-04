/**
 * Componente: Vista da Curva S
 * 
 * Replica a visualização do PowerBI mostrando:
 * - Curva S (Receita Bruta Acumulada vs Custo Total Acumulado)
 * - Custos mensais
 * - Margem mensal (55% do contrato)
 * - Horas mensais
 * - Detalhamento por colaborador
 * - KPIs principais
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from '../api';
import '../styles/CurvaSView.css';

// Registra os componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartDataLabels
);

// Função auxiliar para verificar se um status é pausado
const isPausedStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  const statusLower = status.toLowerCase().trim();
  return statusLower.includes('pausa') || statusLower.includes('pausado');
};

// Função auxiliar para verificar se um status é finalizado
const FINALIZED_STATUSES = [
  'finalizado',
  'finalizada',
  'concluído',
  'concluido',
  'cancelado',
  'execução',
  'execucao',
  'termo de encerramento',
  'encerramento'
];

const isFinalizedStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return FINALIZED_STATUSES.some(finalizedStatus => 
    statusLower === finalizedStatus.toLowerCase().trim() ||
    statusLower.includes(finalizedStatus.toLowerCase().trim())
  );
};

function CurvaSView() {
  const { isPrivileged } = useAuth();
  const [data, setData] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedLider, setSelectedLider] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  
  // Toggles para projetos finalizados e pausados
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);

  const chartScrollRefs = useRef([]);
  const scrollTrackRef = useRef(null);
  const isSyncingScroll = useRef(false);
  const hasAutoScrolledRef = useRef(false);

  // Busca dados quando o componente é montado
  useEffect(() => {
    fetchCurvaSData();
  }, []);

  // Busca colaboradores quando um projeto é selecionado
  useEffect(() => {
    if (selectedProject !== 'all') {
      fetchColaboradores(selectedProject);
    } else {
      setColaboradores([]);
    }
  }, [selectedProject]);

  const fetchCurvaSData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_URL}/api/curva-s`, {
        withCredentials: true
      });
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError('Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro:', err);
      setError(err.response?.data?.error || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchColaboradores = async (projectCode) => {
    try {
      const response = await axios.get(`${API_URL}/api/curva-s/colaboradores`, {
        params: { projectCode },
        withCredentials: true
      });
      
      if (response.data.success) {
        setColaboradores(response.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar colaboradores:', err);
    }
  };

  // Obtém lista única de projetos (respeita filtros de Líder, Time e toggles)
  const uniqueProjects = useMemo(() => {
    const projects = new Set();
    let filtered = [...data];

    if (selectedLider !== 'all') {
      filtered = filtered.filter(item => item.lider === selectedLider);
    }

    if (selectedTime !== 'all') {
      filtered = filtered.filter(item => item.nome_time === selectedTime);
    }

    // Aplica toggle de finalizados
    if (!showFinalizedProjects) {
      filtered = filtered.filter(item => !isFinalizedStatus(item.status));
    }

    // Aplica toggle de pausados
    if (!showPausedProjects) {
      filtered = filtered.filter(item => !isPausedStatus(item.status));
    }

    filtered.forEach(item => {
      if (item.project_name && item.project_code) {
        projects.add(JSON.stringify({ code: item.project_code, name: item.project_name }));
      }
    });
    return Array.from(projects).map(p => JSON.parse(p));
  }, [data, selectedLider, selectedTime, showFinalizedProjects, showPausedProjects]);

  // Obtém lista única de líderes
  const uniqueLiders = useMemo(() => {
    const liders = new Set();
    data.forEach(item => {
      if (item.lider) liders.add(item.lider);
    });
    return Array.from(liders).sort();
  }, [data]);

  // Obtém lista única de times (respeita filtro de Líder)
  const uniqueTimes = useMemo(() => {
    const times = new Set();
    let filtered = [...data];

    if (selectedLider !== 'all') {
      filtered = filtered.filter(item => item.lider === selectedLider);
    }

    filtered.forEach(item => {
      if (item.nome_time) times.add(item.nome_time);
    });
    return Array.from(times).sort();
  }, [data, selectedLider]);

  // Calcula distribuição de status para KPI (apenas do projeto selecionado)
  const statusDistribution = useMemo(() => {
    if (selectedProject === 'all') return {};

    const projectRows = data.filter(item => item.project_code === selectedProject);
    if (projectRows.length === 0) return {};

    const statusKey = projectRows[0].status || 'Sem Status';
    return { [statusKey]: 1 };
  }, [data, selectedProject]);

  const statusLabel = useMemo(() => {
    const [firstStatus] = Object.keys(statusDistribution);
    return firstStatus || 'Sem Status';
  }, [statusDistribution]);

  // Filtra dados conforme filtros selecionados
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Filtro por Líder
    if (selectedLider !== 'all') {
      filtered = filtered.filter(item => item.lider === selectedLider);
    }

    // Filtro por Time
    if (selectedTime !== 'all') {
      filtered = filtered.filter(item => item.nome_time === selectedTime);
    }

    // Filtro por Projeto
    if (selectedProject !== 'all') {
      filtered = filtered.filter(item => item.project_code === selectedProject);
    }

  // Filtro por projetos finalizados (toggle)
  if (!showFinalizedProjects) {
    filtered = filtered.filter(item => {
      return !isFinalizedStatus(item.status);
    });
  }

    // Filtro por projetos pausados (toggle)
    if (!showPausedProjects) {
      filtered = filtered.filter(item => {
        return !isPausedStatus(item.status);
      });
    }

    return filtered;
  }, [data, selectedProject, selectedLider, selectedTime, showFinalizedProjects, showPausedProjects]);

  // Função auxiliar para parsear data de forma segura
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    
    // Se já é uma string no formato YYYY-MM ou YYYY-MM-DD
    if (typeof dateValue === 'string') {
      // Se já está no formato YYYY-MM, retorna direto
      if (/^\d{4}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      // Se está no formato YYYY-MM-DD, retorna YYYY-MM
      if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
        return dateValue.substring(0, 7);
      }
      // Tenta parsear como data
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().substring(0, 7);
      }
      return null;
    }
    
    // Se é um objeto Date
    if (dateValue instanceof Date) {
      if (!isNaN(dateValue.getTime())) {
        return dateValue.toISOString().substring(0, 7);
      }
      return null;
    }
    
    // Se é um objeto (pode ser um timestamp do BigQuery)
    if (typeof dateValue === 'object' && dateValue !== null) {
      // Tenta extrair valor de timestamp
      if ('value' in dateValue) {
        const parsed = new Date(dateValue.value);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().substring(0, 7);
        }
      }
      // Tenta converter para string e parsear
      try {
        const parsed = new Date(dateValue.toString());
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().substring(0, 7);
        }
      } catch (e) {
        // Ignora erro
      }
    }
    
    return null;
  };

  // Agrupa dados por mês para os gráficos
  const dataByMonth = useMemo(() => {
    // Parse seguro de valores (pode vir como string do BigQuery)
    const parseValue = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'string') {
        // Remove caracteres não numéricos exceto ponto, vírgula e sinal negativo
        const cleaned = val.replace(/[^\d.,-]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
      }
      // Se for um objeto BigQuery NUMERIC, pode ter propriedade value
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return parseFloat(val.value) || 0;
      }
      return parseFloat(val) || 0;
    };
    
    const grouped = {};
    
    // Primeiro, agrupa valores mensais por mês (soma todos os projetos para cada mês)
    filteredData.forEach(item => {
      if (!item.mes) return;
      
      const monthKey = parseDate(item.mes);
      if (!monthKey) return; // Ignora se não conseguir parsear
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          mes: monthKey,
          custoTotal: 0,
          custoDireto: 0,
          custoIndireto: 0,
          horas: 0,
          receitaMes: 0,
          receitaLiquidaMes: 0,
          margem55Mes: 0,
          margemOperacionalMes: 0
        };
      }

      // Soma valores mensais (agrega todos os projetos para cada mês)
      grouped[monthKey].custoTotal += Math.abs(parseValue(item.custo_total_mes));
      grouped[monthKey].custoDireto += Math.abs(parseValue(item.custo_direto_mes));
      grouped[monthKey].custoIndireto += Math.abs(parseValue(item.custo_indireto_mes));
      grouped[monthKey].horas += Math.abs(parseValue(item.horas_mes));
      grouped[monthKey].receitaMes += Math.abs(parseValue(item.receita_mes));
      grouped[monthKey].receitaLiquidaMes += Math.abs(parseValue(item.receita_liquida_mes));
      grouped[monthKey].margem55Mes += Math.abs(parseValue(item.margem_55_mes));
      grouped[monthKey].margemOperacionalMes += parseValue(item.margem_operacional_mes); // Pode ser negativa
    });

    // Encontra o primeiro e último mês nos dados filtrados
    // Isso garante que o eixo X comece na primeira data do projeto/recorte atual
    const allMonths = new Set();
    filteredData.forEach(item => {
      if (item.mes) {
        const monthKey = parseDate(item.mes);
        if (monthKey) allMonths.add(monthKey);
      }
    });
    
    if (allMonths.size === 0) return [];
    
    // Cria array ordenado de todos os meses disponíveis
    const sortedAllMonths = Array.from(allMonths).sort();
    const firstMonth = sortedAllMonths[0];
    const lastMonth = sortedAllMonths[sortedAllMonths.length - 1];
    
    // Cria array completo de meses desde o primeiro até o último
    // Preenche com zeros os meses que não têm dados após a filtragem
    const completeMonths = [];
    const [firstYear, firstMonthNum] = firstMonth.split('-').map(Number);
    const [lastYear, lastMonthNum] = lastMonth.split('-').map(Number);
    
    let currentYear = firstYear;
    let currentMonth = firstMonthNum;
    
    while (currentYear < lastYear || (currentYear === lastYear && currentMonth <= lastMonthNum)) {
      const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      
      if (grouped[monthKey]) {
        completeMonths.push(grouped[monthKey]);
      } else {
        // Preenche com zeros se não houver dados para este mês
        completeMonths.push({
          mes: monthKey,
          custoTotal: 0,
          custoDireto: 0,
          custoIndireto: 0,
          horas: 0,
          receitaMes: 0,
          receitaLiquidaMes: 0,
          margem55Mes: 0,
          margemOperacionalMes: 0
        });
      }
      
      // Avança para o próximo mês
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    // Calcula os valores acumulados corretamente (somando mês a mês de forma crescente)
    let custoAcumulado = 0;
    let receitaAcumulado = 0;
    let receitaLiquidaAcumulado = 0;
    let margem55Acumulado = 0;

    return completeMonths.map(month => {
      // Acumula os valores mensais
      custoAcumulado += month.custoTotal;
      receitaAcumulado += month.receitaMes;
      receitaLiquidaAcumulado += month.receitaLiquidaMes;
      margem55Acumulado += month.margem55Mes;

      // Margem operacional = margem 55% - custo (pode ser negativa = prejuízo)
      const margemOperacionalAcumulado = margem55Acumulado - custoAcumulado;

      return {
        ...month,
        custoTotalAcumulado: Math.max(0, custoAcumulado),
        receitaBrutaAcumulado: Math.max(0, receitaAcumulado),
        receitaLiquidaAcumulado: Math.max(0, receitaLiquidaAcumulado),
        margem55Acumulado: Math.max(0, margem55Acumulado),
        margemOperacionalAcumulado: margemOperacionalAcumulado, // Pode ser negativa
        valorMargemAcumulado: receitaAcumulado - custoAcumulado // Legado
      };
    });
  }, [filteredData]);

  const syncScroll = (source) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    const left = source.scrollLeft;
    chartScrollRefs.current.forEach((el) => {
      if (el && el !== source) {
        el.scrollLeft = left;
      }
    });
    if (scrollTrackRef.current && scrollTrackRef.current !== source) {
      scrollTrackRef.current.scrollLeft = left;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const chartScrollWidthPercent = useMemo(() => {
    const months = dataByMonth.length > 0 ? dataByMonth.length : 12;
    return Math.max(100, Math.round((months / 12) * 100));
  }, [dataByMonth.length]);

  useEffect(() => {
    if (!dataByMonth.length) return;
    if (hasAutoScrolledRef.current) return;
    const target = chartScrollRefs.current[0] || scrollTrackRef.current;
    if (!target) return;
    target.scrollLeft = target.scrollWidth;
    syncScroll(target);
    hasAutoScrolledRef.current = true;
  }, [dataByMonth.length, syncScroll]);

  // Calcula KPIs
  const kpis = useMemo(() => {
    if (dataByMonth.length === 0) {
      return {
        receitaBruta: 0,
        margem55: 0,
        custoTotal: 0,
        margemOperacional: 0,
        margemPercentual: 0,
        horasTotal: 0
      };
    }

    // Usa valores acumulados do último mês
    const lastMonth = dataByMonth[dataByMonth.length - 1];
    const receitaBruta = lastMonth?.receitaBrutaAcumulado || 0;
    const margem55 = lastMonth?.margem55Acumulado || 0;
    const custoTotal = lastMonth?.custoTotalAcumulado || 0;
    const margemOperacional = lastMonth?.margemOperacionalAcumulado || 0;
    // Margem percentual = (margem 55% - custo) / margem 55%
    const margemPercentual = margem55 > 0
      ? ((margem55 - custoTotal) / margem55) * 100
      : 0;
    const horasTotal = dataByMonth.reduce((sum, month) => sum + (month.horas || 0), 0);

    return {
      receitaBruta,
      margem55,
      custoTotal,
      margemOperacional,
      margemPercentual,
      horasTotal
    };
  }, [dataByMonth]);

  // Prepara dados para o gráfico principal da Curva S (3 curvas)
  const curvaSChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => {
      try {
        const date = new Date(m.mes + '-01');
        if (isNaN(date.getTime())) {
          return m.mes; // Retorna o mês como string se não conseguir parsear
        }
        return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      } catch (e) {
        return m.mes; // Retorna o mês como string em caso de erro
      }
    });

    // Usa valores acumulados calculados
    const custoAcumuladoData = dataByMonth.map(m =>
      Math.abs(m.custoTotalAcumulado || 0)
    );

    const receitaBrutaAcumuladoData = dataByMonth.map(m =>
      Math.abs(m.receitaBrutaAcumulado || 0)
    );

    const margem55AcumuladoData = dataByMonth.map(m =>
      Math.abs(m.margem55Acumulado || 0)
    );

    return {
      labels,
      datasets: [
        {
          label: 'Receita Bruta Acum.',
          data: receitaBrutaAcumuladoData,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4,
          fill: false,
          borderWidth: 3,
        },
        {
          label: 'Margem 55% Acum.',
          data: margem55AcumuladoData,
          borderColor: '#2196F3',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          tension: 0.4,
          fill: false,
          borderWidth: 3,
        },
        {
          label: 'Custo Total Acum.',
          data: custoAcumuladoData,
          borderColor: '#F44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4,
          fill: false,
          borderWidth: 3,
        },
      ],
    };
  }, [dataByMonth]);

  // Prepara dados para gráfico de custo mensal
  const custoMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => {
      try {
        const date = new Date(m.mes + '-01');
        if (isNaN(date.getTime())) {
          return m.mes; // Retorna o mês como string se não conseguir parsear
        }
        return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      } catch (e) {
        return m.mes; // Retorna o mês como string em caso de erro
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Custo horas por mês',
          data: dataByMonth.map(m => Math.abs(m.custoTotal)),
          backgroundColor: '#ffdd00',
          borderColor: '#d3af00',
          borderWidth: 1,
        },
      ],
    };
  }, [dataByMonth]);

  // Prepara dados para gráfico de receita mensal (entradas)
  const receitaMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => {
      try {
        const date = new Date(m.mes + '-01');
        if (isNaN(date.getTime())) {
          return m.mes; // Retorna o mês como string se não conseguir parsear
        }
        return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      } catch (e) {
        return m.mes; // Retorna o mês como string em caso de erro
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Receita por mês',
          data: dataByMonth.map(m => Math.abs(m.receitaMes || 0)),
          backgroundColor: '#4CAF50',
          borderColor: '#388E3C',
          borderWidth: 1,
        },
      ],
    };
  }, [dataByMonth]);

  // Prepara dados para gráfico de horas mensais
  const horasMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => {
      try {
        const date = new Date(m.mes + '-01');
        if (isNaN(date.getTime())) {
          return m.mes; // Retorna o mês como string se não conseguir parsear
        }
        return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
      } catch (e) {
        return m.mes; // Retorna o mês como string em caso de erro
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Horas por mês',
          data: dataByMonth.map(m => Math.round(m.horas || 0)),
          backgroundColor: '#ff9800',
          borderColor: '#f57c00',
          borderWidth: 1,
        },
      ],
    };
  }, [dataByMonth]);

  // Agrupa colaboradores por usuário
  const colaboradoresAgrupados = useMemo(() => {
    const grouped = {};
    
    colaboradores.forEach(item => {
      if (!item.usuario) return;
      
      if (!grouped[item.usuario]) {
        grouped[item.usuario] = {
          usuario: item.usuario,
          custoDireto: 0,
          custoIndireto: 0,
          custoTotal: 0,
          horasTotal: 0
        };
      }
      
      grouped[item.usuario].custoDireto += parseFloat(item.custo_direto_total || 0);
      grouped[item.usuario].custoIndireto += parseFloat(item.custo_indireto_total || 0);
      grouped[item.usuario].custoTotal += parseFloat(item.custo_total || 0);
      grouped[item.usuario].horasTotal += parseFloat(item.horas_total || 0);
    });

    return Object.values(grouped).sort((a, b) => b.custoTotal - a.custoTotal);
  }, [colaboradores]);

  // Formata valor monetário
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatCurrencyCompact = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(value);
  };

  const formatMonthLabel = (monthKey) => {
    try {
      const date = new Date(`${monthKey}-01`);
      if (isNaN(date.getTime())) return monthKey;
      return date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
    } catch (e) {
      return monthKey;
    }
  };

  const shouldShowBarLabel = (context) => {
    const labelCount = context.chart?.data?.labels?.length || 0;
    if (labelCount > 36) return context.dataIndex % 3 === 0;
    if (labelCount > 24) return context.dataIndex % 2 === 0;
    return true;
  };

  const shouldShowLineLabel = (context) => {
    const dataLength = context.dataset?.data?.length || 0;
    return context.dataIndex === dataLength - 1;
  };

  if (loading) {
    return (
      <div className="curva-s-container">
        <div className="loading">Carregando dados da Curva S...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="curva-s-container">
        <div className="error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button onClick={fetchCurvaSData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="curva-s-container">
      <div className="header">
        <h2>Curva S - Evolução de Custos e Receitas</h2>
        <button onClick={fetchCurvaSData} className="refresh-button">
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        {/* Primeira linha: Toggles */}
        <div className="filters-row">
          {/* Toggle para projetos finalizados */}
          <div className="finalized-toggle-wrapper">
            <label className="finalized-toggle">
              <input
                type="checkbox"
                checked={showFinalizedProjects}
                onChange={(e) => setShowFinalizedProjects(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Mostrar Projetos Finalizados</span>
            </label>
          </div>

          {/* Toggle para projetos pausados */}
          <div className="finalized-toggle-wrapper">
            <label className="finalized-toggle">
              <input
                type="checkbox"
                checked={showPausedProjects}
                onChange={(e) => setShowPausedProjects(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Mostrar Projetos Pausados</span>
            </label>
          </div>
        </div>

        {/* Segunda linha: Dropdowns - Ordem: Líder, Time, Projeto */}
        <div className="filters-row">
          {isPrivileged && (
            <div className="filter-group">
              <label htmlFor="lider-filter">Líder:</label>
              <select
                id="lider-filter"
                value={selectedLider}
                onChange={(e) => setSelectedLider(e.target.value)}
                className="filter-select"
              >
                <option value="all">Todos os Líderes</option>
                {uniqueLiders.map((lider, index) => (
                  <option key={index} value={lider}>
                    {lider}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label htmlFor="time-filter">Time:</label>
            <select
              id="time-filter"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos os Times</option>
              {uniqueTimes.map((time, index) => (
                <option key={index} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="project-filter">Projeto:</label>
            <select
              id="project-filter"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos os Projetos</option>
              {uniqueProjects.map((project, index) => (
                <option key={index} value={project.code}>
                  {project.name} ({project.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis-grid">
        <div className="kpi-card">
          <h3>Margem %</h3>
          <p className={`kpi-value ${kpis.margemPercentual < 0 ? 'negative' : ''}`}>{kpis.margemPercentual.toFixed(2)}%</p>
        </div>
        <div className="kpi-card">
          <h3>Total de Horas</h3>
          <p className="kpi-value">{kpis.horasTotal.toFixed(0)}h</p>
        </div>
        <div className="kpi-card">
          <h3>Custo Total</h3>
          <p className="kpi-value">{formatCurrency(kpis.custoTotal)}</p>
        </div>
        <div className="kpi-card">
          <h3>Receita Bruta</h3>
          <p className="kpi-value">{formatCurrency(kpis.receitaBruta)}</p>
        </div>
        <div className="kpi-card">
          <h3>Margem 55%</h3>
          <p className="kpi-value">{formatCurrency(kpis.margem55)}</p>
        </div>
        <div className="kpi-card">
          <h3>Margem Operacional</h3>
          <p className={`kpi-value ${kpis.margemOperacional < 0 ? 'negative' : ''}`}>{formatCurrency(kpis.margemOperacional)}</p>
        </div>
        <div className="kpi-card">
          <h3>Status</h3>
          <p className="kpi-value status-kpi-single">{statusLabel}</p>
        </div>
      </div>

      {/* Barra de rolagem horizontal sincronizada */}
      <div
        className="charts-scrollbar"
        ref={scrollTrackRef}
        onScroll={(e) => syncScroll(e.currentTarget)}
      >
        <div
          className="charts-scrollbar-inner"
          style={{ width: `${chartScrollWidthPercent}%` }}
        />
      </div>

      {/* Gráfico principal - Curva S */}
      {curvaSChartData && (
        <div className="chart-card chart-primary">
          <h3>Curva S - Receita Bruta vs Margem 55% vs Custo</h3>
          <div
            className="chart-wrapper-scroll"
            ref={(el) => (chartScrollRefs.current[0] = el)}
            onScroll={(e) => syncScroll(e.currentTarget)}
          >
            <div
              className="chart-scroll-inner"
              style={{ width: `${chartScrollWidthPercent}%` }}
            >
              <Line 
                data={curvaSChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          const value = typeof context.parsed.y === 'number' 
                            ? context.parsed.y 
                            : parseFloat(context.parsed.y) || 0;
                          return `${context.dataset.label}: ${formatCurrency(value)}`;
                        }
                      }
                    },
                    datalabels: {
                      display: shouldShowLineLabel,
                      formatter: function(value) {
                        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        return formatCurrencyCompact(numValue);
                      }
                    }
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 12
                      }
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          const numValue = typeof value === 'number' 
                            ? value 
                            : parseFloat(value) || 0;
                          return formatCurrency(numValue);
                        }
                      }
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Gráficos secundários em grid */}
      <div className="charts-grid">
        {custoMensalChartData && (
          <div className="chart-card">
            <h3>Custo horas por mês</h3>
            <div
              className="chart-wrapper-scroll"
              ref={(el) => (chartScrollRefs.current[1] = el)}
              onScroll={(e) => syncScroll(e.currentTarget)}
            >
              <div
                className="chart-scroll-inner"
                style={{ width: `${chartScrollWidthPercent}%` }}
              >
                <Bar 
                  data={custoMensalChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                    legend: {
                      display: true,
                      position: 'top'
                    },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const value = typeof context.parsed.y === 'number' 
                              ? context.parsed.y 
                              : parseFloat(context.parsed.y) || 0;
                            return formatCurrency(value);
                          }
                        }
                      },
                    datalabels: {
                      display: shouldShowBarLabel,
                      formatter: function(value) {
                        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        return formatCurrencyCompact(numValue);
                      }
                    }
                    },
                    scales: {
                      x: {
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          autoSkip: true,
                          maxTicksLimit: 12
                        }
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) {
                            const numValue = typeof value === 'number' 
                              ? value 
                              : parseFloat(value) || 0;
                            return formatCurrency(numValue);
                          }
                        }
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {receitaMensalChartData && (
          <div className="chart-card">
            <h3>Receita por mês</h3>
            <div
              className="chart-wrapper-scroll"
              ref={(el) => (chartScrollRefs.current[2] = el)}
              onScroll={(e) => syncScroll(e.currentTarget)}
            >
              <div
                className="chart-scroll-inner"
                style={{ width: `${chartScrollWidthPercent}%` }}
              >
                <Bar 
                  data={receitaMensalChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                    legend: {
                      display: true,
                      position: 'top'
                    },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const value = typeof context.parsed.y === 'number' 
                              ? context.parsed.y 
                              : parseFloat(context.parsed.y) || 0;
                            return formatCurrency(value);
                          }
                        }
                      },
                    datalabels: {
                      display: shouldShowBarLabel,
                      formatter: function(value) {
                        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        return formatCurrencyCompact(numValue);
                      }
                    }
                    },
                    scales: {
                      x: {
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          autoSkip: true,
                          maxTicksLimit: 12
                        }
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) {
                            const numValue = typeof value === 'number' 
                              ? value 
                              : parseFloat(value) || 0;
                            return formatCurrency(numValue);
                          }
                        }
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {horasMensalChartData && (
          <div className="chart-card">
            <h3>Horas por mês</h3>
            <div
              className="chart-wrapper-scroll"
              ref={(el) => (chartScrollRefs.current[3] = el)}
              onScroll={(e) => syncScroll(e.currentTarget)}
            >
              <div
                className="chart-scroll-inner"
                style={{ width: `${chartScrollWidthPercent}%` }}
              >
                <Bar 
                  data={horasMensalChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                    legend: {
                      display: true,
                      position: 'top'
                    },
                      tooltip: {
                        callbacks: {
                          label: function(context) {
                            const value = typeof context.parsed.y === 'number' 
                              ? context.parsed.y 
                              : parseFloat(context.parsed.y) || 0;
                            return `${Math.round(value)}h`;
                          }
                        }
                      },
                    datalabels: {
                      display: shouldShowBarLabel,
                      formatter: function(value) {
                        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        return `${Math.round(numValue)}h`;
                      }
                    }
                    },
                    scales: {
                      x: {
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          autoSkip: true,
                          maxTicksLimit: 12
                        }
                      },
                      y: {
                        beginAtZero: true,
                        ticks: {
                        callback: function(value) {
                          const numValue = typeof value === 'number' 
                            ? value 
                            : parseFloat(value) || 0;
                          return `${Math.round(numValue)}h`;
                        }
                        }
                      },
                    },
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de colaboradores */}
      {selectedProject !== 'all' && colaboradoresAgrupados.length > 0 && (
        <div className="colaboradores-section">
          <h3>Detalhamento por Colaborador</h3>
          <div className="colaboradores-table-wrapper">
            <table className="colaboradores-table">
              <thead>
                <tr>
                  <th>Colaborador RH</th>
                  <th>Custo total</th>
                  <th>Soma de Custo direto</th>
                  <th>Soma de Custo Indireto Outros</th>
                  <th>Soma de Custo Indireto Pessoas</th>
                  <th>Soma de Horas</th>
                </tr>
              </thead>
              <tbody>
                {colaboradoresAgrupados.map((colab, index) => (
                  <tr key={index}>
                    <td>{colab.usuario}</td>
                    <td className="text-right">{formatCurrency(Math.abs(colab.custoTotal))}</td>
                    <td className="text-right">{formatCurrency(Math.abs(colab.custoDireto))}</td>
                    <td className="text-right">{formatCurrency(Math.abs(colab.custoIndireto))}</td>
                    <td className="text-right">-</td>
                    <td className="text-right">{colab.horasTotal.toFixed(0)}h</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(colaboradoresAgrupados.reduce((sum, c) => sum + c.custoTotal, 0)))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(colaboradoresAgrupados.reduce((sum, c) => sum + c.custoDireto, 0)))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(colaboradoresAgrupados.reduce((sum, c) => sum + c.custoIndireto, 0)))}</strong>
                  </td>
                  <td className="text-right">-</td>
                  <td className="text-right">
                    <strong>{colaboradoresAgrupados.reduce((sum, c) => sum + c.horasTotal, 0).toFixed(0)}h</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabela de custos por mês */}
      {dataByMonth.length > 0 && (
        <div className="colaboradores-section">
          <h3>Tabela de Custos e Receitas por Mês</h3>
          <div className="colaboradores-table-wrapper">
            <table className="colaboradores-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Custo Total</th>
                  <th>Receita Bruta</th>
                  <th>Margem 55%</th>
                  <th>Margem Oper.</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {dataByMonth.map((month, index) => {
                  const margemOperacional = (month.margem55Mes || 0) - (month.custoTotal || 0);
                  return (
                    <tr key={index}>
                      <td>{formatMonthLabel(month.mes)}</td>
                      <td className="text-right">{formatCurrency(Math.abs(month.custoTotal || 0))}</td>
                      <td className="text-right">{formatCurrency(Math.abs(month.receitaMes || 0))}</td>
                      <td className="text-right">{formatCurrency(Math.abs(month.margem55Mes || 0))}</td>
                      <td className={`text-right ${margemOperacional < 0 ? 'negative' : ''}`}>
                        {formatCurrency(margemOperacional)}
                      </td>
                      <td className="text-right">{Math.round(month.horas || 0)}h</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(dataByMonth.reduce((sum, m) => sum + (m.custoTotal || 0), 0)))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(dataByMonth.reduce((sum, m) => sum + (m.receitaMes || 0), 0)))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(Math.abs(dataByMonth.reduce((sum, m) => sum + (m.margem55Mes || 0), 0)))}</strong>
                  </td>
                  <td className={`text-right ${kpis.margemOperacional < 0 ? 'negative' : ''}`}>
                    <strong>{formatCurrency(kpis.margemOperacional)}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{Math.round(dataByMonth.reduce((sum, m) => sum + (m.horas || 0), 0))}h</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mensagem se não houver dados */}
      {dataByMonth.length === 0 && (
        <div className="no-data">
          <p>Nenhum dado disponível para exibir.</p>
          <p>Selecione um projeto ou ajuste os filtros.</p>
        </div>
      )}
    </div>
  );
}

export default CurvaSView;

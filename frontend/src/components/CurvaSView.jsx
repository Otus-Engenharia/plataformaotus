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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import SearchableSelect from './SearchableSelect';
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

// Paleta de cores para cargos nos gráficos empilhados
const CARGO_COLORS = [
  '#ffdd00', '#ff9800', '#4CAF50', '#2196F3', '#F44336',
  '#9C27B0', '#00BCD4', '#E91E63', '#3F51B5', '#795548',
  '#607D8B', '#FF5722', '#8BC34A', '#CDDC39', '#FFC107',
];

function CurvaSView() {
  const { isPrivileged, hasFullAccess } = useAuth();
  const [data, setData] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [custosPorCargo, setCustosPorCargo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtros
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedLider, setSelectedLider] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  
  // Toggles para projetos finalizados e pausados
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false);
  const [showPausedProjects, setShowPausedProjects] = useState(true);

  // Drill-down: mês selecionado no gráfico de custos
  const [drillDownMonth, setDrillDownMonth] = useState(null);

  // Auditoria de custos
  const [auditData, setAuditData] = useState(null); // {status, resumo, divergencias}
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  const chartScrollRefs = useRef([]);
  const scrollTrackRef = useRef(null);
  const isSyncingScroll = useRef(false);
  const hasAutoScrolledRef = useRef(false);

  // Mês atual (YYYY-MM) - excluído dos gráficos pois custos ainda estão incompletos (amortização)
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Busca dados quando o componente é montado
  useEffect(() => {
    fetchCurvaSData();
    fetchCustosPorCargo();
    if (isPrivileged) fetchAuditoriaCustos();
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

  const fetchCustosPorCargo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/curva-s/custos-por-cargo`, {
        withCredentials: true
      });
      if (response.data.success) {
        setCustosPorCargo(response.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar custos por cargo:', err);
    }
  };

  const fetchAuditoriaCustos = async () => {
    try {
      setAuditLoading(true);
      const response = await axios.get(`${API_URL}/api/curva-s/reconciliacao-custos`, {
        withCredentials: true
      });
      if (response.data.success) {
        const meses = response.data.data;
        const divergentes = meses.filter(m => Math.abs(m.diferenca) > 1);
        const somaDiferencas = divergentes.reduce((s, m) => s + Math.abs(m.diferenca), 0);
        setAuditData({
          status: divergentes.length === 0 ? 'ok' : 'alerta',
          resumo: {
            totalDivergencias: divergentes.length,
            somaDiferencas,
          },
          meses: divergentes,
        });
      }
    } catch (err) {
      // 403 = não privilegiado, ignora silenciosamente
      if (err.response?.status !== 403) {
        console.error('Erro ao buscar reconciliação de custos:', err);
      }
    } finally {
      setAuditLoading(false);
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
    return Array.from(projects).map(p => JSON.parse(p)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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

      // Exclui mês atual - custos incompletos por amortização
      if (monthKey >= currentMonthKey) break;

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
  }, [filteredData, currentMonthKey]);

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
        horasTotal: 0,
        valorContrato: 0,
        faltaReceber: 0
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

    // Valor total de contrato com aditivos (soma de projetos únicos)
    const uniqueProjectContracts = new Map();
    filteredData.forEach(item => {
      if (item.project_code && !uniqueProjectContracts.has(item.project_code)) {
        uniqueProjectContracts.set(item.project_code, Math.abs(parseFloat(item.receita_bruta_total) || 0));
      }
    });
    const valorContrato = [...uniqueProjectContracts.values()].reduce((sum, v) => sum + v, 0);
    const faltaReceber = valorContrato - receitaBruta;

    // Custo médio mensal (desconsiderando meses com custo < 300)
    const mesesComCusto = dataByMonth.filter(m => m.custoTotal >= 300);
    const custoMedio = mesesComCusto.length > 0
      ? mesesComCusto.reduce((sum, m) => sum + m.custoTotal, 0) / mesesComCusto.length
      : 0;

    return {
      receitaBruta,
      margem55,
      custoTotal,
      margemOperacional,
      margemPercentual,
      horasTotal,
      valorContrato,
      faltaReceber,
      custoMedio,
      mesesConsiderados: mesesComCusto.length
    };
  }, [dataByMonth, filteredData]);

  // Filtra dados de cargo pelos mesmos project_codes do filteredData
  // Exclui mês atual (custos incompletos por amortização)
  const filteredCustosCargo = useMemo(() => {
    const allowedProjectCodes = new Set(
      filteredData.map(item => item.project_code)
    );
    return custosPorCargo.filter(item =>
      allowedProjectCodes.has(item.project_code) &&
      parseDate(item.mes) !== currentMonthKey
    );
  }, [custosPorCargo, filteredData, currentMonthKey]);

  // Agrupa dados de cargo por mês e cargo para datasets dos gráficos
  const cargoChartDatasets = useMemo(() => {
    if (filteredCustosCargo.length === 0) return { cargos: [], byMonth: {} };

    const cargosSet = new Set();
    const byMonth = {};

    filteredCustosCargo.forEach(item => {
      cargosSet.add(item.cargo);
      const monthKey = parseDate(item.mes);
      if (!monthKey) return;

      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      if (!byMonth[monthKey][item.cargo]) byMonth[monthKey][item.cargo] = { custo: 0, horas: 0 };
      byMonth[monthKey][item.cargo].custo += Math.abs(item.custo_total || 0);
      byMonth[monthKey][item.cargo].horas += Math.abs(item.horas || 0);
    });

    const cargos = Array.from(cargosSet).sort();
    return { cargos, byMonth };
  }, [filteredCustosCargo]);

  const formatMonthLabel = (monthKey) => {
    if (!monthKey) return '';
    const parts = monthKey.split('-');
    if (parts.length >= 2) return `${parts[1]}/${parts[0]}`;
    return monthKey;
  };

  // Prepara dados para o gráfico principal da Curva S (3 curvas)
  const curvaSChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => formatMonthLabel(m.mes));

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

  // Prepara dados para gráfico de custo mensal (empilhado por cargo)
  const custoMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => formatMonthLabel(m.mes));

    const { cargos, byMonth } = cargoChartDatasets;

    // Fallback: se não há dados de cargo, usa dataset único
    if (cargos.length === 0) {
      return {
        labels,
        datasets: [{
          label: 'Custo horas por mês',
          data: dataByMonth.map(m => Math.abs(m.custoTotal)),
          backgroundColor: '#ffdd00',
          borderColor: '#d3af00',
          borderWidth: 1,
        }],
      };
    }

    const datasets = cargos.map((cargo, i) => ({
      label: cargo,
      data: dataByMonth.map(m => byMonth[m.mes]?.[cargo]?.custo || 0),
      backgroundColor: CARGO_COLORS[i % CARGO_COLORS.length],
      borderColor: CARGO_COLORS[i % CARGO_COLORS.length],
      borderWidth: 1,
    }));

    return { labels, datasets };
  }, [dataByMonth, cargoChartDatasets]);

  // Prepara dados para gráfico de receita mensal (entradas)
  const receitaMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => formatMonthLabel(m.mes));

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

  // Prepara dados para gráfico de horas mensais (empilhado por cargo)
  const horasMensalChartData = useMemo(() => {
    if (dataByMonth.length === 0) return null;

    const labels = dataByMonth.map(m => formatMonthLabel(m.mes));

    const { cargos, byMonth } = cargoChartDatasets;

    // Fallback: se não há dados de cargo, usa dataset único
    if (cargos.length === 0) {
      return {
        labels,
        datasets: [{
          label: 'Horas por mês',
          data: dataByMonth.map(m => Math.round(m.horas || 0)),
          backgroundColor: '#ff9800',
          borderColor: '#f57c00',
          borderWidth: 1,
        }],
      };
    }

    const datasets = cargos.map((cargo, i) => ({
      label: cargo,
      data: dataByMonth.map(m => Math.round(byMonth[m.mes]?.[cargo]?.horas || 0)),
      backgroundColor: CARGO_COLORS[i % CARGO_COLORS.length],
      borderColor: CARGO_COLORS[i % CARGO_COLORS.length],
      borderWidth: 1,
    }));

    return { labels, datasets };
  }, [dataByMonth, cargoChartDatasets]);

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

  // Agrupa dados de cargo para tabela hierárquica cargo→pessoa
  // Respeita drill-down por mês quando ativo
  const cargoPersonTable = useMemo(() => {
    let source = filteredCustosCargo;
    if (drillDownMonth) {
      source = source.filter(item => parseDate(item.mes) === drillDownMonth);
    }
    if (source.length === 0) return [];

    const grouped = {};
    source.forEach(item => {
      const cargo = item.cargo;
      if (!grouped[cargo]) {
        grouped[cargo] = { cargo, persons: {}, totalHoras: 0, totalCusto: 0, totalCustoDireto: 0, totalCustoIndireto: 0 };
      }
      if (!grouped[cargo].persons[item.usuario]) {
        grouped[cargo].persons[item.usuario] = { usuario: item.usuario, horas: 0, custoTotal: 0, custoDireto: 0, custoIndireto: 0, _horasTotaisPorMes: {} };
      }
      const direto = Math.abs(item.custo_direto || 0);
      const indireto = Math.abs(item.custo_indireto || 0);
      grouped[cargo].persons[item.usuario].horas += Math.abs(item.horas || 0);
      grouped[cargo].persons[item.usuario].custoDireto += direto;
      grouped[cargo].persons[item.usuario].custoIndireto += indireto;
      // Guardar horas totais do mês (mesmo valor p/ todos projetos do mesmo mês)
      const monthKey = parseDate(item.mes);
      if (monthKey) {
        grouped[cargo].persons[item.usuario]._horasTotaisPorMes[monthKey] = Math.abs(item.horas_totais_mes || 0);
      }
      grouped[cargo].totalHoras += Math.abs(item.horas || 0);
      grouped[cargo].totalCustoDireto += direto;
      grouped[cargo].totalCustoIndireto += indireto;
    });

    return Object.values(grouped)
      .map(g => {
        // Custo Total = Custo Direto + Custo Indireto
        // (não usar custo_total do BQ pois ABS(a+b) ≠ ABS(a)+ABS(b) quando há negativos na fonte)
        g.totalCusto = g.totalCustoDireto + g.totalCustoIndireto;
        const persons = Object.values(g.persons).map(p => {
          // Somar horas totais por meses únicos (evita contar mês duplicado por ter vários projetos)
          const horasTotaisMes = Object.values(p._horasTotaisPorMes).reduce((s, v) => s + v, 0);
          const { _horasTotaisPorMes, ...rest } = p;
          return {
            ...rest,
            custoTotal: p.custoDireto + p.custoIndireto,
            horasTotaisMes,
            pctHoras: horasTotaisMes > 0 ? (p.horas / horasTotaisMes * 100) : 0
          };
        }).sort((a, b) => b.custoTotal - a.custoTotal);
        return { ...g, persons };
      })
      .sort((a, b) => b.totalCusto - a.totalCusto);
  }, [filteredCustosCargo, drillDownMonth]);

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

  const shouldShowBarLabel = (context) => {
    const labelCount = context.chart?.data?.labels?.length || 0;
    if (labelCount > 36) return context.dataIndex % 3 === 0;
    if (labelCount > 24) return context.dataIndex % 2 === 0;
    return true;
  };

  // Ref para a tabela de custos por cargo (scroll automático ao drill-down)
  const cargoTableRef = useRef(null);

  // Handler de click no gráfico de custos - faz drill-down no mês clicado
  const handleCustoBarClick = useCallback((event, elements) => {
    if (!elements || elements.length === 0) return;
    const idx = elements[0].index;
    const clickedMonth = dataByMonth[idx]?.mes;
    if (!clickedMonth) return;

    // Toggle: se clicar no mesmo mês, limpa o filtro
    setDrillDownMonth(prev => {
      const newValue = prev === clickedMonth ? null : clickedMonth;
      // Scroll para a tabela após selecionar
      if (newValue) {
        setTimeout(() => {
          cargoTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      return newValue;
    });
  }, [dataByMonth]);

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
        <div className="header-actions">
          {isPrivileged && auditData && (
            <button
              className={`audit-badge ${auditData.status === 'ok' ? 'audit-badge--ok' : 'audit-badge--alerta'}`}
              onClick={() => setShowAuditPanel(!showAuditPanel)}
              title={auditData.status === 'ok'
                ? 'Reconciliação: custos distribuídos batem com fonte financeira'
                : `${auditData.resumo.totalDivergencias} mês(es) com divergência`}
            >
              {auditData.status === 'ok' ? 'Custos OK' : `${auditData.resumo.totalDivergencias} mês(es) divergente(s)`}
            </button>
          )}
          {isPrivileged && auditLoading && (
            <span className="audit-badge audit-badge--loading">Auditando...</span>
          )}
          <button onClick={fetchCurvaSData} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      {/* Painel de Auditoria */}
      {showAuditPanel && auditData && (
        <div className="audit-panel">
          <div className="audit-panel-header">
            <h3>Auditoria de Custos</h3>
            <button className="audit-panel-close" onClick={() => setShowAuditPanel(false)}>X</button>
          </div>
          {auditData.status === 'ok' ? (
            <p className="audit-panel-ok">Custos distribuidos batem com a fonte financeira em todos os meses</p>
          ) : (
            <>
              <div className="audit-panel-summary">
                <span><strong>{auditData.resumo.totalDivergencias}</strong> meses com divergencia</span>
                <span>Custo nao alocado: <strong>{formatCurrency(auditData.resumo.somaDiferencas)}</strong></span>
              </div>
              <div className="audit-panel-table-wrapper">
                <table className="audit-panel-table">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Total Fonte</th>
                      <th>Total Distribuido</th>
                      <th>Diferenca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.meses.map((d, i) => {
                      const mesStr = d.mes ? (() => { const [y, m] = String(d.mes).split('-'); return `${m}/${y}`; })() : '-';
                      return (
                        <tr key={i}>
                          <td>{mesStr}</td>
                          <td className="text-right">{formatCurrency(d.total_fonte)}</td>
                          <td className="text-right">{formatCurrency(d.total_dist)}</td>
                          <td className="text-right audit-diferenca">{formatCurrency(d.diferenca)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

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
          {hasFullAccess && (
            <div className="filter-group">
              <label htmlFor="lider-filter">Líder:</label>
              <SearchableSelect
                id="lider-filter"
                value={selectedLider}
                onChange={(e) => setSelectedLider(e.target.value)}
                placeholder="Todos os Líderes"
                options={[
                  { value: 'all', label: 'Todos os Líderes' },
                  ...uniqueLiders.map(lider => ({ value: lider, label: lider }))
                ]}
              />
            </div>
          )}

          <div className="filter-group">
            <label htmlFor="time-filter">Time:</label>
            <SearchableSelect
              id="time-filter"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              placeholder="Todos os Times"
              options={[
                { value: 'all', label: 'Todos os Times' },
                ...uniqueTimes.map(time => ({ value: time, label: time }))
              ]}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="project-filter">Projeto:</label>
            <SearchableSelect
              id="project-filter"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              placeholder="Todos os Projetos"
              options={[
                { value: 'all', label: 'Todos os Projetos' },
                ...uniqueProjects.map(project => ({ value: project.code, label: `${project.name} (${project.code})` }))
              ]}
            />
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
          <h3>Custo Médio/Mês</h3>
          <p className="kpi-value">{formatCurrency(kpis.custoMedio)}</p>
          <span className="kpi-context">{kpis.mesesConsiderados} meses</span>
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
          <h3>Valor de Contrato</h3>
          <p className="kpi-value">{formatCurrency(kpis.valorContrato)}</p>
        </div>
        <div className="kpi-card">
          <h3>Falta a Receber</h3>
          <p className={`kpi-value ${kpis.faltaReceber < 0 ? 'negative' : ''}`}>{formatCurrency(kpis.faltaReceber)}</p>
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
                      position: 'right',
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
                      display: false
                    }
                  },
                  scales: {
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: false
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

      {/* Gráficos secundários em grid - Ordem: Receita, Custos, Horas */}
      <div className="charts-grid">
        {receitaMensalChartData && (
          <div className="chart-card">
            <h3>Receita por mês</h3>
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
                  data={receitaMensalChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'right'
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
                          autoSkip: false
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

        {custoMensalChartData && (
          <div className="chart-card">
            <h3>Custo horas por mês</h3>
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
                  data={custoMensalChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: handleCustoBarClick,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'right'
                      },
                      tooltip: {
                        mode: 'index',
                        callbacks: {
                          label: function(context) {
                            const value = typeof context.parsed.y === 'number'
                              ? context.parsed.y
                              : parseFloat(context.parsed.y) || 0;
                            return `${context.dataset.label}: ${formatCurrency(value)}`;
                          },
                          footer: function() {
                            return 'Clique para detalhar na tabela';
                          }
                        }
                      },
                      datalabels: {
                        display: (context) => {
                          if (cargoChartDatasets.cargos.length > 0) {
                            return context.datasetIndex === context.chart.data.datasets.length - 1
                              && shouldShowBarLabel(context);
                          }
                          return shouldShowBarLabel(context);
                        },
                        formatter: function(value, context) {
                          if (cargoChartDatasets.cargos.length > 0) {
                            const total = context.chart.data.datasets.reduce(
                              (sum, ds) => sum + (ds.data[context.dataIndex] || 0), 0
                            );
                            return formatCurrencyCompact(total);
                          }
                          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                          return formatCurrencyCompact(numValue);
                        }
                      }
                    },
                    scales: {
                      x: {
                        stacked: true,
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          autoSkip: false
                        }
                      },
                      y: {
                        stacked: true,
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
                    onClick: handleCustoBarClick,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'right'
                      },
                      tooltip: {
                        mode: 'index',
                        callbacks: {
                          label: function(context) {
                            const value = typeof context.parsed.y === 'number'
                              ? context.parsed.y
                              : parseFloat(context.parsed.y) || 0;
                            return `${context.dataset.label}: ${Math.round(value)}h`;
                          },
                          footer: function() {
                            return 'Clique para detalhar na tabela';
                          }
                        }
                      },
                      datalabels: {
                        display: (context) => {
                          if (cargoChartDatasets.cargos.length > 0) {
                            return context.datasetIndex === context.chart.data.datasets.length - 1
                              && shouldShowBarLabel(context);
                          }
                          return shouldShowBarLabel(context);
                        },
                        formatter: function(value, context) {
                          if (cargoChartDatasets.cargos.length > 0) {
                            const total = context.chart.data.datasets.reduce(
                              (sum, ds) => sum + (ds.data[context.dataIndex] || 0), 0
                            );
                            return `${Math.round(total)}h`;
                          }
                          const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                          return `${Math.round(numValue)}h`;
                        }
                      }
                    },
                    scales: {
                      x: {
                        stacked: true,
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45,
                          autoSkip: false
                        }
                      },
                      y: {
                        stacked: true,
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

      {/* Tabela de custos por cargo e pessoa */}
      {cargoPersonTable.length > 0 && (
        <div className="colaboradores-section" ref={cargoTableRef}>
          <div className="section-header-with-filter">
            <h3>Custos por Cargo e Pessoa</h3>
            {drillDownMonth && (
              <div className="drill-down-badge">
                <span>Filtrando: {formatMonthLabel(drillDownMonth)}</span>
                <button
                  className="drill-down-clear"
                  onClick={() => setDrillDownMonth(null)}
                  title="Limpar filtro"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="colaboradores-table-wrapper">
            <table className="colaboradores-table">
              <thead>
                <tr>
                  <th>Pessoa</th>
                  <th>Custo Direto</th>
                  <th>Custo Indireto</th>
                  <th>Custo Total</th>
                  <th>Horas</th>
                  <th>% Horas</th>
                </tr>
              </thead>
              <tbody>
                {cargoPersonTable.map((cargoGroup, cgIdx) => {
                  // Média ponderada do % horas do cargo (soma horas / soma horas totais)
                  const cargoHorasTotais = cargoGroup.persons.reduce((s, p) => s + p.horasTotaisMes, 0);
                  const cargoPct = cargoHorasTotais > 0 ? (cargoGroup.totalHoras / cargoHorasTotais * 100).toFixed(1) + '%' : '—';
                  return (
                    <React.Fragment key={cgIdx}>
                      <tr className="cargo-header-row">
                        <td><strong>{cargoGroup.cargo}</strong></td>
                        <td className="text-right">
                          <strong>{formatCurrency(cargoGroup.totalCustoDireto)}</strong>
                        </td>
                        <td className="text-right">
                          <strong>{formatCurrency(cargoGroup.totalCustoIndireto)}</strong>
                        </td>
                        <td className="text-right">
                          <strong>{formatCurrency(cargoGroup.totalCusto)}</strong>
                        </td>
                        <td className="text-right">
                          <strong>{Math.round(cargoGroup.totalHoras)}h</strong>
                        </td>
                        <td className="text-right">
                          <strong>{cargoPct}</strong>
                        </td>
                      </tr>
                      {cargoGroup.persons.map((person, pIdx) => (
                        <tr key={pIdx} className="cargo-person-row">
                          <td style={{ paddingLeft: '2rem' }}>{person.usuario}</td>
                          <td className="text-right">{formatCurrency(person.custoDireto)}</td>
                          <td className="text-right">{formatCurrency(person.custoIndireto)}</td>
                          <td className="text-right">{formatCurrency(person.custoTotal)}</td>
                          <td className="text-right">{Math.round(person.horas)}h</td>
                          <td className="text-right">{person.pctHoras > 0 ? person.pctHoras.toFixed(1) + '%' : '—'}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                <tr className="total-row">
                  <td><strong>Total Geral</strong></td>
                  <td className="text-right">
                    <strong>{formatCurrency(cargoPersonTable.reduce((s, g) => s + g.totalCustoDireto, 0))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(cargoPersonTable.reduce((s, g) => s + g.totalCustoIndireto, 0))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{formatCurrency(cargoPersonTable.reduce((s, g) => s + g.totalCusto, 0))}</strong>
                  </td>
                  <td className="text-right">
                    <strong>{Math.round(cargoPersonTable.reduce((s, g) => s + g.totalHoras, 0))}h</strong>
                  </td>
                  <td className="text-right">
                    <strong>—</strong>
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

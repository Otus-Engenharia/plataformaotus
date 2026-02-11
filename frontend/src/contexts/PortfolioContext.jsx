/**
 * Contexto do Portfolio
 *
 * Gerencia dados compartilhados entre PortfolioView e IndicadoresView
 * - Dados do portfolio da API
 * - Filtros compartilhados (Time, Lider)
 * - KPIs calculados
 * - Dados para graficos e tabelas
 */

import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import {
  calculateMonthDifference,
  getDifferenceStatus,
  isFinalizedStatus,
  isPausedStatus
} from '../utils/portfolio-utils';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  // Estado dos dados
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros compartilhados (Time e Lider)
  const [timeFilter, setTimeFilter] = useState([]);
  const [liderFilter, setLiderFilter] = useState([]);

  // Estado de edicao inline
  const [editingCell, setEditingCell] = useState(null); // { projectCode, field }
  const [editOptions, setEditOptions] = useState(null); // { teams, companies, leaders }

  // Busca dados do portfolio
  const fetchPortfolioData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/api/portfolio?leaderFilter=true`, { withCredentials: true });

      if (response.data && response.data.success) {
        const dataArray = Array.isArray(response.data.data) ? response.data.data : [];
        console.log(`Portfolio: ${dataArray.length} registros carregados`);
        setData(dataArray);
      } else {
        setError('Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega dados na montagem
  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Busca opcoes para dropdowns de edicao
  const fetchEditOptions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/portfolio/edit-options`, { withCredentials: true });
      if (response.data?.success) {
        setEditOptions(response.data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar opcoes de edicao:', err);
    }
  }, []);

  // Atualiza campo do portfolio com optimistic update
  const updatePortfolioField = useCallback(async (projectCode, field, newValue, oldValue, displayValue) => {
    // Mapear campo para ID interno
    const idFieldMap = {
      'client': '_company_id',
      'nome_time': '_team_id',
      'lider': '_project_manager_id'
    };

    // Optimistic update - usa displayValue para campos com FK
    const fieldToUpdate = ['client', 'nome_time', 'lider'].includes(field)
      ? { [field]: displayValue, [idFieldMap[field]]: newValue }
      : { [field]: newValue };

    setData(prev => prev.map(row =>
      row.project_code_norm === projectCode ? { ...row, ...fieldToUpdate } : row
    ));
    setEditingCell(null);

    try {
      const response = await axios.put(
        `${API_URL}/api/portfolio/${projectCode}`,
        { field, value: newValue, oldValue },
        { withCredentials: true }
      );
      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao atualizar');
      }
    } catch (err) {
      // Rollback em caso de erro
      const rollbackUpdate = ['client', 'nome_time', 'lider'].includes(field)
        ? { [field]: oldValue, [idFieldMap[field]]: oldValue }
        : { [field]: oldValue };

      setData(prev => prev.map(row =>
        row.project_code_norm === projectCode ? { ...row, ...rollbackUpdate } : row
      ));
      console.error('Erro ao atualizar portfolio:', err);
      alert('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    }
  }, []);

  // Valores unicos para filtros
  const uniqueTimes = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const times = new Set();
    data.forEach(row => {
      if (row.nome_time) times.add(row.nome_time);
    });
    return Array.from(times).sort();
  }, [data]);

  const uniqueLiders = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const liders = new Set();
    data.forEach(row => {
      if (row.lider) liders.add(row.lider);
    });
    return Array.from(liders).sort();
  }, [data]);

  // Dados filtrados por Time e Lider (para KPIs gerais)
  const dataForKPIs = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    let filtered = data;

    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    return filtered;
  }, [data, timeFilter, liderFilter]);

  // Dados filtrados para projetos ATIVOS (usado para "Projetos em Atraso")
  const dataForActiveProjects = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    let filtered = data;

    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    // Apenas projetos ativos (nao finalizados)
    filtered = filtered.filter(row => {
      if (!row || typeof row !== 'object') return false;
      return !isFinalizedStatus(row.status);
    });

    return filtered;
  }, [data, timeFilter, liderFilter]);

  // Calcula KPIs
  const kpis = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) {
      return {
        totalProjetos: 0,
        projetosAtivos: 0,
        projetosFinalizados: 0,
        projetosPausados: 0,
        valorTotal: 0,
        projetosEmAtraso: 0
      };
    }

    let projetosAtivos = 0;
    let projetosFinalizados = 0;
    let projetosPausados = 0;
    let valorTotal = 0;
    let projetosEmAtraso = 0;

    dataForKPIs.forEach(row => {
      if (isPausedStatus(row.status)) {
        projetosPausados++;
      }

      if (isFinalizedStatus(row.status)) {
        projetosFinalizados++;
      } else {
        projetosAtivos++;
      }

      if (row.valor_total_contrato_mais_aditivos) {
        const valor = parseFloat(row.valor_total_contrato_mais_aditivos) || 0;
        valorTotal += valor;
      }
    });

    // Calcula projetos em atraso usando apenas projetos ativos
    dataForActiveProjects.forEach(row => {
      const terminoContrato = row.data_termino_contrato_com_pausas || row.data_termino_contrato;
      if (row.data_termino_cronograma && terminoContrato) {
        const diff = calculateMonthDifference(row.data_termino_cronograma, terminoContrato);
        if (diff !== null && diff >= 3) {
          projetosEmAtraso++;
        }
      }
    });

    return {
      totalProjetos: dataForKPIs.length,
      projetosAtivos,
      projetosFinalizados,
      projetosPausados,
      valorTotal,
      projetosEmAtraso
    };
  }, [dataForKPIs, dataForActiveProjects]);

  // Dados para grafico de projetos por status de diferenca de prazo
  const differenceChartData = useMemo(() => {
    if (!dataForActiveProjects || !Array.isArray(dataForActiveProjects) || dataForActiveProjects.length === 0) {
      return null;
    }

    const dataWithDifference = dataForActiveProjects.map(row => {
      if (row.diferenca_cronograma_contrato_status) {
        return row;
      }
      const difference = calculateMonthDifference(row.data_termino_cronograma, row.data_termino_contrato_com_pausas || row.data_termino_contrato);
      const differenceStatus = getDifferenceStatus(difference);
      return {
        ...row,
        diferenca_cronograma_contrato: difference,
        diferenca_cronograma_contrato_status: differenceStatus
      };
    });

    const differenceCount = {
      green: 0,
      yellow: 0,
      red: 0,
      unknown: 0
    };

    dataWithDifference.forEach(row => {
      const status = row.diferenca_cronograma_contrato_status || 'unknown';
      if (differenceCount.hasOwnProperty(status)) {
        differenceCount[status]++;
      } else {
        differenceCount.unknown++;
      }
    });

    const total = differenceCount.green + differenceCount.yellow + differenceCount.red + differenceCount.unknown;

    const labels = ['No Prazo', '1-2 Meses', '3+ Meses', 'Sem Data'];
    const values = [
      differenceCount.green,
      differenceCount.yellow,
      differenceCount.red,
      differenceCount.unknown
    ];
    const percentages = values.map(val => total > 0 ? ((val / total) * 100).toFixed(1) : '0.0');
    const colors = ['#34c759', '#ffcc00', '#ff3b30', '#86868b'];

    return {
      labels,
      datasets: [
        {
          label: 'Projetos por Diferenca de Prazo',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 0,
          borderRadius: 4,
          barThickness: 24
        }
      ],
      percentages,
      total
    };
  }, [dataForActiveProjects]);

  // Dados para tabelas de projetos por fase
  const projetosAtivosPorFase = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return [];

    const statusCount = {};
    dataForKPIs.forEach(row => {
      if (!isFinalizedStatus(row.status) && !isPausedStatus(row.status)) {
        const status = row.status || 'Sem Status';
        statusCount[status] = (statusCount[status] || 0) + 1;
      }
    });

    return Object.entries(statusCount)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [dataForKPIs]);

  const projetosPausadosPorFase = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return [];

    const statusCount = {};
    dataForKPIs.forEach(row => {
      if (isPausedStatus(row.status)) {
        const status = row.status || 'Sem Status';
        statusCount[status] = (statusCount[status] || 0) + 1;
      }
    });

    return Object.entries(statusCount)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [dataForKPIs]);

  const projetosFinalizadosPorFase = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return [];

    const statusCount = {};
    dataForKPIs.forEach(row => {
      if (isFinalizedStatus(row.status)) {
        const status = row.status || 'Sem Status';
        statusCount[status] = (statusCount[status] || 0) + 1;
      }
    });

    return Object.entries(statusCount)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [dataForKPIs]);

  // Calcula total geral de projetos
  const totalGeralProjetos = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return 0;
    return dataForKPIs.length;
  }, [dataForKPIs]);

  // Calcula totais para cada grupo de tabelas
  const tabelaAtivosData = useMemo(() => {
    if (!projetosAtivosPorFase || projetosAtivosPorFase.length === 0) return null;
    const totalGrupo = projetosAtivosPorFase.reduce((sum, item) => sum + (item.count || 0), 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosAtivosPorFase, totalGeralProjetos]);

  const tabelaPausadosData = useMemo(() => {
    if (!projetosPausadosPorFase || projetosPausadosPorFase.length === 0) return null;
    const totalGrupo = projetosPausadosPorFase.reduce((sum, item) => sum + (item.count || 0), 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosPausadosPorFase, totalGeralProjetos]);

  const tabelaFinalizadosData = useMemo(() => {
    if (!projetosFinalizadosPorFase || projetosFinalizadosPorFase.length === 0) return null;
    const totalGrupo = projetosFinalizadosPorFase.reduce((sum, item) => sum + (item.count || 0), 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosFinalizadosPorFase, totalGeralProjetos]);

  const value = {
    // Dados brutos
    data,
    setData,
    loading,
    error,
    fetchPortfolioData,

    // Filtros compartilhados
    timeFilter,
    setTimeFilter,
    liderFilter,
    setLiderFilter,

    // Valores unicos para dropdowns
    uniqueTimes,
    uniqueLiders,

    // Edicao inline
    editingCell,
    setEditingCell,
    editOptions,
    fetchEditOptions,
    updatePortfolioField,

    // Dados filtrados (portfolio filtrado por time + lider)
    dataForKPIs,

    // KPIs
    kpis,

    // Dados do grafico
    differenceChartData,

    // Dados das tabelas por fase
    projetosAtivosPorFase,
    projetosPausadosPorFase,
    projetosFinalizadosPorFase,
    tabelaAtivosData,
    tabelaPausadosData,
    tabelaFinalizadosData,
    totalGeralProjetos
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio deve ser usado dentro de PortfolioProvider');
  }
  return context;
}

export default PortfolioContext;

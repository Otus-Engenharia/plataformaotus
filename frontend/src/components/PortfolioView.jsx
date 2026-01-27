/**
 * Componente: Vista do Portfólio
 * 
 * Tabela profissional com 3 vistas diferentes e filtros
 * Adapta-se automaticamente aos campos retornados do BigQuery
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../api';
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
import '../styles/PortfolioView.css';

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

// Definição das 3 vistas com suas colunas
const VIEWS = {
  info: {
    id: 'info',
    name: 'Informações do Projeto',
    columns: [
      'project_order',
      'project_code_norm',
      'project_name',
      'comercial_name',
      'status',
      'client',
      'nome_time',
      'lider'
    ]
  },
  valores: {
    id: 'valores',
    name: 'Valores do Contrato',
    columns: [
      'project_order',
      'project_code_norm',
      'project_name',
      'status',
      'nome_time',
      'lider',
      'valor_contrato_total',
      'valor_aditivo_total',
      'qtd_aditivos_distintos',
      'valor_total_contrato_mais_aditivos'
    ]
  },
  prazos: {
    id: 'prazos',
    name: 'Prazo de Contrato',
    columns: [
      // 1. Informações básicas do projeto
      'project_order',
      'project_code_norm',
      'project_name',
      'status',
      'nome_time',
      'lider',
      // 2. Cronograma
      'data_inicio_cronograma',
      'data_termino_cronograma',
      // 3. Contrato (datas importantes)
      'data_termino_contrato',
      'data_termino_contrato_com_pausas',
      // 4. Diferença calculada
      'diferenca_cronograma_contrato',
      // 5. Durações do contrato
      'duracao_contrato_total_meses',
      'duracao_aditivo_total_meses',
      'duracao_total_meses',
      // 6. Informações de pausas
      'qtd_pausas',
      'total_dias_pausa'
    ]
  }
};

// Colunas que são "Informações de Contrato" - para destacar visualmente e poder colapsar
// NOTA: data_termino_contrato e data_termino_contrato_com_pausas NÃO estão aqui porque devem aparecer sempre visíveis
const CONTRACT_INFO_COLUMNS = [
  'duracao_contrato_total_meses',
  'duracao_aditivo_total_meses',
  'duracao_total_meses',
  'qtd_pausas',
  'total_dias_pausa'
];

// Mapeamento de nomes em português (otimizados para UX - design profissional)
const COLUMN_NAMES_PT = {
  'project_order': 'Ordem',
  'project_code': 'Código',
  'project_code_norm': 'Código',
  'project_name': 'Nome do<br/>Projeto',
  'comercial_name': 'Nome<br/>Comercial',
  'status': 'Status',
  'client': 'Cliente',
  'nome_time': 'Time',
  'lider': 'Líder',
  'valor_contrato_total': 'Contrato<br/>(R$)',
  'valor_aditivo_total': 'Aditivos<br/>(R$)',
  'valor_total_contrato_mais_aditivos': 'Total<br/>(R$)',
  'qtd_aditivos_distintos': 'Qtd<br/>Aditivos',
  'duracao_contrato_total_meses': 'Dur. Contrato<br/>(meses)',
  'duracao_aditivo_total_meses': 'Dur. Aditivo<br/>(meses)',
  'duracao_total_meses': 'Dur. Total<br/>(meses)',
  'data_inicio_cronograma': 'Início<br/>Cronograma',
  'data_termino_cronograma': 'Término<br/>Cronograma',
  'qtd_pausas': 'Qtd<br/>Pausas',
  'total_dias_pausa': 'Total<br/>Dias Pausa',
  'data_inicio_primeira_pausa': 'Início<br/>1ª Pausa',
  'data_fim_ultima_pausa': 'Fim<br/>Última Pausa',
  'data_termino_contrato': 'Término<br/>Contrato',
  'data_termino_contrato_com_pausas': 'Término Contrato<br/>c/ Pausas',
  'diferenca_cronograma_contrato': 'Diferença<br/>(meses)'
};

// Colunas que são valores monetários (sempre formatar como moeda)
const MONETARY_COLUMNS = [
  'valor_contrato_total',
  'valor_aditivo_total',
  'valor_total_contrato_mais_aditivos'
];

// Funções auxiliares
const getColumnLabel = (key) => {
  // Primeiro tenta o mapeamento em português
  if (COLUMN_NAMES_PT[key.toLowerCase()]) {
    return COLUMN_NAMES_PT[key.toLowerCase()];
  }
  // Se não encontrar, formata automaticamente
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Colunas que são sempre datas (por nome)
const DATE_COLUMNS = [
  'data_inicio_cronograma',
  'data_termino_cronograma',
  'data_inicio_primeira_pausa',
  'data_fim_ultima_pausa',
  'data_termino_contrato',
  'data_termino_contrato_com_pausas'
];

const detectColumnType = (value, columnKey) => {
  // Verifica se é uma coluna de data por nome PRIMEIRO (antes de verificar o valor)
  // Isso garante que colunas de data sempre sejam tratadas como data, mesmo se o valor for null
  if (DATE_COLUMNS.includes(columnKey?.toLowerCase())) {
    return 'date';
  }
  
  if (value === null || value === undefined) return 'text';
  
  // project_order é sempre numérica
  if (columnKey?.toLowerCase() === 'project_order') {
    return 'number';
  }
  
  // project_code_norm é sempre texto (formato texto mesmo)
  if (columnKey?.toLowerCase() === 'project_code_norm') {
    return 'text';
  }
  
  // Verifica se é uma coluna monetária
  if (MONETARY_COLUMNS.includes(columnKey?.toLowerCase())) {
    return 'currency';
  }
  
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  
  // Verifica se é um objeto Date
  if (value instanceof Date) return 'date';
  
  // Verifica se é um objeto que pode ser uma data (BigQuery pode retornar objetos)
  if (typeof value === 'object' && value !== null) {
    // Se tem propriedades de data (value, seconds, etc.)
    if ('value' in value || 'seconds' in value || 'toISOString' in value) {
      return 'date';
    }
    // Se é um objeto com formato de timestamp
    if (typeof value.toString === 'function' && value.toString().includes('Date')) {
      return 'date';
    }
  }
  
  // Verifica se é string de data
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
  
  // Se o valor é uma string que representa um número, trata como número
  // Mas não para project_code_norm que já foi tratado acima
  if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
    // Mas não é uma data
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return 'number';
    }
  }
  
  return 'text';
};

const formatValue = (value, type) => {
  if (value === null || value === undefined) return '-';
  
  // Formatação monetária
  if (type === 'currency') {
    return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  if (type === 'number') {
    return parseFloat(value).toLocaleString('pt-BR');
  }
  
  if (type === 'date') {
    try {
      // Se o valor é vazio, null ou undefined, retorna hífen
      if (value === null || value === undefined || value === '' || 
          (typeof value === 'string' && value.trim() === '')) {
        return '-';
      }
      
      let date;
      
      // Se já é um objeto Date
      if (value instanceof Date) {
        date = value;
      }
      // Se é um objeto (pode ser do BigQuery)
      else if (typeof value === 'object' && value !== null) {
        // BigQuery pode retornar datas como { value: "2024-01-15" } ou { value: "2024-01-15T00:00:00" }
        if ('value' in value) {
          const dateValue = value.value;
          if (dateValue !== null && dateValue !== undefined && dateValue !== '') {
            // Se value é uma string, tenta converter
            if (typeof dateValue === 'string') {
              date = new Date(dateValue);
            } else if (dateValue instanceof Date) {
              date = dateValue;
            } else {
              date = new Date(dateValue);
            }
          } else {
            return '-';
          }
        } 
        // BigQuery DATE type pode vir como objeto com propriedades específicas
        else if ('year' in value && 'month' in value && 'day' in value) {
          // Formato: { year: 2024, month: 1, day: 15 }
          const year = value.year || 0;
          const month = (value.month || 1) - 1; // JavaScript months são 0-indexed
          const day = value.day || 1;
          date = new Date(year, month, day);
        }
        // Timestamp em segundos
        else if ('seconds' in value) {
          date = new Date(value.seconds * 1000);
        } 
        // Timestamp em milissegundos
        else if ('timestamp' in value) {
          date = new Date(value.timestamp);
        }
        // Se tem método toISOString
        else if ('toISOString' in value && typeof value.toISOString === 'function') {
          date = new Date(value.toISOString());
        } 
        // BigQuery pode retornar como objeto com propriedade 'date' ou 'dateValue'
        else if ('date' in value) {
          date = new Date(value.date);
        }
        else if ('dateValue' in value) {
          date = new Date(value.dateValue);
        }
        // Tenta converter a string do objeto se não for [object Object]
        else if (value.toString && value.toString() !== '[object Object]') {
          const str = value.toString();
          if (str && str.trim() !== '' && str !== 'null' && str !== 'undefined') {
            date = new Date(str);
          } else {
            return '-';
          }
        } 
        // Última tentativa: converte o objeto inteiro
        else {
          date = new Date(value);
        }
      }
      // Se é string
      else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
          return '-';
        }
        // Tenta diferentes formatos de data
        // Formato ISO: 2024-01-15 ou 2024-01-15T00:00:00
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          date = new Date(trimmed);
        }
        // Formato brasileiro: 15/01/2024
        else if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
          const [day, month, year] = trimmed.split('/');
          date = new Date(`${year}-${month}-${day}`);
        }
        // Outros formatos
        else {
          date = new Date(trimmed);
        }
      }
      // Se é número (timestamp)
      else if (typeof value === 'number') {
        // Se é um timestamp em segundos (menor que 1e12), converte para milissegundos
        if (value < 1e12) {
          date = new Date(value * 1000);
        } else {
          date = new Date(value);
        }
      }
      // Se não conseguiu determinar o tipo
      else {
        date = new Date(value);
      }
      
      // Verifica se a data é válida
      if (!date || isNaN(date.getTime())) {
        // Debug: log do valor original para investigação
        console.warn('Data inválida detectada:', { value, type: typeof value, columnKey: 'data_inicio_cronograma' });
        return '-';
      }
      
      // Formata a data em português brasileiro
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      // Debug: log do erro para investigação
      console.error('Erro ao formatar data:', { value, error, type: typeof value });
      // Se der erro, retorna hífen
      return '-';
    }
  }
  
  if (type === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  
  if (type === 'difference') {
    if (value === null || value === undefined) {
      return '-';
    }
    // Retorna o valor numérico formatado
    return typeof value === 'number' ? value.toString() : String(value);
  }
  
  // Se o tipo não foi detectado corretamente mas o valor é um objeto, tenta formatar como data
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Última tentativa: pode ser uma data não detectada
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      }
    } catch {
      // Ignora e continua
    }
    // Se não é data, retorna hífen para objetos
    return '-';
  }
  
  return String(value);
};

// Função auxiliar para converter valor para Date
const parseDate = (value) => {
  if (!value || value === null || value === undefined || value === '') {
    return null;
  }
  
  try {
    let date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'object' && value !== null) {
      if ('value' in value) {
        const dateValue = value.value;
        if (dateValue) {
          date = new Date(dateValue);
        } else {
          return null;
        }
      } else if ('year' in value && 'month' in value && 'day' in value) {
        const year = value.year || 0;
        const month = (value.month || 1) - 1;
        const day = value.day || 1;
        date = new Date(year, month, day);
      } else if ('seconds' in value) {
        date = new Date(value.seconds * 1000);
      } else if ('timestamp' in value) {
        date = new Date(value.timestamp);
      } else if ('toISOString' in value && typeof value.toISOString === 'function') {
        date = new Date(value.toISOString());
      } else if ('date' in value) {
        date = new Date(value.date);
      } else if ('dateValue' in value) {
        date = new Date(value.dateValue);
      } else {
        date = new Date(value);
      }
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        return null;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        date = new Date(trimmed);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(trimmed);
      }
    } else if (typeof value === 'number') {
      if (value < 1e12) {
        date = new Date(value * 1000);
      } else {
        date = new Date(value);
      }
    } else {
      date = new Date(value);
    }
    
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    return null;
  }
};

// Função para calcular diferença em meses entre duas datas
const calculateMonthDifference = (date1, date2) => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);
  
  if (!d1 || !d2) {
    return null;
  }
  
  // Calcula a diferença em meses
  const yearDiff = d1.getFullYear() - d2.getFullYear();
  const monthDiff = d1.getMonth() - d2.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;
  
  // Ajusta considerando os dias
  const dayDiff = d1.getDate() - d2.getDate();
  if (dayDiff > 15) {
    return totalMonths + 1;
  } else if (dayDiff < -15) {
    return totalMonths - 1;
  }
  
  return totalMonths;
};

// Função para determinar o status da diferença (cor)
const getDifferenceStatus = (difference) => {
  if (difference === null || difference === undefined) {
    return 'unknown'; // Sem dados
  }
  
  if (difference <= 0) {
    return 'green'; // Verde: cronograma termina antes ou no mesmo período
  } else if (difference <= 2) {
    return 'yellow'; // Amarelo: 1 ou 2 meses a mais
  } else {
    return 'red'; // Vermelho: 3 meses ou mais
  }
};

// Status que representam projetos finalizados (case-insensitive)
const FINALIZED_STATUSES = [
  'churn pelo cliente',
  'close',
  'obra finalizada',
  'termo de encerramento',
  'termo de encerrame',
  'encerrado',
  'finalizado',
  'concluído',
  'concluido',
  'cancelado',
  'execução',
  'execucao'
];

// Função auxiliar para verificar se um status é finalizado
const isFinalizedStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return FINALIZED_STATUSES.some(finalizedStatus => 
    statusLower === finalizedStatus.toLowerCase().trim() ||
    statusLower.includes(finalizedStatus.toLowerCase().trim())
  );
};

// Função auxiliar para verificar se um status é pausado
const isPausedStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  const statusLower = status.toLowerCase().trim();
  return statusLower.includes('pausa') || statusLower.includes('pausado');
};

function PortfolioView() {
  const { isPrivileged } = useAuth(); // Verifica se o usuário é diretora/admin
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('info'); // Vista ativa
  
  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState([]); // Array para múltipla seleção
  const [timeFilter, setTimeFilter] = useState([]); // Array para múltipla seleção
  const [liderFilter, setLiderFilter] = useState([]); // Array para múltipla seleção
  const [clientFilter, setClientFilter] = useState([]); // Array para múltipla seleção
  const [differenceFilter, setDifferenceFilter] = useState([]); // Array para filtro de diferença (verde, amarelo, vermelho)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false);
  const [liderDropdownOpen, setLiderDropdownOpen] = useState(false);
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [differenceDropdownOpen, setDifferenceDropdownOpen] = useState(false);
  const [showFinalizedProjects, setShowFinalizedProjects] = useState(false); // Toggle para projetos finalizados
  const [showPausedProjects, setShowPausedProjects] = useState(true); // Toggle para projetos pausados
  const [showContractInfoColumns, setShowContractInfoColumns] = useState(true); // Toggle para mostrar/ocultar colunas de informações de contrato
  // Ordenação padrão: sempre por "project_order" em ordem ascendente
  const [sortConfig, setSortConfig] = useState({ key: 'project_order', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.multi-select-wrapper')) {
        setStatusDropdownOpen(false);
        setTimeDropdownOpen(false);
        setLiderDropdownOpen(false);
        setClientDropdownOpen(false);
        setDifferenceDropdownOpen(false);
      }
    };

    if (statusDropdownOpen || timeDropdownOpen || liderDropdownOpen || clientDropdownOpen || differenceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [statusDropdownOpen, timeDropdownOpen, liderDropdownOpen, clientDropdownOpen, differenceDropdownOpen]);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_URL}/api/portfolio`, { withCredentials: true });
      
      if (response.data && response.data.success) {
        const dataArray = Array.isArray(response.data.data) ? response.data.data : [];
        console.log(`✅ Dados recebidos: ${dataArray.length} registros`);
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
  };

      // Detecta e organiza as colunas baseado na vista ativa
  const columns = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    try {
      const firstRow = data[0];
      if (!firstRow || typeof firstRow !== 'object') return [];
      
      // Pega as colunas da vista ativa
      const viewColumns = VIEWS[activeView].columns;
      
      // Cria as colunas na ordem especificada
      const orderedColumns = [];
      
      // Larguras otimizadas para colunas comuns (em pixels) - ajustadas para headers de 2 linhas
      const COLUMN_WIDTHS = {
        'project_order': 60,
        'project_code_norm': 90,
        'project_name': 180,
        'status': 110,
        'nome_time': 110,
        'lider': 110,
        'client': 120,
        'comercial_name': 160,
        // Colunas específicas da vista de prazos
        'data_inicio_cronograma': 100,
        'data_termino_cronograma': 100,
        'duracao_contrato_total_meses': 90,
        'duracao_aditivo_total_meses': 90,
        'duracao_total_meses': 85,
        'data_termino_contrato': 100,
        'qtd_pausas': 80,
        'total_dias_pausa': 80,
        'data_termino_contrato_com_pausas': 120,
        'diferenca_cronograma_contrato': 100,
        // Colunas da vista de valores
        'valor_contrato_total': 100,
        'valor_aditivo_total': 100,
        'valor_total_contrato_mais_aditivos': 100,
        'qtd_aditivos_distintos': 85
      };

      viewColumns.forEach(key => {
        // Se é a coluna calculada de diferença, adiciona como coluna especial
        if (key === 'diferenca_cronograma_contrato') {
          orderedColumns.push({
            key: key,
            label: getColumnLabel(key),
            type: 'difference',
            isNumeric: true,
            isCalculated: true,
            width: COLUMN_WIDTHS[key] || 100
          });
        }
        // Verifica se a coluna existe nos dados
        else if (firstRow.hasOwnProperty(key)) {
          // Para colunas de data, sempre força o tipo como 'date' independente do valor
          // Isso garante que mesmo valores null/vazios sejam tratados como datas
          let columnType;
          if (DATE_COLUMNS.includes(key?.toLowerCase())) {
            columnType = 'date';
          } else {
            columnType = detectColumnType(firstRow[key], key);
          }
          
          // Debug temporário para colunas de data
          if (DATE_COLUMNS.includes(key?.toLowerCase())) {
            const sampleValue = firstRow[key];
            console.log(`[DEBUG] Coluna de data "${key}":`, {
              value: sampleValue,
              type: typeof sampleValue,
              isNull: sampleValue === null,
              isUndefined: sampleValue === undefined,
              isObject: typeof sampleValue === 'object',
              keys: typeof sampleValue === 'object' && sampleValue !== null ? Object.keys(sampleValue) : null
            });
          }
          
          orderedColumns.push({
            key: key,
            label: getColumnLabel(key),
            type: columnType,
            // Marca colunas numéricas para alinhamento correto
            isNumeric: columnType === 'number' || columnType === 'currency',
            // Largura otimizada para colunas comuns
            width: COLUMN_WIDTHS[key] || null
          });
        }
      });
      
      // Filtra colunas de informações de contrato se o toggle estiver desativado
      if (activeView === 'prazos' && !showContractInfoColumns) {
        return orderedColumns.filter(col => !CONTRACT_INFO_COLUMNS.includes(col.key));
      }
      
      return orderedColumns;
    } catch (err) {
      console.error('Erro ao processar colunas:', err);
      return [];
    }
  }, [data, activeView, showContractInfoColumns]);

  // Obtém valores únicos para os filtros
  const uniqueStatuses = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const statuses = new Set();
    data.forEach(row => {
      if (row.status) statuses.add(row.status);
    });
    return Array.from(statuses).sort();
  }, [data]);

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

  const uniqueClients = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    const clients = new Set();
    data.forEach(row => {
      if (row.client) clients.add(row.client);
    });
    return Array.from(clients).sort();
  }, [data]);

  // Dados filtrados apenas por Time (portfólio inteiro para KPIs gerais)
  // Isso permite que os KPIs reflitam o filtro de Time sem serem afetados por busca/detalhamento
  // NOTA: Para KPIs gerais, consideramos o portfólio inteiro (ativos + finalizados)
  const dataForKPIs = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    let filtered = data;

    // Filtro por Time (múltipla seleção) - aplicado aos KPIs
    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    // Filtro por Líder (múltipla seleção) - aplicado aos KPIs
    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    return filtered;
  }, [data, timeFilter, liderFilter]);

  // Dados filtrados apenas por Time para projetos ATIVOS (usado apenas para "Projetos em Atraso")
  const dataForActiveProjects = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    let filtered = data;

    // Filtro por Time (múltipla seleção)
    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    // Filtro por Líder (múltipla seleção)
    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    // Apenas projetos ativos (não finalizados)
    filtered = filtered.filter(row => {
      if (!row || typeof row !== 'object') return false;
      return !isFinalizedStatus(row.status);
    });

    return filtered;
  }, [data, timeFilter, liderFilter]);

  // Calcula KPIs baseado nos dados filtrados por Time
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
      // Projetos pausados
      if (isPausedStatus(row.status)) {
        projetosPausados++;
      }

      // Projetos ativos vs finalizados
      if (isFinalizedStatus(row.status)) {
        projetosFinalizados++;
      } else {
        projetosAtivos++;
      }

      // Valor total
      if (row.valor_total_contrato_mais_aditivos) {
        const valor = parseFloat(row.valor_total_contrato_mais_aditivos) || 0;
        valorTotal += valor;
      }

    });

    // Calcula projetos em atraso usando apenas projetos ativos
    dataForActiveProjects.forEach(row => {
      if (row.data_termino_cronograma && row.data_termino_contrato) {
        const diff = calculateMonthDifference(row.data_termino_cronograma, row.data_termino_contrato);
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

  // Dados para tabelas de projetos por fase - separados por ativos, pausados e finalizados
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

  // Calcula total geral de projetos (soma de todos os grupos)
  const totalGeralProjetos = useMemo(() => {
    if (!dataForKPIs || !Array.isArray(dataForKPIs)) return 0;
    return dataForKPIs.length;
  }, [dataForKPIs]);

  // Calcula totais e percentuais para cada grupo de tabelas
  const tabelaAtivosData = useMemo(() => {
    if (!projetosAtivosPorFase || !Array.isArray(projetosAtivosPorFase) || projetosAtivosPorFase.length === 0) return null;
    const totalGrupo = projetosAtivosPorFase.reduce((sum, item) => {
      if (!item || typeof item.count !== 'number') return sum;
      return sum + item.count;
    }, 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosAtivosPorFase, totalGeralProjetos]);

  const tabelaPausadosData = useMemo(() => {
    if (!projetosPausadosPorFase || !Array.isArray(projetosPausadosPorFase) || projetosPausadosPorFase.length === 0) return null;
    const totalGrupo = projetosPausadosPorFase.reduce((sum, item) => {
      if (!item || typeof item.count !== 'number') return sum;
      return sum + item.count;
    }, 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosPausadosPorFase, totalGeralProjetos]);

  const tabelaFinalizadosData = useMemo(() => {
    if (!projetosFinalizadosPorFase || !Array.isArray(projetosFinalizadosPorFase) || projetosFinalizadosPorFase.length === 0) return null;
    const totalGrupo = projetosFinalizadosPorFase.reduce((sum, item) => {
      if (!item || typeof item.count !== 'number') return sum;
      return sum + item.count;
    }, 0);
    return { totalGrupo, totalGeral: totalGeralProjetos };
  }, [projetosFinalizadosPorFase, totalGeralProjetos]);

  // Filtra os dados baseado na busca e filtros
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    // PRIMEIRO: Calcula a diferença e adiciona como propriedade calculada em cada linha
    let filtered = data.map(row => {
      if (!row || typeof row !== 'object') return row;
      
      // Calcula a diferença entre término do cronograma e término do contrato
      // Diferença = término cronograma - término contrato (em meses)
      const terminoCronograma = row.data_termino_cronograma;
      const terminoContrato = row.data_termino_contrato;
      
      const difference = calculateMonthDifference(terminoCronograma, terminoContrato);
      const differenceStatus = getDifferenceStatus(difference);
      
      return {
        ...row,
        diferenca_cronograma_contrato: difference,
        diferenca_cronograma_contrato_status: differenceStatus
      };
    });

    // DEPOIS: Aplica os filtros

    // Filtro por projetos finalizados (toggle)
    if (!showFinalizedProjects) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        // Exclui projetos finalizados se o toggle estiver desativado
        return !isFinalizedStatus(row.status);
      });
    }

    // Filtro por projetos pausados (toggle)
    if (!showPausedProjects) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        // Exclui projetos pausados se o toggle estiver desativado
        return !isPausedStatus(row.status);
      });
    }

    // Filtro por Status (múltipla seleção)
    if (statusFilter && statusFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return statusFilter.includes(String(row.status || ''));
      });
    }

    // Filtro por Time (múltipla seleção)
    if (timeFilter && timeFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return timeFilter.includes(String(row.nome_time || ''));
      });
    }

    // Filtro por Líder (múltipla seleção)
    if (liderFilter && liderFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return liderFilter.includes(String(row.lider || ''));
      });
    }

    // Filtro por Cliente (múltipla seleção)
    if (clientFilter && clientFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return clientFilter.includes(String(row.client || ''));
      });
    }

    // Filtro por Diferença (cor) - verde, amarelo, vermelho
    if (differenceFilter && differenceFilter.length > 0) {
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        const status = row.diferenca_cronograma_contrato_status || 'unknown';
        return differenceFilter.includes(status);
      });
    }

    // Busca global
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row => {
        if (!row || typeof row !== 'object') return false;
        return Object.values(row).some(value => 
          value !== null && value !== undefined && 
          String(value).toLowerCase().includes(term)
        );
      });
    }

    // Ordenação (sempre aplicada, padrão é por project_order)
    const sortKey = sortConfig.key || 'project_order';
    const sortDirection = sortConfig.direction || 'asc';
    
    filtered.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      // Valores nulos/undefined vão para o final
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      let comparison = 0;
      
      // project_code_norm é sempre texto (formato texto mesmo)
      if (sortKey === 'project_code_norm') {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      // Verifica se é uma coluna numérica (project_order sempre é numérica)
      else if (sortKey === 'project_order' || 
               typeof aVal === 'number' || 
               typeof bVal === 'number' ||
               (!isNaN(Number(aVal)) && !isNaN(Number(bVal)) && aVal !== '' && bVal !== '')) {
        // Converte para número se necessário
        const numA = typeof aVal === 'number' ? aVal : Number(aVal);
        const numB = typeof bVal === 'number' ? bVal : Number(bVal);
        
        // Se a conversão falhar, trata como texto
        if (isNaN(numA) || isNaN(numB)) {
          comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
        } else {
          comparison = numA - numB;
        }
      } else {
        // Ordenação alfabética
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [data, searchTerm, statusFilter, timeFilter, liderFilter, clientFilter, differenceFilter, sortConfig, showFinalizedProjects, showPausedProjects]);

  // Dados para gráfico de projetos por status de diferença de prazo - usa APENAS projetos ativos
  const differenceChartData = useMemo(() => {
    if (!dataForActiveProjects || !Array.isArray(dataForActiveProjects) || dataForActiveProjects.length === 0) return null;

    // Calcula a diferença para cada linha se ainda não foi calculada
    const dataWithDifference = dataForActiveProjects.map(row => {
      if (row.diferenca_cronograma_contrato_status) {
        return row;
      }
      const difference = calculateMonthDifference(row.data_termino_cronograma, row.data_termino_contrato);
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
          label: 'Projetos por Diferença de Prazo',
          data: values,
          percentages: percentages,
          backgroundColor: colors,
          borderColor: colors.map(c => c),
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 40,
          maxBarThickness: 50,
        }
      ]
    };
  }, [dataForActiveProjects]);

  // Paginação
  const paginatedData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return 1;
    return Math.ceil(filteredData.length / itemsPerPage);
  }, [filteredData, itemsPerPage]);

  // Handlers
  const handleSort = (columnKey) => {
    setSortConfig(prev => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setTimeFilter([]);
    setLiderFilter([]);
    setClientFilter([]);
    setDifferenceFilter([]);
    setShowFinalizedProjects(false);
    setShowPausedProjects(true);
    setSortConfig({ key: 'project_order', direction: 'asc' });
    setCurrentPage(1);
  };

  // Handlers para seleção múltipla
  const handleStatusToggle = (status) => {
    setStatusFilter(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
    setCurrentPage(1);
  };

  const handleTimeToggle = (time) => {
    setTimeFilter(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      } else {
        return [...prev, time];
      }
    });
    setCurrentPage(1);
  };

  const handleLiderToggle = (lider) => {
    setLiderFilter(prev => {
      if (prev.includes(lider)) {
        return prev.filter(l => l !== lider);
      } else {
        return [...prev, lider];
      }
    });
    setCurrentPage(1);
  };

  const handleSelectAllLider = () => {
    if (liderFilter.length === uniqueLiders.length) {
      setLiderFilter([]);
    } else {
      setLiderFilter([...uniqueLiders]);
    }
    setCurrentPage(1);
  };

  const handleSelectAllStatus = () => {
    if (statusFilter.length === uniqueStatuses.length) {
      setStatusFilter([]);
    } else {
      setStatusFilter([...uniqueStatuses]);
    }
    setCurrentPage(1);
  };

  const handleSelectAllTime = () => {
    if (timeFilter.length === uniqueTimes.length) {
      setTimeFilter([]);
    } else {
      setTimeFilter([...uniqueTimes]);
    }
    setCurrentPage(1);
  };

  const handleClientToggle = (client) => {
    setClientFilter(prev => {
      if (prev.includes(client)) {
        return prev.filter(c => c !== client);
      } else {
        return [...prev, client];
      }
    });
    setCurrentPage(1);
  };

  const handleSelectAllClient = () => {
    if (clientFilter.length === uniqueClients.length) {
      setClientFilter([]);
    } else {
      setClientFilter([...uniqueClients]);
    }
    setCurrentPage(1);
  };

  // Handlers para filtro de diferença
  const differenceOptions = [
    { value: 'green', label: 'Verde (OK)' },
    { value: 'yellow', label: 'Amarelo (1-2 meses)' },
    { value: 'red', label: 'Vermelho (3+ meses)' }
  ];

  const handleDifferenceToggle = (status) => {
    setDifferenceFilter(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
    setCurrentPage(1);
  };

  const handleSelectAllDifference = () => {
    if (differenceFilter.length === differenceOptions.length) {
      setDifferenceFilter([]);
    } else {
      setDifferenceFilter(differenceOptions.map(opt => opt.value));
    }
    setCurrentPage(1);
  };

  const handleViewChange = (viewId) => {
    setActiveView(viewId);
    setCurrentPage(1); // Reset para primeira página ao mudar de vista
    // Sempre mantém a ordenação por project_order ao mudar de vista
    setSortConfig({ key: 'project_order', direction: 'asc' });
    // Se mudar para uma vista diferente de prazos, reseta o estado das colunas de contrato
    if (viewId !== 'prazos') {
      setShowContractInfoColumns(true);
    }
  };

  // Estados de loading e erro
  if (loading) {
    return (
      <div className="portfolio-container">
        <div className="loading">Carregando dados do portfólio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-container">
        <div className="error">
          <h2>Erro ao carregar dados</h2>
          <p>{error}</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="no-data">
          <h2>Nenhum dado disponível</h2>
          <p>Não há dados para exibir no momento.</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="portfolio-container">
        <div className="no-data">
          <h2>Estrutura de dados não identificada</h2>
          <p>Os dados retornados não têm uma estrutura válida.</p>
          <button onClick={fetchPortfolioData} className="retry-button">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-container">
      {/* Cabeçalho */}
      <div className="header">
        <h2>Portfólio de Projetos</h2>
        <div className="header-actions">
          <button onClick={fetchPortfolioData} className="refresh-button">
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros Principais - Sticky no topo (apenas Time e Líder) */}
      <div className="top-filters-sticky">
        <div className="top-filters-container">
          <div className="top-filters-label">Filtros Principais:</div>
          <div className="top-filters-dropdowns">
            {/* Filtro de Time com múltipla seleção */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setTimeDropdownOpen(!timeDropdownOpen);
                  setLiderDropdownOpen(false);
                  setStatusDropdownOpen(false);
                  setClientDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {timeFilter.length === 0 
                    ? 'Todos os Times' 
                    : timeFilter.length === 1 
                      ? timeFilter[0] 
                      : `${timeFilter.length} Times selecionados`}
                </span>
                <span className="dropdown-arrow">{timeDropdownOpen ? '▲' : '▼'}</span>
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

            {/* Filtro de Líder com múltipla seleção - apenas para diretora/admin */}
            {isPrivileged && (
              <div className="multi-select-wrapper">
                <button
                  type="button"
                  className="multi-select-button"
                  onClick={() => {
                    setLiderDropdownOpen(!liderDropdownOpen);
                    setTimeDropdownOpen(false);
                    setStatusDropdownOpen(false);
                    setClientDropdownOpen(false);
                    setDifferenceDropdownOpen(false);
                  }}
                >
                  <span>
                    {liderFilter.length === 0 
                      ? 'Todos os Líderes' 
                      : liderFilter.length === 1 
                        ? liderFilter[0] 
                        : `${liderFilter.length} Líderes selecionados`}
                  </span>
                  <span className="dropdown-arrow">{liderDropdownOpen ? '▲' : '▼'}</span>
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

      {/* RESUMO EXECUTIVO - Storytelling: Começar com o que importa */}
      <div className="executive-summary">
        <div className="summary-header">
          <h3 className="summary-title">Resumo Executivo</h3>
          <p className="summary-subtitle">Visão geral do portfólio de projetos</p>
        </div>
        
        {/* KPIs - Todos com mesmo tamanho */}
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
            <div className="kpi-hero-label">Valor Total do Portfólio</div>
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

      {/* DETALHAMENTO - Storytelling: Tabela para análise profunda */}
      <div className="detail-section">
        <div className="detail-header">
          <h3 className="detail-title">Detalhamento dos Projetos</h3>
          <p className="detail-subtitle">Análise detalhada por projeto</p>
        </div>

        {/* Botões de Vista */}
        <div className="view-selector">
        {Object.values(VIEWS).map(view => (
          <button
            key={view.id}
            onClick={() => handleViewChange(view.id)}
            className={`view-button ${activeView === view.id ? 'active' : ''}`}
          >
            {view.name}
          </button>
        ))}
        
        {/* Botão para expandir/colapsar Informações de Contrato (apenas na vista de prazos) */}
        {activeView === 'prazos' && (
          <button
            onClick={() => setShowContractInfoColumns(!showContractInfoColumns)}
            className={`contract-info-toggle ${showContractInfoColumns ? 'expanded' : 'collapsed'}`}
            title={showContractInfoColumns ? 'Ocultar Informações de Contrato' : 'Mostrar Informações de Contrato'}
          >
            <span className="toggle-icon">{showContractInfoColumns ? '▼' : '▶'}</span>
            <span className="toggle-text">{showContractInfoColumns ? 'Ocultar' : 'Mostrar'} Contrato</span>
          </button>
        )}
      </div>

      {/* Barra de busca e filtros */}
      <div className="filters-section">
        {/* Primeira linha: Toggles e Busca */}
        <div className="filters-row">
          {/* Toggle para projetos finalizados */}
          <div className="finalized-toggle-wrapper">
            <label className="finalized-toggle">
              <input
                type="checkbox"
                checked={showFinalizedProjects}
                onChange={(e) => {
                  setShowFinalizedProjects(e.target.checked);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setShowPausedProjects(e.target.checked);
                  setCurrentPage(1);
                }}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">Mostrar Projetos Pausados</span>
            </label>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Buscar em todas as colunas..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="search-input"
            />
          </div>
        </div>

        {/* Segunda linha: Dropdowns */}
        <div className="filter-dropdowns">
            {/* Filtro de Status com múltipla seleção */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setStatusDropdownOpen(!statusDropdownOpen);
                  setTimeDropdownOpen(false);
                  setLiderDropdownOpen(false);
                  setClientDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {statusFilter.length === 0 
                    ? 'Todos os Status' 
                    : statusFilter.length === 1 
                      ? statusFilter[0] 
                      : `${statusFilter.length} Status selecionados`}
                </span>
                <span className="dropdown-arrow">{statusDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {statusDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={statusFilter.length === uniqueStatuses.length && uniqueStatuses.length > 0}
                        onChange={handleSelectAllStatus}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueStatuses.map(status => (
                      <label key={status} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={statusFilter.includes(status)}
                          onChange={() => handleStatusToggle(status)}
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Cliente com múltipla seleção */}
            <div className="multi-select-wrapper">
              <button
                type="button"
                className="multi-select-button"
                onClick={() => {
                  setClientDropdownOpen(!clientDropdownOpen);
                  setStatusDropdownOpen(false);
                  setTimeDropdownOpen(false);
                  setLiderDropdownOpen(false);
                  setDifferenceDropdownOpen(false);
                }}
              >
                <span>
                  {clientFilter.length === 0 
                    ? 'Todos os Clientes' 
                    : clientFilter.length === 1 
                      ? clientFilter[0] 
                      : `${clientFilter.length} Clientes selecionados`}
                </span>
                <span className="dropdown-arrow">{clientDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {clientDropdownOpen && (
                <div className="multi-select-dropdown">
                  <div className="multi-select-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={clientFilter.length === uniqueClients.length && uniqueClients.length > 0}
                        onChange={handleSelectAllClient}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="multi-select-options">
                    {uniqueClients.map(client => (
                      <label key={client} className="multi-select-option">
                        <input
                          type="checkbox"
                          checked={clientFilter.includes(client)}
                          onChange={() => handleClientToggle(client)}
                        />
                        <span>{client}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de Diferença (apenas na vista de prazos) */}
            {activeView === 'prazos' && (
              <div className="multi-select-wrapper">
                <button
                  type="button"
                  className="multi-select-button"
                  onClick={() => {
                    setDifferenceDropdownOpen(!differenceDropdownOpen);
                    setStatusDropdownOpen(false);
                    setTimeDropdownOpen(false);
                    setLiderDropdownOpen(false);
                    setClientDropdownOpen(false);
                  }}
                >
                  <span>
                    {differenceFilter.length === 0 
                      ? 'Todas as Diferenças' 
                      : differenceFilter.length === 1 
                        ? differenceOptions.find(opt => opt.value === differenceFilter[0])?.label || differenceFilter[0]
                        : `${differenceFilter.length} Diferenças selecionadas`}
                  </span>
                  <span className="dropdown-arrow">{differenceDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {differenceDropdownOpen && (
                  <div className="multi-select-dropdown">
                    <div className="multi-select-header">
                      <label className="select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={differenceFilter.length === differenceOptions.length && differenceOptions.length > 0}
                          onChange={handleSelectAllDifference}
                        />
                        <span>Selecionar Todos</span>
                      </label>
                    </div>
                    <div className="multi-select-options">
                      {differenceOptions.map(option => (
                        <label key={option.value} className="multi-select-option">
                          <input
                            type="checkbox"
                            checked={differenceFilter.includes(option.value)}
                            onChange={() => handleDifferenceToggle(option.value)}
                          />
                          <span style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem' 
                          }}>
                            <span 
                              className={`difference-indicator difference-${option.value}`}
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                display: 'inline-block'
                              }}
                            ></span>
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(searchTerm || statusFilter.length > 0 || timeFilter.length > 0 || liderFilter.length > 0 || clientFilter.length > 0 || differenceFilter.length > 0 || showFinalizedProjects || !showPausedProjects) && (
              <button onClick={clearFilters} className="clear-filters-button">
                Limpar Filtros
              </button>
            )}
          </div>

        <div className="results-info">
          <span>
            Mostrando {paginatedData.length} de {filteredData.length} registros
            {filteredData.length !== data.length && ` (${data.length} total)`}
          </span>
        </div>
      </div>

      {/* Tabela com scroll */}
      <div className="table-wrapper">
        <div className="table-scroll-container">
          <table className="portfolio-table">
            <thead>
              <tr>
                {columns.map(column => {
                  const isNumeric = column.type === 'number' || column.type === 'currency';
                  const isSorted = sortConfig.key === column.key;
                  const columnClass = `column-${column.key.replace(/_/g, '-')}`;
                  const isContractInfo = CONTRACT_INFO_COLUMNS.includes(column.key);
                  
                  // Determina se é a primeira ou última coluna de informações de contrato para aplicar bordas
                  const contractInfoIndex = isContractInfo ? CONTRACT_INFO_COLUMNS.indexOf(column.key) : -1;
                  const isFirstContractInfo = contractInfoIndex === 0;
                  const isLastContractInfo = contractInfoIndex === CONTRACT_INFO_COLUMNS.length - 1;
                  
                  return (
                    <th 
                      key={column.key}
                      className={`${isSorted ? `sort-${sortConfig.direction}` : ''} ${isNumeric ? 'th-numeric' : ''} ${columnClass} ${isContractInfo && activeView === 'prazos' ? 'contract-info-column' : ''} ${isFirstContractInfo && activeView === 'prazos' ? 'contract-info-first' : ''} ${isLastContractInfo && activeView === 'prazos' ? 'contract-info-last' : ''}`}
                      style={column.width ? { width: `${column.width}px`, minWidth: `${column.width}px`, maxWidth: `${column.width}px` } : {}}
                      onClick={() => handleSort(column.key)}
                    >
                      <div className="th-content">
                        <span dangerouslySetInnerHTML={{ __html: column.label }} />
                        <span className="sort-indicator">
                          {isSorted && (
                            sortConfig.direction === 'asc' ? '↑' : '↓'
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) => (
                  <tr key={index}>
                    {columns.map(column => {
                      const columnClass = `column-${column.key.replace(/_/g, '-')}`;
                      const cellValue = column.isCalculated && column.key === 'diferenca_cronograma_contrato'
                        ? row.diferenca_cronograma_contrato
                        : row[column.key];
                      const differenceStatus = column.key === 'diferenca_cronograma_contrato' 
                        ? row.diferenca_cronograma_contrato_status 
                        : null;
                      
                      // Determina a classe de cor baseada no status da diferença
                      const colorClass = differenceStatus 
                        ? `cell-difference-${differenceStatus}` 
                        : '';
                      
                      // Destaca células de informações de contrato
                      const isContractInfo = CONTRACT_INFO_COLUMNS.includes(column.key);
                      const contractInfoIndex = isContractInfo ? CONTRACT_INFO_COLUMNS.indexOf(column.key) : -1;
                      const isFirstContractInfo = contractInfoIndex === 0;
                      const isLastContractInfo = contractInfoIndex === CONTRACT_INFO_COLUMNS.length - 1;
                      const contractInfoClass = isContractInfo && activeView === 'prazos' ? 'contract-info-cell' : '';
                      const contractInfoFirstClass = isFirstContractInfo && activeView === 'prazos' ? 'contract-info-cell-first' : '';
                      const contractInfoLastClass = isLastContractInfo && activeView === 'prazos' ? 'contract-info-cell-last' : '';
                      
                      return (
                        <td 
                          key={column.key} 
                          className={`cell-${column.type === 'currency' ? 'currency' : column.type} ${columnClass} ${colorClass} ${contractInfoClass} ${contractInfoFirstClass} ${contractInfoLastClass}`}
                          style={column.width ? { width: `${column.width}px`, minWidth: `${column.width}px`, maxWidth: `${column.width}px` } : {}}
                        >
                          {formatValue(cellValue, column.type)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem', color: '#737373' }}>
                    Nenhum resultado encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            <span>Página {currentPage} de {totalPages}</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="items-per-page-select"
            >
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
              <option value={200}>200 por página</option>
            </select>
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              Anterior
            </button>
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`pagination-button ${currentPage === pageNum ? 'active' : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="pagination-button"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      </div>

      {/* CONTEXTO VISUAL - Storytelling: Gráficos que contam a história */}
      <div className="insights-section">
        <div className="insights-header">
          <h3 className="insights-title">Análise do Portfólio</h3>
          <p className="insights-subtitle">Distribuição e status dos projetos</p>
        </div>
        
        <div className="charts-storytelling">
                {/* Gráfico Principal: Status de Prazo (mais importante) */}
                {differenceChartData && (
            <div className="chart-story-primary">
              <div className="chart-story-header">
                <h4 className="chart-story-title">Status de Prazo dos Projetos</h4>
                <p className="chart-story-description">
                  Distribuição de projetos ativos por situação de prazo em relação ao contrato
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
                          // Verificação defensiva - se não tiver dados, retorna padrão
                          if (!context || !context.dataset || !context.parsed) {
                            return 'end';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return 'end';
                          }
                          // Para barras muito longas, coloca o rótulo dentro da barra
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return 'end';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          // Se a barra for maior que 80% do máximo, coloca o rótulo dentro
                          if (currentValue > maxValue * 0.8) {
                            return 'center';
                          }
                          return 'end';
                        },
                        align: (context) => {
                          // Verificação defensiva
                          if (!context || !context.dataset || !context.parsed) {
                            return 'right';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return 'right';
                          }
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return 'right';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          // Se a barra for maior que 80% do máximo, alinha à direita dentro da barra
                          if (currentValue > maxValue * 0.8) {
                            return 'right';
                          }
                          return 'right';
                        },
                        offset: (context) => {
                          // Verificação defensiva
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
                          // Se a barra for muito longa, coloca o rótulo dentro com offset negativo
                          if (currentValue > maxValue * 0.8) {
                            return -8;
                          }
                          return 12;
                        },
                        color: (context) => {
                          // Verificação defensiva
                          if (!context || !context.dataset || !context.parsed) {
                            return '#1a1a1a';
                          }
                          const parsedX = context.parsed?.x;
                          if (typeof parsedX !== 'number' || isNaN(parsedX)) {
                            return '#1a1a1a';
                          }
                          // Ajusta cor do rótulo baseado na cor da barra para melhor contraste
                          const dataIndex = context.dataIndex;
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return '#1a1a1a';
                          const maxValue = Math.max(...allValues);
                          const currentValue = parsedX;
                          
                          // Se o rótulo está dentro da barra vermelha, usa texto branco
                          if (dataIndex === 2 && currentValue > maxValue * 0.8) {
                            return '#ffffff';
                          }
                          // Se o rótulo está dentro de outras barras, usa texto escuro
                          if (currentValue > maxValue * 0.8) {
                            return '#1a1a1a';
                          }
                          // Se está fora, usa texto escuro
                          return '#1a1a1a';
                        },
                        font: {
                          size: 11,
                          weight: 'bold',
                          family: 'Verdana'
                        },
                        formatter: (value, context) => {
                          // Verificação defensiva
                          if (typeof value !== 'number' || isNaN(value)) {
                            return '0 (0.0%)';
                          }
                          if (!context || !context.dataset) {
                            return `${value} (0.0%)`;
                          }
                          // Formata: valor (percentual%)
                          const dataset = context.dataset;
                          const allValues = dataset.data || [];
                          if (allValues.length === 0) return `${value} (0.0%)`;
                          const total = allValues.reduce((sum, val) => sum + (Number(val) || 0), 0);
                          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                          return `${value} (${percentage}%)`;
                        },
                        backgroundColor: (context) => {
                          // Verificação defensiva
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
                          
                          // Se o rótulo está dentro da barra, usa fundo semitransparente da cor da barra
                          if (currentValue > maxValue * 0.8) {
                            if (dataIndex === 2) { // Barra vermelha
                              return 'rgba(255, 59, 48, 0.7)';
                            } else if (dataIndex === 0) { // Barra verde
                              return 'rgba(52, 199, 89, 0.7)';
                            } else if (dataIndex === 1) { // Barra amarela
                              return 'rgba(255, 204, 0, 0.7)';
                            } else { // Barra cinza
                              return 'rgba(134, 134, 139, 0.7)';
                            }
                          }
                          // Se está fora, usa fundo branco
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
                        display: true, // Sempre exibe os rótulos
                        clip: false // Não corta o rótulo mesmo que saia da área do gráfico
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
                Distribuição de projetos por fase do ciclo de vida
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
    </div>
  );
}

export default PortfolioView;

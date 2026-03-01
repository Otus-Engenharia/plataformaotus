/**
 * Utilitarios compartilhados para Portfolio e Indicadores
 *
 * Constantes e funcoes usadas por ambas as vistas
 */

// Definicao das 3 vistas com suas colunas
export const VIEWS = {
  info: {
    id: 'info',
    name: 'Informacoes do Projeto',
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
      'project_order',
      'project_code_norm',
      'project_name',
      'status',
      'nome_time',
      'lider',
      'data_inicio_cronograma',
      'data_termino_cronograma',
      'data_termino_contrato',
      'data_termino_contrato_com_pausas',
      'diferenca_cronograma_contrato',
      'duracao_contrato_total_meses',
      'duracao_aditivo_total_meses',
      'duracao_total_meses',
      'qtd_pausas',
      'total_dias_pausa'
    ]
  }
};

// Colunas que sao "Informacoes de Contrato" - para destacar visualmente e poder colapsar
export const CONTRACT_INFO_COLUMNS = [
  'duracao_contrato_total_meses',
  'duracao_aditivo_total_meses',
  'duracao_total_meses',
  'qtd_pausas',
  'total_dias_pausa'
];

// Mapeamento de nomes em portugues
export const COLUMN_NAMES_PT = {
  'project_order': 'Ordem',
  'project_code': 'Codigo',
  'project_code_norm': 'Codigo',
  'project_name': 'Nome do<br/>Projeto',
  'comercial_name': 'Nome<br/>Comercial',
  'status': 'Status',
  'client': 'Cliente',
  'nome_time': 'Time',
  'lider': 'Lider',
  'valor_contrato_total': 'Contrato<br/>(R$)',
  'valor_aditivo_total': 'Aditivos<br/>(R$)',
  'valor_total_contrato_mais_aditivos': 'Total<br/>(R$)',
  'qtd_aditivos_distintos': 'Qtd<br/>Aditivos',
  'duracao_contrato_total_meses': 'Dur. Contrato<br/>(meses)',
  'duracao_aditivo_total_meses': 'Dur. Aditivo<br/>(meses)',
  'duracao_total_meses': 'Dur. Total<br/>(meses)',
  'data_inicio_cronograma': 'Inicio<br/>Cronograma',
  'data_termino_cronograma': 'Termino<br/>Cronograma',
  'qtd_pausas': 'Qtd<br/>Pausas',
  'total_dias_pausa': 'Total<br/>Dias Pausa',
  'data_inicio_primeira_pausa': 'Inicio<br/>1a Pausa',
  'data_fim_ultima_pausa': 'Fim<br/>Ultima Pausa',
  'data_termino_contrato': 'Termino<br/>Contrato',
  'data_termino_contrato_com_pausas': 'Termino Contrato<br/>c/ Pausas',
  'diferenca_cronograma_contrato': 'Diferenca<br/>(meses)'
};

// Colunas que sao valores monetarios
export const MONETARY_COLUMNS = [
  'valor_contrato_total',
  'valor_aditivo_total',
  'valor_total_contrato_mais_aditivos'
];

// Colunas que sao sempre datas
export const DATE_COLUMNS = [
  'data_inicio_cronograma',
  'data_termino_cronograma',
  'data_inicio_primeira_pausa',
  'data_fim_ultima_pausa',
  'data_termino_contrato',
  'data_termino_contrato_com_pausas'
];

// Status que representam projetos finalizados
export const FINALIZED_STATUSES = [
  'churn pelo cliente',
  'close',
  'obra finalizada',
  'termo de encerramento',
  'termo de encerrame',
  'encerrado',
  'finalizado',
  'concluido',
  'concluído',
  'cancelado',
  'execucao',
  'execução'
];

// Larguras otimizadas para colunas comuns (em pixels)
export const COLUMN_WIDTHS = {
  'project_order': 60,
  'project_code_norm': 90,
  'project_name': 180,
  'status': 110,
  'nome_time': 110,
  'lider': 110,
  'client': 120,
  'comercial_name': 160,
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
  'valor_contrato_total': 100,
  'valor_aditivo_total': 100,
  'valor_total_contrato_mais_aditivos': 100,
  'qtd_aditivos_distintos': 85
};

/**
 * Retorna o label traduzido para uma coluna
 */
export const getColumnLabel = (key) => {
  if (COLUMN_NAMES_PT[key?.toLowerCase()]) {
    return COLUMN_NAMES_PT[key.toLowerCase()];
  }
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Detecta o tipo de uma coluna baseado no valor e nome
 */
export const detectColumnType = (value, columnKey) => {
  // Verifica se e uma coluna de data por nome PRIMEIRO
  if (DATE_COLUMNS.includes(columnKey?.toLowerCase())) {
    return 'date';
  }

  if (value === null || value === undefined) return 'text';

  // project_order e sempre numerica
  if (columnKey?.toLowerCase() === 'project_order') {
    return 'number';
  }

  // project_code_norm e sempre texto
  if (columnKey?.toLowerCase() === 'project_code_norm') {
    return 'text';
  }

  // Verifica se e uma coluna monetaria
  if (MONETARY_COLUMNS.includes(columnKey?.toLowerCase())) {
    return 'currency';
  }

  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';

  if (value instanceof Date) return 'date';

  // Verifica se e um objeto que pode ser uma data
  if (typeof value === 'object' && value !== null) {
    if ('value' in value || 'seconds' in value || 'toISOString' in value) {
      return 'date';
    }
    if (typeof value.toString === 'function' && value.toString().includes('Date')) {
      return 'date';
    }
  }

  // Verifica se e string de data
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';

  // Se o valor e uma string que representa um numero
  if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '') {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return 'number';
    }
  }

  return 'text';
};

/**
 * Funcao auxiliar para converter valor para Date
 */
export const parseDate = (value) => {
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

/**
 * Formata um valor baseado no seu tipo
 */
export const formatValue = (value, type) => {
  if (value === null || value === undefined) return '-';

  if (type === 'currency') {
    return `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (type === 'number') {
    return parseFloat(value).toLocaleString('pt-BR');
  }

  if (type === 'date') {
    try {
      if (value === null || value === undefined || value === '' ||
          (typeof value === 'string' && value.trim() === '')) {
        return '-';
      }

      let date = parseDate(value);

      if (!date || isNaN(date.getTime())) {
        return '-';
      }

      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  }

  if (type === 'boolean') {
    return value ? 'Sim' : 'Nao';
  }

  if (type === 'difference') {
    if (value === null || value === undefined) {
      return '-';
    }
    return typeof value === 'number' ? value.toString() : String(value);
  }

  // Se o tipo nao foi detectado corretamente mas o valor e um objeto
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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
      // Ignora
    }
    return '-';
  }

  return String(value);
};

/**
 * Calcula diferenca em meses entre duas datas
 */
export const calculateMonthDifference = (date1, date2) => {
  const d1 = parseDate(date1);
  const d2 = parseDate(date2);

  if (!d1 || !d2) {
    return null;
  }

  const yearDiff = d1.getFullYear() - d2.getFullYear();
  const monthDiff = d1.getMonth() - d2.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff;

  const dayDiff = d1.getDate() - d2.getDate();
  if (dayDiff > 15) {
    return totalMonths + 1;
  } else if (dayDiff < -15) {
    return totalMonths - 1;
  }

  return totalMonths;
};

/**
 * Determina o status da diferenca (cor)
 */
export const getDifferenceStatus = (difference) => {
  if (difference === null || difference === undefined) {
    return 'unknown';
  }

  if (difference <= 0) {
    return 'green';
  } else if (difference <= 2) {
    return 'yellow';
  } else {
    return 'red';
  }
};

/**
 * Verifica se um status e finalizado
 */
export const isFinalizedStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return FINALIZED_STATUSES.some(finalizedStatus =>
    statusLower === finalizedStatus.toLowerCase().trim() ||
    statusLower.includes(finalizedStatus.toLowerCase().trim())
  );
};

/**
 * Verifica se um status e pausado
 */
export const isPausedStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  const statusLower = status.toLowerCase().trim();
  return statusLower.includes('pausa') || statusLower.includes('pausado');
};

/**
 * Verifica se um status e "a iniciar" (pre-execucao)
 */
export const isAIniciarStatus = (status) => {
  if (!status || typeof status !== 'string') return false;
  return status.toLowerCase().trim().includes('a iniciar');
};

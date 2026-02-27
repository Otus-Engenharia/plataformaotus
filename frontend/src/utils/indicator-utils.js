/**
 * Utilitários para cálculo de scores e formatação de indicadores
 */

/**
 * Calcula o score de um indicador (0-120)
 * @param {number} value - Valor atual
 * @param {number} threshold80 - Limiar de 80% (score 80)
 * @param {number} target - Meta (score 100)
 * @param {number} threshold120 - Limiar de 120% (score 120)
 * @param {boolean} isInverse - Se verdadeiro, valores menores são melhores
 * @returns {number} Score entre 0 e 120
 */
export function calculateIndicatorScore(value, threshold80, target, threshold120, isInverse = false) {
  if (target === null || target === undefined || target === 0) return 0;

  const v = parseFloat(value) || 0;
  const m = parseFloat(target);
  const t80 = threshold80 !== null && threshold80 !== undefined ? parseFloat(threshold80) : m * 0.8;
  const t120 = threshold120 !== null && threshold120 !== undefined ? parseFloat(threshold120) : m * 1.2;

  if (isInverse) {
    // Para métricas inversas (menor é melhor, ex: turnover, bugs)
    if (v >= t80) return 0;         // Pior que meta mínima -> zerado
    if (v <= t120) return 120;      // Melhor que meta máxima -> cap 120
    if (v <= m) return 100 + ((m - v) / (m - t120)) * 20;
    return 80 + ((t80 - v) / (t80 - m)) * 20;
  } else {
    // Para métricas normais (maior é melhor)
    if (v < t80) return 0;          // Abaixo da meta mínima -> zerado
    if (v >= t120) return 120;      // Acima da meta máxima -> cap 120
    if (v >= m) return 100 + ((v - m) / (t120 - m)) * 20;
    return 80 + ((v - t80) / (m - t80)) * 20;
  }
}

/**
 * Calcula score a partir de um objeto indicador
 * @param {Object} indicador - Objeto indicador com valor, meta, thresholds
 * @returns {number} Score entre 0 e 120
 */
export function getIndicatorScore(indicador) {
  if (!indicador) return 0;
  return calculateIndicatorScore(
    indicador.valor,
    indicador.threshold_80,
    indicador.meta,
    indicador.threshold_120,
    indicador.is_inverse
  );
}

/**
 * Retorna a cor do semáforo baseado no score
 * @param {number} score - Score (0-120)
 * @returns {'red'|'yellow'|'green'|'blue'} Cor do semáforo
 */
export function getTrafficLightColor(score) {
  if (score === null || score === undefined) return 'gray';
  if (score >= 120) return 'dark';
  if (score >= 100) return 'green';
  if (score >= 80) return 'yellow';
  return 'red';
}

/**
 * Retorna a classe CSS para a cor do semáforo
 * @param {number} score - Score (0-120)
 * @returns {string} Classe CSS
 */
export function getTrafficLightClass(score) {
  const color = getTrafficLightColor(score);
  const classMap = {
    dark: 'traffic-light-dark',
    green: 'traffic-light-green',
    yellow: 'traffic-light-yellow',
    red: 'traffic-light-red',
    gray: 'traffic-light-gray',
  };
  return classMap[color] || 'traffic-light-gray';
}

/**
 * Retorna o hex da cor do semáforo
 * @param {number} score - Score (0-120)
 * @returns {string} Cor hex
 */
export function getTrafficLightHex(score) {
  const color = getTrafficLightColor(score);
  const hexMap = {
    dark: '#1a1a1a',
    green: '#22c55e',
    yellow: '#f59e0b',
    red: '#ef4444',
    gray: '#9CA3AF',
  };
  return hexMap[color] || hexMap.gray;
}

/**
 * Calcula valor consolidado baseado no tipo de consolidação
 * @param {Array} checkIns - Array de check-ins com { valor }
 * @param {'sum'|'average'|'last_value'|'manual'} consolidationType - Tipo de consolidação
 * @returns {number} Valor consolidado
 */
export function calculateConsolidatedValue(checkIns, consolidationType = 'last_value') {
  if (!checkIns || checkIns.length === 0) return 0;

  const valores = checkIns.map(ci => parseFloat(ci.valor) || 0);

  switch (consolidationType) {
    case 'sum':
      return valores.reduce((sum, v) => sum + v, 0);
    case 'average':
      return valores.reduce((sum, v) => sum + v, 0) / valores.length;
    case 'last_value':
    default:
      return valores[valores.length - 1];
  }
}

/**
 * Calcula o score ponderado de uma pessoa
 * @param {Array} indicadores - Array de indicadores com peso e valores
 * @returns {number|null} Score ponderado (0-120) ou null se não houver indicadores
 */
export function calculatePersonScore(indicadores) {
  if (!indicadores || indicadores.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const ind of indicadores) {
    const peso = ind.peso ?? 1;
    if (peso === 0) continue;
    const score = getIndicatorScore(ind);
    totalWeight += peso;
    weightedSum += score * peso;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Formata um valor baseado no tipo de métrica
 * @param {number} value - Valor a formatar
 * @param {'number'|'percentage'|'boolean'|'currency'} metricType - Tipo de métrica
 * @param {number} decimals - Casas decimais (default: 1)
 * @returns {string} Valor formatado
 */
export function formatValue(value, metricType = 'number', decimals = 1) {
  if (value === null || value === undefined) return '-';

  const num = parseFloat(value);
  if (isNaN(num)) return '-';

  switch (metricType) {
    case 'percentage':
      return `${num.toFixed(decimals)}%`;
    case 'currency':
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'boolean':
      return num > 0.5 ? 'Sim' : 'Não';
    case 'integer':
      return Math.floor(num).toLocaleString('pt-BR');
    case 'number':
    default:
      return num.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
  }
}

/**
 * Retorna o range de meses para um ciclo
 * @param {'q1'|'q2'|'q3'|'q4'|'anual'} cycle - Ciclo
 * @returns {{ start: number, end: number }} Mês inicial e final (1-12)
 */
export function getCycleMonthRange(cycle) {
  switch (cycle) {
    case 'q1':
      return { start: 1, end: 3 };
    case 'q2':
      return { start: 4, end: 6 };
    case 'q3':
      return { start: 7, end: 9 };
    case 'q4':
      return { start: 10, end: 12 };
    case 'anual':
    default:
      return { start: 1, end: 12 };
  }
}

/**
 * Meses de medição por frequência
 */
export const FREQ_MONTHS = {
  mensal: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  trimestral: [3, 6, 9, 12],
  semestral: [6, 12],
  anual: [12],
};

/**
 * Retorna se um mês é mês de medição para a frequência
 */
export function isMeasurementMonth(month, frequencia = 'mensal') {
  return (FREQ_MONTHS[frequencia] || FREQ_MONTHS.mensal).includes(month);
}

/**
 * Verifica se um indicador tem meses ativos dentro de um ciclo
 * Usado para esconder indicadores semestrais/anuais em trimestres sem medição
 * @param {Object} indicador - Indicador com frequencia, active_quarters, mes_inicio
 * @param {string} ciclo - Ciclo selecionado (q1, q2, q3, q4, anual)
 * @returns {boolean} true se há pelo menos um mês ativo no ciclo
 */
export function hasActiveMonthsInCycle(indicador, ciclo) {
  if (ciclo === 'anual') return true;
  // Indicadores anuais aparecem em todos os quarters (respeitando active_quarters)
  if (indicador.ciclo === 'anual') {
    const aq = indicador.active_quarters || { q1: true, q2: true, q3: true, q4: true };
    return aq[ciclo] !== false;
  }

  const { start, end } = getCycleMonthRange(ciclo);
  const frequencia = indicador.frequencia || 'mensal';
  const mesInicio = indicador.mes_inicio || 1;
  const aq = indicador.active_quarters || { q1: true, q2: true, q3: true, q4: true };

  const visibleMonths = FREQ_MONTHS[frequencia] || FREQ_MONTHS.mensal;

  for (let m = start; m <= end; m++) {
    if (m < mesInicio) continue;
    if (!visibleMonths.includes(m)) continue;
    if (m <= 3 && !aq.q1) continue;
    if (m > 3 && m <= 6 && !aq.q2) continue;
    if (m > 6 && m <= 9 && !aq.q3) continue;
    if (m > 9 && !aq.q4) continue;
    return true;
  }
  return false;
}

/**
 * Retorna o ciclo atual baseado na data
 * @param {Date} date - Data (default: hoje)
 * @returns {'q1'|'q2'|'q3'|'q4'} Ciclo atual
 */
export function getCurrentCycle(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month <= 3) return 'q1';
  if (month <= 6) return 'q2';
  if (month <= 9) return 'q3';
  return 'q4';
}

/**
 * Retorna o ano atual
 * @returns {number} Ano atual
 */
export function getCurrentYear() {
  return new Date().getFullYear();
}

/**
 * Retorna label legível para o ciclo
 * @param {'q1'|'q2'|'q3'|'q4'|'anual'} cycle - Ciclo
 * @returns {string} Label
 */
export function getCycleLabel(cycle) {
  const labels = {
    q1: '1º Trimestre',
    q2: '2º Trimestre',
    q3: '3º Trimestre',
    q4: '4º Trimestre',
    anual: 'Anual',
  };
  return labels[cycle] || cycle;
}

/**
 * Retorna array de opções de ciclo para selects
 * @param {boolean} includeAnnual - Se deve incluir opção anual
 * @returns {Array<{value: string, label: string}>}
 */
export function getCycleOptions(includeAnnual = true) {
  const options = [
    { value: 'q1', label: '1º Trimestre (Q1)' },
    { value: 'q2', label: '2º Trimestre (Q2)' },
    { value: 'q3', label: '3º Trimestre (Q3)' },
    { value: 'q4', label: '4º Trimestre (Q4)' },
  ];
  if (includeAnnual) {
    options.push({ value: 'anual', label: 'Anual' });
  }
  return options;
}

/**
 * Retorna array de meses para um ciclo
 * @param {'q1'|'q2'|'q3'|'q4'|'anual'} cycle - Ciclo
 * @returns {Array<{value: number, label: string}>}
 */
export function getMonthsForCycle(cycle) {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const { start, end } = getCycleMonthRange(cycle);
  const months = [];

  for (let i = start; i <= end; i++) {
    months.push({ value: i, label: monthNames[i - 1] });
  }

  return months;
}

/**
 * Retorna meses agrupados por periodicidade para templates de indicadores
 * @param {'trimestral'|'semestral'|'anual'} periodicity - Periodicidade
 * @returns {Array<{label: string, months: number[]}>}
 */
export function getMonthGroupsForPeriodicity(periodicity) {
  switch (periodicity) {
    case 'trimestral':
      return [
        { label: 'Q1', months: [1, 2, 3] },
        { label: 'Q2', months: [4, 5, 6] },
        { label: 'Q3', months: [7, 8, 9] },
        { label: 'Q4', months: [10, 11, 12] },
      ];
    case 'semestral':
      return [
        { label: '1º Semestre', months: [1, 2, 3, 4, 5, 6] },
        { label: '2º Semestre', months: [7, 8, 9, 10, 11, 12] },
      ];
    case 'anual':
    default:
      return [
        { label: 'Anual', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      ];
  }
}

/**
 * Distribui meta acumulada anual em metas mensais baseado no metodo de acumulo
 * @param {number} accumulated - Meta acumulada anual
 * @param {'sum'|'average'|'last_value'|'manual'} method - Metodo de acumulo
 * @param {Object} [activeQuarters] - Trimestres ativos { q1: bool, q2: bool, q3: bool, q4: bool }
 * @param {number} [mesInicio=1] - Mes de inicio (1-12), meses anteriores sao inativos
 * @param {string} [metricType='number'] - Tipo de metrica ('integer' arredonda para baixo)
 * @param {string} [frequencia='mensal'] - Frequencia de medicao ('mensal'|'trimestral'|'semestral'|'anual')
 * @returns {Object} Objeto {1: valor, 2: valor, ..., 12: valor}
 */
export function distributeAccumulatedTarget(accumulated, method, activeQuarters, mesInicio = 1, metricType = 'number', frequencia = 'mensal') {
  // Se receber string de periodicidade (compatibilidade), tratar como anual
  if (typeof activeQuarters === 'string') {
    activeQuarters = { q1: true, q2: true, q3: true, q4: true };
  }
  const aq = activeQuarters || { q1: true, q2: true, q3: true, q4: true };
  const round = (val) => metricType === 'integer' ? Math.floor(val) : Math.round(val * 100) / 100;

  const FREQ_MONTHS = {
    mensal: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    trimestral: [3, 6, 9, 12],
    semestral: [6, 12],
    anual: [12],
  };
  const visibleMonths = FREQ_MONTHS[frequencia] || FREQ_MONTHS.mensal;

  const quarterMonths = { q1: [1, 2, 3], q2: [4, 5, 6], q3: [7, 8, 9], q4: [10, 11, 12] };
  const activeMonths = [];
  for (const [q, months] of Object.entries(quarterMonths)) {
    if (aq[q]) activeMonths.push(...months.filter(m => m >= mesInicio && visibleMonths.includes(m)));
  }

  const result = {};
  const count = activeMonths.length || 1;
  const lastActiveMonth = activeMonths[activeMonths.length - 1];

  // Para sum: calcular base e ajustar último mês para soma exata
  let sumBase, sumUsed;
  if (method === 'sum') {
    if (metricType === 'integer') {
      sumBase = Math.floor(accumulated / count);
      // Distribuir resto nos últimos meses (+1 cada)
      sumUsed = 0;
    } else {
      sumBase = round(accumulated / count);
      sumUsed = 0;
    }
  }

  let activeIndex = 0;
  for (let m = 1; m <= 12; m++) {
    const isActive = activeMonths.includes(m);
    if (!isActive) {
      continue;
    }

    switch (method) {
      case 'sum':
        if (m === lastActiveMonth) {
          // Último mês recebe o resto para soma exata
          result[m] = metricType === 'integer'
            ? accumulated - sumUsed
            : round(accumulated - sumUsed);
        } else if (metricType === 'integer') {
          const intRemainder = accumulated - (sumBase * count);
          const extraStart = count - intRemainder;
          result[m] = activeIndex >= extraStart ? sumBase + 1 : sumBase;
        } else {
          result[m] = sumBase;
        }
        sumUsed += result[m];
        break;
      case 'average':
        result[m] = accumulated;
        break;
      case 'last_value':
        result[m] = accumulated;
        break;
      case 'manual':
      default:
        break;
    }
    activeIndex++;
  }

  return result;
}

/**
 * Retorna o status textual baseado no score
 * @param {number} score - Score (0-120)
 * @returns {string} Status
 */
export function getScoreStatus(score) {
  if (score === null || score === undefined) return 'Sem dados';
  if (score >= 120) return 'Superou';
  if (score >= 100) return 'No alvo';
  if (score >= 80) return 'Em risco';
  return 'Zerado';
}

/**
 * Verifica se um indicador está em risco
 * @param {Object} indicador - Indicador com valor, meta, thresholds
 * @returns {boolean}
 */
export function isIndicatorAtRisk(indicador) {
  const score = getIndicatorScore(indicador);
  return score < 80;
}

/**
 * Calcula progresso percentual em relação à meta
 * @param {number} valor - Valor atual
 * @param {number} meta - Meta
 * @param {boolean} isInverse - Se verdadeiro, valores menores são melhores
 * @returns {number} Progresso (0-100+)
 */
export function calculateProgress(valor, meta, isInverse = false) {
  if (!meta || meta === 0) return 0;

  const v = parseFloat(valor) || 0;
  const m = parseFloat(meta);

  if (isInverse) {
    // Para métricas inversas, 100% significa atingir ou ficar abaixo da meta
    return Math.max(0, (m / v) * 100);
  }

  return (v / m) * 100;
}

/**
 * Agrupa indicadores por categoria
 * @param {Array} indicadores - Array de indicadores
 * @returns {Object} Objeto com categorias como chaves
 */
export function groupIndicatorsByCategory(indicadores) {
  return indicadores.reduce((acc, ind) => {
    const categoria = ind.categoria || 'outros';
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(ind);
    return acc;
  }, {});
}

/**
 * Ordena indicadores por score (piores primeiro)
 * @param {Array} indicadores - Array de indicadores
 * @returns {Array} Array ordenado
 */
export function sortIndicatorsByScore(indicadores, ascending = true) {
  return [...indicadores].sort((a, b) => {
    const scoreA = getIndicatorScore(a);
    const scoreB = getIndicatorScore(b);
    return ascending ? scoreA - scoreB : scoreB - scoreA;
  });
}

/**
 * Filtra indicadores em risco
 * @param {Array} indicadores - Array de indicadores
 * @returns {Array} Indicadores com score < 80
 */
export function filterAtRiskIndicators(indicadores) {
  return indicadores.filter(ind => isIndicatorAtRisk(ind));
}

/**
 * Calcula o progresso de um Key Result considerando metas mensais
 * @param {Object} kr - Key Result com meta, monthly_targets, consolidation_type, is_inverse
 * @param {Array} checkIns - Array de check-ins com { valor, mes, ano }
 * @returns {number} Progresso de 0 a 100
 */
export function calculateKRProgress(kr, checkIns = []) {
  if (!kr) return 0;
  const planejado = kr.planejado_acumulado || 0;
  const realizado = kr.atual || 0;

  // Se planejado é 0 e realizado também é 0, retorna null (não medido)
  // KRs não medidos são ignorados na agregação do objetivo
  if (planejado === 0) return realizado === 0 ? null : 0;

  // Para indicadores inversos (quanto menor, melhor)
  if (kr.is_inverse) {
    if (realizado <= planejado) return 100;
    return Math.min(Math.max(Math.round((planejado / realizado) * 100), 0), 100);
  }

  // Cálculo padrão: realizado / planejado
  return Math.min(Math.max(Math.round((realizado / planejado) * 100), 0), 100);
}

/**
 * Calcula o progresso acumulado planejado e realizado de um indicador
 * @param {Object} indicador - Indicador completo
 * @param {Array} yearCheckIns - Check-ins filtrados do ano
 * @param {number} currentMonth - Mes atual (1-12)
 * @returns {{ planejado: number, realizado: number, scoreAcumulado: number }}
 */
export function calculateAccumulatedProgress(indicador, yearCheckIns, currentMonth) {
  if (!indicador) return { planejado: 0, realizado: 0, scoreAcumulado: null, hasData: false };

  const { start, end } = getCycleMonthRange(indicador.ciclo || 'anual');
  const consolidationType = indicador.consolidation_type || 'last_value';
  const monthlyTargets = indicador.monthly_targets || {};

  // Calcular "Acumulado Planejado" ate o mes atual (ou inicio do ciclo se futuro)
  const mesInicio = parseInt(indicador.mes_inicio) || 1;
  const effectiveMonth = Math.max(currentMonth, start);
  let planejado = 0;
  for (let m = start; m <= Math.min(effectiveMonth, end); m++) {
    if (m < mesInicio) continue;
    const mt = monthlyTargets[m];
    const target = mt != null ? parseFloat(mt) : (parseFloat(indicador.meta) || 0);
    if (consolidationType === 'sum') {
      planejado += target;
    } else {
      // average e last_value: planejado = target do mes mais recente
      planejado = target;
    }
  }

  // Calcular "Acumulado Realizado" baseado no tipo de consolidacao
  const relevantCheckIns = (yearCheckIns || [])
    .filter(ci => ci.mes >= start && ci.mes <= Math.min(currentMonth, end))
    .sort((a, b) => a.mes - b.mes);

  let realizado = 0;
  if (relevantCheckIns.length > 0) {
    const valores = relevantCheckIns.map(ci => parseFloat(ci.valor) || 0);
    if (consolidationType === 'sum') {
      realizado = valores.reduce((sum, v) => sum + v, 0);
    } else if (consolidationType === 'average') {
      realizado = valores.reduce((sum, v) => sum + v, 0) / valores.length;
    } else {
      realizado = valores[valores.length - 1];
    }
  }

  // Score acumulado com thresholds proporcionais
  // Retorna null quando não há check-ins (sem dados) para distinguir de "zerado" (valor 0 real)
  const hasData = relevantCheckIns.length > 0;
  const scoreAcumulado = planejado > 0 && hasData
    ? calculateIndicatorScore(
        realizado,
        planejado * 0.8,
        planejado,
        planejado * 1.2,
        indicador.is_inverse
      )
    : null;

  return { planejado, realizado, scoreAcumulado, hasData };
}

/**
 * Calcula o progresso de um Key Result em relação à meta final
 * @param {Object} kr - Key Result com meta, atual, is_inverse
 * @returns {number|null} Progresso percentual ou null se não medido
 */
export function calculateKRProgressVsMeta(kr) {
  if (!kr) return null;

  const meta = kr.meta || 0;
  const realizado = kr.atual || 0;

  // Se meta é 0 e realizado também é 0, retorna null (não medido)
  if (meta === 0) return realizado === 0 ? null : 0;

  // Para indicadores inversos (quanto menor, melhor)
  if (kr.is_inverse) {
    if (realizado <= meta) return 100;
    return Math.max(Math.round((meta / realizado) * 100), 0);
  }

  // Permite valores > 100% para mostrar superação da meta
  return Math.round((realizado / meta) * 100);
}

/**
 * Parseia o campo acoes de um recovery plan (pode ser JSON string, array ou texto)
 * @param {*} acoes - Campo acoes do recovery plan
 * @returns {Array<{descricao: string, concluida: boolean, prazo?: string, responsavel?: string}>}
 */
export function parseAcoes(acoes) {
  if (!acoes) return [];
  if (Array.isArray(acoes)) return acoes;
  if (typeof acoes === 'string') {
    try {
      const parsed = JSON.parse(acoes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return acoes.split('\n').filter(a => a.trim()).map(a => ({
        descricao: a.trim(),
        concluida: false
      }));
    }
  }
  return [];
}

/**
 * Calcula scores mensais ponderados de uma pessoa para cada mês do ciclo
 * @param {Array} indicadores - Indicadores com check_ins
 * @param {string} ciclo - Ciclo (q1, q2, q3, q4, anual)
 * @param {number} ano - Ano
 * @returns {Array<{month: number, monthName: string, score: number|null, hasData: boolean}>}
 */
export function calculateMonthlyPersonScores(indicadores, ciclo, ano) {
  const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const { start, end } = getCycleMonthRange(ciclo);
  const results = [];

  for (let m = start; m <= end; m++) {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const ind of indicadores) {
      const checkIn = (ind.check_ins || []).find(ci => ci.mes === m && ci.ano === ano);
      if (!checkIn) continue;

      const target = parseFloat(ind.monthly_targets?.[m]) || parseFloat(ind.meta) || 0;
      if (target === 0) continue;

      const t80 = target * 0.8;
      const t120 = target * 1.2;
      const score = calculateIndicatorScore(checkIn.valor, t80, target, t120, ind.is_inverse);
      const peso = ind.peso || 1;
      totalWeight += peso;
      weightedSum += score * peso;
    }

    results.push({
      month: m,
      monthName: monthShort[m - 1],
      score: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null,
      hasData: totalWeight > 0
    });
  }

  return results;
}

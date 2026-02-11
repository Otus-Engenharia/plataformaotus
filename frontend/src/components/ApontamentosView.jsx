/**
 * Componente: Vista de Apontamentos do Projeto
 * 
 * Exibe indicadores e gráficos dos apontamentos de um projeto
 * Dados vêm do BigQuery: dadosindicadores.construflow_data.issues
 * 
 * Design baseado em Storytelling with Data
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { API_URL } from '../api';
import '../styles/ApontamentosView.css';

// Plugin customizado para mostrar totais à direita das barras horizontais (estilo PowerBI)
const totalLabelsPlugin = {
  id: 'totalLabels',
  afterDatasetsDraw: (chart) => {
    // Apenas para gráficos horizontais empilhados
    if (chart.config.type !== 'bar' || chart.config.options.indexAxis !== 'y') {
      return;
    }
    
    try {
      const ctx = chart.ctx;
      const meta = chart.getDatasetMeta(0);
      
      if (!meta || !meta.data || meta.data.length === 0) return;
      
      // Calcula totais por barra
      const totals = [];
      for (let i = 0; i < chart.data.labels.length; i++) {
        let total = 0;
        chart.data.datasets.forEach((ds) => {
          if (ds.data && ds.data[i]) {
            total += ds.data[i];
          }
        });
        totals.push(total);
      }
      
      // Desenha totais à direita de cada barra
      meta.data.forEach((bar, index) => {
        const total = totals[index];
        if (total > 0 && bar && typeof bar.x === 'number' && typeof bar.y === 'number') {
          // Para gráficos horizontais empilhados, pega o último dataset (mais à direita)
          const lastDatasetIndex = chart.data.datasets.length - 1;
          const lastMeta = chart.getDatasetMeta(lastDatasetIndex);
          const lastBar = lastMeta && lastMeta.data ? lastMeta.data[index] : null;
          
          if (lastBar && typeof lastBar.x === 'number') {
            // Posição à direita da barra completa (fim do último segmento)
            const x = lastBar.x + (lastBar.width || 0);
            const y = bar.y;
            
            ctx.save();
            ctx.fillStyle = '#1a1a1a';
            ctx.font = 'bold 12px Inter, Verdana, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(total.toString(), x + 10, y);
            ctx.restore();
          }
        }
      });
    } catch (error) {
      console.warn('Erro ao desenhar totais no gráfico:', error);
    }
  },
};

// Registra componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels,
  totalLabelsPlugin
);

// Mapeamento de traduções
const STATUS_TRANSLATION = {
  'active': 'Ativo',
  'resolved': 'Resolvido',
  'reproved': 'Reprovado',
  'pending': 'Pendente',
  'in_progress': 'Em Progresso',
  'blocked': 'Bloqueado',
  'cancelled': 'Cancelado',
};

const PRIORITY_TRANSLATION = {
  'high': 'Alta',
  'medium': 'Média',
  'low': 'Baixa',
  'alta': 'Alta',
  'média': 'Média',
  'baixa': 'Baixa',
};

// Mapeamento de fases (fallback se não vier do banco)
const PHASE_TRANSLATION = {
  '0': 'Não definida',
  '5': 'Fase 5',
  '6': 'Fase 6',
  '7': 'Fase 7',
  '8': 'Fase 8',
  '9': 'Fase 9',
  '12': 'Fase 12',
};

// Mapeamento de categorias (fallback se não vier do banco)
const CATEGORY_TRANSLATION = {
  '0': 'Não definida',
  '1': 'Categoria 1',
  '2': 'Categoria 2',
  '3': 'Categoria 3',
  '4': 'Categoria 4',
  '5': 'Categoria 5',
  '6': 'Categoria 6',
};

// Ordem padrão das fases (conforme solicitado)
const PHASE_ORDER = [
  'Projeto Legal',
  'Estudo preliminar',
  'Anteprojeto',
  'Pré-executivo',
  'Projeto Executivo',
  'Projeto básico'
];

// Função auxiliar para traduzir status
const translateStatus = (status) => {
  if (!status) return 'Não definido';
  const statusLower = String(status).toLowerCase().trim();
  return STATUS_TRANSLATION[statusLower] || status;
};

// Função auxiliar para traduzir prioridade
const translatePriority = (priority) => {
  if (!priority) return 'Não definida';
  const priorityLower = String(priority).toLowerCase().trim();
  return PRIORITY_TRANSLATION[priorityLower] || priority;
};

// Função auxiliar para traduzir fase (usa o nome do banco se disponível)
const translatePhase = (phase, phaseName) => {
  if (phaseName) return phaseName;
  if (!phase) return 'Não definida';
  const phaseStr = String(phase);
  return PHASE_TRANSLATION[phaseStr] || `Fase ${phaseStr}`;
};

// Função auxiliar para traduzir categoria (usa o nome do banco se disponível)
const translateCategory = (category, categoryName) => {
  if (categoryName) return categoryName;
  if (!category) return 'Não definida';
  const categoryStr = String(category);
  return CATEGORY_TRANSLATION[categoryStr] || `Categoria ${categoryStr}`;
};

// Função para verificar se um apontamento está resolvido
const isResolved = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return statusLower === 'resolved' || 
         statusLower === 'resolvido' || 
         statusLower.includes('resolvido') ||
         statusLower.includes('concluído') ||
         statusLower.includes('concluido');
};

// Função para verificar se um apontamento está reprovado
const isReproved = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  return statusLower === 'reproved' || 
         statusLower === 'reprovado' || 
         statusLower.includes('reprovado');
};

function ApontamentosView({ 
  selectedProjectId, 
  setSelectedProjectId, 
  portfolio = [], 
  lastUpdate,
  setLastUpdate 
}) {
  const [issues, setIssues] = useState([]);
  const [selectedLocal, setSelectedLocal] = useState('');
  const [selectedLocals, setSelectedLocals] = useState([]); // Filtro de múltipla escolha
  const [activeTab, setActiveTab] = useState('operacao'); // Controla a aba ativa: 'operacao', 'resumo' ou 'cliente'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carrega apontamentos quando o projeto é selecionado
  useEffect(() => {
    if (!selectedProjectId) {
      setLoading(false);
      return;
    }

    const project = portfolio.find(p => p.project_code_norm === selectedProjectId);
    if (!project?.construflow_id) {
      setIssues([]);
      setLoading(false);
      return;
    }

    // Reseta o filtro de local ao trocar de projeto
    setSelectedLocal('');

    async function loadIssues() {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/projetos/apontamentos`, {
          params: { construflowId: project.construflow_id },
          withCredentials: true,
        });
        // Processa os dados e garante que arrays sejam arrays
        const allData = response.data.data || [];
        console.log(`[DEBUG] Total de issues recebidos: ${allData.length}`);
        
        // Conta quantos têm nomes
        const withPhaseNames = allData.filter(i => i.creationPhaseName || i.resolutionPhaseName).length;
        const withCategoryNames = allData.filter(i => i.categoryName).length;
        const withDisciplines = allData.filter(i => i.disciplines && i.disciplines.length > 0).length;
        const withLocals = allData.filter(i => i.locals && i.locals.length > 0).length;
        
        console.log(`[DEBUG] Issues com nomes:`, {
          comFase: withPhaseNames,
          comCategoria: withCategoryNames,
          comDisciplinas: withDisciplines,
          comLocais: withLocals,
          total: allData.length
        });
        
        // Log de amostra de issues com disciplinas e locais
        const sampleWithDisciplines = allData.filter(i => i.disciplines && i.disciplines.length > 0).slice(0, 3);
        const sampleWithLocals = allData.filter(i => i.locals && i.locals.length > 0).slice(0, 3);
        
        if (sampleWithDisciplines.length > 0) {
          console.log(`[DEBUG] Amostra de issues com disciplinas:`, sampleWithDisciplines.map(i => ({
            guid: i.guid,
            code: i.code,
            disciplines: i.disciplines
          })));
        } else {
          console.warn(`[DEBUG] Nenhum issue com disciplinas encontrado!`);
        }
        
        if (sampleWithLocals.length > 0) {
          console.log(`[DEBUG] Amostra de issues com locais:`, sampleWithLocals.map(i => ({
            guid: i.guid,
            code: i.code,
            locals: i.locals
          })));
        } else {
          console.warn(`[DEBUG] Nenhum issue com locais encontrado!`);
        }
        
        // Mostra amostra dos primeiros 3 issues
        if (allData.length > 0) {
          console.log('[DEBUG] Amostra dos primeiros 3 issues:', allData.slice(0, 3).map(issue => ({
            guid: issue.guid,
            creationPhase: issue.creationPhase,
            creationPhaseName: issue.creationPhaseName,
            resolutionPhase: issue.resolutionPhase,
            resolutionPhaseName: issue.resolutionPhaseName,
            category: issue.category,
            categoryName: issue.categoryName,
            disciplines: issue.disciplines,
            disciplinesCount: issue.disciplines ? issue.disciplines.length : 0
          })));
        }
        
        const processedData = allData.map(issue => {
          
          return {
            ...issue,
            // Processa locals: pode ser array de objetos { name, abbreviation } ou array de strings
            locals: issue.locals 
              ? (Array.isArray(issue.locals) 
                  ? issue.locals.map(l => typeof l === 'string' ? { name: l, abbreviation: l } : l)
                  : [])
              : (issue.localNames 
                  ? (typeof issue.localNames === 'string' 
                      ? issue.localNames.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, abbreviation: name }))
                      : Array.isArray(issue.localNames) 
                        ? issue.localNames.filter(Boolean).map(name => ({ name, abbreviation: name }))
                        : [{ name: issue.localNames, abbreviation: issue.localNames }])
                  : []),
            // Mantém localNames para compatibilidade
            localNames: issue.locals 
              ? (Array.isArray(issue.locals) 
                  ? issue.locals.map(l => typeof l === 'string' ? l : (l.name || l))
                  : [])
              : (issue.localNames 
                  ? (typeof issue.localNames === 'string' 
                      ? issue.localNames.split(',').map(s => s.trim()).filter(Boolean)
                      : Array.isArray(issue.localNames) 
                        ? issue.localNames.filter(Boolean)
                        : [issue.localNames])
                  : []),
            // Processa disciplinas: agora vem como array de objetos { name, status }
            // Mantém compatibilidade com formato antigo (array de strings)
            disciplines: issue.disciplines 
              ? (Array.isArray(issue.disciplines) 
                  ? issue.disciplines.map(d => {
                      // Se já é objeto { name, status }, retorna como está
                      if (typeof d === 'object' && d !== null && d.name) {
                        return { name: d.name, status: d.status || null };
                      }
                      // Se é string, converte para objeto sem status (considera resolvido)
                      if (typeof d === 'string') {
                        return { name: d, status: null };
                      }
                      return null;
                    }).filter(Boolean)
                  : [])
              : (issue.disciplineNames 
                  ? (typeof issue.disciplineNames === 'string' 
                      ? issue.disciplineNames.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, status: null }))
                      : Array.isArray(issue.disciplineNames) 
                        ? issue.disciplineNames.filter(Boolean).map(name => ({ name, status: null }))
                        : [{ name: issue.disciplineNames, status: null }])
                  : []),
          };
        });
        setIssues(processedData);
        if (setLastUpdate) {
          setLastUpdate(new Date());
        }
      } catch (err) {
        console.error('❌ Erro ao buscar apontamentos:', err);
        console.error('   Response:', err.response?.data);
        console.error('   Status:', err.response?.status);
        console.error('   Message:', err.message);
        
        const errorMessage = err.response?.data?.error || err.message || 'Erro ao carregar apontamentos';
        const errorDetails = err.response?.data?.details;
        const errorCode = err.response?.data?.code;
        
        // Monta mensagem de erro mais detalhada
        let fullErrorMessage = errorMessage;
        if (errorCode) {
          fullErrorMessage += ` [${errorCode}]`;
        }
        if (errorDetails && process.env.NODE_ENV === 'development') {
          fullErrorMessage += `\n\nDetalhes: ${errorDetails}`;
        }
        
        setError(fullErrorMessage);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }

    loadIssues();
  }, [selectedProjectId]);


  // Filtra issues por local(s) se necessário
  const filteredIssues = useMemo(() => {
    // Se houver filtro de múltipla escolha, usa ele
    if (selectedLocals.length > 0) {
      return issues.filter(issue => {
        const issueLocals = issue.locals || [];
        const issueLocalNames = issueLocals.map(l => {
          if (typeof l === 'string') return l;
          return l.name || l;
        });
        return selectedLocals.some(selected => issueLocalNames.includes(selected));
      });
    }
    
    return issues;
  }, [issues, selectedLocals]);

  // Extrai lista de locais únicos para o filtro (com name e abbreviation)
  const uniqueLocals = useMemo(() => {
    const localsMap = new Map();
    issues.forEach(issue => {
      const locals = issue.locals || [];
      locals.forEach(local => {
        const name = typeof local === 'string' ? local : (local.name || local);
        const abbreviation = typeof local === 'string' ? local : (local.abbreviation || local.name || local);
        if (name && !localsMap.has(name)) {
          localsMap.set(name, { name, abbreviation });
        }
      });
    });
    return Array.from(localsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [issues]);

  // Calcula indicadores com lógica corrigida (usa filteredIssues)
  const indicators = useMemo(() => {
    if (!filteredIssues || filteredIssues.length === 0) {
      return {
        total: 0,
        resolvidos: 0,
        ativos: 0,
        ativosAltaPrioridade: 0,
        percentualAltaPrioridade: 0,
        reprovados: 0,
      };
    }

    const resolvidos = filteredIssues.filter(i => isResolved(i.status));
    const ativos = filteredIssues.filter(i => !isResolved(i.status) && !isReproved(i.status));
    const ativosAltaPrioridade = ativos.filter(i => {
      const priority = String(i.priority || '').toLowerCase();
      return priority === 'high' || priority === 'alta';
    });
    const reprovados = filteredIssues.filter(i => isReproved(i.status));

    return {
      total: filteredIssues.length,
      resolvidos: resolvidos.length,
      ativos: ativos.length,
      ativosAltaPrioridade: ativosAltaPrioridade.length,
      percentualAltaPrioridade: ativos.length > 0 
        ? ((ativosAltaPrioridade.length / ativos.length) * 100).toFixed(2)
        : 0,
      reprovados: reprovados.length,
    };
  }, [filteredIssues]);

  // Agrega dados por status (com tradução)
  const statusData = useMemo(() => {
    const statusCounts = {};
    filteredIssues.forEach(issue => {
      const status = issue.status || 'Não definido';
      const statusTranslated = translateStatus(status);
      if (!statusCounts[statusTranslated]) {
        statusCounts[statusTranslated] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      statusCounts[statusTranslated].total++;
      if (isResolved(status)) {
        statusCounts[statusTranslated].resolvidos++;
      } else if (!isReproved(status)) {
        statusCounts[statusTranslated].ativos++;
      }
    });
    return statusCounts;
  }, [filteredIssues]);

  // Agrega dados por prioridade (com tradução)
  const priorityData = useMemo(() => {
    const priorityCounts = {};
    filteredIssues.forEach(issue => {
      const priority = issue.priority || 'Não definida';
      const priorityTranslated = translatePriority(priority);
      if (!priorityCounts[priorityTranslated]) {
        priorityCounts[priorityTranslated] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      priorityCounts[priorityTranslated].total++;
      if (isResolved(issue.status)) {
        priorityCounts[priorityTranslated].resolvidos++;
      } else if (!isReproved(issue.status)) {
        priorityCounts[priorityTranslated].ativos++;
      }
    });
    return priorityCounts;
  }, [filteredIssues]);

  // Agrega dados por fase (usando nomes do banco de dados)
  const phaseData = useMemo(() => {
    const phaseCounts = {};
    let issuesWithPhaseNames = 0;
    let issuesWithoutPhaseNames = 0;
    
    filteredIssues.forEach(issue => {
      // Usa o nome da fase do banco de dados (prioriza creationPhaseName, depois resolutionPhaseName)
      let phaseName = issue.creationPhaseName || issue.resolutionPhaseName;
      let phaseId = issue.creationPhase || issue.resolutionPhase;
      
      // Debug: verifica se os nomes estão chegando
      if (phaseId && (!phaseName || phaseName.trim() === '')) {
        issuesWithoutPhaseNames++;
      } else if (phaseName && phaseName.trim() !== '') {
        issuesWithPhaseNames++;
      }
      
      // Se não tiver nome do banco mas tiver ID, usa o ID como fallback
      // MAS só se realmente não tiver nome (null, undefined, ou string vazia)
      if (!phaseName || (typeof phaseName === 'string' && phaseName.trim() === '')) {
        if (phaseId) {
          // Usa o ID como nome se não tiver nome do banco
          phaseName = `Fase ${phaseId}`;
        } else {
          phaseName = 'Não definida';
        }
      }
      
      // Garante que o nome não seja apenas o ID convertido para string
      if (phaseName === String(phaseId) && phaseId !== null && phaseId !== undefined) {
        phaseName = `Fase ${phaseId}`;
      }
      
      if (!phaseCounts[phaseName]) {
        phaseCounts[phaseName] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      phaseCounts[phaseName].total++;
      if (isResolved(issue.status)) {
        phaseCounts[phaseName].resolvidos++;
      } else if (!isReproved(issue.status)) {
        phaseCounts[phaseName].ativos++;
      }
    });
    
    // Debug: mostra estatísticas e as fases encontradas
    console.log('[DEBUG] Fases - Estatísticas:', {
      issuesComNomes: issuesWithPhaseNames,
      issuesSemNomes: issuesWithoutPhaseNames,
      totalIssues: filteredIssues.length
    });
    console.log('[DEBUG] Fases encontradas:', Object.keys(phaseCounts).map(name => ({
      name,
      total: phaseCounts[name].total,
      resolvidos: phaseCounts[name].resolvidos,
      ativos: phaseCounts[name].ativos
    })));
    
    return phaseCounts;
  }, [filteredIssues]);

  // Agrega dados por categoria (usando nomes do banco de dados)
  const categoryData = useMemo(() => {
    const categoryCounts = {};
    let issuesWithCategoryNames = 0;
    let issuesWithoutCategoryNames = 0;
    
    filteredIssues.forEach(issue => {
      // Usa o nome da categoria do banco de dados
      let categoryName = issue.categoryName;
      let categoryId = issue.category;
      
      // Debug: verifica se os nomes estão chegando
      if (categoryId && (!categoryName || categoryName.trim() === '')) {
        issuesWithoutCategoryNames++;
      } else if (categoryName && categoryName.trim() !== '') {
        issuesWithCategoryNames++;
      }
      
      // Se não tiver nome do banco mas tiver ID, usa o ID como fallback
      // MAS só se realmente não tiver nome (null, undefined, ou string vazia)
      if (!categoryName || (typeof categoryName === 'string' && categoryName.trim() === '')) {
        if (categoryId) {
          // Usa o ID como nome se não tiver nome do banco
          categoryName = `Categoria ${categoryId}`;
        } else {
          categoryName = 'Não definida';
        }
      }
      
      // Garante que o nome não seja apenas o ID convertido para string
      if (categoryName === String(categoryId) && categoryId !== null && categoryId !== undefined) {
        categoryName = `Categoria ${categoryId}`;
      }
      
      if (!categoryCounts[categoryName]) {
        categoryCounts[categoryName] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      categoryCounts[categoryName].total++;
      if (isResolved(issue.status)) {
        categoryCounts[categoryName].resolvidos++;
      } else if (!isReproved(issue.status)) {
        categoryCounts[categoryName].ativos++;
      }
    });
    
    // Debug: mostra estatísticas e as categorias encontradas
    console.log('[DEBUG] Categorias - Estatísticas:', {
      issuesComNomes: issuesWithCategoryNames,
      issuesSemNomes: issuesWithoutCategoryNames,
      totalIssues: filteredIssues.length
    });
    console.log('[DEBUG] Categorias encontradas:', Object.keys(categoryCounts).map(name => ({
      name,
      total: categoryCounts[name].total,
      resolvidos: categoryCounts[name].resolvidos,
      ativos: categoryCounts[name].ativos
    })));
    
    return categoryCounts;
  }, [filteredIssues]);

  // Agrega dados por disciplina (usando status individual de cada disciplina)
  const disciplineData = useMemo(() => {
    const disciplineCounts = {};
    let totalDisciplinesProcessed = 0;
    let totalWithStatus = 0;
    let totalWithoutStatus = 0;
    let issuesWithoutDisciplines = 0;
    
    console.log(`[DEBUG] Processando ${filteredIssues.length} issues para disciplinas...`);
    
    filteredIssues.forEach((issue, index) => {
      // Cada issue pode ter múltiplas disciplinas (array de objetos { name, status })
      const disciplines = issue.disciplines || [];
      
      // Debug dos primeiros 5 issues
      if (index < 5) {
        console.log(`[DEBUG] Issue ${index + 1}:`, {
          guid: issue.guid,
          disciplines: disciplines,
          disciplinesLength: disciplines.length,
          disciplinesType: Array.isArray(disciplines) ? 'array' : typeof disciplines
        });
      }
      
      if (disciplines.length === 0) {
        issuesWithoutDisciplines++;
        // Se não tiver disciplinas, conta como "Não definida"
        const key = 'Não definida';
        if (!disciplineCounts[key]) {
          disciplineCounts[key] = { total: 0, resolvidos: 0, ativos: 0 };
        }
        disciplineCounts[key].total++;
        // Para "Não definida", usa o status do issue principal
        if (isResolved(issue.status)) {
          disciplineCounts[key].resolvidos++;
        } else if (!isReproved(issue.status)) {
          disciplineCounts[key].ativos++;
        }
      } else {
        // Conta cada disciplina individualmente usando seu próprio status
        disciplines.forEach(discipline => {
          if (discipline && discipline.name) {
            const disciplineName = discipline.name;
            if (!disciplineCounts[disciplineName]) {
              disciplineCounts[disciplineName] = { total: 0, resolvidos: 0, ativos: 0 };
            }
            disciplineCounts[disciplineName].total++;
            totalDisciplinesProcessed++;
            
            // Lógica: Se o status NÃO for "todo", considera como resolvido (feito)
            // Se o status for "todo" (ou null/undefined), considera como ativo (devendo)
            const disciplineStatus = discipline.status;
            const statusStr = disciplineStatus ? String(disciplineStatus).trim().toLowerCase() : '';
            
            if (statusStr === '' || statusStr === 'todo') {
              // Sem status ou status = "todo" = ativo (devendo)
              disciplineCounts[disciplineName].ativos++;
              totalWithStatus++;
            } else {
              // Status diferente de "todo" = resolvido (feito)
              disciplineCounts[disciplineName].resolvidos++;
              totalWithoutStatus++;
            }
          } else {
            console.warn('[DEBUG] Disciplina inválida encontrada:', discipline);
          }
        });
      }
    });
    
    // Debug: mostra estatísticas
    console.log('[DEBUG] Disciplinas processadas:', {
      totalIssues: filteredIssues.length,
      issuesSemDisciplinas: issuesWithoutDisciplines,
      totalDisciplinasProcessadas: totalDisciplinesProcessed,
      comStatus: totalWithStatus,
      semStatus: totalWithoutStatus,
      disciplinasUnicas: Object.keys(disciplineCounts).length,
      disciplinas: Object.keys(disciplineCounts).map(name => ({
        name,
        total: disciplineCounts[name].total,
        resolvidos: disciplineCounts[name].resolvidos,
        ativos: disciplineCounts[name].ativos
      }))
    });
    
    return disciplineCounts;
  }, [filteredIssues]);

  // Prepara gráfico de rosca por status (com porcentagens)
  const statusChartData = useMemo(() => {
    // Calcula totais para porcentagens
    const totalResolvidos = Object.values(statusData).reduce((sum, s) => sum + s.resolvidos, 0);
    const totalAtivos = Object.values(statusData).reduce((sum, s) => sum + s.ativos, 0);
    const total = totalResolvidos + totalAtivos;

    const labels = [];
    const data = [];
    const backgroundColors = [];

    // Adiciona Resolvidos
    if (totalResolvidos > 0) {
      labels.push('Resolvidos');
      data.push(totalResolvidos);
      backgroundColors.push('#10b981');
    }

    // Adiciona Ativos
    if (totalAtivos > 0) {
      labels.push('Ativos');
      data.push(totalAtivos);
      backgroundColors.push('#ef4444');
    }

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [statusData]);

  // Prepara gráfico por prioridade (ordenado: Alta, Média, Baixa)
  const priorityChartData = useMemo(() => {
    const labels = Object.keys(priorityData).sort((a, b) => {
      const order = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
      return (order[a] ?? 99) - (order[b] ?? 99);
    });
    const resolvidos = labels.map(l => priorityData[l].resolvidos);
    const ativos = labels.map(l => priorityData[l].ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#10b981',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [priorityData]);

  // Prepara gráfico por fase (usando nomes do banco)
  const phaseChartData = useMemo(() => {
    // Função auxiliar para normalizar e comparar nomes (case-insensitive)
    const normalizePhaseName = (name) => name.toLowerCase().trim();
    const findPhaseIndex = (phaseName) => {
      const normalized = normalizePhaseName(phaseName);
      return PHASE_ORDER.findIndex(orderName => 
        normalizePhaseName(orderName) === normalized
      );
    };
    
    // Ordena as fases conforme ordem padrão definida
    const labels = Object.keys(phaseData).sort((a, b) => {
      // "Não definida" sempre por último
      const aNormalized = normalizePhaseName(a);
      const bNormalized = normalizePhaseName(b);
      if (aNormalized === 'não definida') return 1;
      if (bNormalized === 'não definida') return -1;
      
      // Busca índices na ordem padrão (case-insensitive)
      const indexA = findPhaseIndex(a);
      const indexB = findPhaseIndex(b);
      
      // Se ambas estão na ordem padrão, ordena por índice
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // Se apenas A está na ordem padrão, A vem primeiro
      if (indexA !== -1) return -1;
      
      // Se apenas B está na ordem padrão, B vem primeiro
      if (indexB !== -1) return 1;
      
      // Se nenhuma está na ordem padrão, ordena alfabeticamente
      return a.localeCompare(b, 'pt-BR');
    });
    
    const resolvidos = labels.map(l => phaseData[l].resolvidos);
    const ativos = labels.map(l => phaseData[l].ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#10b981',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [phaseData]);

  // Prepara gráfico por disciplina (sem limite, ordenado por total)
  const disciplineChartData = useMemo(() => {
    const entries = Object.entries(disciplineData)
      .sort((a, b) => (b[1].total) - (a[1].total));
    
    const labels = entries.map(([label]) => label);
    const resolvidos = entries.map(([, data]) => data.resolvidos);
    const ativos = entries.map(([, data]) => data.ativos);

    // Debug: verifica se há valores de resolvidos
    const hasResolvidos = resolvidos.some(v => v > 0);
    console.log('[DEBUG] Gráfico de Disciplinas:', {
      totalDisciplinas: labels.length,
      temResolvidos: hasResolvidos,
      totalResolvidos: resolvidos.reduce((a, b) => a + b, 0),
      totalAtivos: ativos.reduce((a, b) => a + b, 0),
      amostra: entries.slice(0, 5).map(([name, data]) => ({
        name,
        resolvidos: data.resolvidos,
        ativos: data.ativos,
        total: data.total
      }))
    });

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#10b981',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [disciplineData]);

  // Prepara gráfico por categoria (sem limite, ordenado por total)
  const categoryChartData = useMemo(() => {
    const entries = Object.entries(categoryData)
      .sort((a, b) => (b[1].total) - (a[1].total));
    
    const labels = entries.map(([label]) => label);
    const resolvidos = entries.map(([, data]) => data.resolvidos);
    const ativos = entries.map(([, data]) => data.ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#10b981',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [categoryData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Remove legenda de todos os gráficos
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          size: 12,
          weight: 'bold',
        },
        anchor: 'center',
        align: 'center',
        formatter: (value) => value > 0 ? value : '',
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
  };

  // Opções específicas para o gráfico de pizza de status
  const statusPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // Garante que não há buraco no meio (cutout: 0 para pizza completa)
    cutout: 0,
    plugins: {
      legend: {
        display: false, // Remove legenda do gráfico de pizza
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          size: 16,
          weight: 'bold',
        },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
          return `${percentage}%`;
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(2) : '0.00';
            const label = context.label.replace(/ \(.*?\)/g, '');
            return `${label}: ${context.parsed} (${percentage}%)`;
          },
        },
      },
    },
  };

  const horizontalChartOptions = {
    ...chartOptions,
    indexAxis: 'y',
    plugins: {
      ...chartOptions.plugins,
      datalabels: {
        display: function(context) {
          // Mostra apenas se o valor for maior que 0
          return context.dataset.data[context.dataIndex] > 0;
        },
        color: '#ffffff',
        font: {
          size: 12,
          weight: 'bold',
        },
        anchor: 'center',
        align: 'center',
        formatter: (value) => value > 0 ? value : '',
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        stacked: true,
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
  };


  // Busca o projeto selecionado do portfólio
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  // Extrai as disciplinas do cliente do projeto selecionado
  const clientDisciplines = useMemo(() => {
    if (!selectedProject || !selectedProject.disciplina_cliente) return [];
    
    // disciplina_cliente é uma STRING, pode ser separada por vírgula ou ser uma única disciplina
    const disciplinaCliente = String(selectedProject.disciplina_cliente).trim();
    if (!disciplinaCliente) return [];
    
    // Divide por vírgula e limpa espaços
    return disciplinaCliente
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0)
      .map(d => d.toLowerCase()); // Normaliza para comparação case-insensitive
  }, [selectedProject]);

  // Filtra apontamentos com disciplinas do cliente em aberto (status = 'todo')
  const clientOpenIssues = useMemo(() => {
    if (clientDisciplines.length === 0) return [];
    
    // Debug: log das disciplinas do cliente
    console.log('[DEBUG] Disciplinas do cliente:', clientDisciplines);
    console.log('[DEBUG] Total de issues filtrados:', filteredIssues.length);
    
    const result = filteredIssues.filter(issue => {
      // Verifica se o apontamento tem disciplinas
      if (!issue.disciplines || !Array.isArray(issue.disciplines) || issue.disciplines.length === 0) {
        return false;
      }
      
      // Verifica se alguma disciplina do apontamento corresponde às disciplinas do cliente
      // E se essa disciplina está com status = 'todo' (em aberto)
      return issue.disciplines.some(discipline => {
        const disciplineName = String(discipline.name || '').trim().toLowerCase();
        const disciplineStatus = String(discipline.status || '').trim().toLowerCase();
        
        // Verifica se a disciplina corresponde a uma das disciplinas do cliente
        // Comparação case-insensitive e permite correspondência parcial
        const matchesClientDiscipline = clientDisciplines.some(clientDisc => {
          const normalizedClientDisc = clientDisc.toLowerCase().trim();
          const normalizedDisciplineName = disciplineName.toLowerCase().trim();
          
          // Comparação exata ou parcial (um contém o outro)
          const matches = normalizedDisciplineName === normalizedClientDisc || 
                 normalizedDisciplineName.includes(normalizedClientDisc) || 
                 normalizedClientDisc.includes(normalizedDisciplineName);
          
          if (matches) {
            console.log('[DEBUG] Match encontrado:', {
              clientDisc: normalizedClientDisc,
              disciplineName: normalizedDisciplineName,
              disciplineStatus: disciplineStatus,
              issueCode: issue.code
            });
          }
          
          return matches;
        });
        
        // Verifica se está em aberto (status = 'todo' ou vazio/null)
        const isOpen = disciplineStatus === 'todo' || disciplineStatus === '' || !discipline.status;
        
        return matchesClientDiscipline && isOpen;
      });
    });
    
    console.log('[DEBUG] Apontamentos do cliente encontrados:', result.length);
    return result;
  }, [filteredIssues, clientDisciplines]);

  return (
    <div className="apontamentos-container">

      {loading && (
        <div className="apontamentos-loading">Carregando apontamentos...</div>
      )}

      {error && (
        <div className="apontamentos-error">Erro: {error}</div>
      )}

      {!loading && !error && issues.length === 0 && selectedProjectId && (
        <div className="apontamentos-empty">Nenhum apontamento encontrado para este projeto.</div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          {/* Filtro por local - Múltipla escolha */}
          {uniqueLocals.length > 0 && (
            <div className="apontamentos-filters">
              <label className="apontamentos-filter-label">
                Filtrar por Local:
              </label>
              <div className="apontamentos-filter-multiselect">
                {uniqueLocals.map(local => {
                  const isSelected = selectedLocals.includes(local.name);
                  return (
                    <button
                      key={local.name}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedLocals(selectedLocals.filter(l => l !== local.name));
                        } else {
                          setSelectedLocals([...selectedLocals, local.name]);
                        }
                      }}
                      className={`apontamentos-filter-multiselect-btn ${isSelected ? 'active' : ''}`}
                    >
                      {local.abbreviation || local.name}
                    </button>
                  );
                })}
                {selectedLocals.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedLocals([])}
                    className="apontamentos-filter-clear-btn"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {selectedLocals.length > 0 && (
                <span className="apontamentos-filter-info">
                  Mostrando {filteredIssues.length} de {issues.length} apontamentos
                </span>
              )}
            </div>
          )}

          {/* Abas: Operação, Resumo dos Apontamentos e Apontamentos do Cliente */}
          {filteredIssues.length > 0 && (
            <div className="apontamentos-tabs-container">
              {/* Cabeçalho das abas */}
              <div className="apontamentos-tabs-header">
                <button
                  type="button"
                  onClick={() => setActiveTab('operacao')}
                  className={`apontamentos-tab ${activeTab === 'operacao' ? 'active' : ''}`}
                >
                  Operação
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('resumo')}
                  className={`apontamentos-tab ${activeTab === 'resumo' ? 'active' : ''}`}
                >
                  Resumo dos Apontamentos
                </button>
                {clientDisciplines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('cliente')}
                    className={`apontamentos-tab ${activeTab === 'cliente' ? 'active' : ''}`}
                  >
                    Apontamentos do Cliente em Aberto
                  </button>
                )}
              </div>

              {/* Conteúdo das abas */}
              <div className="apontamentos-tabs-content">
                {activeTab === 'operacao' && (
                  <OperacaoSection
                    issues={filteredIssues}
                    projectId={selectedProjectId}
                  />
                )}
                {activeTab === 'resumo' && (
                  <ApontamentosSection
                    title=""
                    issues={filteredIssues}
                    projectId={selectedProjectId}
                  />
                )}
                {activeTab === 'cliente' && clientDisciplines.length > 0 && (
                  <ClientOpenIssuesTable 
                    issues={clientOpenIssues}
                    clientDisciplines={clientDisciplines}
                    projectId={selectedProjectId}
                  />
                )}
              </div>
            </div>
          )}

          {filteredIssues.length === 0 && (
            <div className="apontamentos-empty">
              Nenhum apontamento encontrado para o local selecionado.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Componente reutilizável para seção de apontamentos
function ApontamentosSection({ title, issues, projectId }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Calcula indicadores para esta seção
  const indicators = useMemo(() => {
    const total = issues.length;
    const resolvidos = issues.filter(i => isResolved(i.status)).length;
    const ativos = issues.filter(i => !isResolved(i.status) && !isReproved(i.status)).length;
    const ativosAltaPrioridade = issues.filter(i => 
      !isResolved(i.status) && 
      !isReproved(i.status) && 
      String(i.priority).toLowerCase() === 'alta'
    ).length;
    const reprovados = issues.filter(i => isReproved(i.status)).length;
    const percentualAltaPrioridade = ativos > 0 
      ? ((ativosAltaPrioridade / ativos) * 100).toFixed(2)
      : '0.00';

    return {
      total,
      resolvidos,
      ativos,
      ativosAltaPrioridade,
      reprovados,
      percentualAltaPrioridade
    };
  }, [issues]);

  // Filtra issues por local se necessário (reutiliza a lógica existente)
  // Por enquanto, vamos usar os issues já filtrados que foram passados

  // Agrega dados por status
  const statusData = useMemo(() => {
    const statusCounts = {};
    issues.forEach(issue => {
      const status = translateStatus(issue.status);
      if (!statusCounts[status]) {
        statusCounts[status] = 0;
      }
      statusCounts[status]++;
    });
    return statusCounts;
  }, [issues]);

  // Prepara gráfico de status (pizza)
  const statusChartData = useMemo(() => {
    const resolvidos = indicators.resolvidos;
    const ativos = indicators.ativos;
    const total = resolvidos + ativos;

    if (total === 0) {
      return {
        labels: ['Sem dados'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e5e7eb'],
        }],
      };
    }

    return {
      labels: ['Resolvidos', 'Ativos'],
      datasets: [{
        data: [resolvidos, ativos],
        backgroundColor: ['#22c55e', '#ef4444'],
      }],
    };
  }, [indicators]);

  // Agrega dados por prioridade
  const priorityData = useMemo(() => {
    const priorityCounts = {};
    issues.forEach(issue => {
      const priority = translatePriority(issue.priority);
      if (!priorityCounts[priority]) {
        priorityCounts[priority] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      priorityCounts[priority].total++;
      if (isResolved(issue.status)) {
        priorityCounts[priority].resolvidos++;
      } else if (!isReproved(issue.status)) {
        priorityCounts[priority].ativos++;
      }
    });
    return priorityCounts;
  }, [issues]);

  // Prepara gráfico por prioridade
  const priorityChartData = useMemo(() => {
    const labels = Object.keys(priorityData).sort((a, b) => {
      const order = { 'Alta': 0, 'Média': 1, 'Baixa': 2, 'Não definida': 3 };
      return (order[a] ?? 999) - (order[b] ?? 999);
    });
    
    const resolvidos = labels.map(l => priorityData[l].resolvidos);
    const ativos = labels.map(l => priorityData[l].ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#22c55e',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [priorityData]);

  // Agrega dados por fase
  const phaseData = useMemo(() => {
    const phaseCounts = {};
    issues.forEach(issue => {
      let phaseName = issue.creationPhaseName || issue.resolutionPhaseName;
      let phaseId = issue.creationPhase || issue.resolutionPhase;
      
      if (!phaseName || (typeof phaseName === 'string' && phaseName.trim() === '')) {
        if (phaseId) {
          phaseName = `Fase ${phaseId}`;
        } else {
          phaseName = 'Não definida';
        }
      }
      
      if (phaseName === String(phaseId) && phaseId !== null && phaseId !== undefined) {
        phaseName = `Fase ${phaseId}`;
      }
      
      if (!phaseCounts[phaseName]) {
        phaseCounts[phaseName] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      phaseCounts[phaseName].total++;
      if (isResolved(issue.status)) {
        phaseCounts[phaseName].resolvidos++;
      } else if (!isReproved(issue.status)) {
        phaseCounts[phaseName].ativos++;
      }
    });
    return phaseCounts;
  }, [issues]);

  // Prepara gráfico por fase
  const phaseChartData = useMemo(() => {
    const normalizePhaseName = (name) => name.toLowerCase().trim();
    const findPhaseIndex = (phaseName) => {
      const normalized = normalizePhaseName(phaseName);
      return PHASE_ORDER.findIndex(orderName => 
        normalizePhaseName(orderName) === normalized
      );
    };
    
    const labels = Object.keys(phaseData).sort((a, b) => {
      const aNormalized = normalizePhaseName(a);
      const bNormalized = normalizePhaseName(b);
      if (aNormalized === 'não definida') return 1;
      if (bNormalized === 'não definida') return -1;
      
      const indexA = findPhaseIndex(a);
      const indexB = findPhaseIndex(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      return a.localeCompare(b, 'pt-BR');
    });
    
    const resolvidos = labels.map(l => phaseData[l].resolvidos);
    const ativos = labels.map(l => phaseData[l].ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#22c55e',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [phaseData]);

  // Agrega dados por categoria
  const categoryData = useMemo(() => {
    const categoryCounts = {};
    issues.forEach(issue => {
      let categoryName = issue.categoryName;
      let categoryId = issue.category;
      
      if (!categoryName || (typeof categoryName === 'string' && categoryName.trim() === '')) {
        if (categoryId) {
          categoryName = `Categoria ${categoryId}`;
        } else {
          categoryName = 'Não definida';
        }
      }
      
      if (categoryName === String(categoryId) && categoryId !== null && categoryId !== undefined) {
        categoryName = `Categoria ${categoryId}`;
      }
      
      if (!categoryCounts[categoryName]) {
        categoryCounts[categoryName] = { total: 0, resolvidos: 0, ativos: 0 };
      }
      categoryCounts[categoryName].total++;
      if (isResolved(issue.status)) {
        categoryCounts[categoryName].resolvidos++;
      } else if (!isReproved(issue.status)) {
        categoryCounts[categoryName].ativos++;
      }
    });
    return categoryCounts;
  }, [issues]);

  // Prepara gráfico por categoria
  const categoryChartData = useMemo(() => {
    const labels = Object.keys(categoryData)
      .sort((a, b) => categoryData[b].total - categoryData[a].total);
    
    const resolvidos = labels.map(l => categoryData[l].resolvidos);
    const ativos = labels.map(l => categoryData[l].ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#22c55e',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [categoryData]);

  // Agrega dados por disciplina
  const disciplineData = useMemo(() => {
    const disciplineCounts = {};
    issues.forEach(issue => {
      if (issue.disciplines && Array.isArray(issue.disciplines)) {
        issue.disciplines.forEach(discipline => {
          const name = discipline.name || 'Não definida';
          const statusStr = String(discipline.status || '').toLowerCase().trim();
          
          if (!disciplineCounts[name]) {
            disciplineCounts[name] = { total: 0, resolvidos: 0, ativos: 0 };
          }
          
          disciplineCounts[name].total++;
          if (statusStr === '' || statusStr === 'todo') {
            disciplineCounts[name].ativos++;
          } else {
            disciplineCounts[name].resolvidos++;
          }
        });
      }
    });
    return disciplineCounts;
  }, [issues]);

  // Prepara gráfico por disciplina
  const disciplineChartData = useMemo(() => {
    const entries = Object.entries(disciplineData)
      .sort((a, b) => (b[1].total) - (a[1].total));
    
    const labels = entries.map(([name]) => name);
    const resolvidos = entries.map(([, data]) => data.resolvidos);
    const ativos = entries.map(([, data]) => data.ativos);

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#22c55e',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
      ],
    };
  }, [disciplineData]);

  // Agrupa issues por local para o gráfico de barras
  const issuesByLocal = useMemo(() => {
    const grouped = {};
    
    issues.forEach(issue => {
      const locals = issue.locals || [];
      if (locals.length === 0) {
        const noLocal = 'Sem Local';
        if (!grouped[noLocal]) {
          grouped[noLocal] = { abbreviation: 'SL', issues: [] };
        }
        grouped[noLocal].issues.push(issue);
      } else {
        locals.forEach(local => {
          const localName = typeof local === 'string' ? local : (local.name || local);
          const localAbbreviation = typeof local === 'string' ? local : (local.abbreviation || local.name || local);
          
          if (!grouped[localName]) {
            grouped[localName] = { abbreviation: localAbbreviation, issues: [] };
          }
          grouped[localName].issues.push(issue);
        });
      }
    });
    
    return grouped;
  }, [issues]);

  // Prepara gráfico de barras por local
  const localsChartData = useMemo(() => {
    const entries = Object.entries(issuesByLocal)
      .sort((a, b) => b[1].issues.length - a[1].issues.length);
    
    const labels = entries.map(([name, data]) => data.abbreviation || name);
    const totals = entries.map(([, data]) => data.issues.length);
    const resolvidos = entries.map(([, data]) => 
      data.issues.filter(i => isResolved(i.status)).length
    );
    const ativos = entries.map(([, data]) => 
      data.issues.filter(i => !isResolved(i.status) && !isReproved(i.status)).length
    );
    const reprovados = entries.map(([, data]) => 
      data.issues.filter(i => isReproved(i.status)).length
    );

    return {
      labels,
      datasets: [
        {
          label: 'Resolvidos',
          data: resolvidos,
          backgroundColor: '#10b981',
        },
        {
          label: 'Ativos',
          data: ativos,
          backgroundColor: '#ef4444',
        },
        {
          label: 'Reprovados',
          data: reprovados,
          backgroundColor: '#f59e0b',
        },
      ],
    };
  }, [issuesByLocal]);

  // Opções do gráfico de pizza
  const statusPieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          size: 12,
          weight: 'bold',
        },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          if (total === 0) return '';
          const percentage = ((value / total) * 100).toFixed(1);
          return percentage > 0 ? `${percentage}%` : '';
        },
      },
    },
    cutout: 0,
  };

  // Opções para gráficos de barras horizontais
  const horizontalChartOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          size: 12,
          weight: 'bold',
        },
        anchor: 'center',
        align: 'center',
        formatter: (value) => value > 0 ? value : '',
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
      },
      y: {
        stacked: true,
      },
    },
  };

  return (
    <div className="apontamentos-section">
      {title && (
        <h1 
          className="apontamentos-section-title apontamentos-section-title-collapsible"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ marginRight: '0.5rem' }}>
            {isCollapsed ? '▶' : '▼'}
          </span>
          {title}
        </h1>
      )}
      
      {(!title || !isCollapsed) && (
        <>
          {/* Cards de indicadores */}
      <div className="apontamentos-cards">
        <div className="apontamentos-card">
          <div className="apontamentos-card-label">Total</div>
          <div className="apontamentos-card-value">{indicators.total}</div>
          <div className="apontamentos-card-sublabel">Apontamentos</div>
        </div>
        
        <div className="apontamentos-card">
          <div className="apontamentos-card-label">Resolvidos</div>
          <div className="apontamentos-card-value">{indicators.resolvidos}</div>
          <div className="apontamentos-card-sublabel">
            {indicators.total > 0 
              ? `${((indicators.resolvidos / indicators.total) * 100).toFixed(1)}% do total`
              : '0% do total'}
          </div>
        </div>
        
        <div className="apontamentos-card">
          <div className="apontamentos-card-label">Ativos</div>
          <div className="apontamentos-card-value">{indicators.ativos}</div>
          <div className="apontamentos-card-sublabel">
            {indicators.total > 0 
              ? `${((indicators.ativos / indicators.total) * 100).toFixed(1)}% do total`
              : '0% do total'}
          </div>
        </div>
        
        <div className="apontamentos-card">
          <div className="apontamentos-card-label">Alta Prioridade</div>
          <div className="apontamentos-card-value">{indicators.ativosAltaPrioridade}</div>
          <div className="apontamentos-card-sublabel">
            {indicators.percentualAltaPrioridade}% dos ativos
          </div>
        </div>
        
        <div className="apontamentos-card">
          <div className="apontamentos-card-label">Reprovados</div>
          <div className="apontamentos-card-value">{indicators.reprovados}</div>
          <div className="apontamentos-card-sublabel">Apontamentos</div>
        </div>
      </div>

      {/* Legenda */}
      <div className="apontamentos-legend">
        <span className="apontamentos-legend-item">
          <span className="apontamentos-legend-color apontamentos-legend-success"></span>
          Apontamentos Resolvidos
        </span>
        <span className="apontamentos-legend-item">
          <span className="apontamentos-legend-color apontamentos-legend-danger"></span>
          Apontamentos Ativos
        </span>
      </div>

      {/* Gráficos */}
      <div className="apontamentos-charts">
        {/* Primeira linha: Status (pizza) e Prioridade lado a lado */}
        <div className="apontamentos-chart-container apontamentos-chart-pie">
          <h3>Apontamentos por Status</h3>
          <div className="apontamentos-chart apontamentos-chart-small">
            <Pie data={statusChartData} options={statusPieOptions} />
          </div>
        </div>

        <div className="apontamentos-chart-container">
          <h3>Apontamentos por Prioridade</h3>
          <div className="apontamentos-chart">
            <Bar data={priorityChartData} options={horizontalChartOptions} />
          </div>
        </div>

        {/* Segunda linha: Fase e Categorias lado a lado */}
        <div className="apontamentos-chart-container">
          <h3>Apontamentos por Fase</h3>
          <div className="apontamentos-chart">
            <Bar data={phaseChartData} options={horizontalChartOptions} />
          </div>
        </div>

        <div className="apontamentos-chart-container apontamentos-chart-scrollable">
          <h3>Apontamentos por Categorias</h3>
          <div className="apontamentos-chart-wrapper">
            <div className="apontamentos-chart" style={{ minHeight: `${Math.max(280, categoryChartData.labels.length * 35)}px` }}>
              <Bar data={categoryChartData} options={horizontalChartOptions} />
            </div>
          </div>
        </div>

        {/* Terceira linha: Disciplinas (full width) */}
        <div className="apontamentos-chart-container apontamentos-chart-full apontamentos-chart-scrollable">
          <h3>Apontamentos por Disciplinas</h3>
          <div className="apontamentos-chart-wrapper">
            <div className="apontamentos-chart" style={{ minHeight: `${Math.max(400, disciplineChartData.labels.length * 35)}px` }}>
              <Bar data={disciplineChartData} options={horizontalChartOptions} />
            </div>
          </div>
        </div>

        {/* Quarta linha: Locais (full width) */}
        {Object.keys(issuesByLocal).length > 0 && (
          <div className="apontamentos-chart-container apontamentos-chart-full apontamentos-chart-scrollable">
            <h3>Apontamentos por Local</h3>
            <div className="apontamentos-chart-wrapper">
              <div className="apontamentos-chart" style={{ minHeight: `${Math.max(400, localsChartData.labels.length * 35)}px` }}>
                <Bar 
                  data={localsChartData} 
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top',
                      },
                      datalabels: {
                        display: true,
                        color: '#ffffff',
                        font: {
                          size: 11,
                          weight: 'bold',
                        },
                        anchor: 'center',
                        align: 'center',
                        formatter: (value) => value > 0 ? value : '',
                      },
                    },
                    scales: {
                      x: {
                        stacked: true,
                        beginAtZero: true,
                      },
                      y: {
                        stacked: true,
                      },
                    },
                  }} 
                />
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

// Componente: Seção de Operação
function OperacaoSection({ issues, projectId }) {
  const [priorityFilter, setPriorityFilter] = useState(''); // Filtro por prioridade
  const [selectedDisciplines, setSelectedDisciplines] = useState([]); // Filtro de múltipla escolha por disciplina
  const [isDisciplinesPopupOpen, setIsDisciplinesPopupOpen] = useState(false); // Controla abertura do pop-up

  // Função para encontrar a maior data entre todas as datas de atualização (reutilizada)
  const getLatestUpdate = (issue) => {
    const dates = [];
    
    if (issue.editedAt) {
      dates.push({ date: new Date(issue.editedAt), type: 'Edição' });
    }
    if (issue.statusUpdatedAt) {
      dates.push({ date: new Date(issue.statusUpdatedAt), type: 'Atualização de Status' });
    }
    if (issue.updatedAt) {
      dates.push({ date: new Date(issue.updatedAt), type: 'Atualização Geral' });
    }
    if (issue.visibilityUpdatedAt) {
      dates.push({ date: new Date(issue.visibilityUpdatedAt), type: 'Mudança de Visibilidade' });
    }
    if (issue.lastCommentDate) {
      dates.push({ date: new Date(issue.lastCommentDate), type: 'Último Comentário' });
    }
    if (issue.createdAt) {
      dates.push({ date: new Date(issue.createdAt), type: 'Criação' });
    }
    
    if (dates.length === 0) {
      return { date: null, type: 'N/A' };
    }
    
    const latest = dates.reduce((max, current) => {
      return current.date > max.date ? current : max;
    });
    
    return latest;
  };

  // Calcula tempo de resolução para apontamentos resolvidos (com código)
  const resolutionTimes = useMemo(() => {
    const resolved = issues.filter(issue => isResolved(issue.status));
    return resolved.map(issue => {
      const createdAt = issue.createdAt ? new Date(issue.createdAt) : null;
      const resolvedAt = issue.statusUpdatedAt ? new Date(issue.statusUpdatedAt) : 
                        (issue.resolutionPhase ? new Date(issue.resolutionPhase) : null);
      
      if (createdAt && resolvedAt) {
        const diffMs = resolvedAt - createdAt;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return { days: diffDays, code: issue.code || 'N/A', issue };
      }
      return null;
    }).filter(item => item !== null);
  }, [issues]);

  // Indicadores de operação
  const operacaoIndicators = useMemo(() => {
    // Total de apontamentos
    const total = issues.length;
    
    // Apontamentos ativos
    const ativos = issues.filter(issue => !isResolved(issue.status) && !isReproved(issue.status)).length;
    const percentualAtivos = total > 0 ? ((ativos / total) * 100).toFixed(1) : '0.0';
    
    // Tempo médio de resolução
    const avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, item) => sum + item.days, 0) / resolutionTimes.length
      : 0;

    // Tempo máximo de resolução (com código)
    const maxResolutionItem = resolutionTimes.length > 0
      ? resolutionTimes.reduce((max, item) => item.days > max.days ? item : max, resolutionTimes[0])
      : null;
    const maxResolutionTime = maxResolutionItem ? maxResolutionItem.days : 0;
    const maxResolutionCode = maxResolutionItem ? maxResolutionItem.code : 'N/A';

    // Apontamentos para coordenação (onde coordenação está com status = 'todo')
    const paraCoordenacao = issues.filter(issue => {
      const isActive = !isResolved(issue.status) && !isReproved(issue.status);
      if (!isActive) return false;
      
      // Verifica se tem disciplina "coordenação" com status = 'todo'
      if (!issue.disciplines || !Array.isArray(issue.disciplines)) return false;
      
      return issue.disciplines.some(discipline => {
        const disciplineName = String(discipline.name || '').toLowerCase().trim();
        const disciplineStatus = String(discipline.status || '').toLowerCase().trim();
        const isCoordenacao = disciplineName.includes('coordenação') || disciplineName.includes('coordenacao');
        const isTodo = disciplineStatus === 'todo' || disciplineStatus === '';
        return isCoordenacao && isTodo;
      });
    }).length;

    return {
      total,
      ativos,
      percentualAtivos,
      tempoMedioResolucao: avgResolutionTime,
      tempoMaximoResolucao: maxResolutionTime,
      tempoMaximoCodigo: maxResolutionCode,
      paraCoordenacao
    };
  }, [issues, resolutionTimes]);

  // Apontamentos antigos (>45 dias sem atualização) - ordenados por tempo desde última atualização
  const apontamentosAntigosBase = useMemo(() => {
    const agora = new Date();

    const filtered = issues.filter(issue => {
      // Apenas apontamentos ativos/abertos (igual aos indicadores)
      const isActive = !isResolved(issue.status) && !isReproved(issue.status);
      if (!isActive) return false;

      // Verifica última atualização
      const latest = getLatestUpdate(issue);
      if (!latest.date) return false;

      const diasDesdeAtualizacao = (agora - latest.date) / (1000 * 60 * 60 * 24);
      return diasDesdeAtualizacao > 45;
    });

    // Ordena por tempo desde última atualização (mais antigos primeiro)
    return filtered.sort((a, b) => {
      const latestA = getLatestUpdate(a);
      const latestB = getLatestUpdate(b);
      
      if (!latestA.date || !latestB.date) return 0;
      
      return latestA.date - latestB.date; // Mais antigos primeiro
    });
  }, [issues]);

  // Extrai lista de disciplinas únicas dos apontamentos antigos (apenas com status = todo)
  const uniqueDisciplines = useMemo(() => {
    const disciplinesSet = new Set();
    apontamentosAntigosBase.forEach(issue => {
      const disciplinasTodo = (issue.disciplines || [])
        .filter(d => !d.status || d.status === 'todo' || d.status === '')
        .map(d => d.name)
        .filter(Boolean);
      disciplinasTodo.forEach(discipline => {
        if (discipline) disciplinesSet.add(discipline);
      });
    });
    return Array.from(disciplinesSet).sort();
  }, [apontamentosAntigosBase]);

  // Aplica filtros aos apontamentos antigos
  const apontamentosAntigos = useMemo(() => {
    let filtered = apontamentosAntigosBase;

    // Filtro por prioridade
    if (priorityFilter && priorityFilter !== '') {
      filtered = filtered.filter(issue => {
        const priority = translatePriority(issue.priority);
        // Normaliza para comparação (remove acentos e converte para minúsculo)
        const priorityNormalized = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const filterNormalized = priorityFilter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Compara as versões normalizadas
        const matches = priorityNormalized === filterNormalized;
        console.log('[DEBUG Filtro]', {
          priorityOriginal: issue.priority,
          priorityTranslated: priority,
          priorityNormalized,
          filterValue: priorityFilter,
          filterNormalized,
          matches
        });
        return matches;
      });
    }

    // Filtro por disciplinas (múltipla escolha)
    if (selectedDisciplines.length > 0) {
      filtered = filtered.filter(issue => {
        const disciplinasTodo = (issue.disciplines || [])
          .filter(d => !d.status || d.status === 'todo' || d.status === '')
          .map(d => d.name)
          .filter(Boolean);
        return selectedDisciplines.some(selected => disciplinasTodo.includes(selected));
      });
    }

    return filtered;
  }, [apontamentosAntigosBase, priorityFilter, selectedDisciplines]);

  // Calcula porcentagem de antigos em relação aos ativos
  const percentualAntigos = useMemo(() => {
    const ativos = operacaoIndicators.ativos;
    const antigos = apontamentosAntigos.length;
    return ativos > 0 ? ((antigos / ativos) * 100).toFixed(1) : '0.0';
  }, [operacaoIndicators.ativos, apontamentosAntigos.length]);

  // Função para formatar tempo em dias
  const formatDays = (days) => {
    if (days < 1) {
      const hours = Math.floor(days * 24);
      return `${hours}h`;
    }
    return `${Math.round(days)} ${Math.round(days) === 1 ? 'dia' : 'dias'}`;
  };

  // Função para calcular tempo desde última atualização
  const getTimeSinceUpdate = (issue) => {
    const latest = getLatestUpdate(issue);
    if (!latest.date) return 'Data não disponível';

    const now = new Date();
    const diffMs = now - latest.date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    } else {
      return 'Agora';
    }
  };

  // Função para gerar link do apontamento
  const getIssueLink = (issue) => {
    if (!projectId || !issue.id) return '#';
    return `https://app.construflow.com.br/workspace/project/${projectId}/issues?issueId=${issue.id}`;
  };

  return (
    <div className="apontamentos-section">
      {/* Título removido - agora está na aba */}
      {/* Cards de indicadores */}
      <div className="apontamentos-cards">
            <div className="apontamentos-card">
              <div className="apontamentos-card-label">Ativos</div>
              <div className="apontamentos-card-value">{operacaoIndicators.ativos}</div>
              <div className="apontamentos-card-sublabel">{operacaoIndicators.percentualAtivos}% do total</div>
            </div>
            
            <div className="apontamentos-card">
              <div className="apontamentos-card-label">Tempo Médio</div>
              <div className="apontamentos-card-value">
                {formatDays(operacaoIndicators.tempoMedioResolucao)}
              </div>
              <div className="apontamentos-card-sublabel">de Resolução</div>
            </div>
            
            <div className="apontamentos-card">
              <div className="apontamentos-card-label">Tempo Máximo</div>
              <div className="apontamentos-card-value">
                {formatDays(operacaoIndicators.tempoMaximoResolucao)}
              </div>
              <div className="apontamentos-card-sublabel">
                de Resolução ({operacaoIndicators.tempoMaximoCodigo})
              </div>
            </div>
            
            <div className="apontamentos-card">
              <div className="apontamentos-card-label">Para Coordenação</div>
              <div className="apontamentos-card-value">{operacaoIndicators.paraCoordenacao}</div>
              <div className="apontamentos-card-sublabel">Apontamentos</div>
            </div>

            <div className="apontamentos-card">
              <div className="apontamentos-card-label">Antigos</div>
              <div className="apontamentos-card-value">{apontamentosAntigos.length}</div>
              <div className="apontamentos-card-sublabel">
                {percentualAntigos}% dos ativos (&gt;45 dias sem atualização)
              </div>
            </div>
          </div>

      {/* Tabela de apontamentos antigos */}
      {apontamentosAntigosBase.length > 0 && (
            <div className="client-issues-table-container" style={{ marginTop: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>
                Apontamentos Antigos (&gt;45 dias sem atualização)
              </h2>
              
              {/* Filtros para a tabela */}
              <div className="apontamentos-filters" style={{ marginBottom: '1rem' }}>
                {/* Filtro por Prioridade */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="apontamentos-filter-label">
                    Filtrar por Prioridade:
                  </label>
                  <div className="client-issues-priority-buttons">
                    <button
                      type="button"
                      onClick={() => setPriorityFilter('')}
                      className={`client-issues-priority-btn ${priorityFilter === '' ? 'active' : ''}`}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriorityFilter('alta')}
                      className={`client-issues-priority-btn ${priorityFilter === 'alta' ? 'active' : ''}`}
                    >
                      Alta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriorityFilter('media')}
                      className={`client-issues-priority-btn ${priorityFilter === 'media' || priorityFilter === 'média' ? 'active' : ''}`}
                    >
                      Média
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriorityFilter('baixa')}
                      className={`client-issues-priority-btn ${priorityFilter === 'baixa' ? 'active' : ''}`}
                    >
                      Baixa
                    </button>
                  </div>
                </div>

                {/* Filtro por Disciplinas (Pop-up Múltipla Escolha) */}
                {uniqueDisciplines.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, position: 'relative' }}>
                    <label className="apontamentos-filter-label">
                      Filtrar por Disciplinas:
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setIsDisciplinesPopupOpen(!isDisciplinesPopupOpen)}
                        className="apontamentos-filter-select"
                        style={{ 
                          minWidth: '250px',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>
                          {selectedDisciplines.length === 0 
                            ? 'Selecionar disciplinas...' 
                            : selectedDisciplines.length === 1 
                              ? '1 disciplina selecionada'
                              : `${selectedDisciplines.length} disciplinas selecionadas`}
                        </span>
                        <span style={{ fontSize: '0.8rem' }}>
                          {isDisciplinesPopupOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {selectedDisciplines.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDisciplines([]);
                            setIsDisciplinesPopupOpen(false);
                          }}
                          className="apontamentos-filter-clear-btn"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    {/* Pop-up de seleção */}
                    {isDisciplinesPopupOpen && (
                      <>
                        {/* Overlay para fechar ao clicar fora */}
                        <div
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 998,
                            background: 'transparent'
                          }}
                          onClick={() => setIsDisciplinesPopupOpen(false)}
                        />
                        {/* Pop-up */}
                        <div className="apontamentos-disciplines-popup">
                          <div className="apontamentos-disciplines-popup-header">
                            <span style={{ fontWeight: 600 }}>Selecionar Disciplinas</span>
                            <button
                              type="button"
                              onClick={() => setIsDisciplinesPopupOpen(false)}
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                color: '#737373',
                                padding: '0',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ×
                            </button>
                          </div>
                          <div className="apontamentos-disciplines-popup-content">
                            {uniqueDisciplines.map(discipline => {
                              const isSelected = selectedDisciplines.includes(discipline);
                              return (
                                <label
                                  key={discipline}
                                  className="apontamentos-disciplines-popup-item"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedDisciplines([...selectedDisciplines, discipline]);
                                      } else {
                                        setSelectedDisciplines(selectedDisciplines.filter(d => d !== discipline));
                                      }
                                    }}
                                    style={{ marginRight: '0.75rem', cursor: 'pointer' }}
                                  />
                                  <span>{discipline}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="apontamentos-disciplines-popup-footer">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDisciplines([]);
                              }}
                              className="apontamentos-filter-clear-btn"
                              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                            >
                              Limpar Tudo
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsDisciplinesPopupOpen(false)}
                              className="apontamentos-filter-multiselect-btn active"
                              style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                            >
                              Fechar
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Info de resultados filtrados */}
                {(priorityFilter || selectedDisciplines.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <span className="apontamentos-filter-info">
                      Mostrando {apontamentosAntigos.length} de {apontamentosAntigosBase.length} apontamentos
                    </span>
                  </div>
                )}
              </div>

              {apontamentosAntigos.length === 0 ? (
                <div className="client-issues-empty" style={{ padding: '2rem', textAlign: 'center' }}>
                  Nenhum apontamento encontrado com os filtros selecionados.
                </div>
              ) : (
                <table className="client-issues-table">
                <thead>
                  <tr>
                    <th className="client-issues-th-link">Link</th>
                    <th className="client-issues-th-code-title">Código + Título</th>
                    <th className="client-issues-th-priority">Prioridade</th>
                    <th className="client-issues-th-disciplinas">Disciplinas</th>
                    <th className="client-issues-th-created">Local</th>
                    <th className="client-issues-th-created">Data de Criação</th>
                    <th className="client-issues-th-time">Tempo desde Última Atualização</th>
                  </tr>
                </thead>
                <tbody>
                  {apontamentosAntigos.map(issue => {
                    const priority = translatePriority(issue.priority);
                    const creationDate = issue.createdAt 
                      ? new Date(issue.createdAt).toLocaleDateString('pt-BR')
                      : 'N/A';
                    const latest = getLatestUpdate(issue);
                    const timeSince = getTimeSinceUpdate(issue);
                    const updateType = latest.type || 'N/A';
                    
                    // Disciplinas com status = todo
                    const disciplinasTodo = (issue.disciplines || [])
                      .filter(d => !d.status || d.status === 'todo' || d.status === '')
                      .map(d => d.name)
                      .join(', ') || 'Nenhuma';
                    
                    // Locais com abbreviation
                    const localsAbbreviation = (issue.locals || [])
                      .map(l => l.abbreviation || l.name || l)
                      .join(', ') || 'Nenhum';

                    return (
                      <tr key={issue.id} className="client-issues-row">
                        <td className="client-issues-td-link">
                          <a
                            href={getIssueLink(issue)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="client-issues-link"
                          >
                            <span className="client-issues-link-icon">🔗</span>
                            Abrir
                          </a>
                        </td>
                        <td className="client-issues-td-code-title">
                          <div className="client-issues-code-title-header">
                            <span className="client-issues-code">{issue.code || 'N/A'}</span>
                            <span className="client-issues-title">{issue.title || 'Sem título'}</span>
                          </div>
                        </td>
                        <td className="client-issues-td-priority">
                          <span className={`client-issues-priority-badge client-issues-priority-${priority.toLowerCase()}`}>
                            {priority}
                          </span>
                        </td>
                        <td className="client-issues-td-disciplinas">
                          {disciplinasTodo}
                        </td>
                        <td className="client-issues-td-created">
                          {localsAbbreviation}
                        </td>
                        <td className="client-issues-td-created">
                          {creationDate}
                        </td>
                        <td className="client-issues-td-time">
                          <div className="client-issues-time-value">{timeSince}</div>
                          <div className="client-issues-time-type">{updateType}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
      )}
    </div>
  );
}

// Componente de tabela para apontamentos do cliente em aberto
function ClientOpenIssuesTable({ issues, clientDisciplines, projectId }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [priorityFilter, setPriorityFilter] = useState('');

  // Função para alternar expansão de linha
  const toggleRow = (issueId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId);
    } else {
      newExpanded.add(issueId);
    }
    setExpandedRows(newExpanded);
  };

  // Função para encontrar a maior data entre todas as datas de atualização
  const getLatestUpdate = (issue) => {
    const dates = [];
    
    // Coleta todas as datas disponíveis com seus tipos
    if (issue.editedAt) {
      dates.push({ date: new Date(issue.editedAt), type: 'Edição' });
    }
    if (issue.statusUpdatedAt) {
      dates.push({ date: new Date(issue.statusUpdatedAt), type: 'Atualização de Status' });
    }
    if (issue.updatedAt) {
      dates.push({ date: new Date(issue.updatedAt), type: 'Atualização Geral' });
    }
    if (issue.visibilityUpdatedAt) {
      dates.push({ date: new Date(issue.visibilityUpdatedAt), type: 'Mudança de Visibilidade' });
    }
    if (issue.lastCommentDate) {
      dates.push({ date: new Date(issue.lastCommentDate), type: 'Último Comentário' });
    }
    // createdAt como fallback
    if (issue.createdAt) {
      dates.push({ date: new Date(issue.createdAt), type: 'Criação' });
    }
    
    if (dates.length === 0) {
      return { date: null, type: 'N/A' };
    }
    
    // Encontra a data mais recente
    const latest = dates.reduce((max, current) => {
      return current.date > max.date ? current : max;
    });
    
    return latest;
  };

  // Função para calcular tempo desde última atualização
  const getTimeSinceUpdate = (issue) => {
    const latest = getLatestUpdate(issue);
    if (!latest.date) return 'Data não disponível';

    const now = new Date();
    const diffMs = now - latest.date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
    } else {
      return 'Agora';
    }
  };

  // Função para obter tipo de atualização
  const getUpdateType = (issue) => {
    const latest = getLatestUpdate(issue);
    return latest.type;
  };

  // Filtra e ordena por prioridade
  const filteredIssues = useMemo(() => {
    let filtered = issues;
    
    // Filtra por prioridade se houver filtro selecionado
    if (priorityFilter && priorityFilter !== '') {
      filtered = issues.filter(issue => {
        const priority = translatePriority(issue.priority);
        // Normaliza para comparação (remove acentos e converte para minúsculo)
        const priorityNormalized = priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const filterNormalized = priorityFilter.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return priorityNormalized === filterNormalized;
      });
    }
    
    // Ordena por prioridade: Alta > Média > Baixa > Outros
    const priorityOrder = { 'alta': 1, 'média': 2, 'media': 2, 'baixa': 3 };
    
    return filtered.sort((a, b) => {
      const priorityA = translatePriority(a.priority).toLowerCase();
      const priorityB = translatePriority(b.priority).toLowerCase();
      
      const orderA = priorityOrder[priorityA] || 999;
      const orderB = priorityOrder[priorityB] || 999;
      
      // Primeiro ordena por prioridade
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Se mesma prioridade, ordena por tempo desde última atualização (mais antigos primeiro)
      // Usa a função getLatestUpdate para pegar a maior data entre todas as opções
      const latestA = getLatestUpdate(a);
      const latestB = getLatestUpdate(b);
      
      if (latestA.date && latestB.date) {
        return latestA.date - latestB.date;
      }
      
      return 0;
    });
  }, [issues, priorityFilter]);

  // Função para gerar link do apontamento
  const getIssueLink = (issue) => {
    // Formato: https://app.construflow.com.br/workspace/project/{projectId}/issues?issueId={issueId}
    // projectId é o construflow_id do projeto
    // issueId é o id do issue
    if (!projectId || !issue.id) return '#';
    
    return `https://app.construflow.com.br/workspace/project/${projectId}/issues?issueId=${issue.id}`;
  };

  // Prioridades únicas para o filtro
  const uniquePriorities = useMemo(() => {
    const priorities = new Set();
    issues.forEach(issue => {
      if (issue.priority) {
        priorities.add(translatePriority(issue.priority));
      }
    });
    return Array.from(priorities).sort();
  }, [issues]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="apontamentos-section">
      {/* Título removido - agora está na aba */}
      <>

      {/* Informação sobre disciplinas do cliente */}
      {clientDisciplines.length > 0 && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.75rem', 
          background: '#f9fafb', 
          borderRadius: '8px',
          border: '1px solid #e6e6e6'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#737373', marginBottom: '0.25rem' }}>
            Disciplinas do cliente configuradas:
          </div>
          <div style={{ fontSize: '0.9rem', color: '#1a1a1a', fontWeight: 600 }}>
            {clientDisciplines.map((disc, idx) => (
              <span key={idx}>
                {disc.charAt(0).toUpperCase() + disc.slice(1)}
                {idx < clientDisciplines.length - 1 && ', '}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtro por prioridade - Botões */}
      <div className="apontamentos-filters">
        <label className="apontamentos-filter-label">
          Filtrar por Prioridade:
        </label>
        <div className="client-issues-priority-buttons">
          <button
            className={`client-issues-priority-btn ${priorityFilter === '' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('')}
          >
            Todas
          </button>
          <button
            className={`client-issues-priority-btn ${priorityFilter.toLowerCase() === 'alta' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('Alta')}
          >
            Alta
          </button>
          <button
            className={`client-issues-priority-btn ${priorityFilter.toLowerCase() === 'média' || priorityFilter.toLowerCase() === 'media' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('Média')}
          >
            Média
          </button>
          <button
            className={`client-issues-priority-btn ${priorityFilter.toLowerCase() === 'baixa' ? 'active' : ''}`}
            onClick={() => setPriorityFilter('Baixa')}
          >
            Baixa
          </button>
        </div>
        <span className="apontamentos-filter-info">
          {issues.length} apontamentos
        </span>
        {priorityFilter && (
          <span className="apontamentos-filter-info">
            - Mostrando {filteredIssues.length}
          </span>
        )}
      </div>

      {/* Tabela de apontamentos */}
      <div className="client-issues-table-container">
        <table className="client-issues-table">
          <thead>
            <tr>
              <th className="client-issues-th-link">Link</th>
              <th className="client-issues-th-code-title">Código + Título</th>
              <th className="client-issues-th-priority">Prioridade</th>
              <th className="client-issues-th-created">Local</th>
              <th className="client-issues-th-created">Data de Criação</th>
              <th className="client-issues-th-time">Tempo desde Última Atualização</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.length === 0 ? (
              <tr>
                <td colSpan="5" className="client-issues-empty">
                  Nenhum apontamento encontrado com o filtro selecionado.
                </td>
              </tr>
            ) : (
              filteredIssues.map((issue) => {
                const isExpanded = expandedRows.has(issue.guid || issue.id);
                const timeSince = getTimeSinceUpdate(issue);
                const updateType = getUpdateType(issue);
                const issueLink = getIssueLink(issue);
                const priority = translatePriority(issue.priority);
                
                // Formata data de criação
                const formatCreationDate = (date) => {
                  if (!date) return 'N/A';
                  try {
                    const d = new Date(date);
                    return d.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    });
                  } catch (e) {
                    return 'N/A';
                  }
                };
                
                const creationDate = formatCreationDate(issue.createdAt);
                
                // Locais com abbreviation
                const localsAbbreviation = (issue.locals || [])
                  .map(l => l.abbreviation || l.name || l)
                  .join(', ') || 'Nenhum';

                return (
                  <React.Fragment key={issue.guid || issue.id}>
                    <tr className="client-issues-row">
                      <td className="client-issues-td-link">
                        <a 
                          href={issueLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="client-issues-link"
                        >
                          <span className="client-issues-link-icon">🔗</span>
                          Abrir
                        </a>
                      </td>
                      <td className="client-issues-td-code-title">
                        <div className="client-issues-code-title-header">
                          <button
                            className="client-issues-expand-btn"
                            onClick={() => toggleRow(issue.guid || issue.id)}
                            aria-expanded={isExpanded}
                          >
                            <span className="client-issues-expand-icon">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </button>
                          <span className="client-issues-code">
                            {issue.code || 'N/A'}
                          </span>
                          <span className="client-issues-title">
                            {issue.title || 'Sem título'}
                          </span>
                        </div>
                        {isExpanded && issue.description && (
                          <div className="client-issues-description">
                            {issue.description}
                          </div>
                        )}
                      </td>
                      <td className="client-issues-td-priority">
                        <span className={`client-issues-priority-badge client-issues-priority-${priority.toLowerCase()}`}>
                          {priority}
                        </span>
                      </td>
                      <td className="client-issues-td-created">
                        {localsAbbreviation}
                      </td>
                      <td className="client-issues-td-created">
                        {creationDate}
                      </td>
                      <td className="client-issues-td-time">
                        <div className="client-issues-time-value">{timeSince}</div>
                        <div className="client-issues-time-type">{updateType}</div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </>
    </div>
  );
}


export default ApontamentosView;

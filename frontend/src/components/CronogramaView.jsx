/**
 * Componente: Vista de Cronograma
 * 
 * Exibe informações de cronograma do projeto:
 * - Cards de KPIs (atrasos coordenação e projetistas)
 * - Tabela de próximas entregas previstas
 * - Tabela de atrasos
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/CronogramaView.css';

function CronogramaView({ selectedProjectId, portfolio = [] }) {
  const [cronogramaData, setCronogramaData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('entregas'); // 'entregas' ou 'atrasos'
  const [weeksFilter, setWeeksFilter] = useState(2); // Filtro de semanas (padrão: 2 semanas)
  const [disciplinaFilter, setDisciplinaFilter] = useState([]); // Filtro de disciplinas (múltipla escolha)
  const [kpiFilter, setKpiFilter] = useState([]); // Filtro de KPIs (múltipla escolha)
  const [disciplinaDropdownOpen, setDisciplinaDropdownOpen] = useState(false);
  const [kpiDropdownOpen, setKpiDropdownOpen] = useState(false);
  
  // Filtros para a aba de Atrasos
  const [atrasosDisciplinaFilter, setAtrasosDisciplinaFilter] = useState([]);
  const [atrasosKpiFilter, setAtrasosKpiFilter] = useState([]);
  const [atrasosDisciplinaDropdownOpen, setAtrasosDisciplinaDropdownOpen] = useState(false);
  const [atrasosKpiDropdownOpen, setAtrasosKpiDropdownOpen] = useState(false);

  // Controle "Cobrança feita" — rowIds marcados pelo time (compartilhado via API)
  const [cobrancasFeitas, setCobrancasFeitas] = useState(new Set());
  const [cobrancaToggling, setCobrancaToggling] = useState(null); // rowId em atualização

  // Estado do botão Gmail Draft
  const [gmailAuthorized, setGmailAuthorized] = useState(false);
  const [gmailLoading, setGmailLoading] = useState(null); // chave da disciplina em loading
  const [gmailFeedback, setGmailFeedback] = useState(null); // { type, message, key }

  // Busca o projeto selecionado do portfólio para obter o smartsheet_id
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.cronograma-multi-select-wrapper')) {
        setDisciplinaDropdownOpen(false);
        setKpiDropdownOpen(false);
        setAtrasosDisciplinaDropdownOpen(false);
        setAtrasosKpiDropdownOpen(false);
      }
    };

    if (disciplinaDropdownOpen || kpiDropdownOpen || atrasosDisciplinaDropdownOpen || atrasosKpiDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [disciplinaDropdownOpen, kpiDropdownOpen, atrasosDisciplinaDropdownOpen, atrasosKpiDropdownOpen]);

  // Busca dados do cronograma
  useEffect(() => {
    if (!selectedProject || !selectedProject.smartsheet_id) {
      setCronogramaData([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    axios.get(`${API_URL}/api/projetos/cronograma`, {
      params: {
        smartsheetId: selectedProject.smartsheet_id,
        projectName: selectedProject.project_name || selectedProject.project_code_norm
      },
      withCredentials: true
    })
      .then(response => {
        if (response.data.success) {
          setCronogramaData(response.data.data || []);
        } else {
          setError(response.data.error || 'Erro ao carregar cronograma');
        }
      })
      .catch(err => {
        console.error('Erro ao buscar cronograma:', err);
        setError(err.response?.data?.error || 'Erro ao carregar cronograma');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedProject, selectedProjectId]);

  // Busca cobranças feitas ao trocar de projeto
  useEffect(() => {
    if (!selectedProject?.smartsheet_id) {
      setCobrancasFeitas(new Set());
      return;
    }
    axios.get(`${API_URL}/api/projetos/cronograma/cobrancas`, {
      params: { smartsheetId: selectedProject.smartsheet_id },
      withCredentials: true
    })
      .then(res => {
        if (res.data?.success && Array.isArray(res.data.rowIds)) {
          setCobrancasFeitas(new Set(res.data.rowIds.map(String)));
        }
      })
      .catch(() => setCobrancasFeitas(new Set()));
  }, [selectedProject?.smartsheet_id]);

  // Chave única por tarefa (rowId do BigQuery ou fallback)
  const getRowKey = (item) => {
    const id = item.rowId ?? item.row_id;
    if (id != null && String(id).trim() !== '') return String(id);
    const parts = [item.NomeDaTarefa, item.DataDeTermino, item.Disciplina, item.ID_Projeto].filter(Boolean);
    return parts.join('|');
  };

  // Toggle "Cobrança feita" — marcar/desmarcar e persistir
  const handleCobrancaToggle = async (rowKey, checked) => {
    if (!selectedProject?.smartsheet_id) return;
    setCobrancaToggling(rowKey);
    const prev = new Set(cobrancasFeitas);
    if (checked) prev.add(rowKey); else prev.delete(rowKey);
    setCobrancasFeitas(prev);
    try {
      await axios.put(
        `${API_URL}/api/projetos/cronograma/cobrancas`,
        { smartsheetId: selectedProject.smartsheet_id, rowId: rowKey, cobrancaFeita: checked },
        { withCredentials: true }
      );
    } catch (err) {
      if (checked) prev.delete(rowKey); else prev.add(rowKey);
      setCobrancasFeitas(new Set(prev));
      console.error('Erro ao salvar cobrança:', err);
    } finally {
      setCobrancaToggling(null);
    }
  };

  // Função para formatar data
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    try {
      let date;
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) {
          date = new Date(dateValue.value);
        } else if (dateValue.toISOString) {
          date = dateValue;
        } else {
          date = new Date(JSON.stringify(dateValue));
        }
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return date.toLocaleDateString('pt-BR');
    } catch (error) {
      return 'N/A';
    }
  };

  // Calcula KPIs
  const kpis = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) {
      return {
        atrasoCoordenacao: 0,
        atrasoProjetistas: 0
      };
    }

    // Atividades com atraso da coordenação (KPI = Vermelho)
    const atrasoCoordenacao = cronogramaData.filter(item => {
      const kpi = String(item.KPI || '').trim();
      return kpi.toLowerCase() === 'vermelho';
    }).length;

    // Tarefas com atraso dos projetistas (KPI = Azul)
    const atrasoProjetistas = cronogramaData.filter(item => {
      const kpi = String(item.KPI || '').trim();
      return kpi.toLowerCase() === 'azul';
    }).length;

    return {
      atrasoCoordenacao,
      atrasoProjetistas
    };
  }, [cronogramaData]);

  // Função auxiliar para parsear data
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      let date;
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) {
          date = new Date(dateValue.value);
        } else if (dateValue.toISOString) {
          date = dateValue;
        } else {
          date = new Date(JSON.stringify(dateValue));
        }
      } else {
        date = new Date(dateValue);
      }
      
      if (isNaN(date.getTime())) return null;
      date.setHours(0, 0, 0, 0);
      return date;
    } catch {
      return null;
    }
  };

  // Lista de disciplinas únicas e KPIs únicos para os filtros
  const uniqueDisciplinas = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];
    const disciplinas = new Set();
    cronogramaData.forEach(item => {
      const disciplina = String(item.Disciplina || '').trim();
      if (disciplina) {
        disciplinas.add(disciplina);
      }
    });
    return Array.from(disciplinas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cronogramaData]);

  const uniqueKPIs = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];
    const kpis = new Set();
    cronogramaData.forEach(item => {
      const kpi = String(item.KPI || '').trim();
      const kpiLower = kpi.toLowerCase();
      // Exclui KPIs verdes, azuis e N/A da lista de filtros
      if (kpi && kpiLower !== 'verde' && kpiLower !== 'azul' && kpiLower !== 'n/a') {
        kpis.add(kpi);
      }
    });
    return Array.from(kpis).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cronogramaData]);

  // Handlers para filtros
  const handleDisciplinaToggle = (disciplina) => {
    setDisciplinaFilter(prev => {
      if (prev.includes(disciplina)) {
        return prev.filter(d => d !== disciplina);
      } else {
        return [...prev, disciplina];
      }
    });
  };

  const handleKpiToggle = (kpi) => {
    setKpiFilter(prev => {
      if (prev.includes(kpi)) {
        return prev.filter(k => k !== kpi);
      } else {
        return [...prev, kpi];
      }
    });
  };

  const handleSelectAllDisciplinas = () => {
    if (disciplinaFilter.length === uniqueDisciplinas.length) {
      setDisciplinaFilter([]);
    } else {
      setDisciplinaFilter([...uniqueDisciplinas]);
    }
  };

  const handleSelectAllKPIs = () => {
    if (kpiFilter.length === uniqueKPIs.length) {
      setKpiFilter([]);
    } else {
      setKpiFilter([...uniqueKPIs]);
    }
  };

  // Função para gerar mensagem WhatsApp (para Próximas Entregas)
  const generateWhatsAppMessage = (discGroup, dateGroup) => {
    const projetoNome = (selectedProject?.project_name || selectedProject?.project_code_norm || 'Projeto').toUpperCase();
    const tarefas = discGroup.items.map(item => `• ${item.NomeDaTarefa || 'N/A'}`).join('\n');
    const dataTermino = dateGroup.date;
    
    // Verifica se há KPI vermelho nas tarefas desta disciplina
    const hasKpiVermelho = discGroup.items.some(item => {
      const kpi = String(item.KPI || '').trim().toLowerCase();
      return kpi === 'vermelho';
    });

    // TODO: Buscar nome do projetista e pontos pendentes do banco de dados
    const projetistaNome = '[Projetista]'; // Será substituído por dados do banco
    const pontosPendentes = 'X'; // Será substituído por dados do banco
    
    let mensagem = '';
    
    if (hasKpiVermelho) {
      // Mensagem para KPI vermelho - alinhamento de datas
      mensagem = `Olá ${projetistaNome}, tudo bem?

Estou entrando em contato para alinharmos as datas das entregas previstas do projeto ${projetoNome}, conforme cronograma:

${tarefas}

${discGroup.items.length === 1 ? 'Com prazo em' : 'Ambas com prazo em'} ${dataTermino}.

Observo que algumas dessas entregas estão com KPI vermelho, o que indica necessidade de ajuste no cronograma. Gostaria de alinhar novas datas que sejam viáveis para você.

Aproveito para reforçar que, no momento, constam ${pontosPendentes} pontos pendentes no Construflow sob sua responsabilidade, e que os escopos foram alinhados e formalizados no início do projeto.

Caso exista algum impedimento ou necessidade de alinhamento, peço que nos sinalize o quanto antes.

Fico à disposição.`;
    } else {
      // Mensagem padrão
      mensagem = `Olá ${projetistaNome}, tudo bem?

Estou entrando em contato para confirmar as entregas previstas do projeto ${projetoNome}, conforme cronograma:

${tarefas}

${discGroup.items.length === 1 ? 'Com prazo em' : 'Ambas com prazo em'} ${dataTermino}.

Aproveito para reforçar que, no momento, constam ${pontosPendentes} pontos pendentes no Construflow sob sua responsabilidade, e que os escopos foram alinhados e formalizados no início do projeto.

Caso exista algum impedimento ou necessidade de alinhamento, peço que nos sinalize o quanto antes.

Fico à disposição.`;
    }
    
    return mensagem;
  };

  // Função para gerar mensagem WhatsApp (para Atrasos)
  const generateWhatsAppMessageAtrasos = (discGroup) => {
    const projetoNome = (selectedProject?.project_name || selectedProject?.project_code_norm || 'Projeto').toUpperCase();
    const tarefas = discGroup.items.map(item => {
      const dataTermino = formatDate(item.DataDeTermino);
      return `• ${item.NomeDaTarefa || 'N/A'} (${dataTermino})`;
    }).join('\n');
    
    // Verifica se há KPI vermelho nas tarefas desta disciplina
    const hasKpiVermelho = discGroup.items.some(item => {
      const kpi = String(item.KPI || '').trim().toLowerCase();
      return kpi === 'vermelho';
    });

    // TODO: Buscar nome do projetista e pontos pendentes do banco de dados
    const projetistaNome = '[Projetista]'; // Será substituído por dados do banco
    const pontosPendentes = 'X'; // Será substituído por dados do banco
    
    let mensagem = '';
    
    if (hasKpiVermelho) {
      // Mensagem para KPI vermelho - alinhamento de datas
      mensagem = `Olá ${projetistaNome}, tudo bem?

Estou entrando em contato para alinharmos as datas das seguintes entregas com atraso do projeto ${projetoNome}:

${tarefas}

Observo que algumas dessas entregas estão com KPI vermelho, o que indica necessidade de ajuste no cronograma. Gostaria de alinhar novas datas que sejam viáveis para você.

Aproveito para reforçar que, no momento, constam ${pontosPendentes} pontos pendentes no Construflow sob sua responsabilidade, e que os escopos foram alinhados e formalizados no início do projeto.

Caso exista algum impedimento ou necessidade de alinhamento, peço que nos sinalize o quanto antes.

Fico à disposição.`;
    } else {
      // Mensagem padrão para atrasos
      mensagem = `Olá ${projetistaNome}, tudo bem?

Estou entrando em contato sobre as seguintes entregas com atraso do projeto ${projetoNome}:

${tarefas}

Gostaria de alinhar novas datas que sejam viáveis para você.

Aproveito para reforçar que, no momento, constam ${pontosPendentes} pontos pendentes no Construflow sob sua responsabilidade, e que os escopos foram alinhados e formalizados no início do projeto.

Caso exista algum impedimento ou necessidade de alinhamento, peço que nos sinalize o quanto antes.

Fico à disposição.`;
    }
    
    return mensagem;
  };

  // Função para gerar link WhatsApp Web (Próximas Entregas)
  const generateWhatsAppLink = (discGroup, dateGroup) => {
    const mensagem = generateWhatsAppMessage(discGroup, dateGroup);
    const telefone = '5541998992821'; // Pedro - MVP
    const mensagemEncoded = encodeURIComponent(mensagem);
    return `https://web.whatsapp.com/send?phone=${telefone}&text=${mensagemEncoded}`;
  };

  // Função para gerar link WhatsApp Web (Atrasos)
  const generateWhatsAppLinkAtrasos = (discGroup) => {
    const mensagem = generateWhatsAppMessageAtrasos(discGroup);
    const telefone = '5541998992821'; // Pedro - MVP
    const mensagemEncoded = encodeURIComponent(mensagem);
    return `https://web.whatsapp.com/send?phone=${telefone}&text=${mensagemEncoded}`;
  };

  // Verifica autorização Gmail no mount
  useEffect(() => {
    axios.get(`${API_URL}/api/auth/gmail-status`, { withCredentials: true })
      .then(res => setGmailAuthorized(res.data?.authorized === true))
      .catch(() => setGmailAuthorized(false));
  }, []);

  // Gera assunto do email de cobrança
  const generateEmailSubject = (discGroup, dateGroup) => {
    const projetoNome = selectedProject?.project_name || selectedProject?.project_code_norm || 'Projeto';
    if (dateGroup) {
      return `Entregas Previstas - ${projetoNome} - ${discGroup.disciplina} - ${dateGroup.date}`;
    }
    return `Atrasos Pendentes - ${projetoNome} - ${discGroup.disciplina}`;
  };

  // Cria rascunho no Gmail via API
  const handleGmailDraft = async (discGroup, dateGroup = null) => {
    const key = `${discGroup.disciplina}-${dateGroup?.date || 'atraso'}`;
    setGmailLoading(key);
    setGmailFeedback(null);

    try {
      const body = dateGroup
        ? generateWhatsAppMessage(discGroup, dateGroup)
        : generateWhatsAppMessageAtrasos(discGroup);

      const response = await axios.post(
        `${API_URL}/api/projetos/cronograma/gmail-draft`,
        {
          construflowId: selectedProject?.construflow_id,
          disciplinaName: discGroup.disciplina,
          subject: generateEmailSubject(discGroup, dateGroup),
          body,
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        setGmailFeedback({ type: 'success', message: 'Rascunho criado no Gmail!', key });
        window.open('https://mail.google.com/mail/u/0/#drafts', '_blank');
      }
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'GMAIL_NOT_AUTHORIZED') {
        window.location.href = `${API_URL}/api/auth/google?reauthorize=true`;
        return;
      }
      if (code === 'NO_RECIPIENTS') {
        setGmailFeedback({ type: 'error', message: 'Nenhum email cadastrado para esta disciplina.', key });
      } else {
        setGmailFeedback({ type: 'error', message: 'Erro ao criar rascunho. Tente novamente.', key });
      }
    } finally {
      setGmailLoading(null);
      setTimeout(() => setGmailFeedback(null), 4000);
    }
  };

  // Próximas entregas previstas - agrupadas por data e depois por disciplina
  const proximasEntregasGrouped = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const semanasFuturas = new Date(hoje);
    semanasFuturas.setDate(hoje.getDate() + (weeksFilter * 7));

    // Filtra e ordena os dados
    const filtered = cronogramaData
      .filter(item => {
        const kpi = String(item.KPI || '').trim();
        const kpiLower = kpi.toLowerCase();
        
        // Exclui KPIs verdes, azuis e N/A
        if (kpiLower === 'verde' || kpiLower === 'azul' || kpiLower === 'n/a' || kpi === '') return false;

        // Filtro por KPI selecionado
        if (kpiFilter.length > 0) {
          const kpiValue = String(item.KPI || '').trim();
          if (!kpiFilter.includes(kpiValue)) return false;
        }

        // Filtro por disciplina selecionada
        if (disciplinaFilter.length > 0) {
          const disciplina = String(item.Disciplina || '').trim();
          if (!disciplinaFilter.includes(disciplina)) return false;
        }

        const dataTermino = item.DataDeTermino;
        if (!dataTermino) return false;

        const date = parseDate(dataTermino);
        if (!date) return false;

        // Data de término antes de hoje ou nas próximas semanas
        return date <= semanasFuturas;
      })
      .sort((a, b) => {
        // Primeiro ordena por data de término
        const dateA = parseDate(a.DataDeTermino);
        const dateB = parseDate(b.DataDeTermino);
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        const dateDiff = dateA.getTime() - dateB.getTime();
        if (dateDiff !== 0) return dateDiff;
        
        // Se as datas forem iguais, ordena por disciplina
        const disciplinaA = String(a.Disciplina || '').trim().toLowerCase();
        const disciplinaB = String(b.Disciplina || '').trim().toLowerCase();
        return disciplinaA.localeCompare(disciplinaB, 'pt-BR');
      });

    // Agrupa por data e depois por disciplina
    const grouped = {};
    filtered.forEach(item => {
      const date = parseDate(item.DataDeTermino);
      if (!date) return;
      
      const dateKey = formatDate(item.DataDeTermino);
      const disciplina = String(item.Disciplina || '').trim() || 'Sem Disciplina';
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      if (!grouped[dateKey][disciplina]) {
        grouped[dateKey][disciplina] = [];
      }
      
      grouped[dateKey][disciplina].push(item);
    });

    // Converte para array ordenado
    return Object.keys(grouped)
      .sort((a, b) => {
        const dateA = parseDate(a);
        const dateB = parseDate(b);
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .map(dateKey => ({
        date: dateKey,
        dateObj: parseDate(dateKey),
        disciplinas: Object.keys(grouped[dateKey])
          .sort((a, b) => a.localeCompare(b, 'pt-BR'))
          .map(disciplina => ({
            disciplina,
            items: grouped[dateKey][disciplina]
          }))
      }));
  }, [cronogramaData, weeksFilter, disciplinaFilter, kpiFilter]);

  // Versão plana para contagem
  const proximasEntregas = useMemo(() => {
    return proximasEntregasGrouped.flatMap(dateGroup => 
      dateGroup.disciplinas.flatMap(discGroup => discGroup.items)
    );
  }, [proximasEntregasGrouped]);

  // Lista de disciplinas e KPIs únicos para filtros de Atrasos
  const uniqueAtrasosDisciplinas = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];
    const disciplinas = new Set();
    cronogramaData.forEach(item => {
      const categoria = item.Categoria_de_atraso;
      const motivo = item.Motivo_de_atraso;
      if ((categoria && String(categoria).trim() !== '') || 
          (motivo && String(motivo).trim() !== '')) {
        const disciplina = String(item.Disciplina || '').trim();
        if (disciplina) {
          disciplinas.add(disciplina);
        }
      }
    });
    return Array.from(disciplinas).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cronogramaData]);

  const uniqueAtrasosKPIs = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];
    const kpis = new Set();
    cronogramaData.forEach(item => {
      const categoria = item.Categoria_de_atraso;
      const motivo = item.Motivo_de_atraso;
      if ((categoria && String(categoria).trim() !== '') || 
          (motivo && String(motivo).trim() !== '')) {
        const kpi = String(item.KPI || '').trim();
        if (kpi) {
          kpis.add(kpi);
        }
      }
    });
    return Array.from(kpis).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [cronogramaData]);

  // Handlers para filtros de Atrasos
  const handleAtrasosDisciplinaToggle = (disciplina) => {
    setAtrasosDisciplinaFilter(prev => {
      if (prev.includes(disciplina)) {
        return prev.filter(d => d !== disciplina);
      } else {
        return [...prev, disciplina];
      }
    });
  };

  const handleAtrasosKpiToggle = (kpi) => {
    setAtrasosKpiFilter(prev => {
      if (prev.includes(kpi)) {
        return prev.filter(k => k !== kpi);
      } else {
        return [...prev, kpi];
      }
    });
  };

  const handleSelectAllAtrasosDisciplinas = () => {
    if (atrasosDisciplinaFilter.length === uniqueAtrasosDisciplinas.length) {
      setAtrasosDisciplinaFilter([]);
    } else {
      setAtrasosDisciplinaFilter([...uniqueAtrasosDisciplinas]);
    }
  };

  const handleSelectAllAtrasosKPIs = () => {
    if (atrasosKpiFilter.length === uniqueAtrasosKPIs.length) {
      setAtrasosKpiFilter([]);
    } else {
      setAtrasosKpiFilter([...uniqueAtrasosKPIs]);
    }
  };

  // Atrasos (com categoria e motivo) - agrupados por disciplina
  const atrasosGrouped = useMemo(() => {
    if (!cronogramaData || cronogramaData.length === 0) return [];

    const filtered = cronogramaData
      .filter(item => {
        const categoria = item.Categoria_de_atraso;
        const motivo = item.Motivo_de_atraso;
        if (!((categoria && String(categoria).trim() !== '') || 
               (motivo && String(motivo).trim() !== ''))) {
          return false;
        }

        // Filtro por disciplina selecionada
        if (atrasosDisciplinaFilter.length > 0) {
          const disciplina = String(item.Disciplina || '').trim();
          if (!atrasosDisciplinaFilter.includes(disciplina)) return false;
        }

        // Filtro por KPI selecionado
        if (atrasosKpiFilter.length > 0) {
          const kpi = String(item.KPI || '').trim();
          if (!atrasosKpiFilter.includes(kpi)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Primeiro ordena por disciplina
        const disciplinaA = String(a.Disciplina || '').trim().toLowerCase();
        const disciplinaB = String(b.Disciplina || '').trim().toLowerCase();
        const discDiff = disciplinaA.localeCompare(disciplinaB, 'pt-BR');
        if (discDiff !== 0) return discDiff;
        
        // Se as disciplinas forem iguais, ordena por data de término (mais recentes primeiro)
        const dateA = parseDate(a.DataDeTermino);
        const dateB = parseDate(b.DataDeTermino);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });

    // Agrupa por disciplina
    const grouped = {};
    filtered.forEach(item => {
      const disciplina = String(item.Disciplina || '').trim() || 'Sem Disciplina';
      
      if (!grouped[disciplina]) {
        grouped[disciplina] = [];
      }
      
      grouped[disciplina].push(item);
    });

    // Converte para array ordenado
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map(disciplina => ({
        disciplina,
        items: grouped[disciplina]
      }));
  }, [cronogramaData, atrasosDisciplinaFilter, atrasosKpiFilter]);

  // Versão plana para contagem
  const atrasos = useMemo(() => {
    return atrasosGrouped.flatMap(discGroup => discGroup.items);
  }, [atrasosGrouped]);

  if (!selectedProjectId) {
    return (
      <div className="cronograma-empty">
        <p>Selecione um projeto para visualizar o cronograma.</p>
      </div>
    );
  }

  if (!selectedProject || !selectedProject.smartsheet_id) {
    return (
      <div className="cronograma-empty">
        <p>Este projeto não possui SmartSheet ID configurado.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cronograma-loading">
        <p>Carregando dados do cronograma...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cronograma-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="cronograma-container">
      {/* Cards de KPIs */}
      <div className="cronograma-kpis">
        <div className="cronograma-kpi-card cronograma-kpi-vermelho">
          <div className="cronograma-kpi-label">Quantidade de atividades com atraso da coordenação</div>
          <div className="cronograma-kpi-value">{kpis.atrasoCoordenacao}</div>
          <div className="cronograma-kpi-subtitle">KPI = Vermelho</div>
        </div>
        <div className="cronograma-kpi-card cronograma-kpi-azul">
          <div className="cronograma-kpi-label">Quantidade de tarefas com atraso dos projetistas</div>
          <div className="cronograma-kpi-value">{kpis.atrasoProjetistas}</div>
          <div className="cronograma-kpi-subtitle">KPI = Azul</div>
        </div>
      </div>

      {/* Abas para Próximas Entregas e Atrasos */}
      <div className="cronograma-tabs-container">
        <div className="cronograma-tabs">
          <button
            className={`cronograma-tab ${activeTab === 'entregas' ? 'cronograma-tab-active' : ''}`}
            onClick={() => setActiveTab('entregas')}
          >
            Próximas Entregas Previstas
            {proximasEntregas.length > 0 && (
              <span className="cronograma-tab-badge">{proximasEntregas.length}</span>
            )}
          </button>
          <button
            className={`cronograma-tab ${activeTab === 'atrasos' ? 'cronograma-tab-active' : ''}`}
            onClick={() => setActiveTab('atrasos')}
          >
            Atrasos
            {atrasos.length > 0 && (
              <span className="cronograma-tab-badge">{atrasos.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo da aba Próximas Entregas Previstas */}
      {activeTab === 'entregas' && (
        <div className="cronograma-section">
          <div className="cronograma-section-header">
            <div className="cronograma-section-title-wrapper">
              <h3 className="cronograma-section-title">Próximas Entregas Previstas</h3>
              {proximasEntregas.length > 0 && (
                <span className="cronograma-count-badge">{proximasEntregas.length}</span>
              )}
            </div>
            <div className="cronograma-filters-row">
            <div className="cronograma-weeks-filter">
              <label>
                Próximas semanas:
                <select
                  value={weeksFilter}
                  onChange={(e) => setWeeksFilter(Number(e.target.value))}
                  className="cronograma-weeks-select"
                >
                  <option value={1}>1 semana</option>
                  <option value={2}>2 semanas</option>
                  <option value={4}>4 semanas</option>
                  <option value={8}>8 semanas</option>
                  <option value={12}>12 semanas</option>
                </select>
              </label>
            </div>
            
            {/* Filtro de Disciplinas */}
            <div className="cronograma-multi-select-wrapper">
              <button
                type="button"
                className="cronograma-multi-select-button"
                onClick={() => {
                  setDisciplinaDropdownOpen(!disciplinaDropdownOpen);
                  setKpiDropdownOpen(false);
                }}
              >
                <span>
                  {disciplinaFilter.length === 0 
                    ? 'Todas as Disciplinas' 
                    : disciplinaFilter.length === 1 
                      ? disciplinaFilter[0] 
                      : `${disciplinaFilter.length} Disciplinas selecionadas`}
                </span>
                <span className="cronograma-dropdown-arrow">{disciplinaDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {disciplinaDropdownOpen && (
                <div className="cronograma-multi-select-dropdown">
                  <div className="cronograma-multi-select-header">
                    <label className="cronograma-select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={disciplinaFilter.length === uniqueDisciplinas.length && uniqueDisciplinas.length > 0}
                        onChange={handleSelectAllDisciplinas}
                      />
                      <span>Selecionar Todas</span>
                    </label>
                  </div>
                  <div className="cronograma-multi-select-options">
                    {uniqueDisciplinas.map(disciplina => (
                      <label key={disciplina} className="cronograma-multi-select-option">
                        <input
                          type="checkbox"
                          checked={disciplinaFilter.includes(disciplina)}
                          onChange={() => handleDisciplinaToggle(disciplina)}
                        />
                        <span>{disciplina}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filtro de KPIs */}
            <div className="cronograma-multi-select-wrapper">
              <button
                type="button"
                className="cronograma-multi-select-button"
                onClick={() => {
                  setKpiDropdownOpen(!kpiDropdownOpen);
                  setDisciplinaDropdownOpen(false);
                }}
              >
                <span>
                  {kpiFilter.length === 0 
                    ? 'Todos os KPIs' 
                    : kpiFilter.length === 1 
                      ? kpiFilter[0] 
                      : `${kpiFilter.length} KPIs selecionados`}
                </span>
                <span className="cronograma-dropdown-arrow">{kpiDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {kpiDropdownOpen && (
                <div className="cronograma-multi-select-dropdown">
                  <div className="cronograma-multi-select-header">
                    <label className="cronograma-select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={kpiFilter.length === uniqueKPIs.length && uniqueKPIs.length > 0}
                        onChange={handleSelectAllKPIs}
                      />
                      <span>Selecionar Todos</span>
                    </label>
                  </div>
                  <div className="cronograma-multi-select-options">
                    {uniqueKPIs.map(kpi => {
                      const kpiClass = kpi.toLowerCase();
                      return (
                        <label key={kpi} className="cronograma-multi-select-option">
                          <input
                            type="checkbox"
                            checked={kpiFilter.includes(kpi)}
                            onChange={() => handleKpiToggle(kpi)}
                          />
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`cronograma-kpi-badge cronograma-kpi-badge-${kpiClass}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                              {kpi}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {proximasEntregasGrouped.length > 0 ? (
          <div className="cronograma-table-wrapper">
            <table className="cronograma-table cronograma-table-grouped">
              <thead>
                <tr>
                  <th>Data de Término</th>
                  <th>Disciplina</th>
                  <th>Nome da Tarefa</th>
                  <th>KPI</th>
                  <th className="cronograma-th-cobranca">Cobrança</th>
                </tr>
              </thead>
              <tbody>
                {proximasEntregasGrouped.map((dateGroup, dateIndex) => {
                  const totalRowsInDate = dateGroup.disciplinas.reduce((sum, d) => sum + d.items.length, 0);
                  return dateGroup.disciplinas.map((discGroup, discIndex) => 
                    discGroup.items.map((item, itemIndex) => {
                      const kpi = String(item.KPI || '').trim();
                      const kpiClass = kpi.toLowerCase();
                      const isFirstInDateGroup = discIndex === 0 && itemIndex === 0;
                      const isFirstInDisciplina = itemIndex === 0;
                      const rowSpanDate = isFirstInDateGroup ? totalRowsInDate : 0;
                      const rowSpanDisciplina = isFirstInDisciplina ? discGroup.items.length : 0;
                      
                      return (
                        <tr key={`${dateIndex}-${discIndex}-${itemIndex}`}>
                          {isFirstInDateGroup && (
                            <td 
                              rowSpan={rowSpanDate} 
                              className="cronograma-group-date"
                            >
                              {dateGroup.date}
                            </td>
                          )}
                          {isFirstInDisciplina && (
                            <td 
                              rowSpan={rowSpanDisciplina}
                              className="cronograma-group-disciplina"
                            >
                              <div className="cronograma-disciplina-wrapper">
                                <span>{discGroup.disciplina}</span>
                                <div className="cronograma-disciplina-buttons">
                                  <a
                                    href={generateWhatsAppLink(discGroup, dateGroup)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cronograma-cobranca-button"
                                    title="Enviar cobrança via WhatsApp"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                    </svg>
                                    Cobrança
                                  </a>
                                  <button
                                    type="button"
                                    className="cronograma-cobranca-button cronograma-email-button"
                                    title={gmailAuthorized ? 'Criar rascunho de cobrança no Gmail' : 'Autorize o Gmail para criar rascunhos'}
                                    onClick={() => handleGmailDraft(discGroup, dateGroup)}
                                    disabled={gmailLoading === `${discGroup.disciplina}-${dateGroup?.date || 'atraso'}`}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="2" y="4" width="20" height="16" rx="2" />
                                      <path d="M22 4L12 13L2 4" />
                                    </svg>
                                    {gmailLoading === `${discGroup.disciplina}-${dateGroup?.date || 'atraso'}` ? 'Criando...' : 'Email'}
                                  </button>
                                </div>
                                {gmailFeedback?.key === `${discGroup.disciplina}-${dateGroup?.date || 'atraso'}` && (
                                  <span className={`cronograma-gmail-feedback cronograma-gmail-feedback-${gmailFeedback.type}`}>
                                    {gmailFeedback.message}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          <td>{item.NomeDaTarefa || 'N/A'}</td>
                          <td>
                            <span className={`cronograma-kpi-badge cronograma-kpi-badge-${kpiClass}`}>
                              {kpi || 'N/A'}
                            </span>
                          </td>
                          <td className="cronograma-td-cobranca">
                            <label className="cronograma-cobranca-checkbox" title={cobrancasFeitas.has(getRowKey(item)) ? 'Cobrança feita — clique para desmarcar' : 'Marcar como cobrança feita'}>
                              <input
                                type="checkbox"
                                checked={cobrancasFeitas.has(getRowKey(item))}
                                onChange={(e) => handleCobrancaToggle(getRowKey(item), e.target.checked)}
                                disabled={cobrancaToggling === getRowKey(item)}
                              />
                              <span className="cronograma-cobranca-checkbox-label">
                                {cobrancasFeitas.has(getRowKey(item)) ? 'Feita' : 'Pendente'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cronograma-empty-table">
            <p>Nenhuma entrega prevista encontrada para os critérios selecionados.</p>
          </div>
        )}
        </div>
      )}

      {/* Conteúdo da aba Atrasos */}
      {activeTab === 'atrasos' && (
        <div className="cronograma-section">
          <div className="cronograma-section-header">
            <div className="cronograma-section-title-wrapper">
              <h3 className="cronograma-section-title">Atrasos</h3>
              {atrasos.length > 0 && (
                <span className="cronograma-count-badge">{atrasos.length}</span>
              )}
            </div>
            <div className="cronograma-filters-row">
              {/* Filtro de Disciplinas para Atrasos */}
              <div className="cronograma-multi-select-wrapper">
                <button
                  type="button"
                  className="cronograma-multi-select-button"
                  onClick={() => {
                    setAtrasosDisciplinaDropdownOpen(!atrasosDisciplinaDropdownOpen);
                    setAtrasosKpiDropdownOpen(false);
                  }}
                >
                  <span>
                    {atrasosDisciplinaFilter.length === 0 
                      ? 'Todas as Disciplinas' 
                      : atrasosDisciplinaFilter.length === 1 
                        ? atrasosDisciplinaFilter[0] 
                        : `${atrasosDisciplinaFilter.length} Disciplinas selecionadas`}
                  </span>
                  <span className="cronograma-dropdown-arrow">{atrasosDisciplinaDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {atrasosDisciplinaDropdownOpen && (
                  <div className="cronograma-multi-select-dropdown">
                    <div className="cronograma-multi-select-header">
                      <label className="cronograma-select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={atrasosDisciplinaFilter.length === uniqueAtrasosDisciplinas.length && uniqueAtrasosDisciplinas.length > 0}
                          onChange={handleSelectAllAtrasosDisciplinas}
                        />
                        <span>Selecionar Todas</span>
                      </label>
                    </div>
                    <div className="cronograma-multi-select-options">
                      {uniqueAtrasosDisciplinas.map(disciplina => (
                        <label key={disciplina} className="cronograma-multi-select-option">
                          <input
                            type="checkbox"
                            checked={atrasosDisciplinaFilter.includes(disciplina)}
                            onChange={() => handleAtrasosDisciplinaToggle(disciplina)}
                          />
                          <span>{disciplina}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filtro de KPIs para Atrasos */}
              <div className="cronograma-multi-select-wrapper">
                <button
                  type="button"
                  className="cronograma-multi-select-button"
                  onClick={() => {
                    setAtrasosKpiDropdownOpen(!atrasosKpiDropdownOpen);
                    setAtrasosDisciplinaDropdownOpen(false);
                  }}
                >
                  <span>
                    {atrasosKpiFilter.length === 0 
                      ? 'Todos os KPIs' 
                      : atrasosKpiFilter.length === 1 
                        ? atrasosKpiFilter[0] 
                        : `${atrasosKpiFilter.length} KPIs selecionados`}
                  </span>
                  <span className="cronograma-dropdown-arrow">{atrasosKpiDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {atrasosKpiDropdownOpen && (
                  <div className="cronograma-multi-select-dropdown">
                    <div className="cronograma-multi-select-header">
                      <label className="cronograma-select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={atrasosKpiFilter.length === uniqueAtrasosKPIs.length && uniqueAtrasosKPIs.length > 0}
                          onChange={handleSelectAllAtrasosKPIs}
                        />
                        <span>Selecionar Todos</span>
                      </label>
                    </div>
                    <div className="cronograma-multi-select-options">
                      {uniqueAtrasosKPIs.map(kpi => {
                        const kpiClass = kpi.toLowerCase();
                        return (
                          <label key={kpi} className="cronograma-multi-select-option">
                            <input
                              type="checkbox"
                              checked={atrasosKpiFilter.includes(kpi)}
                              onChange={() => handleAtrasosKpiToggle(kpi)}
                            />
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`cronograma-kpi-badge cronograma-kpi-badge-${kpiClass}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                                {kpi}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {atrasosGrouped.length > 0 ? (
            <div className="cronograma-table-wrapper">
              <table className="cronograma-table cronograma-table-grouped">
                <thead>
                  <tr>
                    <th>Disciplina</th>
                    <th>Nome da Tarefa</th>
                    <th>Data de Término</th>
                    <th>KPI</th>
                    <th>Categoria de Atraso</th>
                    <th>Motivo de Atraso</th>
                    <th className="cronograma-th-cobranca">Cobrança</th>
                  </tr>
                </thead>
                <tbody>
                  {atrasosGrouped.map((discGroup, discIndex) => 
                    discGroup.items.map((item, itemIndex) => {
                      const kpi = String(item.KPI || '').trim();
                      const kpiClass = kpi.toLowerCase();
                      const isFirstInDisciplina = itemIndex === 0;
                      const rowSpanDisciplina = isFirstInDisciplina ? discGroup.items.length : 0;
                      
                      return (
                        <tr key={`${discIndex}-${itemIndex}`}>
                          {isFirstInDisciplina && (
                            <td 
                              rowSpan={rowSpanDisciplina}
                              className="cronograma-group-disciplina"
                            >
                              <div className="cronograma-disciplina-wrapper">
                                <span>{discGroup.disciplina}</span>
                                <div className="cronograma-disciplina-buttons">
                                  <a
                                    href={generateWhatsAppLinkAtrasos(discGroup)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cronograma-cobranca-button"
                                    title="Enviar cobrança via WhatsApp"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                    </svg>
                                    Cobrança
                                  </a>
                                  <button
                                    type="button"
                                    className="cronograma-cobranca-button cronograma-email-button"
                                    title={gmailAuthorized ? 'Criar rascunho de cobrança no Gmail' : 'Autorize o Gmail para criar rascunhos'}
                                    onClick={() => handleGmailDraft(discGroup)}
                                    disabled={gmailLoading === `${discGroup.disciplina}-atraso`}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="2" y="4" width="20" height="16" rx="2" />
                                      <path d="M22 4L12 13L2 4" />
                                    </svg>
                                    {gmailLoading === `${discGroup.disciplina}-atraso` ? 'Criando...' : 'Email'}
                                  </button>
                                </div>
                                {gmailFeedback?.key === `${discGroup.disciplina}-atraso` && (
                                  <span className={`cronograma-gmail-feedback cronograma-gmail-feedback-${gmailFeedback.type}`}>
                                    {gmailFeedback.message}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          <td>{item.NomeDaTarefa || 'N/A'}</td>
                          <td>{formatDate(item.DataDeTermino)}</td>
                          <td>
                            <span className={`cronograma-kpi-badge cronograma-kpi-badge-${kpiClass}`}>
                              {kpi || 'N/A'}
                            </span>
                          </td>
                          <td>{item.Categoria_de_atraso || 'N/A'}</td>
                          <td>{item.Motivo_de_atraso || 'N/A'}</td>
                          <td className="cronograma-td-cobranca">
                            <label className="cronograma-cobranca-checkbox" title={cobrancasFeitas.has(getRowKey(item)) ? 'Cobrança feita — clique para desmarcar' : 'Marcar como cobrança feita'}>
                              <input
                                type="checkbox"
                                checked={cobrancasFeitas.has(getRowKey(item))}
                                onChange={(e) => handleCobrancaToggle(getRowKey(item), e.target.checked)}
                                disabled={cobrancaToggling === getRowKey(item)}
                              />
                              <span className="cronograma-cobranca-checkbox-label">
                                {cobrancasFeitas.has(getRowKey(item)) ? 'Feita' : 'Pendente'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cronograma-empty-table">
              <p>Nenhum atraso registrado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CronogramaView;

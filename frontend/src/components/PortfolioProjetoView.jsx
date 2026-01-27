/**
 * Componente: Vista de Portfólio do Projeto
 * 
 * Exibe informações detalhadas do projeto selecionado
 * em formato de card com linhas de dados
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/PortfolioProjetoView.css';

function PortfolioProjetoView({ selectedProjectId, portfolio = [] }) {
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Busca o projeto selecionado do portfólio
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => String(p.construflow_id) === String(selectedProjectId));
  }, [portfolio, selectedProjectId]);

  useEffect(() => {
    if (selectedProject) {
      setProjectData(selectedProject);
      setError(null);
    } else if (selectedProjectId) {
      setError('Projeto não encontrado');
      setProjectData(null);
    } else {
      setProjectData(null);
      setError(null);
    }
  }, [selectedProject, selectedProjectId]);

  // Função auxiliar para formatar data - melhorada para lidar com diferentes formatos do BigQuery
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    // Se já for uma string formatada, retorna
    if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
      return dateValue;
    }
    
    try {
      let date;
      
      // BigQuery pode retornar como objeto com propriedades value ou como string ISO
      if (typeof dateValue === 'object' && dateValue !== null) {
        // Se for um objeto Date do BigQuery
        if (dateValue.value) {
          date = new Date(dateValue.value);
        } else if (dateValue.toISOString) {
          date = dateValue;
        } else {
          // Tenta converter objeto para string primeiro
          date = new Date(JSON.stringify(dateValue));
        }
      } else if (typeof dateValue === 'string') {
        // Tenta diferentes formatos de string
        // Formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } 
        // Formato brasileiro (DD/MM/YYYY)
        else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        }
        // Outros formatos
        else {
          date = new Date(dateValue);
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


  if (!selectedProjectId) {
    return (
      <div className="portfolio-projeto-empty">
        <p>Selecione um projeto para visualizar as informações.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="portfolio-projeto-loading">
        <p>Carregando informações do projeto...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portfolio-projeto-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="portfolio-projeto-empty">
        <p>Nenhum dado disponível para este projeto.</p>
      </div>
    );
  }

  // Mapeamento de labels em português
  const getFieldLabel = (key) => {
    const labels = {
      'project_name': 'Nome do Projeto',
      'project_code_norm': 'Código do Projeto',
      'comercial_name': 'Nome Comercial',
      'status': 'Status',
      'client': 'Cliente / Razão Social',
      'nome_time': 'Time',
      'lider': 'Líder',
      'coordenador': 'Coordenador',
      'disciplina_cliente': 'Disciplina Cliente',
      'data_inicio_cronograma': 'Data Início Cronograma',
      'data_termino_cronograma': 'Data Término Cronograma',
      'diferenca_cronograma_contrato': 'Desvio do Cronograma',
      'data_termino_contrato': 'Data Término Contrato',
      'data_termino_contrato_com_pausas': 'Data Término Contrato (c/ Pausas)',
      'duracao_contrato_total_meses': 'Duração Contrato',
      'duracao_aditivo_total_meses': 'Duração Aditivo',
      'duracao_total_meses': 'Duração Total',
      'qtd_pausas': 'Quantidade de Pausas',
      'total_dias_pausa': 'Total Dias de Pausa',
      'qtd_aditivos_distintos': 'Quantidade de Aditivos',
      'responsavel_venda': 'Responsável pela Venda (Closer)',
      'closer': 'Responsável pela Venda (Closer)',
      'data_assinatura': 'Data Assinatura',
      'escopo_contratado': 'Escopo Contratado',
      'escopo': 'Escopo Contratado',
      'endereco_obra': 'Endereço da Obra',
      'endereco': 'Endereço da Obra',
      'contato_principal': 'Contato Principal',
      'contato': 'Contato Principal',
      'tipologia': 'Tipologia',
      'area_efetiva': 'Área Efetiva',
      'area_construida': 'Área Construída',
      'unidades': 'Unidades'
    };
    
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Função auxiliar para parsear data (usa a mesma lógica do formatDate)
  const parseDateValue = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      // Se já for Date
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }
      
      // Se já for uma string formatada DD/MM/YYYY, converte
      if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        const date = new Date(`${year}-${month}-${day}`);
        return isNaN(date.getTime()) ? null : date;
      }
      
      // BigQuery pode retornar como objeto com propriedades value
      if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) {
          const date = new Date(dateValue.value);
          return isNaN(date.getTime()) ? null : date;
        } else if (dateValue.toISOString) {
          return dateValue;
        } else {
          // Tenta converter objeto para string primeiro
          const date = new Date(JSON.stringify(dateValue));
          return isNaN(date.getTime()) ? null : date;
        }
      }
      
      // Se for string ISO ou formato brasileiro
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? null : date;
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          const date = new Date(`${year}-${month}-${day}`);
          return isNaN(date.getTime()) ? null : date;
        }
      }
      
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Função para calcular diferença em meses entre duas datas (mesma lógica do PortfolioView)
  const calculateMonthDifference = (date1, date2) => {
    const d1 = parseDateValue(date1);
    const d2 = parseDateValue(date2);
    
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

  // Agrupa campos por categoria
  const getGroupedFields = () => {
    if (!projectData) return {};
    
    const excludedFields = new Set([
      'valor_contrato_total',
      'valor_aditivo_total',
      'valor_total_contrato_mais_aditivos',
      'construflow_id',
      'id_projeto',
      'data_inicio_primeira_pausa',
      'data_fim_ultima_pausa',
      // Campos relacionados a ferramentas (exibidos na aba Ferramentas)
      'dod_id',
      'dod',
      'dod_status',
      'escopo_entregas_id',
      'escopo_entregas',
      'escopo_status',
      'smartsheet_id',
      'smartsheet',
      'discord_id',
      'discord',
      'capa_email_url',
      'capa_email',
      'gantt_email_url',
      'gantt_email',
      'disciplina_email_url',
      'disciplina_email',
      'whatsapp_status',
      'whatsapp',
      'checklist_status',
      'checklist',
      'dashboard_status',
      'dashboard',
      'relatorio_semanal_status',
      'relatorio_semanal',
      // Campos que não devem aparecer em "Outras Informações"
      'project_order',
      'project_code',
      'project_id',
      'team_id',
      'time',
      'discord_coordenador'
    ]);
    
    const groups = {
      informacoesBasicas: [],
      informacoesComerciais: [],
      localizacaoContato: [],
      caracteristicas: [],
      cronograma: [],
      prazos: [],
      outros: []
    };
    
    const processedKeys = new Set();
    
    // Mapeamento de campos por categoria
    const fieldGroups = {
      // Informações Básicas
      informacoesBasicas: [
        'project_name',
        'project_code_norm',
        'comercial_name',
        'status',
        'client',
        'nome_time',
        'lider',
        'coordenador',
        'disciplina_cliente'
      ],
      // Informações Comerciais
      informacoesComerciais: [
        'responsavel_venda',
        'closer',
        'data_assinatura',
        'escopo_contratado',
        'escopo'
      ],
      // Localização e Contato
      localizacaoContato: [
        'endereco_obra',
        'endereco',
        'contato_principal',
        'contato'
      ],
      // Características do Projeto
      caracteristicas: [
        'tipologia',
        'area_efetiva',
        'area_construida',
        'unidades'
      ],
      // Cronograma
      cronograma: [
        'data_inicio_cronograma',
        'data_termino_cronograma',
        'diferenca_cronograma_contrato'
      ],
      // Prazos e Durações
      prazos: [
        'data_termino_contrato',
        'data_termino_contrato_com_pausas',
        'qtd_pausas',
        'total_dias_pausa',
        'qtd_aditivos_distintos',
        'duracao_contrato_total_meses',
        'duracao_aditivo_total_meses',
        'duracao_total_meses'
      ]
    };
    
    // Adiciona campos nas categorias
    Object.keys(fieldGroups).forEach(groupKey => {
      fieldGroups[groupKey].forEach(key => {
        if (key === 'diferenca_cronograma_contrato') {
          // Sempre tenta calcular o desvio
          let value = projectData[key];
          
          // Se não existir ou for inválido, calcula
          const terminoCronograma = projectData.data_termino_cronograma;
          const terminoContrato = projectData.data_termino_contrato;
          
          if ((value === null || value === undefined || value === '' || typeof value !== 'number') && 
              terminoCronograma && 
              terminoContrato) {
            value = calculateMonthDifference(terminoCronograma, terminoContrato);
          }
          
          // Exibe se o valor for um número válido (incluindo 0)
          if (value !== null && value !== undefined && value !== '' && typeof value === 'number' && !isNaN(value)) {
            groups[groupKey].push({ key, label: getFieldLabel(key), value });
            processedKeys.add(key);
          }
        } else if (projectData.hasOwnProperty(key) && !excludedFields.has(key)) {
          const value = projectData[key];
          if (value !== null && value !== undefined && value !== '') {
            groups[groupKey].push({ key, label: getFieldLabel(key), value });
            processedKeys.add(key);
          }
        }
      });
    });
    
    // Não adiciona outros campos não mapeados - removido conforme solicitado
    // Apenas coordenador e disciplina_cliente devem aparecer, e já estão em informacoesBasicas
    
    return groups;
  };

  const groupedFields = getGroupedFields();
  
  // Formata valores baseado no tipo
  const formatFieldValue = (field) => {
    const value = field.value;
    const key = field.key.toLowerCase();
    
    // Datas
    if (key.includes('data') || key.includes('date')) {
      return formatDate(value);
    }
    
    // Desvio do cronograma (diferença em meses)
    if (key === 'diferenca_cronograma_contrato') {
      if (value === null || value === undefined || value === '') return 'N/A';
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numValue)) return 'N/A';
      return `${numValue > 0 ? '+' : ''}${numValue} ${Math.abs(numValue) === 1 ? 'mês' : 'meses'}`;
    }
    
    // Durações em meses
    if (key.includes('duracao') && key.includes('meses')) {
      return `${value} ${value === 1 ? 'mês' : 'meses'}`;
    }
    
    // Áreas
    if (key.includes('area')) {
      return typeof value === 'number' ? `${value}m²` : value;
    }
    
    return value;
  };

  // Labels das seções
  const sectionLabels = {
    informacoesBasicas: 'Informações Básicas',
    informacoesComerciais: 'Informações Comerciais',
    localizacaoContato: 'Localização e Contato',
    caracteristicas: 'Características do Projeto',
    cronograma: 'Cronograma',
    prazos: 'Prazos e Durações',
    outros: 'Outras Informações'
  };

  // Verifica se há algum campo para exibir
  const hasAnyFields = Object.values(groupedFields).some(group => group.length > 0);

  if (!hasAnyFields) {
    return (
      <div className="portfolio-projeto-empty">
        <p>Nenhum dado disponível para exibir.</p>
      </div>
    );
  }

  return (
    <div className="portfolio-projeto-container">
      {Object.keys(groupedFields).map((groupKey, groupIndex) => {
        const fields = groupedFields[groupKey];
        if (fields.length === 0) return null;

        return (
          <div key={groupKey} className="portfolio-projeto-section">
            {groupIndex > 0 && <div className="portfolio-projeto-section-divider"></div>}
            <h3 className="portfolio-projeto-section-title">{sectionLabels[groupKey]}</h3>
            <div className="portfolio-projeto-grid">
              {fields.map((field) => (
                <div key={field.key} className="portfolio-projeto-row">
                  <div className="portfolio-projeto-label">{field.label}</div>
                  <div className="portfolio-projeto-value">
                    {field.key.toLowerCase().includes('escopo') && field.value !== 'N/A' ? (
                      <a href="#" className="portfolio-projeto-link">{formatFieldValue(field)}</a>
                    ) : (
                      formatFieldValue(field)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PortfolioProjetoView;

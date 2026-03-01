/**
 * Componente: Vista de Portfólio do Projeto
 *
 * Design profissional com:
 * - Hero card destacado com identidade do projeto
 * - KPI cards para cronograma
 * - Key-value lists para demais seções
 * - Campos vazios são filtrados (não aparecem)
 */

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useAuth } from '../contexts/AuthContext';
import StatusDropdown, { getStatusColor } from './StatusDropdown';
import '../styles/PortfolioProjetoView.css';

// Icone de lapis SVG inline
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

function PortfolioProjetoView({ selectedProjectId, portfolio = [] }) {
  const [projectData, setProjectData] = useState(null);
  const [error, setError] = useState(null);
  const [editingField, setEditingField] = useState(null); // 'comercial_name' | 'status'

  const { hasFullAccess } = useAuth();
  const { updatePortfolioField, savedCell, errorCell } = usePortfolio();
  const canEdit = hasFullAccess;

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio || portfolio.length === 0) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
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

  // Formatar data
  const formatDate = (dateValue) => {
    if (!dateValue) return null;
    if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) return dateValue;
    try {
      let date;
      if (typeof dateValue === 'object' && dateValue !== null) {
        date = dateValue.value ? new Date(dateValue.value) : dateValue.toISOString ? dateValue : new Date(JSON.stringify(dateValue));
      } else if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          date = new Date(dateValue);
        } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(`${year}-${month}-${day}`);
        } else {
          date = new Date(dateValue);
        }
      } else {
        date = new Date(dateValue);
      }
      return isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
    } catch {
      return null;
    }
  };

  const parseDateValue = (dateValue) => {
    if (!dateValue) return null;
    try {
      if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;
      if (typeof dateValue === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        const d = new Date(`${year}-${month}-${day}`);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof dateValue === 'object' && dateValue !== null) {
        if (dateValue.value) { const d = new Date(dateValue.value); return isNaN(d.getTime()) ? null : d; }
        if (dateValue.toISOString) return dateValue;
        const d = new Date(JSON.stringify(dateValue));
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          const d = new Date(dateValue); return isNaN(d.getTime()) ? null : d;
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateValue)) {
          const [day, month, year] = dateValue.split('/');
          const d = new Date(`${year}-${month}-${day}`);
          return isNaN(d.getTime()) ? null : d;
        }
      }
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  };

  const calculateMonthDifference = (date1, date2) => {
    const d1 = parseDateValue(date1);
    const d2 = parseDateValue(date2);
    if (!d1 || !d2) return null;
    const yearDiff = d1.getFullYear() - d2.getFullYear();
    const monthDiff = d1.getMonth() - d2.getMonth();
    const totalMonths = yearDiff * 12 + monthDiff;
    const dayDiff = d1.getDate() - d2.getDate();
    if (dayDiff > 15) return totalMonths + 1;
    if (dayDiff < -15) return totalMonths - 1;
    return totalMonths;
  };

  // Classificar status para badge
  const getStatusType = (status) => {
    if (!status) return 'default';
    const s = String(status).toLowerCase().trim();
    if (['close', 'obra finalizada', 'encerrado', 'finalizado', 'concluído', 'concluido', 'cancelado'].some(x => s.includes(x))) return 'closed';
    if (['pausado', 'pausa', 'em pausa', 'suspenso', 'suspensão'].some(x => s.includes(x))) return 'paused';
    if (['execução', 'execucao', 'em andamento', 'ativo'].some(x => s.includes(x))) return 'active';
    return 'default';
  };

  if (!selectedProjectId) {
    return <div className="ppv-empty"><p>Selecione um projeto para visualizar as informações.</p></div>;
  }
  if (error) {
    return <div className="ppv-error"><p>{error}</p></div>;
  }
  if (!projectData) {
    return <div className="ppv-empty"><p>Nenhum dado disponível para este projeto.</p></div>;
  }

  // Extrair dados do hero
  const heroData = {
    name: projectData.project_name,
    code: projectData.project_code_norm,
    status: projectData.status,
    client: projectData.client,
    team: projectData.nome_time,
    leader: projectData.lider,
    coordinator: projectData.coordenador,
    comercialName: projectData.comercial_name,
    disciplinaCliente: projectData.disciplina_cliente,
  };

  // Calcular desvio cronograma
  let desvioValue = projectData.diferenca_cronograma_contrato;
  const terminoCronograma = projectData.data_termino_cronograma;
  const terminoContrato = projectData.data_termino_contrato_com_pausas || projectData.data_termino_contrato;
  if ((desvioValue === null || desvioValue === undefined || desvioValue === '' || typeof desvioValue !== 'number') && terminoCronograma && terminoContrato) {
    desvioValue = calculateMonthDifference(terminoCronograma, terminoContrato);
  }

  // KPI Cards para cronograma
  const cronogramaKPIs = [
    { label: 'Início Cronograma', value: formatDate(projectData.data_inicio_cronograma) },
    { label: 'Término Cronograma', value: formatDate(projectData.data_termino_cronograma) },
    {
      label: 'Desvio',
      value: (typeof desvioValue === 'number' && !isNaN(desvioValue))
        ? `${desvioValue > 0 ? '+' : ''}${desvioValue} ${Math.abs(desvioValue) === 1 ? 'mês' : 'meses'}`
        : null,
      type: (typeof desvioValue === 'number' && !isNaN(desvioValue))
        ? (desvioValue >= 3 ? 'danger' : desvioValue >= 1 ? 'warning' : 'success')
        : null
    },
  ].filter(k => k.value);

  // Labels
  const labels = {
    'data_termino_contrato': 'Término Contrato',
    'data_termino_contrato_com_pausas': 'Término c/ Pausas',
    'qtd_pausas': 'Qtd. Pausas',
    'total_dias_pausa': 'Total Dias Pausa',
    'qtd_aditivos_distintos': 'Qtd. Aditivos',
    'duracao_contrato_total_meses': 'Duração Contrato',
    'duracao_aditivo_total_meses': 'Duração Aditivo',
    'duracao_total_meses': 'Duração Total',
    'responsavel_venda': 'Responsável Venda',
    'closer': 'Closer',
    'data_assinatura': 'Data Assinatura',
    'escopo_contratado': 'Escopo Contratado',
    'escopo': 'Escopo Contratado',
    'endereco_obra': 'Endereço da Obra',
    'endereco': 'Endereço',
    'contato_principal': 'Contato Principal',
    'contato': 'Contato',
    'tipologia': 'Tipologia',
    'area_efetiva': 'Área Efetiva',
    'area_construida': 'Área Construída',
    'unidades': 'Unidades',
  };

  // Formatar valor
  const fmt = (key, val) => {
    if (val === null || val === undefined || val === '') return null;
    const k = key.toLowerCase();
    if (k.includes('data') || k.includes('date')) return formatDate(val);
    if (k.includes('duracao') && k.includes('meses')) return `${val} ${val === 1 ? 'mês' : 'meses'}`;
    if (k.includes('area')) return typeof val === 'number' ? `${val.toLocaleString('pt-BR')}m²` : val;
    return val;
  };

  // Seções key-value (filtrar vazios)
  const buildSection = (fieldKeys) => {
    return fieldKeys
      .map(key => {
        const raw = projectData[key];
        const formatted = fmt(key, raw);
        if (!formatted && formatted !== 0) return null;
        return { key, label: labels[key] || key, value: formatted };
      })
      .filter(Boolean);
  };

  const prazosFields = buildSection([
    'data_termino_contrato', 'data_termino_contrato_com_pausas',
    'qtd_pausas', 'total_dias_pausa', 'qtd_aditivos_distintos',
    'duracao_contrato_total_meses', 'duracao_aditivo_total_meses', 'duracao_total_meses',
  ]);

  const comercialFields = buildSection([
    'responsavel_venda', 'closer', 'data_assinatura', 'escopo_contratado', 'escopo',
  ]);

  const localizacaoFields = buildSection([
    'endereco_obra', 'endereco', 'contato_principal', 'contato',
  ]);

  const caracteristicasFields = buildSection([
    'tipologia', 'area_efetiva', 'area_construida', 'unidades',
  ]);

  const statusType = getStatusType(heroData.status);

  // Sub-info do hero (itens separados por ·)
  const heroMeta = [heroData.code, heroData.client, heroData.team].filter(Boolean);
  const heroLeaders = [
    heroData.leader && `Líder: ${heroData.leader}`,
    heroData.coordinator && `Coord: ${heroData.coordinator}`,
  ].filter(Boolean);

  // Feedback de edicao
  const projectCode = heroData.code;
  const comercialSaved = savedCell?.projectCode === projectCode && savedCell?.field === 'comercial_name';
  const comercialError = errorCell?.projectCode === projectCode && errorCell?.field === 'comercial_name' ? errorCell : null;
  const statusSaved = savedCell?.projectCode === projectCode && savedCell?.field === 'status';
  const statusError = errorCell?.projectCode === projectCode && errorCell?.field === 'status' ? errorCell : null;

  return (
    <div className="ppv-container">
      {/* Hero Card */}
      <div className="ppv-hero">
        <div className="ppv-hero-glow"></div>
        <div className="ppv-hero-content">
          <div className="ppv-hero-top">
            <h2 className="ppv-hero-name">{heroData.name || heroData.code}</h2>
            {heroData.status && (
              <span className={`ppv-status-badge ppv-status-${statusType}`}>
                <span className="ppv-status-dot"></span>
                {heroData.status}
              </span>
            )}
          </div>
          {heroMeta.length > 0 && (
            <p className="ppv-hero-meta">{heroMeta.join(' · ')}</p>
          )}

          {/* Tags: Lider, Coord, Disciplina */}
          {(heroLeaders.length > 0 || heroData.disciplinaCliente) && (
            <div className="ppv-hero-leaders">
              {heroLeaders.map((text, i) => (
                <span key={i} className={`ppv-hero-leader-tag ${text.startsWith('Líder') ? 'ppv-tag-lider' : 'ppv-tag-coord'}`}>{text}</span>
              ))}
              {heroData.disciplinaCliente && (
                <span className="ppv-hero-leader-tag ppv-tag-disciplina">{heroData.disciplinaCliente}</span>
              )}
            </div>
          )}

          {/* Campo editavel: Nome Comercial */}
          <div
            className={`ppv-editable-field${comercialSaved ? ' ppv-editable-saved' : ''}${comercialError ? ' ppv-editable-error' : ''}${editingField === 'comercial_name' ? ' ppv-editable-active' : ''}`}
            onClick={() => canEdit && editingField !== 'comercial_name' && setEditingField('comercial_name')}
            title={canEdit ? 'Clique para editar' : ''}
          >
            <span className="ppv-editable-label">Nome comercial</span>
            {editingField === 'comercial_name' ? (
              <input
                type="text"
                className="ppv-editable-input"
                defaultValue={heroData.comercialName || ''}
                autoFocus
                onBlur={(e) => {
                  const newVal = e.target.value.trim();
                  if (newVal !== (heroData.comercialName || '')) {
                    updatePortfolioField(projectCode, 'comercial_name', newVal, heroData.comercialName);
                  }
                  setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setEditingField(null);
                }}
              />
            ) : (
              <div className="ppv-editable-value-row">
                <span className={heroData.comercialName ? 'ppv-editable-value' : 'ppv-editable-placeholder'}>
                  {heroData.comercialName || 'Definir nome comercial'}
                </span>
                {canEdit && <span className="ppv-editable-icon"><PencilIcon /></span>}
                {comercialSaved && <span className="ppv-editable-check">&#10003;</span>}
                {comercialError && <span className="ppv-editable-error-msg">{comercialError.message}</span>}
              </div>
            )}
          </div>

          {/* Campo editavel: Fase Atual */}
          <div
            className={`ppv-editable-field${statusSaved ? ' ppv-editable-saved' : ''}${statusError ? ' ppv-editable-error' : ''}${editingField === 'status' ? ' ppv-editable-active' : ''}`}
            title={canEdit ? 'Clique para editar' : ''}
          >
            <span className="ppv-editable-label">Fase atual</span>
            {editingField === 'status' ? (
              <StatusDropdown
                value={heroData.status}
                onChange={(newVal) => {
                  updatePortfolioField(projectCode, 'status', newVal, heroData.status);
                  setEditingField(null);
                }}
                inline
                defaultOpen
              />
            ) : (
              <div
                className="ppv-editable-value-row"
                onClick={() => canEdit && setEditingField('status')}
              >
                <span className={heroData.status ? 'ppv-editable-value' : 'ppv-editable-placeholder'}>
                  {heroData.status || 'Definir fase'}
                </span>
                {canEdit && <span className="ppv-editable-icon"><PencilIcon /></span>}
                {statusSaved && <span className="ppv-editable-check">&#10003;</span>}
                {statusError && <span className="ppv-editable-error-msg">{statusError.message}</span>}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* KPI Cards - Cronograma */}
      {cronogramaKPIs.length > 0 && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Cronograma</h4>
          <div className="ppv-kpi-grid">
            {cronogramaKPIs.map(kpi => (
              <div key={kpi.label} className={`ppv-kpi-card ${kpi.type ? `ppv-kpi-${kpi.type}` : ''}`}>
                <div className="ppv-kpi-glow"></div>
                <span className="ppv-kpi-label">{kpi.label}</span>
                <span className={`ppv-kpi-value ${kpi.type ? `ppv-kpi-value-${kpi.type}` : ''}`}>{kpi.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prazos e Durações */}
      {prazosFields.length > 0 && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Prazos e Durações</h4>
          <div className="ppv-kv-list">
            {prazosFields.map(f => (
              <div key={f.key} className="ppv-kv-row">
                <span className="ppv-kv-label">{f.label}</span>
                <span className="ppv-kv-value">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Informações Comerciais */}
      {comercialFields.length > 0 && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Informações Comerciais</h4>
          <div className="ppv-kv-list">
            {comercialFields.map(f => (
              <div key={f.key} className="ppv-kv-row">
                <span className="ppv-kv-label">{f.label}</span>
                <span className="ppv-kv-value">
                  {f.key.includes('escopo') ? (
                    <a href="#" className="ppv-link">{f.value}</a>
                  ) : f.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Localização e Contato */}
      {localizacaoFields.length > 0 && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Localização e Contato</h4>
          <div className="ppv-kv-list">
            {localizacaoFields.map(f => (
              <div key={f.key} className="ppv-kv-row">
                <span className="ppv-kv-label">{f.label}</span>
                <span className="ppv-kv-value">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Características do Projeto */}
      {caracteristicasFields.length > 0 && (
        <section className="ppv-section">
          <h4 className="ppv-section-title">Características do Projeto</h4>
          <div className="ppv-chars-grid">
            {caracteristicasFields.map(f => (
              <div key={f.key} className="ppv-char-item">
                <span className="ppv-char-label">{f.label}</span>
                <span className="ppv-char-value">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default PortfolioProjetoView;

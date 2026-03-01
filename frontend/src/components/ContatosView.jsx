/**
 * Componente: Vista de Contatos
 *
 * Exibe dados agregados de disciplina/empresa com:
 * - Filtros por disciplina, empresa e projeto
 * - Tabela com contagem de projetos por combinação disciplina/empresa
 * - Card expandido com detalhes de contatos e projetos ao clicar
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/ContatosView.css';
import { formatPhoneDisplay } from '../utils/phone-utils';

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

// Status que representam projetos pausados (case-insensitive)
const PAUSED_STATUSES = [
  'pausado',
  'pausa',
  'em pausa',
  'pausado pelo cliente',
  'suspenso',
  'suspensão'
];

// Função auxiliar para verificar se um status é finalizado ou pausado
const isInactiveStatus = (status) => {
  if (!status) return false;
  const statusLower = String(status).toLowerCase().trim();
  const allInactiveStatuses = [...FINALIZED_STATUSES, ...PAUSED_STATUSES];
  return allInactiveStatuses.some(inactiveStatus =>
    statusLower === inactiveStatus.toLowerCase().trim() ||
    statusLower.includes(inactiveStatus.toLowerCase().trim())
  );
};

// Componente de ícone de alerta para empresas pendentes
const PendingAlert = ({ tooltip }) => (
  <span className="contatos-pending-alert" title={tooltip || "Empresa com cadastro pendente"}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L2 22h20L12 2z"
        fill="#F59E0B"
        stroke="#D97706"
        strokeWidth="1"
      />
      <path
        d="M12 9v5"
        stroke="#1F2937"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="#1F2937" />
    </svg>
  </span>
);

function ContatosView() {
  // Estados dos dados
  const [dados, setDados] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados dos filtros
  const [filtros, setFiltros] = useState({
    discipline_id: '',
    company_id: '',
    project_id: ''
  });

  // Estado do card de detalhes
  const [detalhes, setDetalhes] = useState(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  // Estado das seções expansíveis (expandidas por padrão)
  const [expandedSections, setExpandedSections] = useState({
    contatos: true,
    projetos: true
  });

  // Estado do filtro de projetos ativos
  const [showOnlyActiveProjects, setShowOnlyActiveProjects] = useState(true);

  // Toggle de seção expansível
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Busca dados auxiliares para os filtros (diretamente das tabelas fonte)
  const fetchFiltrosData = useCallback(async () => {
    try {
      const [discRes, empRes, projRes] = await Promise.all([
        axios.get(`${API_URL}/api/contatos/filtros/disciplinas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/contatos/filtros/empresas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/contatos/filtros/projetos`, { withCredentials: true })
      ]);

      setDisciplinas(discRes.data.data || []);
      setEmpresas(empRes.data.data || []);
      setProjetos(projRes.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados dos filtros:', err);
    }
  }, []);

  // Busca dados agregados
  const fetchDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (filtros.discipline_id) params.discipline_id = filtros.discipline_id;
      if (filtros.company_id) params.company_id = filtros.company_id;
      if (filtros.project_id) params.project_id = filtros.project_id;

      const response = await axios.get(`${API_URL}/api/contatos/agregado`, {
        params,
        withCredentials: true
      });

      setDados(response.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar dados de contatos');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  // Busca detalhes de uma linha
  const fetchDetalhes = async (disciplineId, companyId) => {
    setLoadingDetalhes(true);

    try {
      const response = await axios.get(`${API_URL}/api/contatos/detalhes`, {
        params: { discipline_id: disciplineId, company_id: companyId },
        withCredentials: true
      });

      setDetalhes(response.data.data);
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      setDetalhes(null);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  // Carrega dados ao montar
  useEffect(() => {
    fetchFiltrosData();
  }, [fetchFiltrosData]);

  // Recarrega quando filtros mudam
  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  // Atualiza filtro
  const handleFiltroChange = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
    // Fecha detalhes ao mudar filtro
    setDetalhes(null);
    setSelectedRow(null);
  };

  // Limpa todos os filtros
  const handleLimparFiltros = () => {
    setFiltros({
      discipline_id: '',
      company_id: '',
      project_id: ''
    });
    setDetalhes(null);
    setSelectedRow(null);
  };

  // Clica em uma linha da tabela
  const handleRowClick = (item) => {
    const key = `${item.discipline_id}-${item.company_id}`;

    if (selectedRow === key) {
      // Fecha se clicar na mesma linha
      setSelectedRow(null);
      setDetalhes(null);
    } else {
      setSelectedRow(key);
      fetchDetalhes(item.discipline_id, item.company_id);
    }
  };

  // Verifica se tem filtros ativos
  const temFiltrosAtivos = filtros.discipline_id || filtros.company_id || filtros.project_id;

  return (
    <div className="contatos-container">
      {/* Cabeçalho */}
      <div className="contatos-header">
        <div className="contatos-header-left">
          <h2 className="contatos-title">Contatos por Disciplina</h2>
          <span className="contatos-subtitle">
            Visualize empresas e contatos organizados por disciplina
          </span>
        </div>
      </div>

      {/* Filtros */}
      <div className="contatos-filters">
        <div className="contatos-filters-row">
          <div className="contatos-filter-group">
            <label>Disciplina</label>
            <select
              value={filtros.discipline_id}
              onChange={(e) => handleFiltroChange('discipline_id', e.target.value)}
            >
              <option value="">Todas as disciplinas</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>{d.discipline_name}</option>
              ))}
            </select>
          </div>

          <div className="contatos-filter-group">
            <label>Empresa</label>
            <select
              value={filtros.company_id}
              onChange={(e) => handleFiltroChange('company_id', e.target.value)}
            >
              <option value="">Todas as empresas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="contatos-filter-group">
            <label>Projeto</label>
            <select
              value={filtros.project_id}
              onChange={(e) => handleFiltroChange('project_id', e.target.value)}
            >
              <option value="">Todos os projetos</option>
              {projetos
                .filter((p) => p.sector === 'Projetos')
                .filter((p) => !showOnlyActiveProjects || !isInactiveStatus(p.status))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Toggle para mostrar apenas projetos ativos */}
          <label className="contatos-active-toggle">
            <input
              type="checkbox"
              checked={showOnlyActiveProjects}
              onChange={(e) => {
                setShowOnlyActiveProjects(e.target.checked);
                // Se o projeto selecionado for inativo e o filtro for ativado, limpa a seleção
                if (e.target.checked && filtros.project_id) {
                  const selectedProject = projetos.find(p => p.id === filtros.project_id);
                  if (selectedProject && isInactiveStatus(selectedProject.status)) {
                    handleFiltroChange('project_id', '');
                  }
                }
              }}
            />
            <span className="contatos-active-toggle-slider"></span>
            <span className="contatos-active-toggle-label">Somente Ativos</span>
          </label>

          {temFiltrosAtivos && (
            <button className="contatos-clear-btn" onClick={handleLimparFiltros}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="contatos-content">
        {/* Tabela */}
        <div className="contatos-table-section">
          {loading && (
            <div className="contatos-loading">
              <div className="contatos-loading-spinner"></div>
              <span>Carregando dados...</span>
            </div>
          )}

          {error && (
            <div className="contatos-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="contatos-table-header">
                <span className="contatos-count">
                  {dados.length} {dados.length === 1 ? 'resultado' : 'resultados'}
                </span>
                <span className="contatos-hint">
                  Clique em uma linha para ver os contatos e projetos
                </span>
              </div>

              <div className="contatos-table-wrapper">
                <table className="contatos-table">
                  <thead>
                    <tr>
                      <th>Disciplina</th>
                      <th>Empresa</th>
                      <th className="contatos-th-center">Projetos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="contatos-empty-row">
                          <div className="contatos-empty-content">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span>Nenhum registro encontrado</span>
                            {temFiltrosAtivos && (
                              <button className="contatos-empty-clear" onClick={handleLimparFiltros}>
                                Limpar filtros
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      dados.map((item) => {
                        const key = `${item.discipline_id}-${item.company_id}`;
                        const isSelected = selectedRow === key;

                        return (
                          <tr
                            key={key}
                            className={`contatos-row ${isSelected ? 'contatos-row-selected' : ''}`}
                            onClick={() => handleRowClick(item)}
                          >
                            <td>
                              <span className="contatos-discipline-name">
                                {item.discipline_name}
                              </span>
                            </td>
                            <td>
                              <div className="contatos-company-cell">
                                <span className="contatos-company-name">{item.company_name}</span>
                                {item.company_status === 'pendente' && (
                                  <PendingAlert tooltip="Empresa com cadastro pendente" />
                                )}
                              </div>
                            </td>
                            <td className="contatos-td-center">
                              <span className="contatos-project-count">
                                {item.project_count}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Card de detalhes */}
        {selectedRow && (
          <div className="contatos-details-section">
            {loadingDetalhes ? (
              <div className="contatos-details-loading">
                <div className="contatos-loading-spinner"></div>
                <span>Carregando detalhes...</span>
              </div>
            ) : detalhes ? (
              <div className="contatos-details-card">
                {/* Header compacto */}
                <div className="contatos-details-header-compact">
                  <div className="contatos-details-info">
                    <span className="contatos-details-discipline">{detalhes.discipline?.discipline_name}</span>
                    <span className="contatos-details-separator">•</span>
                    <span className="contatos-details-company-name">
                      {detalhes.company?.name}
                      {detalhes.company?.status === 'pendente' && (
                        <PendingAlert tooltip="Empresa com cadastro pendente" />
                      )}
                    </span>
                  </div>
                  <button
                    className="contatos-details-close-compact"
                    onClick={() => { setSelectedRow(null); setDetalhes(null); }}
                    title="Fechar"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Seção Contatos - Expansível */}
                <div className="contatos-expandable-section">
                  <button
                    className="contatos-expandable-header"
                    onClick={() => toggleSection('contatos')}
                  >
                    <div className="contatos-expandable-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>Contatos ({detalhes.contacts?.length || 0})</span>
                    </div>
                    <svg
                      className={`contatos-expandable-icon ${expandedSections.contatos ? 'expanded' : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {expandedSections.contatos && (
                    <div className="contatos-expandable-content">
                      {detalhes.contacts?.length > 0 ? (
                        <div className="contatos-details-list">
                          {detalhes.contacts.map((contato) => (
                            <div key={contato.id} className="contatos-contact-item">
                              <div className="contatos-contact-name-group">
                                <span className="contatos-contact-name">{contato.name}</span>
                                {contato.position && (
                                  <span className="contatos-contact-position">{contato.position}</span>
                                )}
                              </div>
                              {contato.email && (
                                <a href={`mailto:${contato.email}`} className="contatos-contact-email">
                                  {contato.email}
                                </a>
                              )}
                              {contato.phone && (
                                <a
                                  href={`https://wa.me/55${contato.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="contatos-whatsapp-link"
                                  title="Abrir conversa no WhatsApp"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                  {formatPhoneDisplay(contato.phone)}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="contatos-details-empty">
                          Nenhum contato cadastrado
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Seção Projetos - Expansível */}
                <div className="contatos-expandable-section">
                  <button
                    className="contatos-expandable-header"
                    onClick={() => toggleSection('projetos')}
                  >
                    <div className="contatos-expandable-title">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>Projetos ({detalhes.projects?.length || 0})</span>
                    </div>
                    <svg
                      className={`contatos-expandable-icon ${expandedSections.projetos ? 'expanded' : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {expandedSections.projetos && (
                    <div className="contatos-expandable-content">
                      {detalhes.projects?.length > 0 ? (
                        <div className="contatos-projects-list">
                          {detalhes.projects.map((projeto) => (
                            <div key={projeto.id} className="contatos-project-item-detailed">
                              <span className="contatos-project-name">{projeto.name}</span>
                              {projeto.contact_names?.length > 0 && (
                                <span className="contatos-project-contact">
                                  {projeto.contact_names.join(', ')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="contatos-details-empty">
                          Nenhum projeto encontrado
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="contatos-details-error">
                Erro ao carregar detalhes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ContatosView;

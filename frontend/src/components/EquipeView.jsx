/**
 * Componente: Vista de Equipe do Projeto
 *
 * Exibe a tabela de disciplinas/equipe do projeto com:
 * - Disciplina, Empresa, Nome, Cargo, Email, Telefone, Detalhes
 * - Funcionalidade de adicionar, editar e remover membros
 * - Indicador visual de status da empresa (pendente/validado)
 * - Painel de cobertura de disciplinas (Smartsheet x ConstruFlow x Otus)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import DisciplineCoveragePanel from './DisciplineCoveragePanel';
import '../styles/EquipeView.css';

// Componente de ícone de alerta para empresas pendentes
const PendingAlert = ({ tooltip }) => (
  <span className="equipe-pending-alert" title={tooltip || "Empresa com cadastro pendente"}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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

function EquipeView({ selectedProjectId, portfolio = [] }) {
  const [equipe, setEquipe] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estado da subaba ativa
  const [activeTab, setActiveTab] = useState('cadastro');

  // Estado da análise cruzada
  const [crossRef, setCrossRef] = useState(null);
  const [crossRefLoading, setCrossRefLoading] = useState(false);

  // Deriva o projeto selecionado do portfolio (para smartsheet_id e project_name)
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !portfolio.length) return null;
    return portfolio.find(p => p.project_code_norm === selectedProjectId);
  }, [portfolio, selectedProjectId]);

  // Estado do modal de adicionar/editar
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    discipline_id: '',
    company_id: '',
    contact_id: '',
    discipline_detail: '',
    email: '',
    phone: '',
    position: ''
  });

  // Busca dados auxiliares (disciplinas, empresas, contatos)
  const fetchAuxData = useCallback(async () => {
    try {
      const [discRes, empRes, contRes] = await Promise.all([
        axios.get(`${API_URL}/api/projetos/equipe/disciplinas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/projetos/equipe/empresas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/projetos/equipe/contatos`, { withCredentials: true })
      ]);

      setDisciplinas(discRes.data.data || []);
      setEmpresas(empRes.data.data || []);
      setContatos(contRes.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados auxiliares:', err);
    }
  }, []);

  const construflowId = selectedProject?.construflow_id || null;

  // Busca equipe do projeto
  const fetchEquipe = useCallback(async () => {
    if (!construflowId) {
      setEquipe([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe`, {
        params: { projectId: construflowId },
        withCredentials: true
      });
      // Ordena por nome da disciplina alfabeticamente
      const data = response.data.data || [];
      const sortedData = [...data].sort((a, b) => {
        const nameA = a.discipline?.discipline_name || '';
        const nameB = b.discipline?.discipline_name || '';
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      setEquipe(sortedData);
    } catch (err) {
      console.error('Erro ao buscar equipe:', err);
      setError('Erro ao carregar equipe do projeto');
    } finally {
      setLoading(false);
    }
  }, [construflowId]);

  // Busca análise cruzada de disciplinas
  const fetchCrossRef = useCallback(async () => {
    if (!construflowId) {
      setCrossRef(null);
      return;
    }
    setCrossRefLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe/disciplinas-cruzadas`, {
        params: {
          construflowId,
          smartsheetId: selectedProject?.smartsheet_id || '',
          projectName: selectedProject?.project_name || selectedProject?.project_code_norm || ''
        },
        withCredentials: true
      });
      setCrossRef(response.data.data || null);
    } catch (err) {
      console.error('Erro ao buscar análise cruzada:', err);
      setCrossRef(null);
    } finally {
      setCrossRefLoading(false);
    }
  }, [construflowId, selectedProject]);

  // Carrega dados ao montar e quando o projeto muda
  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  useEffect(() => {
    fetchEquipe();
    fetchCrossRef();
  }, [fetchEquipe, fetchCrossRef]);

  // Quick-add: abre modal com disciplina pré-selecionada (do painel de cobertura)
  const handleQuickAdd = (disciplineName) => {
    // Normaliza para buscar match na lista de disciplinas padrão
    const normalizedTarget = disciplineName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const match = disciplinas.find(d => {
      const normalized = d.discipline_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      return normalized === normalizedTarget;
    });

    setEditingItem(null);
    setFormData({
      discipline_id: match?.id || '',
      company_id: '',
      contact_id: '',
      discipline_detail: '',
      email: '',
      phone: '',
      position: ''
    });
    setShowModal(true);
  };

  // Abre modal para adicionar
  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      discipline_id: '',
      company_id: '',
      contact_id: '',
      discipline_detail: '',
      email: '',
      phone: '',
      position: ''
    });
    setShowModal(true);
  };

  // Abre modal para editar
  const handleEdit = (item) => {
    setEditingItem(item);
    // Prioriza dados de project_disciplines, fallback para contacts
    setFormData({
      discipline_id: item.discipline_id || '',
      company_id: item.company_id || '',
      contact_id: item.contact_id || '',
      discipline_detail: item.discipline_detail || '',
      email: item.email || item.contact?.email || '',
      phone: item.phone || item.contact?.phone || '',
      position: item.position || item.contact?.position || ''
    });
    setShowModal(true);
  };

  // Atualiza campos quando o contato é alterado
  const handleContactChange = (contactId) => {
    // Converte para string para comparação consistente
    const contact = contatos.find(c => String(c.id) === String(contactId));
    setFormData(prev => ({
      ...prev,
      contact_id: contactId,
      // Preenche com dados do contato selecionado (ou vazio se não encontrar)
      email: contact?.email || '',
      phone: contact?.phone || '',
      position: contact?.position || ''
    }));
  };

  // Salva (criar ou atualizar)
  const handleSave = async () => {
    if (!formData.discipline_id) {
      alert('Selecione uma disciplina');
      return;
    }

    try {
      if (editingItem) {
        // Na edição, envia apenas os campos permitidos
        await axios.put(`${API_URL}/api/projetos/equipe/${editingItem.id}`, {
          contact_id: formData.contact_id,
          discipline_detail: formData.discipline_detail,
          email: formData.email,
          phone: formData.phone,
          position: formData.position
        }, {
          withCredentials: true
        });
      } else {
        await axios.post(`${API_URL}/api/projetos/equipe`, {
          ...formData,
          construflow_id: construflowId
        }, {
          withCredentials: true
        });
      }

      setShowModal(false);
      fetchEquipe();
      fetchCrossRef();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar. Tente novamente.');
    }
  };

  // Desativa item (soft delete)
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja desativar esta disciplina da equipe?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/projetos/equipe/${id}`, {
        withCredentials: true
      });
      fetchEquipe();
      fetchCrossRef();
    } catch (err) {
      console.error('Erro ao desativar:', err);
      alert('Erro ao desativar. Tente novamente.');
    }
  };

  // Retorna empresa selecionada atual
  const getSelectedCompany = () => {
    return empresas.find(e => e.id === formData.company_id);
  };

  // Retorna contatos filtrados pela empresa selecionada
  const getFilteredContacts = () => {
    if (!formData.company_id) {
      return []; // Sem empresa selecionada, não mostra contatos
    }
    // Converte para string para comparação consistente
    const companyId = String(formData.company_id);
    return contatos.filter(c => String(c.company_id) === companyId);
  };

  // Retorna nome da disciplina pelo ID
  const getDisciplineName = (id) => {
    const disc = disciplinas.find(d => d.id === id);
    return disc?.discipline_name || '-';
  };

  // Retorna nome da empresa pelo ID
  const getCompanyName = (id) => {
    const emp = empresas.find(e => e.id === id);
    return emp?.name || '-';
  };

  if (!selectedProjectId) {
    return (
      <div className="equipe-container">
        <div className="equipe-empty-state">
          <div className="equipe-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="equipe-empty-text">Selecione um projeto para ver a equipe</p>
        </div>
      </div>
    );
  }

  // Contagem de pendentes para badge na aba Controle
  const pendingCount = crossRef?.analysis?.missingFromOtus?.length || 0;

  return (
    <div className="equipe-container">
      {/* Subabas: Cadastro | Controle */}
      <div className="equipe-tabs-container">
        <div className="equipe-tabs-header">
          <button
            type="button"
            onClick={() => setActiveTab('cadastro')}
            className={`equipe-tab ${activeTab === 'cadastro' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Cadastro da Equipe
            <span className="equipe-tab-badge">{equipe.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controle')}
            className={`equipe-tab ${activeTab === 'controle' ? 'active' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Controle de Disciplinas
            {pendingCount > 0 && (
              <span className="equipe-tab-badge equipe-tab-badge--alert">{pendingCount}</span>
            )}
          </button>
        </div>

        <div className="equipe-tabs-content">
          {/* ===== ABA CADASTRO ===== */}
          {activeTab === 'cadastro' && (
            <div className="equipe-tab-panel">
              <div className="equipe-header">
                <div className="equipe-header-left">
                  <h3 className="equipe-title">Equipe do Projeto</h3>
                  <span className="equipe-count">{equipe.length} {equipe.length === 1 ? 'membro' : 'membros'}</span>
                </div>
                <button className="equipe-add-btn" onClick={handleAdd}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Adicionar
                </button>
              </div>

              {loading && (
                <div className="equipe-loading">
                  <div className="equipe-loading-spinner"></div>
                  <span>Carregando equipe...</span>
                </div>
              )}

              {error && (
                <div className="equipe-error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="equipe-table-wrapper">
                  <table className="equipe-table">
                    <thead>
                      <tr>
                        <th>Disciplina</th>
                        <th>Empresa</th>
                        <th>Contato</th>
                        <th>Cargo</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Detalhes</th>
                        <th className="equipe-th-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipe.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="equipe-empty-row">
                            <div className="equipe-empty-row-content">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                              </svg>
                              <span>
                                {crossRef && crossRef.analysis.totalExternal > 0
                                  ? `Encontramos ${crossRef.analysis.totalExternal} disciplinas nos sistemas externos. Comece registrando a equipe.`
                                  : 'Nenhuma equipe cadastrada para este projeto'
                                }
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        equipe.map((item) => {
                          const email = item.email || item.contact?.email;
                          const phone = item.phone || item.contact?.phone;
                          const position = item.position || item.contact?.position;

                          const hasCompany = !!item.company?.name;
                          const hasContact = !!item.contact?.name;
                          const completeness = hasCompany && hasContact ? 'complete' : hasCompany || hasContact ? 'partial' : 'minimal';

                          return (
                          <tr key={item.id}>
                            <td>
                              <div className="equipe-discipline-cell">
                                <span className={`equipe-completeness-dot equipe-completeness-dot--${completeness}`} title={
                                  completeness === 'complete' ? 'Empresa e contato preenchidos' :
                                  completeness === 'partial' ? 'Parcialmente preenchido' :
                                  'Somente disciplina registrada'
                                } />
                                <span className="equipe-discipline-name">
                                  {item.discipline?.discipline_name || '-'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="equipe-cell-company">
                                <span className="equipe-company-name">{item.company?.name || '-'}</span>
                                {item.company?.status === 'pendente' && (
                                  <PendingAlert tooltip="Empresa com cadastro pendente de validação" />
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="equipe-cell-contact">
                                {item.contact?.name || '-'}
                              </span>
                            </td>
                            <td>
                              <span className="equipe-cell-position">
                                {position || '-'}
                              </span>
                            </td>
                            <td>
                              {email ? (
                                <a href={`mailto:${email}`} className="equipe-cell-email">
                                  {email}
                                </a>
                              ) : '-'}
                            </td>
                            <td>
                              {phone ? (
                                <a href={`tel:${phone}`} className="equipe-cell-phone">
                                  {phone}
                                </a>
                              ) : '-'}
                            </td>
                            <td>
                              <span className="equipe-cell-detail" title={item.discipline_detail || ''}>
                                {item.discipline_detail || '-'}
                              </span>
                            </td>
                            <td className="equipe-td-actions">
                              <button
                                className="equipe-action-btn equipe-edit-btn"
                                onClick={() => handleEdit(item)}
                                title="Editar"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className="equipe-action-btn equipe-delete-btn"
                                onClick={() => handleDelete(item.id)}
                                title="Desativar"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== ABA CONTROLE ===== */}
          {activeTab === 'controle' && (
            <div className="equipe-tab-panel">
              <DisciplineCoveragePanel
                data={crossRef}
                loading={crossRefLoading}
                onQuickAdd={(name) => {
                  handleQuickAdd(name);
                  setActiveTab('cadastro');
                }}
                standardDisciplines={disciplinas}
                projectId={construflowId}
                onMappingChange={fetchCrossRef}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de adicionar/editar */}
      {showModal && (
        <div className="equipe-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="equipe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="equipe-modal-header">
              <h3>{editingItem ? 'Editar Membro' : 'Adicionar Membro'}</h3>
              <button className="equipe-modal-close" onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="equipe-modal-body">
              {/* Disciplina - desabilitado na edição */}
              <div className="equipe-form-group">
                <label>Disciplina {!editingItem && <span className="equipe-required">*</span>}</label>
                {editingItem ? (
                  <div className="equipe-readonly-field">
                    {getDisciplineName(formData.discipline_id)}
                    <span className="equipe-readonly-hint">Para alterar a disciplina, delete este registro e crie um novo</span>
                  </div>
                ) : (
                  <select
                    value={formData.discipline_id}
                    onChange={(e) => setFormData({ ...formData, discipline_id: e.target.value })}
                  >
                    <option value="">Selecione uma disciplina...</option>
                    {disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>{d.discipline_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Empresa - desabilitado na edição */}
              <div className="equipe-form-group">
                <label>Empresa</label>
                {editingItem ? (
                  <div className="equipe-readonly-field">
                    <div className="equipe-readonly-company">
                      {getCompanyName(formData.company_id)}
                      {getSelectedCompany()?.status === 'pendente' && (
                        <PendingAlert tooltip="Empresa com cadastro pendente" />
                      )}
                    </div>
                    <span className="equipe-readonly-hint">Para alterar a empresa, delete este registro e crie um novo</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={formData.company_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          company_id: e.target.value,
                          contact_id: '',
                          email: '',
                          phone: '',
                          position: ''
                        });
                      }}
                    >
                      <option value="">Selecione uma empresa...</option>
                      {empresas.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} {emp.status === 'pendente' ? '(pendente)' : ''}
                        </option>
                      ))}
                    </select>
                    {getSelectedCompany()?.status === 'pendente' && (
                      <div className="equipe-form-warning">
                        <PendingAlert />
                        <span>Esta empresa ainda não foi validada</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Contato - sempre editável, filtrado pela empresa */}
              <div className="equipe-form-group">
                <label>Contato</label>
                <select
                  value={formData.contact_id}
                  onChange={(e) => handleContactChange(e.target.value)}
                  disabled={!formData.company_id}
                >
                  <option value="">
                    {formData.company_id ? 'Selecione um contato...' : 'Selecione uma empresa primeiro'}
                  </option>
                  {getFilteredContacts().map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
                {formData.company_id && getFilteredContacts().length === 0 && (
                  <div className="equipe-form-hint">
                    Nenhum contato cadastrado para esta empresa
                  </div>
                )}
              </div>

              {/* Campos de contato editáveis */}
              <div className="equipe-contact-fields">
                <div className="equipe-contact-fields-header">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Dados do contato para este projeto</span>
                </div>

                <div className="equipe-form-row">
                  <div className="equipe-form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="equipe-form-group">
                    <label>Telefone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="equipe-form-group">
                  <label>Cargo</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Cargo ou função"
                  />
                </div>
              </div>

              <div className="equipe-form-group">
                <label>Detalhes da Disciplina</label>
                <textarea
                  value={formData.discipline_detail}
                  onChange={(e) => setFormData({ ...formData, discipline_detail: e.target.value })}
                  placeholder="Informações adicionais sobre a disciplina neste projeto..."
                  rows={3}
                />
              </div>
            </div>

            <div className="equipe-modal-footer">
              <button className="equipe-btn-cancel" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="equipe-btn-save" onClick={handleSave}>
                {editingItem ? 'Salvar Alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipeView;

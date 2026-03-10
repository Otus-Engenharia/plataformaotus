/**
 * Componente: Painel de Projetistas
 *
 * Cadastro de disciplinas do projeto (disciplina + empresa + contato).
 * Extraído da EquipeClientePanel para melhorar a UX.
 *
 * - Admin/Director: pode adicionar, editar e desativar diretamente
 * - Leaders: visualizam a tabela + botões para solicitar novos cadastros
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/EquipeClientePanel.css';
import { formatPhoneDisplay, stripNonDigits } from '../utils/phone-utils';

const PendingAlert = ({ tooltip }) => (
  <span className="ecli-pending-alert" title={tooltip || "Empresa com cadastro pendente"}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 22h20L12 2z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
      <path d="M12 9v5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="#1F2937" />
    </svg>
  </span>
);

const REQUEST_TYPE_LABELS = {
  novo_contato: 'Novo Contato',
  editar_contato: 'Editar Contato',
  nova_empresa: 'Nova Empresa',
  nova_disciplina: 'Nova Disciplina',
};

function EquipeProjetistasPanel({
  construflowId,
  projectCode,
  disciplinas = [],
  empresas = [],
  contatos = [],
  equipe = [],
  onEquipeChange,
  onCrossRefChange
}) {
  const { hasFullAccess, user } = useAuth();

  // --- Estado modal disciplina ---
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    discipline_id: '', company_id: '', contact_id: '',
    discipline_detail: '', email: '', phone: '', position: ''
  });

  // --- Estado solicitações do usuário ---
  const [myRequests, setMyRequests] = useState([]);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(null);

  // --- Estado modal de demissão ---
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [dismissingItem, setDismissingItem] = useState(null);
  const [dismissMotivo, setDismissMotivo] = useState('');
  const [dismissing, setDismissing] = useState(false);

  // --- Estado modal unificado de solicitação (para leaders) ---
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [unifiedSections, setUnifiedSections] = useState({
    disciplina: { enabled: false, name: '' },
    empresa: { enabled: false, name: '', discipline_ids: [] },
    contato: { enabled: false, discipline_id: '', company_id: '', name: '', email: '', phone: '', position: '' },
  });
  const [savingRequest, setSavingRequest] = useState(false);

  // --- Estado busca ---
  const [searchTerm, setSearchTerm] = useState('');

  // Filtro de busca
  const filteredEquipe = useMemo(() => {
    if (!searchTerm.trim()) return equipe;
    const term = searchTerm.toLowerCase().trim();
    return equipe.filter(item => {
      const fields = [
        item.discipline?.discipline_name,
        item.company?.name,
        item.contact?.name,
        item.email || item.contact?.email,
        item.discipline_detail,
      ];
      return fields.some(f => f && f.toLowerCase().includes(term));
    });
  }, [equipe, searchTerm]);

  // Contagens pré-calculadas
  const activeCount = equipe.filter(e => e.status === 'ativo').length;
  const dismissedCount = equipe.filter(e => e.status === 'demitido').length;

  // Buscar minhas solicitações
  const fetchMyRequests = useCallback(async () => {
    if (!user?.email) return;
    try {
      const response = await axios.get(`${API_URL}/api/contact-requests`, {
        params: { requester_email: user.email },
        withCredentials: true
      });
      setMyRequests(response.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!hasFullAccess) fetchMyRequests();
  }, [hasFullAccess, fetchMyRequests]);

  // === FUNÇÕES DO CADASTRO DE DISCIPLINAS ===

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({
      discipline_id: '', company_id: '', contact_id: '',
      discipline_detail: '', email: '', phone: '', position: ''
    });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
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

  const handleContactChange = (contactId) => {
    const contact = contatos.find(c => String(c.id) === String(contactId));
    setFormData(prev => ({
      ...prev,
      contact_id: contactId,
      email: contact?.email || '',
      phone: contact?.phone || '',
      position: contact?.position || ''
    }));
  };

  const handleSave = async () => {
    if (!formData.discipline_id) {
      alert('Selecione uma disciplina');
      return;
    }
    try {
      if (editingItem) {
        await axios.put(`${API_URL}/api/projetos/equipe/${editingItem.id}`, {
          discipline_id: formData.discipline_id,
          contact_id: formData.contact_id,
          discipline_detail: formData.discipline_detail,
          email: formData.email,
          phone: formData.phone,
          position: formData.position
        }, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/projetos/equipe`, {
          ...formData,
          construflow_id: construflowId,
          project_code: projectCode
        }, { withCredentials: true });
      }
      setShowModal(false);
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      const msg = err.response?.data?.error || err.message || 'Erro ao salvar.';
      alert(msg);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Desativar esta disciplina da equipe?')) return;
    try {
      await axios.delete(`${API_URL}/api/projetos/equipe/${id}`, { withCredentials: true });
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();
    } catch (err) {
      console.error('Erro ao desativar:', err);
    }
  };

  const openDismissModal = (item) => {
    setDismissingItem(item);
    setDismissMotivo('');
    setDismissing(false);
    setShowDismissModal(true);
  };

  const handleDismiss = async () => {
    if (!dismissingItem || dismissing) return;
    setDismissing(true);
    try {
      await axios.patch(`${API_URL}/api/projetos/equipe/${dismissingItem.id}/demitir`, {
        motivo_demissao: dismissMotivo || null,
      }, { withCredentials: true });
      setShowDismissModal(false);
      setDismissingItem(null);
      setRequestSuccess('Projetista demitido com sucesso');
      setTimeout(() => setRequestSuccess(null), 4000);
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();
    } catch (err) {
      console.error('Erro ao demitir:', err);
      alert(err.response?.data?.error || 'Erro ao demitir projetista.');
    } finally {
      setDismissing(false);
    }
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Reativar este projetista no projeto?')) return;
    try {
      await axios.patch(`${API_URL}/api/projetos/equipe/${id}/reativar`, {}, { withCredentials: true });
      setRequestSuccess('Projetista reativado com sucesso');
      setTimeout(() => setRequestSuccess(null), 4000);
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();
    } catch (err) {
      console.error('Erro ao reativar:', err);
      alert(err.response?.data?.error || 'Erro ao reativar projetista.');
    }
  };

  // Verifica se é o último ativo de uma disciplina
  const isLastActiveInDiscipline = (item) => {
    return equipe.filter(e =>
      e.status === 'ativo' &&
      e.discipline_id === item.discipline_id
    ).length <= 1;
  };

  const getFilteredContacts = () => {
    if (!formData.company_id) return [];
    return contatos.filter(c => String(c.company_id) === String(formData.company_id));
  };

  const getDisciplineName = (id) => disciplinas.find(d => d.id === id)?.discipline_name || '-';
  const getCompanyName = (id) => empresas.find(e => e.id === id)?.name || '-';

  // === FUNÇÕES DE SOLICITAÇÃO UNIFICADA (para leaders) ===

  const openUnifiedRequestModal = () => {
    setUnifiedSections({
      disciplina: { enabled: false, name: '' },
      empresa: { enabled: false, name: '', discipline_ids: [] },
      contato: { enabled: false, discipline_id: '', company_id: '', name: '', email: '', phone: '', position: '' },
    });
    setShowUnifiedModal(true);
  };

  const toggleUnifiedSection = (section) => {
    setUnifiedSections(prev => ({
      ...prev,
      [section]: { ...prev[section], enabled: !prev[section].enabled },
    }));
  };

  const updateUnifiedSection = (section, field, value) => {
    setUnifiedSections(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const toggleUnifiedDiscipline = (discId) => {
    setUnifiedSections(prev => {
      const ids = prev.empresa.discipline_ids || [];
      return {
        ...prev,
        empresa: {
          ...prev.empresa,
          discipline_ids: ids.includes(discId)
            ? ids.filter(id => id !== discId)
            : [...ids, discId],
        },
      };
    });
  };

  const handleUnifiedSubmit = async () => {
    const { disciplina, empresa, contato } = unifiedSections;
    const enabledCount = [disciplina.enabled, empresa.enabled, contato.enabled].filter(Boolean).length;
    if (enabledCount === 0) return;

    // Validar seções habilitadas
    if (disciplina.enabled && !disciplina.name.trim()) {
      alert('Nome da disciplina é obrigatório'); return;
    }
    if (empresa.enabled) {
      if (!empresa.name.trim()) { alert('Nome da empresa é obrigatório'); return; }
      if (!empresa.discipline_ids || empresa.discipline_ids.length === 0) {
        alert('Selecione ao menos uma disciplina para a empresa'); return;
      }
    }
    if (contato.enabled) {
      if (!contato.name.trim()) { alert('Nome do contato é obrigatório'); return; }
      if (!contato.discipline_id) { alert('Selecione uma disciplina para o contato'); return; }
    }

    setSavingRequest(true);
    try {
      const requests = [];

      if (disciplina.enabled) {
        requests.push(
          axios.post(`${API_URL}/api/contact-requests`, {
            request_type: 'nova_disciplina',
            project_code: projectCode,
            payload: { name: disciplina.name.trim() },
          }, { withCredentials: true })
        );
      }

      if (empresa.enabled) {
        const selectedDisciplines = empresa.discipline_ids
          .map(id => disciplinas.find(d => String(d.id) === String(id)))
          .filter(Boolean);
        requests.push(
          axios.post(`${API_URL}/api/contact-requests`, {
            request_type: 'nova_empresa',
            project_code: projectCode,
            payload: {
              name: empresa.name.trim(),
              discipline_ids: empresa.discipline_ids,
              discipline_names: selectedDisciplines.map(d => d.discipline_name),
            },
          }, { withCredentials: true })
        );
      }

      if (contato.enabled) {
        const selectedDiscipline = disciplinas.find(d => String(d.id) === String(contato.discipline_id));
        const selectedCompany = empresas.find(e => String(e.id) === String(contato.company_id));
        requests.push(
          axios.post(`${API_URL}/api/contact-requests`, {
            request_type: 'novo_contato',
            project_code: projectCode,
            payload: {
              discipline_id: contato.discipline_id,
              discipline_name: selectedDiscipline?.discipline_name || '',
              company_id: contato.company_id || null,
              company_name: selectedCompany?.name || '',
              name: contato.name.trim(),
              email: contato.email || '',
              phone: contato.phone || '',
              position: contato.position || '',
            },
          }, { withCredentials: true })
        );
      }

      const results = await Promise.allSettled(requests);
      const failures = results.filter(r => r.status === 'rejected');

      setShowUnifiedModal(false);
      if (failures.length === 0) {
        setRequestSuccess('Solicitação enviada com sucesso!');
      } else if (failures.length < requests.length) {
        setRequestSuccess('Algumas solicitações foram enviadas. Verifique abaixo.');
      } else {
        alert('Erro ao enviar solicitações. Tente novamente.');
      }
      setTimeout(() => setRequestSuccess(null), 4000);
      fetchMyRequests();
    } catch (err) {
      console.error('Erro ao enviar solicitações:', err);
      alert('Erro ao enviar solicitações. Tente novamente.');
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <div className="ecli-panel">
      {/* Toast de sucesso */}
      {requestSuccess && (
        <div className="ecli-request-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{requestSuccess}</span>
        </div>
      )}

      {/* === CADASTRO DE DISCIPLINAS === */}
      <div className="ecli-section">
        <div className="ecli-section-header">
          <div className="ecli-section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <h4>Cadastro de Disciplinas</h4>
            <span className="ecli-count">
              {searchTerm
                ? `${filteredEquipe.length} de ${equipe.length}`
                : activeCount
              } {(searchTerm ? filteredEquipe.length : activeCount) === 1 ? 'disciplina' : 'disciplinas'}
              {!searchTerm && dismissedCount > 0 && (
                <span className="ecli-dismissed-count"> ({dismissedCount} demitido{dismissedCount > 1 ? 's' : ''})</span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="ecli-add-btn" onClick={handleAdd}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar
            </button>
            {!hasFullAccess && (
              <button className="ecli-add-btn" onClick={openUnifiedRequestModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Solicitar Cadastro
              </button>
            )}
          </div>
        </div>

        {equipe.length > 0 && (
          <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '12px' }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#737373" strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar disciplina, empresa ou contato..."
              style={{
                width: '100%',
                padding: '8px 36px 8px 36px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  color: '#737373', fontSize: '16px', lineHeight: 1,
                }}
                aria-label="Limpar busca"
              >
                ×
              </button>
            )}
          </div>
        )}

        {searchTerm && filteredEquipe.length === 0 && equipe.length > 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '13px' }}>
            Nenhum resultado para "{searchTerm}"
          </div>
        )}

        <div className="ecli-table-wrapper">
          <table className="ecli-table">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Empresa</th>
                <th>Contato</th>
                <th>Cargo</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Detalhes</th>
                <th className="ecli-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipe.length === 0 && !searchTerm ? (
                <tr>
                  <td colSpan={8} className="ecli-empty-row">
                    Nenhuma disciplina cadastrada
                  </td>
                </tr>
              ) : (
                filteredEquipe.map(item => {
                  const isDismissed = item.status === 'demitido';
                  const email = item.email || item.contact?.email;
                  const phone = item.phone || item.contact?.phone;
                  const position = item.position || item.contact?.position;
                  const hasCompany = !!item.company?.name;
                  const hasContact = !!item.contact?.name;
                  const completeness = isDismissed ? 'dismissed' : hasCompany && hasContact ? 'complete' : hasCompany || hasContact ? 'partial' : 'minimal';

                  const dismissedTooltip = isDismissed
                    ? `Demitido em ${item.demitido_em ? new Date(item.demitido_em).toLocaleDateString('pt-BR') : '-'}${item.motivo_demissao ? ` — ${item.motivo_demissao}` : ''}`
                    : '';

                  return (
                    <tr key={item.id} className={isDismissed ? 'ecli-row--demitido' : ''} title={dismissedTooltip}>
                      <td>
                        <div className="ecli-discipline-cell">
                          <span className={`ecli-dot ecli-dot--${completeness}`} />
                          <span>{item.discipline?.discipline_name || '-'}</span>
                          {isDismissed && <span className="ecli-badge-demitido">Demitido</span>}
                        </div>
                      </td>
                      <td>
                        <div className="ecli-company-cell">
                          <span>{item.company?.name || '-'}</span>
                          {item.company?.status === 'pendente' && <PendingAlert />}
                        </div>
                      </td>
                      <td>
                        <span className={isDismissed ? 'ecli-contact-name--dismissed' : ''}>
                          {item.contact?.name || '-'}
                        </span>
                      </td>
                      <td>{position || '-'}</td>
                      <td>
                        {email ? <a href={`mailto:${email}`} className="ecli-link">{email}</a> : '-'}
                      </td>
                      <td>
                        {phone ? <a href={`tel:${phone}`} className="ecli-link">{formatPhoneDisplay(phone)}</a> : '-'}
                      </td>
                      <td>
                        <span className="ecli-detail" title={item.discipline_detail || ''}>
                          {item.discipline_detail || '-'}
                        </span>
                      </td>
                      <td className="ecli-td-actions">
                        {isDismissed ? (
                          <button className="ecli-action-btn ecli-action-btn--success" onClick={() => handleReactivate(item.id)} title="Reativar" aria-label="Reativar projetista">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                          </button>
                        ) : (
                          <>
                            <button className="ecli-action-btn" onClick={() => handleEdit(item)} title="Editar" aria-label="Editar membro">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="ecli-action-btn ecli-action-btn--warning" onClick={() => openDismissModal(item)} title="Demitir do projeto" aria-label="Demitir do projeto">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="18" y1="11" x2="23" y2="11" />
                              </svg>
                            </button>
                            <button className="ecli-action-btn ecli-action-btn--danger" onClick={() => handleDelete(item.id)} title="Desativar" aria-label="Desativar membro">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === MINHAS SOLICITAÇÕES (apenas para leaders) === */}
      {!hasFullAccess && (
        <div className="ecli-section ecli-requests-section">
          <button
            className="ecli-expandable-header"
            onClick={() => setShowMyRequests(!showMyRequests)}
          >
            <div className="ecli-section-header-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Minhas Solicitações</span>
              {myRequests.filter(r => r.status === 'pendente').length > 0 && (
                <span className="ecli-pending-count">
                  {myRequests.filter(r => r.status === 'pendente').length}
                </span>
              )}
            </div>
            <svg
              className={`ecli-expandable-icon ${showMyRequests ? 'expanded' : ''}`}
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showMyRequests && (
            <div className="ecli-requests-list">
              {myRequests.length === 0 ? (
                <div className="ecli-empty-mini">Nenhuma solicitação enviada.</div>
              ) : (
                myRequests.slice(0, 10).map(req => (
                  <div key={req.id} className={`ecli-request-item ecli-request-item--${req.status}`}>
                    <div className="ecli-request-item-header">
                      <span className={`ecli-request-badge ecli-request-badge--${req.request_type}`}>
                        {REQUEST_TYPE_LABELS[req.request_type] || req.request_type}
                      </span>
                      <span className={`ecli-status-badge ecli-status-badge--${req.status}`}>
                        {req.status === 'pendente' ? 'Pendente' : req.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
                      </span>
                    </div>
                    <div className="ecli-request-item-body">
                      <span className="ecli-request-summary">
                        {req.payload?.name || ''}
                        {req.request_type === 'editar_contato' && `Edição: ${req.payload?.new_values?.name || req.payload?.old_values?.name || ''}`}
                      </span>
                      <span className="ecli-request-date">
                        {new Date(req.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {req.status === 'rejeitada' && req.rejection_reason && (
                      <div className="ecli-request-rejection">
                        Motivo: {req.rejection_reason}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* === MODAL DE DISCIPLINA (admin) === */}
      {showModal && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal">
            <div className="ecli-modal-header">
              <h3>{editingItem ? 'Editar Membro' : 'Adicionar Membro'}</h3>
              <button className="ecli-modal-close" onClick={() => setShowModal(false)} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="ecli-modal-body">
              <div className="ecli-form-group">
                <label>Disciplina {!editingItem && <span className="ecli-required">*</span>}</label>
                {editingItem ? (
                  <div className="ecli-readonly">{getDisciplineName(formData.discipline_id)}</div>
                ) : (
                  <select value={formData.discipline_id} onChange={e => setFormData({ ...formData, discipline_id: e.target.value })}>
                    <option value="">Selecione...</option>
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.discipline_name}</option>)}
                  </select>
                )}
              </div>

              <div className="ecli-form-group">
                <label>Empresa</label>
                {editingItem ? (
                  <div className="ecli-readonly">{getCompanyName(formData.company_id)}</div>
                ) : (
                  <select
                    value={formData.company_id}
                    onChange={e => setFormData({ ...formData, company_id: e.target.value, contact_id: '', email: '', phone: '', position: '' })}
                  >
                    <option value="">Selecione...</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.status === 'pendente' ? '(pendente)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="ecli-form-group">
                <label>Contato</label>
                <select
                  value={formData.contact_id}
                  onChange={e => handleContactChange(e.target.value)}
                  disabled={!formData.company_id}
                >
                  <option value="">{formData.company_id ? 'Selecione...' : 'Selecione empresa primeiro'}</option>
                  {getFilteredContacts().map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="ecli-form-row">
                <div className="ecli-form-group">
                  <label>Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div className="ecli-form-group">
                  <label>Telefone</label>
                  <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: stripNonDigits(e.target.value) })} placeholder="00 00000-0000" title="Digite apenas os n\u00fameros, sem par\u00eanteses ou tra\u00e7os" />
                </div>
              </div>

              <div className="ecli-form-group">
                <label>Cargo</label>
                <input type="text" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="Cargo ou fun\u00e7\u00e3o" />
              </div>

              <div className="ecli-form-group">
                <label>Detalhes da Disciplina</label>
                <textarea value={formData.discipline_detail} onChange={e => setFormData({ ...formData, discipline_detail: e.target.value })} placeholder="Informa\u00e7\u00f5es adicionais..." rows={3} />
              </div>
            </div>

            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="ecli-btn-save" onClick={handleSave}>{editingItem ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL DE DEMISSÃO === */}
      {showDismissModal && dismissingItem && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal">
            <div className="ecli-modal-header ecli-modal-header--warning">
              <h3>Demitir Projetista</h3>
              <button className="ecli-modal-close" onClick={() => setShowDismissModal(false)} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ecli-modal-body">
              <div className="ecli-dismiss-info">
                <div className="ecli-dismiss-info-row">
                  <span className="ecli-dismiss-label">Disciplina:</span>
                  <span>{dismissingItem.discipline?.discipline_name || '-'}</span>
                </div>
                <div className="ecli-dismiss-info-row">
                  <span className="ecli-dismiss-label">Empresa:</span>
                  <span>{dismissingItem.company?.name || '-'}</span>
                </div>
                <div className="ecli-dismiss-info-row">
                  <span className="ecli-dismiss-label">Contato:</span>
                  <span>{dismissingItem.contact?.name || '-'}</span>
                </div>
              </div>

              {isLastActiveInDiscipline(dismissingItem) && (
                <div className="ecli-dismiss-warning" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 22h20L12 2z" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
                    <path d="M12 9v5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="17" r="1" fill="#1F2937" />
                  </svg>
                  <span>Esta é a única pessoa ativa nesta disciplina. Comunicações ficarão sem destinatário.</span>
                </div>
              )}

              <div className="ecli-form-group">
                <label>Motivo da demissão (opcional)</label>
                <textarea
                  value={dismissMotivo}
                  onChange={e => setDismissMotivo(e.target.value)}
                  placeholder="Ex: Contrato encerrado, substituição de fornecedor..."
                  rows={3}
                />
              </div>
            </div>
            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowDismissModal(false)}>Cancelar</button>
              <button className="ecli-btn-dismiss" onClick={handleDismiss} disabled={dismissing}>{dismissing ? 'Demitindo...' : 'Confirmar Demissão'}</button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL UNIFICADO DE SOLICITAÇÃO (leaders) === */}
      {showUnifiedModal && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal ecli-modal--wide">
            <div className="ecli-modal-header">
              <h3>Solicitar Cadastro</h3>
              <button className="ecli-modal-close" onClick={() => setShowUnifiedModal(false)} aria-label="Fechar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ecli-modal-body" style={{ gap: '12px' }}>
              <p className="ecli-unified-hint">Selecione o que deseja solicitar. Você pode combinar vários itens.</p>

              {/* Seção: Nova Disciplina */}
              <div className={`ecli-unified-section ${unifiedSections.disciplina.enabled ? 'ecli-unified-section--enabled' : ''}`}>
                <label className="ecli-unified-section-header" onClick={() => toggleUnifiedSection('disciplina')}>
                  <input type="checkbox" checked={unifiedSections.disciplina.enabled} onChange={() => {}} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span>Nova Disciplina</span>
                </label>
                {unifiedSections.disciplina.enabled && (
                  <div className="ecli-unified-section-body">
                    <div className="ecli-form-group">
                      <label>Nome da Disciplina <span className="ecli-required">*</span></label>
                      <input
                        type="text"
                        value={unifiedSections.disciplina.name}
                        onChange={e => updateUnifiedSection('disciplina', 'name', e.target.value)}
                        placeholder="Ex: Estrutura Metálica"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Nova Empresa */}
              <div className={`ecli-unified-section ${unifiedSections.empresa.enabled ? 'ecli-unified-section--enabled' : ''}`}>
                <label className="ecli-unified-section-header" onClick={() => toggleUnifiedSection('empresa')}>
                  <input type="checkbox" checked={unifiedSections.empresa.enabled} onChange={() => {}} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Nova Empresa</span>
                </label>
                {unifiedSections.empresa.enabled && (
                  <div className="ecli-unified-section-body">
                    <div className="ecli-form-group">
                      <label>Nome da Empresa <span className="ecli-required">*</span></label>
                      <input
                        type="text"
                        value={unifiedSections.empresa.name}
                        onChange={e => updateUnifiedSection('empresa', 'name', e.target.value)}
                        placeholder="Nome da empresa"
                      />
                    </div>
                    <div className="ecli-form-group">
                      <label>Disciplinas Associadas <span className="ecli-required">*</span></label>
                      <div className="ecli-checkbox-list">
                        {disciplinas.map(d => (
                          <label key={d.id} className="ecli-checkbox-item">
                            <input
                              type="checkbox"
                              checked={(unifiedSections.empresa.discipline_ids || []).includes(String(d.id))}
                              onChange={() => toggleUnifiedDiscipline(String(d.id))}
                            />
                            <span>{d.discipline_name}</span>
                          </label>
                        ))}
                        {disciplinas.length === 0 && (
                          <span className="ecli-checkbox-empty">Nenhuma disciplina disponível</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Novo Contato */}
              <div className={`ecli-unified-section ${unifiedSections.contato.enabled ? 'ecli-unified-section--enabled' : ''}`}>
                <label className="ecli-unified-section-header" onClick={() => toggleUnifiedSection('contato')}>
                  <input type="checkbox" checked={unifiedSections.contato.enabled} onChange={() => {}} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <span>Novo Contato</span>
                </label>
                {unifiedSections.contato.enabled && (
                  <div className="ecli-unified-section-body">
                    <div className="ecli-form-group">
                      <label>Disciplina <span className="ecli-required">*</span></label>
                      <select
                        value={unifiedSections.contato.discipline_id}
                        onChange={e => updateUnifiedSection('contato', 'discipline_id', e.target.value)}
                      >
                        <option value="">Selecione a disciplina...</option>
                        {disciplinas.map(d => (
                          <option key={d.id} value={d.id}>{d.discipline_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ecli-form-group">
                      <label>Empresa</label>
                      <select
                        value={unifiedSections.contato.company_id}
                        onChange={e => updateUnifiedSection('contato', 'company_id', e.target.value)}
                      >
                        <option value="">Selecione a empresa...</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="ecli-form-group">
                      <label>Nome do Contato <span className="ecli-required">*</span></label>
                      <input
                        type="text"
                        value={unifiedSections.contato.name}
                        onChange={e => updateUnifiedSection('contato', 'name', e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="ecli-form-row">
                      <div className="ecli-form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={unifiedSections.contato.email}
                          onChange={e => updateUnifiedSection('contato', 'email', e.target.value)}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="ecli-form-group">
                        <label>Telefone</label>
                        <input
                          type="tel"
                          value={unifiedSections.contato.phone}
                          onChange={e => updateUnifiedSection('contato', 'phone', e.target.value)}
                          placeholder="00 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="ecli-form-group">
                      <label>Cargo</label>
                      <input
                        type="text"
                        value={unifiedSections.contato.position}
                        onChange={e => updateUnifiedSection('contato', 'position', e.target.value)}
                        placeholder="Cargo ou função"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowUnifiedModal(false)}>Cancelar</button>
              <button
                className="ecli-btn-request"
                onClick={handleUnifiedSubmit}
                disabled={savingRequest || ![unifiedSections.disciplina.enabled, unifiedSections.empresa.enabled, unifiedSections.contato.enabled].some(Boolean)}
              >
                {savingRequest ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipeProjetistasPanel;

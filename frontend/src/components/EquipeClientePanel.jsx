/**
 * Componente: Painel Equipe do Cliente
 *
 * Duas seções:
 * 1. Contatos do cliente no projeto (baseado na empresa do portfólio)
 * 2. Cadastro de disciplinas (migrado do antigo "Cadastro da Equipe")
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
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

function EquipeClientePanel({
  construflowId,
  projectCode,
  disciplinas = [],
  empresas = [],
  contatos = [],
  equipe = [],
  onEquipeChange,
  onCrossRefChange
}) {
  // --- Estado contatos do cliente ---
  const [clientData, setClientData] = useState(null);
  const [clientLoading, setClientLoading] = useState(false);

  // --- Estado modal contato (criar/editar) ---
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [savingContact, setSavingContact] = useState(false);

  // --- Estado modal disciplina (migrado do EquipeView) ---
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    discipline_id: '', company_id: '', contact_id: '',
    discipline_detail: '', email: '', phone: '', position: ''
  });

  // Busca contatos do cliente
  const fetchClientContacts = useCallback(async () => {
    if (!projectCode) return;
    setClientLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projetos/equipe-cliente`, {
        params: { projectCode },
        withCredentials: true
      });
      setClientData(response.data.data || null);
    } catch (err) {
      console.error('Erro ao buscar contatos do cliente:', err);
    } finally {
      setClientLoading(false);
    }
  }, [projectCode]);

  useEffect(() => {
    fetchClientContacts();
  }, [fetchClientContacts]);

  // Deduplicar contatos por name+email
  const uniqueContacts = useMemo(() => {
    if (!clientData?.allContacts) return [];
    const seen = new Map();
    for (const c of clientData.allContacts) {
      const key = `${c.name}|${c.email}`;
      if (!seen.has(key)) seen.set(key, c);
    }
    return Array.from(seen.values());
  }, [clientData]);

  // Abrir modal para novo contato
  const handleAddContact = () => {
    setEditingContact(null);
    setContactForm({ name: '', email: '', phone: '', position: '' });
    setShowContactModal(true);
  };

  // Abrir modal para editar contato
  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      position: contact.position || ''
    });
    setShowContactModal(true);
  };

  // Salvar contato (criar ou atualizar)
  const handleSaveContact = async () => {
    if (!contactForm.name.trim()) {
      alert('Nome é obrigatório');
      return;
    }
    setSavingContact(true);
    try {
      if (editingContact) {
        await axios.put(`${API_URL}/api/projetos/equipe/contatos/${editingContact.id}`, contactForm, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/projetos/equipe/contatos`, {
          ...contactForm,
          companyId: clientData?.companyId
        }, { withCredentials: true });
      }
      setShowContactModal(false);
      fetchClientContacts();
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      alert('Erro ao salvar contato. Tente novamente.');
    } finally {
      setSavingContact(false);
    }
  };

  // Toggle participação de contato no projeto
  const handleToggleContact = async (contact) => {
    const isAssigned = clientData?.assignedIds?.includes(contact.id);

    try {
      if (isAssigned) {
        // Encontra o registro de atribuição
        const record = clientData.assignedRecords?.find(r => r.contact_id === contact.id);
        if (record) {
          await axios.delete(`${API_URL}/api/projetos/equipe-cliente/assign/${record.id}`, {
            withCredentials: true
          });
        }
      } else {
        await axios.post(`${API_URL}/api/projetos/equipe-cliente/assign`, {
          projectCode,
          contactId: contact.id
        }, { withCredentials: true });
      }
      fetchClientContacts();
    } catch (err) {
      console.error('Erro ao atualizar participação:', err);
    }
  };

  // === FUNÇÕES DO CADASTRO DE DISCIPLINAS (migradas do EquipeView) ===

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
          contact_id: formData.contact_id,
          discipline_detail: formData.discipline_detail,
          email: formData.email,
          phone: formData.phone,
          position: formData.position
        }, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/projetos/equipe`, {
          ...formData,
          construflow_id: construflowId
        }, { withCredentials: true });
      }
      setShowModal(false);
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar. Tente novamente.');
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

  const getFilteredContacts = () => {
    if (!formData.company_id) return [];
    return contatos.filter(c => String(c.company_id) === String(formData.company_id));
  };

  const getDisciplineName = (id) => disciplinas.find(d => d.id === id)?.discipline_name || '-';
  const getCompanyName = (id) => empresas.find(e => e.id === id)?.name || '-';
  const getSelectedCompany = () => empresas.find(e => e.id === formData.company_id);

  return (
    <div className="ecli-panel">
      {/* === SEÇÃO 1: CONTATOS DO CLIENTE === */}
      <div className="ecli-section">
        <div className="ecli-section-header">
          <div className="ecli-section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h4>Contatos do Cliente</h4>
            {clientData?.companyName && (
              <span className="ecli-company-badge">{clientData.companyName}</span>
            )}
          </div>
          {clientData?.companyId && (
            <button className="ecli-add-btn" onClick={handleAddContact}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Novo Contato
            </button>
          )}
        </div>

        {clientLoading && (
          <div className="ecli-loading">Carregando contatos...</div>
        )}

        {!clientLoading && !clientData?.companyId && (
          <div className="ecli-empty-mini">
            Nenhuma empresa cliente definida no portfólio.
          </div>
        )}

        {!clientLoading && uniqueContacts.length > 0 && (
          <div className="ecli-table-wrapper">
            <table className="ecli-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Email</th>
                  <th>Telefone</th>
                  <th className="ecli-th-actions"></th>
                </tr>
              </thead>
              <tbody>
                {uniqueContacts.map(contact => {
                  const isAssigned = clientData.assignedIds?.includes(contact.id);
                  return (
                    <tr key={contact.id} className={isAssigned ? 'ecli-row--active' : ''}>
                      <td>
                        <span className="ecli-contact-name">{contact.name}</span>
                      </td>
                      <td>{contact.position || '-'}</td>
                      <td>
                        {contact.email ? <a href={`mailto:${contact.email}`} className="ecli-link">{contact.email}</a> : '-'}
                      </td>
                      <td>
                        {contact.phone ? <a href={`tel:${contact.phone}`} className="ecli-link">{formatPhoneDisplay(contact.phone)}</a> : '-'}
                      </td>
                      <td className="ecli-td-actions">
                        <button
                          className="ecli-action-btn"
                          onClick={() => handleEditContact(contact)}
                          title="Editar contato"
                          aria-label={`Editar ${contact.name}`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className={`ecli-toggle-btn ${isAssigned ? 'ecli-toggle-btn--active' : ''}`}
                          onClick={() => handleToggleContact(contact)}
                          title={isAssigned ? 'Remover do projeto' : 'Adicionar ao projeto'}
                        >
                          <span className="ecli-toggle-track">
                            <span className="ecli-toggle-thumb" />
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!clientLoading && clientData?.companyId && uniqueContacts.length === 0 && (
          <div className="ecli-empty-mini">
            Nenhum contato cadastrado para {clientData.companyName}.
          </div>
        )}
      </div>

      {/* Divisor */}
      <div className="ecli-divider" />

      {/* === SEÇÃO 2: CADASTRO DE DISCIPLINAS === */}
      <div className="ecli-section">
        <div className="ecli-section-header">
          <div className="ecli-section-header-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <h4>Cadastro de Disciplinas</h4>
            <span className="ecli-count">{equipe.length} {equipe.length === 1 ? 'disciplina' : 'disciplinas'}</span>
          </div>
          <button className="ecli-add-btn" onClick={handleAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar
          </button>
        </div>

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
              {equipe.length === 0 ? (
                <tr>
                  <td colSpan="8" className="ecli-empty-row">
                    Nenhuma disciplina cadastrada
                  </td>
                </tr>
              ) : (
                equipe.map(item => {
                  const email = item.email || item.contact?.email;
                  const phone = item.phone || item.contact?.phone;
                  const position = item.position || item.contact?.position;
                  const hasCompany = !!item.company?.name;
                  const hasContact = !!item.contact?.name;
                  const completeness = hasCompany && hasContact ? 'complete' : hasCompany || hasContact ? 'partial' : 'minimal';

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="ecli-discipline-cell">
                          <span className={`ecli-dot ecli-dot--${completeness}`} />
                          <span>{item.discipline?.discipline_name || '-'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ecli-company-cell">
                          <span>{item.company?.name || '-'}</span>
                          {item.company?.status === 'pendente' && <PendingAlert />}
                        </div>
                      </td>
                      <td>{item.contact?.name || '-'}</td>
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
                        <button className="ecli-action-btn" onClick={() => handleEdit(item)} title="Editar">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="ecli-action-btn ecli-action-btn--danger" onClick={() => handleDelete(item.id)} title="Desativar">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      </div>

      {/* === MODAL DE CONTATO (criar/editar) === */}
      {showContactModal && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal">
            <div className="ecli-modal-header">
              <h3>{editingContact ? 'Editar Contato' : 'Novo Contato'}</h3>
              <button className="ecli-modal-close" onClick={() => setShowContactModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ecli-modal-body">
              <div className="ecli-form-group">
                <label>Nome <span className="ecli-required">*</span></label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="ecli-form-row">
                <div className="ecli-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="ecli-form-group">
                  <label>Telefone</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm({ ...contactForm, phone: stripNonDigits(e.target.value) })}
                    placeholder="00 00000-0000"
                    title="Digite apenas os números, sem parênteses ou traços"
                  />
                </div>
              </div>
              <div className="ecli-form-group">
                <label>Cargo</label>
                <input
                  type="text"
                  value={contactForm.position}
                  onChange={e => setContactForm({ ...contactForm, position: e.target.value })}
                  placeholder="Cargo ou função"
                />
              </div>
            </div>
            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowContactModal(false)}>Cancelar</button>
              <button className="ecli-btn-save" onClick={handleSaveContact} disabled={savingContact}>
                {savingContact ? 'Salvando...' : editingContact ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL DE DISCIPLINA === */}
      {showModal && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal">
            <div className="ecli-modal-header">
              <h3>{editingItem ? 'Editar Membro' : 'Adicionar Membro'}</h3>
              <button className="ecli-modal-close" onClick={() => setShowModal(false)}>
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
                  <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: stripNonDigits(e.target.value) })} placeholder="00 00000-0000" title="Digite apenas os números, sem parênteses ou traços" />
                </div>
              </div>

              <div className="ecli-form-group">
                <label>Cargo</label>
                <input type="text" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="Cargo ou função" />
              </div>

              <div className="ecli-form-group">
                <label>Detalhes da Disciplina</label>
                <textarea value={formData.discipline_detail} onChange={e => setFormData({ ...formData, discipline_detail: e.target.value })} placeholder="Informações adicionais..." rows={3} />
              </div>
            </div>

            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="ecli-btn-save" onClick={handleSave}>{editingItem ? 'Salvar' : 'Adicionar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Public method for quick-add from coverage panel
EquipeClientePanel.handleQuickAdd = null;

export default EquipeClientePanel;

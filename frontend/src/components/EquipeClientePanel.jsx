/**
 * Componente: Painel Equipe do Cliente
 *
 * Contatos do cliente no projeto (baseado na empresa do portfólio).
 * Admin/Director salva direto; Leaders criam solicitações.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/EquipeClientePanel.css';
import { formatPhoneDisplay, stripNonDigits } from '../utils/phone-utils';

function EquipeClientePanel({
  projectCode,
}) {
  const { hasFullAccess, user } = useAuth();

  // --- Estado contatos do cliente ---
  const [clientData, setClientData] = useState(null);
  const [clientLoading, setClientLoading] = useState(false);

  // --- Estado modal contato (criar/editar) ---
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [savingContact, setSavingContact] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(null);

  // --- Estado toggle portal ---
  const [togglingPortal, setTogglingPortal] = useState(null); // contactId being toggled
  const [portalStatus, setPortalStatus] = useState({}); // { contactId: boolean }

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
        // TODOS editam direto (admin e líder) — backend registra log automaticamente
        await axios.put(`${API_URL}/api/projetos/equipe/contatos/${editingContact.id}`, {
          ...contactForm,
          _old_values: {
            name: editingContact.name || '',
            email: editingContact.email || '',
            phone: editingContact.phone || '',
            position: editingContact.position || '',
          },
          _changed_fields: Object.keys(contactForm).filter(
            k => contactForm[k] !== (editingContact[k] || '')
          ),
          _project_code: projectCode || null,
        }, { withCredentials: true });
        setShowContactModal(false);
        fetchClientContacts();
      } else if (hasFullAccess) {
        // Novo contato: admin cria direto
        await axios.post(`${API_URL}/api/projetos/equipe/contatos`, {
          ...contactForm,
          companyId: clientData?.companyId
        }, { withCredentials: true });
        setShowContactModal(false);
        fetchClientContacts();
      } else {
        // Novo contato: líder cria solicitação
        const requestPayload = {
          request_type: 'novo_contato',
          project_code: projectCode,
          payload: {
            ...contactForm,
            company_id: clientData?.companyId,
            company_name: clientData?.companyName,
          },
        };

        await axios.post(`${API_URL}/api/contact-requests`, requestPayload, { withCredentials: true });
        setShowContactModal(false);
        setRequestSuccess('Solicitação de novo contato enviada!');
        setTimeout(() => setRequestSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSavingContact(false);
    }
  };

  // Sync portal status from contact data
  useEffect(() => {
    if (uniqueContacts.length > 0) {
      const status = {};
      for (const c of uniqueContacts) {
        if (c.has_portal_access !== undefined) {
          status[c.id] = c.has_portal_access;
        }
      }
      setPortalStatus(status);
    }
  }, [uniqueContacts]);

  // Toggle acesso ao portal do cliente
  const handleTogglePortal = async (contact) => {
    if (!contact.email) {
      alert('Contato precisa ter email para acessar o portal.');
      return;
    }

    const currentlyEnabled = portalStatus[contact.id] || false;
    const action = currentlyEnabled ? 'desativar' : 'ativar';
    const confirmMsg = currentlyEnabled
      ? `Desativar acesso ao portal para ${contact.name}?`
      : `Criar login no portal para ${contact.email}?\nSenha padrão: 123456`;

    if (!window.confirm(confirmMsg)) return;

    setTogglingPortal(contact.id);
    try {
      await axios.post(`${API_URL}/api/admin/client-portal/toggle`, {
        contactId: contact.id,
        enable: !currentlyEnabled,
      }, { withCredentials: true });

      setPortalStatus(prev => ({ ...prev, [contact.id]: !currentlyEnabled }));
      setRequestSuccess(`Portal ${!currentlyEnabled ? 'ativado' : 'desativado'} para ${contact.name}`);
      setTimeout(() => setRequestSuccess(null), 4000);
    } catch (err) {
      console.error(`Erro ao ${action} portal:`, err);
      alert(err.response?.data?.error || `Erro ao ${action} portal`);
    } finally {
      setTogglingPortal(null);
    }
  };

  // Toggle participação de contato no projeto
  const handleToggleContact = async (contact) => {
    const isAssigned = clientData?.assignedIds?.includes(contact.id);

    try {
      if (isAssigned) {
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

      {/* === CONTATOS DO CLIENTE === */}
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
                        {hasFullAccess && contact.email && (
                          <button
                            className={`ecli-portal-btn ${portalStatus[contact.id] ? 'ecli-portal-btn--active' : ''}`}
                            onClick={() => handleTogglePortal(contact)}
                            title={portalStatus[contact.id] ? 'Desativar acesso ao portal' : 'Ativar acesso ao portal'}
                            disabled={togglingPortal === contact.id}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            {togglingPortal === contact.id && (
                              <span className="ecli-portal-spinner" />
                            )}
                          </button>
                        )}
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
              {(editingContact || hasFullAccess) ? (
                <button className="ecli-btn-save" onClick={handleSaveContact} disabled={savingContact}>
                  {savingContact ? 'Salvando...' : editingContact ? 'Salvar' : 'Criar'}
                </button>
              ) : (
                <button className="ecli-btn-request" onClick={handleSaveContact} disabled={savingContact}>
                  {savingContact ? 'Enviando...' : 'Solicitar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipeClientePanel;

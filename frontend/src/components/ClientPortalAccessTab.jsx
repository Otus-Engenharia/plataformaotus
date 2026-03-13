/**
 * ClientPortalAccessTab - Gestão de acessos do Portal do Cliente
 *
 * Lista contatos com portal ativo, agrupados por empresa.
 * Permite resetar senha e desativar acesso.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

function ClientPortalAccessTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/api/admin/client-portal/contacts`, { withCredentials: true });
      if (res.data.success) {
        setCompanies(res.data.data);
      } else {
        setError(res.data.error || 'Erro desconhecido');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleResetPassword = async (contact) => {
    if (!window.confirm(`Resetar senha de ${contact.name} (${contact.email}) para 123456?`)) return;
    setActionLoading(contact.id);
    try {
      await axios.post(`${API_URL}/api/admin/client-portal/reset-password`, {
        contactId: contact.id,
      }, { withCredentials: true });
      alert('Senha resetada com sucesso para 123456');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao resetar senha');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisable = async (contact) => {
    if (!window.confirm(`Desativar acesso ao portal para ${contact.name}?`)) return;
    setActionLoading(contact.id);
    try {
      await axios.post(`${API_URL}/api/admin/client-portal/toggle`, {
        contactId: contact.id,
        enable: false,
      }, { withCredentials: true });
      setCompanies(prev =>
        prev.map(company => ({
          ...company,
          contacts: company.contacts.filter(c => c.id !== contact.id),
        })).filter(company => company.contacts.length > 0)
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao desativar acesso');
    } finally {
      setActionLoading(null);
    }
  };

  const searchLower = search.toLowerCase();
  const filtered = search
    ? companies.map(company => ({
        ...company,
        contacts: company.contacts.filter(c =>
          c.name?.toLowerCase().includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          company.companyName?.toLowerCase().includes(searchLower)
        ),
      })).filter(company => company.contacts.length > 0)
    : companies;

  const totalContacts = filtered.reduce((sum, c) => sum + c.contacts.length, 0);

  if (loading) return <div className="cpa-loading">Carregando acessos...</div>;
  if (error) return <div className="cpa-error">{error}</div>;

  return (
    <div className="cpa-container">
      <div className="cpa-toolbar">
        <input
          type="text"
          className="cpa-search-input"
          placeholder="Buscar por nome, email ou empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="cpa-count-badge">{totalContacts} acesso{totalContacts !== 1 ? 's' : ''} ativo{totalContacts !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="cpa-chart-empty">
          {search ? 'Nenhum resultado encontrado' : 'Nenhum contato com acesso ao portal'}
        </div>
      ) : (
        filtered.map(company => (
          <div key={company.companyId} className="cpa-section">
            <div className="cpa-section-title">{company.companyName}</div>
            <table className="cpa-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th style={{ width: '200px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {company.contacts.map(contact => (
                  <tr key={contact.id}>
                    <td>{contact.name}</td>
                    <td>{contact.email}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="cpa-action-buttons">
                        <button
                          className="cpa-btn cpa-btn-reset"
                          onClick={() => handleResetPassword(contact)}
                          disabled={actionLoading === contact.id}
                        >
                          {actionLoading === contact.id ? '...' : 'Resetar Senha'}
                        </button>
                        <button
                          className="cpa-btn cpa-btn-disable"
                          onClick={() => handleDisable(contact)}
                          disabled={actionLoading === contact.id}
                        >
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

export default ClientPortalAccessTab;

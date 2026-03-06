/**
 * Componente: Vista de Solicitações
 *
 * Página unificada de solicitações de cadastro:
 * - Para admin/director: painel de revisão (aprovar/rejeitar)
 * - Para leaders: criar solicitações + acompanhar status
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import ContactRequestReviewPanel from './ContactRequestReviewPanel';
import '../styles/SolicitacoesView.css';
import '../styles/ContactRequests.css';

const REQUEST_TYPES = [
  { key: 'novo_contato', label: 'Novo Contato', icon: 'person-plus' },
  { key: 'nova_empresa', label: 'Nova Empresa', icon: 'building' },
  { key: 'nova_disciplina', label: 'Nova Disciplina', icon: 'book' },
];

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
};

const TYPE_LABELS = {
  novo_contato: 'Novo Contato',
  editar_contato: 'Editar Contato',
  nova_empresa: 'Nova Empresa',
  nova_disciplina: 'Nova Disciplina',
};

function SolicitacoesView() {
  const { hasFullAccess, user } = useAuth();

  // Estado para leaders (não-admin)
  const [activeModal, setActiveModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Dados auxiliares para dropdowns
  const [disciplinas, setDisciplinas] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  // Buscar dados auxiliares (disciplinas e empresas)
  const fetchAuxData = useCallback(async () => {
    if (hasFullAccess) return;
    try {
      const [discRes, empRes] = await Promise.all([
        axios.get(`${API_URL}/api/contatos/filtros/disciplinas`, { withCredentials: true }),
        axios.get(`${API_URL}/api/contatos/filtros/empresas`, { withCredentials: true }),
      ]);
      setDisciplinas(discRes.data.data || []);
      setEmpresas(empRes.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar dados auxiliares:', err);
    }
  }, [hasFullAccess]);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  // Buscar solicitações do usuário
  const fetchMyRequests = useCallback(async () => {
    if (!user?.email || hasFullAccess) return;
    setLoadingRequests(true);
    try {
      const response = await axios.get(`${API_URL}/api/contact-requests`, {
        params: { requester_email: user.email },
        withCredentials: true,
      });
      setMyRequests(response.data.data || []);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, [user?.email, hasFullAccess]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  // Abrir modal de criação
  const openModal = (type) => {
    let initialForm;
    if (type === 'novo_contato') {
      initialForm = { discipline_id: '', company_id: '', name: '', email: '', phone: '', position: '' };
    } else if (type === 'nova_empresa') {
      initialForm = { name: '', discipline_ids: [] };
    } else {
      initialForm = { name: '' };
    }
    setForm(initialForm);
    setActiveModal(type);
  };

  // Toggle disciplina no multi-select
  const toggleDiscipline = (discId) => {
    setForm(prev => {
      const ids = prev.discipline_ids || [];
      return {
        ...prev,
        discipline_ids: ids.includes(discId)
          ? ids.filter(id => id !== discId)
          : [...ids, discId],
      };
    });
  };

  // Submeter solicitação
  const handleSubmit = async () => {
    if (!form.name?.trim()) {
      alert('Nome é obrigatório');
      return;
    }
    if (activeModal === 'novo_contato' && !form.discipline_id) {
      alert('Selecione uma disciplina');
      return;
    }
    if (activeModal === 'nova_empresa' && (!form.discipline_ids || form.discipline_ids.length === 0)) {
      alert('Selecione ao menos uma disciplina associada');
      return;
    }
    setSaving(true);
    try {
      let payload;
      if (activeModal === 'novo_contato') {
        const selectedDiscipline = disciplinas.find(d => String(d.id) === String(form.discipline_id));
        const selectedCompany = empresas.find(e => String(e.id) === String(form.company_id));
        payload = {
          discipline_id: form.discipline_id,
          discipline_name: selectedDiscipline?.discipline_name || '',
          company_id: form.company_id || null,
          company_name: selectedCompany?.name || '',
          name: form.name,
          email: form.email || '',
          phone: form.phone || '',
          position: form.position || '',
        };
      } else if (activeModal === 'nova_empresa') {
        const selectedDisciplines = form.discipline_ids
          .map(id => disciplinas.find(d => String(d.id) === String(id)))
          .filter(Boolean);
        payload = {
          name: form.name.trim(),
          discipline_ids: form.discipline_ids,
          discipline_names: selectedDisciplines.map(d => d.discipline_name),
        };
      } else {
        payload = { name: form.name.trim() };
      }

      await axios.post(`${API_URL}/api/contact-requests`, {
        request_type: activeModal,
        payload,
      }, { withCredentials: true });

      setActiveModal(null);
      setToast('Solicitação enviada com sucesso!');
      setTimeout(() => setToast(null), 4000);
      fetchMyRequests();
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      alert('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Renderizar ícone por tipo
  const renderIcon = (iconName) => {
    switch (iconName) {
      case 'person-plus':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        );
      case 'building':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'book':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Título do modal por tipo
  const getModalTitle = () => {
    const type = REQUEST_TYPES.find(t => t.key === activeModal);
    return type ? `Solicitar ${type.label}` : '';
  };

  // Label do campo principal por tipo
  const getNameLabel = () => {
    switch (activeModal) {
      case 'novo_contato': return 'Nome do Contato';
      case 'nova_empresa': return 'Nome da Empresa';
      case 'nova_disciplina': return 'Nome da Disciplina';
      default: return 'Nome';
    }
  };

  // Vista de admin: painel de revisão
  if (hasFullAccess) {
    return (
      <div className="solicitacoes-container">
        <div className="solicitacoes-header">
          <h2 className="solicitacoes-title">Solicitações de Cadastro</h2>
          <span className="solicitacoes-subtitle">
            Revise e aprove solicitações da equipe de operação
          </span>
        </div>
        <ContactRequestReviewPanel />
      </div>
    );
  }

  // Vista de leader: criar + acompanhar
  return (
    <div className="solicitacoes-container">
      <div className="solicitacoes-header">
        <h2 className="solicitacoes-title">Solicitações de Cadastro</h2>
        <span className="solicitacoes-subtitle">
          Solicite novos cadastros para a equipe de dados aprovar
        </span>
      </div>

      {/* Botões de criação */}
      <div className="solicitacoes-actions">
        {REQUEST_TYPES.map(type => (
          <button
            key={type.key}
            className="solicitacoes-action-btn"
            onClick={() => openModal(type.key)}
          >
            {renderIcon(type.icon)}
            <span>{type.label}</span>
          </button>
        ))}
      </div>

      {/* Minhas Solicitações */}
      <div className="solicitacoes-list-section">
        <h3 className="solicitacoes-list-title">
          Minhas Solicitações e Edições
          {myRequests.filter(r => r.status === 'pendente').length > 0 && (
            <span className="solicitacoes-pending-badge">
              {myRequests.filter(r => r.status === 'pendente').length} pendente{myRequests.filter(r => r.status === 'pendente').length > 1 ? 's' : ''}
            </span>
          )}
        </h3>

        {loadingRequests ? (
          <div className="solicitacoes-loading">Carregando...</div>
        ) : myRequests.length === 0 ? (
          <div className="solicitacoes-empty">
            Nenhuma solicitação enviada. Use os botões acima para solicitar um novo cadastro.
          </div>
        ) : (
          <div className="solicitacoes-list">
            {myRequests.map(req => (
              <div key={req.id} className={`solicitacoes-item solicitacoes-item--${req.status}`}>
                <div className="solicitacoes-item-header">
                  <span className={`solicitacoes-type-badge solicitacoes-type-badge--${req.request_type}`}>
                    {TYPE_LABELS[req.request_type] || req.request_type}
                  </span>
                  <span className={`solicitacoes-status-badge solicitacoes-status-badge--${req.status}`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                </div>
                <div className="solicitacoes-item-body">
                  <span className="solicitacoes-item-summary">
                    {req.request_type === 'editar_contato'
                      ? `${req.payload?.new_values?.name || ''}${req.payload?.changed_fields?.length ? ` (${req.payload.changed_fields.join(', ')})` : ''}`
                      : req.payload?.name || ''}
                  </span>
                  <span className="solicitacoes-item-date">
                    {new Date(req.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {req.status === 'rejeitada' && req.rejection_reason && (
                  <div className="solicitacoes-item-rejection">
                    Motivo: {req.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="cr-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Modal de criação */}
      {activeModal && (
        <div className="ecli-modal-overlay">
          <div className="ecli-modal">
            <div className="ecli-modal-header">
              <h3>{getModalTitle()}</h3>
              <button className="ecli-modal-close" onClick={() => setActiveModal(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="ecli-modal-body">
              {/* Novo contato: disciplina → empresa → dados */}
              {activeModal === 'novo_contato' ? (
                <>
                  <div className="ecli-form-group">
                    <label>Disciplina <span className="ecli-required">*</span></label>
                    <select
                      value={form.discipline_id}
                      onChange={e => setForm({ ...form, discipline_id: e.target.value })}
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
                      value={form.company_id}
                      onChange={e => setForm({ ...form, company_id: e.target.value })}
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
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="ecli-form-row">
                    <div className="ecli-form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="ecli-form-group">
                      <label>Telefone</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        placeholder="00 00000-0000"
                      />
                    </div>
                  </div>
                  <div className="ecli-form-group">
                    <label>Cargo</label>
                    <input
                      type="text"
                      value={form.position}
                      onChange={e => setForm({ ...form, position: e.target.value })}
                      placeholder="Cargo ou função"
                    />
                  </div>
                </>
              ) : activeModal === 'nova_empresa' ? (
                <>
                  <div className="ecli-form-group">
                    <label>{getNameLabel()} <span className="ecli-required">*</span></label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
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
                            checked={(form.discipline_ids || []).includes(String(d.id))}
                            onChange={() => toggleDiscipline(String(d.id))}
                          />
                          <span>{d.discipline_name}</span>
                        </label>
                      ))}
                      {disciplinas.length === 0 && (
                        <span className="ecli-checkbox-empty">Nenhuma disciplina disponível</span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Outros tipos: apenas campo nome */
                <div className="ecli-form-group">
                  <label>{getNameLabel()} <span className="ecli-required">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={getNameLabel()}
                  />
                </div>
              )}
            </div>
            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setActiveModal(null)}>Cancelar</button>
              <button className="ecli-btn-request" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Enviando...' : 'Solicitar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SolicitacoesView;

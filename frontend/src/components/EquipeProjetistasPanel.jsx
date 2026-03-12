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
import MultiSelectDropdown from './formulario-passagem/MultiSelectDropdown';
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

  // --- Estado bulk add (modo Adicionar) ---
  const [bulkDisciplineIds, setBulkDisciplineIds] = useState([]);
  const [projetistaSlots, setProjetistaSlots] = useState([{ company_id: '', contact_id: '' }]);
  const [bulkDetail, setBulkDetail] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState('');

  // --- Estado busca ---
  const [searchTerm, setSearchTerm] = useState('');

  // --- Estado seleção + cópia ---
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copyFeedback, setCopyFeedback] = useState(''); // 'tabela' | 'emails' | ''

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
    setBulkDisciplineIds([]);
    setProjetistaSlots([{ company_id: '', contact_id: '' }]);
    setBulkDetail('');
    setBulkError('');
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

  const getFilteredContacts = (companyId) => {
    const cid = companyId || formData.company_id;
    if (!cid) return [];
    return contatos.filter(c => String(c.company_id) === String(cid));
  };

  const getDisciplineName = (id) => disciplinas.find(d => d.id === id)?.discipline_name || '-';
  const getCompanyName = (id) => empresas.find(e => e.id === id)?.name || '-';

  // --- Helpers para slots de projetista (bulk add) ---
  const addSlot = () => setProjetistaSlots(prev => [...prev, { company_id: '', contact_id: '' }]);
  const removeSlot = (idx) => setProjetistaSlots(prev => prev.filter((_, i) => i !== idx));
  const updateSlot = (idx, field, value) => {
    setProjetistaSlots(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      if (field === 'company_id') return { ...s, company_id: value, contact_id: '' };
      return { ...s, [field]: value };
    }));
  };

  // Contagem dinâmica para o botão bulk
  const bulkFilledProjetistas = projetistaSlots.filter(s => s.company_id || s.contact_id);
  const bulkRecordCount = bulkDisciplineIds.length * Math.max(bulkFilledProjetistas.length, 1);
  const bulkButtonLabel = bulkFilledProjetistas.length === 0
    ? `Adicionar ${bulkDisciplineIds.length} disciplina${bulkDisciplineIds.length !== 1 ? 's' : ''}`
    : `Adicionar ${bulkRecordCount} registro${bulkRecordCount !== 1 ? 's' : ''}`;

  const handleBulkSave = async () => {
    if (bulkDisciplineIds.length === 0) return;
    setBulkSaving(true);
    setBulkError('');
    try {
      const res = await axios.post(`${API_URL}/api/projetos/equipe/batch`, {
        construflow_id: construflowId,
        project_code: projectCode,
        discipline_ids: bulkDisciplineIds,
        projetistas: bulkFilledProjetistas,
        discipline_detail: bulkDetail || undefined,
      }, { withCredentials: true });

      const { created, skipped } = res.data;
      setShowModal(false);
      if (onEquipeChange) onEquipeChange();
      if (onCrossRefChange) onCrossRefChange();

      if (skipped > 0) {
        setRequestSuccess(`${created.length} adicionado(s), ${skipped} duplicata(s) ignorada(s)`);
      } else {
        setRequestSuccess(`${created.length} registro(s) adicionado(s)`);
      }
      setTimeout(() => setRequestSuccess(null), 4000);
    } catch (err) {
      console.error('Erro ao salvar batch:', err);
      setBulkError(err.response?.data?.error || err.message || 'Erro ao salvar.');
    } finally {
      setBulkSaving(false);
    }
  };

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

  // Items selecionáveis (ativos com email)
  const selectableItems = useMemo(() =>
    filteredEquipe.filter(item => item.status !== 'demitido' && (item.email || item.contact?.email)),
    [filteredEquipe]
  );

  const allSelected = selectableItems.length > 0 && selectableItems.every(item => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(item => item.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = async (text, feedbackType) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopyFeedback(feedbackType);
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  const handleCopyTable = () => {
    const headers = ['Disciplina', 'Empresa', 'Contato', 'Cargo', 'Email', 'Telefone', 'Detalhes'];
    const rows = filteredEquipe
      .filter(item => item.status !== 'demitido')
      .map(item => [
        item.discipline?.discipline_name || '-',
        item.company?.name || '-',
        item.contact?.name || '-',
        item.position || item.contact?.position || '-',
        item.email || item.contact?.email || '-',
        item.phone || item.contact?.phone || '-',
        item.discipline_detail || '-',
      ].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    copyToClipboard(tsv, 'tabela');
  };

  const handleCopyEmails = () => {
    const emails = new Set();
    filteredEquipe.forEach(item => {
      if (selectedIds.has(item.id)) {
        const email = item.email || item.contact?.email;
        if (email) emails.add(email);
      }
    });
    const emailList = [...emails].join('; ');
    copyToClipboard(emailList, `${emails.size} email${emails.size > 1 ? 's' : ''}`);
    setSelectedIds(new Set());
  };

  return (
    <div className="ecli-panel">
      {/* Toast de cópia */}
      {copyFeedback && (
        <div className="ecli-request-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{copyFeedback === 'tabela' ? 'Tabela copiada!' : `${copyFeedback} copiado(s)!`}</span>
        </div>
      )}

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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <button className="ecli-add-btn" onClick={handleCopyEmails} title="Copiar emails selecionados">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Copiar {selectedIds.size} Email{selectedIds.size > 1 ? 's' : ''}
              </button>
            )}
            {filteredEquipe.length > 0 && (
              <button className="ecli-add-btn ecli-copy-btn" onClick={handleCopyTable} title="Copiar tabela como TSV">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copiar Tabela
              </button>
            )}
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
                <th className="ecli-th-checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    title="Selecionar todos com email"
                    disabled={selectableItems.length === 0}
                  />
                </th>
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
                  <td colSpan={9} className="ecli-empty-row">
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

                  const hasEmail = !!(email);
                  const isSelectable = !isDismissed && hasEmail;

                  return (
                    <tr key={item.id} className={isDismissed ? 'ecli-row--demitido' : ''} title={dismissedTooltip}>
                      <td className="ecli-td-checkbox">
                        {isSelectable ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                          />
                        ) : null}
                      </td>
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
          <div className={`ecli-modal ${!editingItem ? 'ecli-modal--wide' : ''}`}>
            <div className="ecli-modal-header">
              <h3>{editingItem ? 'Editar Membro' : 'Adicionar Membros'}</h3>
              <button className="ecli-modal-close" onClick={() => setShowModal(false)} aria-label="Fechar modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="ecli-modal-body">
              {editingItem ? (
                /* === MODO EDITAR (single-item, inalterado) === */
                <>
                  <div className="ecli-form-group">
                    <label>Disciplina</label>
                    <div className="ecli-readonly">{getDisciplineName(formData.discipline_id)}</div>
                  </div>
                  <div className="ecli-form-group">
                    <label>Empresa</label>
                    <div className="ecli-readonly">{getCompanyName(formData.company_id)}</div>
                  </div>
                  <div className="ecli-form-group">
                    <label>Contato</label>
                    <select value={formData.contact_id} onChange={e => handleContactChange(e.target.value)} disabled={!formData.company_id}>
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
                      <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: stripNonDigits(e.target.value) })} placeholder="00 00000-0000" />
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
                </>
              ) : (
                /* === MODO BULK ADD (multi-select) === */
                <>
                  {/* Seção 1: Disciplinas (multi-select) */}
                  <div className="ecli-form-group">
                    <label>Disciplinas <span className="ecli-required">*</span></label>
                    <MultiSelectDropdown
                      options={disciplinas.map(d => ({ value: d.id, label: d.discipline_name }))}
                      selectedValues={bulkDisciplineIds}
                      onChange={setBulkDisciplineIds}
                      placeholder="Selecione disciplinas..."
                      emptyMessage="Nenhuma disciplina disponível"
                    />
                  </div>

                  {/* Seção 2: Projetistas (slots repetíveis) */}
                  <div className="ecli-form-group">
                    <label>Projetistas</label>
                    <div className="ecli-projetista-slots">
                      {projetistaSlots.map((slot, idx) => (
                        <div key={idx} className="ecli-projetista-slot">
                          <span className="ecli-slot-number">#{idx + 1}</span>
                          <select
                            value={slot.company_id}
                            onChange={e => updateSlot(idx, 'company_id', e.target.value)}
                          >
                            <option value="">Empresa...</option>
                            {empresas.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.status === 'pendente' ? '(pendente)' : ''}
                              </option>
                            ))}
                          </select>
                          <select
                            value={slot.contact_id}
                            onChange={e => updateSlot(idx, 'contact_id', e.target.value)}
                            disabled={!slot.company_id}
                          >
                            <option value="">{slot.company_id ? 'Contato...' : 'Empresa primeiro'}</option>
                            {getFilteredContacts(slot.company_id).map(c => (
                              <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>
                            ))}
                          </select>
                          {projetistaSlots.length > 1 && (
                            <button
                              type="button"
                              className="ecli-slot-remove"
                              onClick={() => removeSlot(idx)}
                              aria-label={`Remover projetista #${idx + 1}`}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="ecli-add-slot-btn" onClick={addSlot}>
                        + Adicionar projetista
                      </button>
                    </div>
                  </div>

                  {/* Seção 3: Detalhes (opcional) */}
                  <div className="ecli-form-group">
                    <label>Detalhes da Disciplina</label>
                    <textarea
                      value={bulkDetail}
                      onChange={e => setBulkDetail(e.target.value)}
                      placeholder="Informações adicionais (compartilhado para todos os registros)..."
                      rows={2}
                    />
                  </div>

                  {bulkError && (
                    <div className="ecli-bulk-error" role="alert">{bulkError}</div>
                  )}
                </>
              )}
            </div>

            <div className="ecli-modal-footer">
              <button className="ecli-btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              {editingItem ? (
                <button className="ecli-btn-save" onClick={handleSave}>Salvar</button>
              ) : (
                <button
                  className="ecli-btn-save"
                  onClick={handleBulkSave}
                  disabled={bulkDisciplineIds.length === 0 || bulkSaving}
                >
                  {bulkSaving ? (
                    <span className="ecli-btn-loading">
                      <span className="ecli-portal-spinner" /> Salvando...
                    </span>
                  ) : (
                    <>
                      {bulkButtonLabel}
                      {bulkRecordCount > 1 && <span className="ecli-record-count">{bulkRecordCount}</span>}
                    </>
                  )}
                </button>
              )}
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

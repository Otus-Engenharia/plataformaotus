import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import MultiSelectDropdown from './MultiSelectDropdown';
import CreateContactModal from './CreateContactModal';

function StepProjeto({ formData, updateFormData, formOptions }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // Busca contatos quando o cliente muda
  useEffect(() => {
    if (!formData.company_id) {
      setContacts([]);
      return;
    }
    setLoadingContacts(true);
    axios.get(`${API_URL}/api/projetos/form/contacts/${formData.company_id}`, { withCredentials: true })
      .then(res => {
        if (res.data.success) {
          setContacts(res.data.data);
        }
      })
      .catch(err => console.error('Erro ao buscar contatos:', err))
      .finally(() => setLoadingContacts(false));
  }, [formData.company_id]);

  const contactOptions = contacts.map(c => ({
    value: c.id,
    label: c.name + (c.position ? ` (${c.position})` : ''),
  }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    updateFormData({ [name]: value });
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    updateFormData({ [name]: value === '' ? null : value });
  };

  return (
    <div className="wizard-step">
      <h2 className="wizard-step-title">Projeto</h2>
      <p className="wizard-step-description">Informações técnicas do empreendimento</p>

      <div className="form-group">
        <label htmlFor="name">Nome do Projeto (EMPRESA_PROJETO) *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Ex: CONSTRUTORA_RESIDENCIAL PARQUE"
          style={{ textTransform: 'uppercase' }}
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Percepções gerais do vendedor</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows="4"
          placeholder="Observações e percepções relevantes sobre o projeto e o cliente..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="address">Endereço da obra</label>
        <input
          type="text"
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Endereço completo da obra"
        />
      </div>

      <div className="form-group">
        <label>Contato na empresa</label>
        {loadingContacts ? (
          <p className="form-loading">Carregando contatos...</p>
        ) : (
          <>
            <MultiSelectDropdown
              options={contactOptions}
              selectedValues={formData.contact_ids}
              onChange={(values) => updateFormData({ contact_ids: values })}
              placeholder="Selecione os contatos..."
              emptyMessage="Cadastre um contato para esta empresa"
              disabled={!formData.company_id}
            />
            <button
              type="button"
              className="btn-add-new"
              disabled={!formData.company_id}
              onClick={() => setShowContactModal(true)}
              title={!formData.company_id ? 'Para cadastrar um contato, selecione ou cadastre um cliente' : ''}
            >
              + Cadastrar novo contato
            </button>
          </>
        )}
      </div>

      {showContactModal && (
        <CreateContactModal
          companyId={formData.company_id}
          onClose={() => setShowContactModal(false)}
          onCreated={(newContact) => {
            setContacts(prev => [...prev, newContact].sort((a, b) => a.name.localeCompare(b.name)));
            updateFormData({ contact_ids: [...formData.contact_ids, newContact.id] });
            setShowContactModal(false);
          }}
        />
      )}

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="area_construida">Área construída (m²)</label>
          <input
            type="number"
            id="area_construida"
            name="area_construida"
            value={formData.area_construida || ''}
            onChange={handleNumberChange}
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div className="form-group">
          <label htmlFor="area_efetiva">Área efetiva (m²)</label>
          <input
            type="number"
            id="area_efetiva"
            name="area_efetiva"
            value={formData.area_efetiva || ''}
            onChange={handleNumberChange}
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="form-row form-row-3">
        <div className="form-group">
          <label htmlFor="numero_unidades">Nº de unidades</label>
          <input
            type="number"
            id="numero_unidades"
            name="numero_unidades"
            value={formData.numero_unidades || ''}
            onChange={handleNumberChange}
            min="0"
            placeholder="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="numero_torres">Nº de torres</label>
          <input
            type="number"
            id="numero_torres"
            name="numero_torres"
            value={formData.numero_torres || ''}
            onChange={handleNumberChange}
            min="0"
            placeholder="0"
          />
        </div>
        <div className="form-group">
          <label htmlFor="numero_pavimentos">Nº de pavimentos</label>
          <input
            type="number"
            id="numero_pavimentos"
            name="numero_pavimentos"
            value={formData.numero_pavimentos || ''}
            onChange={handleNumberChange}
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="tipologia_empreendimento">Tipologia do empreendimento</label>
          <select
            id="tipologia_empreendimento"
            name="tipologia_empreendimento"
            value={formData.tipologia_empreendimento}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.tipologia_empreendimento || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="padrao_acabamento">Padrão de acabamento</label>
          <select
            id="padrao_acabamento"
            name="padrao_acabamento"
            value={formData.padrao_acabamento}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.padrao_acabamento || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default StepProjeto;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import SearchableSelect from '../SearchableSelect';
import CreateClientModal from './CreateClientModal';

function StepCliente({ formData, updateFormData }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/projetos/form/clients`, { withCredentials: true })
      .then(res => {
        if (res.data.success) {
          setClients(res.data.data);
        }
      })
      .catch(err => console.error('Erro ao buscar clientes:', err))
      .finally(() => setLoading(false));
  }, []);

  const options = clients.map(c => ({ value: c.id, label: c.name }));

  const handleClientChange = (e) => {
    const newCompanyId = e.target.value;
    updateFormData({
      company_id: newCompanyId,
      contact_ids: [],
    });
  };

  const handleClientCreated = (newClient) => {
    setClients(prev => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
    updateFormData({
      company_id: newClient.id,
      contact_ids: [],
    });
    setShowModal(false);
  };

  return (
    <div className="wizard-step">
      <h2 className="wizard-step-title">Cliente</h2>
      <p className="wizard-step-description">Selecione o cliente do projeto</p>

      <div className="form-group">
        <label htmlFor="company_id">Cliente *</label>
        {loading ? (
          <p className="form-loading">Carregando clientes...</p>
        ) : (
          <SearchableSelect
            id="company_id"
            value={formData.company_id}
            onChange={handleClientChange}
            options={options}
            placeholder="Buscar cliente..."
          />
        )}
      </div>

      <button type="button" className="btn-add-new" onClick={() => setShowModal(true)}>
        + Cadastrar novo cliente
      </button>

      {showModal && (
        <CreateClientModal
          onClose={() => setShowModal(false)}
          onCreated={handleClientCreated}
        />
      )}
    </div>
  );
}

export default StepCliente;

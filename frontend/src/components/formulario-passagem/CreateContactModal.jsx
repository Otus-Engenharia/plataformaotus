import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import { stripNonDigits } from '../../utils/phone-utils';

function CreateContactModal({ companyId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setForm(prev => ({ ...prev, phone: stripNonDigits(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('O nome do contato é obrigatório.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_URL}/api/projetos/form/contacts`,
        { ...form, company_id: companyId },
        { withCredentials: true }
      );
      if (res.data.success) {
        onCreated(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar contato.');
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Cadastrar novo contato</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="formulario-passagem-message error">{error}</div>}

        <div className="form-group">
          <label htmlFor="modal-contact-name">Nome do contato *</label>
          <input
            type="text"
            id="modal-contact-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nome completo"
          />
        </div>

        <div className="form-group">
          <label htmlFor="modal-contact-email">Email</label>
          <input
            type="email"
            id="modal-contact-email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="email@exemplo.com"
          />
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label htmlFor="modal-contact-phone">Telefone</label>
            <input
              type="tel"
              id="modal-contact-phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="00 00000-0000"
              title="Digite apenas os números, sem parênteses ou traços"
            />
          </div>
          <div className="form-group">
            <label htmlFor="modal-contact-position">Cargo</label>
            <input
              type="text"
              id="modal-contact-position"
              name="position"
              value={form.position}
              onChange={handleChange}
              placeholder="Ex: Engenheiro, Diretor"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-prev" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Criando...' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateContactModal;

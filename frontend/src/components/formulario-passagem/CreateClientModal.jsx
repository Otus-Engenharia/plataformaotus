import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';

function CreateClientModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    company_address: '',
    maturidade_cliente: '',
    nivel_cliente: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('O nome do cliente é obrigatório.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(
        `${API_URL}/api/projetos/form/clients`,
        form,
        { withCredentials: true }
      );
      if (res.data.success) {
        onCreated(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar cliente.');
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
          <h2>Cadastrar novo cliente</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="formulario-passagem-message error">{error}</div>}

        <div className="form-group">
          <label htmlFor="modal-name">Nome do cliente *</label>
          <input
            type="text"
            id="modal-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Nome da empresa"
          />
        </div>

        <div className="form-group">
          <label htmlFor="modal-address">Endereço do cliente</label>
          <input
            type="text"
            id="modal-address"
            name="company_address"
            value={form.company_address}
            onChange={handleChange}
            placeholder="Endereço completo"
          />
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label htmlFor="modal-maturidade">Maturidade do cliente</label>
            <input
              type="text"
              id="modal-maturidade"
              name="maturidade_cliente"
              value={form.maturidade_cliente}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="modal-nivel">Nível do cliente</label>
            <input
              type="text"
              id="modal-nivel"
              name="nivel_cliente"
              value={form.nivel_cliente}
              onChange={handleChange}
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

export default CreateClientModal;

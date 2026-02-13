import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import StepCliente from './StepCliente';
import StepProjeto from './StepProjeto';
import StepNegocio from './StepNegocio';

const INITIAL_FORM_DATA = {
  company_id: null,
  name: '',
  description: '',
  address: '',
  contact_ids: [],
  area_construida: null,
  area_efetiva: null,
  numero_unidades: null,
  numero_torres: null,
  numero_pavimentos: null,
  tipologia_empreendimento: '',
  padrao_acabamento: '',
  data_venda: '',
  complexidade: '',
  complexidade_projetista: '',
  complexidade_tecnica: '',
  service_type: '',
  tipo_pagamento: '',
  responsavel_plataforma_comunicacao: '',
  responsavel_acd: '',
  link_contrato_ger: '',
  link_escopo_descritivo: '',
  link_proposta_ger: '',
  fase_entrada: '',
  vgv_empreendimento: '',
  service_ids: [],
  plataforma_comunicacao: '',
  plataforma_acd: '',
};

function FormularioPassagemWizard() {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formOptions, setFormOptions] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    axios.get(`${API_URL}/api/projetos/form/options`, { withCredentials: true })
      .then(res => {
        if (res.data.success) {
          setFormOptions(res.data.data);
        }
      })
      .catch(err => console.error('Erro ao buscar opções:', err));
  }, []);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const validateForm = () => {
    if (!formData.company_id) {
      setMessage({ type: 'error', text: 'Selecione um cliente.' });
      return false;
    }
    if (!formData.name || !formData.name.trim()) {
      setMessage({ type: 'error', text: 'O nome do projeto é obrigatório.' });
      return false;
    }
    setMessage({ type: '', text: '' });
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post(
        `${API_URL}/api/projetos/form/submit`,
        formData,
        { withCredentials: true }
      );

      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `Projeto "${response.data.data.name}" criado com sucesso!`,
        });
        setFormData(INITIAL_FORM_DATA);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Erro ao criar projeto. Tente novamente.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="formulario-passagem-container">
      <div className="formulario-passagem-header">
        <h1>Formulário de Passagem</h1>
        <p>Registre a passagem de um projeto de vendas para operação</p>
      </div>

      {message.text && (
        <div className={`formulario-passagem-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="formulario-passagem-form">
        <StepCliente formData={formData} updateFormData={updateFormData} />

        <hr className="section-divider" />

        <StepProjeto formData={formData} updateFormData={updateFormData} formOptions={formOptions} />

        <hr className="section-divider" />

        <StepNegocio formData={formData} updateFormData={updateFormData} formOptions={formOptions} />

        <div className="wizard-actions">
          <div className="wizard-actions-right">
            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Formulário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FormularioPassagemWizard;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../api';
import MultiSelectDropdown from './MultiSelectDropdown';

function StepNegocio({ formData, updateFormData, formOptions }) {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/projetos/form/services`, { withCredentials: true })
      .then(res => {
        if (res.data.success) {
          setServices(res.data.data);
        }
      })
      .catch(err => console.error('Erro ao buscar serviços:', err))
      .finally(() => setLoadingServices(false));
  }, []);

  const serviceOptions = services.map(s => ({ value: s.id, label: s.name }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    updateFormData({ [name]: value });
  };

  return (
    <div className="wizard-step">
      <h2 className="wizard-step-title">Negócio</h2>
      <p className="wizard-step-description">Informações comerciais e contratuais</p>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="data_venda">Data da venda</label>
          <input
            type="date"
            id="data_venda"
            name="data_venda"
            value={formData.data_venda}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="service_type">Tipo de serviço</label>
          <select
            id="service_type"
            name="service_type"
            value={formData.service_type}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.tipo_servico || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row form-row-3">
        <div className="form-group">
          <label htmlFor="complexidade">Complexidade</label>
          <input
            type="text"
            id="complexidade"
            name="complexidade"
            value={formData.complexidade}
            onChange={handleChange}
            placeholder="Resultado da calculadora"
          />
        </div>
        <div className="form-group">
          <label htmlFor="complexidade_projetista">Complexidade projetistas</label>
          <input
            type="text"
            id="complexidade_projetista"
            name="complexidade_projetista"
            value={formData.complexidade_projetista}
            onChange={handleChange}
            placeholder=""
          />
        </div>
        <div className="form-group">
          <label htmlFor="complexidade_tecnica">Complexidade técnica</label>
          <input
            type="text"
            id="complexidade_tecnica"
            name="complexidade_tecnica"
            value={formData.complexidade_tecnica}
            onChange={handleChange}
            placeholder=""
          />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="tipo_pagamento">Tipo de pagamento</label>
          <select
            id="tipo_pagamento"
            name="tipo_pagamento"
            value={formData.tipo_pagamento}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.tipo_pagamento || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="fase_entrada">Fase de entrada</label>
          <input
            type="text"
            id="fase_entrada"
            name="fase_entrada"
            value={formData.fase_entrada}
            onChange={handleChange}
            placeholder=""
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="vgv_empreendimento">VGV do empreendimento</label>
        <input
          type="text"
          id="vgv_empreendimento"
          name="vgv_empreendimento"
          value={formData.vgv_empreendimento}
          onChange={handleChange}
          placeholder=""
        />
      </div>

      <div className="form-group">
        <label>Entregáveis Otus</label>
        {loadingServices ? (
          <p className="form-loading">Carregando serviços...</p>
        ) : (
          <MultiSelectDropdown
            options={serviceOptions}
            selectedValues={formData.service_ids}
            onChange={(values) => updateFormData({ service_ids: values })}
            placeholder="Selecione os entregáveis..."
            emptyMessage="Nenhum serviço cadastrado"
          />
        )}
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="plataforma_comunicacao">Plataforma de comunicação</label>
          <select
            id="plataforma_comunicacao"
            name="plataforma_comunicacao"
            value={formData.plataforma_comunicacao}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.plataforma_comunicacao || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="responsavel_plataforma_comunicacao">Responsável pela plataforma</label>
          <select
            id="responsavel_plataforma_comunicacao"
            name="responsavel_plataforma_comunicacao"
            value={formData.responsavel_plataforma_comunicacao}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.responsavel_plataforma || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label htmlFor="plataforma_acd">Repositório de arquivos (ACD)</label>
          <select
            id="plataforma_acd"
            name="plataforma_acd"
            value={formData.plataforma_acd}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.plataforma_acd || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="responsavel_acd">Responsável pelo ACD</label>
          <select
            id="responsavel_acd"
            name="responsavel_acd"
            value={formData.responsavel_acd}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.responsavel_acd || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="link_contrato_ger">Link do contrato (GER)</label>
        <input
          type="text"
          id="link_contrato_ger"
          name="link_contrato_ger"
          value={formData.link_contrato_ger}
          onChange={handleChange}
          placeholder="https://..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="link_escopo_descritivo">Link do escopo descritivo</label>
        <input
          type="text"
          id="link_escopo_descritivo"
          name="link_escopo_descritivo"
          value={formData.link_escopo_descritivo}
          onChange={handleChange}
          placeholder="https://..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="link_proposta_ger">Link da proposta (GER)</label>
        <input
          type="text"
          id="link_proposta_ger"
          name="link_proposta_ger"
          value={formData.link_proposta_ger}
          onChange={handleChange}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

export default StepNegocio;

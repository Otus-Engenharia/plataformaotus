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
  const valorClienteOptions = (formOptions.valor_cliente || []).map(opt => ({
    value: opt.value, label: opt.label,
  }));

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
          <select
            id="fase_entrada"
            name="fase_entrada"
            value={formData.fase_entrada}
            onChange={handleChange}
          >
            <option value="">Selecione...</option>
            {(formOptions.fase_entrada || []).map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Novos campos - Contexto do Cliente (FB-209) */}
      <div className="form-group">
        <label htmlFor="visao_empresa">Visão da empresa</label>
        <textarea
          id="visao_empresa"
          name="visao_empresa"
          value={formData.visao_empresa}
          onChange={handleChange}
          rows="3"
          placeholder="Como é a empresa, cultura, porte..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="visao_projeto_riscos">Visão do projeto e riscos envolvidos</label>
        <textarea
          id="visao_projeto_riscos"
          name="visao_projeto_riscos"
          value={formData.visao_projeto_riscos}
          onChange={handleChange}
          rows="3"
          placeholder="Características do projeto, riscos identificados..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="principais_dores">Principais dores que levaram à contratação da Otus</label>
        <textarea
          id="principais_dores"
          name="principais_dores"
          value={formData.principais_dores}
          onChange={handleChange}
          rows="3"
          placeholder="Por que o cliente buscou a Otus..."
        />
      </div>

      <div className="form-group">
        <label>O que é valor para este cliente</label>
        <MultiSelectDropdown
          options={valorClienteOptions}
          selectedValues={formData.valor_cliente}
          onChange={(values) => updateFormData({ valor_cliente: values })}
          placeholder="Selecione o que é valor para o cliente..."
          emptyMessage="Nenhuma opção disponível"
        />
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="coordenacao_externa"
            checked={formData.coordenacao_externa}
            onChange={(e) => updateFormData({ coordenacao_externa: e.target.checked })}
          />
          <span>Já trabalha com coordenação externa em outros projetos</span>
        </label>
      </div>

      <div className="form-group">
        <label htmlFor="info_contrato">Informações importantes do contrato</label>
        <textarea
          id="info_contrato"
          name="info_contrato"
          value={formData.info_contrato}
          onChange={handleChange}
          rows="3"
          placeholder="Caso vendedor não tenha na passagem, líder pode preencher depois..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="info_adicional_confidencial">
          Informação adicional confidencial
          <small style={{ display: 'block', fontWeight: 'normal', color: '#888', marginTop: '2px' }}>
            Informação que vendas acha importante o líder saber e que não deve chegar diretamente na equipe
          </small>
        </label>
        <textarea
          id="info_adicional_confidencial"
          name="info_adicional_confidencial"
          value={formData.info_adicional_confidencial}
          onChange={handleChange}
          rows="3"
          placeholder="Informações sensíveis visíveis apenas para o líder..."
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
          <label htmlFor="responsavel_plataforma_comunicacao">Responsável pelo pagamento e contratação das plataformas</label>
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

/**
 * Vista: Formulário de Passagem
 * 
 * Visível apenas para diretores, admin e setor de vendas
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../styles/FormularioPassagemView.css';

function FormularioPassagemView() {
  const { user, canAccessFormularioPassagem } = useAuth();
  const [formData, setFormData] = useState({
    cliente: '',
    projeto: '',
    dataPassagem: '',
    responsavel: '',
    observacoes: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Verifica acesso
  if (!canAccessFormularioPassagem) {
    return (
      <div className="formulario-passagem-container">
        <div className="formulario-passagem-error">
          <h2>Acesso Negado</h2>
          <p>Você não tem permissão para acessar esta funcionalidade.</p>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // TODO: Implementar endpoint para salvar formulário de passagem
      // Por enquanto, apenas simula o envio
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      setMessage({
        type: 'success',
        text: 'Formulário enviado com sucesso!',
      });
      
      // Limpa o formulário
      setFormData({
        cliente: '',
        projeto: '',
        dataPassagem: '',
        responsavel: '',
        observacoes: '',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Erro ao enviar formulário. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="formulario-passagem-container">
      <div className="formulario-passagem-header">
        <h1>Formulário de Passagem</h1>
        <p>Preencha os dados para registrar uma passagem de projeto</p>
      </div>

      {message.text && (
        <div className={`formulario-passagem-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <form className="formulario-passagem-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="cliente">Cliente *</label>
          <input
            type="text"
            id="cliente"
            name="cliente"
            value={formData.cliente}
            onChange={handleChange}
            required
            placeholder="Nome do cliente"
          />
        </div>

        <div className="form-group">
          <label htmlFor="projeto">Projeto *</label>
          <input
            type="text"
            id="projeto"
            name="projeto"
            value={formData.projeto}
            onChange={handleChange}
            required
            placeholder="Nome do projeto"
          />
        </div>

        <div className="form-group">
          <label htmlFor="dataPassagem">Data de Passagem *</label>
          <input
            type="date"
            id="dataPassagem"
            name="dataPassagem"
            value={formData.dataPassagem}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="responsavel">Responsável *</label>
          <input
            type="text"
            id="responsavel"
            name="responsavel"
            value={formData.responsavel}
            onChange={handleChange}
            required
            placeholder="Nome do responsável"
          />
        </div>

        <div className="form-group">
          <label htmlFor="observacoes">Observações</label>
          <textarea
            id="observacoes"
            name="observacoes"
            value={formData.observacoes}
            onChange={handleChange}
            rows="5"
            placeholder="Observações adicionais sobre a passagem"
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Formulário'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormularioPassagemView;

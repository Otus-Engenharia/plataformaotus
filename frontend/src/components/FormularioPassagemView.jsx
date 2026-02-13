/**
 * Vista: Formulário de Passagem
 *
 * Visível apenas para diretores, admin e setor de vendas.
 * Renderiza o wizard de passagem de projeto (vendas → operação).
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import FormularioPassagemWizard from './formulario-passagem/FormularioPassagemWizard';
import '../styles/FormularioPassagemView.css';

function FormularioPassagemView() {
  const { canAccessFormularioPassagem } = useAuth();

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

  return <FormularioPassagemWizard />;
}

export default FormularioPassagemView;

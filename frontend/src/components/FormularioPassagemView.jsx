/**
 * Vista: Formulário de Passagem
 *
 * Acesso controlado pela rota /vendas (canAccessVendasArea).
 * Renderiza o wizard de passagem de projeto (vendas → operação).
 */

import React from 'react';
import FormularioPassagemWizard from './formulario-passagem/FormularioPassagemWizard';
import '../styles/FormularioPassagemView.css';

function FormularioPassagemView() {
  return <FormularioPassagemWizard />;
}

export default FormularioPassagemView;

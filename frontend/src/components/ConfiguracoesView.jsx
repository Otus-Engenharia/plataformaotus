/**
 * Componente: Vista de Configurações
 *
 * Contém 4 subabas:
 * - Operação: Gerenciamento de acessos e overrides de usuários
 * - Cargos: Permissões padrão por cargo
 * - Clientes: Configurações de clientes
 * - Feedbacks: Gerenciamento de feedbacks da plataforma
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import OperacaoView from './OperacaoView';
import CargosView from './CargosView';
import ClientesView from './ClientesView';
import FeedbackAdminView from '../pages/feedbacks/FeedbackAdminView';
import '../styles/ConfiguracoesView.css';

function ConfiguracoesView() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('operacao');

  // Ler tab da URL ao montar ou quando URL mudar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['operacao', 'cargos', 'clientes', 'feedbacks'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const tabs = [
    { id: 'operacao', label: 'Operação', component: OperacaoView },
    { id: 'cargos', label: 'Cargos', component: CargosView },
    { id: 'clientes', label: 'Clientes', component: ClientesView },
    { id: 'feedbacks', label: 'Feedbacks', component: FeedbackAdminView },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || OperacaoView;

  return (
    <div className="configuracoes-container">
      <div className="configuracoes-header">
        <h2>Configurações</h2>
      </div>

      <div className="configuracoes-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`config-tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="configuracoes-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default ConfiguracoesView;

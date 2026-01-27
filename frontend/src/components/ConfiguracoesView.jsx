/**
 * Componente: Vista de Configurações
 * 
 * Contém 3 subabas:
 * - Operação: Gerenciamento de acessos e permissões de vistas
 * - Comercial: Configurações comerciais (a implementar)
 * - Clientes: Configurações de clientes (a implementar)
 */

import React, { useState } from 'react';
import OperacaoView from './OperacaoView';
import ComercialView from './ComercialView';
import ClientesView from './ClientesView';
import LogsView from './LogsView';
import '../styles/ConfiguracoesView.css';

function ConfiguracoesView() {
  const [activeTab, setActiveTab] = useState('operacao');

  const tabs = [
    { id: 'operacao', label: 'Operação', component: OperacaoView },
    { id: 'comercial', label: 'Comercial', component: ComercialView },
    { id: 'clientes', label: 'Clientes', component: ClientesView },
    { id: 'logs', label: 'Logs', component: LogsView },
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

/**
 * Componente: Vista de Configurações
 *
 * Contém subabas:
 * - Operação: Gerenciamento de acessos e overrides de usuários
 * - Cargos: Permissões padrão por cargo
 * - Clientes: Configurações de clientes
 * - Feedbacks: Gerenciamento de feedbacks da plataforma
 * - Módulos: Configuração dos módulos da Home (dev only)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OperacaoView from './OperacaoView';
import CargosView from './CargosView';
import ClientesView from './ClientesView';
import FeedbackAdminView from '../pages/feedbacks/FeedbackAdminView';
import HomeModulesView from './HomeModulesView';
import '../styles/ConfiguracoesView.css';

function ConfiguracoesView() {
  const location = useLocation();
  const { isDev } = useAuth();
  const [activeTab, setActiveTab] = useState('operacao');

  // Abas disponíveis (Módulos só aparece para devs)
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'operacao', label: 'Operação', component: OperacaoView },
      { id: 'cargos', label: 'Cargos', component: CargosView },
      { id: 'clientes', label: 'Clientes', component: ClientesView },
      { id: 'feedbacks', label: 'Feedbacks', component: FeedbackAdminView },
    ];
    if (isDev) {
      baseTabs.push({ id: 'modulos', label: 'Módulos', component: HomeModulesView });
    }
    return baseTabs;
  }, [isDev]);

  // Lista de IDs válidos para validação
  const validTabIds = useMemo(() => tabs.map(t => t.id), [tabs]);

  // Ler tab da URL ao montar ou quando URL mudar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && validTabIds.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search, validTabIds]);

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

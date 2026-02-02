/**
 * Componente: Vista de Configurações
 *
 * Contém subabas:
 * - Permissões: Sistema unificado de permissões (matriz de acesso, módulos, exceções)
 * - Usuários: Gerenciamento de usuários e níveis de acesso
 * - Clientes: Configurações de clientes
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PermissoesView from './PermissoesView';
import OperacaoView from './OperacaoView';
import ClientesView from './ClientesView';
import '../styles/ConfiguracoesView.css';

function ConfiguracoesView() {
  const location = useLocation();
  const { isDev, isAdmin, isDirector } = useAuth();
  const [activeTab, setActiveTab] = useState('permissoes');

  // Verificar se tem acesso privilegiado
  const hasPrivilegedAccess = isDev || isAdmin || isDirector;

  // Abas disponíveis
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'permissoes', label: 'Permissões', component: PermissoesView },
      { id: 'usuarios', label: 'Usuários', component: OperacaoView },
      { id: 'clientes', label: 'Clientes', component: ClientesView },
    ];
    return baseTabs;
  }, []);

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

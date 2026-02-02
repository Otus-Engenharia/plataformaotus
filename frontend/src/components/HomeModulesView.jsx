/**
 * Componente: Vista de Módulos da Home
 *
 * Gerencia a visibilidade e configuração dos módulos na tela inicial.
 * Apenas visível para desenvolvedores.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import '../styles/HomeModulesView.css';

// Ícones inline
const Icons = {
  Grid: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Loader: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
};

// Labels para tipos de acesso
const ACCESS_TYPE_LABELS = {
  all: 'Todos',
  leader_up: 'Líder+',
  privileged: 'Privilegiados',
  dev_only: 'Apenas Dev',
};

const ACCESS_TYPE_COLORS = {
  all: '#22c55e',
  leader_up: '#3b82f6',
  privileged: '#f59e0b',
  dev_only: '#8b5cf6',
};

function HomeModulesView() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  // Fetch modules
  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/home-modules`, {
        withCredentials: true,
      });
      if (response.data?.success) {
        setModules(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar módulos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  // Update module
  const updateModule = async (moduleId, field, value) => {
    try {
      setSavingId(moduleId);
      const response = await axios.put(
        `${API_URL}/api/admin/home-modules/${moduleId}`,
        { [field]: value },
        { withCredentials: true }
      );
      if (response.data?.success) {
        setModules(prev =>
          prev.map(m => (m.id === moduleId ? { ...m, [field]: value } : m))
        );
      }
    } catch (err) {
      console.error('Erro ao atualizar módulo:', err);
      alert('Erro ao atualizar módulo. Verifique o console.');
    } finally {
      setSavingId(null);
    }
  };

  // Stats
  const visibleCount = modules.filter(m => m.visible).length;
  const hiddenCount = modules.filter(m => !m.visible).length;

  if (loading) {
    return (
      <div className="modules-container">
        <div className="modules-loading">Carregando módulos...</div>
      </div>
    );
  }

  return (
    <div className="modules-container">
      {/* Header */}
      <div className="modules-header">
        <div className="modules-title-section">
          <h2>Módulos da Home</h2>
          <p className="modules-subtitle">
            Configure a visibilidade e permissões dos módulos na tela inicial
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchModules}>
          <Icons.Refresh />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="modules-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <Icons.Grid />
          </div>
          <div className="stat-info">
            <span className="stat-value">{modules.length}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
        <div className="stat-card highlight-green">
          <div className="stat-icon">
            <Icons.Eye />
          </div>
          <div className="stat-info">
            <span className="stat-value">{visibleCount}</span>
            <span className="stat-label">Visíveis</span>
          </div>
        </div>
        <div className="stat-card highlight-red">
          <div className="stat-icon">
            <Icons.EyeOff />
          </div>
          <div className="stat-info">
            <span className="stat-value">{hiddenCount}</span>
            <span className="stat-label">Ocultos</span>
          </div>
        </div>
      </div>

      {/* Modules Table */}
      <div className="modules-table-container">
        <table className="modules-table">
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Módulo</th>
              <th>Rota</th>
              <th>Acesso</th>
              <th>Visível</th>
            </tr>
          </thead>
          <tbody>
            {modules.map(module => (
              <tr key={module.id} className={!module.visible ? 'row-hidden' : ''}>
                <td className="cell-order">
                  <input
                    type="number"
                    value={module.sort_order}
                    onChange={e => updateModule(module.id, 'sort_order', parseInt(e.target.value) || 0)}
                    className="input-order"
                    min="0"
                    step="10"
                  />
                </td>
                <td className="cell-module">
                  <div className="module-info">
                    <span
                      className="module-color"
                      style={{ backgroundColor: module.color }}
                    />
                    <div className="module-details">
                      <span className="module-name">{module.name}</span>
                      <span className="module-description">{module.description}</span>
                    </div>
                  </div>
                </td>
                <td className="cell-path">
                  <code>{module.path}</code>
                </td>
                <td className="cell-access">
                  <select
                    value={module.access_type}
                    onChange={e => updateModule(module.id, 'access_type', e.target.value)}
                    className="select-access"
                    style={{ borderColor: ACCESS_TYPE_COLORS[module.access_type] }}
                  >
                    <option value="all">Todos</option>
                    <option value="leader_up">Líder+</option>
                    <option value="privileged">Privilegiados</option>
                    <option value="dev_only">Apenas Dev</option>
                  </select>
                </td>
                <td className="cell-visible">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={module.visible}
                      onChange={e => updateModule(module.id, 'visible', e.target.checked)}
                      disabled={savingId === module.id}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  {savingId === module.id && (
                    <span className="saving-indicator">
                      <Icons.Loader />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="modules-legend">
        <h4>Tipos de Acesso:</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: ACCESS_TYPE_COLORS.all }} />
            <span><strong>Todos</strong> - Visível para todos os usuários (incluindo Operação)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: ACCESS_TYPE_COLORS.leader_up }} />
            <span><strong>Líder+</strong> - Visível para Líder, Admin, Diretor e Dev</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: ACCESS_TYPE_COLORS.privileged }} />
            <span><strong>Privilegiados</strong> - Visível para Dev, Admin e Diretor</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: ACCESS_TYPE_COLORS.dev_only }} />
            <span><strong>Apenas Dev</strong> - Visível apenas para desenvolvedores</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeModulesView;

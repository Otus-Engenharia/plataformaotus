/**
 * Componente: Vista de Clientes
 *
 * Tabela de clientes (empresas) com busca e ordenacao por colunas.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ClientesView.css';

const COLUMNS = [
  { key: 'client_code', label: 'Codigo' },
  { key: 'name', label: 'Nome' },
  { key: 'status', label: 'Status' },
  { key: 'maturidade_cliente', label: 'Maturidade' },
  { key: 'nivel_cliente', label: 'Nivel' },
  { key: 'company_address', label: 'Endereco', sortable: true, center: false },
  { key: 'project_count', label: 'Qtd Projetos', center: true },
  { key: 'active_count', label: 'Ativos', center: true },
  { key: 'company_type', label: 'Tipo' },
];

function getStatusBadgeClass(status) {
  if (!status) return 'clientes-badge-default';
  const s = status.toLowerCase().trim();
  if (s === 'ativo' || s === 'active') return 'clientes-badge-ativo';
  if (s === 'inativo' || s === 'inactive') return 'clientes-badge-inativo';
  if (s === 'prospect') return 'clientes-badge-prospect';
  return 'clientes-badge-default';
}

function ClientesView() {
  const { hasFullAccess } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'client_code', direction: 'asc' });

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/api/clientes`, { withCredentials: true });
        if (response.data.success) {
          setClientes(response.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar clientes');
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return clientes;
    const term = searchTerm.toLowerCase().trim();
    return clientes.filter(c =>
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.client_code && String(c.client_code).toLowerCase().includes(term))
    );
  }, [clientes, searchTerm]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, direction } = sortConfig;
    arr.sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortConfig]);

  const renderSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return (
      <span className="clientes-sort-indicator">
        {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
      </span>
    );
  };

  const renderCellValue = (col, cliente) => {
    const val = cliente[col.key];

    if (col.key === 'name') {
      return <span className="clientes-name-cell">{val || '-'}</span>;
    }

    if (col.key === 'client_code') {
      return <span className="clientes-code-cell">{val || '-'}</span>;
    }

    if (col.key === 'status') {
      if (!val) return '-';
      return <span className={`clientes-badge ${getStatusBadgeClass(val)}`}>{val}</span>;
    }

    if (col.key === 'maturidade_cliente') {
      if (!val) return '-';
      return <span className="clientes-badge-maturidade">{val}</span>;
    }

    if (col.key === 'nivel_cliente') {
      if (!val) return '-';
      return <span className="clientes-badge-nivel">{val}</span>;
    }

    if (col.key === 'company_address') {
      return <span className="clientes-address-cell" title={val || ''}>{val || '-'}</span>;
    }

    if (col.key === 'project_count') {
      return <span className="clientes-count-pill">{val ?? 0}</span>;
    }

    if (col.key === 'active_count') {
      const n = val ?? 0;
      return <span className={`clientes-count-pill ${n > 0 ? 'clientes-count-pill-active' : ''}`}>{n}</span>;
    }

    return val || '-';
  };

  return (
    <div className="clientes-container">
      {/* Header */}
      <div className="clientes-header">
        <div className="clientes-header-left">
          <h2 className="clientes-title">Clientes</h2>
          <span className="clientes-subtitle">
            Cadastro de empresas clientes e seus dados
          </span>
        </div>
        <div className="clientes-search-wrapper">
          <svg className="clientes-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="clientes-search"
            placeholder="Buscar por nome ou codigo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="clientes-table-section">
        {loading && (
          <div className="clientes-loading">
            <div className="clientes-loading-spinner"></div>
            <span>Carregando clientes...</span>
          </div>
        )}

        {error && (
          <div className="clientes-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="clientes-table-header">
              <span className="clientes-count">
                {sorted.length} {sorted.length === 1 ? 'cliente' : 'clientes'}
                {searchTerm && ` (filtrado de ${clientes.length})`}
              </span>
            </div>

            <div className="clientes-table-wrapper">
              <table className="clientes-table">
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className={`clientes-th-sortable ${col.center ? 'clientes-th-center' : ''}`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        {renderSortIndicator(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="clientes-empty-row">
                        <div className="clientes-empty-content">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span>Nenhum cliente encontrado</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((cliente, idx) => (
                      <tr key={cliente.client_code || idx}>
                        {COLUMNS.map(col => (
                          <td key={col.key} className={col.center ? 'clientes-td-center' : ''}>
                            {renderCellValue(col, cliente)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ClientesView;

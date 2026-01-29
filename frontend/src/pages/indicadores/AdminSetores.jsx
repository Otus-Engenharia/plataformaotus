import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminPages.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AdminSetores() {
  const { isPrivileged } = useAuth();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSector, setEditingSector] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    can_access_projetos: false,
    can_access_configuracoes: false
  });

  useEffect(() => {
    fetchSectors();
  }, []);

  const fetchSectors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/ind/sectors`, { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao carregar setores');
      const data = await res.json();
      setSectors(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingSector
        ? `${API_URL}/api/ind/sectors/${editingSector.id}`
        : `${API_URL}/api/ind/sectors`;

      const res = await fetch(url, {
        method: editingSector ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Erro ao salvar setor');

      setShowForm(false);
      setEditingSector(null);
      setFormData({ name: '', description: '', can_access_projetos: false, can_access_configuracoes: false });
      fetchSectors();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (sector) => {
    setEditingSector(sector);
    setFormData({
      name: sector.name || '',
      description: sector.description || '',
      can_access_projetos: sector.can_access_projetos || false,
      can_access_configuracoes: sector.can_access_configuracoes || false
    });
    setShowForm(true);
  };

  const handleDelete = async (sector) => {
    if (!confirm(`Deseja realmente excluir o setor "${sector.name}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/ind/sectors/${sector.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Erro ao excluir setor');
      fetchSectors();
    } catch (err) {
      alert(err.message);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSector(null);
    setFormData({ name: '', description: '', can_access_projetos: false, can_access_configuracoes: false });
  };

  if (!isPrivileged) {
    return <div className="admin-page"><p>Acesso não autorizado</p></div>;
  }

  if (loading) {
    return (
      <div className="admin-page loading-state">
        <div className="loading-spinner"></div>
        <p>Carregando setores...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Setores</h1>
          <p className="admin-subtitle">Gerencie os setores da empresa</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Novo Setor
        </button>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="admin-table-container glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Acesso Projetos</th>
              <th>Acesso Config</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sectors.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-row">Nenhum setor cadastrado</td>
              </tr>
            ) : (
              sectors.map(sector => (
                <tr key={sector.id}>
                  <td className="cell-name">{sector.name}</td>
                  <td className="cell-description">{sector.description || '-'}</td>
                  <td>
                    <span className={`badge ${sector.can_access_projetos ? 'badge-success' : 'badge-muted'}`}>
                      {sector.can_access_projetos ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${sector.can_access_configuracoes ? 'badge-success' : 'badge-muted'}`}>
                      {sector.can_access_configuracoes ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button className="btn-icon" onClick={() => handleEdit(sector)} title="Editar">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleDelete(sector)} title="Excluir">
                      <svg viewBox="0 0 24 24" width="18" height="18">
                        <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de formulário */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSector ? 'Editar Setor' : 'Novo Setor'}</h2>
              <button className="modal-close" onClick={closeForm}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="sector-name">Nome *</label>
                <input
                  id="sector-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="sector-description">Descrição</label>
                <textarea
                  id="sector-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group form-group-inline">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.can_access_projetos}
                    onChange={(e) => setFormData({ ...formData, can_access_projetos: e.target.checked })}
                  />
                  <span>Pode acessar área de Projetos</span>
                </label>
              </div>

              <div className="form-group form-group-inline">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.can_access_configuracoes}
                    onChange={(e) => setFormData({ ...formData, can_access_configuracoes: e.target.checked })}
                  />
                  <span>Pode acessar Configurações</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingSector ? 'Salvar' : 'Criar Setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

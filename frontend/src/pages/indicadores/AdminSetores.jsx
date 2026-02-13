import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminSetores.css';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AdminSetores() {
  const { isPrivileged } = useAuth();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSector, setEditingSector] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

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

      closeForm();
      fetchSectors();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (sector) => {
    setEditingSector(sector);
    setFormData({ name: sector.name || '', description: sector.description || '' });
    setShowForm(true);
  };

  const handleDelete = async (e, sector) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const res = await fetch(`${API_URL}/api/ind/sectors/${sector.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Erro ao excluir: ${data.error || 'Erro desconhecido'}`);
        return;
      }

      fetchSectors();
    } catch (err) {
      alert(`Erro ao excluir setor: ${err.message}`);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSector(null);
    setFormData({ name: '', description: '' });
  };

  if (!isPrivileged) {
    return (
      <div className="admin-setores admin-setores--error">
        <div className="error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z"/>
          </svg>
          <p className="error-state__message">Acesso não autorizado</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-setores admin-setores--loading">
        <div className="loading-pulse">
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
          <div className="loading-pulse__ring" />
        </div>
        <p className="loading-text">Carregando setores...</p>
      </div>
    );
  }

  return (
    <div className="admin-setores">
      <div className="admin-setores__bg">
        <div className="admin-setores__gradient" />
      </div>

      {/* Header */}
      <header className="admin-setores__header">
        <div>
          <h1 className="admin-setores__title">Setores</h1>
          <p className="admin-setores__subtitle">
            {sectors.length} {sectors.length === 1 ? 'setor cadastrado' : 'setores cadastrados'}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Novo Setor
        </button>
      </header>

      {error && (
        <div className="admin-setores__error">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error}
        </div>
      )}

      {/* Sectors List */}
      <div className="admin-setores__list">
        {sectors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
            </div>
            <h3 className="empty-state__title">Nenhum setor cadastrado</h3>
            <p className="empty-state__description">
              Crie setores para organizar os colaboradores.
            </p>
            <button className="btn btn--primary" onClick={() => setShowForm(true)}>
              Criar primeiro setor
            </button>
          </div>
        ) : (
          sectors.map((sector, index) => (
            <div
              key={sector.id}
              className="sector-item"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="sector-item__icon">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
              </div>

              <div className="sector-item__info">
                <h3 className="sector-item__name">{sector.name}</h3>
                {sector.description && (
                  <p className="sector-item__description">{sector.description}</p>
                )}
              </div>

              <div className="sector-item__actions">
                <button
                  type="button"
                  className="sector-item__btn"
                  onClick={() => handleEdit(sector)}
                  title="Editar"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className="sector-item__btn sector-item__btn--danger"
                  onClick={(e) => handleDelete(e, sector)}
                  title="Excluir"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h2 className="modal__title">
                {editingSector ? 'Editar Setor' : 'Novo Setor'}
              </h2>
              <button className="modal__close" onClick={closeForm}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal__body">
              <div className="form-group">
                <label htmlFor="sector-name">Nome do Setor</label>
                <input
                  id="sector-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Operações"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="sector-description">Descrição (opcional)</label>
                <input
                  id="sector-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição do setor"
                />
              </div>

              <div className="modal__actions">
                <button type="button" className="btn btn--outline" onClick={closeForm}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn--primary">
                  {editingSector ? 'Salvar Alterações' : 'Criar Setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/VistaClienteView.css';

const API_URL = import.meta.env.VITE_API_URL || '';

/* ---- SVG Icons (Lucide-style, 20x20) ---- */
const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" /><path d="M16 6h.01" />
    <path d="M8 10h.01" /><path d="M16 10h.01" />
    <path d="M8 14h.01" /><path d="M16 14h.01" />
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const IconExternalLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const IconUsersEmpty = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function VistaClienteSelectView() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [impersonating, setImpersonating] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/client-portal/companies`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setCompanies(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonateCompany = async (company) => {
    setImpersonating(company.companyId);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/client-portal/impersonate-company`,
        { companyId: company.companyId },
        { withCredentials: true }
      );

      if (res.data.success) {
        const { token } = res.data.data;
        localStorage.setItem('otus_client_token', token);
        localStorage.removeItem('otus_client_refresh_token');
        window.open('/portal', '_blank');
      }
    } catch (err) {
      console.error('Impersonation error:', err);
      alert('Erro ao gerar token de impersonação');
    } finally {
      setImpersonating(null);
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return companies;
    const term = searchTerm.toLowerCase();
    return companies.filter(c => c.companyName?.toLowerCase().includes(term));
  }, [companies, searchTerm]);

  if (loading) {
    return (
      <div className="vista-cliente-container vc-select-page">
        <div className="vc-select-loading">
          <div className="vc-select-spinner" />
          <span>Carregando empresas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vista-cliente-container vc-select-page">
        <div className="vc-select-empty">
          <IconUsersEmpty />
          <p style={{ color: 'var(--vc-danger)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vista-cliente-container vc-select-page">
      {/* Header */}
      <div className="vc-select-header">
        <div>
          <button className="vc-select-back" onClick={() => navigate('/home')}>
            <IconArrowLeft /> Voltar ao Home
          </button>
          <h1 className="vc-select-title">Vista do Cliente</h1>
          <p className="vc-select-subtitle">
            Selecione uma empresa para visualizar o portal como o cliente veria.
            <span className="vc-select-meta">
              {companies.length} empresa{companies.length !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        <div className="vc-select-search-wrapper">
          <span className="vc-select-search-icon"><IconSearch /></span>
          <input
            type="text"
            className="vc-select-search"
            placeholder="Buscar empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="vc-select-empty">
          <IconUsersEmpty />
          <p>Nenhum resultado para &ldquo;{searchTerm}&rdquo;</p>
          <button className="vc-select-clear-btn" onClick={() => setSearchTerm('')}>
            Limpar busca
          </button>
        </div>
      ) : (
        <div className="vc-select-grid">
          {filteredCompanies.map((company, idx) => (
            <div
              key={company.companyId}
              className="vc-select-company"
              style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}
            >
              <div className="vc-select-company-header">
                <span className="vc-select-company-icon"><IconBuilding /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="vc-select-company-name">{company.companyName}</span>
                  <span className="vc-select-contact-count">
                    {company.projectCount} projeto{company.projectCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  className={`vc-select-btn ${impersonating === company.companyId ? 'loading' : ''}`}
                  onClick={() => handleImpersonateCompany(company)}
                  disabled={impersonating === company.companyId}
                >
                  {impersonating === company.companyId ? (
                    <>
                      <span className="vc-select-btn-spinner" />
                      Abrindo...
                    </>
                  ) : (
                    <>
                      <IconExternalLink />
                      Visualizar Portal
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

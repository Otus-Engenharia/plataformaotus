import React from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useClientAuth } from '../contexts/ClientAuthContext';
import '../styles/ClientPortal.css';

function ClientLayout() {
  const { clientUser, clientLogout } = useClientAuth();
  const { projectCode } = useParams();
  const navigate = useNavigate();

  const handleLogout = () => {
    clientLogout();
    navigate('/login');
  };

  return (
    <div className="client-portal">
      <header className="client-portal-header">
        <div className="client-portal-header-left">
          <img src="/Otus-logo-300x300.png" alt="Otus" className="client-portal-logo" />
          <span className="client-portal-brand">Otus Engenharia</span>
        </div>
        {projectCode && (
          <div className="client-portal-header-center">
            <button className="client-portal-back-btn" onClick={() => navigate('/portal')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Projetos
            </button>
          </div>
        )}
        <div className="client-portal-header-right">
          <span className="client-portal-user-name">{clientUser?.name || clientUser?.email}</span>
          <button className="client-portal-logout-btn" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>
      <main className="client-portal-main">
        <Outlet />
      </main>
    </div>
  );
}

export default ClientLayout;

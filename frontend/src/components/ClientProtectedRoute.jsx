import React from 'react';
import { Navigate } from 'react-router-dom';
import { useClientAuth } from '../contexts/ClientAuthContext';

function ClientProtectedRoute({ children }) {
  const { isClientAuthenticated, clientLoading } = useClientAuth();

  if (clientLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#fafaf8' }}>
        <div style={{ color: '#737373', fontSize: '1rem' }}>Carregando...</div>
      </div>
    );
  }

  if (!isClientAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ClientProtectedRoute;

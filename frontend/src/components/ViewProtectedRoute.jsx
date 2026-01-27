/**
 * Componente: Rota Protegida por Vista
 * 
 * Protege rotas verificando se o usuário tem acesso à vista específica
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useViewAccess } from '../hooks/useViewAccess';

// Mapeamento de paths para view IDs
const PATH_TO_VIEW_ID = {
  '/indicadores-lideranca': 'indicadores-lideranca',
  '/horas': 'horas',
  '/indicadores': 'indicadores',
  '/okrs': 'okrs',
  '/projetos': 'projetos',
  '/cs': 'cs',
  '/estudo-de-custos': 'estudo-de-custos',
  '/contatos': 'contatos',
  '/formulario-passagem': 'formulario-passagem',
  '/feedbacks': 'feedbacks',
};

function ViewProtectedRoute({ children, viewId }) {
  const location = useLocation();
  const { isAuthenticated, loading: authLoading, isPrivileged } = useAuth();
  
  // Se não tiver viewId, tenta inferir do path
  const actualViewId = viewId || PATH_TO_VIEW_ID[location.pathname];
  
  // Diretores e admins têm acesso a tudo
  const { hasAccess, loading: viewLoading } = useViewAccess(
    isPrivileged ? null : actualViewId
  );

  if (authLoading || viewLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Verdana, sans-serif'
      }}>
        Carregando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se não tem viewId ou é privilegiado, permite acesso
  if (!actualViewId || isPrivileged) {
    return children;
  }

  // Verifica se tem acesso à vista
  if (!hasAccess) {
    return (
      <div style={{ 
        padding: '3rem', 
        textAlign: 'center',
        fontFamily: 'Verdana, sans-serif'
      }}>
        <h2>Acesso Negado</h2>
        <p>Você não tem permissão para acessar esta funcionalidade.</p>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Entre em contato com o administrador para solicitar acesso.
        </p>
      </div>
    );
  }

  return children;
}

export default ViewProtectedRoute;

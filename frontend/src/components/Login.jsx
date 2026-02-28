/**
 * Componente: Página de Login
 * 
 * Permite que o usuário faça login usando Google OAuth
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../api';
import '../styles/Login.css';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading, devMode, devLogin } = useAuth();
  const [selectedRole, setSelectedRole] = useState('dev');
  const [devLoading, setDevLoading] = useState(false);

  // Verifica se há erro na URL (vindo do callback)
  const error = searchParams.get('error');

  // Se já estiver autenticado, redireciona para a home
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  /**
   * Redireciona para o endpoint de autenticação Google
   */
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  /**
   * Faz login em modo dev
   */
  const handleDevLogin = async () => {
    setDevLoading(true);
    const success = await devLogin(selectedRole);
    setDevLoading(false);
    if (success) {
      navigate('/home', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-content-wrapper">
          <div className="login-loading">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-content-wrapper">
        {/* Logo grande e centralizado */}
        <div className="login-logo-section">
          <img src="/Otus-logo-300x300.png" alt="Otus Engenharia" className="login-logo" />
        </div>

        {/* Slogan, título e chamada */}
        <p className="login-slogan">ELEVANDO O PADRÃO DE SE CONSTRUIR</p>
        <h1 className="login-title">Plataforma Otus</h1>
        <p className="login-subtitle">Selecione uma área para começar</p>

        {/* Mensagem de erro minimalista */}
        {error && (
          <div className="login-error">
            <p className="login-error-text">
              {error === 'auth_failed' 
                ? 'Acesso negado. Entre em contato com o administrador.'
                : error === 'not_configured'
                ? 'Autenticação não configurada.'
                : 'Erro ao fazer login. Por favor, tente novamente.'}
            </p>
          </div>
        )}

        {/* Botão principal - grande e focado */}
        <button
          onClick={handleGoogleLogin}
          className="login-button"
          type="button"
        >
          <svg className="login-google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="login-button-text">Continuar com Google</span>
        </button>

        {/* Seção Dev Mode */}
        {devMode.enabled && (
          <div className="login-dev-section">
            <div className="login-dev-badge">MODO DESENVOLVIMENTO</div>
            <p className="login-dev-description">
              Selecione um role para testar a aplicação localmente
            </p>
            <select
              className="login-dev-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              {devMode.availableUsers?.map(user => (
                <option key={user.role} value={user.role}>
                  {user.name} ({['dev', 'director', 'admin'].includes(user.role) ? 'Acesso Total' : user.role === 'leader' ? 'Acesso Liderança' : 'Acesso Operação'})
                </option>
              ))}
            </select>
            <button
              onClick={handleDevLogin}
              className="login-dev-button"
              type="button"
              disabled={devLoading}
            >
              {devLoading ? 'Entrando...' : 'Entrar como Dev'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;

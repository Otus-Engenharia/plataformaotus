import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../api';
import axios from 'axios';
import '../styles/Login.css';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, loading, devMode, devLogin } = useAuth();
  const [selectedRole, setSelectedRole] = useState('dev');
  const [devLoading, setDevLoading] = useState(false);
  const [mode, setMode] = useState('select'); // 'select' | 'team' | 'client'
  const [displayMode, setDisplayMode] = useState('select');
  const [transitionDir, setTransitionDir] = useState('forward');
  const [transitioning, setTransitioning] = useState(false);

  // Client login state
  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientError, setClientError] = useState('');
  const [clientLoading, setClientLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const error = searchParams.get('error');

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  // Check if coming from portal (client was logged out)
  useEffect(() => {
    const fromPortal = searchParams.get('from');
    if (fromPortal === 'portal') {
      setMode('client');
      setDisplayMode('client');
    }
  }, [searchParams]);

  const switchMode = useCallback((newMode, direction = 'forward') => {
    if (transitioning) return;
    setTransitionDir(direction);
    setTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setDisplayMode(newMode);
      setTransitioning(false);
    }, 250);
  }, [transitioning]);

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    const success = await devLogin(selectedRole);
    setDevLoading(false);
    if (success) {
      navigate('/home', { replace: true });
    }
  };

  const handleClientLogin = async (e) => {
    e.preventDefault();
    setClientError('');
    setClientLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/client/auth/login`, {
        email: clientEmail,
        password: clientPassword,
      });

      if (res.data.success) {
        const { token, refreshToken, user, mustChangePassword } = res.data.data;
        localStorage.setItem('otus_client_token', token);
        localStorage.setItem('otus_client_refresh_token', refreshToken);

        if (mustChangePassword) {
          navigate('/portal?changePassword=true', { replace: true });
        } else {
          navigate('/portal', { replace: true });
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao fazer login';
      setClientError(msg);
    } finally {
      setClientLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/client/auth/reset-password`, { email: forgotEmail });
      setForgotSent(true);
    } catch {
      setForgotSent(true); // Show success even on error (security)
    }
  };

  const panelClass = [
    transitioning ? 'login-panel-exit' : 'login-panel-enter',
    transitionDir === 'forward' ? 'login-dir-forward' : 'login-dir-back',
  ].join(' ');

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-orbs" aria-hidden="true">
          <div className="login-orb login-orb-1" />
          <div className="login-orb login-orb-2" />
          <div className="login-orb login-orb-3" />
          <div className="login-orb login-orb-4" />
          <div className="login-orb login-orb-5" />
          <div className="login-orb login-orb-6" />
        </div>
        <div className="login-content-wrapper">
          <div className="login-loading">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-orbs" aria-hidden="true">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="login-orb login-orb-4" />
        <div className="login-orb login-orb-5" />
        <div className="login-orb login-orb-6" />
      </div>
      <div className="login-content-wrapper">
        <div className="login-logo-section">
          <img src="/Otus-logo-300x300.png" alt="Otus Engenharia" className="login-logo" />
        </div>
        <p className="login-slogan">ELEVANDO O PADRÃO DE SE CONSTRUIR</p>
        <h1 className="login-title">Plataforma Otus</h1>

        {/* Mode: Select */}
        {displayMode === 'select' && (
          <div className={`login-mode-select ${panelClass}`} key="select">
            <p className="login-subtitle">Como deseja acessar?</p>
            <div className="login-mode-buttons">
              <button className="login-mode-btn login-stagger-1" onClick={() => switchMode('team', 'forward')}>
                <svg className="login-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 21a8 8 0 0 0-16 0" />
                  <circle cx="10" cy="8" r="5" />
                  <path d="M22 21a6 6 0 0 0-6-6" />
                  <circle cx="18" cy="8" r="3" />
                </svg>
                <span className="login-mode-label">Equipe Otus</span>
                <span className="login-mode-sublabel">Login com Google</span>
              </button>
              <button className="login-mode-btn login-stagger-2" onClick={() => switchMode('client', 'forward')}>
                <svg className="login-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1" />
                </svg>
                <span className="login-mode-label">Portal do Cliente</span>
                <span className="login-mode-sublabel">Email e senha</span>
              </button>
            </div>
          </div>
        )}

        {/* Mode: Team (Google OAuth) */}
        {displayMode === 'team' && (
          <div className={`login-team-mode ${panelClass}`} key="team">
            <p className="login-subtitle">Acesso da equipe interna</p>

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

            <button onClick={handleGoogleLogin} className="login-button login-shimmer" type="button">
              <svg className="login-google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="login-button-text">Continuar com Google</span>
            </button>

            <button className="login-back-link" onClick={() => switchMode('select', 'back')}>
              &larr; Voltar
            </button>

            {devMode.enabled && (
              <div className="login-dev-section">
                <div className="login-dev-badge">MODO DESENVOLVIMENTO</div>
                <p className="login-dev-description">Selecione um role para testar a aplicação localmente</p>
                <select className="login-dev-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  {devMode.availableUsers?.map(user => (
                    <option key={user.role} value={user.role}>
                      {user.name} ({['dev', 'director', 'admin'].includes(user.role) ? 'Acesso Total' : user.role === 'leader' ? 'Acesso Liderança' : 'Acesso Operação'})
                    </option>
                  ))}
                </select>
                <button onClick={handleDevLogin} className="login-dev-button" type="button" disabled={devLoading}>
                  {devLoading ? 'Entrando...' : 'Entrar como Dev'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mode: Client (Email/Password) */}
        {displayMode === 'client' && !showForgotPassword && (
          <div className={`login-client-mode ${panelClass}`} key="client">
            <p className="login-subtitle">Acesse com seu email e senha</p>

            {clientError && (
              <div className="login-error">
                <p className="login-error-text">{clientError}</p>
              </div>
            )}

            <form className="login-client-form" onSubmit={handleClientLogin}>
              <input
                type="email"
                className="login-client-input login-input-stagger-1"
                placeholder="Email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                className="login-client-input login-input-stagger-2"
                placeholder="Senha"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="submit"
                className="login-button login-client-submit login-shimmer login-input-stagger-3"
                disabled={clientLoading}
              >
                <span className="login-button-text">
                  {clientLoading ? 'Entrando...' : 'Entrar'}
                </span>
              </button>
            </form>

            <button
              className="login-forgot-link"
              onClick={() => { setShowForgotPassword(true); setForgotEmail(clientEmail); }}
            >
              Esqueci minha senha
            </button>

            <button className="login-back-link" onClick={() => switchMode('select', 'back')}>
              &larr; Voltar
            </button>
          </div>
        )}

        {/* Forgot Password */}
        {displayMode === 'client' && showForgotPassword && (
          <div className={`login-client-mode ${panelClass}`} key="forgot">
            <p className="login-subtitle">Recuperar senha</p>

            {forgotSent ? (
              <div className="login-forgot-success">
                <p>Se o email estiver cadastrado, você receberá um link de recuperação.</p>
                <button className="login-back-link" onClick={() => { setShowForgotPassword(false); setForgotSent(false); }}>
                  &larr; Voltar ao login
                </button>
              </div>
            ) : (
              <form className="login-client-form" onSubmit={handleForgotPassword}>
                <input
                  type="email"
                  className="login-client-input login-input-stagger-1"
                  placeholder="Seu email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <button type="submit" className="login-button login-client-submit login-shimmer">
                  <span className="login-button-text">Enviar link de recuperação</span>
                </button>
              </form>
            )}

            {!forgotSent && (
              <button className="login-back-link" onClick={() => setShowForgotPassword(false)}>
                &larr; Voltar ao login
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;

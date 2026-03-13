import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../api';
import { getSupabaseClient } from '../../lib/supabase';
import '../../styles/ClientPortal.css';

export default function ClientResetPasswordView() {
  const [status, setStatus] = useState('loading'); // loading | form | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  useEffect(() => {
    const initSession = async () => {
      try {
        // Extract tokens from URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (!token || !refreshToken || type !== 'recovery') {
          setErrorMsg('Link de recuperação inválido ou expirado.');
          setStatus('error');
          return;
        }

        const supabase = getSupabaseClient();
        if (!supabase) {
          setErrorMsg('Erro de configuração. Tente novamente mais tarde.');
          setStatus('error');
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });

        if (error) {
          setErrorMsg('Link expirado ou já utilizado. Solicite um novo.');
          setStatus('error');
          return;
        }

        setAccessToken(token);
        setStatus('form');
      } catch {
        setErrorMsg('Erro ao processar o link de recuperação.');
        setStatus('error');
      }
    };

    initSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/client/auth/update-password`, {
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setStatus('success');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Erro ao atualizar senha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="client-reset-password-page">
      <div className="client-change-password-modal">
        {status === 'loading' && (
          <>
            <h2>Verificando link...</h2>
            <p>Aguarde enquanto validamos seu link de recuperação.</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2>Link inválido</h2>
            <p>{errorMsg}</p>
            <Link to="/portal" className="client-reset-password-link">
              Voltar ao login
            </Link>
          </>
        )}

        {status === 'form' && (
          <>
            <h2>Defina sua nova senha</h2>
            <p>Digite e confirme sua nova senha para acessar o portal.</p>
            {passwordError && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>{passwordError}</p>
            )}
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}

        {status === 'success' && (
          <>
            <h2>Senha atualizada!</h2>
            <p>Sua senha foi alterada com sucesso. Faça login com a nova senha.</p>
            <Link to="/portal" className="client-reset-password-link">
              Ir para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

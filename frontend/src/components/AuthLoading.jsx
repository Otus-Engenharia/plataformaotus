/**
 * Tela de carregamento exibida enquanto verifica autenticação.
 * Não revela layout do app (sidebar, menu). Segurança: ir direto para login quando não autenticado.
 */

import React from 'react';
import '../styles/AuthLoading.css';

function AuthLoading() {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading-inner">
        <div className="auth-loading-spinner" aria-hidden="true" />
        <p className="auth-loading-text">Verificando acesso…</p>
      </div>
    </div>
  );
}

export default AuthLoading;

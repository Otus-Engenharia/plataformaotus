/**
 * Contexto de Autenticação
 * 
 * Gerencia o estado de autenticação do usuário
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const AuthContext = createContext(null);

// Configuração do axios para incluir credenciais (cookies)
axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Verifica se o usuário está autenticado
   */
  const checkAuth = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/auth/user`);
      if (response.data.success) {
        setUser(response.data.user);
        setError(null);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      if (err.response?.status !== 401) {
        // 401 é esperado quando não está autenticado
        setError('Erro ao verificar autenticação');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Faz logout do usuário
   */
  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
      setUser(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      // Mesmo com erro, limpa o estado local
      setUser(null);
      window.location.href = '/login';
    }
  };

  /**
   * Verifica se o usuário é diretora
   */
  const isDirector = () => {
    return user?.role === 'director';
  };

  /**
   * Verifica se o usuário é admin
   */
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  /**
   * Verifica se o usuário é diretora ou admin
   */
  const isPrivileged = () => {
    return user?.role === 'director' || user?.role === 'admin';
  };

  /**
   * Verifica se o usuário é líder
   */
  const isLeader = () => {
    return user?.role === 'leader';
  };

  /**
   * Verifica se o usuário pode acessar Formulário de Passagem
   * (Diretores, Admin e Vendas)
   * A informação vem do backend
   */
  const canAccessFormularioPassagem = () => {
    if (!user) return false;
    return user.canAccessFormularioPassagem === true;
  };

  // Verifica autenticação ao montar o componente
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isDirector: isDirector(),
    isAdmin: isAdmin(),
    isPrivileged: isPrivileged(),
    isLeader: isLeader(),
    canAccessFormularioPassagem: canAccessFormularioPassagem(),
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar o contexto de autenticação
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

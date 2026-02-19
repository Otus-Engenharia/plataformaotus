/**
 * Contexto de Autenticação
 * 
 * Gerencia o estado de autenticação do usuário
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const AuthContext = createContext(null);

// Configuração do axios para incluir credenciais (cookies)
axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devMode, setDevMode] = useState({ enabled: false, availableUsers: [] });
  const [effectiveViews, setEffectiveViews] = useState([]);
  const [accessibleAreas, setAccessibleAreas] = useState([]);

  /**
   * Verifica se o dev mode está habilitado
   */
  const checkDevMode = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/dev-mode`);
      setDevMode(response.data);
    } catch (err) {
      console.error('Erro ao verificar dev mode:', err);
      setDevMode({ enabled: false, availableUsers: [] });
    }
  };

  /**
   * Busca as vistas efetivas que o usuário pode acessar
   */
  const fetchEffectiveViews = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/effective-views`);
      if (response.data.success) {
        setEffectiveViews(response.data.views || []);
      }
    } catch (err) {
      console.error('Erro ao buscar vistas efetivas:', err);
      setEffectiveViews([]);
    }
  };

  /**
   * Busca as áreas acessíveis baseado nos módulos configurados em Permissões
   */
  const fetchAccessibleAreas = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/accessible-areas`);
      if (response.data.success) {
        setAccessibleAreas(response.data.areas || []);
      }
    } catch (err) {
      console.error('Erro ao buscar áreas acessíveis:', err);
      setAccessibleAreas([]);
    }
  };

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
        // Buscar vistas efetivas e áreas acessíveis após autenticação
        await Promise.all([fetchEffectiveViews(), fetchAccessibleAreas()]);
      } else {
        setUser(null);
        setEffectiveViews([]);
        setAccessibleAreas([]);
      }
    } catch (err) {
      setUser(null);
      setEffectiveViews([]);
      setAccessibleAreas([]);
      if (err.response?.status !== 401) {
        // 401 é esperado quando não está autenticado
        setError('Erro ao verificar autenticação');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Faz login em modo dev com um role específico
   */
  const devLogin = async (role) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/dev-login`, { role });
      if (response.data.success) {
        setUser(response.data.user);
        // Buscar vistas efetivas e áreas acessíveis após dev login
        await Promise.all([fetchEffectiveViews(), fetchAccessibleAreas()]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao fazer dev login:', err);
      return false;
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
   * Verifica se o usuário é desenvolvedor (acesso total)
   */
  const isDev = () => {
    return user?.role === 'dev';
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
   * Verifica se o usuário é dev, diretora, admin ou líder
   */
  const isPrivileged = () => {
    return user?.role === 'dev' || user?.role === 'director' || user?.role === 'admin' || user?.role === 'leader';
  };

  /**
   * Verifica se o usuário tem acesso total (dev, director ou admin)
   */
  const hasFullAccess = () => {
    return user?.role === 'dev' || user?.role === 'director' || user?.role === 'admin';
  };

  /**
   * Verifica se o usuário é líder
   */
  const isLeader = () => {
    return user?.role === 'leader';
  };

  /**
   * Verifica se o usuário pode acessar uma vista específica
   * Devs têm acesso total; outros verificam effectiveViews
   */
  const canAccessView = useCallback((viewId) => {
    if (user?.role === 'dev') return true;
    return effectiveViews.includes(viewId);
  }, [user, effectiveViews]);

  /**
   * Verifica se o usuário pode acessar uma área do sistema
   * Baseado nos módulos configurados em Permissões (Matriz por Setor)
   */
  const canAccessArea = useCallback((area) => {
    if (user?.role === 'dev') return true;
    return accessibleAreas.includes(area);
  }, [user, accessibleAreas]);

  /**
   * Verifica se o usuário pode acessar Formulário de Passagem
   * (Diretores, Admin e Vendas)
   * A informação vem do backend
   */
  const canAccessFormularioPassagem = () => {
    if (!user) return false;
    return user.canAccessFormularioPassagem === true;
  };

  // Verifica autenticação e dev mode ao montar o componente
  useEffect(() => {
    checkAuth();
    checkDevMode();
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isDev: isDev(),
    isDirector: isDirector(),
    isAdmin: isAdmin(),
    isPrivileged: isPrivileged(),
    hasFullAccess: hasFullAccess(),
    isLeader: isLeader(),
    canAccessFormularioPassagem: canAccessFormularioPassagem(),
    canManageDemandas: user?.canManageDemandas === true,
    canManageEstudosCustos: user?.canManageEstudosCustos === true,
    canManageApoioProjetos: user?.canManageApoioProjetos === true,
    effectiveViews,
    canAccessView,
    fetchEffectiveViews,
    accessibleAreas,
    canAccessArea,
    logout,
    checkAuth,
    devMode,
    devLogin,
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

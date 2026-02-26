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
  const [impersonation, setImpersonation] = useState(null);

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
        // Hydrate impersonation state from user response
        if (response.data.user?.impersonation?.active) {
          setImpersonation(response.data.user.impersonation);
        } else {
          setImpersonation(null);
        }
        // Buscar vistas efetivas e áreas acessíveis após autenticação
        await Promise.all([fetchEffectiveViews(), fetchAccessibleAreas()]);
      } else {
        setUser(null);
        setEffectiveViews([]);
        setAccessibleAreas([]);
        setImpersonation(null);
      }
    } catch (err) {
      setUser(null);
      setEffectiveViews([]);
      setAccessibleAreas([]);
      setImpersonation(null);
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
   * Ativa impersonação de um usuário (apenas para devs)
   */
  const startImpersonation = async (userId) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/dev-impersonate`, { userId });
      if (response.data.success) {
        // Reload para garantir que todos os dados sejam re-buscados
        window.location.reload();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Erro ao impersonar:', err);
      return false;
    }
  };

  /**
   * Desativa impersonação
   */
  const stopImpersonation = async () => {
    try {
      await axios.delete(`${API_URL}/api/auth/dev-impersonate`);
      window.location.reload();
      return true;
    } catch (err) {
      console.error('Erro ao parar impersonação:', err);
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
      setImpersonation(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
      // Mesmo com erro, limpa o estado local
      setUser(null);
      setImpersonation(null);
      window.location.href = '/login';
    }
  };

  /**
   * Retorna o role efetivo considerando impersonação ativa.
   * Se impersonando, usa o role do usuário impersonado.
   */
  const getEffectiveRole = useCallback(() => {
    if (impersonation?.active) return impersonation.target.role;
    return user?.role;
  }, [impersonation, user]);

  const isDev = () => getEffectiveRole() === 'dev';

  const isDirector = () => getEffectiveRole() === 'director';

  const isAdmin = () => getEffectiveRole() === 'admin';

  const isPrivileged = () => {
    const role = getEffectiveRole();
    return role === 'dev' || role === 'ceo' || role === 'director' || role === 'admin' || role === 'leader';
  };

  const hasFullAccess = () => {
    const role = getEffectiveRole();
    return role === 'dev' || role === 'ceo' || role === 'director' || role === 'admin';
  };

  const isLeader = () => getEffectiveRole() === 'leader';

  const isCoordinator = () => {
    const cargoName = user?.cargo_name || '';
    return cargoName.toLowerCase().includes('coordena');
  };

  /**
   * Verifica se o usuário pode acessar uma vista específica
   * Devs têm acesso total; outros verificam effectiveViews
   */
  const canAccessView = useCallback((viewId) => {
    if (user?.role === 'dev' && !impersonation?.active) return true;
    return effectiveViews.includes(viewId);
  }, [user, effectiveViews, impersonation]);

  /**
   * Verifica se o usuário pode acessar uma área do sistema
   * Baseado nos módulos configurados em Permissões (Matriz por Setor)
   */
  const canAccessArea = useCallback((area) => {
    if (user?.role === 'dev' && !impersonation?.active) return true;
    return accessibleAreas.includes(area);
  }, [user, accessibleAreas, impersonation]);

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

  // Usuário efetivo: quando impersonando, usa dados do target para queries de dados
  const effectiveUser = impersonation?.active
    ? { ...user, ...impersonation.target }
    : user;

  const value = {
    user,
    effectiveUser,
    loading,
    error,
    isAuthenticated: !!user,
    isDev: isDev(),
    isRealDev: user?.role === 'dev',
    isDirector: isDirector(),
    isAdmin: isAdmin(),
    isPrivileged: isPrivileged(),
    hasFullAccess: hasFullAccess(),
    isLeader: isLeader(),
    isCoordinator: isCoordinator(),
    canAccessFormularioPassagem: canAccessFormularioPassagem(),
    canAccessVendas: user?.canAccessVendas === true,
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
    impersonation,
    startImpersonation,
    stopImpersonation,
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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../api';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [clientUser, setClientUser] = useState(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [isClientAuthenticated, setIsClientAuthenticated] = useState(false);
  const refreshTimerRef = useRef(null);

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('otus_client_token');
    if (token) {
      verifyToken(token);
    } else {
      setClientLoading(false);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const verifyToken = async (token) => {
    try {
      const res = await axios.get(`${API_URL}/api/client/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setClientUser(res.data.data);
        setIsClientAuthenticated(true);
        scheduleRefresh();
      } else {
        clearClientSession();
      }
    } catch {
      clearClientSession();
    } finally {
      setClientLoading(false);
    }
  };

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 5 minutes before expiry (tokens typically last 1 hour)
    refreshTimerRef.current = setTimeout(async () => {
      const refreshToken = localStorage.getItem('otus_client_refresh_token');
      if (!refreshToken) return;
      try {
        const res = await axios.post(`${API_URL}/api/client/auth/refresh`, { refreshToken });
        if (res.data.success) {
          localStorage.setItem('otus_client_token', res.data.data.token);
          localStorage.setItem('otus_client_refresh_token', res.data.data.refreshToken);
          scheduleRefresh();
        }
      } catch {
        clearClientSession();
      }
    }, 50 * 60 * 1000); // 50 minutes
  }, []);

  const clientLogin = async (email, password) => {
    const res = await axios.post(`${API_URL}/api/client/auth/login`, { email, password });
    if (res.data.success) {
      const { token, refreshToken, user, mustChangePassword } = res.data.data;
      localStorage.setItem('otus_client_token', token);
      localStorage.setItem('otus_client_refresh_token', refreshToken);
      setClientUser(user);
      setIsClientAuthenticated(true);
      scheduleRefresh();
      return { success: true, mustChangePassword };
    }
    return { success: false };
  };

  const clientLogout = () => {
    clearClientSession();
  };

  const clearClientSession = () => {
    localStorage.removeItem('otus_client_token');
    localStorage.removeItem('otus_client_refresh_token');
    setClientUser(null);
    setIsClientAuthenticated(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  };

  const getClientToken = () => localStorage.getItem('otus_client_token');

  const value = {
    clientUser,
    clientLoading,
    isClientAuthenticated,
    clientLogin,
    clientLogout,
    getClientToken,
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth must be used within a ClientAuthProvider');
  }
  return context;
}

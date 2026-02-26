/**
 * Context do Oráculo - Gerencia estado do chat, sessões e mensagens
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../api';
import { useAuth } from './AuthContext';

const OracleContext = createContext();

export function OracleProvider({ children }) {
  const { effectiveUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  const toggleOracle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  /**
   * Carrega sessões do usuário
   */
  const fetchSessions = useCallback(async () => {
    if (!effectiveUser?.id) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/oracle/sessions`, {
        params: { userId: effectiveUser.id },
      });
      setSessions(res.data.data || []);
      setSessionsLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  }, [effectiveUser?.id]);

  /**
   * Cria nova sessão e a define como ativa
   */
  const createSession = useCallback(async () => {
    try {
      const res = await axios.post(`${API_URL}/api/oracle/sessions`, {
        userId: effectiveUser?.id,
      });
      const newSession = res.data.data;
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      return newSession;
    } catch (error) {
      console.error('Erro ao criar sessão:', error);
      throw error;
    }
  }, [effectiveUser?.id]);

  /**
   * Seleciona uma sessão e carrega suas mensagens
   */
  const selectSession = useCallback(async (sessionId) => {
    try {
      setActiveSessionId(sessionId);
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/oracle/sessions/${sessionId}/messages`, {
        params: { userId: effectiveUser?.id },
      });
      setMessages(res.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveUser?.id]);

  /**
   * Exclui uma sessão
   */
  const deleteSession = useCallback(async (sessionId) => {
    try {
      await axios.delete(`${API_URL}/api/oracle/sessions/${sessionId}`, {
        params: { userId: effectiveUser?.id },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Erro ao excluir sessão:', error);
      throw error;
    }
  }, [activeSessionId, effectiveUser?.id]);

  /**
   * Envia mensagem para o Oráculo (via backend → N8N)
   */
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || sending) return;

    let sessionId = activeSessionId;

    // Se não tem sessão ativa, cria uma nova
    if (!sessionId) {
      const newSession = await createSession();
      sessionId = newSession.id;
    }

    // Adiciona mensagem do usuário imediatamente na UI
    const userMessage = {
      id: `temp-${Date.now()}`,
      type: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      setSending(true);
      const res = await axios.post(`${API_URL}/api/oracle/message`, {
        session_id: sessionId,
        text,
        userId: effectiveUser?.id,
      });

      // Adiciona resposta do bot
      const botMessage = {
        id: `temp-${Date.now() + 1}`,
        type: 'bot',
        text: res.data.data.output,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);

      // Atualiza a sessão na lista (o n8n pode ter atualizado o chat_name)
      fetchSessions();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = {
        id: `error-${Date.now()}`,
        type: 'bot',
        text: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  }, [activeSessionId, sending, createSession, fetchSessions, effectiveUser?.id]);

  /**
   * Volta para a lista de sessões
   */
  const goToSessionList = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
  }, []);

  return (
    <OracleContext.Provider value={{
      isOpen,
      toggleOracle,
      sessions,
      activeSessionId,
      messages,
      loading,
      sending,
      sessionsLoaded,
      fetchSessions,
      createSession,
      selectSession,
      deleteSession,
      sendMessage,
      goToSessionList,
    }}>
      {children}
    </OracleContext.Provider>
  );
}

export function useOracle() {
  const context = useContext(OracleContext);
  if (!context) {
    throw new Error('useOracle must be used within OracleProvider');
  }
  return context;
}

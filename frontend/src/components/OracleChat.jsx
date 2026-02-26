/**
 * Componente: Oráculo - Assistente IA
 *
 * Painel lateral com lista de sessões de chat e conversa ativa.
 * Integra com N8N via backend para processamento de mensagens.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useOracle } from '../contexts/OracleContext';
import '../styles/OracleChat.css';

function OracleChat() {
  const {
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
  } = useOracle();

  const [inputValue, setInputValue] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Carrega sessões ao abrir o painel pela primeira vez
  useEffect(() => {
    if (isOpen && !sessionsLoaded) {
      fetchSessions();
    }
  }, [isOpen, sessionsLoaded, fetchSessions]);

  // Scroll automático ao receber nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;
    const text = inputValue;
    setInputValue('');
    await sendMessage(text);
  };

  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (deletingSessionId) return;
    setDeletingSessionId(sessionId);
    try {
      await deleteSession(sessionId);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Tela de conversa ativa
  const renderChat = () => (
    <>
      <div className="oracle-chat-header">
        <button
          className="oracle-chat-back-button"
          onClick={goToSessionList}
          title="Voltar para conversas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="oracle-chat-header-text">
          <h3>{sessions.find(s => s.id === activeSessionId)?.chat_name || 'Nova conversa'}</h3>
        </div>
        <button
          className="oracle-chat-close-button"
          onClick={toggleOracle}
          title="Fechar Oráculo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="oracle-chat-messages">
        {messages.length === 0 && !loading ? (
          <div className="oracle-chat-empty">
            <div className="oracle-chat-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p>Envie uma mensagem para iniciar a conversa com o Oráculo.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`oracle-message oracle-message-${message.type}`}
            >
              <div className="oracle-message-content">
                <p>{message.text}</p>
                <span className="oracle-message-time">
                  {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="oracle-message oracle-message-bot">
            <div className="oracle-message-content oracle-typing">
              <span className="oracle-typing-dot"></span>
              <span className="oracle-typing-dot"></span>
              <span className="oracle-typing-dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="oracle-chat-input-form" onSubmit={handleSendMessage}>
        <div className="oracle-chat-input-wrapper">
          <input
            type="text"
            className="oracle-chat-input"
            placeholder="Digite sua mensagem..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="oracle-chat-send-button"
            disabled={!inputValue.trim() || sending}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </form>
    </>
  );

  // Tela de lista de sessões
  const renderSessionList = () => (
    <>
      <div className="oracle-chat-header">
        <div className="oracle-chat-header-content">
          <div className="oracle-chat-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="oracle-chat-header-text">
            <h3>Oráculo</h3>
            <p>Assistente IA</p>
          </div>
        </div>
        <button
          className="oracle-chat-close-button"
          onClick={toggleOracle}
          title="Fechar Oráculo"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="oracle-sessions-container">
        <button
          className="oracle-new-chat-button"
          onClick={createSession}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Nova conversa
        </button>

        {loading && !sessionsLoaded ? (
          <div className="oracle-sessions-loading">Carregando conversas...</div>
        ) : sessions.length === 0 ? (
          <div className="oracle-sessions-empty">
            <p>Nenhuma conversa ainda.</p>
            <p>Clique em "Nova conversa" para começar.</p>
          </div>
        ) : (
          <div className="oracle-sessions-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className="oracle-session-item"
                onClick={() => selectSession(session.id)}
              >
                <div className="oracle-session-info">
                  <span className="oracle-session-name">
                    {session.chat_name || 'Nova conversa'}
                  </span>
                  <span className="oracle-session-date">
                    {formatDate(session.created_at)}
                  </span>
                </div>
                <button
                  className="oracle-session-delete"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  disabled={deletingSessionId === session.id}
                  title="Excluir conversa"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Botão flutuante para abrir */}
      <button
        className={`oracle-toggle-button ${isOpen ? 'oracle-toggle-button-open' : ''}`}
        onClick={toggleOracle}
        aria-label={isOpen ? 'Fechar Oráculo' : 'Abrir Oráculo'}
        title={isOpen ? 'Fechar Oráculo' : 'Abrir Oráculo'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="8" strokeWidth="1.5" fill="none" opacity="0.3" />
          <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="none" opacity="0.5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <path d="M12 4L12 8M12 16L12 20M4 12L8 12M16 12L20 12" strokeWidth="1.5" opacity="0.4" />
        </svg>
      </button>

      {/* Painel do chat */}
      <div className={`oracle-chat-panel ${isOpen ? 'oracle-chat-panel-open' : ''}`}>
        {activeSessionId ? renderChat() : renderSessionList()}
      </div>
    </>
  );
}

export default OracleChat;

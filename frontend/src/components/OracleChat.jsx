/**
 * Componente: Oraculo - Assistente LMM
 * 
 * Chatbot/assistente que pode ser expandido e colapsado
 * para liberar espaço na tela
 */

import React, { useState } from 'react';
import { useOracle } from '../contexts/OracleContext';
import '../styles/OracleChat.css';

function OracleChat() {
  const { isOpen, toggleOracle } = useOracle();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const toggleChat = () => {
    toggleOracle();
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Adiciona mensagem do usuário
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // TODO: Implementar chamada à API do LMM quando disponível
    // Por enquanto, apenas simula uma resposta
    setTimeout(() => {
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: 'Esta funcionalidade será implementada em breve. O Oraculo estará disponível para ajudar com análises e perguntas sobre os dados do projeto.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 500);
  };

  return (
    <>
      {/* Botão flutuante para abrir/fechar */}
      <button
        className={`oracle-toggle-button ${isOpen ? 'oracle-toggle-button-open' : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? 'Fechar Oraculo' : 'Abrir Oraculo'}
        title={isOpen ? 'Fechar Oraculo' : 'Abrir Oraculo'}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {/* Ícone de seta para direita - minimizar/ocultar */}
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {/* Ícone de oráculo - olho místico/esfera */}
            <circle cx="12" cy="12" r="8" strokeWidth="1.5" fill="none" opacity="0.3" />
            <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="none" opacity="0.5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <path d="M12 4L12 8M12 16L12 20M4 12L8 12M16 12L20 12" strokeWidth="1.5" opacity="0.4" />
          </svg>
        )}
      </button>

      {/* Painel do chat */}
      <div className={`oracle-chat-panel ${isOpen ? 'oracle-chat-panel-open' : ''}`}>
        <div className="oracle-chat-header">
          <div className="oracle-chat-header-content">
            <div className="oracle-chat-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="oracle-chat-header-text">
              <h3>Oraculo</h3>
              <p>Assistente LMM</p>
            </div>
          </div>
          <button
            className="oracle-chat-close-button"
            onClick={toggleChat}
            aria-label="Fechar Oraculo"
            title="Fechar Oraculo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="oracle-chat-messages">
          {messages.length === 0 ? (
            <div className="oracle-chat-empty">
              <div className="oracle-chat-empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="oracle-chat-warning">
                <p className="oracle-chat-warning-title">⚠️ Oraculo em Desenvolvimento</p>
                <p>O Oraculo ainda não está pronto para uso.</p>
                <p>Esta funcionalidade será implementada em breve.</p>
              </div>
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
                    {message.timestamp.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <form className="oracle-chat-input-form" onSubmit={handleSendMessage}>
          <div className="oracle-chat-input-wrapper">
            <input
              type="text"
              className="oracle-chat-input"
              placeholder="Digite sua mensagem..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={!isOpen}
            />
            <button
              type="submit"
              className="oracle-chat-send-button"
              disabled={!inputValue.trim() || !isOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default OracleChat;

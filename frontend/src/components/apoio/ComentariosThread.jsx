import React, { useState, useRef, useEffect } from 'react';
import './ComentariosThread.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name, email) {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return '??';
}

const STATUS_LABELS = {
  pendente: 'Pendente',
  em_analise: 'Em Analise',
  em_progresso: 'Em Progresso',
  aguardando_info: 'Aguardando Info',
  finalizado: 'Finalizado',
  recusado: 'Recusado',
};

export default function ComentariosThread({ comentarios = [], onAddComentario, currentUserEmail }) {
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comentarios.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!texto.trim() || sending) return;

    setSending(true);
    try {
      await onAddComentario(texto.trim());
      setTexto('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="cthread">
      <h3 className="cthread__title">
        Comentarios
        <span className="cthread__count">
          {comentarios.filter(c => c.tipo === 'comentario').length}
        </span>
      </h3>

      <div className="cthread__list">
        {comentarios.length === 0 ? (
          <div className="cthread__empty">Nenhum comentario ainda</div>
        ) : (
          comentarios.map(comment => {
            const isSystem = comment.tipo !== 'comentario';
            const isOwn = comment.author_email === currentUserEmail;

            if (isSystem) {
              return (
                <div key={comment.id} className="cthread__system">
                  <div className="cthread__system-icon">
                    {comment.tipo === 'status_change' ? '🔄' : '👤'}
                  </div>
                  <div className="cthread__system-content">
                    <span className="cthread__system-author">
                      {comment.author_name || 'Sistema'}
                    </span>
                    <span className="cthread__system-text">
                      {comment.tipo === 'status_change' && comment.metadata ? (
                        <>
                          alterou status de{' '}
                          <strong>{STATUS_LABELS[comment.metadata.from] || comment.metadata.from}</strong>
                          {' '}para{' '}
                          <strong>{STATUS_LABELS[comment.metadata.to] || comment.metadata.to}</strong>
                        </>
                      ) : (
                        comment.texto
                      )}
                    </span>
                    <span className="cthread__system-date">{formatDate(comment.created_at)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={comment.id} className={`cthread__comment ${isOwn ? 'cthread__comment--own' : ''}`}>
                <div className="cthread__avatar">
                  {getInitials(comment.author_name, comment.author_email)}
                </div>
                <div className="cthread__bubble">
                  <div className="cthread__bubble-header">
                    <span className="cthread__author-name">
                      {comment.author_name || comment.author_email?.split('@')[0] || 'Desconhecido'}
                    </span>
                    <span className="cthread__comment-date">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="cthread__comment-text">{comment.texto}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Input area */}
      <form className="cthread__input-area" onSubmit={handleSubmit}>
        <textarea
          className="cthread__input"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentario..."
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          className="cthread__send-btn"
          disabled={!texto.trim() || sending}
        >
          {sending ? (
            <span className="cthread__sending">...</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

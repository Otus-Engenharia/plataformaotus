import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MentionInput.css';

/**
 * Textarea com autocomplete para menções @FB-XXX
 * @param {Object} props
 * @param {string} props.value - Valor atual do textarea
 * @param {Function} props.onChange - Callback quando o valor muda
 * @param {Array} props.feedbacks - Lista de feedbacks disponíveis para mencionar
 * @param {string} props.placeholder - Placeholder do textarea
 * @param {number} props.rows - Número de linhas do textarea
 * @param {boolean} props.required - Se o campo é obrigatório
 * @param {string} props.id - ID do textarea
 */
export default function MentionInput({
  value,
  onChange,
  feedbacks = [],
  placeholder = '',
  rows = 5,
  required = false,
  id
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(null);
  const textareaRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Filtra feedbacks baseado na query
  const filterFeedbacks = useCallback((query) => {
    if (!query) {
      return feedbacks.slice(0, 8); // Mostra os 8 primeiros se não há query
    }

    const q = query.toLowerCase();
    return feedbacks
      .filter(f => {
        const code = (f.code || '').toLowerCase();
        const titulo = (f.titulo || '').toLowerCase();
        const text = (f.feedback_text || '').toLowerCase().substring(0, 50);
        return code.includes(q) || titulo.includes(q) || text.includes(q);
      })
      .slice(0, 8);
  }, [feedbacks]);

  // Detecta quando o usuário digita @
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    // Procura por @ antes do cursor
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // Se não tem espaço depois do @, está digitando uma menção
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStartPos(lastAtIndex);
        setMentionQuery(textAfterAt);
        setSuggestions(filterFeedbacks(textAfterAt));
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStartPos(null);
    setMentionQuery('');
  };

  // Insere a menção selecionada
  const insertMention = (feedback) => {
    if (mentionStartPos === null) return;

    const beforeMention = value.substring(0, mentionStartPos);
    const afterMention = value.substring(mentionStartPos + 1 + mentionQuery.length);
    const mention = `@${feedback.code} `;

    const newValue = beforeMention + mention + afterMention;
    onChange(newValue);

    // Move o cursor para depois da menção
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartPos + mention.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);

    setShowSuggestions(false);
    setMentionStartPos(null);
    setMentionQuery('');
  };

  // Navegação por teclado
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (showSuggestions) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (showSuggestions) {
          e.preventDefault();
          insertMention(suggestions[selectedIndex]);
        }
        break;
      default:
        break;
    }
  };

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll para manter item selecionado visível
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const selectedEl = suggestionsRef.current.children[selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showSuggestions]);

  // Trunca texto para preview
  const truncate = (text, max = 40) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '...' : text;
  };

  return (
    <div className="mention-input">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        required={required}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="mention-input__suggestions" ref={suggestionsRef}>
          <div className="mention-input__header">
            Mencionar feedback
          </div>
          {suggestions.map((feedback, index) => (
            <button
              key={feedback.id}
              type="button"
              className={`mention-input__item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => insertMention(feedback)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="mention-input__code">{feedback.code}</span>
              <span className="mention-input__preview">
                {truncate(feedback.titulo || feedback.feedback_text)}
              </span>
            </button>
          ))}
          <div className="mention-input__hint">
            <kbd>↑↓</kbd> navegar <kbd>Enter</kbd> selecionar <kbd>Esc</kbd> fechar
          </div>
        </div>
      )}
    </div>
  );
}

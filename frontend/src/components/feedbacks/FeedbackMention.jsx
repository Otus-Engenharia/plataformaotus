import React from 'react';

/**
 * Regex para detectar menções de feedbacks no formato @FB-XXX ou @fb-XXX
 */
const MENTION_REGEX = /@(FB-\d+)/gi;

/**
 * Renderiza texto com menções @FB-XXX como links clicáveis
 * @param {string} text - Texto a ser processado
 * @param {Function} onMentionClick - Callback quando uma menção é clicada (recebe o código do feedback)
 * @returns {React.ReactNode[]} - Array de elementos React
 */
export function renderTextWithMentions(text, onMentionClick) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    // Adiciona texto antes da menção
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Adiciona a menção como link
    const code = match[1].toUpperCase();
    parts.push(
      <button
        key={`mention-${match.index}`}
        type="button"
        className="feedback-mention"
        onClick={(e) => {
          e.stopPropagation();
          if (onMentionClick) onMentionClick(code);
        }}
        title={`Ver feedback ${code}`}
      >
        @{code}
      </button>
    );

    lastIndex = match.index + match[0].length;
  }

  // Adiciona texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Componente para renderizar texto com menções
 */
export default function FeedbackText({ text, onMentionClick, className = '' }) {
  return (
    <span className={className}>
      {renderTextWithMentions(text, onMentionClick)}
    </span>
  );
}

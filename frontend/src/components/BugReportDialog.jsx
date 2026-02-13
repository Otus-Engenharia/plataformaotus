import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './BugReportDialog.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const BUG_TYPES = [
  { value: 'bug', label: 'Bug', icon: '🐛', description: 'Funciona, mas faz algo errado' },
  { value: 'erro', label: 'Erro', icon: '❌', description: 'Não funciona ou trava' },
  { value: 'sugestao', label: 'Sugestão', icon: '💡', description: 'Ideia para melhorar' },
  { value: 'outro', label: 'Outro', icon: '📝', description: 'Dúvida ou outro assunto' }
];

const SUGGESTION_CATEGORIES = [
  { value: 'processo', label: 'Processo', icon: '⚙️' },
  { value: 'plataforma', label: 'Plataforma', icon: '💻' }
];

/**
 * Dialog para criar um novo relatório de bug
 */
export default function BugReportDialog({ onClose }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('bug');
  const [suggestionCategory, setSuggestionCategory] = useState('plataforma');
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const MAX_IMAGES = 3;
  const MAX_SIZE_MB = 2;

  const handleScreenshotChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - screenshots.length;
    if (remaining <= 0) {
      alert(`Máximo de ${MAX_IMAGES} imagens permitidas`);
      return;
    }

    const filesToAdd = files.slice(0, remaining);
    const oversized = filesToAdd.find(f => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      alert(`Cada imagem deve ter no máximo ${MAX_SIZE_MB}MB`);
      return;
    }

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshots(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, reader.result];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Informe um título para o relatório');
      return;
    }

    if (!description.trim()) {
      alert('Informe uma descrição do problema');
      return;
    }

    setLoading(true);
    try {
      // Encode screenshots as JSON array (or null if none)
      let screenshotPayload = null;
      if (screenshots.length > 0) {
        screenshotPayload = screenshots.length === 1
          ? screenshots[0]
          : JSON.stringify(screenshots);
      }

      // Determina o tipo correto para o backend
      // Sugestões: feedback_processo ou feedback_plataforma
      // Outros: bug, erro, outro
      const feedbackType = type === 'sugestao'
        ? `feedback_${suggestionCategory}`
        : type;

      const response = await fetch(`${API_URL}/api/feedbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          type: feedbackType,
          titulo: title.trim(),
          feedback_text: description.trim(),
          screenshot_url: screenshotPayload,
          page_url: window.location.href
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar relatório');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bug-dialog-overlay">
        <div className="bug-dialog bug-dialog--success">
          <div className="bug-dialog__success-content">
            <div className="bug-dialog__success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3>Obrigado pelo feedback!</h3>
            <p>Seu relatório foi enviado com sucesso.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bug-dialog-overlay">
      <div className="bug-dialog">
        <div className="bug-dialog__header">
          <div className="bug-dialog__title-row">
            <svg className="bug-dialog__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
              <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z" />
              <path d="M12 20v2M3 13h3M18 13h3M6.53 17.47l-2.12 2.12M17.47 17.47l2.12 2.12" />
            </svg>
            <h2>Reportar Bug</h2>
          </div>
          <button className="bug-dialog__close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bug-dialog__form">
          {/* Type Selection */}
          <div className="bug-dialog__field">
            <label className="bug-dialog__label">Tipo</label>
            <div className="bug-dialog__type-grid">
              {BUG_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`bug-dialog__type-btn ${type === t.value ? 'bug-dialog__type-btn--active' : ''}`}
                  onClick={() => setType(t.value)}
                  title={t.description}
                >
                  <span className="bug-dialog__type-icon">{t.icon}</span>
                  <span className="bug-dialog__type-label">{t.label}</span>
                  <span className="bug-dialog__type-desc">{t.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggestion Category - only shown when type is 'sugestao' */}
          {type === 'sugestao' && (
            <div className="bug-dialog__field">
              <label className="bug-dialog__label">Categoria da Sugestão</label>
              <div className="bug-dialog__category-grid">
                {SUGGESTION_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`bug-dialog__category-btn ${suggestionCategory === cat.value ? 'bug-dialog__category-btn--active' : ''}`}
                    onClick={() => setSuggestionCategory(cat.value)}
                  >
                    <span className="bug-dialog__category-icon">{cat.icon}</span>
                    <span className="bug-dialog__category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="bug-dialog__field">
            <label className="bug-dialog__label" htmlFor="bug-title">
              Título <span className="bug-dialog__required">*</span>
            </label>
            <input
              id="bug-title"
              type="text"
              className="bug-dialog__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo breve do problema"
              maxLength={200}
              required
            />
          </div>

          {/* Description */}
          <div className="bug-dialog__field">
            <label className="bug-dialog__label" htmlFor="bug-description">
              Descrição <span className="bug-dialog__required">*</span>
            </label>
            <textarea
              id="bug-description"
              className="bug-dialog__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o problema em detalhes. O que aconteceu? O que deveria ter acontecido?"
              rows={4}
              required
            />
          </div>

          {/* Screenshots */}
          <div className="bug-dialog__field">
            <label className="bug-dialog__label">
              Imagens <span className="bug-dialog__optional">(opcional, até {MAX_IMAGES})</span>
            </label>
            {screenshots.length > 0 && (
              <div className="bug-dialog__screenshots-grid">
                {screenshots.map((preview, index) => (
                  <div key={index} className="bug-dialog__screenshot-preview">
                    <img src={preview} alt={`Imagem ${index + 1}`} />
                    <button
                      type="button"
                      className="bug-dialog__screenshot-remove"
                      onClick={() => removeScreenshot(index)}
                      aria-label={`Remover imagem ${index + 1}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {screenshots.length < MAX_IMAGES && (
              <label className="bug-dialog__upload">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleScreenshotChange}
                  className="bug-dialog__upload-input"
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>{screenshots.length === 0 ? 'Clique ou arraste imagens' : 'Adicionar mais imagens'}</span>
                <span className="bug-dialog__upload-hint">PNG, JPG até {MAX_SIZE_MB}MB cada</span>
              </label>
            )}
          </div>

          {/* Page URL indicator */}
          <div className="bug-dialog__page-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Página atual será incluída automaticamente</span>
          </div>

          {/* Actions */}
          <div className="bug-dialog__actions">
            <button
              type="button"
              className="bug-dialog__btn bug-dialog__btn--secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bug-dialog__btn bug-dialog__btn--primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="bug-dialog__spinner"></span>
                  Enviando...
                </>
              ) : (
                'Enviar Relatório'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

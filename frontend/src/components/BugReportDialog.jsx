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
  { value: 'plataforma', label: 'Plataforma', icon: '💻' },
  { value: 'outro', label: 'Outro', icon: '📝' }
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
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('A imagem deve ter no máximo 5MB');
        return;
      }
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
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
      // Convert screenshot to base64 if exists
      let screenshotBase64 = null;
      if (screenshot) {
        screenshotBase64 = screenshotPreview;
      }

      // Se for sugestão, envia para feedbacks, caso contrário para bug-reports
      if (type === 'sugestao') {
        const response = await fetch(`${API_URL}/api/feedbacks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            tipo: suggestionCategory,
            titulo: title.trim(),
            feedback_text: description.trim(),
            screenshot_url: screenshotBase64
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao enviar sugestão');
        }
      } else {
        const response = await fetch(`${API_URL}/api/bug-reports`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            type,
            screenshot: screenshotBase64,
            page_url: window.location.href,
            reporter_email: user?.email,
            reporter_name: user?.name
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao enviar relatório');
        }
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
      <div className="bug-dialog-overlay" onClick={onClose}>
        <div className="bug-dialog bug-dialog--success" onClick={e => e.stopPropagation()}>
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
    <div className="bug-dialog-overlay" onClick={onClose}>
      <div className="bug-dialog" onClick={e => e.stopPropagation()}>
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

          {/* Screenshot */}
          <div className="bug-dialog__field">
            <label className="bug-dialog__label">
              Screenshot <span className="bug-dialog__optional">(opcional)</span>
            </label>
            {screenshotPreview ? (
              <div className="bug-dialog__screenshot-preview">
                <img src={screenshotPreview} alt="Screenshot preview" />
                <button
                  type="button"
                  className="bug-dialog__screenshot-remove"
                  onClick={removeScreenshot}
                  aria-label="Remover screenshot"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="bug-dialog__upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="bug-dialog__upload-input"
                />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Clique ou arraste uma imagem</span>
                <span className="bug-dialog__upload-hint">PNG, JPG até 5MB</span>
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

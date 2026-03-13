import React, { useState } from 'react';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { API_URL } from '../api';
import './BugReportFAB.css';
import './BugReportDialog.css';

const CLIENT_BUG_TYPES = [
  { value: 'bug', label: 'Bug', icon: '🐛', description: 'Algo funciona de forma errada' },
  { value: 'feedback_plataforma', label: 'Feedback', icon: '💻', description: 'Sugestão para melhorar' },
];

export default function ClientBugReportFAB() {
  const { getClientToken } = useClientAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const MAX_IMAGES = 3;
  const MAX_SIZE_MB = 2;

  const resetForm = () => {
    setType('bug');
    setTitle('');
    setDescription('');
    setScreenshots([]);
    setSuccess(false);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleScreenshotChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - screenshots.length;
    if (remaining <= 0) return;

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
    e.target.value = '';
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setLoading(true);
    try {
      let screenshotPayload = null;
      if (screenshots.length > 0) {
        screenshotPayload = screenshots.length === 1
          ? screenshots[0]
          : JSON.stringify(screenshots);
      }

      const pageUrl = window.location.pathname;
      const token = getClientToken();

      const response = await fetch(`${API_URL}/api/client/feedbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          titulo: title.trim(),
          feedback_text: description.trim(),
          screenshot_url: screenshotPayload,
          page_url: pageUrl,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Erro ao enviar feedback';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          if (response.status === 413) {
            errorMessage = 'Imagem muito grande. Reduza o tamanho das imagens.';
          }
        }
        throw new Error(errorMessage);
      }

      setSuccess(true);
      setTimeout(handleClose, 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`bug-fab ${isHovered ? 'bug-fab--expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setIsDialogOpen(true)}
        title="Reportar Bug"
        aria-label="Reportar Bug"
      >
        <svg
          className="bug-fab__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z" />
          <path d="M12 20v2M3 13h3M18 13h3M6.53 17.47l-2.12 2.12M17.47 17.47l2.12 2.12" />
        </svg>
        <span className="bug-fab__text">Reportar Bug</span>
      </button>

      {isDialogOpen && (
        <div className="bug-dialog-overlay">
          {success ? (
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
          ) : (
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
                <button className="bug-dialog__close" onClick={handleClose} aria-label="Fechar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="bug-dialog__form">
                {/* Type Selection - only bug and feedback */}
                <div className="bug-dialog__field">
                  <label className="bug-dialog__label">Tipo</label>
                  <div className="bug-dialog__type-grid">
                    {CLIENT_BUG_TYPES.map(t => (
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

                {/* Title */}
                <div className="bug-dialog__field">
                  <label className="bug-dialog__label" htmlFor="client-bug-title">
                    Título <span className="bug-dialog__required">*</span>
                  </label>
                  <input
                    id="client-bug-title"
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
                  <label className="bug-dialog__label" htmlFor="client-bug-description">
                    Descrição <span className="bug-dialog__required">*</span>
                  </label>
                  <textarea
                    id="client-bug-description"
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

                {/* Actions */}
                <div className="bug-dialog__actions">
                  <button
                    type="button"
                    className="bug-dialog__btn bug-dialog__btn--secondary"
                    onClick={handleClose}
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
          )}
        </div>
      )}
    </>
  );
}

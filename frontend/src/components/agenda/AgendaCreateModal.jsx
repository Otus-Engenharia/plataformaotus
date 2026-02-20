import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import VerificacaoForm from './VerificacaoForm';
import './AgendaCreateModal.css';

const ACTIVITY_TYPES = [
  {
    id: 'compatibilizacao',
    label: 'Compatibilização',
    color: '#8b5cf6',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="6" rx="1.5" />
        <rect x="3" y="15" width="18" height="6" rx="1.5" />
        <rect x="6" y="9" width="12" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'coordenacao',
    label: 'Coordenação',
    color: '#3b82f6',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: 'verificacao',
    label: 'Verificação',
    color: '#10b981',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    id: 'tecnologia',
    label: 'Tecnologia',
    color: '#f59e0b',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="14" x2="4" y2="14" />
      </svg>
    ),
  },
  {
    id: 'apoio-projetos',
    label: 'Apoio Projetos',
    color: '#ec4899',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    id: 'tarefas-otus',
    label: 'Tarefas Otus',
    color: '#ffdd00',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="13" y2="14" />
        <line x1="8" y1="18" x2="11" y2="18" />
      </svg>
    ),
  },
];

function AgendaCreateModal({ isOpen, onClose, selectedDate, onTaskCreated }) {
  const [step, setStep] = useState('type-select');
  const [selectedType, setSelectedType] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Reseta estado ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setStep('type-select');
      setSelectedType(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !selectedDate) return null;

  const dateLabel = format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const timeLabel = format(selectedDate, 'HH:mm');

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleBack = () => {
    setStep('type-select');
  };

  const handleVerificacaoSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await axios.post('/api/agenda/tasks', data, { withCredentials: true });
      if (res.data.success) {
        onTaskCreated?.(res.data.data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Erro desconhecido';
      console.error('Erro ao criar tarefa de verificação:', msg);
      alert(`Erro ao criar atividade: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const typeObj = selectedType ? ACTIVITY_TYPES.find(t => t.id === selectedType) : null;

  return (
    <div className="agenda-modal__overlay" onClick={onClose}>
      <div className={`agenda-modal${step === 'form' ? ' agenda-modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="agenda-modal__header">
          <div className="agenda-modal__header-left">
            {step === 'form' && (
              <button className="agenda-modal__back-btn" onClick={handleBack} title="Voltar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div className="agenda-modal__header-text">
              <h3 className="agenda-modal__title">
                {step === 'type-select'
                  ? 'Nova Atividade'
                  : `Grupo de tarefas de ${typeObj?.label}`}
              </h3>
              <span className="agenda-modal__subtitle">
                {dateLabel} — {timeLabel}
              </span>
            </div>
          </div>
          <button className="agenda-modal__close-btn" onClick={onClose} title="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="agenda-modal__body">
          {step === 'type-select' && (
            <>
              <p className="agenda-modal__prompt">Selecione o tipo de atividade:</p>
              <div className="agenda-modal__type-grid">
                {ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    className="agenda-modal__type-card"
                    style={{ '--type-color': type.color }}
                    onClick={() => handleTypeSelect(type.id)}
                  >
                    <span className="agenda-modal__type-icon">{type.icon}</span>
                    <span className="agenda-modal__type-label">{type.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'form' && typeObj && selectedType === 'verificacao' && (
            <VerificacaoForm
              selectedDate={selectedDate}
              onSubmit={handleVerificacaoSubmit}
              submitting={submitting}
            />
          )}

          {step === 'form' && typeObj && selectedType !== 'verificacao' && (
            <div className="agenda-modal__form-placeholder">
              <span
                className="agenda-modal__form-placeholder-icon"
                style={{ color: typeObj.color }}
              >
                {typeObj.icon}
              </span>
              <p>Formulário de <strong>{typeObj.label}</strong></p>
              <span className="agenda-modal__form-placeholder-hint">Em desenvolvimento</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgendaCreateModal;

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { calculateKRProgressVsMeta } from '../../utils/indicator-utils';
import './DashboardOKRs.css';

// Portal component to render modals outside the component tree
function Portal({ children }) {
  return createPortal(children, document.body);
}

const statusConfig = {
  on_track: { label: 'No prazo', color: 'success' },
  at_risk: { label: 'Em risco', color: 'warning' },
  delayed: { label: 'Atrasado', color: 'danger' },
  completed: { label: 'Concluído', color: 'success' }
};

const metricTypeLabels = {
  number: 'Número',
  percentage: 'Percentual',
  boolean: 'Sim/Não',
  currency: 'Monetário'
};

const consolidationTypeLabels = {
  sum: 'Soma dos meses',
  average: 'Média dos meses',
  last_value: 'Último valor',
  manual: 'Manual'
};

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4'];

// Mapeamento de quarters para meses (usamos o último mês do quarter para check-ins)
const quarterToMonth = { Q1: 3, Q2: 6, Q3: 9, Q4: 12 };
const monthToQuarter = { 3: 'Q1', 6: 'Q2', 9: 'Q3', 12: 'Q4' };

// Helper para verificar se é OKR anual da empresa
const isAnnualCompanyOKR = (objective) => {
  return objective?.nivel === 'empresa' &&
    objective?.quarter?.toLowerCase().includes('anual');
};

// Helper to get months for a quarter (Q1 = [1,2,3], Q2 = [4,5,6], etc.)
const getQuarterMonths = (quarter) => {
  if (!quarter) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const q = quarter.toUpperCase().split('-')[0]; // e.g., "Q1-2025" -> "Q1"
  switch (q) {
    case 'Q1': return [1, 2, 3];
    case 'Q2': return [4, 5, 6];
    case 'Q3': return [7, 8, 9];
    case 'Q4': return [10, 11, 12];
    default: return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
};

// Helper para obter o quarter atual
const getCurrentQuarter = () => {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
};

// Check-in Dialog
function CheckInDialog({ open, onClose, onSuccess, kr, checkIns = [], quarter, objective, initialMonth = null }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  // Verificar se é OKR anual da empresa (usa quarters ao invés de meses)
  const useQuarters = isAnnualCompanyOKR(objective);

  const quarterMonths = getQuarterMonths(quarter);
  const currentMonth = new Date().getMonth() + 1;
  const currentQ = getCurrentQuarter();

  // Encontrar primeiro mês sem check-in preenchido
  const getFirstMonthWithoutCheckIn = () => {
    for (const month of quarterMonths) {
      const hasCheckIn = checkIns.some(c => c.mes === month && c.ano === currentYear);
      if (!hasCheckIn) {
        return month;
      }
    }
    // Se todos têm check-in, usar mês atual ou primeiro do trimestre
    return quarterMonths.includes(currentMonth) ? currentMonth : quarterMonths[0];
  };

  // Para OKRs anuais: usar quarter atual, senão usar primeiro mês sem preenchimento
  // Se initialMonth foi passado, usar ele
  const defaultMonth = initialMonth || (useQuarters
    ? quarterToMonth[currentQ]
    : getFirstMonthWithoutCheckIn());

  const [formData, setFormData] = useState({
    mes: defaultMonth,
    ano: currentYear,
    valor: '',
    notas: ''
  });

  // Resetar quando dialog abre - usar initialMonth se especificado
  useEffect(() => {
    if (open) {
      const targetMonth = initialMonth || defaultMonth;
      setFormData(prev => ({
        ...prev,
        mes: targetMonth,
        valor: '',
        notas: ''
      }));
    }
  }, [open, defaultMonth, initialMonth]);

  const monthlyTargets = kr?.monthly_targets || {};
  const currentTarget = useQuarters
    ? (monthlyTargets[monthToQuarter[formData.mes]] ?? monthlyTargets[formData.mes.toString()])
    : (monthlyTargets[formData.mes.toString()] ?? monthlyTargets[formData.mes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.valor) return;

    setLoading(true);
    try {
      const existingCheckIn = checkIns.find(
        c => c.mes === formData.mes && c.ano === formData.ano
      );

      if (existingCheckIn) {
        const response = await axios.put(`/api/okrs/check-ins/${existingCheckIn.id}`, {
          valor: parseFloat(formData.valor),
          notas: formData.notas || null
        }, { withCredentials: true });
        if (!response.data.success) throw new Error(response.data.error);
      } else {
        const response = await axios.post('/api/okrs/check-ins', {
          key_result_id: kr.id,
          mes: formData.mes,
          ano: formData.ano,
          valor: parseFloat(formData.valor),
          notas: formData.notas || null
        }, { withCredentials: true });
        if (!response.data.success) throw new Error(response.data.error);
      }

      onSuccess?.();
      onClose();
      setFormData({ mes: defaultMonth, ano: currentYear, valor: '', notas: '' });
    } catch (err) {
      console.error('Error saving check-in:', err);
      alert('Erro ao salvar check-in: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Registrar Check-in</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">
                  {useQuarters ? 'Trimestre' : `Mês (${quarter || 'Q1'})`}
                </label>
                <select
                  className="okr-form-select"
                  value={formData.mes}
                  onChange={e => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                >
                  {useQuarters ? (
                    quarterNames.map((q) => (
                      <option key={q} value={quarterToMonth[q]}>{q}</option>
                    ))
                  ) : (
                    quarterMonths.map((month) => (
                      <option key={month} value={month}>{monthNames[month - 1]}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="okr-form-group">
                <label className="okr-form-label">Ano</label>
                <select
                  className="okr-form-select"
                  value={formData.ano}
                  onChange={e => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                >
                  <option value={currentYear - 1}>{currentYear - 1}</option>
                  <option value={currentYear}>{currentYear}</option>
                  <option value={currentYear + 1}>{currentYear + 1}</option>
                </select>
              </div>
            </div>

            {currentTarget !== undefined && currentTarget !== null && (
              <div className="okr-info-box">
                <span className="okr-info-box__label">
                  Meta para {useQuarters ? monthToQuarter[formData.mes] : monthNames[formData.mes - 1]}:
                </span>
                <span className="okr-info-box__value">{currentTarget}</span>
              </div>
            )}

            <div className="okr-form-group">
              <label className="okr-form-label">Valor alcançado *</label>
              <input
                type="number"
                step="any"
                className="okr-form-input"
                value={formData.valor}
                onChange={e => setFormData({ ...formData, valor: e.target.value })}
                placeholder="Ex: 85"
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Observações</label>
              <textarea
                className="okr-form-textarea"
                value={formData.notas}
                onChange={e => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Contexto do resultado, desafios, próximos passos..."
                rows={3}
              />
            </div>
          </div>
          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Check-in'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Editable Value Component para edição inline
function EditableValue({ value, onSave, placeholder = '—', type = 'number', canEdit, formatFn }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setTempValue(value ?? '');
  }, [value]);

  const handleSave = async () => {
    if (saving) return;

    const newValue = tempValue === '' ? null : parseFloat(tempValue);
    const oldValue = value ?? null;

    // Se não mudou, apenas fechar
    if (newValue === oldValue) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch (err) {
      console.error('Error saving:', err);
      setTempValue(value ?? '');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setTempValue(value ?? '');
      setEditing(false);
    }
  };

  const displayValue = formatFn ? formatFn(value) : (value ?? placeholder);

  if (!canEdit) {
    return <span className="okr-value-display">{displayValue}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step="any"
        value={tempValue}
        onChange={e => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="okr-inline-input"
        disabled={saving}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className="okr-editable-value"
      onClick={() => {
        setTempValue(value ?? '');
        setEditing(true);
      }}
      title="Clique para editar"
    >
      {displayValue}
      <svg className="okr-edit-icon" viewBox="0 0 24 24" width="12" height="12">
        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>
    </span>
  );
}

// Editable Notes Component para edição inline de observações
function EditableNotes({ value, onSave, placeholder = 'Adicionar observação...', canEdit }) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const textareaRef = React.useRef(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setTempValue(value || '');
  }, [value]);

  const handleSave = async () => {
    if (saving) return;

    const newValue = tempValue.trim() || null;
    const oldValue = value?.trim() || null;

    // Se não mudou, apenas fechar
    if (newValue === oldValue) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch (err) {
      console.error('Error saving notes:', err);
      setTempValue(value || '');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setTempValue(value || '');
      setEditing(false);
    }
    // Enter sem shift para salvar, com shift para quebra de linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  // Se não pode editar e não tem valor, não mostrar nada
  if (!canEdit && !value) {
    return null;
  }

  // Modo edição
  if (editing) {
    return (
      <div className="okr-monthly-item__notes okr-monthly-item__notes--editing">
        <textarea
          ref={textareaRef}
          value={tempValue}
          onChange={e => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="okr-notes-textarea"
          disabled={saving}
          placeholder={placeholder}
          rows={3}
        />
        <small className="okr-notes-hint">Enter para salvar · Esc para cancelar</small>
      </div>
    );
  }

  // Modo visualização (com valor)
  if (value) {
    return (
      <div
        className={`okr-monthly-item__notes ${canEdit ? 'okr-monthly-item__notes--editable' : ''}`}
        onClick={() => canEdit && setEditing(true)}
        title={canEdit ? 'Clique para editar' : undefined}
      >
        <strong>Observação:</strong> {value}
        {canEdit && (
          <svg className="okr-edit-icon" viewBox="0 0 24 24" width="12" height="12">
            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        )}
      </div>
    );
  }

  // Modo visualização (sem valor, usuário privilegiado - mostrar placeholder)
  return (
    <div
      className="okr-monthly-item__notes okr-monthly-item__notes--placeholder"
      onClick={() => setEditing(true)}
      title="Clique para adicionar observação"
    >
      <svg viewBox="0 0 24 24" width="14" height="14">
        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
      {placeholder}
    </div>
  );
}

// Comment Dialog
function CommentDialog({ open, onClose, onSuccess, krId, replyTo = null }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [categoria, setCategoria] = useState('Comentário');

  const categorias = [
    { value: 'Comentário', label: 'Comentário', color: '#6b7280' },
    { value: 'Sugestão', label: 'Sugestão', color: '#059669' },
    { value: 'Dúvida', label: 'Dúvida', color: '#d97706' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const payload = {
        content: content.trim(),
        categoria: replyTo ? 'Comentário' : categoria // Respostas não têm categoria
      };

      if (replyTo) {
        payload.parent_id = replyTo.id;
      }

      const response = await axios.post(`/api/okrs/key-results/${krId}/comments`, payload, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setContent('');
      setCategoria('Comentário');
    } catch (err) {
      console.error('Error saving comment:', err);
      alert('Erro ao salvar comentário: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const isReply = !!replyTo;
  const title = isReply ? `Responder a ${replyTo.author_name}` : 'Adicionar Comentário';

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">{title}</h2>
            <button className="okr-modal__close" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="okr-modal__body">
              {isReply && (
                <div className="okr-reply-context" style={{
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  borderLeft: '3px solid #d1d5db'
                }}>
                  <small style={{ color: '#6b7280' }}>Respondendo a:</small>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#374151' }}>
                    "{replyTo.content.length > 100 ? replyTo.content.substring(0, 100) + '...' : replyTo.content}"
                  </p>
                </div>
              )}

              {!isReply && (
                <div className="okr-form-group" style={{ marginBottom: '16px' }}>
                  <label className="okr-form-label">Tipo</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {categorias.map(cat => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategoria(cat.value)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: categoria === cat.value ? `2px solid ${cat.color}` : '1px solid #e5e7eb',
                          backgroundColor: categoria === cat.value ? `${cat.color}15` : 'white',
                          color: categoria === cat.value ? cat.color : '#6b7280',
                          fontWeight: categoria === cat.value ? '600' : '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="okr-form-group">
                <label className="okr-form-label">{isReply ? 'Sua resposta' : 'Comentário'}</label>
                <textarea
                  className="okr-form-textarea"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={isReply ? 'Escreva sua resposta...' : 'Seu feedback sobre este Key Result...'}
                  rows={4}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="okr-modal__footer">
              <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
                {loading ? 'Enviando...' : (isReply ? 'Responder' : 'Enviar')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
}

// Recovery Plan Dialog
function RecoveryPlanDialog({ open, onClose, onSuccess, krId, defaultMonth, defaultYear, quarter }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const quarterMonths = getQuarterMonths(quarter);
  const currentMonth = new Date().getMonth() + 1;
  const defaultMonthValue = defaultMonth || (quarterMonths.includes(currentMonth) ? currentMonth : quarterMonths[0]);

  const [formData, setFormData] = useState({
    mes: defaultMonthValue,
    ano: defaultYear || currentYear,
    description: '',
    actions: ''
  });

  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        mes: defaultMonth || (quarterMonths.includes(currentMonth) ? currentMonth : quarterMonths[0]),
        ano: defaultYear || currentYear
      }));
    }
  }, [open, defaultMonth, defaultYear, currentYear, quarterMonths, currentMonth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`/api/okrs/key-results/${krId}/recovery-plans`, {
        mes_referencia: formData.mes,
        ano_referencia: formData.ano,
        description: formData.description.trim(),
        actions: formData.actions.trim() || null
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
      setFormData({ mes: new Date().getMonth() + 1, ano: currentYear, description: '', actions: '' });
    } catch (err) {
      console.error('Error creating recovery plan:', err);
      alert('Erro ao criar plano: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--lg">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Novo Plano de Recuperação</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Mês de Referência ({quarter || 'Q1'})</label>
                <select
                  className="okr-form-select"
                  value={formData.mes}
                  onChange={e => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                >
                  {quarterMonths.map((month) => (
                    <option key={month} value={month}>{monthNames[month - 1]}</option>
                  ))}
                </select>
              </div>
              <div className="okr-form-group">
                <label className="okr-form-label">Ano</label>
                <select
                  className="okr-form-select"
                  value={formData.ano}
                  onChange={e => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                >
                  <option value={currentYear - 1}>{currentYear - 1}</option>
                  <option value={currentYear}>{currentYear}</option>
                  <option value={currentYear + 1}>{currentYear + 1}</option>
                </select>
              </div>
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Descrição do Problema *</label>
              <textarea
                className="okr-form-textarea"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o motivo pelo qual a meta não foi atingida..."
                rows={3}
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Ações Corretivas</label>
              <textarea
                className="okr-form-textarea"
                value={formData.actions}
                onChange={e => setFormData({ ...formData, actions: e.target.value })}
                placeholder="Liste as ações que serão tomadas para recuperar..."
                rows={3}
              />
            </div>
          </div>
          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Plano'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Edit Recovery Plan Dialog
function EditRecoveryPlanDialog({ open, onClose, onSuccess, plan }) {
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    mes: 1,
    ano: currentYear,
    description: '',
    actions: ''
  });

  useEffect(() => {
    if (plan && open) {
      setFormData({
        mes: plan.mes_referencia || 1,
        ano: plan.ano_referencia || currentYear,
        description: plan.description || '',
        actions: plan.actions || ''
      });
    }
  }, [plan, open, currentYear]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    setLoading(true);
    try {
      const response = await axios.put(`/api/okrs/recovery-plans/${plan.id}`, {
        mes_referencia: formData.mes,
        ano_referencia: formData.ano,
        description: formData.description.trim(),
        actions: formData.actions.trim() || null
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating recovery plan:', err);
      alert('Erro ao atualizar plano: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--lg">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Editar Plano de Recuperação</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            <div className="okr-form-row">
              <div className="okr-form-group">
                <label className="okr-form-label">Mês de Referência</label>
                <select
                  className="okr-form-select"
                  value={formData.mes}
                  onChange={e => setFormData({ ...formData, mes: parseInt(e.target.value) })}
                >
                  {monthNames.map((name, idx) => (
                    <option key={idx} value={idx + 1}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="okr-form-group">
                <label className="okr-form-label">Ano</label>
                <select
                  className="okr-form-select"
                  value={formData.ano}
                  onChange={e => setFormData({ ...formData, ano: parseInt(e.target.value) })}
                >
                  <option value={currentYear - 1}>{currentYear - 1}</option>
                  <option value={currentYear}>{currentYear}</option>
                  <option value={currentYear + 1}>{currentYear + 1}</option>
                </select>
              </div>
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Descrição do Problema *</label>
              <textarea
                className="okr-form-textarea"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o motivo pelo qual a meta não foi atingida..."
                rows={3}
                required
              />
            </div>

            <div className="okr-form-group">
              <label className="okr-form-label">Ações Corretivas</label>
              <textarea
                className="okr-form-textarea"
                value={formData.actions}
                onChange={e => setFormData({ ...formData, actions: e.target.value })}
                placeholder="Liste as ações que serão tomadas para recuperar..."
                rows={3}
              />
            </div>
          </div>
          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Edit KR Dialog
function EditKeyResultDialog({ open, onClose, onSuccess, kr, quarter, setorId }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [usuarios, setUsuarios] = useState([]);
  const [onlyLeadership, setOnlyLeadership] = useState(false);

  const quarterMonths = getQuarterMonths(quarter);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    meta: '',
    peso: '',
    tipo_metrica: 'number',
    consolidation_type: 'last_value',
    auto_calculate: false,
    is_inverse: false,
    responsavel_id: '',
    monthly_targets: {}
  });

  // Busca lista de usuários ao abrir o dialog ou mudar filtros
  useEffect(() => {
    if (open) {
      const params = new URLSearchParams();
      if (setorId) params.append('setor_id', setorId);
      if (onlyLeadership) params.append('only_leadership', 'true');

      axios.get(`/api/okrs/usuarios-responsaveis?${params.toString()}`, { withCredentials: true })
        .then(res => setUsuarios(res.data.data || []))
        .catch(err => console.error('Erro ao buscar usuários:', err));
    }
  }, [open, setorId, onlyLeadership]);

  useEffect(() => {
    if (kr && open) {
      setFormData({
        titulo: kr.titulo || kr.descricao || '',
        descricao: kr.descricao || '',
        meta: kr.meta?.toString() || '',
        peso: kr.peso?.toString() || '',
        tipo_metrica: kr.tipo_metrica || 'number',
        consolidation_type: kr.consolidation_type || 'last_value',
        auto_calculate: kr.auto_calculate || false,
        is_inverse: kr.is_inverse || false,
        responsavel_id: kr.responsavel_id || '',
        monthly_targets: kr.monthly_targets || {}
      });
      setActiveTab('general');
    }
  }, [kr, open]);

  const handleMonthlyTargetChange = (month, value) => {
    setFormData(prev => ({
      ...prev,
      monthly_targets: {
        ...prev.monthly_targets,
        [month]: value === '' ? undefined : parseFloat(value)
      }
    }));
  };

  const distributeTargetEvenly = () => {
    const totalMeta = parseFloat(formData.meta) || 0;
    if (totalMeta <= 0) {
      alert('Defina uma meta total primeiro');
      return;
    }
    const monthlyValue = Math.round((totalMeta / quarterMonths.length) * 100) / 100;
    const newTargets = { ...formData.monthly_targets };
    quarterMonths.forEach(month => {
      newTargets[month] = monthlyValue;
    });
    setFormData(prev => ({ ...prev, monthly_targets: newTargets }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;

    setLoading(true);
    try {
      // Clean up monthly_targets - remove undefined values
      const cleanedTargets = {};
      Object.entries(formData.monthly_targets).forEach(([month, value]) => {
        if (value !== undefined && value !== null && !isNaN(value)) {
          cleanedTargets[month] = value;
        }
      });

      const response = await axios.put(`/api/okrs/key-results/${kr.id}`, {
        titulo: formData.titulo.trim(),
        descricao: formData.descricao.trim() || null,
        meta: parseFloat(formData.meta) || 0,
        peso: parseInt(formData.peso) || 0,
        tipo_metrica: formData.tipo_metrica,
        consolidation_type: formData.consolidation_type,
        auto_calculate: formData.auto_calculate,
        is_inverse: formData.is_inverse,
        responsavel_id: formData.responsavel_id || null,
        monthly_targets: Object.keys(cleanedTargets).length > 0 ? cleanedTargets : null
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error updating KR:', err);
      alert('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--lg">
          <div className="okr-modal__header">
            <h2 className="okr-modal__title">Editar Key Result</h2>
          <button className="okr-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="okr-modal__tabs">
          <button
            type="button"
            className={`okr-modal__tab ${activeTab === 'general' ? 'okr-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            Geral
          </button>
          <button
            type="button"
            className={`okr-modal__tab ${activeTab === 'monthly' ? 'okr-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('monthly')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
            Metas Mensais
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="okr-modal__body">
            {activeTab === 'general' && (
              <>
                <div className="okr-form-group">
                  <label className="okr-form-label">Título *</label>
                  <input
                    type="text"
                    className="okr-form-input"
                    value={formData.titulo}
                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                    required
                  />
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Descrição</label>
                  <textarea
                    className="okr-form-textarea"
                    value={formData.descricao}
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="okr-form-row">
                  <div className="okr-form-group">
                    <label className="okr-form-label">Meta</label>
                    <input
                      type="number"
                      step="any"
                      className="okr-form-input"
                      value={formData.meta}
                      onChange={e => setFormData({ ...formData, meta: e.target.value })}
                    />
                  </div>
                  <div className="okr-form-group">
                    <label className="okr-form-label">Peso (%)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="okr-form-input"
                      value={formData.peso}
                      onChange={e => setFormData({ ...formData, peso: e.target.value })}
                    />
                  </div>
                </div>

                <div className="okr-form-row">
                  <div className="okr-form-group">
                    <label className="okr-form-label">Tipo de Métrica</label>
                    <select
                      className="okr-form-select"
                      value={formData.tipo_metrica}
                      onChange={e => setFormData({ ...formData, tipo_metrica: e.target.value })}
                    >
                      <option value="number">Número</option>
                      <option value="percentage">Porcentagem</option>
                      <option value="currency">Moeda (R$)</option>
                      <option value="boolean">Sim/Não</option>
                    </select>
                  </div>
                  <div className="okr-form-group">
                    <label className="okr-form-label">Consolidação</label>
                    <select
                      className="okr-form-select"
                      value={formData.consolidation_type}
                      onChange={e => setFormData({ ...formData, consolidation_type: e.target.value })}
                    >
                      <option value="last_value">Último Valor</option>
                      <option value="sum">Soma</option>
                      <option value="average">Média</option>
                      <option value="manual">Manual</option>
                    </select>
                    <div className="okr-form-toggle-row" style={{ marginTop: '0.5rem' }}>
                      <label className="okr-toggle">
                        <input
                          type="checkbox"
                          checked={formData.auto_calculate}
                          onChange={e => setFormData({ ...formData, auto_calculate: e.target.checked })}
                          disabled={formData.consolidation_type === 'manual'}
                        />
                        <span className="okr-toggle__slider" />
                      </label>
                      <span className="okr-form-toggle-label">Cálculo automático</span>
                    </div>
                  </div>
                </div>

                <div className="okr-form-group">
                  <label className="okr-form-label">Responsável</label>
                  <select
                    className="okr-form-select"
                    value={formData.responsavel_id}
                    onChange={e => setFormData({ ...formData, responsavel_id: e.target.value })}
                  >
                    <option value="">Selecione um responsável</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <div className="okr-form-toggle-row">
                    <label className="okr-toggle">
                      <input
                        type="checkbox"
                        checked={onlyLeadership}
                        onChange={e => setOnlyLeadership(e.target.checked)}
                      />
                      <span className="okr-toggle__slider" />
                    </label>
                    <span className="okr-form-toggle-label">Somente lideranças</span>
                  </div>
                </div>

                <div className="okr-form-group okr-form-group--checkbox">
                  <label className="okr-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.is_inverse}
                      onChange={e => setFormData({ ...formData, is_inverse: e.target.checked })}
                    />
                    <span className="okr-checkbox__mark" />
                    <span className="okr-checkbox__label">
                      <strong>Métrica inversa</strong>
                      <small>Valores menores indicam melhor desempenho</small>
                    </span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'monthly' && (
              <>
                <div className="okr-form-help">
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span>Defina metas para cada mês do trimestre ({quarter || 'Q1'}). Isso permite acompanhar o progresso mensal.</span>
                </div>

                <div className="okr-form-actions-row">
                  <button
                    type="button"
                    className="okr-btn okr-btn--outline okr-btn--sm"
                    onClick={distributeTargetEvenly}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
                    </svg>
                    Distribuir Meta Igualmente
                  </button>
                </div>

                <div className="okr-monthly-targets-grid okr-monthly-targets-grid--quarter">
                  {quarterMonths.map((month) => {
                    const value = formData.monthly_targets[month];
                    return (
                      <div key={month} className="okr-monthly-target-input">
                        <label className="okr-form-label">{monthNames[month - 1]}</label>
                        <input
                          type="number"
                          step="any"
                          className="okr-form-input"
                          value={value !== undefined && value !== null ? value : ''}
                          onChange={e => handleMonthlyTargetChange(month, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="okr-btn okr-btn--primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Delete Confirm Dialog
function DeleteConfirmDialog({ open, onClose, onConfirm, title, message, isDeleting }) {
  if (!open) return null;

  return (
    <Portal>
      <div className="okr-modal-overlay">
        <div className="okr-modal okr-modal--sm">
          <div className="okr-modal__header">
            <div className="okr-modal__icon okr-modal__icon--danger">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </div>
            <h2 className="okr-modal__title">{title}</h2>
          </div>
          <div className="okr-modal__body">
            <p className="okr-modal__message">{message}</p>
          </div>
          <div className="okr-modal__footer">
            <button type="button" className="okr-btn okr-btn--outline" onClick={onClose} disabled={isDeleting}>
              Cancelar
            </button>
            <button type="button" className="okr-btn okr-btn--danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// Recovery Plan Card
function RecoveryPlanCard({ plan, canEdit, onRefresh, onEdit }) {
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusColors = {
    pending: 'warning',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'danger'
  };

  const statusLabels = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    cancelled: 'Cancelado'
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const response = await axios.put(`/api/okrs/recovery-plans/${plan.id}`, {
        status: newStatus
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);
      onRefresh?.();
    } catch (err) {
      console.error('Error updating plan:', err);
      alert('Erro ao atualizar: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    setUpdating(true);
    try {
      const response = await axios.delete(`/api/okrs/recovery-plans/${plan.id}`, {
        withCredentials: true
      });

      if (!response.data.success) throw new Error(response.data.error);
      onRefresh?.();
    } catch (err) {
      console.error('Error deleting plan:', err);
      alert('Erro ao excluir: ' + (err.response?.data?.error || err.message));
    } finally {
      setUpdating(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="okr-recovery-card">
      <div className="okr-recovery-card__header">
        <div className="okr-recovery-card__month">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
          </svg>
          {monthNames[plan.mes_referencia - 1]} {plan.ano_referencia}
        </div>
        <div className="okr-recovery-card__header-right">
          <span className={`okr-badge okr-badge--${statusColors[plan.status]}`}>
            {statusLabels[plan.status]}
          </span>
          {canEdit && (
            <div className="okr-recovery-card__actions-icons">
              <button
                className="okr-icon-btn okr-icon-btn--sm"
                onClick={() => onEdit?.(plan)}
                title="Editar"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button
                className="okr-icon-btn okr-icon-btn--sm okr-icon-btn--danger"
                onClick={() => setShowDeleteConfirm(true)}
                title="Excluir"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="okr-recovery-card__description">{plan.description}</p>
      {plan.actions && (
        <div className="okr-recovery-card__actions">
          <strong>Ações:</strong>
          <p>{plan.actions}</p>
        </div>
      )}
      {canEdit && plan.status !== 'completed' && plan.status !== 'cancelled' && (
        <div className="okr-recovery-card__buttons">
          <button
            className="okr-btn okr-btn--outline okr-btn--sm"
            onClick={() => updateStatus('in_progress')}
            disabled={updating || plan.status === 'in_progress'}
          >
            Em Andamento
          </button>
          <button
            className="okr-btn okr-btn--primary okr-btn--sm"
            onClick={() => updateStatus('completed')}
            disabled={updating}
          >
            Concluir
          </button>
        </div>
      )}

      {/* Delete confirmation inline */}
      {showDeleteConfirm && (
        <div className="okr-recovery-card__delete-confirm">
          <p>Tem certeza que deseja excluir este plano?</p>
          <div className="okr-recovery-card__delete-buttons">
            <button
              className="okr-btn okr-btn--outline okr-btn--sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={updating}
            >
              Cancelar
            </button>
            <button
              className="okr-btn okr-btn--danger okr-btn--sm"
              onClick={handleDelete}
              disabled={updating}
            >
              {updating ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KeyResultDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPrivileged, isDev, isDirector, user } = useAuth();

  const [kr, setKr] = useState(null);
  const [objective, setObjective] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [comments, setComments] = useState([]);
  const [recoveryPlans, setRecoveryPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialogs
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [checkInInitialMonth, setCheckInInitialMonth] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [replyToComment, setReplyToComment] = useState(null); // Para responder comentários
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [showEditRecoveryDialog, setShowEditRecoveryDialog] = useState(false);
  const [editingRecoveryPlan, setEditingRecoveryPlan] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recoveryMonth, setRecoveryMonth] = useState(null);
  const [recoveryYear, setRecoveryYear] = useState(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all OKRs to find the KR
      const okrsResponse = await axios.get('/api/okrs', { withCredentials: true });
      if (!okrsResponse.data.success) throw new Error(okrsResponse.data.error);

      // Find the KR in all OKRs
      let krData = null;
      let objData = null;

      for (const okr of okrsResponse.data.data || []) {
        const krs = okr.keyResults || okr.key_results || [];
        const foundKr = krs.find(kr => kr.id === parseInt(id));
        if (foundKr) {
          krData = foundKr;
          objData = okr;
          break;
        }
      }

      setKr(krData);
      setObjective(objData);

      if (!krData) {
        setLoading(false);
        return;
      }

      // Fetch check-ins for this KR
      const checkInsResponse = await axios.get('/api/okrs/check-ins', {
        params: { keyResultIds: id },
        withCredentials: true
      });
      setCheckIns(checkInsResponse.data.data || []);

      // Fetch recovery plans for this KR
      try {
        const recoveryResponse = await axios.get(`/api/okrs/key-results/${id}/recovery-plans`, {
          withCredentials: true
        });
        setRecoveryPlans(recoveryResponse.data.data || []);
      } catch (err) {
        console.error('Error fetching recovery plans:', err);
        setRecoveryPlans([]);
      }

      // Fetch comments for this KR
      try {
        const commentsResponse = await axios.get(`/api/okrs/key-results/${id}/comments`, {
          withCredentials: true
        });
        setComments(commentsResponse.data.data || []);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setComments([]);
      }
    } catch (err) {
      console.error('Error fetching KR:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate automatic value based on consolidation type (for suggestion/reference)
  const calculatedValue = useMemo(() => {
    if (!kr || checkIns.length === 0) return null;
    const type = kr.consolidation_type || 'last_value';

    if (type === 'sum') {
      return checkIns.reduce((sum, c) => sum + (c.valor || 0), 0);
    }
    if (type === 'average') {
      const sum = checkIns.reduce((acc, c) => acc + (c.valor || 0), 0);
      return Math.round((sum / checkIns.length) * 100) / 100;
    }

    // last_value - retorna o último valor de check-in
    const sorted = [...checkIns].sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return b.mes - a.mes;
    });
    return sorted[0]?.valor ?? null;
  }, [kr, checkIns]);

  // Consolidated value (manual) - this is what determines the progress/farol
  const consolidatedValue = useMemo(() => {
    if (!kr) return 0;
    return kr.atual ?? 0;
  }, [kr]);

  // Calculate progress: Realizado Acumulado / Planejado Acumulado
  const progress = useMemo(() => {
    if (!kr) return 0;
    const planejado = kr.planejado_acumulado || 0;
    const realizado = kr.atual || 0;

    // Se planejado é 0, retorna 100 se realizado também é 0
    if (planejado === 0) return realizado === 0 ? 100 : 0;

    // Para indicadores inversos (quanto menor, melhor)
    if (kr.is_inverse) {
      if (realizado <= planejado) return 100;
      return Math.min(Math.max(Math.round((planejado / realizado) * 100), 0), 100);
    }

    // Cálculo padrão: realizado / planejado
    return Math.min(Math.max(Math.round((realizado / planejado) * 100), 0), 100);
  }, [kr]);

  // Calculate progress vs meta (final target)
  const progressVsMeta = useMemo(() => calculateKRProgressVsMeta(kr), [kr]);

  const trend = useMemo(() => {
    if (progress > 60) return 'up';
    if (progress < 40) return 'down';
    return 'stable';
  }, [progress]);

  // Verificar se é OKR anual da empresa (usa quarters)
  const useQuarters = useMemo(() => isAnnualCompanyOKR(objective), [objective]);

  // Get quarter months for filtering
  const quarterMonths = useMemo(() => {
    return getQuarterMonths(objective?.quarter);
  }, [objective?.quarter]);

  // Períodos para exibição (quarters para OKR anual, meses para trimestral)
  const displayPeriods = useMemo(() => {
    if (useQuarters) {
      return quarterNames.map(q => ({ key: q, month: quarterToMonth[q], label: q }));
    }
    return quarterMonths.map(m => ({ key: m, month: m, label: monthNames[m - 1] }));
  }, [useQuarters, quarterMonths]);

  // Monthly/Quarterly comparison
  const periodComparison = useMemo(() => {
    const targets = kr?.monthly_targets || {};
    const year = objective?.quarter?.split('-')[1] || new Date().getFullYear();
    const isInverse = kr?.is_inverse || false;

    return displayPeriods.map(({ key, month, label }) => {
      // Para quarters, buscar target pela chave Q1, Q2, etc. ou pelo mês correspondente
      const target = useQuarters
        ? (targets[key] ?? targets[month] ?? targets[month.toString()])
        : (targets[month] ?? targets[month.toString()]);

      const checkIn = checkIns.find(c => c.mes === month && c.ano === parseInt(year));
      const isBehind = (target !== undefined && target !== null && checkIn)
        ? (isInverse ? checkIn.valor > target : checkIn.valor < target)
        : false;
      const hasRecoveryPlan = recoveryPlans.some(
        p => p.mes_referencia === month && p.ano_referencia === parseInt(year)
      );

      return {
        key,
        month,
        label,
        target: target ?? null,
        checkIn,
        isBehind,
        needsRecoveryPlan: isBehind && !hasRecoveryPlan,
        hasRecoveryPlan
      };
    });
  }, [kr, checkIns, recoveryPlans, objective, displayPeriods, useQuarters]);

  // Alias para compatibilidade
  const monthlyComparison = periodComparison;

  const monthsBehind = monthlyComparison.filter(m => m.needsRecoveryPlan);

  // Meses passados que não têm check-in de "Realizado" preenchido
  const monthsNotFilled = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();
    const krYear = parseInt(objective?.quarter?.split('-')[1]) || currentYear;

    return periodComparison.filter(m => {
      // Só considera meses passados (não o mês atual)
      const isPastMonth = (krYear < currentYear) ||
                          (krYear === currentYear && m.month < currentMonth);

      // Não tem check-in preenchido (valor nulo ou inexistente)
      const notFilled = !m.checkIn || m.checkIn.valor === null || m.checkIn.valor === undefined;

      return isPastMonth && notFilled;
    });
  }, [periodComparison, objective]);

  const formatValue = (value) => {
    if (!kr) return value;
    if (value === null || value === undefined) return '-';
    if (kr.tipo_metrica === 'percentage') return `${value}%`;
    if (kr.tipo_metrica === 'currency') return `R$ ${value.toLocaleString('pt-BR')}`;
    if (kr.tipo_metrica === 'boolean') return value >= 1 ? 'Sim' : 'Não';
    return value.toLocaleString('pt-BR');
  };

  const getProgressColor = () => {
    if (progress >= 100) return 'success';
    if (progress >= 70) return 'warning';
    return 'danger';
  };

  // Abre o dialog de check-in, opcionalmente com um mês específico
  const openCheckInDialog = (month = null) => {
    setCheckInInitialMonth(month);
    setShowCheckInDialog(true);
  };

  const handleDeleteKR = async () => {
    if (!kr) return;
    setIsDeleting(true);

    try {
      const response = await axios.delete(`/api/okrs/key-results/${kr.id}`, {
        withCredentials: true
      });

      if (!response.data.success) throw new Error(response.data.error);
      navigate(objective ? `/okrs/objetivo/${objective.id}` : '/okrs');
    } catch (err) {
      console.error('Error deleting KR:', err);
      alert('Erro ao excluir: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const openRecoveryDialogForMonth = (month, year) => {
    setRecoveryMonth(month);
    setRecoveryYear(year);
    setShowRecoveryDialog(true);
  };

  const handleEditRecoveryPlan = (plan) => {
    setEditingRecoveryPlan(plan);
    setShowEditRecoveryDialog(true);
  };

  // Handler para atualizar meta planejada inline
  const handleUpdateTarget = async (periodKey, month, newValue) => {
    if (!kr) return;

    try {
      const currentTargets = kr.monthly_targets || {};
      const updatedTargets = { ...currentTargets };

      // Para quarters, usar a chave Q1, Q2, etc.
      const targetKey = useQuarters ? periodKey : month;

      if (newValue === null || newValue === undefined) {
        delete updatedTargets[targetKey];
      } else {
        updatedTargets[targetKey] = newValue;
      }

      const response = await axios.put(`/api/okrs/key-results/${kr.id}`, {
        monthly_targets: Object.keys(updatedTargets).length > 0 ? updatedTargets : null
      }, { withCredentials: true });

      if (!response.data.success) throw new Error(response.data.error);
      fetchData();
    } catch (err) {
      console.error('Error updating target:', err);
      alert('Erro ao atualizar meta: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Handler para atualizar/criar check-in inline
  const handleUpdateCheckIn = async (month, newValue, existingCheckIn) => {
    if (!kr) return;

    const year = objective?.quarter?.split('-')[1] || new Date().getFullYear();

    try {
      if (newValue === null || newValue === undefined) {
        // Se valor for nulo e existe check-in, deletar
        if (existingCheckIn) {
          const response = await axios.delete(`/api/okrs/check-ins/${existingCheckIn.id}`, {
            withCredentials: true
          });
          if (!response.data.success) throw new Error(response.data.error);
        }
      } else if (existingCheckIn) {
        // Atualizar check-in existente
        const response = await axios.put(`/api/okrs/check-ins/${existingCheckIn.id}`, {
          valor: newValue
        }, { withCredentials: true });
        if (!response.data.success) throw new Error(response.data.error);
      } else {
        // Criar novo check-in
        const response = await axios.post('/api/okrs/check-ins', {
          key_result_id: kr.id,
          mes: month,
          ano: parseInt(year),
          valor: newValue
        }, { withCredentials: true });
        if (!response.data.success) throw new Error(response.data.error);
      }

      fetchData();
    } catch (err) {
      console.error('Error updating check-in:', err);
      alert('Erro ao atualizar valor: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Handler para atualizar observações inline
  const handleUpdateNotes = async (checkIn, newNotes) => {
    if (!checkIn?.id) return;

    try {
      const response = await axios.put(`/api/okrs/check-ins/${checkIn.id}`, {
        notas: newNotes || null
      }, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      fetchData();
    } catch (err) {
      console.error('Error updating notes:', err);
      alert('Erro ao atualizar observação: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Handler para atualizar valor manual (acumulado) do KR
  const handleUpdateManualValue = async (newValue) => {
    if (!kr?.id) return;

    try {
      const response = await axios.put(`/api/okrs/key-results/${kr.id}`, {
        atual: newValue ?? 0
      }, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      fetchData();
    } catch (err) {
      console.error('Error updating manual value:', err);
      alert('Erro ao atualizar valor: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Handler para atualizar planejado acumulado
  const handleUpdatePlanejado = async (newValue) => {
    if (!kr?.id) return;

    try {
      const response = await axios.put(`/api/okrs/key-results/${kr.id}`, {
        planejado_acumulado: newValue ?? 0
      }, { withCredentials: true });
      if (!response.data.success) throw new Error(response.data.error);
      fetchData();
    } catch (err) {
      console.error('Error updating planejado:', err);
      alert('Erro ao atualizar planejado: ' + (err.response?.data?.error || err.message));
      throw err;
    }
  };

  // Calcular sugestão de planejado baseado nas metas mensais
  const suggestedPlanejado = useMemo(() => {
    if (!kr?.monthly_targets) return null;
    const targets = kr.monthly_targets;
    const currentMonth = new Date().getMonth() + 1;
    const type = kr.consolidation_type || 'last_value';

    // Pegar metas até o mês atual
    const relevantMonths = Object.keys(targets)
      .map(Number)
      .filter(m => m <= currentMonth)
      .sort((a, b) => a - b);

    if (relevantMonths.length === 0) return null;

    if (type === 'sum') {
      return relevantMonths.reduce((sum, m) => sum + (targets[m] || 0), 0);
    }
    if (type === 'average') {
      const sum = relevantMonths.reduce((acc, m) => acc + (targets[m] || 0), 0);
      return Math.round((sum / relevantMonths.length) * 100) / 100;
    }
    // last_value - retorna a meta do último mês
    const lastMonth = relevantMonths[relevantMonths.length - 1];
    return targets[lastMonth] ?? null;
  }, [kr]);

  // Verificar se o usuário pode editar observações dos check-ins
  // Pode editar se: é dev/diretor OU é o responsável pelo KR OU é do mesmo setor
  const canEditNotes = useMemo(() => {
    // Dev ou Diretor podem sempre editar
    if (isDev || isDirector) return true;

    // Se não tem info do usuário, não pode editar
    if (!user?.userId && !user?.setor_id) return false;

    // Responsável pelo KR pode editar
    if (kr?.responsavel_id && user?.userId && kr.responsavel_id === user.userId) {
      return true;
    }

    // Usuário do mesmo setor pode editar
    if (objective?.setor_id && user?.setor_id && objective.setor_id === user.setor_id) {
      return true;
    }

    return false;
  }, [isDev, isDirector, user, kr, objective]);

  const status = kr?.status || 'on_track';
  const statusInfo = statusConfig[status] || statusConfig.on_track;

  if (loading) {
    return (
      <div className="okr-dashboard okr-dashboard--loading">
        <div className="okr-loading-pulse">
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
          <div className="okr-loading-pulse__ring" />
        </div>
        <p className="okr-loading-text">Carregando Key Result...</p>
      </div>
    );
  }

  if (!kr) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Key Result não encontrado</p>
          <button onClick={() => navigate('/okrs')} className="okr-btn okr-btn--primary">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="okr-dashboard okr-dashboard--error">
        <div className="okr-error-state">
          <svg viewBox="0 0 24 24" width="48" height="48" className="okr-error-state__icon">
            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="okr-error-state__message">Erro: {error}</p>
          <button onClick={fetchData} className="okr-btn okr-btn--primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="okr-dashboard">
      {/* Background effects */}
      <div className="okr-dashboard__bg">
        <div className="okr-dashboard__gradient" />
        <div className="okr-dashboard__noise" />
      </div>

      {/* Header */}
      <header className="okr-header">
        <div className="okr-header__left">
          <button
            className="okr-back-btn"
            onClick={() => navigate(objective ? `/okrs/objetivo/${objective.id}` : '/okrs')}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div>
            {objective && (
              <Link
                to={`/okrs/objetivo/${objective.id}`}
                className="okr-header__breadcrumb-link"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                {objective.titulo}
              </Link>
            )}
            <div className="okr-header__badges">
              <span className={`okr-badge okr-badge--${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className="okr-badge okr-badge--secondary">
                Peso: {kr.peso || 0}%
              </span>
              <span className="okr-badge okr-badge--outline">
                {metricTypeLabels[kr.tipo_metrica] || 'Número'}
              </span>
              {kr.is_inverse && (
                <span className="okr-badge okr-badge--inverse">
                  <svg viewBox="0 0 24 24" width="12" height="12">
                    <path fill="currentColor" d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
                  </svg>
                  Menor é melhor
                </span>
              )}
            </div>
            <h1 className="okr-header__title">{kr.titulo || kr.descricao}</h1>
            {kr.descricao && (
              <p className="okr-header__description">{kr.descricao}</p>
            )}
          </div>
        </div>

        {isPrivileged && (
          <div className="okr-header__actions">
            <button className="okr-btn okr-btn--outline" onClick={() => setShowEditDialog(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              Editar
            </button>
            <button className="okr-btn okr-btn--danger-outline" onClick={() => setShowDeleteDialog(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* Progress Card - Design V3 Minimal */}
      <section className="okr-section">
        <div className="okr-progress-v3">
          {/* Header com responsável */}
          <div className="okr-progress-v3__header">
            {kr.responsavel_user && (
              <div className="okr-progress-v3__owner">
                {kr.responsavel_user.avatar_url ? (
                  <img
                    src={kr.responsavel_user.avatar_url}
                    alt={kr.responsavel_user.name}
                    className="okr-progress-v3__avatar"
                  />
                ) : (
                  <div className="okr-progress-v3__avatar-placeholder">
                    {kr.responsavel_user.name?.charAt(0) || '?'}
                  </div>
                )}
                <div className="okr-progress-v3__owner-info">
                  <span className="okr-progress-v3__owner-label">Responsável</span>
                  <span className="okr-progress-v3__owner-name">{kr.responsavel_user.name}</span>
                </div>
              </div>
            )}
            <div className="okr-progress-v3__meta-final">
              <span className="okr-progress-v3__meta-label">Meta Final</span>
              <span className="okr-progress-v3__meta-value">{formatValue(kr.meta)}</span>
            </div>
          </div>

          {/* Indicadores principais */}
          <div className="okr-progress-v3__metrics">
            {/* Card Ritmo */}
            <div className={`okr-progress-v3__card okr-progress-v3__card--${getProgressColor()}`}>
              <div className="okr-progress-v3__card-header">
                <span className="okr-progress-v3__card-icon">⚡</span>
                <span className="okr-progress-v3__card-title">Ritmo</span>
              </div>
              <div className="okr-progress-v3__card-value">
                <span className={`okr-progress-v3__percent okr-progress-v3__percent--${getProgressColor()}`}>
                  {progress}%
                </span>
              </div>
              <div className="okr-progress-v3__card-bar">
                <div
                  className={`okr-progress-v3__card-bar-fill okr-progress-v3__card-bar-fill--${getProgressColor()}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="okr-progress-v3__card-detail">
                <span className="okr-progress-v3__formula">{formatValue(kr.atual || 0)} / {formatValue(kr.planejado_acumulado || 0)}</span>
                <span className="okr-progress-v3__explanation">Executado ÷ Planejado</span>
              </div>
            </div>

            {/* Card Progresso */}
            <div className={`okr-progress-v3__card okr-progress-v3__card--${
              progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
            }`}>
              <div className="okr-progress-v3__card-header">
                <span className="okr-progress-v3__card-icon">🎯</span>
                <span className="okr-progress-v3__card-title">Progresso</span>
              </div>
              <div className="okr-progress-v3__card-value">
                <span className={`okr-progress-v3__percent okr-progress-v3__percent--${
                  progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
                }`}>
                  {progressVsMeta === null ? '—' : `${progressVsMeta}%`}
                </span>
              </div>
              <div className="okr-progress-v3__card-bar">
                <div
                  className={`okr-progress-v3__card-bar-fill okr-progress-v3__card-bar-fill--${
                    progressVsMeta === null ? 'muted' : progressVsMeta >= 100 ? 'success' : progressVsMeta >= 70 ? 'warning' : 'danger'
                  }`}
                  style={{ width: `${Math.min(progressVsMeta || 0, 100)}%` }}
                />
              </div>
              <div className="okr-progress-v3__card-detail">
                <span className="okr-progress-v3__formula">{formatValue(kr.atual || 0)} / {formatValue(kr.meta || 0)}</span>
                <span className="okr-progress-v3__explanation">Executado ÷ Meta Final</span>
              </div>
            </div>
          </div>

          {/* Center: Input Cards */}
          <div className="okr-kr-progress-card__inputs">
            {/* Planejado Acumulado */}
            <div className="okr-kr-progress-card__input-card">
              <div className="okr-kr-progress-card__input-header">
                <span className="okr-kr-progress-card__input-label">PLANEJADO</span>
                {kr.auto_calculate && kr.monthly_targets && Object.keys(kr.monthly_targets).length > 0 ? (
                  <span className="okr-kr-progress-card__auto-badge">
                    <svg viewBox="0 0 24 24" width="10" height="10">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    automático
                  </span>
                ) : isPrivileged && (
                  <span className="okr-kr-progress-card__input-edit-hint">
                    <svg viewBox="0 0 24 24" width="10" height="10">
                      <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                    editar
                  </span>
                )}
              </div>
              <div className="okr-kr-progress-card__input-field">
                {kr.auto_calculate && kr.monthly_targets && Object.keys(kr.monthly_targets).length > 0 ? (
                  <span className="okr-kr-progress-card__auto-value">
                    {formatValue(kr.planejado_acumulado ?? suggestedPlanejado ?? 0)}
                  </span>
                ) : (
                  <EditableValue
                    value={kr.planejado_acumulado ?? 0}
                    onSave={handleUpdatePlanejado}
                    canEdit={isPrivileged}
                    formatFn={formatValue}
                  />
                )}
              </div>
              {kr.auto_calculate && kr.monthly_targets && Object.keys(kr.monthly_targets).length > 0 ? (
                <div className="okr-kr-progress-card__auto-info">
                  <span>{consolidationTypeLabels[kr.consolidation_type || 'last_value']}</span>
                </div>
              ) : suggestedPlanejado !== null && (
                <div className="okr-kr-progress-card__input-suggestion">
                  <span className="okr-kr-progress-card__input-suggestion-icon">💡</span>
                  <span>Sugestão: <strong>{formatValue(suggestedPlanejado)}</strong></span>
                  <span className="okr-kr-progress-card__input-suggestion-type">
                    ({consolidationTypeLabels[kr.consolidation_type || 'last_value']})
                  </span>
                </div>
              )}
            </div>

            {/* Realizado Acumulado */}
            <div className="okr-kr-progress-card__input-card">
              <div className="okr-kr-progress-card__input-header">
                <span className="okr-kr-progress-card__input-label">REALIZADO</span>
                {kr.auto_calculate ? (
                  <span className="okr-kr-progress-card__auto-badge">
                    <svg viewBox="0 0 24 24" width="10" height="10">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    automático
                  </span>
                ) : isPrivileged && (
                  <span className="okr-kr-progress-card__input-edit-hint">
                    <svg viewBox="0 0 24 24" width="10" height="10">
                      <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                    editar
                  </span>
                )}
              </div>
              <div className="okr-kr-progress-card__input-field">
                {kr.auto_calculate ? (
                  <span className="okr-kr-progress-card__auto-value">
                    {formatValue(consolidatedValue)}
                  </span>
                ) : (
                  <EditableValue
                    value={consolidatedValue}
                    onSave={handleUpdateManualValue}
                    canEdit={isPrivileged}
                    formatFn={formatValue}
                  />
                )}
              </div>
              {kr.auto_calculate ? (
                <div className="okr-kr-progress-card__auto-info">
                  <span>{consolidationTypeLabels[kr.consolidation_type || 'last_value']}</span>
                </div>
              ) : calculatedValue !== null && (
                <div className="okr-kr-progress-card__input-suggestion">
                  <span className="okr-kr-progress-card__input-suggestion-icon">💡</span>
                  <span>Sugestão: <strong>{formatValue(calculatedValue)}</strong></span>
                  <span className="okr-kr-progress-card__input-suggestion-type">
                    ({consolidationTypeLabels[kr.consolidation_type || 'last_value']})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Help text footer inside card */}
          {isPrivileged && (
            <div className="okr-kr-progress-card__footer">
              <svg viewBox="0 0 24 24" width="12" height="12">
                <path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
              {kr.auto_calculate ? (
                kr.monthly_targets && Object.keys(kr.monthly_targets).length > 0 ? (
                  <span><strong>Planejado</strong> e <strong>Realizado</strong> são calculados automaticamente das metas mensais e check-ins.</span>
                ) : (
                  <span>Preencha <strong>Planejado</strong> manualmente. <strong>Realizado</strong> é calculado automaticamente dos check-ins.</span>
                )
              ) : (
                <span>Preencha <strong>Planejado</strong> e <strong>Realizado</strong> manualmente</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Alert for unfilled past periods */}
      {monthsNotFilled.length > 0 && isPrivileged && (
        <section className="okr-section">
          <div className="okr-alert okr-alert--warning">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div className="okr-alert__content">
              <h3 className="okr-alert__title">
                {useQuarters ? 'Trimestres' : 'Meses'} Pendentes de Preenchimento
              </h3>
              <p className="okr-alert__text">
                Os seguintes {useQuarters ? 'trimestres' : 'meses'} passados ainda não têm o valor Realizado preenchido:
              </p>
              <div className="okr-alert__buttons">
                {monthsNotFilled.map(m => (
                  <button
                    key={m.key}
                    className="okr-btn okr-btn--warning-outline okr-btn--sm"
                    onClick={() => openCheckInDialog(m.month)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Alert for periods behind */}
      {monthsBehind.length > 0 && isPrivileged && (
        <section className="okr-section">
          <div className="okr-alert okr-alert--danger">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <div className="okr-alert__content">
              <h3 className="okr-alert__title">
                {useQuarters ? 'Trimestres' : 'Meses'} Abaixo da Meta
              </h3>
              <p className="okr-alert__text">
                Os seguintes {useQuarters ? 'trimestres' : 'meses'} ficaram abaixo da meta planejada e precisam de plano de ação:
              </p>
              <div className="okr-alert__buttons">
                {monthsBehind.map(m => (
                  <button
                    key={m.key}
                    className="okr-btn okr-btn--danger-outline okr-btn--sm"
                    onClick={() => openRecoveryDialogForMonth(m.month, objective?.quarter?.split('-')[1] || new Date().getFullYear())}
                  >
                    {m.label}
                    <span className="okr-btn__detail">
                      ({formatValue(m.checkIn?.valor || 0)} / {formatValue(m.target)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Two Column Layout */}
      <div className="okr-kr-grid">
        {/* Left: Monthly/Quarterly Targets */}
        <section className="okr-section">
          <div className="okr-card">
            <div className="okr-card__header">
              <h2 className="okr-card__title">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
                {useQuarters ? 'Metas Trimestrais' : 'Metas Mensais'}
                {objective?.quarter && (
                  <span className="okr-card__title-badge">
                    {useQuarters ? 'Anual' : objective.quarter.split('-')[0]}
                  </span>
                )}
              </h2>
              {isPrivileged && (
                <button className="okr-btn okr-btn--primary okr-btn--sm" onClick={() => openCheckInDialog()}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                  Check-in
                </button>
              )}
            </div>
            <div className="okr-card__body">
              {periodComparison.length > 0 ? (
                <div className="okr-monthly-list">
                  {periodComparison.map(({ key, month, label, target, checkIn, isBehind, hasRecoveryPlan, needsRecoveryPlan }) => {
                    const hasTarget = target !== null && target !== undefined;
                    return (
                    <div
                      key={key}
                      className={`okr-monthly-item ${isBehind && !hasRecoveryPlan ? 'okr-monthly-item--danger' : ''} ${isBehind && hasRecoveryPlan ? 'okr-monthly-item--warning' : ''} ${checkIn && !isBehind ? 'okr-monthly-item--success' : ''}`}
                    >
                      <div className="okr-monthly-item__header">
                        <div className="okr-monthly-item__month">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                          </svg>
                          {label}
                        </div>
                        <div className="okr-monthly-item__badges">
                          {isBehind && (
                            <span className={`okr-badge okr-badge--${hasRecoveryPlan ? 'warning' : 'danger'}`}>
                              {hasRecoveryPlan ? 'Com plano' : 'Abaixo da meta'}
                            </span>
                          )}
                          {checkIn && !isBehind && (
                            <span className="okr-badge okr-badge--success">Atingido</span>
                          )}
                        </div>
                      </div>

                      <div className="okr-monthly-item__values">
                        <div className="okr-monthly-item__value">
                          <span className="okr-monthly-item__value-label">Planejado</span>
                          <span className="okr-monthly-item__value-num">
                            <EditableValue
                              value={target}
                              onSave={(newVal) => handleUpdateTarget(key, month, newVal)}
                              canEdit={isPrivileged}
                              formatFn={formatValue}
                            />
                          </span>
                        </div>
                        <div className="okr-monthly-item__value">
                          <span className="okr-monthly-item__value-label">Realizado</span>
                          <span className={`okr-monthly-item__value-num ${checkIn && !isBehind ? 'okr-monthly-item__value-num--success' : ''} ${checkIn && isBehind ? 'okr-monthly-item__value-num--danger' : ''}`}>
                            <EditableValue
                              value={checkIn?.valor}
                              onSave={(newVal) => handleUpdateCheckIn(month, newVal, checkIn)}
                              canEdit={isPrivileged}
                              formatFn={formatValue}
                            />
                          </span>
                        </div>
                      </div>

                      {checkIn && hasTarget && (
                        <div className="okr-monthly-item__progress">
                          <div
                            className={`okr-monthly-item__progress-bar ${isBehind ? 'okr-monthly-item__progress-bar--danger' : 'okr-monthly-item__progress-bar--success'}`}
                            style={{ '--progress': `${Math.min((checkIn.valor / target) * 100, 100)}%` }}
                          />
                        </div>
                      )}

                      {(checkIn?.notas || (checkIn && canEditNotes)) && (
                        <EditableNotes
                          value={checkIn?.notas}
                          canEdit={canEditNotes}
                          onSave={(newNotes) => handleUpdateNotes(checkIn, newNotes)}
                          placeholder="Adicionar observação..."
                        />
                      )}

                      {needsRecoveryPlan && isPrivileged && (
                        <button
                          className="okr-btn okr-btn--danger okr-btn--sm okr-btn--full"
                          onClick={() => openRecoveryDialogForMonth(month, objective?.quarter?.split('-')[1] || new Date().getFullYear())}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                          </svg>
                          Criar Plano de Ação
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="okr-empty-state okr-empty-state--compact">
                  <svg viewBox="0 0 24 24" width="32" height="32">
                    <path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                  <p>Nenhuma meta mensal definida</p>
                  {isPrivileged && (
                    <button className="okr-btn okr-btn--outline okr-btn--sm" onClick={() => setShowEditDialog(true)}>
                      Editar para definir metas
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right: Comments and Recovery Plans */}
        <div className="okr-kr-right-column">
          {/* Comments */}
          <section className="okr-section">
            <div className="okr-card">
              <div className="okr-card__header">
                <h2 className="okr-card__title">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                  </svg>
                  Comentários das Áreas
                </h2>
                {isPrivileged && (
                  <button className="okr-btn okr-btn--outline okr-btn--sm" onClick={() => setShowCommentDialog(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Comentar
                  </button>
                )}
              </div>
              <div className="okr-card__body">
                {comments.length > 0 ? (
                  <div className="okr-comments-list">
                    {comments.map(comment => {
                      const categoriaColors = {
                        'Dúvida': { bg: '#fef3c7', text: '#d97706', border: '#fbbf24' },
                        'Sugestão': { bg: '#d1fae5', text: '#059669', border: '#34d399' },
                        'Comentário': { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' }
                      };
                      const catStyle = categoriaColors[comment.categoria] || categoriaColors['Comentário'];

                      return (
                        <div key={comment.id} className="okr-comment" style={{ marginBottom: '16px' }}>
                          <div className="okr-comment__header" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="okr-comment__author">{comment.author_name}</span>
                            {comment.categoria && (
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: catStyle.bg,
                                color: catStyle.text,
                                border: `1px solid ${catStyle.border}`
                              }}>
                                {comment.categoria}
                              </span>
                            )}
                            <span className="okr-comment__date">
                              {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="okr-comment__content">{comment.content}</p>

                          {/* Botão responder */}
                          <button
                            onClick={() => {
                              setReplyToComment(comment);
                              setShowCommentDialog(true);
                            }}
                            style={{
                              marginTop: '8px',
                              padding: '4px 12px',
                              fontSize: '12px',
                              color: '#6b7280',
                              backgroundColor: 'transparent',
                              border: '1px solid #e5e7eb',
                              borderRadius: '16px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="12" height="12">
                              <path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
                            </svg>
                            Responder
                          </button>

                          {/* Respostas aninhadas */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div style={{
                              marginTop: '12px',
                              paddingLeft: '20px',
                              borderLeft: '2px solid #e5e7eb'
                            }}>
                              {comment.replies.map(reply => (
                                <div key={reply.id} className="okr-comment okr-comment--reply" style={{ marginBottom: '12px' }}>
                                  <div className="okr-comment__header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="okr-comment__author" style={{ fontSize: '13px' }}>{reply.author_name}</span>
                                    <span className="okr-comment__date" style={{ fontSize: '11px' }}>
                                      {new Date(reply.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                  <p className="okr-comment__content" style={{ fontSize: '13px', marginTop: '4px' }}>{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="okr-empty-state okr-empty-state--compact">
                    <svg viewBox="0 0 24 24" width="32" height="32">
                      <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    </svg>
                    <p>Nenhum comentário ainda</p>
                    <small>Líderes de outras áreas podem comentar aqui</small>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Recovery Plans */}
          <section className="okr-section">
            <div className="okr-card">
              <div className="okr-card__header">
                <h2 className="okr-card__title">
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  Planos de Recuperação
                </h2>
                {isPrivileged && (
                  <button className="okr-btn okr-btn--outline okr-btn--sm" onClick={() => setShowRecoveryDialog(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    Novo Plano
                  </button>
                )}
              </div>
              <div className="okr-card__body">
                {recoveryPlans.length > 0 ? (
                  <div className="okr-recovery-list">
                    {recoveryPlans.map(plan => (
                      <RecoveryPlanCard
                        key={plan.id}
                        plan={plan}
                        canEdit={isPrivileged}
                        onRefresh={fetchData}
                        onEdit={handleEditRecoveryPlan}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="okr-empty-state okr-empty-state--compact">
                    <svg viewBox="0 0 24 24" width="32" height="32">
                      <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                    <p>Nenhum plano de recuperação</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Dialogs */}
      <CheckInDialog
        open={showCheckInDialog}
        onClose={() => {
          setShowCheckInDialog(false);
          setCheckInInitialMonth(null);
        }}
        onSuccess={fetchData}
        kr={kr}
        checkIns={checkIns}
        quarter={objective?.quarter}
        objective={objective}
        initialMonth={checkInInitialMonth}
      />

      <CommentDialog
        open={showCommentDialog}
        onClose={() => {
          setShowCommentDialog(false);
          setReplyToComment(null);
        }}
        onSuccess={fetchData}
        krId={id}
        replyTo={replyToComment}
      />

      <RecoveryPlanDialog
        open={showRecoveryDialog}
        onClose={() => setShowRecoveryDialog(false)}
        onSuccess={fetchData}
        krId={id}
        defaultMonth={recoveryMonth}
        defaultYear={recoveryYear}
        quarter={objective?.quarter}
      />

      {kr && (
        <EditKeyResultDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={fetchData}
          kr={kr}
          quarter={objective?.quarter}
          setorId={objective?.setor_id}
        />
      )}

      <EditRecoveryPlanDialog
        open={showEditRecoveryDialog}
        onClose={() => {
          setShowEditRecoveryDialog(false);
          setEditingRecoveryPlan(null);
        }}
        onSuccess={fetchData}
        plan={editingRecoveryPlan}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteKR}
        title="Excluir Key Result"
        message="Tem certeza que deseja excluir este Key Result? Todos os check-ins, comentários e planos de recuperação vinculados também serão excluídos. Esta ação não pode ser desfeita."
        isDeleting={isDeleting}
      />
    </div>
  );
}

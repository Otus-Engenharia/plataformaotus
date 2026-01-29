import React, { useState } from 'react';
import { formatValue } from '../../../utils/indicator-utils';
import './Dialogs.css';

const MONTH_OPTIONS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

export default function CreateRecoveryPlanDialog({
  indicador,
  responsaveis = [],
  onSubmit,
  onClose
}) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const [mesReferencia, setMesReferencia] = useState(currentMonth);
  const [anoReferencia, setAnoReferencia] = useState(currentYear);
  const [descricao, setDescricao] = useState('');
  const [prazoFinal, setPrazoFinal] = useState('');
  const [actions, setActions] = useState([{
    titulo: '',
    prazo: '',
    responsavel: indicador?.person_name || ''
  }]);
  const [loading, setLoading] = useState(false);

  const addAction = () => {
    setActions([...actions, {
      titulo: '',
      prazo: '',
      responsavel: indicador?.person_name || ''
    }]);
  };

  const removeAction = (index) => {
    if (actions.length > 1) {
      setActions(actions.filter((_, i) => i !== index));
    }
  };

  const updateAction = (index, field, value) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setActions(newActions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!descricao.trim()) {
      alert('Descreva as causas do problema e a estratégia de recuperação');
      return;
    }

    const validActions = actions.filter(a => a.titulo.trim());
    if (validActions.length === 0) {
      alert('Adicione pelo menos uma ação');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        indicador_id: indicador.id,
        mes_referencia: mesReferencia,
        ano_referencia: anoReferencia,
        descricao: descricao.trim(),
        prazo: prazoFinal || null,
        actions: validActions.map(a => ({
          descricao: a.titulo.trim(),
          prazo: a.prazo || null,
          responsavel: a.responsavel || null
        })),
        status: 'pendente'
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content dialog-large glass-card" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <h2>Criar Plano de Recuperação</h2>
            <p className="dialog-subtitle">Defina ações para recuperar o desempenho do indicador</p>
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          {/* Mês e Ano de Referência */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="recovery-mes">Mês de referência</label>
              <select
                id="recovery-mes"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(parseInt(e.target.value))}
              >
                {MONTH_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recovery-ano">Ano</label>
              <select
                id="recovery-ano"
                value={anoReferencia}
                onChange={(e) => setAnoReferencia(parseInt(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição do Plano */}
          <div className="form-group">
            <label htmlFor="recovery-descricao">Descrição do plano *</label>
            <textarea
              id="recovery-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva as causas do problema e a estratégia de recuperação..."
              rows={3}
              required
            />
          </div>

          {/* Prazo Final */}
          <div className="form-group">
            <label htmlFor="recovery-prazo">Prazo final (opcional)</label>
            <input
              id="recovery-prazo"
              type="date"
              value={prazoFinal}
              onChange={(e) => setPrazoFinal(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Ações */}
          <div className="form-section">
            <div className="form-section-header">
              <label>Ações *</label>
              <button type="button" className="btn-small" onClick={addAction}>
                + Adicionar Ação
              </button>
            </div>

            <div className="recovery-actions-list">
              {actions.map((action, index) => (
                <div key={index} className="recovery-action-card">
                  <div className="recovery-action-header">
                    <span className="action-label">Ação {index + 1}</span>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        className="btn-icon-small btn-danger"
                        onClick={() => removeAction(index)}
                        title="Remover ação"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="form-group">
                    <input
                      type="text"
                      value={action.titulo}
                      onChange={(e) => updateAction(index, 'titulo', e.target.value)}
                      placeholder="Título da ação..."
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Prazo</label>
                      <input
                        type="date"
                        value={action.prazo}
                        onChange={(e) => updateAction(index, 'prazo', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>

                    <div className="form-group">
                      <label>Responsável</label>
                      {responsaveis.length > 0 ? (
                        <select
                          value={action.responsavel}
                          onChange={(e) => updateAction(index, 'responsavel', e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {responsaveis.map(r => (
                            <option key={r.email || r.name} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={action.responsavel}
                          onChange={(e) => updateAction(index, 'responsavel', e.target.value)}
                          placeholder="Nome do responsável"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

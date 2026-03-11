import React, { useState, useMemo, useEffect } from 'react';

const DIMENSOES = [
  { key: 'cronograma', label: 'Cronograma', required: false, hint: 'Deixe vazio para projetos de compatibilização' },
  { key: 'qualidade', label: 'Qualidade', required: true },
  { key: 'comunicacao', label: 'Comunicação', required: true },
  { key: 'custos', label: 'Custos', required: true },
  { key: 'parceria', label: 'Parceria', required: true },
  { key: 'confianca', label: 'Confiança', required: true },
];

const SCALE_OPTIONS = [
  {
    value: 1,
    label: 'Insatisfeito',
    color: '#dc2626',
    bgLight: 'rgba(220, 38, 38, 0.08)',
    bgActive: 'rgba(220, 38, 38, 0.15)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    value: 2,
    label: 'Neutro',
    color: '#d97706',
    bgLight: 'rgba(217, 119, 6, 0.08)',
    bgActive: 'rgba(217, 119, 6, 0.15)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="15" x2="16" y2="15" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
  {
    value: 3,
    label: 'Satisfeito',
    color: '#15803d',
    bgLight: 'rgba(21, 128, 61, 0.08)',
    bgActive: 'rgba(21, 128, 61, 0.15)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
  },
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function PercepcaoFormDialog({
  open, onClose, onSubmit, projetos = [], submitting = false,
  fixedProjeto = null, percepcoes = [], portfolioMap = null,
  userRespondedCodes = null,
}) {
  const now = new Date();
  const [selectedCodes, setSelectedCodes] = useState(fixedProjeto ? [fixedProjeto] : []);
  const [form, setForm] = useState({
    mes_referencia: now.getMonth() + 1,
    ano_referencia: now.getFullYear(),
    cronograma: '',
    qualidade: '',
    comunicacao: '',
    custos: '',
    parceria: '',
    confianca: '',
    oportunidade_revenda: '',
    comentarios: '',
  });
  const [error, setError] = useState('');

  // Reset form state when dialog opens or fixedProjeto changes
  useEffect(() => {
    if (open) {
      setSelectedCodes(fixedProjeto ? [fixedProjeto] : []);
      setForm({
        mes_referencia: now.getMonth() + 1,
        ano_referencia: now.getFullYear(),
        cronograma: '',
        qualidade: '',
        comunicacao: '',
        custos: '',
        parceria: '',
        confianca: '',
        oportunidade_revenda: '',
        comentarios: '',
      });
      setError('');
    }
  }, [open, fixedProjeto]);

  // Revenda auto-disable logic — must be before early return to keep hooks order stable
  const revendaDisabled = useMemo(() => {
    if (!portfolioMap || selectedCodes.length === 0 || !percepcoes.length) return false;
    const selectedClients = new Set(
      selectedCodes.map(code => portfolioMap.get(code)?.client).filter(Boolean)
    );
    if (selectedClients.size === 0) return false;
    return percepcoes.some(p =>
      p.oportunidade_revenda != null &&
      !selectedCodes.includes(p.project_code) &&
      selectedClients.has(portfolioMap.get(p.project_code)?.client)
    );
  }, [selectedCodes, percepcoes, portfolioMap]);

  if (!open) return null;

  const isMultiMode = !fixedProjeto;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleProject = (code) => {
    setSelectedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
    setError('');
  };

  const selectAll = () => {
    const selectable = projetos.filter(p => !userRespondedCodes?.has(p));
    setSelectedCodes(selectable);
  };
  const clearSelection = () => setSelectedCodes([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (selectedCodes.length === 0) {
      setError('Selecione pelo menos um projeto');
      return;
    }

    for (const dim of DIMENSOES) {
      if (dim.required && !form[dim.key]) {
        setError(`A dimensão "${dim.label}" é obrigatória`);
        return;
      }
    }

    const payload = {
      project_codes: selectedCodes,
      mes_referencia: Number(form.mes_referencia),
      ano_referencia: Number(form.ano_referencia),
      cronograma: form.cronograma ? Number(form.cronograma) : null,
      qualidade: Number(form.qualidade),
      comunicacao: Number(form.comunicacao),
      custos: Number(form.custos),
      parceria: Number(form.parceria),
      confianca: Number(form.confianca),
      oportunidade_revenda: revendaDisabled ? null : (form.oportunidade_revenda === '' ? null : form.oportunidade_revenda === 'true'),
      comentarios: form.comentarios || null,
    };

    onSubmit(payload);
  };

  const currentYear = now.getFullYear();
  const anos = Array.from({ length: currentYear - 2023 + 1 }, (_, i) => currentYear - i);

  const filledCount = DIMENSOES.filter(d => d.required ? form[d.key] !== '' : true).filter(d => d.required).length;
  const requiredCount = DIMENSOES.filter(d => d.required).length;

  const submitLabel = submitting
    ? 'Salvando...'
    : selectedCodes.length > 1
      ? `Salvar para ${selectedCodes.length} projetos`
      : 'Salvar Percepção';

  return (
    <div className="percepcao-dialog-overlay" onClick={onClose}>
      <div className="percepcao-dialog-v2" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="percepcao-dialog-header-v2">
          <div>
            <h3 className="percepcao-dialog-title-v2">Nova Percepção de Equipe</h3>
            <p className="percepcao-dialog-subtitle-v2">Avalie a percepção do cliente sobre o projeto</p>
          </div>
          <button className="percepcao-dialog-close-v2" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="percepcao-form-v2">
          {error && (
            <div className="percepcao-form-error-v2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Section 1: Projeto e Período */}
          <fieldset className="percepcao-section-v2">
            <legend className="percepcao-section-legend-v2">Projeto e Período</legend>

            <div className="percepcao-field-v2">
              <label className="percepcao-label-v2">
                {isMultiMode ? 'Projetos' : 'Projeto'} <span className="percepcao-required-v2">*</span>
              </label>
              {fixedProjeto ? (
                <input
                  type="text"
                  value={fixedProjeto}
                  disabled
                  className="percepcao-input-v2"
                />
              ) : (
                <>
                  <div className="percepcao-multiselect-actions">
                    <button type="button" className="percepcao-link-btn" onClick={selectAll}>
                      Selecionar todos
                    </button>
                    <span className="percepcao-multiselect-sep">|</span>
                    <button type="button" className="percepcao-link-btn" onClick={clearSelection}>
                      Limpar
                    </button>
                    <span className="percepcao-multiselect-count">
                      {selectedCodes.length} de {projetos.length} selecionados
                    </span>
                  </div>
                  <div className="percepcao-checkbox-list">
                    {projetos.map(p => {
                      const alreadyFilled = userRespondedCodes?.has(p);
                      return (
                        <label key={p} className={`percepcao-checkbox-item ${alreadyFilled ? 'percepcao-checkbox-disabled' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedCodes.includes(p)}
                            onChange={() => toggleProject(p)}
                            disabled={alreadyFilled}
                          />
                          <span className="percepcao-checkbox-label">{p}</span>
                          {alreadyFilled && <span className="percepcao-checkbox-filled-note">Já preenchido</span>}
                        </label>
                      );
                    })}
                    {projetos.length === 0 && (
                      <span className="percepcao-checkbox-empty">Nenhum projeto disponível</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="percepcao-row-2col-v2">
              <div className="percepcao-field-v2">
                <label htmlFor="perc-mes" className="percepcao-label-v2">
                  Mês <span className="percepcao-required-v2">*</span>
                </label>
                <select
                  id="perc-mes"
                  value={form.mes_referencia}
                  onChange={e => handleChange('mes_referencia', e.target.value)}
                  className="percepcao-input-v2"
                >
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="percepcao-field-v2">
                <label htmlFor="perc-ano" className="percepcao-label-v2">
                  Ano <span className="percepcao-required-v2">*</span>
                </label>
                <select
                  id="perc-ano"
                  value={form.ano_referencia}
                  onChange={e => handleChange('ano_referencia', e.target.value)}
                  className="percepcao-input-v2"
                >
                  {anos.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Section 2: Dimensões */}
          <fieldset className="percepcao-section-v2">
            <legend className="percepcao-section-legend-v2">
              Dimensões
              <span className="percepcao-progress-v2">{filledCount}/{requiredCount} obrigatórias</span>
            </legend>

            <div className="percepcao-dimensions-v2">
              {DIMENSOES.map(dim => {
                const selected = form[dim.key];
                return (
                  <div key={dim.key} className="percepcao-dim-row-v2">
                    <div className="percepcao-dim-header-v2">
                      <span className="percepcao-dim-name-v2">
                        {dim.label}
                        {dim.required && <span className="percepcao-required-v2">*</span>}
                      </span>
                      {dim.hint && <span className="percepcao-dim-hint-v2">{dim.hint}</span>}
                    </div>
                    <div className="percepcao-rating-cards-v2">
                      {!dim.required && (
                        <button
                          type="button"
                          className={`percepcao-rating-card-v2 percepcao-rating-na-v2 ${selected === '' ? 'active' : ''}`}
                          onClick={() => handleChange(dim.key, '')}
                          aria-label={`${dim.label}: Não se aplica`}
                        >
                          <span className="percepcao-rating-icon-v2" style={{ color: '#737373' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </span>
                          <span className="percepcao-rating-label-v2">N/A</span>
                        </button>
                      )}
                      {SCALE_OPTIONS.map(opt => {
                        const isActive = Number(selected) === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            className={`percepcao-rating-card-v2 ${isActive ? 'active' : ''}`}
                            style={{
                              '--rating-color': opt.color,
                              '--rating-bg': opt.bgLight,
                              '--rating-bg-active': opt.bgActive,
                            }}
                            onClick={() => handleChange(dim.key, String(opt.value))}
                            aria-label={`${dim.label}: ${opt.value} - ${opt.label}`}
                          >
                            <span className="percepcao-rating-icon-v2">{opt.icon}</span>
                            <span className="percepcao-rating-value-v2">{opt.value}</span>
                            <span className="percepcao-rating-label-v2">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* Section 3: Extras */}
          <fieldset className="percepcao-section-v2">
            <legend className="percepcao-section-legend-v2">Informações Adicionais</legend>

            <div className="percepcao-field-v2">
              <label htmlFor="perc-revenda" className="percepcao-label-v2">Oportunidade de Revenda</label>
              <span className="percepcao-dim-hint-v2">
                Preencha apenas em 1 projeto por cliente por mês
              </span>
              {revendaDisabled && (
                <div className="percepcao-revenda-disabled-msg">
                  Já preenchido em outro projeto deste cliente neste mês
                </div>
              )}
              <select
                id="perc-revenda"
                value={revendaDisabled ? '' : form.oportunidade_revenda}
                onChange={e => handleChange('oportunidade_revenda', e.target.value)}
                className="percepcao-input-v2"
                disabled={revendaDisabled}
              >
                <option value="">Não informado</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>

            <div className="percepcao-field-v2">
              <label htmlFor="perc-comentarios" className="percepcao-label-v2">Comentários</label>
              <textarea
                id="perc-comentarios"
                value={form.comentarios}
                onChange={e => handleChange('comentarios', e.target.value)}
                className="percepcao-input-v2 percepcao-textarea-v2"
                rows={3}
                placeholder="Observações sobre o projeto neste período..."
              />
            </div>
          </fieldset>

          {/* Actions */}
          <div className="percepcao-actions-v2">
            <button type="button" className="percepcao-btn-cancel-v2" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="percepcao-btn-submit-v2" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="percepcao-spinner-v2" />
                  Salvando...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PercepcaoFormDialog;

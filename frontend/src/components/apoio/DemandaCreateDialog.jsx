import React, { useState, useEffect, useMemo } from 'react';
import SearchableDropdown from '../SearchableDropdown';
import './DemandaCreateDialog.css';

const API_URL = import.meta.env.VITE_API_URL || '';

const CATEGORIAS = [
  { value: 'ajuste_pastas', label: 'Ajuste de Pastas', icon: '📁' },
  { value: 'modelo_federado', label: 'Modelo Federado', icon: '🏗️' },
  { value: 'regras_modelo_federado', label: 'Regras do Modelo Federado', icon: '📋' },
  { value: 'modelagem', label: 'Modelagem', icon: '📐' },
];

const TIPOS_SERVICO = [
  { value: 'modelagem_compatibilizacao', label: 'Modelagem para Compatibilizacao' },
  { value: 'pranchas_alvenaria', label: 'Pranchas de Alvenaria' },
  { value: 'pranchas_furacao', label: 'Pranchas de Furacao' },
  { value: 'unir_markups', label: 'Unir Markups' },
  { value: 'quantitativo', label: 'Quantitativo' },
  { value: 'outro', label: 'Outro' },
];

export default function DemandaCreateDialog({ onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    categoria: '',
    tipo_servico: '',
    tipo_servico_outro: '',
    coordenador_projeto: '',
    cliente_projeto: '',
    acesso_drive: false,
    link_drive: '',
    descricao: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [portfolio, setPortfolio] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  // Busca dados do portfolio ao abrir o dialog
  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const response = await fetch(`${API_URL}/api/portfolio`, { credentials: 'include' });
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setPortfolio(data.data);
        }
      } catch (err) {
        console.error('Erro ao carregar portfolio:', err);
      } finally {
        setLoadingPortfolio(false);
      }
    }
    fetchPortfolio();
  }, []);

  // Monta opcoes do dropdown a partir do portfolio
  const projectOptions = useMemo(() => {
    const seen = new Set();
    return portfolio
      .filter(p => p.project_name)
      .reduce((acc, p) => {
        const key = p.project_name;
        if (!seen.has(key)) {
          seen.add(key);
          acc.push({ value: key, label: key });
        }
        return acc;
      }, [])
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [portfolio]);

  // Mapa para lookup rapido do lider pelo valor selecionado
  const projectLiderMap = useMemo(() => {
    const map = {};
    portfolio.forEach(p => {
      if (p.project_name) {
        map[p.project_name] = p.lider || '';
      }
    });
    return map;
  }, [portfolio]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleProjectSelect = (value) => {
    updateField('cliente_projeto', value);
    updateField('coordenador_projeto', projectLiderMap[value] || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isModelagem = formData.categoria === 'modelagem';
  const isValid = formData.categoria &&
    formData.coordenador_projeto.trim() &&
    formData.cliente_projeto.trim() &&
    formData.descricao.trim() &&
    (!isModelagem || formData.tipo_servico);

  return (
    <div className="dm-dialog-overlay">
      <div className="dm-dialog">
        <div className="dm-dialog__header">
          <div className="dm-dialog__title-row">
            <svg className="dm-dialog__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <h2>Nova Demanda</h2>
          </div>
          <button className="dm-dialog__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className="dm-dialog__form" onSubmit={handleSubmit}>
          {/* Categoria */}
          <div className="dm-dialog__field">
            <label className="dm-dialog__label">
              Categoria <span className="dm-dialog__required">*</span>
            </label>
            <div className="dm-dialog__radio-grid">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  className={`dm-dialog__radio-btn ${formData.categoria === cat.value ? 'dm-dialog__radio-btn--active' : ''}`}
                  onClick={() => {
                    updateField('categoria', cat.value);
                    if (cat.value !== 'modelagem') {
                      updateField('tipo_servico', '');
                      updateField('tipo_servico_outro', '');
                    }
                  }}
                >
                  <span className="dm-dialog__radio-icon">{cat.icon}</span>
                  <span className="dm-dialog__radio-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo de Servico (condicional) */}
          {isModelagem && (
            <div className="dm-dialog__field">
              <label className="dm-dialog__label">
                Tipo de Servico <span className="dm-dialog__required">*</span>
              </label>
              <select
                className="dm-dialog__select"
                value={formData.tipo_servico}
                onChange={(e) => updateField('tipo_servico', e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {TIPOS_SERVICO.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
              {formData.tipo_servico === 'outro' && (
                <input
                  type="text"
                  className="dm-dialog__input dm-dialog__input--mt"
                  placeholder="Especifique o tipo de servico..."
                  value={formData.tipo_servico_outro}
                  onChange={(e) => updateField('tipo_servico_outro', e.target.value)}
                />
              )}
            </div>
          )}

          {/* Projeto (dropdown do portfolio) */}
          <div className="dm-dialog__field">
            <label className="dm-dialog__label">
              Projeto <span className="dm-dialog__required">*</span>
            </label>
            <SearchableDropdown
              value={formData.cliente_projeto}
              onChange={handleProjectSelect}
              options={projectOptions}
              placeholder={loadingPortfolio ? 'Carregando projetos...' : 'Selecione o projeto'}
              disabled={loadingPortfolio}
            />
          </div>

          {/* Coordenador do Projeto (auto-preenchido) */}
          <div className="dm-dialog__field">
            <label className="dm-dialog__label">
              Coordenador do Projeto
            </label>
            <input
              type="text"
              className="dm-dialog__input dm-dialog__input--readonly"
              value={formData.coordenador_projeto}
              readOnly
              placeholder="Selecione um projeto acima"
            />
          </div>

          {/* Acesso ao Drive */}
          <div className="dm-dialog__field">
            <label className="dm-dialog__label">Acesso ao Drive</label>
            <div className="dm-dialog__toggle-row">
              <label className="dm-dialog__toggle">
                <input
                  type="checkbox"
                  checked={formData.acesso_drive}
                  onChange={(e) => updateField('acesso_drive', e.target.checked)}
                />
                <span className="dm-dialog__toggle-slider"></span>
                <span className="dm-dialog__toggle-text">
                  {formData.acesso_drive ? 'Sim' : 'Nao'}
                </span>
              </label>
            </div>
            {formData.acesso_drive && (
              <input
                type="url"
                className="dm-dialog__input dm-dialog__input--mt"
                value={formData.link_drive}
                onChange={(e) => updateField('link_drive', e.target.value)}
                placeholder="Link do drive"
              />
            )}
          </div>

          {/* Descricao */}
          <div className="dm-dialog__field">
            <label className="dm-dialog__label">
              Descricao <span className="dm-dialog__required">*</span>
            </label>
            <textarea
              className="dm-dialog__textarea"
              value={formData.descricao}
              onChange={(e) => updateField('descricao', e.target.value)}
              placeholder="Descreva a demanda em detalhes..."
              rows={4}
              required
            />
          </div>

          {/* Actions */}
          <div className="dm-dialog__actions">
            <button
              type="button"
              className="dm-dialog__btn dm-dialog__btn--secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="dm-dialog__btn dm-dialog__btn--primary"
              disabled={submitting || !isValid}
            >
              {submitting ? 'Enviando...' : 'Criar Demanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

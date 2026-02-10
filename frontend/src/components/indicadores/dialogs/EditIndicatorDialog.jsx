import React, { useState } from 'react';
import './Dialogs.css';

const METRIC_TYPES = [
  { value: 'number', label: 'Número' },
  { value: 'percentage', label: 'Percentual' },
  { value: 'currency', label: 'Moeda' }
];

const CONSOLIDATION_TYPES = [
  { value: 'sum', label: 'Soma' },
  { value: 'average', label: 'Média' },
  { value: 'last_value', label: 'Último Valor' },
  { value: 'manual', label: 'Manual' }
];

export default function EditIndicatorDialog({
  indicador,
  onSubmit,
  onClose
}) {
  const [formData, setFormData] = useState({
    nome: indicador?.nome || '',
    descricao: indicador?.descricao || '',
    metric_type: indicador?.metric_type || 'percentage',
    consolidation_type: indicador?.consolidation_type || 'manual',
    threshold_80: indicador?.threshold_80 || '',
    meta: indicador?.meta || '',
    threshold_120: indicador?.threshold_120 || '',
    peso: indicador?.peso || 1,
    is_inverse: indicador?.is_inverse || false
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      alert('Título é obrigatório');
      return;
    }

    if (!formData.meta && formData.meta !== 0) {
      alert('Meta é obrigatória');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        metric_type: formData.metric_type,
        consolidation_type: formData.consolidation_type,
        meta: parseFloat(formData.meta),
        threshold_80: formData.threshold_80 ? parseFloat(formData.threshold_80) : null,
        threshold_120: formData.threshold_120 ? parseFloat(formData.threshold_120) : null,
        peso: formData.peso ? parseInt(formData.peso, 10) : 1,
        is_inverse: formData.is_inverse
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content dialog-medium glass-card" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <div>
            <h2>Editar Indicador</h2>
            <p className="dialog-subtitle">Altere as configurações do indicador</p>
          </div>
          <button className="dialog-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          {/* Título */}
          <div className="form-group">
            <label htmlFor="ind-nome">Título *</label>
            <input
              id="ind-nome"
              type="text"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              placeholder="Nome do indicador"
              required
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="form-group">
            <label htmlFor="ind-descricao">Descrição</label>
            <textarea
              id="ind-descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descrição opcional..."
              rows={2}
            />
          </div>

          {/* Tipo e Consolidação */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ind-metric-type">Tipo de Métrica</label>
              <select
                id="ind-metric-type"
                value={formData.metric_type}
                onChange={(e) => handleChange('metric_type', e.target.value)}
              >
                {METRIC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ind-consolidation">Consolidação</label>
              <select
                id="ind-consolidation"
                value={formData.consolidation_type}
                onChange={(e) => handleChange('consolidation_type', e.target.value)}
              >
                {CONSOLIDATION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metas - Mínimo, Meta, Superação */}
          <div className="form-row form-row--triple">
            <div className="form-group">
              <label htmlFor="ind-t80">Mínimo (80%)</label>
              <input
                id="ind-t80"
                type="number"
                step="any"
                value={formData.threshold_80}
                onChange={(e) => handleChange('threshold_80', e.target.value)}
                placeholder="80"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ind-meta">Meta (100%)</label>
              <input
                id="ind-meta"
                type="number"
                step="any"
                value={formData.meta}
                onChange={(e) => handleChange('meta', e.target.value)}
                placeholder="100"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="ind-t120">Superação (120%)</label>
              <input
                id="ind-t120"
                type="number"
                step="any"
                value={formData.threshold_120}
                onChange={(e) => handleChange('threshold_120', e.target.value)}
                placeholder="120"
              />
            </div>
          </div>

          {/* Peso */}
          <div className="form-group">
            <label htmlFor="ind-peso">Peso</label>
            <input
              id="ind-peso"
              type="number"
              min="1"
              max="100"
              value={formData.peso}
              onChange={(e) => handleChange('peso', e.target.value)}
              placeholder="1"
            />
          </div>

          {/* Indicador Inverso */}
          <div className="form-group">
            <label className="checkbox-label-toggle">
              <span className="toggle-text">
                <strong>Indicador Inverso</strong>
                <span className="toggle-hint">Menor valor = melhor resultado</span>
              </span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.is_inverse}
                  onChange={(e) => handleChange('is_inverse', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
